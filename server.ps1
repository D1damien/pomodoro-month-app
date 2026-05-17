$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8000
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)
$listener.Start()

function Get-ContentType($path) {
  switch ([System.IO.Path]::GetExtension($path).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8"; break }
    ".css" { "text/css; charset=utf-8"; break }
    ".js" { "text/javascript; charset=utf-8"; break }
    ".webmanifest" { "application/manifest+json; charset=utf-8"; break }
    default { "application/octet-stream" }
  }
}

function Send-Response($stream, $status, $contentType, [byte[]]$body) {
  $header = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  $stream.Write($body, 0, $body.Length)
}

$ips = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.PrefixOrigin -ne "WellKnown" } |
  Select-Object -ExpandProperty IPAddress

Write-Host ""
Write-Host "Pomodoro app is running."
Write-Host "Windows: http://localhost:$port"
foreach ($ip in $ips) {
  Write-Host "iPhone:  http://$ip`:$port"
}
Write-Host "Keep this window open while using the app. Press Ctrl+C to stop."
Write-Host ""

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
    $requestLine = $reader.ReadLine()
    if ([string]::IsNullOrWhiteSpace($requestLine)) {
      $client.Close()
      continue
    }

    while (($line = $reader.ReadLine()) -ne "") { }

    $parts = $requestLine.Split(" ")
    $urlPath = if ($parts.Count -ge 2) { $parts[1].Split("?")[0] } else { "/" }
    $relative = if ($urlPath -eq "/") { "index.html" } else { [System.Uri]::UnescapeDataString($urlPath.TrimStart("/")) }
    $target = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
    $rootFull = [System.IO.Path]::GetFullPath($root)

    if (-not $target.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
      Send-Response $stream "403 Forbidden" "text/plain; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes("Forbidden"))
      continue
    }

    if (-not [System.IO.File]::Exists($target)) {
      Send-Response $stream "404 Not Found" "text/plain; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes("Not found"))
      continue
    }

    $body = [System.IO.File]::ReadAllBytes($target)
    Send-Response $stream "200 OK" (Get-ContentType $target) $body
  } catch {
    try {
      Send-Response $stream "500 Internal Server Error" "text/plain; charset=utf-8" ([System.Text.Encoding]::UTF8.GetBytes("Server error"))
    } catch { }
  } finally {
    $client.Close()
  }
}
