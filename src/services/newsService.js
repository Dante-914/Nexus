import axios from 'axios';

// API Keys from environment variables
const GUARDIAN_API_KEY = import.meta.env.VITE_GUARDIAN_API_KEY;
const NEWS_API_KEY = import.meta.env.VITE_NEWS_API_KEY;

// Base URLs
const GUARDIAN_BASE_URL = 'https://content.guardianapis.com';
const NEWS_API_BASE_URL = 'https://newsapi.org/v2';

// Cache object
const cache = new Map();

// Fetch from Guardian API
export const fetchFromGuardian = async (params = {}) => {
  try {
    const cacheKey = `guardian-${JSON.stringify(params)}`;
    
    // Check cache first (5 minutes)
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.data;
      }
    }

    const response = await axios.get(`${GUARDIAN_BASE_URL}/search`, {
      params: {
        'api-key': GUARDIAN_API_KEY,
        'show-fields': 'thumbnail,trailText,headline',
        'show-tags': 'contributor',
        'page-size': 10,
        ...params
      }
    });

    const data = response.data.response;
    
    // Cache the response
    cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    return data;
  } catch (error) {
    console.error('Guardian API Error:', error);
    throw error;
  }
};

// Fetch from NewsAPI
export const fetchFromNewsAPI = async (params = {}) => {
  try {
    const cacheKey = `newsapi-${JSON.stringify(params)}`;
    
    // Check cache first (5 minutes)
    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
        return cached.data;
      }
    }

    const endpoint = params.q ? '/everything' : '/top-headlines';
    
    const response = await axios.get(`${NEWS_API_BASE_URL}${endpoint}`, {
      params: {
        apiKey: NEWS_API_KEY,
        country: 'us',
        pageSize: 10,
        ...params
      }
    });

    const data = response.data;
    
    // Cache the response
    cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    return data;
  } catch (error) {
    console.error('NewsAPI Error:', error);
    throw error;
  }
};

// Combined fetch from both sources
export const fetchAllNews = async (searchTerm = '', page = 1, category = 'general') => {
  try {
    const [guardianData, newsAPIData] = await Promise.allSettled([
      fetchFromGuardian({ q: searchTerm || undefined, page }),
      fetchFromNewsAPI({ q: searchTerm || 'latest', page, 
        category: category !== 'general' ? category : undefined
       })
    ]);

    const articles = [];

    // Process Guardian articles
    if (guardianData.status === 'fulfilled' && guardianData.value.results) {
      const guardianArticles = guardianData.value.results.map(article => ({
        id: article.id,
        title: article.webTitle,
        description: article.fields?.trailText || '',
        content: article.fields?.trailText,
        url: article.webUrl,
        imageUrl: article.fields?.thumbnail,
        
        publishedAt: article.webPublicationDate,
        category: article.sectionName
      }));
      articles.push(...guardianArticles);
    }

    // Process NewsAPI articles
    if (newsAPIData.status === 'fulfilled' && newsAPIData.value.articles) {
      const newsAPIArticles = newsAPIData.value.articles.map(article => ({
        id: article.url,
        title: article.title,
        description: article.description,
        content: article.content,
        url: article.url,
        imageUrl: article.urlToImage,
        
        publishedAt: article.publishedAt,
        author: article.author
      }));
      articles.push(...newsAPIArticles);
    }

    // Sort by date (newest first)
    articles.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    return {
      articles,
      totalResults: articles.length,
      currentPage: page
    };
  } catch (error) {
    console.error('Error fetching news:', error);
    throw error;
  }
};

// Fetch trending topics
export const fetchTrendingTopics = async () => {
  try {
    // Get top headlines to extract trending topics
    const data = await fetchFromNewsAPI({ 
      country: 'us', 
      pageSize: 20 
    });

    // Extract keywords from titles (simplified)
    const topics = data.articles
      .map(article => {
        const words = article.title.split(' ').slice(0, 3).join(' ');
        return words.length > 30 ? words.substring(0, 30) + '...' : words;
      })
      .filter((topic, index, self) => self.indexOf(topic) === index) // Remove duplicates
      .slice(0, 10);

    return topics;
  } catch (error) {
    console.error('Error fetching trending topics:', error);
    return [];
  }
};