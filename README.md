# Guter Geschmack

## Direkt über GitHub Pages hosten (ohne Vercel, nur vom iPhone aus)

1. Auf github.com (eingeloggt, im Safari-Browser) ein **neues, öffentliches
   Repository** anlegen. Öffentlich ist hier unkritisch — dein TMDB-Key steht
   nirgends im Code, der bleibt nur lokal in deinem Browser.
2. Über "Add file → Upload files" **alle** Dateien und Ordner aus diesem Zip
   hochladen, inklusive der versteckten `.github`-Ordnerstruktur (die Datei
   `.github/workflows/deploy.yml` ist wichtig — die baut die App automatisch).
3. Im Repo: Settings → Pages → bei "Build and deployment" → Source auf
   **"GitHub Actions"** stellen.
4. Fertig. Bei jedem Hochladen/Commit baut GitHub die App automatisch und
   veröffentlicht sie unter `https://DEINNAME.github.io/REPONAME/`
   (unter Settings → Pages siehst du die genaue Adresse, sobald der erste
   Durchlauf fertig ist — dauert ca. 1–2 Minuten, Fortschritt im "Actions"-Tab
   des Repos sichtbar).
5. Die Adresse in Safari öffnen → Teilen-Symbol → "Zum Home-Bildschirm" →
   fertig. Startet dann im Vollbild mit eigenem Icon, wie eine echte App.

## Alternative: Vercel (falls das Repo wirklich privat bleiben soll)

GitHub Pages braucht auf dem Gratis-Account ein öffentliches Repo. Falls dir das
nicht ganz geheuer ist: Vercel kann auch von einem **privaten** GitHub-Repo aus
kostenlos bauen (Hobby-Plan, nur für den eigenen Account, keine Organisationen).
Dafür bei vercel.com mit GitHub einloggen und das Repo importieren — der Rest
läuft identisch automatisch.

## Lokal am Computer starten (falls doch mal einer zur Hand ist)

```
npm install
npm run dev
```
Dann die angezeigte `http://localhost:5173`-Adresse öffnen.

## Warum das CORS-Problem hier verschwindet

Das CORS-Problem kam von der Sandbox der Chat-Vorschau, nicht von TMDB selbst.
Sobald die Seite eine echte eigene Adresse hat (GitHub Pages, Vercel oder
localhost), funktionieren die TMDB-Anfragen normal — das "Zum Home-Bildschirm"
sorgt nur noch für den Vollbild-App-Look obendrauf.

## Dein TMDB-Key

Wird beim ersten Start einmal eingetragen und danach lokal im Browser gemerkt
(localStorage) — musst du ihn auf diesem Gerät nicht noch mal eingeben.
