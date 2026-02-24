import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  onSnapshot, 
  orderBy,
  getDocs,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { Chess } from 'chess.js';
import './ChessGame.css';

// Create Stockfish worker
const stockfishWorker = new Worker(new URL('stockfish.js', import.meta.url));

export default function ChessGame() {
  const { currentUser } = useAuth();
  const [game, setGame] = useState(new Chess());
  const [boardState, setBoardState] = useState([]);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [possibleMoves, setPossibleMoves] = useState([]);
  const [gameStatus, setGameStatus] = useState('playing');
  const [turn, setTurn] = useState('w');
  const [playerColor, setPlayerColor] = useState('w');
  const [aiDifficulty, setAiDifficulty] = useState(10);
  const [gameHistory, setGameHistory] = useState([]);
  const [capturedPieces, setCapturedPieces] = useState({ w: [], b: [] });
  const [thinking, setThinking] = useState(false);
  const [gameMode, setGameMode] = useState('menu');
  const [gameResult, setGameResult] = useState('');
  
  // New state for last move
  const [lastMove, setLastMove] = useState(null);
  
  // Undo/Redo states
  const [historyStack, setHistoryStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Difficulty color helper
  const getDifficultyColor = (lvl) => {
    if (lvl <= 3) return '#4caf50';
    if (lvl <= 7) return '#2196f3';
    if (lvl <= 12) return '#ff9800';
    if (lvl <= 16) return '#f44336';
    return '#b71c1c';
  };

  // Difficulty text helper
  const getDifficultyText = (lvl) => {
    if (lvl <= 3) return 'Beginner';
    if (lvl <= 7) return 'Easy';
    if (lvl <= 12) return 'Intermediate';
    if (lvl <= 16) return 'Advanced';
    return 'Expert';
  };
  
  // Save/Load states
  const [savedGames, setSavedGames] = useState([]);
  const [showSavedGames, setShowSavedGames] = useState(false);
  const [gameName, setGameName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [currentGameId, setCurrentGameId] = useState(null);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState(false);
  const [gameToOverwrite, setGameToOverwrite] = useState(null);
  
  const gameRef = useRef(game);
  const thinkingTimeoutRef = useRef(null);

  // Update ref when game changes
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  // Keyboard shortcut for Undo (Ctrl+Z)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if (((e.ctrlKey || e.metaKey) && e.key === 'y') || 
          ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyStack, redoStack, gameMode, thinking, playerColor, game.turn()]);

  // Initialize Stockfish
  useEffect(() => {
    console.log('Initializing Stockfish...');
    
    stockfishWorker.onmessage = (event) => {
      const message = event.data;
      console.log('Stockfish message:', message);
      
      if (typeof message === 'string') {
        if (message.startsWith('bestmove')) {
          const parts = message.split(' ');
          const bestMove = parts[1];
          
          if (bestMove && bestMove !== '(none)') {
            console.log('AI best move:', bestMove);
            if (thinkingTimeoutRef.current) {
              clearTimeout(thinkingTimeoutRef.current);
            }
            setTimeout(() => makeAIMove(bestMove), 100);
          } else {
            setThinking(false);
          }
        } else if (message === 'readyok') {
          console.log('Stockfish ready');
          stockfishWorker.postMessage(`setoption name Skill Level value ${aiDifficulty}`);
        }
      }
    };

    stockfishWorker.postMessage('uci');
    stockfishWorker.postMessage('isready');

    return () => {
      stockfishWorker.terminate();
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current);
      }
    };
  }, []);

  // Fetch saved games from Firestore
  useEffect(() => {
    if (!currentUser) {
      console.log('No user logged in');
      return;
    }

    console.log('Fetching saved games for user:', currentUser.uid);
    setLoading(true);
    setFetchError('');

    const fetchSavedGames = async () => {
      try {
        const q = query(
          collection(db, 'chessGames'),
          where('userId', '==', currentUser.uid),
          orderBy('savedAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const games = [];
        querySnapshot.forEach((doc) => {
          games.push({ id: doc.id, ...doc.data() });
        });
        
        console.log('Fetched saved games:', games);
        console.log('Number of games found:', games.length);
        
        setSavedGames(games);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching saved games:', error);
        setFetchError('Failed to load saved games: ' + error.message);
        setLoading(false);
      }
    };

    fetchSavedGames();

    const unsubscribe = onSnapshot(
      query(
        collection(db, 'chessGames'),
        where('userId', '==', currentUser.uid),
        orderBy('savedAt', 'desc')
      ),
      (snapshot) => {
        const games = [];
        snapshot.forEach((doc) => {
          games.push({ id: doc.id, ...doc.data() });
        });
        console.log('Real-time update - saved games:', games);
        setSavedGames(games);
        setLoading(false);
      },
      (error) => {
        console.error('Error in real-time listener:', error);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Update difficulty when changed
  useEffect(() => {
    if (gameMode === 'playing') {
      stockfishWorker.postMessage(`setoption name Skill Level value ${aiDifficulty}`);
    }
  }, [aiDifficulty, gameMode]);

  // Update board when game changes
  useEffect(() => {
    updateBoardState();
    setTurn(game.turn());
    updateGameStatus();
  }, [game]);

  // Make AI move when it's AI's turn
  useEffect(() => {
    if (gameMode === 'playing' && !thinking && game.turn() !== playerColor && !game.isGameOver()) {
      console.log('AI turn detected, requesting move...');
      makeAIMoveRequest();
    }
  }, [game, playerColor, gameMode, thinking]);

  // Update board state
  const updateBoardState = () => {
    const board = [];
    for (let i = 0; i < 8; i++) {
      const row = [];
      for (let j = 0; j < 8; j++) {
        const square = String.fromCharCode(97 + j) + (8 - i);
        const piece = game.get(square);
        row.push(piece);
      }
      board.push(row);
    }
    setBoardState(board);
  };

  // Update game status
  const updateGameStatus = () => {
    if (game.isCheckmate()) {
      setGameStatus('checkmate');
      setGameResult(game.turn() === 'w' ? 'Black wins!' : 'White wins!');
      setGameMode('gameover');
    } else if (game.isStalemate()) {
      setGameStatus('stalemate');
      setGameResult('Stalemate!');
      setGameMode('gameover');
    } else if (game.isCheck()) {
      setGameStatus('check');
    } else {
      setGameStatus('playing');
    }
  };

  // Handle square click
  const handleSquareClick = (row, col) => {
    if (gameMode !== 'playing') return;
    if (thinking) return;
    if (playerColor !== game.turn()) return;

    const square = String.fromCharCode(97 + col) + (8 - row);

    if (selectedSquare) {
      const move = tryMove(selectedSquare, square);
      if (move) {
        makeMove(move);
      }
      setSelectedSquare(null);
      setPossibleMoves([]);
    } else {
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) {
        setSelectedSquare(square);
        const moves = game.moves({ square, verbose: true });
        setPossibleMoves(moves.map(m => m.to));
      }
    }
  };

  // Try to make a move
  const tryMove = (from, to) => {
    try {
      const gameCopy = new Chess(game.fen());
      const move = gameCopy.move({
        from,
        to,
        promotion: 'q'  
      });
      
      if (move) {
        const actualMove = game.move({
          from,
          to,
          promotion: 'q'
        });
        return actualMove;
      }
      return null;
    } catch (error) {
      console.log('Invalid move:', error);
      return null;
    }
  };

  // Save state to history for undo
  const saveToHistory = (move) => {
    const state = {
      fen: game.fen(),
      history: [...gameHistory],
      capturedPieces: { ...capturedPieces },
      lastMove: lastMove
    };
    
    setHistoryStack(prev => [...prev, state]);
    setRedoStack([]);
  };

  // Make a move and update game
  const makeMove = (move) => {
    console.log('Making move:', move);
    
    saveToHistory(move);
    
    if (move.captured) {
      const newCaptured = { ...capturedPieces };
      const capturedColor = move.color === 'w' ? 'b' : 'w';
      
      newCaptured[capturedColor] = [
        ...newCaptured[capturedColor],
        {
          type: move.captured,
          color: capturedColor
        }
      ];
      
      setCapturedPieces(newCaptured);
      console.log(`Captured ${move.captured} at ${move.to}`);
    }

    setLastMove({
      from: move.from,
      to: move.to
    });

    setGameHistory(prev => [...prev, {
      from: move.from,
      to: move.to,
      piece: move.piece,
      captured: move.captured,
      san: move.san,
      color: move.color
    }]);

    setGame(new Chess(game.fen()));
  };

  // Undo last move
  const handleUndo = () => {
    if (gameMode !== 'playing' && gameMode !== 'gameover') return;
    if (thinking) return;
    if (historyStack.length === 0) return;
    
    console.log('Undoing last move');
    
    const currentState = {
      fen: game.fen(),
      history: [...gameHistory],
      capturedPieces: { ...capturedPieces },
      lastMove: lastMove
    };
    
    const previousState = historyStack[historyStack.length - 1];
    
    const newGame = new Chess();
    newGame.load(previousState.fen);
    
    setGame(newGame);
    setGameHistory(previousState.history);
    setCapturedPieces(previousState.capturedPieces);
    setLastMove(previousState.lastMove);
    
    setHistoryStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, currentState]);
    
    setSelectedSquare(null);
    setPossibleMoves([]);
    
    setThinking(false);
    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current);
    }
  };

  // Redo last undone move
  const handleRedo = () => {
    if (redoStack.length === 0) return;
    if (thinking) return;
    
    console.log('Redoing last undone move');
    
    const redoState = redoStack[redoStack.length - 1];
    
    const currentState = {
      fen: game.fen(),
      history: [...gameHistory],
      capturedPieces: { ...capturedPieces },
      lastMove: lastMove
    };
    
    const newGame = new Chess();
    newGame.load(redoState.fen);
    
    setGame(newGame);
    setGameHistory(redoState.history);
    setCapturedPieces(redoState.capturedPieces);
    setLastMove(redoState.lastMove);
    
    setRedoStack(prev => prev.slice(0, -1));
    setHistoryStack(prev => [...prev, currentState]);
    
    setSelectedSquare(null);
    setPossibleMoves([]);
  };

  // Undo AI move (undo two moves - player and AI)
  const handleUndoAIMove = () => {
    if (playerColor !== game.turn()) {
      handleUndo();
    } else {
      handleUndo();
      setTimeout(() => handleUndo(), 100);
    }
  };

  // Request AI move from Stockfish
  const makeAIMoveRequest = () => {
    setThinking(true);
    console.log('Requesting AI move for position:', game.fen());
    
    const thinkTime = Math.min(500 + aiDifficulty * 100, 3000);
    
    stockfishWorker.postMessage(`position fen ${game.fen()}`);
    stockfishWorker.postMessage(`go movetime ${thinkTime}`);
    
    thinkingTimeoutRef.current = setTimeout(() => {
      console.log('AI move timeout - forcing random move');
      setThinking(false);
      
      const moves = game.moves();
      if (moves.length > 0) {
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        try {
          const move = game.move(randomMove);
          if (move) {
            makeMove(move);
          }
        } catch (error) {
          console.error('Fallback move error:', error);
        }
      }
    }, thinkTime + 1000);
  };

  // Make AI move
  const makeAIMove = (moveString) => {
    console.log('Processing AI move:', moveString);
    
    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current);
    }
    
    const from = moveString.substring(0, 2);
    const to = moveString.substring(2, 4);
    
    try {
      const currentGame = gameRef.current;
      
      const beforeState = {
        fen: currentGame.fen(),
        history: [...gameHistory],
        capturedPieces: { ...capturedPieces },
        lastMove: lastMove
      };
      
      const move = currentGame.move({
        from,
        to,
        promotion: 'q'
      });

      if (move) {
        console.log('AI move successful:', move);
        
        setHistoryStack(prev => [...prev, beforeState]);
        setRedoStack([]);
        
        if (move.captured) {
          const newCaptured = { ...capturedPieces };
          const capturedColor = move.color === 'w' ? 'b' : 'w';
          
          newCaptured[capturedColor] = [
            ...newCaptured[capturedColor],
            {
              type: move.captured,
              color: capturedColor
            }
          ];
          
          setCapturedPieces(newCaptured);
          console.log(`AI captured ${move.captured} at ${move.to}`);
        }

        setLastMove({
          from: move.from,
          to: move.to
        });

        setGameHistory(prev => [...prev, {
          from: move.from,
          to: move.to,
          piece: move.piece,
          captured: move.captured,
          san: move.san,
          color: move.color
        }]);

        setGame(new Chess(currentGame.fen()));
      } else {
        console.log('AI move invalid');
      }
    } catch (error) {
      console.error('AI move error:', error);
    } finally {
      setThinking(false);
    }
  };

  // Save game function
  const saveGame = async () => {
    console.log('Save game clicked');
    console.log('Current user:', currentUser);
    
    if (!currentUser) {
      setSaveError('Please login to save games');
      alert('Please login to save games');
      return;
    }

    if (!gameName.trim()) {
      setSaveError('Please enter a game name');
      alert('Please enter a game name');
      return;
    }

    setLoading(true);
    setSaveError('');

    try {
      const cleanHistory = gameHistory.map(move => ({
        from: move.from || '',
        to: move.to || '',
        piece: move.piece || '',
        captured: move.captured || null,
        san: move.san || '',
        color: move.color || 'w'
      }));

      const cleanCapturedPieces = {
        w: capturedPieces.w.map(p => ({ type: p.type || '', color: p.color || 'w' })),
        b: capturedPieces.b.map(p => ({ type: p.type || '', color: p.color || 'b' }))
      };

      const gameData = {
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Anonymous',
        gameName: gameName.trim(),
        fen: game.fen() || '',
        history: cleanHistory,
        playerColor: playerColor || 'w',
        aiDifficulty: aiDifficulty || 10,
        turn: game.turn() || 'w',
        capturedPieces: cleanCapturedPieces,
        lastMove: lastMove || null,
        savedAt: new Date().toISOString()
      };

      console.log('Saving game data:', gameData);

      if (currentGameId) {
        const gameRef = doc(db, 'chessGames', currentGameId);
        await updateDoc(gameRef, gameData);
        console.log('Game updated with ID:', currentGameId);
        alert('Game updated successfully!');
      } else {
        const docRef = await addDoc(collection(db, 'chessGames'), gameData);
        console.log('New game saved with ID:', docRef.id);
        setCurrentGameId(docRef.id);
        alert('Game saved successfully!');
      }
      
      setShowSaveDialog(false);
      setGameName('');
      setSaveError('');
      setShowOverwriteDialog(false);
      setGameToOverwrite(null);
      
    } catch (error) {
      console.error('Error saving game:', error);
      setSaveError('Failed to save game: ' + error.message);
      alert('Failed to save game: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle save button click
  const handleSaveClick = () => {
    if (currentGameId) {
      const savedGame = savedGames.find(g => g.id === currentGameId);
      if (savedGame) {
        setGameToOverwrite(savedGame);
        setShowOverwriteDialog(true);
      } else {
        setShowSaveDialog(true);
      }
    } else {
      setShowSaveDialog(true);
    }
  };

  // Handle overwrite confirmation
  const handleOverwrite = () => {
    setShowOverwriteDialog(false);
    setGameName(gameToOverwrite.gameName);
    setShowSaveDialog(true);
  };

  // Handle save as new
  const handleSaveAsNew = () => {
    setShowOverwriteDialog(false);
    setCurrentGameId(null);
    setGameName('');
    setShowSaveDialog(true);
  };

  // Load game function
  const loadGame = (savedGame) => {
    console.log('Loading game:', savedGame);
    
    try {
      const newGame = new Chess();
      newGame.load(savedGame.fen);
      
      setGame(newGame);
      setGameHistory(savedGame.history || []);
      setPlayerColor(savedGame.playerColor || 'w');
      setCapturedPieces(savedGame.capturedPieces || { w: [], b: [] });
      setAiDifficulty(savedGame.aiDifficulty || 10);
      setLastMove(savedGame.lastMove || null);
      setGameMode('playing');
      setShowSavedGames(false);
      setSelectedSquare(null);
      setPossibleMoves([]);
      setCurrentGameId(savedGame.id);
      setHistoryStack([]);
      setRedoStack([]);
      
      console.log('Game loaded successfully with ID:', savedGame.id);
      
    } catch (error) {
      console.error('Error loading game:', error);
      alert('Failed to load game: ' + error.message);
    }
  };

  // Delete saved game
  const deleteSavedGame = async (gameId) => {
    if (!window.confirm('Are you sure you want to delete this saved game?')) return;
    
    try {
      await deleteDoc(doc(db, 'chessGames', gameId));
      console.log('Game deleted successfully');
      
      if (currentGameId === gameId) {
        setCurrentGameId(null);
      }
    } catch (error) {
      console.error('Error deleting game:', error);
      alert('Failed to delete game: ' + error.message);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Start new game
  const startNewGame = (color) => {
    const newGame = new Chess();
    setGame(newGame);
    setPlayerColor(color);
    setGameHistory([]);
    setCapturedPieces({ w: [], b: [] });
    setSelectedSquare(null);
    setPossibleMoves([]);
    setLastMove(null);
    setGameMode('playing');
    setGameResult('');
    setThinking(false);
    setCurrentGameId(null);
    setHistoryStack([]);
    setRedoStack([]);
  };

  // Reset game
  const resetGame = () => {
    const newGame = new Chess();
    setGame(newGame);
    setGameHistory([]);
    setCapturedPieces({ w: [], b: [] });
    setSelectedSquare(null);
    setPossibleMoves([]);
    setLastMove(null);
    setGameMode('playing');
    setGameResult('');
    setThinking(false);
    setCurrentGameId(null);
    setHistoryStack([]);
    setRedoStack([]);
  };

  // Get piece symbol
  const getPieceSymbol = (piece) => {
    if (!piece) return '';
    
    const symbols = {
      p: { w: '♙', b: '♟' },
      n: { w: '♘', b: '♞' },
      b: { w: '♗', b: '♝' },
      r: { w: '♖', b: '♜' },
      q: { w: '♕', b: '♛' },
      k: { w: '♔', b: '♚' }
    };
    
    return symbols[piece.type]?.[piece.color] || '';
  };

  // Check if square is highlighted (possible move)
  const isHighlighted = (row, col) => {
    const square = String.fromCharCode(97 + col) + (8 - row);
    return possibleMoves.includes(square);
  };

  // Check if square is selected
  const isSelected = (row, col) => {
    const square = String.fromCharCode(97 + col) + (8 - row);
    return selectedSquare === square;
  };

  // Check if square is last move
  const isLastMove = (row, col) => {
    if (!lastMove) return false;
    const square = String.fromCharCode(97 + col) + (8 - row);
    return square === lastMove.from || square === lastMove.to;
  };

  // Check if square is in check
  const isInCheck = (row, col) => {
    if (!game.isCheck()) return false;
    const square = String.fromCharCode(97 + col) + (8 - row);
    const kingPosition = getKingPosition(game.turn());
    return square === kingPosition;
  };

  // Get king position
  const getKingPosition = (color) => {
    const board = game.board();
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = board[i][j];
        if (piece && piece.type === 'k' && piece.color === color) {
          return String.fromCharCode(97 + j) + (8 - i);
        }
      }
    }
    return '';
  };

  // Manual refresh saved games
  const refreshSavedGames = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'chessGames'),
        where('userId', '==', currentUser.uid),
        orderBy('savedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const games = [];
      querySnapshot.forEach((doc) => {
        games.push({ id: doc.id, ...doc.data() });
      });
      
      console.log('Manual refresh - saved games:', games);
      setSavedGames(games);
    } catch (error) {
      console.error('Error refreshing saved games:', error);
      setFetchError('Failed to refresh: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="chess-container">
        <div className="chess-header">
          <h1>Chess <span className="chess-master">Master</span></h1>
          <div className="chess-status">
            {gameMode === 'playing' && (
              <>
                <span className={`turn-indicator ${turn === 'w' ? 'white-turn' : 'black-turn'}`}>
                  {turn === 'w' ? 'White' : 'Black'} to move
                </span>
                {gameStatus === 'check' && <span className="check-indicator">CHECK!</span>}
                {thinking && <span className="thinking-indicator">AI thinking...</span>}
              </>
            )}
            {gameMode === 'gameover' && (
              <span className="gameover-indicator">{gameResult}</span>
            )}
          </div>
        </div>

        {gameMode === 'menu' ? (
          <div className="chess-menu">
            <h2>New Game</h2>
            
            <div className="menu-section">
              <h3>Choose your color</h3>
              <div className="color-selector">
                <button onClick={() => startNewGame('w')} className="color-btn white">
                  ⚪ Play as White
                </button>
                <button onClick={() => startNewGame('b')} className="color-btn black">
                  ⚫ Play as Black
                </button>
              </div>
            </div>

            <div className="menu-section">
              <h3>AI Difficulty</h3>
              <div className="difficulty-slider">
                <input
                  type="range"
                  min="0"
                  max="20"
                  value={aiDifficulty}
                  onChange={(e) => setAiDifficulty(parseInt(e.target.value))}
                  className="slider"
                  style={{
                    background: `linear-gradient(to right, 
                      ${getDifficultyColor(0)} 0%, 
                      ${getDifficultyColor(5)} 25%, 
                      ${getDifficultyColor(10)} 50%, 
                      ${getDifficultyColor(15)} 75%, 
                      ${getDifficultyColor(20)} 100%)`
                  }}
                />
                <div className="difficulty-value-container">
                  <span 
                    className="difficulty-value"
                    style={{ 
                      color: getDifficultyColor(aiDifficulty),
                      fontWeight: 'bold',
                      fontSize: '1.2rem'
                    }}
                  >
                    {getDifficultyText(aiDifficulty)}
                  </span>
                  <span className="difficulty-number">(Level {aiDifficulty})</span>
                </div>
                
                <div className="difficulty-levels">
                  <span>Beginner</span>
                  <span>Easy</span>
                  <span>Intermediate</span>
                  <span>Advanced</span>
                  <span>Expert</span>
                </div>
              </div>
            </div>

            <button onClick={() => startNewGame('w')} className="start-game-btn">
              Start Game
            </button>

            {savedGames.length > 0 && (
              <div className="saved-games-info">
                You have {savedGames.length} saved game{savedGames.length > 1 ? 's' : ''}
              </div>
            )}

            <button onClick={() => setShowSavedGames(true)} className="load-game-btn">
              Load Saved Game
            </button>
          </div>
        ) : (
          <div className="chess-game-area">
            {/* Current Game Indicator */}
            {currentGameId && (
              <div className="current-game-indicator">
                Playing saved game
              </div>
            )}

            {/* Captured Pieces */}
            <div className="captured-pieces">
              <div className="captured-white">
                <span>White captured: </span>
                {capturedPieces.b.map((piece, i) => (
                  <span key={i} className="captured-piece black-piece">
                    {getPieceSymbol(piece)}
                  </span>
                ))}
              </div>
              <div className="captured-black">
                <span>Black captured: </span>
                {capturedPieces.w.map((piece, i) => (
                  <span key={i} className="captured-piece white-piece">
                    {getPieceSymbol(piece)}
                  </span>
                ))}
              </div>
            </div>

            {/* Chess Board with Alphabet Labels */}
            <div className="chess-board-container">
              {/* Top rank labels (8 to 1) */}
              <div className="rank-labels">
                {[, , , , , , , ].map(rank => (
                  <div key={rank} className="rank-label">{rank}</div>
                ))}
              </div>
              
              <div className="board-with-files">
                <div className="chess-board">
                  {boardState.map((row, rowIndex) => (
                    <div key={rowIndex} className="board-row">
                      {row.map((piece, colIndex) => {
                        const isLight = (rowIndex + colIndex) % 2 === 0;
                        return (
                          <div
                            key={colIndex}
                            className={`board-square ${isLight ? 'light' : 'dark'} 
                              ${isHighlighted(rowIndex, colIndex) ? 'highlighted' : ''}
                              ${isSelected(rowIndex, colIndex) ? 'selected' : ''}
                              ${isLastMove(rowIndex, colIndex) ? 'last-move' : ''}
                              ${isInCheck(rowIndex, colIndex) ? 'check' : ''}`}
                            onClick={() => handleSquareClick(rowIndex, colIndex)}
                          >
                            {piece && (
                              <span className={`chess-piece ${piece.color === 'w' ? 'white' : 'black'}`}>
                                {getPieceSymbol(piece)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                
                {/* File labels (a to h) */}
                <div className="file-labels">
                  {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(file => (
                    <div key={file} className="file-label">{file}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Game Controls */}
            <div className="chess-controls">
              <button onClick={resetGame} className="control-btn" title="New Game">
                New Game
              </button>
              <button 
                onClick={handleUndo} 
                className={`control-btn ${historyStack.length === 0 ? 'disabled' : ''}`}
                title="Undo (Ctrl+Z)"
                disabled={historyStack.length === 0 || thinking}
              >
                Undo ({historyStack.length})
              </button>
              <button 
                onClick={handleRedo} 
                className={`control-btn ${redoStack.length === 0 ? 'disabled' : ''}`}
                title="Redo (Ctrl+Y)"
                disabled={redoStack.length === 0 || thinking}
              >
                Redo ({redoStack.length})
              </button>
              {playerColor !== game.turn() && !thinking && (
                <button 
                  onClick={handleUndoAIMove} 
                  className="control-btn"
                  title="Undo AI Move"
                >
                  Undo AI
                </button>
              )}
              <button 
                onClick={handleSaveClick} 
                className="control-btn"
                title={currentGameId ? "Update Saved Game" : "Save Game"}
              >
                {currentGameId ? 'Update' : 'Save'} ({savedGames.length})
              </button>
              <button 
                onClick={() => {
                  setShowSavedGames(true);
                  refreshSavedGames();
                }} 
                className="control-btn"
                title="Load Game"
              >
                Load
              </button>
              <button onClick={() => setGameMode('menu')} className="control-btn" title="Settings">
                Menu
              </button>
            </div>

            {/* Move History */}
            {gameHistory.length > 0 && (
              <div className="move-history">
                <h3>Move History</h3>
                <div className="history-list">
                  {gameHistory.map((move, index) => (
                    <div key={index} className="history-item">
                      <span className="move-number">{index + 1}.</span>
                      <span className={`move-san ${move.color}`}>{move.san}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Overwrite Dialog */}
        {showOverwriteDialog && gameToOverwrite && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Save Game</h3>
              <p>This game was loaded from "{gameToOverwrite.gameName}".</p>
              <p>What would you like to do?</p>
              <div className="modal-actions" style={{ flexDirection: 'column' }}>
                <button 
                  onClick={handleOverwrite} 
                  className="modal-btn save"
                  style={{ width: '100%' }}
                >
                  🔄 Overwrite existing save
                </button>
                <button 
                  onClick={handleSaveAsNew} 
                  className="modal-btn"
                  style={{ width: '100%', background: 'var(--primary)', color: 'white' }}
                >
                  💾 Save as new game
                </button>
                <button 
                  onClick={() => {
                    setShowOverwriteDialog(false);
                    setGameToOverwrite(null);
                  }} 
                  className="modal-btn cancel"
                  style={{ width: '100%' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Save Game Dialog */}
        {showSaveDialog && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>{currentGameId ? 'Update Game' : 'Save Game'}</h3>
              {saveError && <div className="error-message">{saveError}</div>}
              <input
                type="text"
                placeholder="Enter game name..."
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                className="modal-input"
                autoFocus
              />
              <div className="modal-actions">
                <button 
                  onClick={saveGame} 
                  className="modal-btn save"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : (currentGameId ? 'Update' : 'Save')}
                </button>
                <button 
                  onClick={() => {
                    setShowSaveDialog(false);
                    setGameName('');
                    setSaveError('');
                  }} 
                  className="modal-btn cancel"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Saved Games List */}
        {showSavedGames && (
          <div className="modal-overlay">
            <div className="modal-content saved-games-modal">
              <div className="modal-header">
                <h3>Saved Games</h3>
                <button onClick={refreshSavedGames} className="refresh-btn" title="Refresh">
                  ↻
                </button>
                <button 
                  className="close-modal-btn"
                  onClick={() => setShowSavedGames(false)}
                  title="Close"
                >
                  ×
                </button>
              </div>
              
              {fetchError && <div className="error-message">{fetchError}</div>}
              
              {loading ? (
                <p className="loading-text">Loading saved games...</p>
              ) : (
                <div className="saved-games-list">
                  {savedGames.length === 0 ? (
                    <p className="no-saved-games">No saved games yet. Save a game first!</p>
                  ) : (
                    savedGames.map(game => (
                      <div key={game.id} className="saved-game-item">
                        <div className="saved-game-info">
                          <strong>{game.gameName || 'Unnamed Game'}</strong>
                          <span className="saved-game-date">
                            {formatDate(game.savedAt)}
                          </span>
                          <span className="saved-game-details" style={{ color: getDifficultyColor(game.aiDifficulty) }}>
                            {game.playerColor === 'w' ? 'White' : 'Black'} vs AI • 
                            {getDifficultyText(game.aiDifficulty)} (Level {game.aiDifficulty})
                          </span>
                          {game.lastMove && (
                            <span className="saved-game-last-move">
                              Last move: {game.lastMove.from} → {game.lastMove.to}
                            </span>
                          )}
                          {currentGameId === game.id && (
                            <span className="current-game-badge">Current</span>
                          )}
                        </div>
                        <div className="saved-game-actions">
                          <button 
                            onClick={() => loadGame(game)} 
                            className="saved-game-btn load"
                            title="Load game"
                          >
                            ▶
                          </button>
                          <button 
                            onClick={() => deleteSavedGame(game.id)} 
                            className="saved-game-btn delete"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              <button 
                onClick={() => setShowSavedGames(false)} 
                className="modal-btn cancel close-btn"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}