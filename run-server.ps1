# Sculpting the Silence -- zero-dependency local static file server.
# Uses only System.Net.HttpListener (part of the .NET Framework already
# bundled with Windows PowerShell 5.1, present on every stock Windows 10/11
# install -- nothing to download or install). Serves this script's own
# folder over http://localhost, then opens the app in the default browser.
# Invoked by start-windows.bat; not meant to be double-clicked directly
# (double-clicking a .ps1 in Explorer opens it in an editor by default,
# rather than running it, and PowerShell's default execution policy on
# many machines blocks unsigned scripts outright -- the .bat launcher
# sidesteps both with `powershell -ExecutionPolicy Bypass -File ...`).
#
# Binds specifically to "localhost" (not "+" or a machine hostname), which
# on Windows does NOT require administrator rights or a netsh URL ACL
# reservation, and loopback-only traffic isn't filtered by Windows
# Firewall -- so this should just work without any prompts.

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$port = 8743
$prefix = "http://localhost:$port/"
$url = $prefix + "index.html"

$mimeTypes = @{
  ".html"  = "text/html; charset=utf-8"
  ".htm"   = "text/html; charset=utf-8"
  ".js"    = "application/javascript; charset=utf-8"
  ".css"   = "text/css; charset=utf-8"
  ".json"  = "application/json; charset=utf-8"
  ".mp4"   = "video/mp4"
  ".webm"  = "video/webm"
  ".mp3"   = "audio/mpeg"
  ".wav"   = "audio/wav"
  ".ogg"   = "audio/ogg"
  ".svg"   = "image/svg+xml"
  ".png"   = "image/png"
  ".jpg"   = "image/jpeg"
  ".jpeg"  = "image/jpeg"
  ".gif"   = "image/gif"
  ".ico"   = "image/x-icon"
  ".woff"  = "font/woff"
  ".woff2" = "font/woff2"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
} catch {
  Write-Host "Could not start the local server on port $port." -ForegroundColor Red
  Write-Host $_.Exception.Message
  Write-Host ""
  Write-Host "This usually means something else on this PC is already using that port."
  Write-Host "Edit run-server.ps1, change `$port near the top to a different number, and try again."
  exit 1
}

Write-Host "Local server running at $prefix"
Write-Host "Opening the app in your default browser..."
Write-Host ""
Write-Host "Leave this window open while using the app."
Write-Host "Close this window (or press Ctrl+C) when you're done."
Write-Host ""

Start-Sleep -Milliseconds 500
Start-Process $url

while ($listener.IsListening) {
  try {
    $context = $listener.GetContext()
  } catch {
    break # listener was stopped (e.g. Ctrl+C) -- exit the loop cleanly
  }

  $request = $context.Request
  $response = $context.Response

  try {
    $localPath = [System.Uri]::UnescapeDataString($request.Url.LocalPath)
    if ($localPath -eq "/") { $localPath = "/index.html" }

    $fullRoot = [System.IO.Path]::GetFullPath($root)
    $filePath = [System.IO.Path]::GetFullPath((Join-Path $root ($localPath.TrimStart("/"))))

    # Keep requests confined to this folder -- reject anything that
    # resolves (e.g. via "..") outside of it.
    if (-not $filePath.StartsWith($fullRoot, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $filePath -PathType Leaf)) {
      $response.StatusCode = 404
      $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ext = [System.IO.Path]::GetExtension($filePath).ToLowerInvariant()
      $contentType = $mimeTypes[$ext]
      if (-not $contentType) { $contentType = "application/octet-stream" }
      $response.ContentType = $contentType

      $bytes = [System.IO.File]::ReadAllBytes($filePath)
      $response.ContentLength64 = $bytes.Length
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
    }
  } catch {
    try { $response.StatusCode = 500 } catch {}
  } finally {
    $response.Close()
  }
}

$listener.Stop()
