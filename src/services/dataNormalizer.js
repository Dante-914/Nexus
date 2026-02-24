/**
 * Data Normalization System
 * Normalizes data from different sources into a unified format
 */

// Source configurations
const SOURCE_CONFIGS = {
  guardian: {
    name: 'The Guardian',
    baseUrl: 'https://content.guardianapis.com',
    transformer: normalizeGuardianArticle,
    idPrefix: 'guardian-'
  },
  newsapi: {
    name: 'NewsAPI',
    baseUrl: 'https://newsapi.org/v2',
    transformer: normalizeNewsAPIArticle,
    idPrefix: 'newsapi-'
  }
};

/**
 * Unified Article Schema
 * {
 *   id: string (unique identifier)
 *   title: string
 *   description: string
 *   content: string
 *   url: string
 *   imageUrl: string (optional)
 *   source: {
 *     id: string (guardian|newsapi)
 *     name: string
 *   }
 *   author: string (optional)
 *   publishedAt: string (ISO date)
 *   categories: string[]
 *   tags: string[]
 *   normalized: {
 *     readingTime: number (minutes)
 *     sentiment: number (-1 to 1)
 *     keywords: string[]
 *   }
 * }
 */

// Guardian API Normalizer
function normalizeGuardianArticle(article, index = 0) {
  try {
    // Extract fields from Guardian's structure
    const fields = article.fields || {};
    const tags = article.tags || [];
    
    // Extract author from tags
    const authorTag = tags.find(tag => tag.type === 'contributor');
    const author = authorTag ? authorTag.webTitle : null;
    
    // Generate a stable ID
    const id = `guardian-${article.id || `${Date.now()}-${index}`}`;
    
    // Calculate reading time (rough estimate)
    const content = fields.trailText || article.webTitle || '';
    const readingTime = Math.max(1, Math.ceil(content.split(' ').length / 200));
    
    // Extract categories/sections
    const categories = [article.sectionName || 'General'].filter(Boolean);
    
    // Extract keywords from title
    const keywords = extractKeywords(article.webTitle || '');
    
    return {
      id,
      title: article.webTitle || 'Untitled',
      description: fields.trailText || fields.headline || '',
      content: fields.body || fields.trailText || '',
      url: article.webUrl || '#',
      imageUrl: fields.thumbnail || null,
      source: {
        id: 'guardian',
        name: 'The Guardian'
      },
      author,
      publishedAt: article.webPublicationDate || new Date().toISOString(),
      categories,
      tags: tags.map(tag => tag.webTitle).filter(Boolean),
      normalized: {
        readingTime,
        sentiment: 0, // To be calculated later
        keywords
      }
    };
  } catch (error) {
    console.error('Error normalizing Guardian article:', error);
    return createFallbackArticle('guardian', index);
  }
}

// NewsAPI Normalizer
function normalizeNewsAPIArticle(article, index = 0) {
  try {
    // Generate a stable ID
    const id = `newsapi-${article.url ? Buffer.from(article.url).toString('base64').slice(0, 20) : `${Date.now()}-${index}`}`;
    
    // Calculate reading time
    const content = article.content || article.description || article.title || '';
    const readingTime = Math.max(1, Math.ceil(content.split(' ').length / 200));
    
    // Extract keywords from title and description
    const keywords = extractKeywords(`${article.title || ''} ${article.description || ''}`);
    
    // Determine categories (NewsAPI doesn't provide categories in everything endpoint)
    const categories = ['General'];
    
    return {
      id,
      title: article.title || 'Untitled',
      description: article.description || '',
      content: article.content || article.description || '',
      url: article.url || '#',
      imageUrl: article.urlToImage || null,
      source: {
        id: 'newsapi',
        name: article.source?.name || 'NewsAPI'
      },
      author: article.author || null,
      publishedAt: article.publishedAt || new Date().toISOString(),
      categories,
      tags: [],
      normalized: {
        readingTime,
        sentiment: 0,
        keywords
      }
    };
  } catch (error) {
    console.error('Error normalizing NewsAPI article:', error);
    return createFallbackArticle('newsapi', index);
  }
}

// Create fallback article if normalization fails
function createFallbackArticle(sourceId, index) {
  return {
    id: `${sourceId}-fallback-${Date.now()}-${index}`,
    title: 'Article Unavailable',
    description: 'Unable to load article content',
    content: '',
    url: '#',
    imageUrl: null,
    source: {
      id: sourceId,
      name: SOURCE_CONFIGS[sourceId]?.name || sourceId
    },
    author: null,
    publishedAt: new Date().toISOString(),
    categories: ['General'],
    tags: [],
    normalized: {
      readingTime: 1,
      sentiment: 0,
      keywords: []
    }
  };
}

// Extract keywords from text
function extractKeywords(text) {
  if (!text) return [];
  
  // Simple keyword extraction (can be enhanced with NLP later)
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
  
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 10);
}

// Calculate sentiment (basic implementation)
function calculateSentiment(text) {
  if (!text) return 0;
  
  // Very basic sentiment word lists (can be enhanced)
  const positiveWords = new Set(['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'brilliant', 'success', 'win', 'happy', 'love', 'best']);
  const negativeWords = new Set(['bad', 'terrible', 'awful', 'horrible', 'worst', 'failure', 'lose', 'sad', 'hate', 'angry', 'crisis', 'war', 'death']);
  
  const words = text.toLowerCase().split(/\s+/);
  let score = 0;
  
  words.forEach(word => {
    if (positiveWords.has(word)) score += 0.1;
    if (negativeWords.has(word)) score -= 0.1;
  });
  
  return Math.max(-1, Math.min(1, score));
}

// Batch normalize articles
export function normalizeArticles(articles, sourceId) {
  if (!Array.isArray(articles)) return [];
  
  const config = SOURCE_CONFIGS[sourceId];
  if (!config) {
    console.warn(`Unknown source: ${sourceId}`);
    return articles.map((a, i) => createFallbackArticle('unknown', i));
  }
  
  return articles
    .map((article, index) => {
      try {
        const normalized = config.transformer(article, index);
        
        // Add sentiment if we have content
        if (normalized.content || normalized.description) {
          normalized.normalized.sentiment = calculateSentiment(
            normalized.content || normalized.description
          );
        }
        
        return normalized;
      } catch (error) {
        console.error(`Error normalizing article from ${sourceId}:`, error);
        return createFallbackArticle(sourceId, index);
      }
    })
    .filter(Boolean); // Remove any null/undefined articles
}

// Normalize a single article
export function normalizeArticle(article, sourceId) {
  const normalized = normalizeArticles([article], sourceId);
  return normalized[0] || createFallbackArticle(sourceId, 0);
}

// Merge and deduplicate articles from multiple sources
export function mergeAndDeduplicateArticles(articlesArray) {
  const seen = new Set();
  const merged = [];
  
  // Flatten array of arrays
  const allArticles = articlesArray.flat();
  
  for (const article of allArticles) {
    // Use URL as unique identifier (fallback to title + source)
    const key = article.url !== '#' ? article.url : `${article.title}-${article.source.id}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(article);
    }
  }
  
  // Sort by date (newest first)
  return merged.sort((a, b) => 
    new Date(b.publishedAt) - new Date(a.publishedAt)
  );
}

// Group articles by category
export function groupByCategory(articles) {
  const grouped = {};
  
  articles.forEach(article => {
    const categories = article.categories || ['General'];
    categories.forEach(category => {
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(article);
    });
  });
  
  return grouped;
}

// Extract trending topics from articles
export function extractTrendingTopics(articles, limit = 10) {
  const keywordCount = {};
  
  articles.forEach(article => {
    (article.normalized?.keywords || []).forEach(keyword => {
      keywordCount[keyword] = (keywordCount[keyword] || 0) + 1;
    });
  });
  
  return Object.entries(keywordCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([keyword]) => keyword);
}

// Calculate article quality score (0-100)
export function calculateQualityScore(article) {
  let score = 50; // Base score
  
  // Bonus for having images
  if (article.imageUrl) score += 10;
  
  // Bonus for having author
  if (article.author) score += 10;
  
  // Bonus for longer content
  const contentLength = (article.content || '').length;
  if (contentLength > 500) score += 15;
  else if (contentLength > 200) score += 10;
  else if (contentLength > 50) score += 5;
  
  // Bonus for having categories/tags
  if (article.categories?.length > 1) score += 5;
  if (article.tags?.length > 2) score += 5;
  
  // Sentiment bonus (avoid extremely negative/positive? keep neutral)
  const sentiment = article.normalized?.sentiment || 0;
  if (Math.abs(sentiment) < 0.3) score += 5; // Neutral is often better for news
  
  return Math.min(100, Math.max(0, score));
}

// Format article for different views
export function formatArticleForView(article, viewType = 'card') {
  switch (viewType) {
    case 'card':
      return {
        ...article,
        displayTitle: article.title.length > 60 ? article.title.slice(0, 57) + '...' : article.title,
        displayDescription: article.description?.length > 120 ? article.description.slice(0, 117) + '...' : article.description,
        timeAgo: getTimeAgo(article.publishedAt),
        qualityScore: calculateQualityScore(article)
      };
      
    case 'detailed':
      return {
        ...article,
        timeAgo: getTimeAgo(article.publishedAt),
        readingTime: `${article.normalized?.readingTime || 1} min read`,
        qualityScore: calculateQualityScore(article)
      };
      
    case 'minimal':
      return {
        id: article.id,
        title: article.title,
        source: article.source.name,
        timeAgo: getTimeAgo(article.publishedAt),
        url: article.url
      };
      
    default:
      return article;
  }
}

// Helper: Get time ago string
function getTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

// Validate article schema
export function validateArticle(article) {
  const required = ['id', 'title', 'url', 'source', 'publishedAt'];
  const missing = required.filter(field => !article[field]);
  
  if (missing.length > 0) {
    console.warn(`Article missing required fields: ${missing.join(', ')}`);
    return false;
  }
  
  return true;
}

// Clean and sanitize article data
export function sanitizeArticle(article) {
  return {
    ...article,
    title: article.title?.replace(/[<>]/g, '') || 'Untitled',
    description: article.description?.replace(/[<>]/g, '') || '',
    content: article.content?.replace(/[<>]/g, '') || '',
    url: article.url?.replace(/[<>]/g, '') || '#',
    imageUrl: article.imageUrl?.replace(/[<>]/g, '') || null,
    author: article.author?.replace(/[<>]/g, '') || null
  };
}

// Export source configs
export const SOURCES = SOURCE_CONFIGS;