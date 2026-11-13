# Screenflow Unirii — instalare pe 5 televizoare Android TV / Google TV

## Pachet
Un singur APK `screenflow-unirii.apk` se instalează **separat pe fiecare dintre cele cinci televizoare**.
Este aplicația Screenflow Android TV **v2.3.0**, cu asociere individuală și recuperarea playlistului după repornire.
Numele pachetului Android: `ro.screenflow.tv`. Nu instala pe Samsung Tizen / LG webOS: acele sisteme nu execută APK.

## Instalare (recomandat prin USB pe TV)
1. Descarcă din GitHub Actions artifactul `screenflow-unirii-5tv-apk` și dezarhivează.
2. Copiază `screenflow-unirii.apk` pe un stick USB, de pe laptop.
3. Pe fiecare Android TV / Google TV, instalează APK-ul din managerul de fișiere (permite instalarea din sursa selectată la solicitare).
4. Pornește **Screenflow TV**. Prima lansare pe un dispozitiv nou afișează un cod de asociere.
5. Din `https://screenflow-signagead.unlimited-events-ip.workers.dev/admin` → **Televizoare**, aprobă fiecare cod în parte și alege:
   - Locație: **#altfel unirii**
   - Playlist: **Unirii**
   - Nume recomandate: **Unirii TV 1**, **Unirii TV 2**, **Unirii TV 3**, **Unirii TV 4**, **Unirii TV 5**
6. Verifică că toate cinci au video/imagine, sunet și sunt online, apoi oprește și repornește fiecare televizor.

## Instalare alternativă de pe laptop cu ADB (doar dacă Wireless debugging/ADB este configurat)
Pe Windows, în PowerShell (înlocuiește IP-urile cu adresele reale din meniul fiecărui TV):
```powershell
$adb = (Get-ChildItem "$env:USERPROFILE\Downloads\platform-tools-latest-windows" -Filter adb.exe -Recurse | Select-Object -First 1).FullName
$apk = "$env:USERPROFILE\Downloads\screenflow-unirii.apk"
$tvIps = @("IP-TV-1", "IP-TV-2", "IP-TV-3", "IP-TV-4", "IP-TV-5")
foreach ($ip in $tvIps) {
  & $adb connect "${ip}:5555"
  & $adb -s "${ip}:5555" install -r $apk
  & $adb -s "${ip}:5555" shell am start -n ro.screenflow.tv/.MainActivity
}
```
Portul 5555 este un exemplu, nu este disponibil automat pe orice Android TV. Pe Android mai nou folosește adresa și portul arătate în Wireless debugging.

## Considerații importante
- Nu folosi aceeași copie a datelor aplicației (backup/clonare) pe cele cinci televizoare. Instalează APK-ul, astfel încât fiecare dispozitiv să genereze propriul ID secret în localStorage.
- Nu trebuie să creezi manual cinci `screens` în Supabase: codurile de asociere creează/atribuie ecranele în backend după aprobarea din Admin.
- Fiecare dispozitiv poate reda același playlist. Sincronizarea exactă a acelorași secunde nu este garantată; opțiunea *Sincronizare playlist* din Admin este aproximativă.
- APK-ul din GitHub Actions este **debug-signed**, pentru test. La upgrade, un APK semnat cu altă cheie poate afișa `INSTALL_FAILED_UPDATE_INCOMPATIBLE`. Nu dezinstala fără să notezi mai întâi asocierea: dezinstalarea șterge datele locale și impune reaprobare.
- Pentru exploatare permanentă, pregătește un APK de release semnat cu aceeași cheie la fiecare actualizare. Păstrează cheile de semnare în GitHub Actions Secrets sau într-un manager de secrete, niciodată în repository.
- Aplicația încarcă playerul de la Cloudflare. Pentru schimbările web (precum fundalul blurat), build-ul GitHub nu publică automat în Cloudflare decât dacă deployment-ul este configurat separat.
