# Devbhoomi — Uttarakhand Tourism Chatbot

AI-powered travel planner for Uttarakhand. Zero cost to host, zero paid database, free LLM.

## Live demo structure
```
index.html          ← UI (deploy to Vercel or GitHub Pages)
css/style.css       ← Styles
js/app.js           ← Frontend logic
api/chat.js         ← Serverless proxy (Vercel only — keeps API key secret)
data/destinations.json ← All destination, package, transport data
vercel.json         ← Vercel routing config
```

---

## Deploy in 10 minutes (Vercel — recommended)

Vercel hosts the UI AND the API proxy. Your API key stays secret.

### Step 1 — Get a free Groq API key
1. Go to console.groq.com → Sign up (free)
2. Create an API key
3. Copy it — you'll need it in Step 4

### Step 2 — Push to GitHub
```bash
git init
git add .
git commit -m "Devbhoomi chatbot"
git remote add origin https://github.com/YOUR_USERNAME/uk-tourism-chatbot.git
git push -u origin main
```

### Step 3 — Deploy to Vercel
1. Go to vercel.com → Sign in with GitHub
2. Click "New Project" → Import your `uk-tourism-chatbot` repo
3. Click "Deploy" (no build settings needed)

### Step 4 — Add your API key
1. In Vercel dashboard → Your project → Settings → Environment Variables
2. Add: `GROQ_API_KEY` = your Groq API key
3. Click Save → Go to Deployments → Redeploy

Your chatbot is now live at `yourproject.vercel.app` 🎉

---

## Optional: Add Gemini as fallback
1. Go to aistudio.google.com → Get API key (free)
2. In Vercel → Environment Variables → Add: `GEMINI_API_KEY` = your key
3. Redeploy

---

## Optional: Add OpenTripMap for POI data
1. Go to opentripmap.com → Register → Get free API key (5000 req/day)
2. Open `js/app.js` → Replace `your_opentripmap_key_here`

---

## Free tier limits

| Service | Free limit | Resets |
|---------|-----------|--------|
| Vercel hosting | 100 GB bandwidth | Monthly |
| Vercel functions | 100,000 invocations | Monthly |
| Groq API | 30 req/min, 14,400/day | Daily |
| Gemini Flash | 60 req/min | Per minute |
| Open-Meteo | Unlimited | — |
| OpenTripMap | 5,000 req/day | Daily |

---

## Adding more destinations

Edit `data/destinations.json` — add a new entry under `destinations`:

```json
"new_place": {
  "name": "New Place",
  "district": "District Name",
  "lat": 30.00,
  "lon": 79.00,
  "elevation_m": 1500,
  "type": ["hill station"],
  "best_months": ["Apr", "May", "Oct"],
  "avoid_months": ["Jul", "Aug"],
  "highlights": ["Thing 1", "Thing 2"],
  "entry_fees": { "Main site": 50 },
  "avg_hotel_budget": 800,
  "avg_hotel_mid": 2500,
  "avg_hotel_luxury": 7000,
  "description": "One paragraph description."
}
```

---

## Data sources used (all official/open)

- uttarakhandtourism.gov.in — official tourism data
- gmvnl.com — GMVN guesthouses and packages
- Open-Meteo (open-meteo.com) — weather, no key required
- Wikivoyage API — destination guides
- OpenTripMap — POI data
- IRCTC / GMOU — transport schedules (embedded in JSON)
