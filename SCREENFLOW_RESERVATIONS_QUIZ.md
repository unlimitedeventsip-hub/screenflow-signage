# Rezervări, meniu și quiz live

## Pagina clienților

La `/g/<slug>` clientul alege locația, numele, emailul obligatoriu, telefonul, ora Bucureștiului și numărul de persoane. Cererea este în așteptare până la confirmare. Primește imediat un link privat pentru urmărirea stării. Linkul este o cheie: nu trebuie publicat.

Produsele publicate din Meniu digital sunt afișate în pagină, cu categorii și căutare. Un meniu extern poate fi integrat într-un cadru cu link de rezervă; afișarea în cadru depinde de permisiunile furnizorului. Nu sunt adăugate prețuri sau produse fictive.

## Responsabilul locației

Din Admin → Clienți & QR → Deschide administrarea rezervărilor, administratorul principal intră cu sesiunea sa existentă. Cererile viitoare sunt afișate separat, iar notificările deschid ziua rezervării. Pagina `/manage/<slug>` include confirmare/anulare, prezență, atribuire masă, capacitate și planul meselor.

În „Acces individual pentru responsabili” administratorul principal creează un link privat pentru fiecare responsabil. Cheia aleatoare de 256 biți este păstrată numai sub formă de hash pe server; linkul este arătat o singură dată. Accesul este limitat la rezervările locației, durează 90 zile și poate fi revocat. Telefonul reține cheia pentru redeschiderea paginii și notificări. Folosiți dispozitive de încredere și butonul Ieși pe cele partajate.

Capacitatea ia în calcul cererile pending și confirmed la primire. Anularea eliberează capacitatea. La confirmare, serverul verifică din nou capacitatea, dimensiunea mesei și suprapunerile. Actualizările concurente cer reîncărcarea datelor. Mesele se poziționează cu coordonate X/Y în procente; planul este schematic, nu o măsurătoare a locației. Fiecare rezervare se alocă unei mese; gruparea mai multor mese nu este implementată.

## Notificări

Butonul „Activează notificările” înregistrează telefonul pentru Web Push. Sunt generate chei VAPID pe server. Notificările sunt expediate dintr-o coadă durabilă, cu reluări prin cron o dată pe minut. Nu expun date de contact pe ecranul blocat. Responsabilii revocați nu mai primesc notificări. Activarea și livrarea efectivă trebuie testate pe telefoanele folosite.

Emailul este trimis prin Resend. În Supabase → Edge Functions → Secrets configurați `RESEND_API_KEY` și `RESERVATIONS_EMAIL_FROM`, folosind un domeniu verificat. Nu introduceți cheia în frontend sau în conversație. Fără ele, interfața arată că serviciul nu este configurat și nu pretinde că a trimis email. După configurare folosiți „Reîncearcă notificările netrimise”. Emailul responsabilului se configurează la generarea accesului individual. Confirmările și anulările se trimit clientului. Din linkul privat de urmărire clientul poate activa și notificări push pentru aprobare/anulare, independent de configurarea emailului.

Emailurile și push nu sunt garantate până la testarea furnizorului/dispozitivului. Linkul privat de urmărire funcționează independent de email. Mesajul WhatsApp este doar pregătit și este trimis manual de responsabil.

## Instalare

PWA include manifest per locație, iconuri, service worker și invitație de adăugare pe telefon. Android poate afișa dialogul nativ de instalare. Pe iPhone: Safari → Partajează → Adaugă pe ecranul principal. Push pe iPhone necesită o versiune iOS compatibilă și deschiderea aplicației din ecranul principal. Pagina de rezervări necesită internet pentru date și modificări; nu se confirmă rezervări offline.

## Quiz și import AI

În Experiențe TV → Voturi / Quiz: scrieți tema, copiați promptul în AI, lipiți JSON-ul, previzualizați și publicați. Importul este doar date validate: nu execută HTML sau JavaScript. Formatul este `version:1, type:"quiz", title, questions:[{text,options,correct,seconds,explanation}]`.

Jucătorii intră prin QR și aleg un nume. Gazda pornește întrebarea, dezvăluie răspunsul și trece mai departe. Răspunsurile sunt acceptate o singură dată per dispozitiv/rundă, cu termen verificat pe server; punctajul depinde de corectitudine și timp. Răspunsul corect și punctele rundei nu sunt publice înainte de dezvăluire. Este un quiz recreativ, fără autentificarea identității participantului. TV-ul verifică modurile interactive la 3 secunde; nu este sincronizare de cadru.

Același flux de prompt → AI → previzualizare → import este disponibil pentru meniuri, oferte, anunțuri și celelalte moduri text. Prețurile, ingredientele și datele reale trebuie furnizate operatorului. Materialele se pot edita după import. Modurile fără conținut nu se activează; meniurile TV cu peste 8 produse sunt paginate. Conturile Instagram, transmisiunile externe și capturile foto necesită în continuare sursele/configurarea lor.

## Verificări

`npm test` verifică importurile, linkurile și programarea. `tests/operations.sql` rulează într-o tranzacție anulată și verifică limite, suprapuneri, versiuni concurente, acces pe locație, protecția datelor și punctajul quizului. Buildul este compatibil Chrome 76 pentru playerul Samsung existent. Nu este necesar APK nou pentru această actualizare web.
