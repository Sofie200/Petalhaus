import { Router } from 'express'
import { exchangeCode, getAuthorizeUrl, getUser } from '../_integrations/githubAdapter.js'
// PKCE is commented out (every line marked PKCE). The login still works, because our server has the
// client secret. Uncomment all of them – here and in githubAdapter.js – to turn PKCE on.
import { randomString /* , toCodeChallenge */ } from '../_lib/pkce.js' // PKCE
import { pool } from '../_db/pool.js'
import { setAuthCookie } from '../_lib/authCookie.js'

const router = Router()

// Who is admin: a list of GitHub usernames in .env, e.g. anna-k,erik99
// Many admins? Membership in the shop's GitHub organisation instead (scope read:org).
// Example ADMINS = ['sibala','user1','user2']
const ADMINS = process.env.ADMIN_GITHUB_LOGINS?.split(',') ?? []


/** @type {import('express').CookieOptions} */
const COOKIE = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }

// state and the code verifier for ONE login: 10 minutes, and only sent to /api/auth/github…
/** @type {import('express').CookieOptions} */
const FLOW_COOKIE = { ...COOKIE, path: '/api/auth/github', maxAge: 10 * 60 * 1000 }

/* --- 1. START: GET /api/auth/github → the user is sent to GitHub --- */
router.get('/', (_req, res) => {
  const state = randomString()
  // const codeVerifier = randomString() // PKCE
  // Saved in httpOnly cookies, so we can check them when the user comes back
  res.cookie('oauth_state', state, FLOW_COOKIE)
  // res.cookie('oauth_verifier', codeVerifier, FLOW_COOKIE) // PKCE
  console.log('\n[OAUTH] 1. Sending the user to GitHub')
  res.redirect(getAuthorizeUrl(state /* , toCodeChallenge(codeVerifier) */)) // PKCE
})

/* --- 2. CALLBACK: GET /api/auth/github/callback?code=…&state=… – GitHub sends the user back here --- */
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query
  const { oauth_state /* , oauth_verifier */ } = req.cookies // PKCE
  res.clearCookie('oauth_state', FLOW_COOKIE) // used once – then thrown away
  // res.clearCookie('oauth_verifier', FLOW_COOKIE) // PKCE

  // The user clicked "Cancel" on GitHub
  if (error) {
    res.redirect('/?authError=cancelled')
    return
  }
  // Not the login WE started → stop (CSRF)
  if (!state || state !== oauth_state) {
    res.redirect('/?authError=invalid_state')
    return
  }

  try {
    const accessToken = await exchangeCode(String(code) /* , oauth_verifier */) // PKCE
    console.log('[OAUTH] 2. Got an access token from GitHub')
    const user = await getUser(accessToken)
    console.log('[OAUTH] 3. GitHub says this is:', user.login)
    // The admin's access token isn't saved – the issues use the shop's own token.

    if (!ADMINS.includes(user.login)) {
      console.log('[OAUTH] Not an admin:', user.login)
      res.redirect('/?authError=github_not_admin')
      return
    }
    // 4. Create or update the admin in OUR db, by github_id
    const { rows: [admin] } = await pool.query(
      `INSERT INTO user_ (github_id, first_name, email, role)
       VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (github_id) DO UPDATE SET role = 'admin'
       RETURNING id, first_name, role`,
      [user.id, user.login, `${user.id}+${user.login}@users.noreply.github.com`]
    )

    // 5. The shop's normal login cookie – the same as password and Google login
    setAuthCookie(res, admin)
    console.log('[OAUTH] 4. Logged in as admin:', user.login)
    res.redirect('/admin/issues');

  } catch (err) {
    console.error(err)
    res.redirect('/?authError=github_error')
  }
})

export default router