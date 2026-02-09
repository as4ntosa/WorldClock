# WorldClock

A web application that greets users based on the local time of any city in the world, with live weather, air quality, news, an interactive map, nearby restaurant recommendations, and mood-based music.

## Features

- **Time-based greeting** — Displays "Good morning," "Good afternoon," or "Good evening" based on the local time in the selected city
- **Live clock** — Real-time clock updating every second with the city's local time and date
- **Weather** — Current temperature, conditions, humidity, and wind speed
- **Air Quality Index** — US AQI with color-coded severity badge and PM2.5/PM10 readings
- **Local news** — Top 5 recent headlines from the selected city via Google News
- **Interactive map** — Leaflet.js map centered on the city with a location pin
- **Nearby restaurants** — Up to 8 restaurant recommendations with cuisine types, shown as markers on the map
- **Mood-based music** — Select your mood (happy, sad, or angry) and get a curated uplifting song that auto-plays in the background, with the title, artist, and a personalized reason for why it was chosen

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla HTML/CSS/JS with Inter font and Leaflet.js
- **APIs** (all free, no keys required):
  - [Nominatim](https://nominatim.openstreetmap.org/) — Geocoding
  - [TimeAPI.io](https://timeapi.io/) — Timezone lookup
  - [Open-Meteo](https://open-meteo.com/) — Weather and air quality
  - [Google News RSS](https://news.google.com/) — Local news headlines
  - [Overpass API](https://overpass-api.de/) — Nearby restaurants (OpenStreetMap)
  - [YouTube Embed](https://www.youtube.com/) — Mood-based music playback

## Getting Started

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
