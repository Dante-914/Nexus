import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import './Todos.css';

export default function Todos() {
  const { currentUser } = useAuth();
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [filter, setFilter] = useState('all');
  const [category, setCategory] = useState('personal');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingTodo, setEditingTodo] = useState(null);
  const [editText, setEditText] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCompleted, setShowCompleted] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  // Animation refs
  const [headerRef, headerVisible] = useScrollAnimation({ threshold: 0.1 });
  const [formRef, formVisible] = useScrollAnimation({ threshold: 0.1 });
  const [filtersRef, filtersVisible] = useScrollAnimation({ threshold: 0.1 });
  const [statsRef, statsVisible] = useScrollAnimation({ threshold: 0.1 });
  const [listRef, listVisible] = useScrollAnimation({ threshold: 0.1 });
  const [emptyRef, emptyVisible] = useScrollAnimation({ threshold: 0.1 });

  const categories = ['personal', 'work', 'shopping', 'health', 'other'];

  // Helper function to format date to DD/MM/YYYY for display
  const formatDateToDDMMYYYY = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Get motivational quote based on todo stats
  const getMotivationalQuote = () => {
    const activeCount = todos.filter(t => !t.completed).length;
    const completedCount = todos.filter(t => t.completed).length;
    
    if (completedCount > 10) {
      return "🌟 You're on fire! Keep up the amazing productivity!";
    } else if (completedCount > 5) {
      return "🎯 Great progress! You're crushing your goals!";
    } else if (completedCount > 0) {
      return "💪 Good start! Keep the momentum going!";
    } else if (activeCount > 5) {
      return "📋 You have several tasks. Take them one at a time!";
    } else {
      return "✨ Ready to be productive? Add your first task!";
    }
  };

  useEffect(() => {
    if (!currentUser) return;

    let unsubscribe;

    const setupListener = () => {
      try {
        const q = query(
          collection(db, 'todos'),
          where('userId', '==', currentUser.uid)
        );

        unsubscribe = onSnapshot(q, (snapshot) => {
          const todoData = [];
          snapshot.forEach((doc) => {
            todoData.push({ id: doc.id, ...doc.data() });
          });
          todoData.sort((a, b) => {
            if (a.createdAt && b.createdAt) {
              return b.createdAt.toMillis() - a.createdAt.toMillis();
            }
            return 0;
          });
          setTodos(todoData);
          setLoading(false);
          setError('');
        }, (error) => {
          console.error("Error fetching todos:", error);
          if (error.code === 'permission-denied') {
            setError('Permission denied. Please check Firebase security rules.');
          } else if (error.code === 'unavailable') {
            setError('Network error. Please check your connection and disable ad blocker for this site.');
          } else {
            setError('Failed to load todos: ' + error.message);
          }
          setLoading(false);
        });
      } catch (err) {
        console.error('Error setting up listener:', err);
        setError('Failed to connect to database. Please disable ad blocker for this site.');
        setLoading(false);
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentUser, retryCount]);

  const addTodo = async (e) => {
    e.preventDefault();
    if (!newTodo.trim()) return;

    // Add haptic feedback if on mobile
    if (window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(10);
    }

    try {
      setError('');
      await addDoc(collection(db, 'todos'), {
        text: newTodo,
        completed: false,
        category,
        dueDate: dueDate || null,
        userId: currentUser.uid,
        createdAt: serverTimestamp()
      });
      setNewTodo('');
      setDueDate('');
      
      // Show success animation
      const form = document.querySelector('.add-todo-form');
      form.classList.add('success-shake');
      setTimeout(() => form.classList.remove('success-shake'), 500);
      
    } catch (error) {
      console.error('Error adding todo:', error);
      if (error.code === 'permission-denied') {
        setError('Permission denied. Please check Firebase security rules.');
      } else if (error.code === 'unavailable') {
        setError('Network error. Please disable ad blocker for this site.');
      } else {
        setError('Failed to add todo: ' + error.message);
      }
    }
  };

  const toggleTodo = async (todo) => {
    try {
      setError('');
      
      // Add haptic feedback
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(5);
      }

      const todoRef = doc(db, 'todos', todo.id);
      await updateDoc(todoRef, {
        completed: !todo.completed
      });
      
    } catch (error) {
      console.error('Error updating todo:', error);
      if (error.code === 'permission-denied') {
        setError('Permission denied. Please check Firebase security rules.');
      } else if (error.code === 'unavailable') {
        setError('Network error. Please disable ad blocker for this site.');
      } else {
        setError('Failed to update todo: ' + error.message);
      }
    }
  };

  const deleteTodo = async (todoId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      
      // Add haptic feedback
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(20);
      }

      try {
        setError('');
        await deleteDoc(doc(db, 'todos', todoId));
      } catch (error) {
        console.error('Error deleting todo:', error);
        if (error.code === 'permission-denied') {
          setError('Permission denied. Please check Firebase security rules.');
        } else if (error.code === 'unavailable') {
          setError('Network error. Please disable ad blocker for this site.');
        } else {
          setError('Failed to delete todo: ' + error.message);
        }
      }
    }
  };

  const startEditing = (todo) => {
    setEditingTodo(todo.id);
    setEditText(todo.text);
    setEditCategory(todo.category);
    setEditDueDate(todo.dueDate || '');
    
    // Scroll to editing item
    setTimeout(() => {
      const element = document.getElementById(`todo-${todo.id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const cancelEditing = () => {
    setEditingTodo(null);
    setEditText('');
    setEditCategory('');
    setEditDueDate('');
  };

  const saveEdit = async (todoId) => {
    if (!editText.trim()) return;

    try {
      setError('');
      const todoRef = doc(db, 'todos', todoId);
      await updateDoc(todoRef, {
        text: editText,
        category: editCategory,
        dueDate: editDueDate || null
      });
      cancelEditing();
      
      // Show success animation
      const element = document.getElementById(`todo-${todoId}`);
      element.classList.add('save-flash');
      setTimeout(() => element.classList.remove('save-flash'), 500);
      
    } catch (error) {
      console.error('Error saving edit:', error);
      if (error.code === 'permission-denied') {
        setError('Permission denied. Please check Firebase security rules.');
      } else if (error.code === 'unavailable') {
        setError('Network error. Please disable ad blocker for this site.');
      } else {
        setError('Failed to save changes: ' + error.message);
      }
    }
  };

  const markAsCompleted = async (todo) => {
    try {
      setError('');
      
      // Add haptic feedback
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(15);
      }

      const todoRef = doc(db, 'todos', todo.id);
      await updateDoc(todoRef, {
        completed: true
      });
      
      // Celebration animation
      const element = document.getElementById(`todo-${todo.id}`);
      element.classList.add('completed-celebration');
      setTimeout(() => element.classList.remove('completed-celebration'), 700);
      
    } catch (error) {
      console.error('Error marking as completed:', error);
      if (error.code === 'permission-denied') {
        setError('Permission denied. Please check Firebase security rules.');
      } else if (error.code === 'unavailable') {
        setError('Network error. Please disable ad blocker for this site.');
      } else {
        setError('Failed to mark as completed: ' + error.message);
      }
    }
  };

  const retryConnection = () => {
    setRetryCount(prev => prev + 1);
    setLoading(true);
    setError('');
  };

  // Filter and search todos
  const filteredTodos = todos.filter(todo => {
    // Filter by completion status
    if (filter === 'active' && todo.completed) return false;
    if (filter === 'completed' && !todo.completed) return false;
    
    // Filter by search term
    if (searchTerm && !todo.text.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    return true;
  });

  const stats = {
    total: todos.length,
    completed: todos.filter(t => t.completed).length,
    active: todos.filter(t => !t.completed).length,
    completionRate: todos.length > 0 ? Math.round((todos.filter(t => t.completed).length / todos.length) * 100) : 0
  };

  if (loading) {
    return (
      <div className="todos-container loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your tasks...chill</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="todos-container">
      {/* Motivational Header */}
      <div 
        ref={headerRef}
        className={`motivational-header animate-on-scroll fade-in-up ${headerVisible ? 'visible' : ''}`}
      >
        <div className="motivation-icon">🎯</div>
        <div className="motivation-text">
          <h2>{getMotivationalQuote()}</h2>
          <p>You've completed {stats.completed} out of {stats.total} tasks</p>
        </div>
      </div>
    
      {/* Stats Cards */}
      <div 
        ref={statsRef}
        className={`stats-grid animate-on-scroll fade-in-up ${statsVisible ? 'visible' : ''}`}
      >
        <div className="stat-card total hover-lift">
          <div className="stat-icon">📊</div>
          <div className="stat-details">
            <span className="stat-label">Total Tasks</span>
            <span className="stat-value">{stats.total}</span>
          </div>
        </div>
        <div className="stat-card active hover-lift">
          <div className="stat-icon">⏳</div>
          <div className="stat-details">
            <span className="stat-label">Active</span>
            <span className="stat-value">{stats.active}</span>
          </div>
        </div>
        <div className="stat-card completed hover-lift">
          <div className="stat-icon">✅</div>
          <div className="stat-details">
            <span className="stat-label">Completed</span>
            <span className="stat-value">{stats.completed}</span>
          </div>
        </div>
        <div className="stat-card rate hover-lift">
          <div className="stat-icon">📈</div>
          <div className="stat-details">
            <span className="stat-label">Completion Rate</span>
            <span className="stat-value">{stats.completionRate}%</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-section">
        <div className="progress-label">
          <span>Overall Progress</span>
          <span>{stats.completionRate}%</span>
        </div>
        <div className="progress-bar-container">
          <div 
            className="progress-bar-fill" 
            style={{ width: `${stats.completionRate}%` }}
          ></div>
        </div>
      </div>

      {error && (
        <div className="error-message slide-in">
          <p>{error}</p>
          {error.includes('ad blocker') && (
            <button onClick={retryConnection} className="retry-btn pulse">
              Retry Connection
            </button>
          )}
        </div>
      )}

      {/* Add Todo Form */}
      <form 
        ref={formRef}
        onSubmit={addTodo} 
        className={`add-todo-form animate-on-scroll slide-in-left ${formVisible ? 'visible' : ''}`}
      >
        <div className="form-header">
          <h3>Add New Task</h3>
          <span className="form-badge">{categories.find(c => c === category)?.charAt(0).toUpperCase() + category.slice(1)}</span>
        </div>
        
        <input
          type="text"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder="What needs to be done?"
          className="todo-input"
          required
        />
        
        <div className="todo-form-options">
          <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value)} 
            className="category-select"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </option>
            ))}
          </select>
          
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="date-input"
          />
          
          <button type="submit" className="add-btn hover-scale">
            <span>Add Task</span>
            <span className="btn-icon">+</span>
          </button>
        </div>
      </form>

      {/* Search and Filters */}
      <div 
        ref={filtersRef}
        className={`filters-section animate-on-scroll fade-in ${filtersVisible ? 'visible' : ''}`}
      >
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All <span className="filter-count">{stats.total}</span>
          </button>
          <button 
            className={`filter-tab ${filter === 'active' ? 'active' : ''}`}
            onClick={() => setFilter('active')}
          >
            Active <span className="filter-count">{stats.active}</span>
          </button>
          <button 
            className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => setFilter('completed')}
          >
            Completed <span className="filter-count">{stats.completed}</span>
          </button>
        </div>

        <div className="view-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
            />
            <span>Show completed tasks</span>
          </label>
        </div>
      </div>

      {/* Todo List */}
      <div 
        ref={listRef}
        className={`todo-list-section animate-on-scroll fade-in-up ${listVisible ? 'visible' : ''}`}
      >
        <h3 className="list-title">
          {filter === 'all' && 'All Tasks'}
          {filter === 'active' && 'Active Tasks'}
          {filter === 'completed' && 'Completed Tasks'}
          <span className="task-count">{filteredTodos.length} tasks</span>
        </h3>

        {filteredTodos.length === 0 ? (
          <div 
            ref={emptyRef}
            className={`empty-state animate-on-scroll scale-in ${emptyVisible ? 'visible' : ''}`}
          >
            <div className="empty-illustration">📭</div>
            <h4>No tasks found</h4>
            <p>
              {searchTerm 
                ? "No tasks match your search. Try different keywords!"
                : filter !== 'all' 
                  ? `No ${filter} tasks. Time to be productive!`
                  : "Your task list is empty. Add your first task above!"}
            </p>
            {!searchTerm && filter === 'all' && (
              <button 
                className="empty-state-btn"
                onClick={() => document.querySelector('.todo-input').focus()}
              >
                Add Your First Task
              </button>
            )}
          </div>
        ) : (
          <div className="todo-list">
            {filteredTodos.map((todo, index) => (
              <div 
                key={todo.id} 
                id={`todo-${todo.id}`}
                className={`todo-item ${todo.completed ? 'completed' : ''} hover-lift`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {editingTodo === todo.id ? (
                  // Edit Mode
                  <div className="todo-edit-mode">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="edit-input"
                      autoFocus
                    />
                    <div className="edit-options">
                      <select 
                        value={editCategory} 
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="edit-select"
                      >
                        {categories.map(cat => (
                          <option key={cat} value={cat}>
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                          </option>
                        ))}
                      </select>
                      
                      <input
                        type="date"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        className="edit-date"
                      />
                      
                      <div className="edit-actions">
                        <button onClick={() => saveEdit(todo.id)} className="save-btn">
                          <span>Save</span>
                        </button>
                        <button onClick={cancelEditing} className="cancel-btn">
                          <span>Cancel</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <>
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => toggleTodo(todo)}
                      className="todo-checkbox"
                    />
                    
                    <div className="todo-content">
                      <span className="todo-text">{todo.text}</span>
                      <div className="todo-meta">
                        <span className={`category-tag ${todo.category}`}>
                          {todo.category}
                        </span>
                        {todo.dueDate && (
                          <span className="due-date">
                            📅 {formatDateToDDMMYYYY(todo.dueDate)}
                          </span>
                        )}
                        {todo.createdAt && (
                          <span className="created-date">
                            🕒 {new Date(todo.createdAt.toDate()).toLocaleDateString('en-GB')}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="todo-actions">
                      {!todo.completed && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsCompleted(todo);
                          }} 
                          className="action-btn complete-btn"
                          title="Mark as completed"
                        >
                          ✓
                        </button>
                      )}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(todo);
                        }} 
                        className="action-btn edit-btn"
                        title="Edit task"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTodo(todo.id);
                        }} 
                        className="action-btn delete-btn"
                        title="Delete task"
                      >
                        🗑️
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Tips */}
      {todos.length > 0 && (
        <div className="quick-tips fade-in">
          <div className="tip">
            <span className="tip-icon">💡</span>
            <span>Tip: Click the ✓ button to quickly complete tasks</span>
          </div>
          <div className="tip">
            <span className="tip-icon">⌨️</span>
            <span>Tip: Use the search bar to find specific tasks</span>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}