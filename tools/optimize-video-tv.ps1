# Optimizare MP4 Screenflow pentru Android TV/TCL/Samsung.
# Compatibil cu Windows PowerShell 5.1. Nu modifica originalul.
# Exemplu: powershell -NoProfile -ExecutionPolicy Bypass -File .\optimize-video-tv.ps1 -InputFile "C:\video.mp4"
param([string]$InputFile = "", [string]$OutputFile = "")
$ErrorActionPreference = "Stop"

function Find-FFmpeg {
    $command = Get-Command ffmpeg -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $cache = Join-Path $env:LOCALAPPDATA "Screenflow\tools\ffmpeg"
    if (Test-Path $cache) {
        $old = Get-ChildItem -Path $cache -Filter ffmpeg.exe -File -Recurse | Select-Object -First 1
        if ($old) { return $old.FullName }
    }
    Write-Host "Descarc FFmpeg verificat cu SHA-256..." -ForegroundColor Yellow
    $url = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
    $archive = Join-Path $env:TEMP "screenflow-ffmpeg-essentials.zip"
    Invoke-WebRequest -Uri $url -OutFile $archive -UseBasicParsing
    $expected = [regex]::Match([string](Invoke-WebRequest -Uri ($url + ".sha256") -UseBasicParsing).Content, '[a-fA-F0-9]{64}').Value
    if (!$expected) { throw "Lipseste hash-ul SHA-256 pentru arhiva FFmpeg." }
    $actual = (Get-FileHash -Algorithm SHA256 -Path $archive).Hash
    if ($actual -ne $expected) { throw "FFmpeg: verificarea SHA-256 nu a reusit." }
    New-Item -Path $cache -ItemType Directory -Force | Out-Null
    Expand-Archive -Path $archive -DestinationPath $cache -Force
    $binary = Get-ChildItem -Path $cache -Filter ffmpeg.exe -File -Recurse | Select-Object -First 1
    if (!$binary) { throw "FFmpeg nu a fost gasit dupa extragere." }
    return $binary.FullName
}

if (!$InputFile) {
    try {
        Add-Type -AssemblyName System.Windows.Forms
        $dialog = New-Object System.Windows.Forms.OpenFileDialog
        $dialog.Filter = "Videoclip MP4 (*.mp4)|*.mp4"
        $dialog.Title = "Alege videoclipul pentru Screenflow"
        if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $InputFile = $dialog.FileName }
    } catch { }
}
if (!$InputFile -or !(Test-Path -LiteralPath $InputFile)) { throw "Selecteaza un MP4 existent prin -InputFile." }
$InputFile = (Resolve-Path -LiteralPath $InputFile).Path
if (!$OutputFile) {
    $folder = Split-Path -Parent $InputFile
    $name = [System.IO.Path]::GetFileNameWithoutExtension($InputFile)
    $OutputFile = Join-Path $folder ($name + "_screenflow.mp4")
}
if ($InputFile -eq $OutputFile) { throw "Nu suprascrie fisierul original." }
$ffmpeg = Find-FFmpeg
Write-Host "Optimizez pentru pornire rapida si TV-uri diferite..." -ForegroundColor Cyan
$args = @(
    "-hide_banner", "-y", "-i", $InputFile,
    "-map", "0:v:0", "-map", "0:a:0?",
    "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1",
    "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
    "-profile:v", "main", "-level:v", "4.0", "-pix_fmt", "yuv420p",
    "-g", "60", "-keyint_min", "60", "-sc_threshold", "0",
    "-maxrate", "3500k", "-bufsize", "7000k",
    "-c:a", "aac", "-b:a", "128k", "-ar", "48000",
    "-movflags", "+faststart", "-max_muxing_queue_size", "1024",
    $OutputFile
)
& $ffmpeg @args
if ($LASTEXITCODE -ne 0) { throw "FFmpeg a esuat cu codul $LASTEXITCODE" }
Write-Host "GATA: $OutputFile" -ForegroundColor Green
Get-Item -LiteralPath $OutputFile | Select-Object FullName, Length
