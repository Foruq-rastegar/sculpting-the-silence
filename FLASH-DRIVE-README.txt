Sculpting the Silence -- how to run this
==================================================

To run the app on this computer:
  Windows -> double-click:  start-windows.bat
  Mac     -> double-click:  start-mac.command

Either one starts a small local server on this computer only (nothing is
installed, nothing goes out to the internet) and opens the app in the
default browser automatically. A console/terminal window will stay open
while it runs -- that's expected, leave it open for the whole session,
and close it (or press Ctrl+C inside it) when you're done.

If double-clicking start-mac.command shows a security warning ("cannot
be opened because it is from an unidentified developer"), right-click
(or Control-click) the file, choose "Open", then confirm "Open" in the
dialog that appears. This is normal macOS Gatekeeper behavior for any
script that didn't come from the App Store, and only needs doing once.

If neither start-windows.bat nor start-mac.command works for some reason,
opening index.html directly (double-click it, or drag it into a browser
window) still runs the app -- everything works except the two-monitor
screen-split mode's cross-window sync may be less reliable.
