# Screenflow Projector — Android 13 (PD1520s)

Aplicație separată de Screenflow TV/TCL. Gândită pentru proiectorul din fotografii: model **PD1520s**, **Android 13**, 2 GB RAM și 16 GB stocare.

- Pachet Android separat: `ro.screenflow.projector` (nu dezinstalează și nu schimbă aplicația TCL).
- Găzduire: `https://screenflow-signagead.unlimited-events-ip.workers.dev` (Cloudflare).
- Start: **/connect**. Fiecare instalare generează ID-ul propriu și un cod de 6 cifre, fără introducerea unui URL în proiector.
- După aprobarea în **/admin → Televizoare**, se afișează automat numai reclamele full-screen.
- Aplicația se prezintă în panou drept **Android Projector / Acer PD1520s**, **Screenflow Projector APK**, versiunea 1.0.0, cu starea și rezoluția raportate.
- Aplicația necesită migrarea deja documentată `supabase/upgrade_v2_auto_pair.sql` pe Supabase existent. Nu stocăm parola de administrator în APK.
- Pornește la cerere; receptorul BOOT_COMPLETED încearcă pornirea automată, dar unele versiuni Android o blochează. Nu este un kiosk device-owner.

## Construire APK

GitHub → Actions → **Build Screenflow Projector APK**. După Success, deschide rularea, descarcă artifactul, dezarhivează `app-debug.apk` și copiază-l în Downloads pe Windows. Pentru Android Studio, deschide folderul `android-projector`.

## Instalare pe proiector prin ADB

IP-ul din fotografie este `192.168.1.132`, se poate schimba după reconectare. Activează Developer options și USB/wireless debugging pe proiector; simplul fapt că e pe Wi-Fi nu înseamnă că portul 5555 e deschis.

```powershell
$adb = (Get-ChildItem "C:\Users\manil\Downloads\platform-tools-latest-windows" -Filter adb.exe -Recurse | Select-Object -First 1).FullName
& $adb connect 192.168.1.132:5555
& $adb devices
& $adb -s 192.168.1.132:5555 install -r "$env:USERPROFILE\Downloads\Screenflow-Projector-PD1520s.apk"
& $adb -s 192.168.1.132:5555 shell am start -n ro.screenflow.projector/.MainActivity
```

Dacă portul 5555 nu răspunde, folosește pairing-ul Android 13 (Wireless debugging: adresa și portul afișate) sau instalarea locală de pe USB. APK-ul este **debug** pentru test; pentru instalări permanente folosește semnare release cu cheie proprie stabilă.
