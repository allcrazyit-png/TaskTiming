---
name: preview-on-device
description: Use when testing local changes on both desktop and mobile device during development before deploying
---

# Preview on Device

## Overview

When developing locally with Vite, you need two URLs to test changes: one for your desktop computer (using `localhost`) and one for mobile testing (using your machine's local network IP). This skill provides both URLs automatically.

## When to Use

- Testing responsive design on actual mobile device
- Verifying changes before deploying to GitHub Pages
- Debugging on phone while dev server is running locally
- Sharing dev server access with teammates on same network

## Quick Reference

**Desktop/Laptop Testing:**
```
http://localhost:5173/TaskTiming/
```

**Mobile Phone Testing (same WiFi):**
```
http://YOUR_LOCAL_IP:5173/TaskTiming/
```

Where `YOUR_LOCAL_IP` is your machine's local network IP address (e.g., `192.168.x.x`).

## How to Get Your Local IP

Run this command to find your machine's IP address:

**macOS / Linux:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}'
```

**Windows (PowerShell):**
```powershell
(Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex (Get-NetRoute -DestinationPrefix 0.0.0.0/0).InterfaceIndex).IPAddress
```

Then use that IP in your mobile URL:
```
http://192.168.50.153:5173/TaskTiming/  (example)
```

## Complete Workflow

1. **Start dev server** (if not running):
   ```bash
   npm run dev
   ```

2. **Get your local IP** (see "How to Get Your Local IP" above)

3. **Desktop testing** → Use `http://localhost:5173/TaskTiming/`

4. **Mobile testing**:
   - Ensure mobile is on **same WiFi network** as computer
   - Open browser on phone
   - Type: `http://192.168.x.x:5173/TaskTiming/` (replace with your actual IP)
   - Test your changes in real browser on real device

5. **Edit code** → Vite HMR reloads automatically on both devices

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Mobile can't reach server | Check: same WiFi? Firewall blocking port 5173? Try `sudo lsof -i :5173` to confirm server is listening. |
| Mobile shows blank page | Check that `/TaskTiming/` base path is in URL. Without it, routing breaks. |
| Changes not reflecting on mobile | Clear browser cache (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows), or use incognito mode. |
| Port 5173 already in use | Kill existing process: `lsof -i :5173 \| grep node \| awk '{print $2}' \| xargs kill -9`, then `npm run dev` again |

## One-Liner for Both URLs

Save this to your `.zshrc` or `.bashrc` and run `dev-urls`:

```bash
alias dev-urls='echo "Desktop: http://localhost:5173/TaskTiming/" && echo "Mobile: http://$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk "{print \$2}"):5173/TaskTiming/"'
```

Then simply run:
```bash
dev-urls
```

Output:
```
Desktop: http://localhost:5173/TaskTiming/
Mobile: http://192.168.50.153:5173/TaskTiming/
```

## Common Mistakes

- **Forgetting `/TaskTiming/` base path** → Routes break on mobile, appears as blank page. Always include the base path in the URL.
- **Mobile on different WiFi** → Can't reach server. Verify both devices on same network with `ping 192.168.x.x` from your desktop.
- **Port 5173 blocked by firewall** → Run `sudo lsof -i :5173` to verify server is listening. If your company firewall blocks it, you may need to use a different port (see `npm run dev --help`).
- **Hardcoding `localhost` in code** → Mobile gets `localhost` pointing to phone, not your computer. Use environment variables or feature detection to detect network vs local.

## Vite Configuration Reference

Your app uses:
- **Dev server port**: 5173 (Vite default)
- **Base path**: `/TaskTiming/` (defined in `vite.config.js`)
- **HMR enabled**: Changes auto-reload on all connected devices

Both URLs use the same port and include the same base path. Only the hostname differs: `localhost` for same-machine access, IP address for network access.
