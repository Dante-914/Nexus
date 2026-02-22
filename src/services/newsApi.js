import axios from 'axios';

const NEWS_API_KEY = import.meta.env.VITE_NEWS_API_KEY;
const GUARDIAN_API_KEY = import.meta.env.VITE_GUARDIAN_API_KEY;
const WEATHER_API_KEY = import.meta.env.VITE_WEATHER_API_KEY;

class NewsService {
  constructor() {
    this.newsApiBase = 'https://newsapi.org/v2';
    this.guardianBase = 'https://content.guardianapis.com';
    this.weatherBase = 'https://api.openweathermap.org/data/2.5';
  }

  // Fetch top headlines with pagination [citation:2]
  async getTopHeadlines(country = 'us', category = 'general', page = 1, pageSize = 20) {
  try {
    // Check if API key exists
    if (!import.meta.env.VITE_NEWS_API_KEY) {
      console.warn('NewsAPI key missing, using mock data');
      return this.getMockHeadlines(category);
    }
    
    const response = await axios.get(`${this.newsApiBase}/top-headlines`, {
      params: {
        country,
        category,
        page,
        pageSize,
        apiKey: import.meta.env.VITE_NEWS_API_KEY
      },
      timeout: 5000
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching headlines:', error);
    // Return mock data as fallback
    return {
      articles: this.getMockHeadlines(category),
      totalResults: 3
    };
  }
}

// Add mock data method
getMockHeadlines(category) {
  return [
    {
      title: `Latest ${category} news`,
      description: 'Stay tuned for updates...',
      url: '#',
      source: { name: 'News Service' },
      publishedAt: new Date().toISOString()
    }
  ];
}

  // Search everything with filters
  async searchNews(query, filters = {}, page = 1) {
    try {
      const response = await axios.get(`${this.newsApiBase}/everything`, {
        params: {
          q: query,
          page,
          pageSize: 20,
          sortBy: filters.sortBy || 'publishedAt',
          from: filters.fromDate,
          to: filters.toDate,
          sources: filters.sources,
          domains: filters.domains,
          apiKey: NEWS_API_KEY
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error searching news:', error);
      throw error;
    }
  }

  // Fetch from Guardian API [citation:1]
  async getGuardianNews(section = 'all', page = 1) {
    try {
      const response = await axios.get(`${this.guardianBase}/search`, {
        params: {
          'api-key': GUARDIAN_API_KEY,
          section: section !== 'all' ? section : undefined,
          page,
          'page-size': 20,
          'show-fields': 'headline,thumbnail,trailText,byline,bodyText',
          'show-tags': 'contributor',
          'order-by': 'newest'
        }
      });
      return response.data.response;
    } catch (error) {
      console.error('Error fetching Guardian news:', error);
      throw error;
    }
  }

  // Get long-read articles [citation:1]
  async getLongReads(page = 1) {
    try {
      const response = await axios.get(`${this.guardianBase}/search`, {
        params: {
          'api-key': GUARDIAN_API_KEY,
          tag: 'tone/minutebyminute',
          page,
          'page-size': 10,
          'show-fields': 'headline,thumbnail,trailText,byline,bodyText',
          'order-by': 'relevance'
        }
      });
      return response.data.response;
    } catch (error) {
      console.error('Error fetching long reads:', error);
      throw error;
    }
  }

  // Get weather updates [citation:4]
  async getWeather(city = 'London') {
    try {
      const response = await axios.get(`${this.weatherBase}/weather`, {
        params: {
          q: city,
          appid: WEATHER_API_KEY,
          units: 'metric'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching weather:', error);
      throw error;
    }
  }

  // Get weather forecast
  async getWeatherForecast(city = 'London', days = 5) {
    try {
      const response = await axios.get(`${this.weatherBase}/forecast`, {
        params: {
          q: city,
          appid: WEATHER_API_KEY,
          units: 'metric',
          cnt: days * 8 // 3-hour intervals
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching forecast:', error);
      throw error;
    }
  }

  // Fetch related articles for deep dive [citation:1]
  async getRelatedArticles(articleId) {
    try {
      const response = await axios.get(`${this.guardianBase}/search`, {
        params: {
          'api-key': GUARDIAN_API_KEY,
          'reference': articleId,
          'page-size': 5,
          'show-fields': 'headline,thumbnail,trailText'
        }
      });
      return response.data.response;
    } catch (error) {
      console.error('Error fetching related articles:', error);
      throw error;
    }
  }

  // Get topic trends over time [citation:1]
  async getTopicTrends(topic, fromDate, toDate) {
    try {
      const response = await axios.get(`${this.guardianBase}/search`, {
        params: {
          'api-key': GUARDIAN_API_KEY,
          q: topic,
          'from-date': fromDate,
          'to-date': toDate,
          'page-size': 100,
          'show-fields': 'headline'
        }
      });
      
      // Group by month for trend analysis
      const articles = response.data.response.results;
      const trends = this.aggregateByMonth(articles);
      return trends;
    } catch (error) {
      console.error('Error fetching trends:', error);
      throw error;
    }
  }

  // Helper: Aggregate articles by month
  aggregateByMonth(articles) {
    const monthly = {};
    articles.forEach(article => {
      const date = new Date(article.webPublicationDate);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      monthly[monthKey] = (monthly[monthKey] || 0) + 1;
    });
    return Object.entries(monthly).map(([month, count]) => ({ month, count }));
  }

  // Get sources list
  async getSources() {
    try {
      const response = await axios.get(`${this.newsApiBase}/sources`, {
        params: {
          apiKey: NEWS_API_KEY,
          language: 'en'
        }
      });
      return response.data.sources;
    } catch (error) {
      console.error('Error fetching sources:', error);
      throw error;
    }
  }
}

export default new NewsService();