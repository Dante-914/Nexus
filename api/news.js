import axios from 'axios';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { sources = 'all', q, page = 1, pageSize = 20 } = req.query;
  
  try {
    let articles = [];
    let totalResults = 0;

    // Fetch from The Guardian
    if (sources === 'all' || sources === 'guardian') {
      const guardianRes = await axios.get('https://content.guardianapis.com/search', {
        params: {
          'api-key': process.env.VITE_GUARDIAN_API_KEY,
          q: q || undefined,
          page,
          'page-size': pageSize,
          'show-fields': 'thumbnail,trailText',
          'show-tags': 'contributor'
        }
      });

      const guardianArticles = guardianRes.data.response.results.map(article => ({
        title: article.webTitle,
        description: article.fields?.trailText || '',
        url: article.webUrl,
        urlToImage: article.fields?.thumbnail,
        publishedAt: article.webPublicationDate,
        source: { name: 'The Guardian', id: 'guardian' },
        content: article.fields?.trailText
      }));

      articles = [...articles, ...guardianArticles];
      totalResults += guardianRes.data.response.total;
    }

    // Fetch from NewsAPI
    if (sources === 'all' || sources === 'newsapi') {
      const newsApiRes = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          apiKey: process.env.VITE_NEWS_API_KEY,
          q: q || 'latest',
          page,
          pageSize,
          language: 'en',
          sortBy: 'publishedAt'
        }
      });

      const newsApiArticles = newsApiRes.data.articles.map(article => ({
        ...article,
        source: { name: article.source.name, id: 'newsapi' }
      }));

      articles = [...articles, ...newsApiArticles];
      totalResults += newsApiRes.data.totalResults;
    }

    // Sort by date
    articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    res.status(200).json({
      articles,
      totalResults,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
  } catch (error) {
    console.error('News API Error:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
}