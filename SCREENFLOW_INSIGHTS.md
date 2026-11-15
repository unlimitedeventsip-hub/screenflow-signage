# ScreenFlow Insights — #altfel (v1)

## Ce poate măsura

- **TV-uri:** starea aplicațiilor înregistrate, platformă, ultim heartbeat, schimbări istorice de material; de la această versiune, playerul asociat trimite separat pornire, finalizare, eșec și timp aproximativ redat.
- **QR:** pagina deschisă prin QR generat pentru televizor (`?src=tvqr`) ori print (`?src=printqr`), **numai după consimțământul pentru statistici**. Aceasta este o vizită atribuită, nu dovada fizică a scanării.
- **Meniu:** deschiderea secțiunii, expuneri vizibile ale produselor și folosirea căutării. Nu se salvează termenii introduși.
- **Rezervări:** cereri `pending/confirmed/cancelled` din baza oficială; fără a copia în analytics numele, emailul sau telefonul.
- **Interactiv:** participări reale la vot, quiz și karaoke din tabelele operaționale. Vizitele pe paginile evenimentelor sunt măsurate numai cu consimțământ.
- **PWA:** apăsarea instalării, evenimentul `appinstalled` în browsere compatibile și deschiderea din modul standalone. Pe iOS, instalarea manuală nu este confirmată universal; `standalone` ≠ număr unic de instalări.
- **Conturi:** înregistrarea prin Supabase Auth, verificare email (în funcție de configurarea Auth), cerere de acces, aprobare explicită de un administrator, jurnal cu logări reușite ale personalului. NU salvăm parole în tabelele ScreenFlow.

## Etichete corecte

- `Vizite atribuite QR`: accesări cu codul sursă; codurile deja distribuite fără `src` se numără la «direct / QR vechi».
- `Vizualizări produs`: cardul a fost vizibil în pagină, **nu** dovada că a fost citit.
- `Pornire TV` / `Finalizare TV`: evenimente raportate de software-ul TV asociat; **nu** persoane care au privit TV-ul și **nu** impresii certificate.
- `Minute TV raportate`: diferență de timp aproximativă între start și finalizare; buffering-ul poate afecta cifra.
- `Player înregistrat`: nu înseamnă obligatoriu APK/PWA instalat.
- `Autentificări personal`: autentificări reușite captate după lansarea noii funcții; nu include reîmprospătările automate de sesiune.

## Securitate și consimțământ

- Jurnalul vizitatorilor folosește UUID aleator doar pentru fila browserului și doar după alegerea «Accept statisticile». Preferința este schimbabilă din butonul «Preferințe statistici».
- Respectăm `Do Not Track`; nu colectăm IP, user-agent, identitate, text de căutare sau URL-uri de rezervare în **tabelele de analytics**. Furnizorii de rețea/hosting își păstrează separat logurile tehnice, după politicile proprii.
- Tabelele analitice, cererile de acces și jurnalul login au RLS activ și fără acces direct anon/autentificat. Citirea rapoartelor și aprobarea conturilor verifică `is_signage_admin()` pe server. RPC-ul public pentru înregistrarea evenimentelor acceptă doar tipuri predefinite, huburi publicate și rate limit pe sesiune. Este **best effort**, nu protecție împotriva tuturor formelor de trafic automat.
- Conturile autoînregistrate nu pot citi datele ScreenFlow înainte de aprobarea explicită. **Aprobarea conferă acces complet de administrator** la toate locațiile, deci nu e destinată oricărei persoane. Drepturile pe locație/roluri granulare necesită o etapă ulterioară.
- Jurnalele detaliate pentru vizitatori, login și TV mai vechi de 90 zile sunt șterse când un administrator deschide modulul Statistici. Nu există încă un job cron autonom, deci dacă nimeni nu accesează panoul, ștergerea poate întârzia.

## Lansare și verificări

1. Migrațiile `20261115173000_screenflow_analytics_accounts.sql`, `20261115175000_tv_airtime_and_retention.sql` și `20261115180500_analytics_tv_reporting.sql` trebuie să existe în baza de date înaintea codului frontend.
2. În Supabase Auth: verifică **Enable sign ups**, politica de confirmare email și **Redirect URLs** care să includă `https://screenflow-signagead.unlimited-events-ip.workers.dev/admin` (dacă domeniul acesta este folosit).
3. Verifică signup → confirmare email → login → «în așteptare» → aprobare din **Statistici & conturi** → login aprobat.
4. Testează QR TV vs. QR printat, consimțământ refuzat/acceptat, meniu, rezervare, quiz, PWA pe Android/iOS, heartbeat și pornire/finalizare media pe TCL/Tizen. Nu crea conturi/rezervări false în producție.
5. În panou există filtru 7/30/90 zile, filtru locație și export CSV. Datele istorice disponibile din sistemele vechi apar separat; nu retrocalculăm vizite web inexistente.

## Extensii viitoare

- Roluri per locație (proprietar/manager/operator), invitații în loc de acces admin global.
- Integrare POS/comenzi pentru a atribui conversii reale și a calcula vânzări, nu doar interes.
- A/B testing pe promoții și campanii, trackare click de produs doar după consimțământ.
- Protecție suplimentară anti-abuz (Turnstile/rate limit la marginea rețelei).
- Export programat și rapoarte email agregate, după configurarea unei surse de trimitere și a unui program de retenție independent.
