# Screenflow — MP3 de 128–200 MB cu împărțire automată (Supabase Free)

## Ce face

Pe panoul Admin → **Sunet & muzică**, alegi un fișier **MP3** de maximum **200 MiB**.
Screenflow:
1. Verifică formatul și împarte fișierul la limite de cadre MPEG Layer III (fără transcodare) în segmente de aproximativ **44 MiB**.
2. Încarcă fiecare segment direct în Supabase Storage folosind **TUS resumable upload**, în transferuri de **6 MiB**, cu reîncercare și progres.
3. Salvează un singur element în biblioteca muzicală cu lista ordonată de obiecte din Storage (coloana `audio_tracks.parts`).
4. Playerul TV redă segmentele în ordine și reia de la început după ultimul segment; dacă începe o reclamă video, pune muzica pe pauză și continuă la următoarea imagine.

Exemplu testat logic: 128 MiB → 3 fișiere de aprox. 44, 44 și 40 MiB. Acest lucru este diferit de a trimite un singur fișier de 128 MB în părți prin TUS; Supabase Free nu poate păstra un obiect singular mai mare decât limita proiectului.

## Compatibilitate și limite

- MP3 standard (MPEG Layer III). Nu se modifică bitrate-ul sau calitatea.
- Pe Samsung Tizen pot exista pauze foarte scurte la trecerea între segmente, deoarece un nou fișier MP3 trebuie deschis; nu este garantată redarea perfect gapless.
- Planul Supabase Free are limită per obiect (până la 50 MB) și limită de spațiu total al proiectului. Segmentele sunt sub 50 MB, deci nu impun un abonament Pro doar din cauza dimensiunii unui fișier MP3 de 128 MB.
- Muzica pentru localuri trebuie să aibă drepturile necesare difuzării publice.
- Bibliotecă: `audio_tracks.storage_path` este prima parte (compatibilitate veche), iar `parts` este array-ul cu toate segmentele. Migrarea aditivă: `supabase/upgrade_v5_audio_segments.sql`.
- În proiectul Supabase `screen` (`asixkabhesmhbqunxqby`) migrarea v5 a fost aplicată și verificată.

## Folosire

1. Publică noul site din repo pe Cloudflare Worker `screenflow-signagead`. **GitHub Actions** verifică doar build-ul; nu echivalează neapărat cu publicarea Cloudflare.
2. Admin → Sunet & muzică → Încarcă muzica; selectează MP3-ul de 128 MB.
3. Așteaptă progresul până la 100%. Vei vedea un singur titlu în bibliotecă.
4. Selectează playlistul, bifează muzică de fundal, alege titlul și salvează.
5. Verifică redarea pe Samsung; pentru audio cu autoplay blocat poate fi necesar OK din telecomandă.

Cod: `src/audio-chunks.js`, `src/audio-upload.js`, `src/audio-playback.js`, `src/audio-admin.js`, `src/main.js`.
