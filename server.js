const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

async function safeFetch(url, options, timeoutMs) {
  try {
    return await fetchWithTimeout(url, options, timeoutMs);
  } catch {
    return null;
  }
}

function parseRssItems(xml, limit = 5) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const block = match[1];
    const title = (block.match(/<title>(.*?)<\/title>/) || [])[1] || '';
    const link = (block.match(/<link>(.*?)<\/link>/) || [])[1] || '';
    const pubDate = (block.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
    const source = (block.match(/<source[^>]*>(.*?)<\/source>/) || [])[1] || '';
    items.push({ title, link, source, pubDate });
  }
  return items;
}

const SONG_POOL = {
  sad: [
    { title: 'Here Comes the Sun', artist: 'The Beatles', youtubeId: 'KQetemT1sWc', reason: 'A gentle reminder that brighter days are always ahead, even after the hardest times.' },
    { title: 'Three Little Birds', artist: 'Bob Marley', youtubeId: 'zaGUr6wzyT8', reason: 'Bob Marley\'s warm reassurance that every little thing is gonna be alright.' },
    { title: 'Happy', artist: 'Pharrell Williams', youtubeId: 'ZbZSe6N_BXs', reason: 'An infectious beat that makes it impossible not to smile and move your body.' },
    { title: 'Don\'t Stop Me Now', artist: 'Queen', youtubeId: 'HgzGwKwLmgM', reason: 'Pure joyful energy from Freddie Mercury to lift your spirits sky-high.' }
  ],
  angry: [
    { title: 'Don\'t Worry Be Happy', artist: 'Bobby McFerrin', youtubeId: 'd-diB65scQU', reason: 'A soothing whistle and carefree melody to help you let go of frustration.' },
    { title: 'Walking on Sunshine', artist: 'Katrina & the Waves', youtubeId: 'iPUmE-tne5U', reason: 'Bright, upbeat energy to transform tension into pure positive vibes.' },
    { title: 'Best Day of My Life', artist: 'American Authors', youtubeId: 'Y66j_BUCBMY', reason: 'An anthem to remind you that today can still be amazing despite the frustration.' },
    { title: 'Send Me on My Way', artist: 'Rusted Root', youtubeId: 'IGMabBGydC0', reason: 'A feel-good rhythm that channels your energy into something uplifting.' }
  ],
  happy: [
    { title: 'Good as Hell', artist: 'Lizzo', youtubeId: 'SmbmeOgWsqE', reason: 'Celebrate your great mood with Lizzo\'s empowering anthem of self-love.' },
    { title: 'Uptown Funk', artist: 'Bruno Mars', youtubeId: 'OPf0YbXqDm0', reason: 'Keep the good times rolling with this irresistible funk groove.' },
    { title: 'Shake It Off', artist: 'Taylor Swift', youtubeId: 'nfWlot6h_JM', reason: 'Match your happy energy with Taylor\'s carefree, dance-it-out anthem.' },
    { title: 'Can\'t Stop the Feeling!', artist: 'Justin Timberlake', youtubeId: 'ru0K8uYEZWw', reason: 'Pure sunshine in song form to keep your happiness going all day.' }
  ]
};

app.get('/api/lookup', async (req, res) => {
  const city = req.query.city;
  const mood = req.query.mood;
  if (!city) {
    return res.status(400).json({ error: 'City is required.' });
  }

  try {
    // 1. Geocode city
    const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`;
    const geoRes = await fetch(geoUrl, {
      headers: { 'User-Agent': 'WorldClockGreetingApp/1.0' }
    });
    const geoData = await geoRes.json();

    if (!geoData.length) {
      return res.status(404).json({ error: `Could not find a city named "${city}".` });
    }

    const { lat, lon, display_name } = geoData[0];

    // 2. Get timezone, weather, and news in parallel (each independent)
    const overpassQuery = `[out:json][timeout:10];node["amenity"="restaurant"](around:1000,${lat},${lon});out 8;`;
    const [timeRes, weatherRes, aqiRes, newsRes, restaurantRes] = await Promise.all([
      safeFetch(`https://timeapi.io/api/time/current/coordinate?latitude=${lat}&longitude=${lon}`),
      safeFetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&temperature_unit=fahrenheit&wind_speed_unit=mph`),
      safeFetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10`),
      safeFetch(`https://news.google.com/rss/search?q=${encodeURIComponent(city)}&hl=en-US&gl=US&ceid=US:en`, {
        headers: { 'User-Agent': 'WorldClockGreetingApp/1.0' }
      }),
      safeFetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(overpassQuery)}`
      })
    ]);

    // Timezone — try API, fall back to letting the client figure it out
    let timeZone = null;
    if (timeRes && timeRes.ok) {
      const timeData = await timeRes.json();
      timeZone = timeData.timeZone;
    }

    let weather = null;
    if (weatherRes && weatherRes.ok) {
      const wd = await weatherRes.json();
      weather = wd.current;
    }

    let airQuality = null;
    if (aqiRes && aqiRes.ok) {
      const aq = await aqiRes.json();
      airQuality = aq.current;
    }

    let news = [];
    if (newsRes && newsRes.ok) {
      const rssXml = await newsRes.text();
      news = parseRssItems(rssXml, 5);
    }

    let restaurants = [];
    if (restaurantRes && restaurantRes.ok) {
      const rd = await restaurantRes.json();
      restaurants = (rd.elements || [])
        .filter(e => e.tags && e.tags.name)
        .map(e => ({
          name: e.tags.name,
          cuisine: e.tags.cuisine || null,
          lat: e.lat,
          lon: e.lon
        }));
    }

    // Pick a song based on mood
    let song = null;
    if (mood && SONG_POOL[mood]) {
      const pool = SONG_POOL[mood];
      song = pool[Math.floor(Math.random() * pool.length)];
    }

    res.json({
      displayName: display_name,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      timeZone,
      weather,
      airQuality,
      news,
      restaurants,
      song
    });
  } catch (err) {
    console.error('Lookup error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
