# Dev Cheat Sheet

## How to open Terminal in this folder
In Finder, right-click the `Letterland` folder → **New Terminal at Folder**

Or from any Terminal window, type:
```bash
cd /Users/corin/Documents/GitHub/Letterland
```

---

## First time in this folder (do this NOW if you haven't yet)
Run this once to download all the libraries the project needs (Three.js, Vite, etc.):
```bash
npm install
```
This creates a `node_modules` folder locally. **You must do this before `npm run dev` will work.** It's not in git so every fresh clone of the repo needs this step — but only once per folder, ever.

---

## Testing locally
```bash
npm run dev
```
Opens the site at **http://localhost:5173** with live reload — save a file, browser updates instantly.

Press `Ctrl+C` in the terminal to stop the dev server when you're done.

**If it opens on 5174, 5175, etc.** — stale Vite processes are still running from a previous session. Kill them first:
```bash
pkill -f vite
npm run dev
```

---

## Deploying to the live site
```bash
npm run ship
```
Builds the site and creates `corin-portfolio-build.zip`. GitHub Actions picks this up and FTPs it to the server automatically.

> You don't need to stop the dev server first — `ship` is independent.

---

## Note on copying commands
When commands are shown in a shaded box, type (or paste) **only the text inside the box** — not the box itself. Hit Enter after each command and wait for it to finish before running the next one.

---

## Typical session
1. Open Terminal in the Letterland folder
2. `npm run dev` → test changes at localhost:5173
3. Happy with it → commit and push in VS Code (Source Control tab)
4. GitHub Actions deploys automatically
