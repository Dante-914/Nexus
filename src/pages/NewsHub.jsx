import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchAllNews, fetchTrendingTopics } from '../services/newsService';
import { 
  saveArticle, 
  removeSavedArticle, 
  listenToSavedArticles,
  addToWatchlist,
  removeFromWatchlist,
  listenToWatchlist 
} from '../services/userPreferences';
import UserAvatar from '../components/UserAvatar';
import './NewsHub.css';

export default function NewsHub() {
  const { currentUser } = useAuth();
  const [articles, setArticles] = useState([]);
  const [trendingTopics, setTrendingTopics] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [savedArticles, setSavedArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showSaved, setShowSaved] = useState(false);
  const [newWatchlistItem, setNewWatchlistItem] = useState('');
  const [error, setError] = useState(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [forceUpdate, setForceUpdate] = useState(0);

  const searchTimeout = useRef(null);
  const loaderRef = useRef(null);
  const dropdownRef = useRef(null);

  // Categories for news
  const categories = [
    { id: 'general', name: 'General', emoji: '📰' },
    { id: 'business', name: 'Business', emoji: '💼' },
    { id: 'technology', name: 'Technology', emoji: '💻' },
    { id: 'entertainment', name: 'Entertainment', emoji: '🎬' },
    { id: 'health', name: 'Health', emoji: '🏥' },
    { id: 'science', name: 'Science', emoji: '🔬' },
    { id: 'sports', name: 'Sports', emoji: '⚽' },
    { id: 'politics', name: 'Politics', emoji: '🏛️' }
  ];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCategoryDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initial load
  useEffect(() => {
    loadNews(true);
    loadTrendingTopics();
  }, []);

  // Load news with debounce
  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(() => {
      setPage(1);
      loadNews(true);
    }, 500);

    return () => clearTimeout(searchTimeout.current);
  }, [searchTerm, selectedCategory]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading && !loadingMore) {
          setPage(prev => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore]);

  // Load more when page changes
  useEffect(() => {
    if (page > 1) {
      loadNews();
    }
  }, [page]);

  // Listen to saved articles
  useEffect(() => {
    if (!currentUser) {
      setSavedArticles([]);
      return;
    }

    const unsubscribe = listenToSavedArticles(currentUser.uid, (articles) => {
      setSavedArticles(articles || []);
    });
    
    return unsubscribe;
  }, [currentUser]);

  // Listen to watchlist
  useEffect(() => {
    if (!currentUser) {
      setWatchlist([]);
      return;
    }

    const unsubscribe = listenToWatchlist(currentUser.uid, (items) => {
      setWatchlist(items || []);
    });
    
    return unsubscribe;
  }, [currentUser]);

  // Update timers every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setForceUpdate(prev => prev + 1);
    }, 60000);
    
    return () => clearInterval(timer);
  }, []);

  const loadNews = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setArticles([]);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      // Build search query from watchlist if no search term
      let query = searchTerm;
      if (!query && watchlist.length > 0 && !reset) {
        query = watchlist.map(w => w.keyword).join(' ');
      }

      // Add category to query
      if (selectedCategory !== 'general') {
        query = query ? `${query} ${selectedCategory}` : selectedCategory;
      }

      const data = await fetchAllNews(query, reset ? 1 : page);
      
      const newArticles = data?.articles || [];
      
      if (reset) {
        setArticles(newArticles);
      } else {
        setArticles(prev => [...(prev || []), ...newArticles]);
      }

      setHasMore(newArticles.length === 10);
      setInitialLoad(false);
    } catch (err) {
      console.error('Error loading news:', err);
      setError('Failed to load news. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadTrendingTopics = async () => {
    try {
      const topics = await fetchTrendingTopics();
      setTrendingTopics(topics || []);
    } catch (err) {
      console.error('Error loading trending topics:', err);
      setTrendingTopics([]);
    }
  };

  const handleSaveArticle = async (article) => {
    if (!currentUser) {
      alert('Please login to save articles');
      return;
    }

    try {
      const existing = savedArticles?.find(a => a?.url === article?.url);
      if (existing) {
        await removeSavedArticle(existing.id);
      } else {
        await saveArticle(currentUser.uid, article);
      }
    } catch (error) {
      console.error('Error saving article:', error);
      alert('Failed to save article. Please try again.');
    }
  };

  const handleAddToWatchlist = async () => {
    if (!newWatchlistItem.trim() || !currentUser) return;
    
    try {
      await addToWatchlist(currentUser.uid, newWatchlistItem);
      setNewWatchlistItem('');
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      alert('Failed to add to watchlist');
    }
  };

  const handleRemoveFromWatchlist = async (id) => {
    try {
      await removeFromWatchlist(id);
    } catch (error) {
      console.error('Error removing from watchlist:', error);
      alert('Failed to remove from watchlist');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      const diffWeeks = Math.floor(diffDays / 7);
      const diffMonths = Math.floor(diffDays / 30);
      const diffYears = Math.floor(diffDays / 365);

      if (diffMins < 1) {
        return 'Just now';
      } else if (diffMins < 60) {
        return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
      } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
      } else if (diffDays < 7) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
      } else if (diffWeeks < 4) {
        return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
      } else if (diffMonths < 12) {
        return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
      } else {
        return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
      }
    } catch (e) {
      return '';
    }
  };

  const isArticleSaved = (url) => {
    return savedArticles?.some(a => a?.url === url) || false;
  };

  // Get current category display
  const currentCategory = categories.find(c => c.id === selectedCategory) || categories[0];

  // Show login prompt if not logged in
  if (!currentUser) {
    return (
      <div className="page-container">
        <div className="news-container">
          <div className="login-prompt-card">
            <h2>Welcome to News Hub</h2>
            <p>Please login to access news and manage your watchlist</p>
            <button onClick={() => window.location.href = '/login'} className="login-btn">
              Login / Sign Up
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="news-container">
        {/* Header with User Avatar */}
        <div className="news-header">
          <h1>News Hub</h1>
          <div className="header-right">
            <button 
              className="saved-toggle"
              onClick={() => setShowSaved(!showSaved)}
            >
              {showSaved ? '📰 News Feed' : `🔖 Saved (${savedArticles?.length || 0})`}
            </button>
            <UserAvatar size={40} />
          </div>
        </div>

        {/* Search Bar and Category Dropdown */}
        <div className="search-section">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search news..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            
            {/* Category Dropdown */}
            <div className="category-dropdown-container" ref={dropdownRef}>
              <button 
                className="category-dropdown-btn"
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              >
                <span>{currentCategory.emoji}</span>
                <span className="category-name">{currentCategory.name}</span>
                <span className="dropdown-arrow">{showCategoryDropdown ? '▲' : '▼'}</span>
              </button>
              
              {showCategoryDropdown && (
                <div className="category-dropdown-menu">
                  {categories.map(category => (
                    <button
                      key={category.id}
                      className={`category-option ${selectedCategory === category.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedCategory(category.id);
                        setShowCategoryDropdown(false);
                      }}
                    >
                      <span>{category.emoji}</span>
                      <span>{category.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="news-content">
          {/* Sidebar */}
          <div className="news-sidebar">
            {/* Watchlist */}
            <div className="sidebar-section">
              <h3>🔍 Topic Watchlist</h3>
              <div className="watchlist-input">
                <input
                  type="text"
                  value={newWatchlistItem}
                  onChange={(e) => setNewWatchlistItem(e.target.value)}
                  placeholder="Add keyword..."
                  onKeyPress={(e) => e.key === 'Enter' && handleAddToWatchlist()}
                />
                <button onClick={handleAddToWatchlist}>+</button>
              </div>
              <div className="watchlist-items">
                {(watchlist || []).map(item => (
                  <div key={item?.id} className="watchlist-item">
                    <span 
                      className="watchlist-keyword"
                      onClick={() => setSearchTerm(item?.keyword || '')}
                    >
                      #{item?.keyword}
                    </span>
                    <button onClick={() => handleRemoveFromWatchlist(item?.id)}>×</button>
                  </div>
                ))}
                {(!watchlist || watchlist.length === 0) && (
                  <p className="empty-watchlist">No topics tracked</p>
                )}
              </div>
            </div>

            {/* Trending Topics */}
            <div className="sidebar-section">
              <h3>📈 Trending</h3>
              <div className="trending-list">
                {(trendingTopics || []).map((topic, index) => (
                  <div 
                    key={index} 
                    className="trending-item"
                    onClick={() => setSearchTerm(topic)}
                  >
                    <span className="trending-rank">#{index + 1}</span>
                    <span className="trending-topic">{topic}</span>
                  </div>
                ))}
                {(!trendingTopics || trendingTopics.length === 0) && (
                  <p className="empty-trending">No trending topics</p>
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="news-feed">
            {error && (
              <div className="error-message">
                {error}
                <button onClick={() => setError(null)}>×</button>
              </div>
            )}

            {showSaved ? (
              // Saved Articles View
              <div className="saved-articles">
                <h2>Saved Articles ({savedArticles?.length || 0})</h2>
                {(!savedArticles || savedArticles.length === 0) ? (
                  <p className="no-articles">No saved articles yet</p>
                ) : (
                  savedArticles.map(article => (
                    <div key={article?.id} className="article-card">
                      {article?.imageUrl && (
                        <img 
                          src={article.imageUrl} 
                          alt={article?.title || 'Article'}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="article-content">
                        <h3>{article?.title || 'Untitled'}</h3>
                        <p>{article?.description || article?.content || 'No description'}</p>
                        <div className="article-meta">
                          <span className="article-date">
                            {formatDate(article?.publishedAt || article?.savedAt)}
                          </span>
                        </div>
                        <div className="article-actions">
                          <a 
                            href={article?.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Read More
                          </a>
                          <button onClick={() => handleSaveArticle(article)}>
                            🔖 Unsave
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              // Main News Feed
              <>
                {loading && initialLoad ? (
                  // Loading skeletons
                  [...Array(5)].map((_, i) => (
                    <div key={i} className="article-skeleton">
                      <div className="skeleton-image"></div>
                      <div className="skeleton-content">
                        <div className="skeleton-title"></div>
                        <div className="skeleton-description"></div>
                        <div className="skeleton-meta"></div>
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    {(!articles || articles.length === 0) ? (
                      <p className="no-articles">No articles found</p>
                    ) : (
                      articles.map((article, index) => (
                        <div key={article?.id || index} className="article-card">
                          {article?.imageUrl && (
                            <img 
                              src={article.imageUrl}
                              alt={article.title || 'Article'}
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.style.display = 'none';
                              }}
                            />
                          )}
                          <div className="article-content">
                            <h3>{article?.title || 'Untitled'}</h3>
                            <p>{article?.description || article?.content || 'No description available'}</p>
                            <div className="article-meta">
                              <span className="article-source">{article?.source?.name || article?.source || 'Unknown'}</span>
                              <span className="article-date">
                                {formatDate(article?.publishedAt)}
                              </span>
                              {article?.normalized?.readingTime && (
                                <span className="reading-time">
                                  📖 {article.normalized.readingTime} min read
                                </span>
                              )}
                            </div>
                            <div className="article-actions">
                              <a href={article?.url} target="_blank" rel="noopener noreferrer">
                                Read More
                              </a>
                              {currentUser && (
                                <>
                                  <button 
                                    className={isArticleSaved(article?.url) ? 'saved' : ''}
                                    onClick={() => handleSaveArticle(article)}
                                  >
                                    {isArticleSaved(article?.url) ? '🔖 Saved' : '🔖 Save'}
                                  </button>
                                  {article?.normalized?.keywords?.length > 0 && (
                                    <div className="article-keywords">
                                      {article.normalized.keywords.slice(0, 3).map(keyword => (
                                        <span 
                                          key={keyword} 
                                          className="keyword-tag"
                                          onClick={() => setSearchTerm(keyword)}
                                        >
                                          #{keyword}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}

                    {/* Loader for infinite scroll */}
                    <div ref={loaderRef} className="loader">
                      {loadingMore && <div className="loading-spinner"></div>}
                      {!hasMore && articles?.length > 0 && (
                        <p className="no-more">No more articles</p>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}