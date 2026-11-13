# Screenflow LAN Agent

Agentul permite comenzi fizice de la distanță pe TV-urile compatibile, atunci când aplicația Screenflow este complet închisă.

**Necesită un mini-PC sau Raspberry Pi pornit în fiecare locație**, conectat la aceeași rețea cu televizoarele. Browserul Cloudflare / aplicația Screenflow de pe TV nu poate trimite comenzi direct în LAN când TV-ul este oprit sau aplicația este închisă.

## Instalare

1. Pe mini-PC instalează Python 3.9+; pe TCL instalează Android Platform Tools ADB.
2. Pornește ADB over network pe fiecare TCL și confirmă autorizarea agentului pe TV. IP fix sau rezervare DHCP.
3. În Admin → Locații → generează agent pentru Unirii/Decebal. Tokenul se afișează o singură dată.
4. Copiază agent/screenflow-agent.example.json ca agent/screenflow-agent.json, completează ID, secret, cheia publică și adb_path.
5. Rulează: python screenflow_agent.py. Configurează autostart al procesului cu Windows Task Scheduler / systemd.
6. Verifică în Admin ultima conectare și trimite o comandă de test.

## Limitări reale

- TCL Android TV: pornirea aplicației se poate face prin ADB **doar cât TV-ul este activ și ADB pairing acceptat**. Wake-on-LAN funcționează doar pe modele cu Network Standby/Wake-on-LAN.
- Samsung Tizen: implementarea locală include momentan Wake-on-LAN; pentru lansarea Samsung app sau standby trebuie asociere Remote API/HDMI-CEC specifică modelului. Agentul răspunde cu «neimplementat» pentru aceste comenzi, fără să pretindă succes.
- Power off complet/priză deconectată: Wake-on-LAN nu funcționează. Nu controla prize inteligente prin tăierea bruscă a curentului ca metodă principală.
- IP/MAC greșite: agentul nu poate controla dispozitivele. Verifică modelul/firmware-ul.
- Agentul primește programul și comenzile din Supabase, dar stochează ultimul program pentru cazul căderii internetului. Ora mini-PC-ului trebuie setată pe Europe/Bucharest.
- Păstrează tokenul agentului secret: nu îl publica în GitHub și nu îl trimite pe chat.

## Programare

În Admin → Locații setează 15:00 și ora reală a închiderii, apoi activează programul. Agentul conectat va încerca să trezească TV-urile, să lanseze aplicația și să intre în standby la închidere. Redarea Screenflow este programată separat prin manifest și poate opri reclamele chiar dacă televizorul rămâne alimentat.

## Securitate

Agentul nu expune porturi publice; doar conexiuni HTTPS outbound către Supabase. Comenzile provin de la un admin autorizat, iar accesul local al agentului este limitat la locația cu care a fost asociat. Tokenurile vechi pot fi invalidate re-asociind agentul. Dacă tokenul este compromis, re-asociază imediat.
