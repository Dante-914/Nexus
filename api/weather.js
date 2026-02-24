import axios from 'axios';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { lat, lon, q } = req.query;
  
  try {
    let weatherRes;
    
    if (lat && lon) {
      weatherRes = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
        params: {
          lat,
          lon,
          appid: process.env.VITE_WEATHER_API_KEY,
          units: 'metric'
        }
      });
    } else {
      weatherRes = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
        params: {
          q: q || 'London',
          appid: process.env.VITE_WEATHER_API_KEY,
          units: 'metric'
        }
      });
    }
    
    res.status(200).json(weatherRes.data);
  } catch (error) {
    console.error('Weather API Error:', error);
    res.status(500).json({ error: 'Failed to fetch weather' });
  }
}