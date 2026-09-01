---
title: Git & GitHub Workflow
---

# Git & GitHub Workflow

- Repository: `github.com/Bohlale-Mabonga/CGV-Game`
- All members work on separate feature branches, no one commits directly to the main branch.
- Before starting new work, branch from an up-to-date `main` (`git pull origin main` first).
- Each person tests their own branch locally, both `npm run dev` and a full `npm run build` + `npx serve dist` before pushing, to avoid merging broken code.
- Merges into `main` happen as a group session (rather than individually) so conflicts in shared files like `main.js` can be resolved together.
