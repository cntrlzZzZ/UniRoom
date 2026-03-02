# UniRoom 📚🗓️  
A mobile-first room booking web app for the JKU library to check availability and book in one simple flow.

## Why UniRoom?
Library room booking is usually a bit of a maze: separate pages, too many clicks, and it’s easy to miss conflicts. UniRoom puts **availability + booking** into one clean mobile experience, designed for quick “phone in hand” use.

## Features
- **Mobile-first UI** (touch-friendly day view + fast navigation)
- **See availability and book in one place**
- **Conflict checks** with clear error messages (prevents overlaps / invalid bookings)
- **My bookings** view + easy cancellation
- **Email confirmations** for bookings
- **PWA support**: installable app, fast load, and an offline shell (manifest + service worker)

## Tech stack
- **Backend:** Django (Python)
- **Frontend:** HTML/CSS + JavaScript (mobile-first)
- **API:** REST-style endpoints (JSON)
- **PWA:** Web App Manifest + Service Worker

## Project structure (example)
```bash
uniroom/
backend/           # Django project
frontend/          # Static assets / templates
service-worker.js  # PWA caching/offline shell
manifest.json      # PWA manifest
requirements.txt
manage.py
```

## API (high level)
Endpoints are organised around:
- `rooms` – list rooms / metadata  
- `availability` – availability for a date/room  
- `bookings` – create bookings  
- `my-bookings` – list user bookings  
- `cancel` – cancel booking  

(Exact routes + params depend on your implementation — see the code for details.)

## Local setup

### 1) Clone
```bash
git clone <your-repo-url>
cd uniroom
```

### 2) Create a virtual environment
```bash
python -m venv .venv
source .venv/bin/activate   # macOS/Linux
# .venv\Scripts\activate    # Windows
```

### 3) Install dependencies
```bash
pip install -r requirements.txt
```

### 4) Environment variables
Create a .env (or set env vars in your shell). Typical Django ones:
- SECRET_KEY
- DEBUG
- ALLOWED_HOSTS
- Email settings (if you use SMTP) like EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD

### 5) Database + run
```bash
python manage.py migrate
python manage.py runserver
```

## PWA notes
- UniRoom includes a manifest and service worker so it can be installed and opened quickly.
- Offline mode is intended as an offline shell (the app opens; real-time booking still needs a connection).

## Screenshots / Demo
Will add later
