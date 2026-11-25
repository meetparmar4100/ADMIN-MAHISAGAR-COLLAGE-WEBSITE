# Mahisagar Medical College website admin

This repository contains the admin panel source and the live CMS content used by the college website.

- `public/cms-data.json` contains published content and references.
- `public/cms-uploads/` receives published PDFs and images.
- `public/admin/`, `public/admin.html`, `public/cms.js`, and `public/cms.css` contain the editor and public CMS integration.
- `worker/` contains the hosting integration. Build the main website with Vite before running `node worker/build.mjs` from the website checkout.

Sign in on the hosted admin page. Use a fine-grained GitHub token with Contents read and write access to this repository to publish. Keep the hosting variables ADMIN_PASSWORD and ADMIN_SESSION_SECRET in the host's secret settings.
