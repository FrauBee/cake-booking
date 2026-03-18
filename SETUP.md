# Cake Booking System - Vercel Deployment

## Schnellstart (3 Schritte)

### 1. Supabase Datenbank einrichten (kostenlos)

1. Gehe zu [supabase.com](https://supabase.com) und erstelle ein kostenloses Konto
2. Erstelle ein neues Projekt (Region: Frankfurt empfohlen)
3. Gehe zu **SQL Editor** und fuehre den Inhalt von `supabase-setup.sql` aus
4. Gehe zu **Settings → API** und notiere dir:
   - **Project URL** (z.B. `https://abc123.supabase.co`)
   - **anon public key**
   - **service_role key** (unter "Project API keys")

### 2. Vercel Deployment

1. Erstelle ein [Vercel](https://vercel.com) Konto (kostenlos mit GitHub)
2. Pushe diesen Ordner in ein GitHub Repository
3. Importiere das Repository in Vercel
4. Fuege folgende **Environment Variables** hinzu:
   - `SUPABASE_URL` = deine Project URL
   - `SUPABASE_ANON_KEY` = dein anon public key
   - `SUPABASE_SERVICE_KEY` = dein service_role key
5. Klicke auf **Deploy**

### 3. Fertig!

Deine Schueler koennen jetzt unter `dein-projekt.vercel.app` buchen.

## Optionale Anpassungen

### Klassen aendern
Bearbeite `public/js/cake-booking.js` → `SCHEDULE` Array

### Admin-Passwort aendern
1. Oeffne die Browser-Konsole
2. Fuehre aus: `crypto.subtle.digest('SHA-256', new TextEncoder().encode('DeinNeuesPasswort')).then(b => console.log(Array.from(new Uint8Array(b)).map(b => b.toString(16).padStart(2,'0')).join('')))`
3. Ersetze den Hash in `api/admin/login.js`

### Custom Domain
In Vercel: Settings → Domains → eigene Domain hinzufuegen

### GDPR Auto-Cleanup
Die `/api/cleanup` Route loescht automatisch alte Buchungen.
Du kannst einen Vercel Cron Job einrichten oder sie manuell aufrufen.

## Projektstruktur

```
cake-booking-vercel/
├── public/              # Frontend (statisch)
│   ├── index.html
│   ├── css/styles.css
│   └── js/cake-booking.js
├── api/                 # Backend (Vercel Serverless)
│   ├── bookings.js      # GET/POST Buchungen
│   ├── bookings/[id].js # PATCH/DELETE einzelne Buchung
│   ├── admin/login.js   # Admin-Auth
│   └── cleanup.js       # GDPR Auto-Cleanup
├── supabase-setup.sql   # Datenbank-Schema
├── vercel.json          # Vercel Config
└── package.json
```
