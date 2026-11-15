# ScreenFlow × #altfel — Interfață vizuală

Referința vizuală este fotografia cu peretele decorativ **#altfel** furnizată de beneficiar (15.11.2026).
Culorile de mai jos sunt interpretări digitale aproximative ale fotografiei, nu specificații Pantone.

| Rol | Culoare | HEX |
| --- | --- | --- |
| Fundal cald | Crem | `#F8EFE0` |
| Forme și carduri | Bej nisipiu | `#E8D8BC` |
| Accent de brand | Corai / teracotă | `#D56551` |
| Acțiuni cu text alb | Corai închis accesibil | `#A53C30` |
| Accent secundar | Turcoaz pastel | `#80AFA5` |
| Accent punctual | Galben cald | `#EAC748` |
| Contur / text | Grafit negru | `#252526` |
| Sticker | Alb cald | `#FFFDF7` |

## Limbaj grafic

- Logo **#altfel** foarte bold, în negru pe etichete albe ușor rotite (aproximativ –4°…–8°).
- Forme organice mari, asimetrice, conturate cu grafit; folosite numai ca accente pe hero, login, conectare și standby.
- Bază aerisită, caldă, cu mult spațiu alb pentru controale și liste.
- Butoane de acțiune corai mai închis pentru contrast, iar coraiul luminos pentru ornamente.
- Interfețele publice (meniu, rezervări, quiz) împrumută aceeași identitate fără a sacrifica lizibilitatea.
- **Nu** se aplică filtre de culoare asupra fotografiilor/video încărcate de administrator; media păstrează tonurile originale.

Implementarea principală: `src/altfel-theme.css`, încărcat după stilurile existente prin `src/main.js`.
Faviconul și culoarea browserului/PWA folosesc aceeași familie cromatică.

## Verificare

Rulați `npm test` și `npm run build`. Pe TV verificați conectarea, standby, reclame orizontale/verticale, redarea offline, Smart Modes, butoanele și QR-ul de quiz. Testarea fizică pe TCL/Tizen este distinctă de buildul automat.
