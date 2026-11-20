// "Report a problem" in the admin panel: an issue in the shop's GitHub repo, created with the SHOP'S token.
import { Router } from 'express'
import { createIssue, listOpenIssues } from '../_integrations/githubAdapter.js'
import { requireAdmin } from '../_middleware/requireAdmin.js'
import { verifyToken } from '../_middleware/verifyToken.js'
import { z } from 'zod'

const router = Router()

const NewIssue = z.object({
  title: z.string().trim().min(1, 'Skriv en rubrik').max(200, 'Rubriken är för lång'),
  description: z.string().trim().min(1, 'Beskriv problemet').max(5000, 'Beskrivningen är för lång'),
})

/* --- GET /api/admin/issues → the open issues in the shop's repo --- */
router.get('/', verifyToken, requireAdmin, async (_req, res) => {
  try {
    res.json(await listOpenIssues())
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: 'Could not get the issues from GitHub' })
  }
})

/* --- POST /api/admin/issues  { title, description } → the new issue --- */
// In your shop: validate the body with Zod.
router.post('/', verifyToken, requireAdmin, async (req, res) => {
  
  const parsed = NewIssue.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Ogiltig issue' })
    return
  }
  const { title, description } = parsed.data

  try {
    // GitHub shows the shop's account as the author – so the server writes who reported it
    const issue = await createIssue(title, `${description}\n\n---\nReported by @${req.user.username} in the admin panel.`)
    console.log(`[GITHUB] ${req.user.username} created issue #${issue.number}`);
    res.status(201).json(issue)
  } catch (err) {
    console.error(err)
    res.status(502).json({ error: 'GitHub did not create the issue. Check GITHUB_ISSUES_TOKEN and GITHUB_REPO.' })
  }
})

export default router