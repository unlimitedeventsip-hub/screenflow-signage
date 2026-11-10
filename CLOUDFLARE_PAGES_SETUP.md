# Screenflow — migrare din Netlify in Cloudflare Pages

## Cloudflare dashboard
1. Deschide https://dash.cloudflare.com/ → Workers & Pages → Create → Pages → Connect to Git.
2. Selecteaza `unlimitedeventsip-hub/screenflow-signage` (GitHub), ramura `main`.
3. Setari: framework `Vite` (sau None), root directory `/`, build command `npm run build`, output `dist`.
4. Pentru build foloseste Node.js 22.23.4, fixat in `.node-version`.
5. Environment variables pentru Production:
   - `VITE_SUPABASE_URL`: Project URL REAL din proiectul Supabase existent (https://<project>.supabase.co).
   - `VITE_SUPABASE_ANON_KEY`: publishable key sau anon key publica din acelasi proiect Supabase.
6. Save and Deploy. Cloudflare va afisa domeniul exact `https://<proiect>.pages.dev`.

Nu copia parole, chei `service_role` sau `sb_secret_` in front-end sau GitHub.
Nu recrea Supabase: biblioteca de reclame si playlisturile raman acolo.

## Verificari obligatorii
- Pe domeniul Cloudflare rezultat, deschide `/admin`, fa login, verifica bibliotecile si playlisturile.
- Deschide `/play/0e2e173f-b917-4fff-8083-c0705d9590ba` si verifica redarea.
- Verifica upload JPG/MP4 si noul playlist; Vite incorporeaza variabilele la build.
- Cloudflare Pages ofera fallback SPA implicit daca nu exista un `404.html` in root.

## TCL: nu opri Netlify prematur
APK-ul Screenflow TV v1.0 are hostname-ul `screenflowum.netlify.app` fixat in cod.
Dupa ce URL-ul Cloudflare este cunoscut si verificat:
1. Actualizeaza `HOST` in `android-tv/app/src/main/java/ro/screenflow/tv/MainActivity.java` la hostname-ul real Cloudflare.
2. Pastreaza `DEFAULT_ID` al ecranului deja configurat.
3. Compileaza un APK nou cu GitHub Actions si instaleaza-l prin ADB (`adb install -r`).
4. Confirma ca TCL reda din Cloudflare, apoi migreaza restul televizoarelor.
5. Pastreaza Netlify ca rezerva pana cand fiecare ecran a trecut la noul domeniu.

Mutarea hostingului nu activeaza singura monitorizarea online/offline sau sincronizarea precisa a TV-urilor: necesita update separat de player, backend si panoul admin.
Acest repository include in continuare `netlify.toml` pentru rollback. Cloudflare il ignora.
