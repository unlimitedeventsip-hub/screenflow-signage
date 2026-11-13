# Screenflow: clienți, QR și partajare ecran

## Stare verificată la 13 noiembrie 2026

Proiectul folosește site-ul Cloudflare existent și Supabase `screen`.
La verificare existau 6 ecrane înregistrate, 4 materiale media și 3 locații.
Aceasta este configurația din server, nu o confirmare că televizoarele sunt pornite.
Nu exista niciun cont Instagram conectat, eveniment interactiv activ sau agent LAN asociat.
Cele două intrări existente de meniu erau teste; nu au fost publicate către clienți.

| Componentă | Implementare | Ce mai trebuie verificat / configurat |
| --- | --- | --- |
| Bibliotecă, playlisturi, TV-uri, asociere, sunet | Existau în cod și baza de date | Funcționarea fizică pe fiecare model |
| Offline și programare în Europe/Bucharest | Existau în player și service worker | Descărcare integrală înainte de pierderea internetului, limitele de stocare TV |
| Sincronizare | Reper comun, corecții după buffering | Nu reprezintă sincronizare la nivel de cadru |
| Voturi și karaoke | Existau serviciul public, Admin și afișarea TV | Crearea efectivă a evenimentelor |
| Instagram | Existau OAuth, import și configurare | Aplicație Meta și autorizarea conturilor Professional |
| Pornire TV / relansare aplicație | Agent Python ADB/Wake-on-LAN existent | Agent activ în fiecare rețea, asociere și compatibilitate hardware; Samsung Remote rămâne neimplementat |
| Conversie video | Scripturi FFmpeg pentru Windows existente | Conversia automată pe server nu este implementată |
| Pagina clienților | Adăugată în această versiune | Linkurile oficiale de meniu, bilete, rețele sociale și Maps |
| Rezervări | Formular public și coadă privată Admin, cu confirmare manuală | Echipa contactează clientul; nu se trimit automat SMS sau email |
| Partajare ecran | Captură din browser, WebRTC și selecție TV, revenire la playlist | Test TCL/Samsung; TURN pentru rețele unde STUN/conexiunea directă nu ajung |

## Utilizare

În **Clienți & QR**, alegi locația, completezi linkurile, publici pagina și descarci QR SVG.
Linkul `/g/<slug>` rămâne stabil când se modifică meniul, biletele sau conturile sociale.
Poți afișa QR pe TV-urile locației, fără să creezi o nouă reclamă.

Meniul telefonului folosește produsele din Smart Modes → Meniu digital marcate explicit
pentru publicare. Produsele existente nu devin publice automat. Sunt respectate perioada,
zilele și intervalele zilnice, inclusiv cele care trec de miezul nopții.

Cererea de rezervare este salvată ca `pending`, nu ca masă confirmată. Se poate marca
confirmată sau anulată din Admin. Telefonul și numele sunt private pentru administratori.
Butonul de ștergere permite eliminarea datelor care nu mai sunt necesare. Retrimiterea
aceleiași cereri folosește un identificator de idempotență; limita pentru cereri repetate
este atomică și se aplică per contact/rețea/locație. Nu sunt stocate IP-uri brute.

**Partajare ecran:** deschizi Admin într-un browser desktop HTTPS, alegi televizorul,
apeși „Alege ecranul & partajează” și selectezi fila/fereastra/ecranul în dialogul browserului.
Screenflow trebuie să ruleze deja pe TV. Nu se lansează o aplicație închisă și nu se
pornește fizic televizorul prin WebRTC. Sunetul depinde de sursă, autoplay și browser.
Sesiunile sunt individuale pentru fiecare TV. Lease-ul se reînnoiește la 10 secunde și
expiră după maximum 45 secunde fără sursă; durata maximă a unei sesiuni este 4 ore.
La oprire, ecranul revine la programul normal. O stare „playing” este raportată abia la
redarea efectivă în elementul video al receptorului, nu la simpla creare a comenzii.

## Servicii și acces

- `screenflow-guest`: GET pentru o singură pagină publicată; POST pentru o cerere validată.
- `screenflow-display`: citește setările unei singure pagini TV identificate prin public_id;
  semnalizarea WebRTC este limitată la sesiunea acelui TV.
- Tabelele `guest_hubs`, `guest_reservations` și `screen_mirror_sessions` au RLS și politici Admin.
  Anon nu poate citi direct tabelele sau apela funcția de inserare a rezervărilor.
- `create_guest_reservation` este SECURITY INVOKER și poate fi apelată numai cu service_role.
- Cheia service_role există numai în funcțiile server. Browserul folosește cheia publică.
- `SCREENFLOW_ICE_SERVERS` este o variabilă opțională a funcției `screenflow-display`,
  cu un array JSON de RTCIceServer. Implicit este STUN. Pentru producție în rețele
  diferite se recomandă un serviciu TURN cu acreditări temporare, nu secrete în Git.

## Verificări

`npm test` verifică linkuri, escaping, programul peste miezul nopții, limitele perioadelor
și ora Europe/Bucharest. `npm run build` produce aplicația SPA.
Verificările SQL în tranzacție anulată verifică idempotența rezervărilor, limita de cereri
și respingerea datelor din trecut. Cererile HTTP verifică paginile publice și refuzul
unui ecran necunoscut. QA vizual folosește pagini de test excluse din Git/build.

Nu au fost testate televizoarele fizice sau o sesiune media WebRTC completă pe TCL/Tizen.
O actualizare a playerului web nu cere APK nou, dar aplicația TV trebuie să reîncarce pagina.
