param(
    [int]$Port = 3000,
    [string]$Root = $PSScriptRoot
)

$Root = (Resolve-Path $Root).Path

Write-Host ""
Write-Host "============================================================"
Write-Host "   LIFE Hospitality -- Local Server"
Write-Host "============================================================"
Write-Host ""
Write-Host "  Direktori  : $Root"
Write-Host "  Website    : http://localhost:$Port/index.html"
Write-Host "  Dashboard  : http://localhost:$Port/dashboard.html"
Write-Host ""
Write-Host "  Tekan Ctrl+C untuk menghentikan server."
Write-Host "============================================================"
Write-Host ""

Start-Process "http://localhost:$Port/index.html"
Start-Sleep -Milliseconds 400
Start-Process "http://localhost:$Port/dashboard.html"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

Write-Host "  [OK] Server berjalan di http://localhost:$Port/"
Write-Host ""

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".woff" = "font/woff"
    ".woff2" = "font/woff2"
    ".ttf"  = "font/ttf"
    ".webp" = "image/webp"
}

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $res = $ctx.Response

        $urlPath = $req.Url.LocalPath
        if ($urlPath -eq "/") {
            $urlPath = "/index.html"
        }

        $safePath = $urlPath.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
        $filePath = Join-Path $Root $safePath

        Write-Host "  GET $urlPath" -NoNewline

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            if ($mimeTypes.ContainsKey($ext)) {
                $mime = $mimeTypes[$ext]
            } else {
                $mime = "application/octet-stream"
            }

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $res.ContentType = $mime
            $res.ContentLength64 = $bytes.Length
            $res.StatusCode = 200
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host "  [200]" -ForegroundColor Green
        } else {
            $notFound = "<h1>404 Not Found</h1><p>$urlPath</p>"
            $body = [System.Text.Encoding]::UTF8.GetBytes($notFound)
            $res.ContentType = "text/html; charset=utf-8"
            $res.ContentLength64 = $body.Length
            $res.StatusCode = 404
            $res.OutputStream.Write($body, 0, $body.Length)
            Write-Host "  [404]" -ForegroundColor Red
        }

        $res.OutputStream.Close()
    } catch {
        break
    }
}

$listener.Stop()
Write-Host ""
Write-Host "  Server dihentikan."
