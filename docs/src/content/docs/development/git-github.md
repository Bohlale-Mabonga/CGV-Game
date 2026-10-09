---
title: Git & GitHub Workflow
---

# Git & GitHub Workflow

- Repository: `github.com/Bohlale-Mabonga/CGV-Game`
- All members work on separate feature branches, no one commits directly to the main branch.
- Before starting new work, branch from an up-to-date `main` (`git pull origin main` first).
- Each person tests their own branch locally, both `npm run dev` and a full `npm run build` + `npx serve dist` before pushing, to avoid merging broken code.
- Merges into `main` happen as a group session (rather than individually) so conflicts in shared files like `main.js` can be resolved together.

## Branches

| Branch | Contents |
|---|---|
| `Cooked` | **The current game.** Build and deploy from here |
| `docs` | This documentation site |
| `feature/testing-setup` | An earlier version of the game, with Vitest tests for the old modules |
| `main` | Earlier merged work. `Cooked` should be merged into `main` once reviewed |

Always build the deployment zip from `Cooked`, so the right version of the game gets hosted.
