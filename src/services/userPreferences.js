import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

class UserPreferencesService {
  constructor() {
    this.categories = [
      'general', 'business', 'technology', 'entertainment', 
      'health', 'science', 'sports', 'politics', 'world'
    ];
    
    this.interactionWeights = {
      click: 1,
      read: 3,
      share: 5,
      bookmark: 4,
      comment: 2,
      timeSpent: 0.1 // per minute
    };
  }

  // Get user preferences
  async getUserPreferences(userId) {
    try {
      const prefDoc = await getDoc(doc(db, 'userPreferences', userId));
      if (prefDoc.exists()) {
        return prefDoc.data();
      } else {
        // Initialize default preferences
        const defaultPrefs = {
          userId,
          followedTopics: [],
          followedSources: [],
          readHistory: [],
          interests: {},
          bookmarks: [],
          readingTime: 0,
          lastUpdated: new Date().toISOString()
        };
        await setDoc(doc(db, 'userPreferences', userId), defaultPrefs);
        return defaultPrefs;
      }
    } catch (error) {
      console.error('Error getting preferences:', error);
      throw error;
    }
  }

  // Follow a topic
  async followTopic(userId, topic) {
    try {
      await updateDoc(doc(db, 'userPreferences', userId), {
        followedTopics: arrayUnion(topic),
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error following topic:', error);
      throw error;
    }
  }

  // Unfollow a topic
  async unfollowTopic(userId, topic) {
    try {
      await updateDoc(doc(db, 'userPreferences', userId), {
        followedTopics: arrayRemove(topic),
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error unfollowing topic:', error);
      throw error;
    }
  }

  // Track article interaction
  async trackInteraction(userId, articleId, interactionType, duration = 0) {
    try {
      const prefDoc = await getDoc(doc(db, 'userPreferences', userId));
      const prefs = prefDoc.data();
      
      const weight = this.interactionWeights[interactionType] || 1;
      const timeWeight = duration * this.interactionWeights.timeSpent;
      
      // Update article-specific stats
      const articleStats = prefs.articleStats || {};
      if (!articleStats[articleId]) {
        articleStats[articleId] = {
          interactions: {},
          totalWeight: 0,
          lastRead: null
        };
      }
      
      articleStats[articleId].interactions[interactionType] = 
        (articleStats[articleId].interactions[interactionType] || 0) + 1;
      articleStats[articleId].totalWeight += weight + timeWeight;
      articleStats[articleId].lastRead = new Date().toISOString();
      
      // Update category interests based on article metadata
      // This would need article category info passed in
      
      await updateDoc(doc(db, 'userPreferences', userId), {
        articleStats,
        readingTime: (prefs.readingTime || 0) + duration,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error tracking interaction:', error);
    }
  }

  // Get personalized recommendations
  async getRecommendations(userId, availableArticles) {
    try {
      const prefs = await this.getUserPreferences(userId);
      
      // Calculate interest scores for each article
      const scoredArticles = availableArticles.map(article => {
        let score = 0;
        
        // Boost from followed topics
        if (prefs.followedTopics) {
          prefs.followedTopics.forEach(topic => {
            if (article.title?.toLowerCase().includes(topic.toLowerCase()) ||
                article.description?.toLowerCase().includes(topic.toLowerCase())) {
              score += 10;
            }
          });
        }
        
        // Boost from followed sources
        if (prefs.followedSources?.includes(article.source?.id)) {
          score += 5;
        }
        
        // Boost from category preferences
        if (prefs.interests && prefs.interests[article.category]) {
          score += prefs.interests[article.category] * 2;
        }
        
        // Recency boost
        const articleDate = new Date(article.publishedAt);
        const daysAgo = (Date.now() - articleDate) / (1000 * 60 * 60 * 24);
        score += Math.max(0, 10 - daysAgo);
        
        return { ...article, recommendationScore: score };
      });
      
      // Sort by score and return top articles
      return scoredArticles
        .sort((a, b) => b.recommendationScore - a.recommendationScore)
        .filter(article => article.recommendationScore > 0);
    } catch (error) {
      console.error('Error getting recommendations:', error);
      return availableArticles;
    }
  }

  // Get "For You" personalized feed
  async getForYouFeed(userId, page = 1) {
    try {
      const prefs = await this.getUserPreferences(userId);
      
      // Build query based on preferences
      const topics = prefs.followedTopics || [];
      const sources = prefs.followedSources || [];
      
      // This would call your news API with personalized parameters
      const response = await fetch('/api/news/personalized', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topics,
          sources,
          page,
          interests: prefs.interests
        })
      });
      
      return response.json();
    } catch (error) {
      console.error('Error getting for you feed:', error);
      throw error;
    }
  }

  // Save bookmark
  async addBookmark(userId, article) {
    try {
      await updateDoc(doc(db, 'userPreferences', userId), {
        bookmarks: arrayUnion({
          id: article.id,
          title: article.title,
          url: article.url,
          savedAt: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Error adding bookmark:', error);
      throw error;
    }
  }

  // Remove bookmark
  async removeBookmark(userId, articleId) {
    try {
      const prefs = await this.getUserPreferences(userId);
      const updatedBookmarks = prefs.bookmarks.filter(b => b.id !== articleId);
      
      await updateDoc(doc(db, 'userPreferences', userId), {
        bookmarks: updatedBookmarks
      });
    } catch (error) {
      console.error('Error removing bookmark:', error);
      throw error;
    }
  }
}

export default new UserPreferencesService();