$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Get-Location).Path)
$prefix = 'http://127.0.0.1:8000/'
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Error "Could not start the local server on port 8000: $($_.Exception.Message)"
    exit 1
}

Write-Host "S.B. Public School Chhitauna Admin: $prefix"
Write-Host 'Select database.json in the browser before signing in.'
Write-Host 'Press Ctrl+C to stop the local server.'

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            $context.Response.Headers.Add('Cache-Control', 'no-store, no-cache, must-revalidate')
            $relative = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart('/'))
            if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
            $file = [IO.Path]::GetFullPath((Join-Path $root $relative))
            $rootPrefix = $root.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar

            if (!$file.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase) -or !(Test-Path -LiteralPath $file -PathType Leaf)) {
                $context.Response.StatusCode = 404
            } else {
                $extension = [IO.Path]::GetExtension($file).ToLowerInvariant()
                $context.Response.ContentType = switch ($extension) {
                    '.html' { 'text/html; charset=utf-8' }
                    '.js' { 'text/javascript; charset=utf-8' }
                    '.json' { 'application/json; charset=utf-8' }
                    default { 'application/octet-stream' }
                }
                $bytes = [IO.File]::ReadAllBytes($file)
                $context.Response.ContentLength64 = $bytes.Length
                $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        } catch {
            $context.Response.StatusCode = 500
        } finally {
            $context.Response.Close()
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
