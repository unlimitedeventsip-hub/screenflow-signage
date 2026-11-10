## Screenflow TV 2.0 — asociere automată (TCL Android TV)

**Actualizare:** aplicația TCL v2 intră direct la `/connect` în loc să solicite un link `/play/UUID`.
Fiecare televizor creează un identificator de instalare și un secret aleatoriu păstrat numai pe dispozitiv.
Codul din 6 cifre apare pe TV, iar în panoul de administrare la **Televizoare** apare automat
cererea de asociere. Administratorul verifică vizual codul, numește aparatul, alege locația
și playlistul și confirmă. Sistemul creează automat intrarea `screens`, iar TV-ul
este redirecționat automat către playlist.

**Activare obligatorie înainte de instalarea APK-ului v2:**
1. În Supabase SQL Editor din proiectul Screenflow existent, rulează complet
   [upgrade_v2_auto_pair.sql](./supabase/upgrade_v2_auto_pair.sql).
   Este o migrare nedistructivă: păstrează reclamele, playlisturile și televizoarele existente.
2. Verifică administrarea pe `/admin` și, pentru testul din browser, deschide `/connect`.
3. Instalează APK-ul v2 `app-debug.apk` de la GitHub Actions pe TCL prin
   `adb install -r app-debug.apk`. Păstrează același package name `ro.screenflow.tv`.
4. Pe TV va fi afișat un cod de 6 cifre; din **Televizoare** confirmă acel cod
   și selectează o locație și playlistul. TV-ul reia automat redarea.
5. Pentru **5 TV-uri Unirii**, instalează aceeași aplicație pe fiecare, aprobă separat
   cele cinci coduri, selectează aceeași locație, apoi folosește
   **Playlist comun pentru locație**.
6. În **Playlisturi**, poți activa opțional **Sincronizează TV-urile**. Redarea
   se aliniază aproximativ la un ceas comun, dar nu este frame-perfect; TV-urile
   pot avea diferențe de buffering și randare. Pentru videoclipuri, configurează
   durata cât mai aproape de durata reală.
   
**Stare live:** panoul numără doar aplicațiile aprobate care au trimis heartbeat în
ultimele ~45 secunde. Un TV „online” înseamnă ultimul semnal recent, nu dovada
vizuală că monitorul afișează o reclamă. Aparatele neasociate apar separat la
„TV de asociat”. Statusul este reîmprospătat la ~15 secunde.

**Atenție la mutarea Cloudflare:** APK-ul v2 curent folosește încă
`screenflowum.netlify.app`. După publicarea noului hostname Cloudflare Pages,
hostul trebuie actualizat în codul Android și APK-ul recompilat. Nu opri
Netlify până când noua aplicație a fost verificată pe TCL.

---

## Hosting principal: Cloudflare Pages

Screenflow se mută de pe Netlify pe Cloudflare Pages. Configurarea completă și
pașii de schimbare a APK-ului TCL sunt în [CLOUDFLARE_PAGES_SETUP.md](./CLOUDFLARE_PAGES_SETUP.md).
Până la confirmarea noului domeniu și instalarea unui APK actualizat pe TCL,
proiectul Netlify rămâne activ ca rezervă pentru a nu întrerupe reclamele.

# Screenflow — Digital Signage pentru locații

Panou de administrare în română pentru gestionarea reclamelor și playlisturilor pe mai multe televizoare, plus player web fullscreen ce rulează automat conținutul. Interfață responsive pentru computer/telefon.

## Ce este inclus

- Autentificare administrator (Supabase Auth + tabel de autorizare + RLS)
- Bibliotecă foto/video (JPG, PNG, WebP, MP4) cu încărcare în Supabase Storage
- Activare/dezactivare reclame, durată pentru fotografii și intervale de difuzare
- Playlisturi, ordonarea reclamelor și asocierea cu ecrane
- Mai multe locații și televizoare, fiecare cu un URL unic, neenumerabil
- Player fullscreen cu redare în buclă, verificare la 60 secunde, trecere la playlist nou la sfârșitul materialului curent
- Reîncercare la pierderea conexiunii și manifest de rezervă în localStorage
- Configurație Netlify, Vite, PWA manifest

**Limită importantă:** versiunea 1 nu garantează redarea complet offline a videoclipurilor și nici repornirea automată a aplicației după căderi de curent. Pentru exploatare 24/7 e recomandată o aplicație Android TV în modul kiosk cu watchdog și cache local persistent al fișierelor; wrapperul se realizează după verificarea sistemului de operare al TV-ului. Monitorizarea online/offline a ecranelor și gestionarea de la distanță a volumului sunt pentru versiunea 2.

## 1. Supabase (backend)

1. Creează proiect în https://supabase.com/dashboard.
2. În **Storage > New bucket** creează `ads` cu **Public bucket = ON**. Fișierele sunt reclame publice, nu documente sensibile. Pentru început setează limită de fișier de 50 MB și MIME types `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, în limita planului tău.
3. În **SQL Editor**, rulează tot fișierul `supabase/schema.sql` pe un proiect nou. Nu rula fără revizuire pe o bază de date folosită de alte aplicații.
4. În **Authentication > Users**, creează un cont administrator cu email/parolă (confirmă emailul dacă este necesar). **Nu activa înscrierea publică** dacă nu ai nevoie.
5. Copiază UUID-ul contului creat, apoi în SQL Editor rulează:

```sql
insert into public.admin_users (user_id) values ('UUID-CONT-ADMIN');
```

6. În **Project Settings > API** (sau **Connect**), copiază URL-ul proiectului și cheia publică/publishable (`anon`). **Nu** pune cheia `service_role`/secret în front-end ori în GitHub.

## 2. Configurare locală

Cerințe: Node.js modern (versiune compatibilă cu Vite 7), npm.

```bash
npm install
cp .env.example .env
```

Editează `.env` cu cele două valori Supabase:

```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=cheia-publica
```

```bash
npm run dev
```

Deschide adresa indicată în terminal și intră cu contul administrator. Poți construi versiunea de producție prin `npm run build`.

## 3. GitHub + Netlify

1. Creează un repository privat GitHub, ex. `screenflow-signage`. Încarcă conținutul proiectului **fără** `.env`, care este ignorat de `.gitignore`.
2. În Netlify, alege **Add new project / Import existing project**, conectează repository-ul GitHub.
3. Netlify recunoaște `netlify.toml`: build `npm run build`, publish `dist`.
4. În Netlify > Project configuration > Environment variables, adaugă `VITE_SUPABASE_URL` și `VITE_SUPABASE_ANON_KEY`.
5. Fă **Deploy**. La fiecare push în branchul principal, Netlify reconstruiește automat site-ul.
6. Linkul de admin va fi `https://NUME.netlify.app/admin`; linkul player pentru fiecare ecran va fi generat din panoul **Televizoare**.
7. Recomandat: folosește un subdomeniu propriu, de exemplu `tv.domeniul-tau.ro`, înainte de a instala aplicațiile pe televizoare. Altfel, schimbarea ulterioară a URL-ului va necesita actualizarea playerelor.

## 4. Utilizarea zilnică

1. În **Locații** adaugă, de exemplu, #altfel ParkLake, #altfel Decebal, #altfel Unirii, #altfel Centrul Vechi.
2. În **Bibliotecă media** încarcă reclame optimizate pentru 1920 × 1080, orizontal (16:9). Imaginile durează implicit 10 secunde. Videoclipurile rulează până la final, fără sunet.
3. În **Playlisturi** creează playlisturi și adaugă materialele în ordinea dorită.
4. În **Televizoare** creează TV-urile și atribuie locația și playlistul. Copiază linkul unic și deschide-l pe televizor.
5. Modificările intră în vigoare la următoarea verificare (~60 secunde) și la sfârșitul materialului redat. Un video lung poate întârzia schimbarea playlistului.

## 5. Cerințe TV

- **Google TV / Android TV:** se poate folosi, inițial, un browser adecvat, iar ulterior un APK dedicat cu WebView/kiosk (autostart, keep-screen-on, watchdog, cache media, telecomandă pentru configurare). Pentru video fără interacțiune, playerul pornește în mod `muted`.
- **Roku, Fire TV, Tizen, webOS:** soluția nativă diferă. Nu se instalează automat un APK Android pe aceste sisteme.
- **Orice TV cu HDMI:** un stick/dispozitiv Android TV compatibil poate standardiza instalarea pentru toate locațiile.

Pentru reproducere 24/7 în locații, recomandă un test pilot de cel puțin 24–48 ore pe modelul exact de televizor, cu deconectare/reconectare internet și repornire alimentare. Unele TV-uri închid browserul, intră în sleep sau blochează autoplay; site-ul singur nu poate garanta aceste comportamente.

## 6. Securitate și limite

- Accesul de modificare este exclusiv pentru conturi autorizate în `admin_users`, verificat de RLS.
- Linkul TV conține un UUID aleatoriu, dar nu este o formă de autentificare puternică: persoanele care dețin linkul pot vedea materialele publice asociate acelui TV. Nu încărca informații confidențiale.
- Bucket-ul Storage `ads` este public intenționat; accesul de scriere/ștergere este restricționat de RLS.
- Pentru fișiere video mari și multe TV-uri, urmărește costurile de storage/egress ale Supabase. Ulterior se poate folosi un CDN/media storage dedicat.
- Nu face publice chei administrative, parole sau chei de service în cod.
- Fallback-ul web actual stochează **lista** de reclame, nu descarcă garantat tot conținutul media offline.
- Această versiune nu include aprobare reclame, statistici de afișare verificate, programarea unor playlisturi pe ore ale zilei, nici programare în funcție de ziua săptămânii.

## Idee pentru versiunea 2

Afișare online/offline și screenshot verificat de pe fiecare TV, pairing prin cod afișat pe TV și aprobat în panoul admin, drepturi pe locații, șabloane pentru verticale 9:16, programare pe oră/zi, priorități campanii, rapoarte de difuzare, actualizare imediată în timp real, player Android TV în kiosk cu descărcare locală, checksum media, recuperare automată și autostart.
