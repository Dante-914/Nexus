import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { fetchAllNews } from '../services/newsService';
import UserAvatar from '../components/UserAvatar';
import './Dashboard.css';

export default function Dashboard() {
  const { currentUser } = useAuth();
  const [recentNews, setRecentNews] = useState([]);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);
  const [stats, setStats] = useState({
    todos: { total: 0, active: 0, completed: 0 },
    notes: 0,
    mood: { today: null, average: 0, streak: 0 },
    study: { sessions: 0, streak: 0, totalMinutes: 0 }
  });

  // Fetch all stats
  useEffect(() => {
    if (currentUser) {
      fetchAllStats();
    }
  }, [currentUser]);

  // Fetch recent news
  useEffect(() => {
    loadRecentNews();
  }, []);

  // Fetch weather with device location
  useEffect(() => {
    getLocationAndWeather();
  }, []);

  const fetchAllStats = async () => {
    try {
      // Fetch todos
      const todosQuery = query(
        collection(db, 'todos'),
        where('userId', '==', currentUser.uid)
      );
      const todosSnapshot = await getDocs(todosQuery);
      const todos = [];
      todosSnapshot.forEach((doc) => todos.push({ id: doc.id, ...doc.data() }));
      
      const activeTodos = todos.filter(todo => !todo.completed).length;
      const completedTodos = todos.filter(todo => todo.completed).length;

      // Fetch notes
      const notesQuery = query(
        collection(db, 'notes'),
        where('userId', '==', currentUser.uid)
      );
      const notesSnapshot = await getDocs(notesQuery);
      const notesCount = notesSnapshot.size;

      // Fetch mood entries
      const moodQuery = query(
        collection(db, 'moodEntries'),
        where('userId', '==', currentUser.uid)
      );
      const moodSnapshot = await getDocs(moodQuery);
      const moodEntries = [];
      moodSnapshot.forEach((doc) => moodEntries.push(doc.data()));
      
      // Calculate average mood
      const avgMood = moodEntries.length > 0 
        ? (moodEntries.reduce((sum, entry) => sum + entry.mood, 0) / moodEntries.length).toFixed(1)
        : 0;

      // Calculate mood streak
      const moodStreak = calculateStreak(moodEntries);

      // Get today's mood
      const today = new Date().toDateString();
      const todayMood = moodEntries.find(entry => 
        new Date(entry.date?.toDate()).toDateString() === today
      );

      // Fetch study sessions
      const studyQuery = query(
        collection(db, 'studySessions'),
        where('userId', '==', currentUser.uid)
      );
      const studySnapshot = await getDocs(studyQuery);
      const studySessions = [];
      studySnapshot.forEach((doc) => studySessions.push(doc.data()));
      
      const totalMinutes = studySessions.reduce((sum, session) => sum + (session.duration / 60 || 0), 0);
      const studyStreak = calculateStudyStreak(studySessions);

      setStats({
        todos: {
          total: todos.length,
          active: activeTodos,
          completed: completedTodos
        },
        notes: notesCount,
        mood: {
          today: todayMood ? getMoodLabel(todayMood.mood) : null,
          average: avgMood,
          streak: moodStreak
        },
        study: {
          sessions: studySessions.length,
          streak: studyStreak,
          totalMinutes: Math.round(totalMinutes)
        }
      });

    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const calculateStreak = (entries) => {
    if (entries.length === 0) return 0;
    
    const sorted = [...entries].sort((a, b) => 
      b.date?.toDate() - a.date?.toDate()
    );
    
    let streak = 1;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < sorted.length - 1; i++) {
      const entryDate = sorted[i].date?.toDate();
      const nextEntryDate = sorted[i + 1]?.date?.toDate();
      
      if (!entryDate || !nextEntryDate) break;
      
      entryDate.setHours(0, 0, 0, 0);
      nextEntryDate.setHours(0, 0, 0, 0);
      
      const diffDays = Math.floor((entryDate - nextEntryDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  };

  const calculateStudyStreak = (sessions) => {
    if (sessions.length === 0) return 0;
    
    const sorted = [...sessions].sort((a, b) => 
      b.startTime?.toDate() - a.startTime?.toDate()
    );
    
    let streak = 1;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < sorted.length - 1; i++) {
      const sessionDate = sorted[i].startTime?.toDate();
      const nextSessionDate = sorted[i + 1]?.startTime?.toDate();
      
      if (!sessionDate || !nextSessionDate) break;
      
      sessionDate.setHours(0, 0, 0, 0);
      nextSessionDate.setHours(0, 0, 0, 0);
      
      const diffDays = Math.floor((sessionDate - nextSessionDate) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  };

  const getMoodLabel = (moodValue) => {
    const moodMap = {
      1: 'Terrible',
      2: 'Bad',
      3: 'Okay',
      4: 'Good',
      5: 'Great'
    };
    return moodMap[moodValue] || 'Not set';
  };

  const loadRecentNews = async () => {
    try {
      const data = await fetchAllNews('', 1, ['newsapi', 'guardian']);
      setRecentNews(data.articles.slice(0, 5));
    } catch (error) {
      console.error('Error loading recent news:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLocationAndWeather = () => {
    setWeatherLoading(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      fetchWeatherByCity('Abuja');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        fetchWeatherByCoords(latitude, longitude);
      },
      (error) => {
        console.error('Geolocation error:', error);
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Location permission denied. Using default location.');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('Location information unavailable. Using default location.');
            break;
          case error.TIMEOUT:
            setLocationError('Location request timed out. Using default location.');
            break;
          default:
            setLocationError('Could not get your location. Using default location.');
        }
        
        fetchWeatherByCity('Abuja');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const fetchWeatherByCoords = async (lat, lon) => {
    try {
      const API_KEY = import.meta.env.VITE_WEATHER_API_KEY;
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
      );
      const data = await response.json();
      
      if (data.cod === 200) {
        setWeather({
          temp: Math.round(data.main.temp),
          feelsLike: Math.round(data.main.feels_like),
          condition: data.weather[0].main,
          description: data.weather[0].description,
          icon: data.weather[0].icon,
          city: data.name,
          country: data.sys.country,
          humidity: data.main.humidity,
          wind: Math.round(data.wind.speed * 3.6),
          pressure: data.main.pressure
        });
      } else {
        throw new Error('Weather data not found');
      }
    } catch (error) {
      console.error('Error fetching weather by coordinates:', error);
      fetchWeatherByCity('Lagos');
    } finally {
      setWeatherLoading(false);
    }
  };

  const fetchWeatherByCity = async (city) => {
    try {
      const API_KEY = import.meta.env.VITE_WEATHER_API_KEY;
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${API_KEY}`
      );
      const data = await response.json();
      
      if (data.cod === 200) {
        setWeather({
          temp: Math.round(data.main.temp),
          feelsLike: Math.round(data.main.feels_like),
          condition: data.weather[0].main,
          description: data.weather[0].description,
          icon: data.weather[0].icon,
          city: data.name,
          country: data.sys.country,
          humidity: data.main.humidity,
          wind: Math.round(data.wind.speed * 3.6),
          pressure: data.main.pressure
        });
      }
    } catch (error) {
      console.error('Error fetching weather by city:', error);
      setWeather(null);
    } finally {
      setWeatherLoading(false);
    }
  };

  const handleRetryLocation = () => {
    getLocationAndWeather();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  return (
    <div className="dashboard-container">
      {/* Welcome Section with Weather */}
      <div className="dashboard-welcome">
        <div className="welcome-text">
          <h1>Welcome back, {currentUser?.displayName?.split(' ')[0] || 'User'}</h1>
          <p className="welcome-date">{new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</p>
        </div>

        {/* Weather Widget - Top Right */}
        {weatherLoading ? (
          <div className="weather-skeleton">
            <div className="skeleton-icon"></div>
            <div className="skeleton-temp"></div>
          </div>
        ) : weather ? (
          <div className="weather-widget">
            {locationError && (
              <div className="weather-location-warning" onClick={handleRetryLocation}>
                ⚠️ {locationError} <span className="retry-text">(Click to retry)</span>
              </div>
            )}
            <div className="weather-main">
              <img 
                src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                alt={weather.condition}
                className="weather-icon"
              />
              <div className="weather-temp-container">
                <span className="weather-temp">{weather.temp}°C</span>
                <span className="weather-condition">{weather.condition}</span>
              </div>
            </div>
            <div className="weather-details">
              <div className="weather-detail-item">
                <span className="detail-label">Feels like</span>
                <span className="detail-value">{weather.feelsLike}°C</span>
              </div>
              <div className="weather-detail-item">
                <span className="detail-label">Humidity</span>
                <span className="detail-value">{weather.humidity}%</span>
              </div>
              <div className="weather-detail-item">
                <span className="detail-label">Wind</span>
                <span className="detail-value">{weather.wind} km/h</span>
              </div>
              <div className="weather-detail-item">
                <span className="detail-label">Location</span>
                <span className="detail-value">{weather.city}, {weather.country}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="weather-error" onClick={handleRetryLocation}>
            Click to load weather
          </div>
        )}
      </div>

      {/* Quick Stats Cards */}
      <div className="stats-grid">
        <Link to="/todos" className="stat-card total">
          <div className="stat-icon">✓</div>
          <div className="stat-content">
            <span className="stat-label">Total Tasks</span>
            <span className="stat-number">{stats.todos.total}</span>
            <span className="stat-sub">
              {stats.todos.active} active · {stats.todos.completed} done
            </span>
          </div>
        </Link>

        <Link to="/notes" className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-content">
            <span className="stat-label">Notes</span>
            <span className="stat-number">{stats.notes}</span>
          </div>
        </Link>

        <Link to="/mood" className="stat-card">
          <div className="stat-icon">😊</div>
          <div className="stat-content">
            <span className="stat-label">Mood</span>
            <span className="stat-number">
              {stats.mood.today || '--'}
            </span>
            <span className="stat-sub">
              Avg: {stats.mood.average} · {stats.mood.streak} day streak
            </span>
          </div>
        </Link>

        <Link to="/study" className="stat-card">
          <div className="stat-icon">🔥</div>
          <div className="stat-content">
            <span className="stat-label">Study</span>
            <span className="stat-number">{stats.study.streak} days</span>
            <span className="stat-sub">
              {stats.study.totalMinutes} mins · {stats.study.sessions} sessions
            </span>
          </div>
        </Link>
      </div>

      {/* Recent News Feed - Full Width Below */}
      <div className="recent-news-section">
        <div className="section-header">
          <h2>Recent News</h2>
          <Link to="/news" className="view-all-link">
            View All News →
          </Link>
        </div>

        {loading ? (
          <div className="news-loading">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="news-skeleton-card">
                <div className="skeleton-image"></div>
                <div className="skeleton-content">
                  <div className="skeleton-title"></div>
                  <div className="skeleton-source"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="news-feed-grid">
            {recentNews.map((article, index) => (
              <div key={index} className="news-feed-card">
                <div className="news-image-container">
                  {article.imageUrl ? (
                    <img 
                      src={article.imageUrl} 
                      alt={article.title}
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  ) : (
                    <div className="news-image-fallback">
                      {article.source?.name?.[0] || 'N'}
                    </div>
                  )}
                </div>
                <div className="news-feed-content">
                  <h3 className="news-title">
                    <a href={article.url} target="_blank" rel="noopener noreferrer">
                      {article.title}
                    </a>
                  </h3>
                  <div className="news-meta">
                    <span className="news-source">{article.source?.name || 'Unknown'}</span>
                    <span className="news-time">{formatDate(article.publishedAt)}</span>
                  </div>
                  <p className="news-description">{article.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="action-buttons">
          <Link to="/notes/new" className="action-btn">New Note</Link>
          <Link to="/todos/new" className="action-btn">New Task</Link>
          <Link to="/mood" className="action-btn">Log Mood</Link>
          <Link to="/study" className="action-btn">Start Timer</Link>
        </div>
      </div>
    </div>
  );
}