#!/bin/bash
# Starts SyncOps. Works with or without FUSE (libfuse2) installed.
DIR="$(cd "$(dirname "$0")" && pwd)"
APP="$DIR/SyncOps.AppImage"
chmod +x "$APP" 2>/dev/null
if /sbin/ldconfig -p 2>/dev/null | grep -q 'libfuse\.so\.2'; then
  exec "$APP" --no-sandbox "$@"
else
  # No FUSE: unpack to a temp folder and run (a few seconds slower to start)
  APPIMAGE_EXTRACT_AND_RUN=1 exec "$APP" --no-sandbox "$@"
fi
