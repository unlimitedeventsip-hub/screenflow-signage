# Screenflow — sunet pentru TV (v3)

Funcția este inclusă în site-ul Cloudflare și funcționează pentru playerul `/play/<id>` folosit de Samsung Tizen, TCL și alte dispozitive compatibile.

## Funcții
- Audio original MP4, controlat per playlist (`video_audio_enabled`, `video_volume`).
- Un MP3 de fundal pentru fotografii/afișe per playlist (`background_track_id`, `background_audio_enabled`, `background_volume`).
- Muzica se repetă între imagini, se oprește la video și reîncepe când revin imaginile.
- Toate opțiunile sunt **OFF** pentru playlisturile deja existente până când administratorul le activează.
- Dacă TV-ul refuză autoplay cu sunet, playerul afișează `Activează sunetul · OK`; pe Samsung se apasă OK de pe telecomandă. Nu este garantată redarea automată cu audio de către toate browserele TV.

## Bază de date
Migrarea `supabase/upgrade_v3_audio.sql` creează `audio_tracks`, coloanele de sunet ale playlisturilor și extinde manifestul public. Nu șterge playlisturile sau ecranele. În proiectul Supabase `screen` modificările au fost aplicate pe 12 noiembrie 2026.

Se folosește bucketul public existent `ads`, cu fișiere `audio/<uuid>.mp3`. Dacă există o listă de MIME acceptate, migrarea adaugă `audio/mpeg`. Uploadul este permis doar administratorilor autorizați de RLS.

## Administrare
1. Publică noua versiune a site-ului pe Cloudflare Worker `screenflow-signagead` (build `npm run build`, apoi `npx wrangler deploy` în directorul repo). Dacă este deja conectată publicarea din GitHub, verifică deployment-ul înainte să rulezi manual.
2. Deschide `/admin` → **Sunet & muzică**.
3. Încarcă un MP3 (maximum 20 MB). Folosește doar fișiere cu drepturi de utilizare pentru locațiile unde sunt difuzate.
4. Selectează playlistul. Activează sunet MP4 și/sau muzică de fundal, selectează piesa și setează cele două volume.
5. Salvează, apoi reîncarcă Screenflow pe Samsung. Setările se propagă prin manifest aproximativ la următoarea verificare (playerul interoghează la 15 secunde).

## Verificare
- Imagine: muzica MP3 se aude, dacă este permisă redarea de dispozitiv.
- Video: muzica MP3 se pune pe pauză; se aude doar sunetul original al MP4-ului.
- La următoarea imagine, muzica reîncepe.
- Oprește/pornește TV-ul și verifică. Un mesaj `Activează sunetul · OK` după repornire este o restricție autoplay a platformei, nu o eroare de conexiune.
- Volumul TV-ului se controlează și separat, prin telecomandă.

## Notă Samsung Tizen
Aplicația `.wgt` este doar launcherul către URL-ul Cloudflare. Modificările playerului web nu necesită refacerea certificatului sau reinstalarea `.wgt`, dacă launcherul instalat funcționează și site-ul publicat este actualizat.
