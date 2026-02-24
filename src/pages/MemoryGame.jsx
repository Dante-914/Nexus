import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, addDoc, query, where, onSnapshot, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import './MemoryGame.css';

export default function MemoryGame() {
  const { currentUser } = useAuth();
  const [gameState, setGameState] = useState('menu');
  const [cards, setCards] = useState([]);
  const [flippedIndices, setFlippedIndices] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState([]);
  const [moves, setMoves] = useState(0);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [difficulty, setDifficulty] = useState('easy');
  const [theme, setTheme] = useState('animals');
  const [highScores, setHighScores] = useState([]);
  const [loadingScores, setLoadingScores] = useState(false);
  const [gameMessage, setGameMessage] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [personalBest, setPersonalBest] = useState(null);
  
  const timerRef = useRef(null);
  const audioRef = useRef({
    flip: new Audio('https://actions.google.com/sounds/v1/alarms/soft_doorbell.ogg'),
    match: new Audio('https://actions.google.com/sounds/v1/alarms/positive.ogg'),
    win: new Audio('https://actions.google.com/sounds/v1/alarms/ding.ogg')
  });

  // Theme configurations
  const themes = {
    animals: {
      name: '🐾 Animals',
      emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐸', '🐧', '🐦'],
      colors: ['#ff9999', '#99ff99', '#9999ff', '#ffff99', '#ff99ff', '#99ffff']
    },
    food: {
      name: '🍕 Food',
      emojis: ['🍎', '🍕', '🍔', '🍟', '🌮', '🍣', '🍦', '🍩', '🍪', '🍫', '🍉', '🍇'],
      colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9']
    },
    sports: {
      name: '⚽ Sports',
      emojis: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥊', '⛳'],
      colors: ['#ff9f43', '#ee5a24', '#ff6b81', '#ffcccc', '#70a1ff', '#1e90ff']
    },
    space: {
      name: '🚀 Space',
      emojis: ['🚀', '👽', '🛸', '🌍', '🌕', '⭐', '☄️', '🌌', '🔭', '🛰️', '👾', '🌠'],
      colors: ['#4834d4', '#686de0', '#7ed6df', '#22a6b3', '#30336b', '#130f40']
    },
    emoji: {
      name: '😊 Emojis',
      emojis: ['😀', '😎', '🥳', '😍', '🤔', '😴', '🤯', '🥶', '🤠', '👻', '💀', '👽'],
      colors: ['#fdcb6e', '#e17055', '#d63031', '#f0932b', '#badc58', '#6ab04c']
    }
  };

  // Difficulty settings
  const difficultySettings = {
    easy: { pairs: 6, gridCols: 3, timeBonus: 100 },
    medium: { pairs: 8, gridCols: 4, timeBonus: 200 },
    hard: { pairs: 12, gridCols: 4, timeBonus: 300 }
  };

  // Fetch high scores with better error handling
  useEffect(() => {
    fetchHighScores();
  }, []);

  const fetchHighScores = async () => {
    setLoadingScores(true);
    try {
      const q = query(
        collection(db, 'memoryGameScores'),
        orderBy('score', 'desc'),
        limit(10)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const scores = [];
        snapshot.forEach((doc) => {
          scores.push({ id: doc.id, ...doc.data() });
        });
        console.log('Fetched scores:', scores); // Debug log
        setHighScores(scores);
        setLoadingScores(false);
      }, (error) => {
        console.error('Error fetching scores:', error);
        setLoadingScores(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up scores listener:', error);
      setLoadingScores(false);
    }
  };

  // Fetch personal best
  useEffect(() => {
    if (currentUser) {
      fetchPersonalBest();
    }
  }, [currentUser]);

  const fetchPersonalBest = async () => {
    try {
      const q = query(
        collection(db, 'memoryGameScores'),
        where('userId', '==', currentUser.uid),
        orderBy('score', 'desc'),
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        setPersonalBest(querySnapshot.docs[0].data().score);
      }
    } catch (error) {
      console.error('Error fetching personal best:', error);
    }
  };

  // Timer logic
  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => {
        setTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }

    return () => clearInterval(timerRef.current);
  }, [timerActive]);

  // Initialize game
  const startGame = () => {
    const pairs = difficultySettings[difficulty].pairs;
    const selectedEmojis = themes[theme].emojis.slice(0, pairs);
    
    // Create pairs and shuffle
    let gameCards = [...selectedEmojis, ...selectedEmojis].map((emoji, index) => ({
      id: index,
      emoji,
      flipped: false,
      matched: false,
      pairId: Math.floor(index / 2)
    }));
    
    // Shuffle cards
    gameCards = shuffleArray(gameCards);
    
    setCards(gameCards);
    setFlippedIndices([]);
    setMatchedPairs([]);
    setMoves(0);
    setScore(0);
    setTime(0);
    setGameState('playing');
    setTimerActive(true);
    setGameMessage('');
  };

  // Shuffle array
  const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  // Handle card click
  const handleCardClick = (index) => {
    if (
      gameState !== 'playing' ||
      cards[index].flipped ||
      cards[index].matched ||
      flippedIndices.length === 2
    ) {
      return;
    }

    audioRef.current.flip.play().catch(() => {});

    const newCards = [...cards];
    newCards[index].flipped = true;
    setCards(newCards);
    
    const newFlippedIndices = [...flippedIndices, index];
    setFlippedIndices(newFlippedIndices);

    if (newFlippedIndices.length === 2) {
      setMoves(prev => prev + 1);
      checkMatch(newFlippedIndices[0], newFlippedIndices[1]);
    }
  };

  // Check if flipped cards match
  const checkMatch = (index1, index2) => {
    const card1 = cards[index1];
    const card2 = cards[index2];

    if (card1.emoji === card2.emoji) {
      audioRef.current.match.play().catch(() => {});
      
      const newCards = [...cards];
      newCards[index1].matched = true;
      newCards[index2].matched = true;
      setCards(newCards);
      
      setMatchedPairs(prev => [...prev, card1.pairId]);
      setFlippedIndices([]);
      
      // Calculate score
      const timeBonus = Math.max(0, difficultySettings[difficulty].timeBonus - Math.floor(time / 10));
      const movePenalty = moves * 5;
      const pairScore = 100 + timeBonus - movePenalty;
      setScore(prev => Math.max(0, prev + pairScore));

      const totalPairs = difficultySettings[difficulty].pairs;
      if (matchedPairs.length + 1 === totalPairs) {
        gameComplete();
      }
    } else {
      setTimeout(() => {
        const newCards = [...cards];
        newCards[index1].flipped = false;
        newCards[index2].flipped = false;
        setCards(newCards);
        setFlippedIndices([]);
      }, 800);
    }
  };

  // Game complete with better score saving
  const gameComplete = async () => {
  setTimerActive(false);
  setGameState('completed');
  setShowCelebration(true);
  audioRef.current.win.play().catch(() => {});

  // Calculate final score
  const finalScore = score + (difficultySettings[difficulty].timeBonus * 2);

  // Save score to Firestore with better error handling
  if (currentUser) {
    try {
      // Validate required fields
      if (!currentUser.uid) {
        throw new Error('User ID is missing');
      }

      // Get username safely
      const userName = currentUser.displayName || 
                      currentUser.email?.split('@')[0] || 
                      'Player';

      const scoreData = {
        userId: currentUser.uid,
        userName: userName,
        score: Math.round(finalScore), // Ensure it's a number
        moves: moves,
        time: time,
        difficulty: difficulty,
        theme: theme,
        createdAt: new Date().toISOString(),
        timestamp: serverTimestamp() // Optional: for Firestore timestamps
      };

      console.log('Attempting to save score:', scoreData);

      // Add timeout to the Firebase operation
      const savePromise = addDoc(collection(db, 'memoryGameScores'), scoreData);
      
      // Set a timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Save operation timed out')), 10000);
      });

      const docRef = await Promise.race([savePromise, timeoutPromise]);
      console.log('Score saved successfully with ID:', docRef.id);

      // Update personal best
      if (!personalBest || finalScore > personalBest) {
        setPersonalBest(finalScore);
      }

      // Show success message
      setGameMessage('Score saved successfully!');

      // Force refresh high scores
      setTimeout(() => {
        fetchHighScores();
      }, 500);

    } catch (error) {
      console.error('Detailed error saving score:', error);
      
      // Handle specific Firebase error codes
      if (error.code === 'permission-denied') {
        setGameMessage('Permission denied. Please check Firestore rules.');
      } else if (error.code === 'unavailable') {
        setGameMessage('Network error. Please check your connection.');
      } else if (error.code === 'not-found') {
        setGameMessage('Collection not found. Please check Firestore setup.');
      } else {
        setGameMessage(`Failed to save score: ${error.message}`);
      }
      
      // Still show the score locally even if save fails
      console.log('Local score:', finalScore);
    }
  } else {
    setGameMessage('Sign in to save your score!');
  }

  setTimeout(() => setShowCelebration(false), 3000);
};

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="page-container">
      <div className="memory-game-container">
        <div className="memory-game-header">
          <h1>Theme Match</h1>
          <div className="game-stats">
            {gameState === 'playing' && (
              <>
                <div className="stat">
                  <span className="stat-label">Moves</span>
                  <span className="stat-value">{moves}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Time</span>
                  <span className="stat-value">{formatTime(time)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Score</span>
                  <span className="stat-value">{score}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Game Menu */}
        {gameState === 'menu' && (
          <div className="game-menu">
            <h2>Game Settings</h2>
            
            {gameMessage && <div className="error-message">{gameMessage}</div>}

            <div className="settings-section">
              <h3>Select Theme</h3>
              <div className="theme-selector">
                {Object.entries(themes).map(([key, themeData]) => (
                  <button
                    key={key}
                    className={`theme-btn ${theme === key ? 'active' : ''}`}
                    onClick={() => setTheme(key)}
                  >
                    <span className="theme-emoji">{themeData.emojis[0]}</span>
                    <span className="theme-name">{themeData.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-section">
              <h3>Difficulty</h3>
              <div className="difficulty-selector">
                {['easy', 'medium', 'hard'].map(level => (
                  <button
                    key={level}
                    className={`difficulty-btn ${difficulty === level ? 'active' : ''}`}
                    onClick={() => setDifficulty(level)}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                    <span className="difficulty-desc">
                      {difficultySettings[level].pairs} pairs
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={startGame} className="start-game-btn">
              Start Game
            </button>

            {/* Personal Best */}
            {personalBest && (
              <div className="personal-best">
                <h3>Your Best</h3>
                <div className="best-score">{personalBest}</div>
              </div>
            )}

            {/* High Scores */}
            <div className="high-scores">
              <h3>Global High Scores</h3>
              {loadingScores ? (
                <div className="loading-scores">Loading scores...chill</div>
              ) : (
                <div className="scores-list">
                  {highScores.map((score, index) => (
                    <div key={score.id || index} className="score-item">
                      <span className="score-rank">#{index + 1}</span>
                      <span className="score-name">{score.userName || 'Anonymous'}</span>
                      <span className="score-value">{score.score}</span>
                      <span className="score-meta">
                        {score.difficulty} • {Math.floor(score.time / 60)}:{(score.time % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  ))}
                  {highScores.length === 0 && !loadingScores && (
                    <p className="no-scores">No scores yet. Be the first!</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Game Board */}
        {gameState === 'playing' && (
          <div className="game-board">
            <div 
              className="cards-grid" 
              style={{ 
                gridTemplateColumns: `repeat(${difficultySettings[difficulty].gridCols}, 1fr)` 
              }}
            >
              {cards.map((card, index) => (
                <div
                  key={index}
                  className={`card ${card.flipped ? 'flipped' : ''} ${card.matched ? 'matched' : ''}`}
                  onClick={() => handleCardClick(index)}
                >
                  <div className="card-inner">
                    <div className="card-front">
                      <span className="card-emoji">{card.emoji}</span>
                    </div>
                    <div className="card-back">
                      <span className="card-icon">❓</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={startGame} className="new-game-btn">
              New Game
            </button>
          </div>
        )}

        {/* Game Completed */}
        {gameState === 'completed' && (
          <div className="game-completed">
            <h2>Game Complete! 🎉</h2>
            <div className="final-stats">
              <div className="final-stat">
                <span>Final Score</span>
                <strong>{score + (difficultySettings[difficulty].timeBonus * 2)}</strong>
              </div>
              <div className="final-stat">
                <span>Total Moves</span>
                <strong>{moves}</strong>
              </div>
              <div className="final-stat">
                <span>Time Taken</span>
                <strong>{formatTime(time)}</strong>
              </div>
            </div>
            
            {personalBest && (score + (difficultySettings[difficulty].timeBonus * 2) > personalBest) && (
              <div className="new-record">
                🎉 New Personal Best! 🎉
              </div>
            )}
            
            <div className="completion-actions">
              <button onClick={startGame} className="play-again-btn">
                Play Again
              </button>
              <button 
                onClick={() => {
                  setGameState('menu');
                  fetchHighScores(); // Refresh scores when returning to menu
                }} 
                className="menu-btn"
              >
                Main Menu
              </button>
            </div>
          </div>
        )}

        {/* Celebration Animation */}
        {showCelebration && (
          <div className="celebration">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  backgroundColor: themes[theme].colors[i % themes[theme].colors.length]
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}