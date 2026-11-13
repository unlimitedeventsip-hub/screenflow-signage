# Screenflow Smart Modes & Instagram Wall (v8)

## Status
- Migrarea Supabase v8 a fost aplicată.
- Smart Modes și Instagram Wall sunt implementate în codul repo-ului.
- Verificarea GitHub Actions testează doar buildul Vite, nu publică în Cloudflare.
- Instagram OAuth NU este încă conectat; importul automat necesită autorizarea proprietarului contului.
- Compatibilitatea offline trebuie testată fizic pe Samsung Tizen și TCL Android TV.

## Utilizare Instagram Wall
1. În Screenflow Admin, deschide Smart Modes și selectează locația.
2. În Biblioteca media, încarcă fotografia sau MP4-ul original pentru TV.
3. Revino la Smart Modes, selectează Instagram Wall, completează titlu, contul @ și URL-ul public către postare sau Reel.
4. Selectează fotografia ori video-ul încărcat și apasă Adaugă și aprobă pentru TV.
5. Activează Instagram Wall pentru locație. Dacă nu există materiale aprobate, TV-ul revine la playlistul de reclame.
6. Pe ecran se afișează media locală optimizată, titlul și un QR creat local către postarea originală.

## Smart Modes
Reclame, meniu digital, Happy Hour, Party Mode, vot/quiz, karaoke, aniversări, live/sports, Instagram Wall, Photo Wall, Social Wall, QR loyalty, informativ.
În versiunea actuală, modurile noi afișează carduri foto/video/text/QR, nu funcții interactive complete.
Voturile reale, coada karaoke, scorurile, loyalty, streaming sportiv și automatizarea Meta vor necesita backend și teste separate.

## Sincronizarea oficială Instagram
Un cont Instagram Professional (Business/Creator) se conectează prin Meta Instagram API cu autorizarea titularului.
Tokenurile se păstrează exclusiv în backend, de exemplu în Supabase Secrets, nu în codul JS, APK sau GitHub.
Nu folosim scraping, parole Instagram sau Instagram oEmbed pentru a descărca și stoca media.
oEmbed este doar o opțiune de încorporare a postărilor publice, nu un API de feed automat.

## Publicare
1. Migrarea bazei de date este deja aplicată; nu recrea proiectul Supabase.
2. Din repo, cu VITE_SUPABASE_URL și VITE_SUPABASE_ANON_KEY corecte: npm install; npm run build.
3. Publică în Worker-ul Cloudflare existent cu npx wrangler deploy dintr-o sesiune autentificată.
4. Testează Smart Modes pe un TCL și un Samsung înainte de a activa în toate locațiile.
5. Aplicațiile existente care încarcă playerul web pot primi funcțiile fără reinstalare APK. Un modul nativ sau un update de Tizen ar putea necesita reinstalare.
