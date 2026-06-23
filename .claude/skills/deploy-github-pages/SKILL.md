---
name: deploy-github-pages
description: Use when deploying the app to GitHub Pages and bumping the version number in package.json
---

# Deploy to GitHub Pages

## Overview

Build and publish the React app to GitHub Pages, bump the version in `package.json`, commit, and push to `main`.

**Announce at start:** "I'm using the deploy-github-pages skill."

## Process

### Step 1: Determine version bump type

If the user didn't specify, ask:

```
Which version bump?
1. patch  (bug fixes / minor tweaks) — e.g. 1.9.3 → 1.9.4
2. minor  (new features, backward-compatible) — e.g. 1.9.3 → 1.10.0
3. major  (breaking changes) — e.g. 1.9.3 → 2.0.0
```

Wait for answer before continuing.

### Step 2: Bump version in package.json

Read current version, calculate new version, write back:

```bash
# Read current version
node -p "require('./package.json').version"

# Bump (replace X.Y.Z with actual values)
npm version patch --no-git-tag-version   # or minor / major
```

`--no-git-tag-version` prevents npm from creating a git tag automatically.

### Step 3: Update hardcoded version strings in source

`src/pages/Home.jsx` contains two hardcoded version strings that must be updated manually:

```bash
# Line ~11: console.log with version
sed -i '' 's/VERSION <OLD_VERSION>/VERSION <NEW_VERSION>/' src/pages/Home.jsx

# Line ~1124: displayed version text
sed -i '' 's/Version <OLD_VERSION>/Version <NEW_VERSION>/' src/pages/Home.jsx
```

Verify both are updated before committing:

```bash
grep -n "Version\|VERSION" src/pages/Home.jsx | grep -E "1\.[0-9]+\.[0-9]+"
```

### Step 4: Commit the version bump

Stage `package.json` and `src/pages/Home.jsx`:

```bash
git add package.json src/pages/Home.jsx
git commit -m "chore: bump version to <NEW_VERSION>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Step 5: Deploy to GitHub Pages

```bash
npm run deploy
```

This runs `npm run build` first (via `predeploy` hook) then publishes the `dist/` folder to the `gh-pages` branch.

Wait for the command to finish. If it fails, stop and report the error — do **not** push.

### Step 6: Push main branch to GitHub

```bash
git push
```

### Step 7: Report result

```
Deployed successfully.
Version: <OLD> → <NEW>
URL: https://allcrazyit-png.github.io/TaskTiming/
```

## Quick Reference

| Step | Command |
|------|---------|
| Bump patch | `npm version patch --no-git-tag-version` |
| Bump minor | `npm version minor --no-git-tag-version` |
| Bump major | `npm version major --no-git-tag-version` |
| Update UI version | Edit `src/pages/Home.jsx` (2 occurrences) |
| Deploy | `npm run deploy` |
| Push main | `git push` |

## Common Mistakes

**Forgetting `--no-git-tag-version`**
- `npm version` creates a git commit AND tag by default
- This conflicts with our manual commit in Step 3
- Always pass `--no-git-tag-version`

**Not updating the hardcoded version in Home.jsx**
- `package.json` version and the displayed version in the UI are separate — bumping `package.json` alone leaves the old version visible on the page
- Always update both occurrences in `src/pages/Home.jsx` (console.log line and the `<p>Version X.Y.Z</p>` line) before deploying

**Pushing before deploy succeeds**
- If `npm run deploy` fails, do NOT run `git push`
- The version bump commit would be pushed without a matching deployed build

**Bumping version on uncommitted changes**
- If there are uncommitted changes unrelated to the deploy, warn the user and ask whether to stash/commit them first
