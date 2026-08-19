#!/bin/bash
# Sculpting the Silence -- Mac launcher.
#
# Starts a local, zero-install static file server using whichever of
# python3 / php is already present on this Mac (nothing is downloaded or
# installed -- if a python3 stub prompts to install Xcode Command Line
# Tools, or python3 isn't found at all, this falls back to php, and
# finally to just opening index.html directly via file:// if neither
# runtime is available). Then opens the app in the default browser at
# http://127.0.0.1:PORT/.
#
# Why a local server at all, if file:// mostly works: the app has no
# fetch()/XHR calls (verified), so plain file:// is functionally fine for
# a single-window demo. The one thing an http://localhost origin makes
# more reliable is the two-monitor screen-split sync (BroadcastChannel),
# which needs same-origin and behaves more predictably under a real http
# origin than file://'s occasional quirks across separate windows.

cd "$(dirname "$0")" || exit 1
PORT=8743
URL="http://127.0.0.1:$PORT/index.html"

echo "=========================================="
echo " Sculpting the Silence"
echo "=========================================="
echo ""

RUNTIME=""
if command -v python3 >/dev/null 2>&1; then
  RUNTIME="python3"
elif command -v php >/dev/null 2>&1; then
  RUNTIME="php"
fi

if [ -z "$RUNTIME" ]; then
  echo "No local server runtime (python3 or php) found on this Mac."
  echo "Opening the app directly instead -- most of it works fine this way;"
  echo "only the two-monitor screen-split sync may be less reliable."
  open "index.html"
  echo ""
  read -p "Press Enter to close this window..." _
  exit 0
fi

echo "Starting local server ($RUNTIME) at $URL"
echo ""
echo "Leave this window open while using the app."
echo "Close this window (or press Ctrl+C) when you're done."
echo ""

# Give the server a moment to start listening before opening the browser.
( sleep 1; open "$URL" ) &

if [ "$RUNTIME" = "python3" ]; then
  python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$(pwd)"
else
  php -S "127.0.0.1:$PORT" -t "$(pwd)"
fi

echo ""
echo "Server stopped."
read -p "Press Enter to close this window..." _
