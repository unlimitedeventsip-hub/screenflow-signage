# Screenflow — program automat și controlul televizoarelor (v6)

## Ce este implementat
- Admin → Locații: activezi programul zilnic de difuzare per locație, cu ore HH:MM în Europe/Bucharest; intervalele care trec de miezul nopții sunt suportate.
- Admin → Televizoare Live: „Pornește redarea”, „Pauză”, „Reîncarcă” pentru fiecare ecran; comenzile sunt autorizate prin Supabase RLS și citite de player prin manifest în circa 15 secunde cât timp aplicația este deschisă și online.
- Player: în afara programului sau la pauză arată un ecran negru cu mesaj, fără reclame/audio; la redeschidere reia automat.
- Status pe baza heartbeat-ului: aplicație online, în fundal sau fără răspuns; ultimul contact și diagnostice video.
- Video încărcat nou: durata reală din metadate pentru un timeline de sincronizare mai corect; la pregătirea video sincronizat se calculează poziția după ora curentă, nu după momentul de pornire al bufferingului.
- Playlisturi → „Sincronizează TV-urile”: cronologie comună pe server pentru toate ecranele care folosesc același playlist.

## Ce NU face aplicația, de una singură
- Nu poate aprinde un TV complet scos din priză. Pentru pornire fizică la ora stabilită este necesar suport specific al televizorului: Wake-on-LAN/Network standby, pornire după revenirea alimentării, HDMI-CEC/RS-232 sau un controler local compatibil.
- Nu poate confirma că ecranul fizic este oprit folosind doar heartbeat. „Fără răspuns” poate însemna TV oprit, standby, aplicație închisă ori lipsă internet.
- Nu poate garanta pornire automată a unei aplicații în fundal pe orice firmware Android: Android restricționează lansarea activităților din fundal. APK-ul Android TV încearcă deja auto-start la boot prin BOOT_COMPLETED (best effort).
- Nu poate sincroniza la nivel de cadru televizoare de mărci diferite doar prin pagini web. Decodarea, bufferingul, viteza rețelei și firmware-ul pot produce diferențe.

## Pentru funcționare fără intervenție umană la #altfel Unirii
1. Verifică în Setări TCL dacă televizorul are pornire programată sau pornire prin rețea; confirmă dacă revine automat pe Screenflow după power-on.
2. Configurează programul locației (de exemplu 15:00–02:00) în Admin și activează-l doar după teste.
3. Atribuie același playlist tuturor ecranelor și activează sincronizarea.
4. Pentru video, folosește MP4 H.264/AAC, 1080p, 30 fps, \u002Bfaststart, interval de keyframe 2 secunde. Scriptul tools/optimize-video-tv.ps1 convertește fișierele pe Windows fără a suprascrie originalul.
5. Pentru fiecare model notează dacă suportă Wake-on-LAN, HDMI-CEC, autostart și revenirea după pană de curent.
6. Testează orele de program atât înainte, cât și după miezul nopții și verifică starea heartbeat-ului în Admin.

## Deployment
- Migrare Supabase: supabase/upgrade_v6_schedule_control.sql (o singură dată; nedistructivă).
- Frontend: este nevoie de rebuild + redeploy pe Cloudflare Worker. Workflow-ul web-build.yml din GitHub doar validează buildul; **nu publică** automat noul cod.
- În mediul de deploy trebuie păstrate variabilele publice VITE_SUPABASE_URL și VITE_SUPABASE_ANON_KEY pentru același proiect.
- Cu Wrangler autentificat în contul Worker existent: `npm install; npm run build; npx wrangler deploy` (din rădăcina repo).
- APK-ul existent nu necesită schimbare pentru comenzile de redare atât timp cât încarcă /play de la Worker; pentru pornirea fizică este necesară o integrare separată.
