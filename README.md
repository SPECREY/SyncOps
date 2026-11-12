# SyncOps

A daily task launcher for people learning game development, designed with ADHD in mind.
Open your courses, tutorials and tools with one button, work in focused chunks, and keep
your music playing in the built-in Walkman — all inside a retro "operations terminal" interface.

## Features

- **Hub** — today's apps and links in one place, a daily philosopher quote, launch everything with one click
- **Tasks ("operations")** — links (Udemy, YouTube, any site) and apps (Unity Hub, VS Code, Krita, …) that open together, small steps, days of the week, optional auto-open at login and start-time alarms
- **Focus mode** — visible countdown timer in chunks sized to your attention span, movement breaks, attention checks, a "parked thoughts" box for distractions, optional white/pink/brown noise
- **Recall check** — write what you learned after each task; get a warm-up quiz on it next time
- **Points + rewards** — earn points for steps and finished tasks, spend them on rewards you choose
- **Record** — 14-day history, focus time, streak, how your time estimates compare to reality
- **Walkman** — plays music from a local folder (MP3, FLAC, OGG, WAV, M4A) or YouTube playlists
- **Calm mode**, text size setting, and full-screen scaling

The SYSTEM screen inside the app lists the research behind each ADHD feature. SyncOps is a study tool, not a treatment.

## Run from source

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm start
```

## Build

```bash
npm run dist                          # Linux AppImage  -> dist/SyncOps.AppImage
npx electron-builder --win nsis       # Windows installer -> dist/SyncOps-Setup.exe (needs Wine when building on Linux)
```

On Linux, `linux/launch.sh` starts the AppImage whether or not FUSE is installed, and
`linux/syncops.desktop` adds it to the app menu (edit the paths inside first).

## Credits

- Built with [Electron](https://www.electronjs.org/)
- Fonts (SIL Open Font License 1.1): Antonio, Shippori Mincho B1, Share Tech Mono (via Fontsource), DSEG by keshikan
- All interface sounds are generated in code (Web Audio)
- Visual style inspired by 1990s anime computer interfaces and portable cassette players
