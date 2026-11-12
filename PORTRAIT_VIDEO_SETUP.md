# Screenflow — fundal blurat pentru videoclipuri verticale

## Rezultat

- Video **orizontal**: rămâne fullscreen, fără modificări.
- Video **vertical**: rămâne clar și complet vizibil, centrat, cu margini umplute de un cadru din același video, mărit și blurat.
- **Samsung Tizen 6.0 (UE55AU8072UXXH)**: folosește un cadru JPEG generat automat la upload în browserul administratorului. Samsung poate reda HTML5 video printr-un plan hardware separat; copierea unui cadru video în Canvas poate produce negru. Fundalul este static pe Samsung, dar este extras din videoclipul original.
- **TCL / browsere obișnuite**: încearcă să actualizeze fundalul din videoclip (~5 cadre pe secundă), cu imaginea JPEG ca rezervă. Nu se decodează a doua instanță video.
- Sunetul rămâne doar la videoclipul principal, potrivit setărilor playlistului.

## La încărcarea unui videoclip vertical nou

1. Admin → Bibliotecă media → Încarcă video MP4.
2. Browserul analizează orientarea și extrage un cadru la începutul clipului, apoi generează un JPEG 16:9.
3. Se încarcă MP4-ul și JPEG-ul de fundal în bucketul existent `ads` din Supabase. În baza de date, `assets.blur_background_path` indică JPEG-ul.
4. Playerul primește această cale în `get_screen_manifest` și o afișează numai pentru videoclipurile verticale.

Dacă video-ul nu poate fi decodat de browserul administratorului, încărcarea afișează o eroare clară. Pentru compatibilitate, recomand MP4 H.264, format suportat de Samsung.

## Pentru video deja încărcate

Admin → **Bibliotecă media** → la fiecare MP4 fără fundal, apasă **Generează fundal**. Acțiunea creează și salvează posterul fără a schimba videoclipul, playlistul, sunetul sau durata.

## Configurare

Migrarea aditivă: `supabase/upgrade_v4_portrait_background.sql`.
Ea adaugă `blur_background_path` la `public.assets` și completează RPC `get_screen_manifest`, păstrând câmpurile audio.

În Supabase proiectul `screen` (asixkabhesmhbqunxqby), migrarea a fost aplicată. Este necesară și publicarea unui nou build în Cloudflare Worker `screenflow-signagead`.

După publicarea site-ului pe Cloudflare, aplicația Samsung `.wgt` deja instalată folosește noul player web: nu este necesară refacerea certificatului, atât timp cât launcherul funcționează.

## Verificare pe Samsung

1. Deschide Admin și generează fundal pentru un videoclip vertical existent.
2. Deschide / reîncarcă Screenflow Samsung.
3. Verifică videoclipul clar în centru și **benzile laterale blurate**.
4. Verifică videoclipurile orizontale, sunetul și reluarea playlistului.
5. Oprește și repornește TV-ul. Verifică iar.

**Limitare importantă:** pe Samsung Tizen fundalul blurat este o imagine statică extrasă automat din video, nu o a doua redare video în mișcare. Pentru un fundal video animat garantat pe Tizen, clipul trebuie precompozitat / exportat 16:9 (de exemplu, FFmpeg) înainte de încărcare.
