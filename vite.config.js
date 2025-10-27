import { defineConfig } from 'vite'

// Switch base path by target:
// - Vercel/local: base '/'
// - GitHub Pages: set env DEPLOY_TARGET=gh-pages and replace REPO_NAME below
const repo = 'REPO_NAME'; // <-- set to your repo name for GH Pages
const base = process.env.DEPLOY_TARGET === 'gh-pages' ? `/${repo}/` : '/';

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        campaign: 'campaign.html',
      }
    }
  }
})
