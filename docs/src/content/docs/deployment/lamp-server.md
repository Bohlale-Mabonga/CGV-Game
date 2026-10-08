---
title: LAMP Server
---

# LAMP Server

**Live game:** https://wmc.ms.wits.ac.za/students/sgroup3906/

Files are uploaded through the group's web file manager (Tiny File Manager, "File Manager for sgroup3906", reached through Moodle). There is no SSH.

## Deploying an update

1. Build and zip (see [Production Build](/deployment/build/)).
2. In the file manager, click **Upload** and drop the zip.
3. Click the zip's name, then **UnZip**. Do *not* choose "UnZip to folder", because the files must land at the top level.
4. Check that the folder shows `index.html`, `favicon.svg` and `assets/`.
5. Delete the zip from the server (tick it → Delete) so the build isn't downloadable.
6. Open the URL in Chrome and play through with the Console (F12) open, looking for red 404s.

## Why sub-folder hosting works

The game is served from `/students/sgroup3906/`, not the server root. Every path is relative (`./`), so nothing points at the root.

Before the first upload, we served the zip from a sub-folder locally and confirmed every request returned 200. After uploading, the live `index.html`, JS, CSS and robot model all returned 200.
