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

app.get('/api/lookup', async (req, res) => {
  const city = req.query.city;
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
    const [timeRes, weatherRes, newsRes] = await Promise.all([
      safeFetch(`https://timeapi.io/api/time/current/coordinate?latitude=${lat}&longitude=${lon}`),
      safeFetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&temperature_unit=fahrenheit&wind_speed_unit=mph`),
      safeFetch(`https://news.google.com/rss/search?q=${encodeURIComponent(city)}&hl=en-US&gl=US&ceid=US:en`, {
        headers: { 'User-Agent': 'WorldClockGreetingApp/1.0' }
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

    let news = [];
    if (newsRes && newsRes.ok) {
      const rssXml = await newsRes.text();
      news = parseRssItems(rssXml, 5);
    }

    res.json({
      displayName: display_name,
      lat: parseFloat(lat),
      lon: parseFloat(lon),
      timeZone,
      weather,
      news
    });
  } catch (err) {
    console.error('Lookup error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
