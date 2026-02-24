import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { format, subMonths, eachDayOfInterval, subDays } from 'date-fns';
import { ActivityCalendar } from 'react-activity-calendar';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import './MoodTracker.css';

export default function MoodTracker() {
  const { currentUser } = useAuth();
  const [moodEntries, setMoodEntries] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [mood, setMood] = useState(3);
  const [note, setNote] = useState('');
  const [activities, setActivities] = useState([]);
  const [sleepHours, setSleepHours] = useState(7);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('daily');
  const [showHistory, setShowHistory] = useState(false);

  // Mood options with emojis and colors (6 options including empty/neutral)
  const moodOptions = [
    { value: 0, emoji: '⚪', label: 'None', color: '#ebedf0', level: 0 },
    { value: 1, emoji: '😰', label: 'Stressed', color: '#f44336', level: 1 },
    { value: 2, emoji: '😞', label: 'Bad', color: '#ff9800', level: 2 },
    { value: 3, emoji: '😐', label: 'Meh', color: '#ffc107', level: 3 },
    { value: 4, emoji: '🙂', label: 'Calm', color: '#8bc34a', level: 4 },
    { value: 5, emoji: '😊', label: 'Great', color: '#4caf50', level: 5 }
  ];

  // Activity options
  const activityOptions = [
    'Exercise', 'Meditation', 'Social', 'Work', 'Study', 
    'Hobby', 'Nature', 'Reading', 'Gaming', 'Family Time'
  ];

  // Fetch mood entries from Firestore
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'moodEntries'),
      where('userId', '==', currentUser.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries = [];
      snapshot.forEach((doc) => {
        entries.push({ id: doc.id, ...doc.data() });
      });
      setMoodEntries(entries);
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser]);

  // Check if entry exists for selected date
  const todayEntry = moodEntries.find(entry => 
    format(entry.date?.toDate(), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
  );

  // Save mood entry
  const saveMoodEntry = async () => {
    try {
      const entryData = {
        mood,
        note,
        activities,
        sleepHours,
        date: selectedDate,
        userId: currentUser.uid,
        updatedAt: serverTimestamp()
      };

      if (todayEntry) {
        const entryRef = doc(db, 'moodEntries', todayEntry.id);
        await updateDoc(entryRef, entryData);
      } else {
        await addDoc(collection(db, 'moodEntries'), {
          ...entryData,
          createdAt: serverTimestamp()
        });
      }

      setNote('');
      setActivities([]);
      setSleepHours(7);
    } catch (error) {
      console.error('Error saving mood entry:', error);
    }
  };

  // Delete mood entry
  const deleteEntry = async () => {
    if (!todayEntry) return;
    
    if (window.confirm('Delete this mood entry?')) {
      try {
        await deleteDoc(doc(db, 'moodEntries', todayEntry.id));
      } catch (error) {
        console.error('Error deleting entry:', error);
      }
    }
  };

  // Prepare data for activity calendar with 6 levels (0-5)
  // Add fallback empty data if no entries exist
  const getCalendarData = () => {
    if (moodEntries.length === 0) {
      // Return placeholder data for the last 30 days with level 0
      const placeholderData = [];
      const today = new Date();
      for (let i = 30; i >= 0; i--) {
        const date = subDays(today, i);
        placeholderData.push({
          date: format(date, 'yyyy-MM-dd'),
          count: 0,
          level: 0,
          originalMood: 0
        });
      }
      return placeholderData;
    }
    
    return moodEntries.map(entry => ({
      date: format(entry.date?.toDate(), 'yyyy-MM-dd'),
      count: entry.mood,
      level: entry.mood,
      originalMood: entry.mood
    }));
  };

  const calendarData = getCalendarData();

  // Theme with exactly 6 colors (for levels 0-5)
  const calendarTheme = {
    light: ['#ebedf0', '#f44336', '#ff9800', '#ffc107', '#8bc34a', '#4caf50'],
    dark: ['#2d2d2d', '#f44336', '#ff9800', '#ffc107', '#8bc34a', '#4caf50']
  };

  // Prepare data for charts
  const last30Days = eachDayOfInterval({
    start: subMonths(new Date(), 1),
    end: new Date()
  });

  const chartData = last30Days.map(day => {
    const entry = moodEntries.find(e => 
      format(e.date?.toDate(), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
    );
    return {
      date: format(day, 'MMM dd'),
      mood: entry?.mood || null,
      fullDate: day
    };
  }).filter(d => d.mood !== null);

  // Mood distribution for pie chart (excluding level 0)
  const moodDistribution = moodOptions.slice(1).map(option => {
    const count = moodEntries.filter(entry => entry.mood === option.value).length;
    return {
      name: option.label,
      value: count,
      color: option.color,
      emoji: option.emoji
    };
  }).filter(item => item.value > 0);

  // Activity frequency
  const activityFrequency = activityOptions.map(activity => {
    const count = moodEntries.filter(entry => entry.activities?.includes(activity)).length;
    return {
      name: activity,
      count
    };
  }).filter(item => item.count > 0).sort((a, b) => b.count - a.count);

  // Sleep correlation data
  const sleepCorrelation = {};
  moodEntries.forEach(entry => {
    const sleep = entry.sleepHours || 7;
    if (!sleepCorrelation[sleep]) {
      sleepCorrelation[sleep] = { total: 0, count: 0 };
    }
    sleepCorrelation[sleep].total += entry.mood;
    sleepCorrelation[sleep].count++;
  });

  const sleepData = Object.entries(sleepCorrelation).map(([hours, data]) => ({
    hours: `${hours}h`,
    avgMood: (data.total / data.count).toFixed(1)
  }));

  if (loading) {
    return <div className="loading">Loading mood tracker...chill</div>;
  }

  return (
    <div className="page-container">
      <div className="mood-container">
        <div className="mood-header">
         <h1>😊 Mood Tracker</h1>
         <div className="mood-summary">
           <span>Average Mood: </span>
           <span className="avg-mood">
            {(moodEntries.reduce((acc, entry) => acc + entry.mood, 0) / moodEntries.length || 0).toFixed(1)}
            /5
            </span>
          <span>Total Entries: {moodEntries.length}</span>
        </div>
      </div>

      <div className="mood-content">
        {/* Daily Entry Section */}
        <div className="daily-entry">
          <h2>
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            {todayEntry && <span className="entry-badge">✓ Logged</span>}
          </h2>

          <div className="mood-selector">
            <label>How are you feeling?</label>
            <div className="mood-buttons">
              {moodOptions.slice(1).map(option => (
                <button
                  key={option.value}
                  className={`mood-btn ${mood === option.value ? 'selected' : ''}`}
                  style={{ 
                    backgroundColor: mood === option.value ? option.color : 'transparent',
                    borderColor: option.color
                  }}
                  onClick={() => setMood(option.value)}
                >
                  <span className="mood-emoji">{option.emoji}</span>
                  <span className="mood-label">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="sleep-tracker">
            <label>Sleep Hours: {sleepHours}h</label>
            <input
              type="range"
              min="0"
              max="12"
              step="0.5"
              value={sleepHours}
              onChange={(e) => setSleepHours(parseFloat(e.target.value))}
              className="sleep-slider"
            />
          </div>

          <div className="activities-selector">
            <label>Activities today:</label>
            <div className="activity-buttons">
              {activityOptions.map(activity => (
                <button
                  key={activity}
                  className={`activity-btn ${activities.includes(activity) ? 'selected' : ''}`}
                  onClick={() => {
                    if (activities.includes(activity)) {
                      setActivities(activities.filter(a => a !== activity));
                    } else {
                      setActivities([...activities, activity]);
                    }
                  }}
                >
                  {activity}
                </button>
              ))}
            </div>
          </div>

          <div className="note-input">
            <label>Notes (optional):</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="How was your day? Any highlights or challenges?"
              rows="3"
            />
          </div>

          <div className="entry-actions">
            <button onClick={saveMoodEntry} className="save-entry-btn">
              {todayEntry ? 'Update Entry' : 'Save Entry'}
            </button>
            {todayEntry && (
              <button onClick={deleteEntry} className="delete-entry-btn">
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Modern Calendar View with 6 Colors */}
        <div className="calendar-section">
          <h3>Mood Calendar</h3>
          {moodEntries.length === 0 ? (
            <div className="empty-calendar-message">
              <p>No mood entries yet. Start tracking your mood to see your calendar!</p>
              <div className="calendar-placeholder">
                <ActivityCalendar
                  data={calendarData}
                  theme={calendarTheme}
                  maxLevel={5}
                  colorScheme={document.body.classList.contains('dark') ? 'dark' : 'light'}
                  hideTotalCount={true}
                  fontSize={14}
                  labels={{
                    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                    totalCount: '{{count}} entries',
                    legend: {
                      less: 'Less',
                      more: 'More'
                    }
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="calendar-container">
              <ActivityCalendar
                data={calendarData}
                theme={calendarTheme}
                maxLevel={5}
                colorScheme={document.body.classList.contains('dark') ? 'dark' : 'light'}
                hideTotalCount={true}
                fontSize={14}
                eventHandlers={{
                  onClick: (data) => {
                    if (data?.date) {
                      setSelectedDate(new Date(data.date));
                    }
                  },
                }}
                labels={{
                  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                  weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                  totalCount: '{{count}} entries',
                  legend: {
                    less: 'Less',
                    more: 'More'
                  }
                }}
              />
            </div>
          )}
          <div className="calendar-legend">
            {moodOptions.slice(1).map(option => (
              <div key={option.value} className="legend-item">
                <span 
                  className="legend-color" 
                  style={{ backgroundColor: option.color }}
                />
                <span>{option.emoji} {option.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Charts Section */}
        <div className="charts-section">
          <div className="chart-tabs">
            <button 
              className={`chart-tab ${view === 'daily' ? 'active' : ''}`}
              onClick={() => setView('daily')}
            >
              Daily Trend
            </button>
            <button 
              className={`chart-tab ${view === 'weekly' ? 'active' : ''}`}
              onClick={() => setView('weekly')}
            >
              Weekly Avg
            </button>
            <button 
              className={`chart-tab ${view === 'monthly' ? 'active' : ''}`}
              onClick={() => setView('monthly')}
            >
              Monthly
            </button>
          </div>

          {chartData.length > 0 ? (
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--text-secondary)" />
                  <YAxis domain={[1, 5]} stroke="var(--text-secondary)" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="mood" 
                    stroke="var(--primary)" 
                    strokeWidth={2}
                    dot={{ fill: 'var(--primary)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="no-data">No mood data yet. Start logging your mood to see trends!</p>
          )}
        </div>

        {/* Insights Section */}
        <div className="insights-section">
          <h3>📊 Insights</h3>
          
          <div className="insights-grid">
            {/* Mood Distribution */}
            <div className="insight-card">
              <h4>Mood Distribution</h4>
              {moodDistribution.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={moodDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {moodDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--surface)',
                        border: '1px solid var(--border)'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="no-data">No data yet</p>
              )}
            </div>

            {/* Top Activities */}
            <div className="insight-card">
              <h4>Top Activities</h4>
              {activityFrequency.length > 0 ? (
                activityFrequency.slice(0, 5).map(activity => (
                  <div key={activity.name} className="activity-stat">
                    <span>{activity.name}</span>
                    <div className="stat-bar">
                      <div 
                        className="stat-fill"
                        style={{ 
                          width: `${(activity.count / moodEntries.length) * 100}%`,
                          backgroundColor: 'var(--primary)'
                        }}
                      />
                    </div>
                    <span>{activity.count}x</span>
                  </div>
                ))
              ) : (
                <p className="no-data">No activities tracked yet</p>
              )}
            </div>

            {/* Sleep Correlation */}
            <div className="insight-card">
              <h4>Sleep vs Mood</h4>
              {sleepData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={sleepData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="hours" stroke="var(--text-secondary)" />
                    <YAxis domain={[1, 5]} stroke="var(--text-secondary)" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--surface)',
                        border: '1px solid var(--border)'
                      }}
                    />
                    <Bar dataKey="avgMood" fill="var(--primary)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="no-data">No sleep data yet</p>
              )}
            </div>

            {/* Streak */}
            <div className="insight-card streak-card">
              <h4>🔥 Current Streak</h4>
              <div className="streak-number">
                {calculateStreak(moodEntries)}
              </div>
              <p className="streak-label">days in a row</p>
              <div className="streak-message">
                {getStreakMessage(calculateStreak(moodEntries))}
              </div>
            </div>
          </div>
        </div>

        {/* History Button - Only show if there are entries */}
        {moodEntries.length > 0 && (
          <>
            <button 
              className="history-toggle"
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? 'Hide History' : 'Show History'}
            </button>

            {/* History List */}
            {showHistory && (
              <div className="history-section">
                <h3>📜 Entry History</h3>
                <div className="history-list">
                  {moodEntries.map(entry => {
                    const moodOption = moodOptions.find(m => m.value === entry.mood);
                    return (
                      <div 
                        key={entry.id} 
                        className="history-item"
                        onClick={() => setSelectedDate(entry.date?.toDate())}
                      >
                        <div className="history-date">
                          {format(entry.date?.toDate(), 'MMM d, yyyy')}
                        </div>
                        <div className="history-mood">
                          <span 
                            className="history-emoji"
                            style={{ backgroundColor: moodOption?.color }}
                          >
                            {moodOption?.emoji}
                          </span>
                          <span>{moodOption?.label}</span>
                        </div>
                        <div className="history-sleep">
                          💤 {entry.sleepHours}h
                        </div>
                        {entry.activities?.length > 0 && (
                          <div className="history-activities">
                            {entry.activities.slice(0, 3).join(' • ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}

// Helper functions
function calculateStreak(entries) {
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
}

function getStreakMessage(streak) {
  if (streak === 0) return "Start tracking today!";
  if (streak < 3) return "Good start! Keep it up!";
  if (streak < 7) return "Nice consistency!";
  if (streak < 30) return "You're on fire! 🔥";
  if (streak < 100) return "Amazing dedication! 🌟";
  return "Mood tracking master! 👑";
}