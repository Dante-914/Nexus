import axios from 'axios';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  try {
    // Get trending topics from NewsAPI
    const newsRes = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: {
        apiKey: process.env.VITE_NEWS_API_KEY,
        country: 'us',
        pageSize: 10
      }
    });

    // Extract keywords from titles
    const topics = newsRes.data.articles
      .map(article => article.title.split(' ').slice(0, 3).join(' '))
      .slice(0, 10);

    res.status(200).json({ topics });
  } catch (error) {
    console.error('Trending API Error:', error);
    res.status(500).json({ error: 'Failed to fetch trending topics' });
  }
}