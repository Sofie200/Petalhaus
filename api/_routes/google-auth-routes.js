import { Router } from 'express'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { pool } from '../_db/pool.js'
import { setAuthCookie } from '../_lib/authCookie.js'

const router = Router()

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const TIMEOUT_MS = 5_000 // Google must answer the code exchange within 5 s

// Short-lived cookie that carries state + PKCE verifier from start to callback
const FLOW_COOKIE = 'GoogleFlow'
const FLOW_COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'lax', // lax = still sent when Google redirects back to us
    secure: process.env.VERCEL === '1',
    maxAge: 10 * 60 * 1000, // 10 minutes
    path: '/api/auth/google', // only sent to these routes
}

// Back to the shop with an error code that React turns into a readable message.
// Relative URL = same origin as the callback (Vite proxy locally, Vercel in prod)
const fail = (res, code, back = '/') => res.redirect(`${back}?authError=${code}`)

// What we need from the token endpoint's answer – the ID token is all we use
const TokenAnswer = z.object({
    id_token: z.string().min(1),
})

// What we accept from Google's ID token
const IdToken = z
    .object({
        iss: z.enum(['https://accounts.google.com', 'accounts.google.com']), // issued by Google
        aud: z.string(),                                                        // to which app
        exp: z.number(),                                                        // expires (seconds)
        sub: z.string().min(1).max(255),                                        // Google's id for the customer
        email: z.email(),
        email_verified: z.literal(true),
        name: z.string().optional(),
        given_name: z.string().optional(),
        family_name: z.string().optional(),
    })
    .refine((t) => t.aud === process.env.GOOGLE_CLIENT_ID, { message: 'Fel aud', path: ['aud'] })
    .refine((t) => t.exp * 1000 > Date.now(), { message: 'ID-token har gått ut', path: ['exp'] })

/* --- GET /api/auth/google[?mode=link] → redirect to Google --- */
router.get('/', (req, res) => {
    const mode = req.query.mode === 'link' ? 'link' : 'login'

    // state: random value we compare in the callback
    const state = crypto.randomBytes(32).toString('base64url')
    // PKCE: keep the verifier, send only its hash (challenge) to Google
    const verifier = crypto.randomBytes(32).toString('base64url')
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')

    // Signed so it can't be tampered with, httpOnly so JS can't read it
    const flow = jwt.sign({ state, verifier, mode }, process.env.JWT_SECRET, { expiresIn: '10m' })
    res.cookie(FLOW_COOKIE, flow, FLOW_COOKIE_OPTIONS)

    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        response_type: 'code',
        scope: 'openid email profile', // minimal scope
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        prompt: 'select_account',
    })

    res.redirect(`${GOOGLE_AUTH_URL}?${params}`)
})

/* --- GET /api/auth/google/callback?code=...&state=... --- */
router.get('/callback', async (req, res) => {
    // 1. Read and delete the flow cookie – it can only be used once
    const flowToken = req.cookies[FLOW_COOKIE]
    res.clearCookie(FLOW_COOKIE, FLOW_COOKIE_OPTIONS)

    let flow = null
    try {
        flow = jwt.verify(flowToken, process.env.JWT_SECRET)
    } catch {
        // missing, expired or tampered with → flow stays null
    }
    const back = flow?.mode === 'link' ? '/profile' : '/'

    // 2. Customer pressed Cancel, or Google returned another error
    if (req.query.error) {
        return fail(res, req.query.error === 'access_denied' ? 'cancelled' : 'google_error', back)
    }

    // 3. state must match what we saved at start
    if (!flow || typeof req.query.state !== 'string' || req.query.state !== flow.state) {
        return fail(res, 'invalid_state', back)
    }
    if (typeof req.query.code !== 'string') {
        return fail(res, 'google_error', back)
    }

    try {
        // 4. Code → tokens, server to server, with client secret + PKCE verifier
        const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code: req.query.code,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: process.env.GOOGLE_REDIRECT_URI,
                grant_type: 'authorization_code',
                code_verifier: flow.verifier,
            }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        if (!tokenRes.ok) {
            console.error('[GOOGLE] Token exchange failed:', tokenRes.status, await tokenRes.text())
            return fail(res, 'google_error', back)
        }
        const tokenAnswer = TokenAnswer.safeParse(await tokenRes.json())
        if (!tokenAnswer.success) {
            console.error('[GOOGLE] Unexpected token answer:', z.prettifyError(tokenAnswer.error))
            return fail(res, 'google_error', back)
        }
        const { id_token } = tokenAnswer.data

        // 5. Read the customer from the ID token (a JWT) and validate it
        const claims = IdToken.safeParse(jwt.decode(id_token))
        if (!claims.success) {
            console.error('[GOOGLE] Invalid ID token:', z.prettifyError(claims.error))
            return fail(res, 'invalid_token', back)
        }

        // 6. Log in / create customer – or link to the logged-in password account
        return flow.mode === 'link'
            ? await linkAccount(req, res, claims.data)
            : await loginWithGoogle(res, claims.data)
    } catch (err) {
        // Google didn't answer in time → the customer gets "Google kunde inte logga in dig just nu"
        if (err.name === 'TimeoutError') {
            console.error(`[GOOGLE] No answer from Google within ${TIMEOUT_MS} ms`)
            return fail(res, 'google_error', back)
        }
        console.error('[GOOGLE] Callback failed:', err)
        return fail(res, 'server_error', back)
    }
})

// The customer is recognised by sub – never by email
async function loginWithGoogle(res, google) {
    const { rows: [existing] } = await pool.query(
        'SELECT id, first_name, role FROM user_ WHERE google_sub = $1',
        [google.sub]
    )
    if (existing) {
        setAuthCookie(res, existing)
        return res.redirect('/')
    }

    // First Google login. Same email as a password account → don't merge, explain instead
    const { rows: [sameEmail] } = await pool.query(
        'SELECT id FROM user_ WHERE lower(email) = lower($1)',
        [google.email]
    )
    if (sameEmail) return fail(res, 'email_taken')

    try {
        const { rows: [created] } = await pool.query(
            `INSERT INTO user_ (google_sub, email, first_name, last_name, role)
			 VALUES ($1, $2, $3, $4, 'user')
			 RETURNING id, first_name, role`,
            [google.sub, google.email, google.given_name ?? google.name ?? google.email, google.family_name ?? null]
        )
        setAuthCookie(res, created)
        return res.redirect('/')
    } catch (err) {
        if (err.code === '23505') return fail(res, 'email_taken') // unique violation
        throw err
    }
}

// Logged in with password AND just proved the Google account → link, then Google only
async function linkAccount(req, res, google) {
    let me
    try {
        me = jwt.verify(req.cookies.TokenCookie, process.env.JWT_SECRET)
    } catch {
        return fail(res, 'not_logged_in')
    }

    const { rows: [owner] } = await pool.query(
        'SELECT id FROM user_ WHERE google_sub = $1',
        [google.sub]
    )
    if (owner && owner.id !== me.user_id) return fail(res, 'google_in_use', '/profile')

    await pool.query(
        'UPDATE user_ SET google_sub = $1, pw = NULL, pw_hash = NULL WHERE id = $2',
        [google.sub, me.user_id]
    )
    return res.redirect('/profile?linked=1')
}

export default router