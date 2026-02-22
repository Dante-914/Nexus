import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays } from 'date-fns';
import './StudyPlanner.css';

export default function StudyPlanner() {
  const { currentUser } = useAuth();
  const [studySessions, setStudySessions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [timerMode, setTimerMode] = useState('pomodoro'); // pomodoro, shortBreak, longBreak
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60); // 25 minutes in seconds
  const [pomodoroCount, setPomodoroCount] = useState(0);
  const [currentTask, setCurrentTask] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [newTask, setNewTask] = useState('');
  const [taskDuration, setTaskDuration] = useState(30);
  const [taskSubject, setTaskSubject] = useState('general');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('timer'); // timer, schedule, stats
  
  const timerRef = useRef(null);
  const audioRef = useRef(new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg'));

  // Timer settings
  const timerSettings = {
    pomodoro: 25 * 60,
    shortBreak: 5 * 60,
    longBreak: 15 * 60
  };

  // Subjects for categorization
  const subjects = [
    'Mathematics', 'Physics', 'Chemistry', 'Biology', 
    'History', 'Literature', 'Languages', 'Programming',
    'Art', 'Music', 'General', 'Other'
  ];

  // Fetch study sessions from Firestore
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'studySessions'),
      where('userId', '==', currentUser.uid),
      orderBy('startTime', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions = [];
      snapshot.forEach((doc) => {
        sessions.push({ id: doc.id, ...doc.data() });
      });
      setStudySessions(sessions);
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser]);

  // Fetch tasks from Firestore
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'studyTasks'),
      where('userId', '==', currentUser.uid),
      orderBy('date', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList = [];
      snapshot.forEach((doc) => {
        taskList.push({ id: doc.id, ...doc.data() });
      });
      setTasks(taskList);
    });

    return unsubscribe;
  }, [currentUser]);

  // Timer logic
  useEffect(() => {
    if (timerRunning && !timerPaused) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // Timer finished
            clearInterval(timerRef.current);
            setTimerRunning(false);
            audioRef.current.play();
            
            // Save completed session
            if (timerMode === 'pomodoro') {
              saveCompletedSession();
              setPomodoroCount(prev => prev + 1);
              
              // Auto-switch to break after 4 pomodoros
              if ((pomodoroCount + 1) % 4 === 0) {
                setTimerMode('longBreak');
                setTimeLeft(timerSettings.longBreak);
              } else {
                setTimerMode('shortBreak');
                setTimeLeft(timerSettings.shortBreak);
              }
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(timerRef.current);
  }, [timerRunning, timerPaused, timerMode, pomodoroCount]);

  // Save completed study session
  const saveCompletedSession = async () => {
    try {
      await addDoc(collection(db, 'studySessions'), {
        duration: timerSettings.pomodoro,
        task: currentTask || 'General Study',
        subject: taskSubject,
        startTime: new Date(),
        completedAt: serverTimestamp(),
        userId: currentUser.uid,
        pomodoroNumber: pomodoroCount + 1
      });
    } catch (error) {
      console.error('Error saving study session:', error);
    }
  };

  // Timer controls
  const startTimer = () => {
    setTimerRunning(true);
    setTimerPaused(false);
  };

  const pauseTimer = () => {
    setTimerPaused(true);
    setTimerRunning(false);
  };

  const resetTimer = () => {
    setTimerRunning(false);
    setTimerPaused(false);
    setTimeLeft(timerSettings[timerMode]);
  };

  const switchTimerMode = (mode) => {
    setTimerMode(mode);
    setTimeLeft(timerSettings[mode]);
    setTimerRunning(false);
    setTimerPaused(false);
  };

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Add new task
  const addTask = async (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    try {
      await addDoc(collection(db, 'studyTasks'), {
        title: newTask,
        subject: taskSubject,
        duration: taskDuration,
        date: selectedDate,
        completed: false,
        userId: currentUser.uid,
        createdAt: serverTimestamp()
      });
      setNewTask('');
      setTaskDuration(30);
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  // Toggle task completion
  const toggleTask = async (task) => {
    try {
      const taskRef = doc(db, 'studyTasks', task.id);
      await updateDoc(taskRef, {
        completed: !task.completed
      });
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  // Delete task
  const deleteTask = async (taskId) => {
    if (window.confirm('Delete this task?')) {
      try {
        await deleteDoc(doc(db, 'studyTasks', taskId));
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }
  };

  // Get tasks for selected date
  const tasksForSelectedDate = tasks.filter(task => 
    format(task.date?.toDate(), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
  );

  // Calculate statistics
  const totalStudyTime = studySessions.reduce((acc, session) => acc + (session.duration / 60), 0);
  const totalPomodoros = studySessions.length;
  const averagePerDay = (totalStudyTime / 30).toFixed(1); // Last 30 days approx

  // Get this week's study data
  const weekStart = startOfWeek(new Date());
  const weekEnd = endOfWeek(new Date());
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const weeklyData = weekDays.map(day => {
    const daySessions = studySessions.filter(session => 
      format(session.startTime?.toDate(), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
    );
    const totalMinutes = daySessions.reduce((acc, session) => acc + (session.duration / 60), 0);
    return {
      day: format(day, 'EEE'),
      date: format(day, 'MMM d'),
      minutes: Math.round(totalMinutes),
      sessions: daySessions.length
    };
  });

  if (loading) {
    return <div className="loading">Loading study planner...chill</div>;
  }

  return (
    <div className="study-container">
      <div className="study-header">
        <h1>📚 Study Planner</h1>
        <div className="study-stats">
          <div className="stat-card">
            <span className="stat-value">{totalStudyTime.toFixed(0)}</span>
            <span className="stat-label">Total Hours</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{totalPomodoros}</span>
            <span className="stat-label">Pomodoros</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{averagePerDay}</span>
            <span className="stat-label">Hours/Day</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="study-tabs">
        <button 
          className={`tab-btn ${activeTab === 'timer' ? 'active' : ''}`}
          onClick={() => setActiveTab('timer')}
        >
          ⏱️ Timer
        </button>
        <button 
          className={`tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          📅 Schedule
        </button>
        <button 
          className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          📊 Statistics
        </button>
      </div>

      {/* Timer Tab */}
      {activeTab === 'timer' && (
        <div className="timer-tab">
          <div className="timer-modes">
            <button 
              className={`mode-btn ${timerMode === 'pomodoro' ? 'active' : ''}`}
              onClick={() => switchTimerMode('pomodoro')}
            >
              🍅 Pomodoro
            </button>
            <button 
              className={`mode-btn ${timerMode === 'shortBreak' ? 'active' : ''}`}
              onClick={() => switchTimerMode('shortBreak')}
            >
              ☕ Short Break
            </button>
            <button 
              className={`mode-btn ${timerMode === 'longBreak' ? 'active' : ''}`}
              onClick={() => switchTimerMode('longBreak')}
            >
              🌴 Long Break
            </button>
          </div>

          <div className="timer-display">
            <div className="timer-circle">
              <span className="timer-time">{formatTime(timeLeft)}</span>
            </div>
            <div className="timer-controls">
              {!timerRunning && !timerPaused ? (
                <button onClick={startTimer} className="timer-btn start">
                  ▶ Start
                </button>
              ) : (
                <>
                  <button onClick={pauseTimer} className="timer-btn pause">
                    ⏸ Pause
                  </button>
                  <button onClick={resetTimer} className="timer-btn reset">
                    ↺ Reset
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="current-task">
            <label>What are you studying?</label>
            <select 
              value={taskSubject} 
              onChange={(e) => setTaskSubject(e.target.value)}
              className="subject-select"
            >
              {subjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
            <input
              type="text"
              value={currentTask}
              onChange={(e) => setCurrentTask(e.target.value)}
              placeholder="e.g., Chapter 5, Exercise set..."
              className="task-input"
            />
          </div>

          <div className="pomodoro-counter">
            <span>Pomodoros completed today: </span>
            <span className="counter-value">{pomodoroCount}</span>
          </div>

          <div className="recent-sessions">
            <h3>Recent Sessions</h3>
            <div className="sessions-list">
              {studySessions.slice(0, 5).map(session => (
                <div key={session.id} className="session-item">
                  <span className="session-time">
                    {format(session.startTime?.toDate(), 'h:mm a')}
                  </span>
                  <span className="session-task">{session.task || 'Study'}</span>
                  <span className="session-duration">
                    {Math.round(session.duration / 60)} min
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div className="schedule-tab">
          <div className="date-selector">
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="date-input"
            />
          </div>

          <form onSubmit={addTask} className="add-task-form">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Task name..."
              className="task-input"
              required
            />
            <div className="task-form-row">
              <select value={taskSubject} onChange={(e) => setTaskSubject(e.target.value)}>
                {subjects.map(subject => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
              <input
                type="number"
                value={taskDuration}
                onChange={(e) => setTaskDuration(parseInt(e.target.value))}
                min="5"
                max="240"
                step="5"
                className="duration-input"
              />
              <span>min</span>
            </div>
            <button type="submit" className="add-task-btn">
              Add Task
            </button>
          </form>

          <div className="tasks-list">
            <h3>Tasks for {format(selectedDate, 'MMMM d, yyyy')}</h3>
            {tasksForSelectedDate.length === 0 ? (
              <p className="empty-tasks">No tasks scheduled</p>
            ) : (
              tasksForSelectedDate.map(task => (
                <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => toggleTask(task)}
                    className="task-checkbox"
                  />
                  <div className="task-content">
                    <span className="task-title">{task.title}</span>
                    <div className="task-meta">
                      <span className="task-subject">{task.subject}</span>
                      <span className="task-duration">{task.duration} min</span>
                    </div>
                  </div>
                  <button onClick={() => deleteTask(task.id)} className="delete-task-btn">
                    🗑️
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Statistics Tab */}
      {activeTab === 'stats' && (
        <div className="stats-tab">
          <div className="weekly-summary">
            <h3>This Week's Progress</h3>
            <div className="weekly-chart">
              {weeklyData.map(day => (
                <div key={day.date} className="chart-bar-container">
                  <div className="chart-bar-wrapper">
                    <div 
                      className="chart-bar"
                      style={{ 
                        height: `${Math.min((day.minutes / 240) * 100, 100)}%`,
                        backgroundColor: day.minutes > 0 ? 'var(--primary)' : 'var(--border)'
                      }}
                    />
                  </div>
                  <span className="chart-label">{day.day}</span>
                  <span className="chart-value">{day.minutes}m</span>
                </div>
              ))}
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card-large">
              <h4>Subject Breakdown</h4>
              <div className="subject-breakdown">
                {subjects.map(subject => {
                  const subjectTime = studySessions
                    .filter(s => s.subject === subject)
                    .reduce((acc, s) => acc + (s.duration / 60), 0);
                  
                  if (subjectTime === 0) return null;
                  
                  const percentage = (subjectTime / totalStudyTime) * 100;
                  
                  return (
                    <div key={subject} className="subject-stat">
                      <span className="subject-name">{subject}</span>
                      <div className="subject-bar">
                        <div 
                          className="subject-fill"
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: getSubjectColor(subject)
                          }}
                        />
                      </div>
                      <span className="subject-time">{subjectTime.toFixed(1)}h</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="stat-card-large">
              <h4>Study Streak</h4>
              <div className="streak-display">
                <div className="streak-circle">
                  <span className="streak-number">{calculateStreak(studySessions)}</span>
                  <span className="streak-label">days</span>
                </div>
                <p className="streak-message">
                  {getStreakMessage(calculateStreak(studySessions))}
                </p>
              </div>
            </div>

            <div className="stat-card-large">
              <h4>Productivity Insights</h4>
              <div className="insights-list">
                <div className="insight-item">
                  <span>Best study day:</span>
                  <strong>{getBestDay(weeklyData)}</strong>
                </div>
                <div className="insight-item">
                  <span>Average session:</span>
                  <strong>{(totalStudyTime / totalPomodoros || 0).toFixed(1)} min</strong>
                </div>
                <div className="insight-item">
                  <span>Most productive subject:</span>
                  <strong>{getTopSubject(studySessions)}</strong>
                </div>
                <div className="insight-item">
                  <span>Completion rate:</span>
                  <strong>{getCompletionRate(tasks)}%</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions
function calculateStreak(sessions) {
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
}

function getStreakMessage(streak) {
  if (streak === 0) return "Start your study streak today!";
  if (streak < 3) return "Good start! Keep it up!";
  if (streak < 7) return "Building momentum! 🔥";
  if (streak < 30) return "Amazing consistency! 🌟";
  return "Study master! 👑";
}

function getSubjectColor(subject) {
  const colors = {
    'Mathematics': '#f44336',
    'Physics': '#2196f3',
    'Chemistry': '#4caf50',
    'Biology': '#8bc34a',
    'History': '#ff9800',
    'Literature': '#9c27b0',
    'Languages': '#00bcd4',
    'Programming': '#3f51b5',
    'Art': '#e91e63',
    'Music': '#ff5722',
    'General': '#607d8b',
    'Other': '#795548'
  };
  return colors[subject] || '#757575';
}

function getBestDay(weeklyData) {
  const best = weeklyData.reduce((max, day) => day.minutes > max.minutes ? day : max, weeklyData[0]);
  return best ? `${best.day} (${best.minutes} min)` : 'N/A';
}

function getTopSubject(sessions) {
  const subjectCount = {};
  sessions.forEach(session => {
    subjectCount[session.subject] = (subjectCount[session.subject] || 0) + 1;
  });
  
  const topSubject = Object.entries(subjectCount).sort((a, b) => b[1] - a[1])[0];
  return topSubject ? topSubject[0] : 'N/A';
}

function getCompletionRate(tasks) {
  if (tasks.length === 0) return 0;
  const completed = tasks.filter(t => t.completed).length;
  return Math.round((completed / tasks.length) * 100);
}