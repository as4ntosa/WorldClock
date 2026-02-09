const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

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

    // 2. Get timezone and weather in parallel
    const [timeRes, weatherRes] = await Promise.all([
      fetch(`https://timeapi.io/api/time/current/coordinate?latitude=${lat}&longitude=${lon}`),
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&temperature_unit=fahrenheit&wind_speed_unit=mph`)
    ]);

    if (!timeRes.ok) {
      return res.status(502).json({ error: 'Could not fetch time data.' });
    }
    const timeData = await timeRes.json();

    let weather = null;
    if (weatherRes.ok) {
      const wd = await weatherRes.json();
      weather = wd.current;
    }

    res.json({
      displayName: display_name,
      timeZone: timeData.timeZone,
      weather
    });
  } catch (err) {
    console.error('Lookup error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
