import { z } from 'zod';

const CLIENT_ID = process.env.GITHUB_CLIENT_ID
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET
const CALLBACK_URL = process.env.GITHUB_CALLBACK_URL
const REPO = process.env.GITHUB_REPO // owner/repo, e.g. anna-k/hoodie-shop
// The SHOP'S own token – a fine-grained personal access token with Issues: Read and write, only for REPO
const SHOP_TOKEN = process.env.GITHUB_ISSUES_TOKEN

// What we need from GitHub's answers – everything else is ignored
const TokenAnswer = z.object({
  access_token: z.string().min(1),
})

const GitHubUser = z.object({
  id: z.number().int().positive(),
  login: z.string().min(1),
})

/* ===== LOGIN – with the ADMIN'S GitHub account ===== */

/* --- 1. Where we send the user: GitHub's own login page --- */
// https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#1-request-a-users-github-identity
/**
 * @param {string} state
 * @returns {string}
 */
export function getAuthorizeUrl(state /* , codeChallenge */) { // PKCE
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: CALLBACK_URL, // must match one of the Redirect URIs in the OAuth App's settings
    scope: 'read:user', // only who the user is – the issues use the shop's own token
    state, // we check it in the callback → protects against CSRF
    // code_challenge: codeChallenge, // PKCE: the hash of a secret only our server knows
    // code_challenge_method: 'S256', // PKCE
  })
  return `https://github.com/login/oauth/authorize?${params}`
}

/* --- 2. The code from the callback → the admin's access token --- */
// Getting started with GitHub's REST API – the headers, the token, the answers:
//   https://docs.github.com/en/rest/using-the-rest-api/getting-started-with-the-rest-api

// https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#2-users-are-redirected-back-to-your-site-by-github
/**
 * @param {string} code
 * @returns {Promise<string>} the admin's access token
 */
export async function exchangeCode(code /* , codeVerifier */) { // PKCE
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json' }, // otherwise GitHub answers in form format
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: CALLBACK_URL,
      // code_verifier: codeVerifier, // PKCE: GitHub hashes it and compares with code_challenge
    }),
    signal: AbortSignal.timeout(5_000),
  })
  const answer = await response.json()
  // GitHub answers 200 even when the code is wrong – the error is in the body, e.g. "bad_verification_code"
  const parsed = TokenAnswer.safeParse(answer)
  // GitHub answers 200 even when the code is wrong – then there's no access_token, only e.g. "bad_verification_code"
  if (!parsed.success) throw new Error(`GitHub refused the code: ${answer.error ?? 'unexpected answer'}`)
  return parsed.data.access_token // used ONCE, in getUser() – then thrown away
}

/* --- 3. Who is it? The admin's access token → GitHub's user --- */
/**
 * @param {string} accessToken
 * @returns {Promise<{ id: number, login: string }>}
 */
export async function getUser(accessToken) {
  const response = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(5_000),
  })
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`)
  const { id, login } = GitHubUser.parse(await response.json())
  return { id, login }
}

/* ===== ISSUES – with the SHOP'S token, so GitHub shows the shop's account as the author ===== */

// YOUR TURN: fill in createIssue() and listOpenIssues().
// Getting started with GitHub's REST API – the headers, the token, the answers:
//   https://docs.github.com/en/rest/using-the-rest-api/getting-started-with-the-rest-api
// The same pattern as getUser() above – but with SHOP_TOKEN and REPO, not the admin's token.

// Docs: https://docs.github.com/en/rest/issues/issues#create-an-issue
// Return { number, title, url } – routes/issues.ts and React use them.
/**
 * @param {string} title
 * @param {string} body
 * @returns {Promise<{ number: number, title: string, url: string }>}
 */
// What we need from GitHub's answer when an issue is created
const CreatedIssue = z.object({
  number: z.number(),
  title: z.string(),
  html_url: z.string().url(),
})

export async function createIssue(title, body) {
  const response = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ SHOP_TOKEN }`, 
      'Accept': 'application/vnd.github+json', 
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ title, body }),
    signal: AbortSignal.timeout(5_000),
  });

  if(!response.ok){
    throw Error(`GitHub answered ${response.status}`);
  }

  const parsedRes = CreatedIssue.parse(await response.json());

  return { number: parsedRes.number, title: parsedRes.title, url: parsedRes.html_url }
}

// Docs: https://docs.github.com/en/rest/issues/issues#list-repository-issues
// Return [{ number, title, url, author }] – React shows them in the list.
/**
 * @returns {Promise<{ number: number, title: string, url: string, author: string }[]>}
 */
const ListedIssue = z.object({
  number: z.number(),
  title: z.string(),
  html_url: z.string().url(),
  user: z.object({ login: z.string() }),
  pull_request: z.unknown().optional(), // only there on pull requests
})

export async function listOpenIssues() {

  const response = await fetch(`https://api.github.com/repos/${REPO}/issues?state=open`, {
    headers: { Authorization: `Bearer ${SHOP_TOKEN}`, Accept: 'application/vnd.github+json' },
    signal: AbortSignal.timeout(5_000),
  })

  if (!response.ok) throw new Error(`GitHub answered ${response.status}`)

  const parsedRes = z.array(ListedIssue).parse(await response.json());

  const issues = parsedRes.filter((issue) => !issue.pull_request);

  return issues.map((issue) => ({
    number: issue.number,
    title: issue.title,
    author: issue.user.login,
    url: issue.html_url, 
  }))

}