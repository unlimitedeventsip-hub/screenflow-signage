# Screenflow - convertește MP4 vertical intr-un MP4 16:9 cu blur IN VIDEO.
# Rulare: powershell -NoProfile -ExecutionPolicy Bypass -File .\portrait-blur-tv.ps1
# Utilizare optionala: -InputFile "C:\...\video.mp4"
# Nu modifica fisierul original, nu atinge TV-ul si nu cere token Supabase.
param(
    [string]$InputFile = "",
    [string]$InputUrl = "",
    [string]$OutputFile = ""
)
$ErrorActionPreference = "Stop"

function Find-FFmpeg {
    $command = Get-Command ffmpeg -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }

    $cache = Join-Path $env:LOCALAPPDATA "Screenflow\tools\ffmpeg"
    if (Test-Path $cache) {
        $existing = Get-ChildItem -Path $cache -Recurse -Filter ffmpeg.exe -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($existing) { return $existing.FullName }
    }

    Write-Host "FFmpeg nu este instalat. Descarc versiunea Windows de la gyan.dev..." -ForegroundColor Yellow
    $archive = Join-Path $env:TEMP "screenflow-ffmpeg-essentials.zip"
    $zipURL = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
    $hashURL = $zipURL + ".sha256"
    Invoke-WebRequest -Uri $zipURL -OutFile $archive -UseBasicParsing
    $expectedText = (Invoke-WebRequest -Uri $hashURL -UseBasicParsing).Content
    $expectedHash = [regex]::Match([string]$expectedText, "[a-fA-F0-9]{64}").Value
    if (!$expectedHash) { throw "Nu pot verifica SHA-256 pentru arhiva FFmpeg. Verifica sursa gyan.dev." }
    $actualHash = (Get-FileHash -Algorithm SHA256 -Path $archive).Hash
    if ($actualHash -ne $expectedHash) { throw "Verificarea FFmpeg a esuat! Arhiva poate fi corupta." }

    New-Item -ItemType Directory -Force -Path $cache | Out-Null
    Expand-Archive -Path $archive -DestinationPath $cache -Force
    $binary = Get-ChildItem -Path $cache -Recurse -Filter ffmpeg.exe -File | Select-Object -First 1
    if (!$binary) { throw "Nu s-a gasit ffmpeg.exe in arhiva descarcata." }
    return $binary.FullName
}

function Select-VideoFile {
    try {
        Add-Type -AssemblyName System.Windows.Forms
        $dialog = New-Object System.Windows.Forms.OpenFileDialog
        $dialog.Title = "Selecteaza videoclipul vertical pentru Screenflow"
        $dialog.Filter = "Videoclip MP4 (*.mp4)|*.mp4"
        $dialog.Multiselect = $false
        if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
            return $dialog.FileName
        }
    } catch {
        Write-Host "Selectorul grafic nu este disponibil." -ForegroundColor Yellow
    }
    return (Read-Host "Introdu calea completa a fisierului MP4").Trim('"')
}

function Convert-For-TV {
    param([string]$Source, [string]$Destination, [string]$Executable, [int]$W, [int]$H, [int]$Crf)

    # Fundal extras din ACELASI video, marit si blurat; video original clar in centru.
    # Rezultatul este UN SINGUR flux video H.264, pentru Tizen si TCL.
    $bw = if ($W -eq 1920) { 480 } else { 320 }
    $bh = if ($W -eq 1920) { 270 } else { 180 }
    $filter = "[0:v]split=2[bg0][fg0];" +
      "[bg0]scale=${bw}:${bh}:force_original_aspect_ratio=increase:force_divisible_by=2," +
      "crop=${bw}:${bh},boxblur=20:2,scale=${W}:${H}," +
      "eq=brightness=-0.05[bg];" +
      "[fg0]scale=${W}:${H}:force_original_aspect_ratio=decrease:force_divisible_by=2," +
      "setsar=1[fg];" +
      "[bg][fg]overlay=(W-w)/2:(H-h)/2:shortest=1,format=yuv420p[v]"

    $args = @(
        "-hide_banner", "-y", "-i", $Source,
        "-filter_complex", $filter,
        "-map", "[v]", "-map", "0:a?",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", [string]$Crf,
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        $Destination
    )
    & $Executable @args
    if ($LASTEXITCODE -ne 0) { throw "FFmpeg a raportat eroare la export. Cod: $LASTEXITCODE" }
}

try {
    if (!$InputFile -and $InputUrl) {
        $parsed = [Uri]$InputUrl
        if ($parsed.Scheme -ne 'https') { throw "Linkul videoclipului trebuie sa inceapa cu https://" }
        $downloadFolder = Join-Path $env:USERPROFILE "Downloads"
        if (!(Test-Path $downloadFolder)) { $downloadFolder = $env:TEMP }
        $InputFile = Join-Path $downloadFolder ("Screenflow_sursa_" + [guid]::NewGuid().ToString("N").Substring(0,8) + ".mp4")
        Write-Host "Descarc videoclipul original din Screenflow..." -ForegroundColor Cyan
        Invoke-WebRequest -Uri $InputUrl -OutFile $InputFile -UseBasicParsing
    }
    if (!$InputFile) { $InputFile = Select-VideoFile }
    if (!$InputFile -or !(Test-Path -LiteralPath $InputFile -PathType Leaf)) {
        throw "Nu ai selectat un MP4 valid."
    }
    $InputFile = (Resolve-Path -LiteralPath $InputFile).Path
    if ([IO.Path]::GetExtension($InputFile).ToLowerInvariant() -ne ".mp4") {
        throw "Conversia este configurata pentru MP4."
    }
    if (!$OutputFile) {
        $OutputFile = Join-Path ([IO.Path]::GetDirectoryName($InputFile)) ([IO.Path]::GetFileNameWithoutExtension($InputFile) + "_TV_BLUR_16x9.mp4")
    }
    if ([IO.Path]::GetFullPath($InputFile) -eq [IO.Path]::GetFullPath($OutputFile)) {
        throw "Iesirea trebuie sa aiba un nume diferit de original."
    }

    $ffmpeg = Find-FFmpeg
    $ffprobe = Join-Path (Split-Path $ffmpeg -Parent) "ffprobe.exe"
    if (Test-Path $ffprobe) {
        $measure = & $ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x $InputFile
        if ($LASTEXITCODE -ne 0 -or !($measure -match "^(\d+)x(\d+)$")) {
            throw "Nu am putut citi dimensiunile MP4."
        }
        Write-Host "Dimensiuni video: $measure"
        if ([int]$Matches[1] -ge [int]$Matches[2]) {
            throw "Videoclipul este deja 16:9 / orizontal. Alege un video vertical."
        }
    }

    Write-Host "Generez fundalul blurat direct in MP4 (1920x1080)..." -ForegroundColor Cyan
    Convert-For-TV -Source $InputFile -Destination $OutputFile -Executable $ffmpeg -W 1920 -H 1080 -Crf 26

    # Supabase Free accepts objects of max. 50 MB. Re-encode if necessary.
    $limit = 49 * 1024 * 1024
    if ((Get-Item -LiteralPath $OutputFile).Length -gt $limit) {
        Write-Host "Fisierul este prea mare pentru Supabase Free. Refac la 1280x720..." -ForegroundColor Yellow
        Convert-For-TV -Source $InputFile -Destination $OutputFile -Executable $ffmpeg -W 1280 -H 720 -Crf 30
    }
    if ((Get-Item -LiteralPath $OutputFile).Length -gt $limit) {
        Write-Warning "Videoclipul rezultat depaseste 49 MiB. Trebuie comprimat / scurtat pentru upload pe Free."
    }

    Write-Host ""
    Write-Host "GATA! Video cu blur inclus:" -ForegroundColor Green
    Write-Host $OutputFile -ForegroundColor White
    Write-Host "In Screenflow Admin > Biblioteca media, incarca ACEST MP4 si adauga-l la playlist."
    Write-Host "Poti pastra versiunea veche ca rezerva pana verifici playback-ul pe Samsung."
} catch {
    Write-Host ""
    Write-Host "EROARE: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
