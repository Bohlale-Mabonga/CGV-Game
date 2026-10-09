---
title: Production Build
---

# Production Build

The LAMP server only serves static files, so we upload a **built** game, not the source code.

```bash
git checkout Cooked
npm install
npm run build        # writes the finished game into dist/
npx vite preview     # test the BUILD at http://localhost:4173
```

`vite.config.js` sets `base: './'`, so every path in the build is relative (`./assets/...`). That lets the game run from any sub-folder.

## Checks before uploading

- `dist/index.html` only references `./` paths.
- Asset filenames are lowercase with no spaces. The mixed-case hash suffixes Vite adds are fine, because the code references them in exactly that case.
- Fonts and Three.js are bundled, so nothing is loaded from a CDN.
- The build is about **1.6 MB**.

## Making the zip

Zip the **contents** of `dist/`, not the `dist` folder itself. When you open the zip, `index.html` should be right at the top.

On Windows:
1. Open `dist`.
2. Press Ctrl+A to select everything inside it.
3. Right-click → **Compress to ZIP file**.
