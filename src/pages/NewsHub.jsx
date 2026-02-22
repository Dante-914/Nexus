import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useInView } from 'react-intersection-observer';
import InfiniteScroll from 'react-infinite-scroll-component';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiShare2, 
  FiBookmark, 
  FiMessageCircle, 
  FiMoreHorizontal,
  FiRefreshCw,
  FiTrendingUp,
  FiCompass,
  FiStar
} from 'react-icons/fi';
import { FaTwitter } from 'react-icons/fa';
import { formatDistanceToNow } from 'date-fns';
import NewsService from '../services/newsApi';
import UserPreferences from '../services/userPreferences';
import TwitterService from '../services/twitterService';
import './NewsHub.css';

export default function NewsHub() {
  const { currentUser } = useAuth();
  const [articles, setArticles] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('for-you');
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [weather, setWeather] = useState(null);
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [showComments, setShowComments] = useState({});
  const [comments, setComments] = useState({});
  const [friendsActivity, setFriendsActivity] = useState([]);
  const [viewMode] = useState('grid');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [deepDiveData, setDeepDiveData] = useState(null);
  const [twitterFeed, setTwitterFeed] = useState([]);
  const [twitterLoading, setTwitterLoading] = useState(false);
  const [twitterSearchQuery, setTwitterSearchQuery] = useState('');
  
  const { ref: loadMoreRef, inView } = useInView();
  const wsRef = useRef(null);

  // Categories with colors
  const categories = [
    { id: 'general', name: '📰 All', color: '#4a90e2' },
    { id: 'technology', name: '💻 Tech', color: '#00bcd4' },
    { id: 'business', name: '💼 Business', color: '#4caf50' },
    { id: 'entertainment', name: '🎬 Entertainment', color: '#ff9800' },
    { id: 'health', name: '🏥 Health', color: '#f44336' },
    { id: 'science', name: '🔬 Science', color: '#9c27b0' },
    { id: 'sports', name: '⚽ Sports', color: '#ff5722' },
    { id: 'politics', name: '🏛️ Politics', color: '#607d8b' }
  ];

  // ============ FUNCTION DEFINITIONS (BEFORE useEffect) ============

  // Load weather data
  const loadWeather = async () => {
    try {
      const weatherData = await NewsService.getWeather('London');
      const forecast = await NewsService.getWeatherForecast('London');
      setWeather({ current: weatherData, forecast });
    } catch (error) {
      console.error('Error loading weather:', error);
    }
  };

  // Load trending topics
  const loadTrendingTopics = async () => {
    setTrendingTopics([
      { topic: 'Artificial Intelligence', volume: 12500, sentiment: 0.8 },
      { topic: 'Climate Change', volume: 8900, sentiment: 0.3 },
      { topic: 'Space Exploration', volume: 5600, sentiment: 0.9 },
      { topic: 'Stock Market', volume: 7200, sentiment: 0.5 },
      { topic: 'Olympics', volume: 4300, sentiment: 0.7 }
    ]);
  };

  // Load user preferences
  const loadUserPreferences = async () => {
    if (!currentUser) return;
    try {
      const prefs = await UserPreferences.getUserPreferences(currentUser.uid);
      setBookmarks(prefs.bookmarks || []);
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  // Fetch Twitter headlines
  const fetchTwitterHeadlines = async (query = 'news') => {
    setTwitterLoading(true);
    try {
      const tweets = await TwitterService.searchTweets(query, 15);
      setTwitterFeed(tweets);
      const trends = await TwitterService.getTrendingTopics();
      setTrendingTopics(trends);
    } catch (error) {
      console.error('Error fetching Twitter headlines:', error);
    } finally {
      setTwitterLoading(false);
    }
  };

  // Load news articles
  const loadNews = async (reset = false) => {
    setLoading(true);
    try {
      let response;
      if (activeTab === 'guardian') {
        response = await NewsService.getGuardianNews(
          selectedCategory !== 'general' ? selectedCategory : undefined,
          reset ? 1 : page
        );
        const newArticles = response.results.map(article => ({
          id: article.id,
          title: article.webTitle,
          description: article.fields?.trailText?.replace(/<[^>]*>/g, ''),
          content: article.fields?.bodyText,
          url: article.webUrl,
          imageUrl: article.fields?.thumbnail,
          source: { name: 'The Guardian', id: 'guardian' },
          publishedAt: article.webPublicationDate,
          category: article.sectionId,
          author: article.fields?.byline,
          tags: article.tags?.map(t => t.webTitle)
        }));
        
        setArticles(prev => reset ? newArticles : [...prev, ...newArticles]);
        setHasMore(response.currentPage < response.pages);
      } else if (activeTab === 'longreads') {
        response = await NewsService.getLongReads(reset ? 1 : page);
        // Similar processing...
      } else {
        response = await NewsService.getTopHeadlines(
          'us',
          selectedCategory,
          reset ? 1 : page,
          20
        );
        
        if (currentUser && activeTab === 'for-you') {
          const personalized = await UserPreferences.getRecommendations(
            currentUser.uid,
            response.articles
          );
          setArticles(prev => reset ? personalized : [...prev, ...personalized]);
        } else {
          setArticles(prev => reset ? response.articles : [...prev, ...response.articles]);
        }
        setHasMore(response.articles.length === 20);
      }
    } catch (error) {
      console.error('Error loading news:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load more news
  const loadMoreNews = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
      loadNews();
    }
  };

  // Refresh news
  const refreshNews = () => {
    setPage(1);
    loadNews(true);
  };

  // Handle article click
  const handleArticleClick = async (article) => {
    if (currentUser) {
      await UserPreferences.trackInteraction(
        currentUser.uid,
        article.id,
        'click'
      );
    }
  };

  // Share to notes
  const shareToNotes = async (article) => {
    if (!currentUser) return;
    
    const noteContent = `
# ${article.title}
*Source: ${article.source.name} | ${new Date(article.publishedAt).toLocaleDateString()}*

${article.description}

[Read full article](${article.url})
    `;
    
    window.dispatchEvent(new CustomEvent('create-note', { 
      detail: { title: article.title, content: noteContent }
    }));
    
    alert('Saved to Notes!');
  };

  // Toggle bookmark
  const toggleBookmark = async (article) => {
    if (!currentUser) return;
    
    const isBookmarked = bookmarks.some(b => b.id === article.id);
    
    if (isBookmarked) {
      await UserPreferences.removeBookmark(currentUser.uid, article.id);
      setBookmarks(prev => prev.filter(b => b.id !== article.id));
    } else {
      await UserPreferences.addBookmark(currentUser.uid, article);
      setBookmarks(prev => [...prev, { id: article.id, title: article.title, savedAt: new Date().toISOString() }]);
    }
  };

  // Add comment
  const addComment = async (articleId, text) => {
    if (!currentUser) return;
    
    const newComment = {
      id: Date.now(),
      userId: currentUser.uid,
      userName: currentUser.displayName,
      userPhoto: currentUser.photoURL,
      text,
      timestamp: new Date().toISOString(),
      likes: 0
    };
    
    setComments(prev => ({
      ...prev,
      [articleId]: [...(prev[articleId] || []), newComment]
    }));
  };

  // Load deep dive
  const loadDeepDive = async (article) => {
    setSelectedArticle(article);
    try {
      const related = await NewsService.getRelatedArticles(article.id);
      const trends = await NewsService.getTopicTrends(
        article.title.split(' ').slice(0, 3).join(' '),
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        new Date().toISOString().split('T')[0]
      );
      
      setDeepDiveData({
        related: related.results,
        trends,
      });
    } catch (error) {
      console.error('Error loading deep dive:', error);
    }
  };

  // ============ useEffect HOOKS ============

  // Load initial data
  useEffect(() => {
    loadNews();
    loadWeather();
    loadTrendingTopics();
    if (currentUser) {
      loadUserPreferences();
    }
  }, [currentUser, activeTab, selectedCategory]);

  // Load Twitter when tab changes
  useEffect(() => {
    if (activeTab === 'twitter' || activeTab === 'for-you') {
      fetchTwitterHeadlines();
    }
  }, [activeTab]);

  // Infinite scroll trigger
  useEffect(() => {
    if (inView && hasMore && !loading) {
      loadMoreNews();
    }
  }, [inView, hasMore, loading]);

  // ============ RENDER FUNCTIONS ============

  // Simple article card (without flip)
  const renderArticleCard = (article, index) => {
    const isBookmarked = bookmarks.some(b => b.id === article.id);
    
    return (
      <motion.div
        key={article.id || index}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        className={`article-card ${viewMode}`}
        onClick={() => handleArticleClick(article)}
      >
        <div className="card-front">
          <div className="card-image" style={{ 
            backgroundImage: `url(${article.imageUrl || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400'})` 
          }}>
            <div className="card-category" style={{ backgroundColor: categories.find(c => c.id === article.category)?.color }}>
              {article.category || 'news'}
            </div>
            {article.source?.id === 'guardian' && (
              <div className="source-badge guardian">The Guardian</div>
            )}
          </div>
          <div className="card-content">
            <h3 className="card-title">{article.title}</h3>
            <p className="card-description">{article.description}</p>
            <div className="card-meta">
              <span className="card-source">{article.source?.name}</span>
              <span className="card-time">
                {article.publishedAt ? formatDistanceToNow(new Date(article.publishedAt)) : 'recent'} ago
              </span>
            </div>
            <div className="card-actions">
              <button 
                className={`action-btn bookmark ${isBookmarked ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); toggleBookmark(article); }}
              >
                <FiBookmark />
              </button>
              <button 
                className="action-btn share"
                onClick={(e) => { e.stopPropagation(); shareToNotes(article); }}
              >
                <FiShare2 />
              </button>
              <button 
                className="action-btn comment"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setShowComments(prev => ({
                    ...prev,
                    [article.id]: !prev[article.id]
                  }));
                }}
              >
                <FiMessageCircle />
                <span>{comments[article.id]?.length || 0}</span>
              </button>
              <button 
                className="action-btn deepdive"
                onClick={(e) => { e.stopPropagation(); loadDeepDive(article); }}
              >
                <FiMoreHorizontal />
              </button>
            </div>
          </div>
        </div>
        
        {/* Comments Section */}
        <AnimatePresence>
          {showComments[article.id] && (
            <motion.div 
              className="comments-section"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h4>Comments</h4>
              {currentUser && (
                <div className="add-comment">
                  <input 
                    type="text" 
                    placeholder="Add a comment..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        addComment(article.id, e.target.value);
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
              )}
              <div className="comments-list">
                {comments[article.id]?.map(comment => (
                  <div key={comment.id} className="comment">
                    <img src={comment.userPhoto || 'https://via.placeholder.com/30'} alt={comment.userName} />
                    <div className="comment-content">
                      <strong>{comment.userName}</strong>
                      <p>{comment.text}</p>
                      <small>{formatDistanceToNow(new Date(comment.timestamp))} ago</small>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="news-hub">
      {/* Header with Weather & Quick Actions */}
      <header className="news-header">
        <h1>📰 News Intelligence</h1>
        <div className="header-right">
          {weather && (
            <div className="weather-widget">
              <span className="weather-icon">
                {weather.current.weather[0].icon}
              </span>
              <div className="weather-info">
                <span className="temp">{Math.round(weather.current.main.temp)}°C</span>
                <span className="city">London</span>
              </div>
            </div>
          )}
          <button onClick={refreshNews} className="refresh-btn">
            <FiRefreshCw className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="news-tabs">
        <button 
          className={`tab ${activeTab === 'for-you' ? 'active' : ''}`}
          onClick={() => setActiveTab('for-you')}
        >
          <FiStar /> For You
        </button>
        <button 
          className={`tab ${activeTab === 'trending' ? 'active' : ''}`}
          onClick={() => setActiveTab('trending')}
        >
          <FiTrendingUp /> Trending
        </button>
        <button 
          className={`tab ${activeTab === 'discover' ? 'active' : ''}`}
          onClick={() => setActiveTab('discover')}
        >
          <FiCompass /> Discover
        </button>
        <button 
          className={`tab ${activeTab === 'guardian' ? 'active' : ''}`}
          onClick={() => setActiveTab('guardian')}
        >
          The Guardian
        </button>
        <button 
          className={`tab ${activeTab === 'longreads' ? 'active' : ''}`}
          onClick={() => setActiveTab('longreads')}
        >
          Long Reads
        </button>
        <button
          className={`tab ${activeTab === 'twitter' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('twitter');
            fetchTwitterHeadlines();
          }}
        >
          <FaTwitter /> X
        </button> 
      </div>

      {/* Category Filter */}
      <div className="category-filter">
        {categories.map(category => (
          <button
            key={category.id}
            className={`category-btn ${selectedCategory === category.id ? 'active' : ''}`}
            style={{ '--category-color': category.color }}
            onClick={() => setSelectedCategory(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Twitter Search Bar (only when Twitter tab active) */}
      {activeTab === 'twitter' && (
        <div className="twitter-search">
          <input
            type="text"
            placeholder="Search Twitter headlines..."
            value={twitterSearchQuery}
            onChange={(e) => setTwitterSearchQuery(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                fetchTwitterHeadlines(twitterSearchQuery);
              }
            }}
            className="twitter-search-input"
          />
          <button 
            onClick={() => fetchTwitterHeadlines(twitterSearchQuery)}
            className="twitter-search-btn"
          >
            <FaTwitter /> Search
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="news-content">
        {/* Left Sidebar - Trending & Social */}
        <div className="left-sidebar">
          <div className="trending-topics">
            <h3>🔥 Trending Now</h3>
            {trendingTopics.map((topic, i) => (
              <div key={i} className="trending-item">
                <span className="trend-rank">#{i + 1}</span>
                <div className="trend-info">
                  <span className="trend-topic">{topic.topic}</span>
                  <span className="trend-volume">{topic.volume?.toLocaleString() || '0'} articles</span>
                </div>
                <div className="sentiment-indicator" style={{
                  backgroundColor: topic.sentiment > 0.6 ? '#4caf50' : 
                                 topic.sentiment > 0.4 ? '#ff9800' : '#f44336'
                }} />
              </div>
            ))}
          </div>

          <div className="friends-activity">
            <h3>👥 Friends' Reading</h3>
            {friendsActivity.length === 0 ? (
              <p className="no-activity">No friends activity yet</p>
            ) : (
              friendsActivity.map((activity, i) => (
                <div key={i} className="activity-item">
                  <img src={activity.userPhoto || 'https://via.placeholder.com/30'} alt={activity.userName} />
                  <div className="activity-content">
                    <p>
                      <strong>{activity.userName}</strong> read "{activity.articleTitle}"
                    </p>
                    <small>{activity.timestamp ? formatDistanceToNow(new Date(activity.timestamp)) : 'recent'} ago</small>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Feed - Infinite Scroll */}
        <div className="main-feed">
          {activeTab === 'twitter' ? (
            <div className="twitter-feed">
              <h3 className="twitter-feed-title">
                <FaTwitter /> Trending on X
                {twitterLoading && <span className="loading-spinner"> ⟳</span>}
              </h3>
              
              {twitterFeed.length === 0 && !twitterLoading && (
                <p className="no-tweets">No tweets found. Try a different search.</p>
              )}
              
              {twitterFeed.map((tweet, index) => (
                <div key={tweet.id || index} className="twitter-card">
                  <div className="twitter-header">
                    <span className="twitter-author">{tweet.author}</span>
                    <span className="twitter-time">
                      {tweet.publishedAt ? formatDistanceToNow(new Date(tweet.publishedAt)) : 'recent'} ago
                    </span>
                  </div>
                  
                  <div className="twitter-content">
                    <p>{tweet.content}</p>
                    {tweet.imageUrl && (
                      <img src={tweet.imageUrl} alt="Tweet media" className="twitter-media" />
                    )}
                  </div>
                  
                  <div className="twitter-footer">
                    <span className="twitter-engagement">
                      ❤️ {tweet.engagement?.likes?.toLocaleString() || 0}
                    </span>
                    <span className="twitter-engagement">
                      🔁 {tweet.engagement?.retweets?.toLocaleString() || 0}
                    </span>
                    <a 
                      href={tweet.url || '#'} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="twitter-link"
                    >
                      View on X →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <InfiniteScroll
              dataLength={articles.length}
              next={loadMoreNews}
              hasMore={hasMore}
              loader={<div className="loader">Loading more news...</div>}
              endMessage={<div className="end-message">You've caught up! 🎉</div>}
            >
              <div className={`articles-grid ${viewMode}`}>
                {articles.map((article, index) => renderArticleCard(article, index))}
              </div>
              <div ref={loadMoreRef} style={{ height: '10px' }} />
            </InfiniteScroll>
          )}
        </div>

        {/* Right Sidebar - Bookmarks & Deep Dive */}
        <div className="right-sidebar">
          {selectedArticle && deepDiveData ? (
            <div className="deep-dive">
              <h3>🔍 Deep Dive</h3>
              <div className="deep-dive-content">
                <h4>Related Articles</h4>
                {deepDiveData.related?.map((article, i) => (
                  <a key={i} href={article.webUrl} target="_blank" rel="noopener noreferrer" className="related-link">
                    {article.webTitle}
                  </a>
                ))}
                
                <h4>Topic Trends</h4>
                <div className="trend-chart">
                  {deepDiveData.trends?.map((trend, i) => (
                    <div key={i} className="trend-bar">
                      <div className="bar" style={{ height: `${trend.count * 2}px` }} />
                      <span>{trend.month}</span>
                    </div>
                  ))}
                </div>
                
                <h4>X Discussions</h4>
                <div className="twitter-threads">
                  <a href={`https://twitter.com/search?q=${encodeURIComponent(selectedArticle.title)}`} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="twitter-link">
                    <FaTwitter /> View discussions on X
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="bookmarks">
              <h3>📌 Bookmarks</h3>
              {bookmarks.length === 0 ? (
                <p className="no-bookmarks">No bookmarks yet</p>
              ) : (
                bookmarks.map(bookmark => (
                  <div key={bookmark.id} className="bookmark-item">
                    <span>{bookmark.title}</span>
                    <small>{bookmark.savedAt ? new Date(bookmark.savedAt).toLocaleDateString() : ''}</small>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}