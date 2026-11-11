# Screenflow Samsung — Decebal (Tizen 6.0)

**Samsung UE55AU8072UXXH**, model 2021. Sursă Tizen Web App, nu un APK.
Samsung acceptă numai pachete **.wgt semnate** cu profil Samsung TV autorizat pentru dispozitiv.

## Experiență

La lansare, deschide automat în runtime-ul Samsung `https://screenflow-signagead.unlimited-events-ip.workers.dev/connect?sf_tizen=1`. Pe TV apare codul de asociere; în Screenflow Admin → Televizoare, confirmi codul, alegi locația **Decebal** și playlistul. După asociere rulează doar reclamele fullscreen. Nu sunt salvate parole în pachet.

**Compatibilitate:** Samsung 2021 folosește Chromium M76; repo include `vite.config.js` cu target Chrome 76. Publică un build actualizat Cloudflare înainte de test. Navigarea externă în aplicație și redarea media trebuie verificate pe TV-ul fizic. O aplicație hosted pentru publicare în Samsung Store poate necesita aprobări suplimentare.

## Instalare cu Tizen Studio (Windows)

1. Instalează [Tizen Studio](https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html), **Samsung TV Extension** și **Samsung Certificate Extension**.
2. PC și Samsung trebuie să fie pe aceeași rețea. TV-ul avea în fotografii IP `10.115.150.22`; verifică dacă mai este același.
3. Pe TV: Home → Apps, apoi introdu `12345` din telecomandă. Developer Mode ON; introdu **IP-ul laptopului**, NU IP-ul TV, și repornește Samsung-ul.
4. În Tizen Studio → Device Manager → Remote Device Manager, conectează TV-ul la `10.115.150.22` port **26101**.
5. În Certificate Manager creează **Samsung Author + Distributor Certificate**; înregistrează DUID-ul televizorului, necesar pentru instalare. Nu încărca cheia/parola certificatului în repo.
6. Creează un proiect **TV Web Application / Basic** pentru Tizen 6.0 numit `ScreenflowSamsung` și înlocuiește `index.html`, `icon.png`, `config.xml`. Dacă wizard-ul creează un ID de aplicație diferit, păstrează ID-ul generat.
7. Activează profilul de semnare; **Build Signed Package (.wgt)** și **Run As → Tizen Web Application** pe televizor.
8. Intră în [Screenflow Admin](https://screenflow-signagead.unlimited-events-ip.workers.dev/admin) → Televizoare; confirmă codul și atribuie playlistul.

## Conectare SDB (nu ADB)

```powershell
$sdb = (Get-ChildItem 'C:\tizen-studio' -Filter sdb.exe -Recurse | Select-Object -First 1).FullName
& $sdb connect 10.115.150.22:26101
& $sdb devices
```

Samsung nu acceptă APK/ADB și nu mai acceptă sideload Tizen direct de pe USB. 
Starea «online» a playerului este un heartbeat recent, nu verificarea vizuală a reclamelor.

Surse oficiale: https://developer.samsung.com/smarttv/develop/getting-started/using-sdk/tv-device.html , https://developer.samsung.com/smarttv/develop/faq/tizen-studio.html
