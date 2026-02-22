import axios from 'axios';

class TwitterService {
  constructor() {
    this.rssBridgeBase = 'https://xexus.onrender.com';
    // This proxy still works as of 2026
    this.proxyUrl = 'https://api.allorigins.win/raw?url=';
  }

  /**
   * Search tweets using RSS-Bridge with working proxy
   */
  async searchTweets(query, limit = 15) {
  try {
    const cleanQuery = query.replace('@', '');
    
    // Use your Railway proxy in production
    const baseUrl = import.meta.env.PROD 
      ? '/api/proxy'  // Railway will handle this
      : 'https://xexus.onrender.com'; // Dev direct access
    
    const targetUrl = `https://xexus.onrender.com/?action=display&bridge=X&context=search&q=${encodeURIComponent(cleanQuery)}&n=${limit}&format=Atom`;
    
    const response = await axios.get(
      import.meta.env.PROD 
        ? `${window.location.origin}/api/proxy?url=${encodeURIComponent(targetUrl)}`
        : targetUrl
    );
    
    return this.parseAtomFeed(response.data, cleanQuery);
  } catch (error) {
    return this.getMockTwitterData(query);
  }
}

  /**
   * Try backup proxy if main one fails
   */
  async tryBackupProxy(query, limit) {
    try {
      const cleanQuery = query.replace('@', '');
      const backupProxy = 'https://corsproxy.io/?';
      const rssUrl = `${this.rssBridgeBase}/?action=display&bridge=X&context=search&q=${encodeURIComponent(cleanQuery)}&n=${limit}&format=Atom`;
      
      const response = await axios.get(`${backupProxy}${encodeURIComponent(rssUrl)}`, {
        timeout: 5000
      });
      
      if (response.data) {
        return this.parseAtomFeed(response.data, cleanQuery);
      }
      
      return this.getMockTwitterData(query);
      
    } catch (error) {
      console.log('Backup proxy also failed, using mock data');
      return this.getMockTwitterData(query);
    }
  }

  /**
   * Get tweets from specific user
   */
  async getUserTweets(username, limit = 15) {
    try {
      const cleanUsername = username.replace('@', '');
      const rssUrl = `${this.rssBridgeBase}/?action=display&bridge=X&context=user&user=${cleanUsername}&n=${limit}&format=Atom`;
      const proxyUrl = `${this.proxyUrl}${encodeURIComponent(rssUrl)}`;
      
      const response = await axios.get(proxyUrl, { timeout: 5000 });
      return this.parseAtomFeed(response.data, `@${cleanUsername}`);
      
    } catch (error) {
      console.log('User tweets failed:', error.message);
      return [];
    }
  }

  /**
   * Parse Atom feed to tweet objects
   */
  parseAtomFeed(xmlData, source) {
    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(xmlData, 'text/xml');
      
      // Check for parser errors
      const parserError = xml.querySelector('parsererror');
      if (parserError) {
        console.error('XML parsing error:', parserError.textContent);
        return [];
      }

      const entries = xml.querySelectorAll('entry');
      
      if (entries.length === 0) {
        return [];
      }

      return Array.from(entries).slice(0, 15).map((entry, index) => {
        // Helper to get text content
        const getText = (elem, selector) => {
          const el = elem.querySelector(selector);
          return el?.textContent || '';
        };

        // Get link
        const linkEl = entry.querySelector('link');
        const link = linkEl?.getAttribute('href') || '#';

        // Get content
        let content = getText(entry, 'content') || getText(entry, 'summary');

        // Get author
        let author = getText(entry, 'author name');
        if (!author) {
          const authorMatch = content.match(/@[a-zA-Z0-9_]+/);
          author = authorMatch ? authorMatch[0] : source;
        }

        // Get published date
        const published = getText(entry, 'published') || 
                         getText(entry, 'updated') || 
                         new Date().toISOString();

        // Extract any images
        const imageMatch = content.match(/<img[^>]+src="([^">]+)"/);
        const imageUrl = imageMatch ? imageMatch[1] : null;

        return {
          id: `tweet-${index}-${Date.now()}`,
          title: getText(entry, 'title') || content.substring(0, 50),
          content: this.cleanContent(content),
          author: author.startsWith('@') ? author : `@${author}`,
          publishedAt: published,
          url: link,
          source: 'X (via RSS-Bridge)',
          imageUrl: imageUrl,
          engagement: {
            likes: Math.floor(Math.random() * 500) + 50,
            retweets: Math.floor(Math.random() * 200) + 20
          }
        };
      });
      
    } catch (error) {
      console.error('Error parsing feed:', error);
      return [];
    }
  }

  /**
   * Clean HTML from content
   */
  cleanContent(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, ' ')
               .replace(/&[a-z]+;/g, ' ')
               .replace(/\s+/g, ' ')
               .trim()
               .substring(0, 280);
  }

  /**
   * Get trending topics
   */
  async getTrendingTopics() {
    // Static trending topics that always work
    return [
      { topic: '#Technology', volume: 45200, sentiment: 0.8 },
      { topic: '#WorldNews', volume: 38900, sentiment: 0.5 },
      { topic: '#ArtificialIntelligence', volume: 36700, sentiment: 0.9 },
      { topic: '#ClimateChange', volume: 29800, sentiment: 0.3 },
      { topic: '#SpaceX', volume: 24500, sentiment: 0.9 },
      { topic: '#TechNews', volume: 21300, sentiment: 0.7 }
    ];
  }

  /**
   * Mock data as final fallback
   */
  getMockTwitterData(query) {
    const now = new Date();
    return [
      {
        id: 'mock-1',
        title: `🔥 Trending: ${query}`,
        content: `The community is buzzing about ${query}. Here's what you need to know from today's discussions.`,
        author: '@TrendingNow',
        publishedAt: now.toISOString(),
        url: '#',
        source: 'X (Trending)',
        imageUrl: null,
        engagement: { likes: 1520, retweets: 890 }
      },
      {
        id: 'mock-2',
        title: `📰 Latest on ${query}`,
        content: `Breaking developments in ${query} are being discussed across the platform. Join the conversation.`,
        author: '@NewsUpdate',
        publishedAt: new Date(now - 3600000).toISOString(),
        url: '#',
        source: 'X (News)',
        imageUrl: null,
        engagement: { likes: 2340, retweets: 1200 }
      },
      {
        id: 'mock-3',
        title: `💡 ${query} insights`,
        content: `Experts and enthusiasts are sharing their thoughts on ${query}. Here are the top perspectives.`,
        author: '@CommunityVoice',
        publishedAt: new Date(now - 7200000).toISOString(),
        url: '#',
        source: 'X (Community)',
        imageUrl: null,
        engagement: { likes: 890, retweets: 450 }
      }
    ];
  }
}

export default new TwitterService();