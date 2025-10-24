# AR Ring Try-On (Vite)

An in-browser AR experience that overlays a virtual ring on your ring finger using MediaPipe Hands. Runs locally over `localhost` via Vite.

## Features

- Transparent PNG ring overlay with gold/silver/rose options
- MediaPipe Hands tracking (MCP/PIP landmarks) for realistic placement
- HiDPI canvas scaling for crisp rendering
- Graceful fallback ring outline while images load

## Requirements

- Node.js 18+ recommended
- A webcam
- Browser camera permissions (HTTPS or `localhost`)

## Setup (Windows)

1. Install dependencies:

```powershell
npm install
```

2. Start the dev server:

```powershell
npm run dev
```

3. Open the URL printed by Vite (usually `http://localhost:5173`). Allow camera access when prompted.

## File structure

- `index.html` – App shell and script/style includes
- `src/style.css` – UI and layout
- `src/main.js` – AR logic and MediaPipe integration

## Notes

- If the ring images do not load due to a network/CORS issue, a simple outline will be drawn as a fallback.
- You can replace the PNG URLs in `src/main.js` under `ringImages` with your own transparent PNG assets.
- If camera access fails, ensure you are on `http://localhost` (or HTTPS) and that your browser has permission to use the camera.
