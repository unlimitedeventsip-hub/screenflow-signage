@echo off
setlocal
set "SCRIPT=%~dp0optimize-video-tv.ps1"
if not exist "%SCRIPT%" (
 echo Nu s-a gasit optimize-video-tv.ps1 in acelasi folder.
 pause
 exit /b 1
)
echo SCREENFLOW - CONVERTOR VIDEO PENTRU TELEVIZOARE
echo.
echo Selecteaza un videoclip MP4. Se va crea automat un fisier _screenflow.mp4
echo fara sa fie modificat fisierul original.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" %*
if errorlevel 1 (
 echo.
 echo Conversia nu s-a finalizat. Citeste eroarea de mai sus.
 pause
 exit /b 1
)
echo.
echo Importa fisierul _screenflow.mp4 in Admin - Biblioteca media.
pause
