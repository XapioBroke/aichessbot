import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import LoginScreen from './LoginScreen';
import WelcomeScreen from './WelcomeScreen';
import AuthButton from './AuthButton';
import { saveGame, updateUserStats } from './firebase';
import { getStockfishEngine } from './stockfishEngine';
import './App.css';

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [game, setGame] = useState(new Chess());
  const [gameHistory, setGameHistory] = useState([]);
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [difficulty, setDifficulty] = useState('easy');
  const [boardTheme, setBoardTheme] = useState('classic');
  const [trainingMode, setTrainingMode] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [possibleMoves, setPossibleMoves] = useState([]);
  const [capturablePieces, setCapturablePieces] = useState([]);
  const [threats, setThreats] = useState([]);
  const [playerColor, setPlayerColor] = useState('w');
  const [showConfetti, setShowConfetti] = useState(false);
  const [checkmatedKingSquare, setCheckmatedKingSquare] = useState(null);
  const [user, setUser] = useState(null);
  const [gameStartTime, setGameStartTime] = useState(null);

  const themes = {
    classic: { light: '#f0d9b5', dark: '#b58863' },
    modern: { light: '#eeeed2', dark: '#769656' },
    ocean: { light: '#a8dadc', dark: '#457b9d' },
    sunset: { light: '#ffd6a5', dark: '#ff8c42' }
  };

  useEffect(() => {
    if (game.isCheckmate()) {
      const losingColor = game.turn();
      const kingSquare = findKingSquare(losingColor);
      setCheckmatedKingSquare(kingSquare);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
      
      if (user && gameStartTime) {
        const duration = Math.floor((Date.now() - gameStartTime) / 1000);
        const playerWon = losingColor !== playerColor;
        
        saveGame(user.uid, {
          pgn: game.pgn(),
          moves: gameHistory,
          result: playerWon ? 'win' : 'loss',
          difficulty: difficulty,
          playerColor: playerColor,
          duration: duration,
          fen: game.fen()
        });
        
        updateUserStats(user.uid, playerWon ? 'win' : 'loss');
      }
    } else {
      setCheckmatedKingSquare(null);
    }
  }, [game, user, gameStartTime, gameHistory, difficulty, playerColor]);

  function findKingSquare(color) {
    const board = game.board();
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.type === 'k' && piece.color === color) {
          const file = String.fromCharCode(97 + col);
          const rank = 8 - row;
          return file + rank;
        }
      }
    }
    return null;
  }

  useEffect(() => {
    if (trainingMode && game.turn() === playerColor && gameStarted) {
      const autoThreats = getAllThreatsToPlayerPieces();
      setThreats(autoThreats);
    } else if (!trainingMode) {
      setThreats([]);
    }
  }, [game, trainingMode, gameStarted, playerColor]);

  const handleStartGame = (selectedDifficulty, selectedColor) => {
    setDifficulty(selectedDifficulty);
    setTrainingMode(selectedDifficulty === 'easy');
    
    let finalColor = selectedColor;
    if (selectedColor === 'random') {
      finalColor = Math.random() < 0.5 ? 'w' : 'b';
    }
    setPlayerColor(finalColor);
    setGameStarted(true);
    setGameStartTime(Date.now());
    
    if (finalColor === 'b') {
      const newGame = new Chess();
      setTimeout(() => makeAIMove(newGame), 500);
    }
  };

  const handleSelectTheme = (theme) => {
    setBoardTheme(theme);
  };

  const handleAuthenticated = (authenticatedUser) => {
    setUser(authenticatedUser);
    setAuthenticated(true);
  };

  function getAllThreatsToPlayerPieces() {
    const threats = [];
    const board = game.board();
    const playerPieces = [];
    
    for (let rowIndex = 0; rowIndex < 8; rowIndex++) {
      for (let colIndex = 0; colIndex < 8; colIndex++) {
        const piece = board[rowIndex][colIndex];
        if (piece && piece.color === playerColor) {
          const file = String.fromCharCode(97 + colIndex);
          const rank = 8 - rowIndex;
          playerPieces.push(file + rank);
        }
      }
    }
    
    const enemyColor = playerColor === 'w' ? 'b' : 'w';
    let fen = game.fen();
    fen = fen.replace(` ${playerColor} `, ` ${enemyColor} `);
    const tempGame = new Chess(fen);
    
    for (let rowIndex = 0; rowIndex < 8; rowIndex++) {
      for (let colIndex = 0; colIndex < 8; colIndex++) {
        const piece = board[rowIndex][colIndex];
        if (!piece || piece.color !== enemyColor) continue;
        
        const file = String.fromCharCode(97 + colIndex);
        const rank = 8 - rowIndex;
        const square = file + rank;
        
        try {
          const enemyMoves = tempGame.moves({ square: square, verbose: true });
          const canAttack = enemyMoves.filter(move => playerPieces.includes(move.to));
          
          if (canAttack.length > 0) {
            threats.push({
              square: square,
              piece: piece.type,
              color: piece.color,
              threatens: canAttack.map(m => m.to)
            });
          }
        } catch (e) {
          console.error(`Error en ${square}:`, e);
        }
      }
    }
    
    return threats;
  }

  function getMoveOptions(square) {
    const moves = game.moves({ square: square, verbose: true });
    if (moves.length === 0) return [];
    return moves.map(move => move.to);
  }

  function getCapturableEnemies(square) {
    const moves = game.moves({ square: square, verbose: true });
    const captures = moves.filter(move => move.captured);
    return captures.map(move => move.to);
  }

  function onSquareClick(square) {
    if (!trainingMode) return;
    if (game.turn() !== playerColor) return;

    const piece = game.get(square);
    
    if (piece && piece.color === playerColor && game.turn() === playerColor) {
      setSelectedSquare(square);
      const moves = getMoveOptions(square);
      setPossibleMoves(moves);
      const capturable = getCapturableEnemies(square);
      setCapturablePieces(capturable);
    } else {
      setSelectedSquare(null);
      setPossibleMoves([]);
      setCapturablePieces([]);
    }
  }

  function makeMove(sourceSquare, targetSquare) {
    if (game.turn() !== playerColor) return false;
    const gameCopy = new Chess(game.fen());
    
    try {
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q'
      });

      if (move === null) return false;

      setGame(gameCopy);
      setGameHistory([...gameHistory, move.san]);
      setSelectedSquare(null);
      setPossibleMoves([]);
      setCapturablePieces([]);

      if (!gameCopy.isGameOver()) {
        setTimeout(() => makeAIMove(gameCopy), 500);
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  function makeAIMove(currentGame) {
    const moves = currentGame.moves({ verbose: true });
    if (moves.length === 0) return;

    let selectedMove;
    
    if (difficulty === 'easy') {
      selectedMove = moves[Math.floor(Math.random() * moves.length)];
    } 
    else if (difficulty === 'medium') {
      const checkmates = moves.filter(m => {
        const testGame = new Chess(currentGame.fen());
        testGame.move(m);
        return testGame.isCheckmate();
      });
      
      if (checkmates.length > 0) {
        selectedMove = checkmates[0];
      } else {
        const checks = moves.filter(m => m.san.includes('+'));
        const captures = moves.filter(m => m.captured);
        const centerMoves = moves.filter(m => ['e4', 'e5', 'd4', 'd5'].includes(m.to));
        
        if (checks.length > 0) {
          selectedMove = checks[Math.floor(Math.random() * checks.length)];
        } else if (captures.length > 0) {
          captures.sort((a, b) => {
            const values = { p: 1, n: 3, b: 3, r: 5, q: 9 };
            return (values[b.captured] || 0) - (values[a.captured] || 0);
          });
          selectedMove = captures[0];
        } else if (centerMoves.length > 0) {
          selectedMove = centerMoves[Math.floor(Math.random() * centerMoves.length)];
        } else {
          selectedMove = moves[Math.floor(Math.random() * moves.length)];
        }
      }
    }
    else {
      const checkmates = moves.filter(m => {
        const testGame = new Chess(currentGame.fen());
        testGame.move(m);
        return testGame.isCheckmate();
      });
      
      if (checkmates.length > 0) {
        selectedMove = checkmates[0];
      } else {
        const evaluatedMoves = moves.map(move => {
          let score = 0;
          if (move.san.includes('+')) score += 30;
          if (move.captured) {
            const values = { p: 10, n: 30, b: 30, r: 50, q: 90 };
            score += values[move.captured] || 0;
          }
          if (['e4', 'e5', 'd4', 'd5'].includes(move.to)) score += 15;
          if (move.piece !== 'p' && ['1', '2', '7', '8'].includes(move.from[1])) {
            score += 10;
          }
          
          const testGame = new Chess(currentGame.fen());
          testGame.move(move);
          const threats = testGame.moves({ verbose: true }).filter(m => m.captured);
          if (threats.some(t => ['q', 'r'].includes(t.captured))) {
            score += 20;
          }
          
          const afterMove = new Chess(currentGame.fen());
          afterMove.move(move);
          const enemyCaptures = afterMove.moves({ verbose: true }).filter(m => m.captured);
          if (enemyCaptures.length > 0) {
            const maxCapture = Math.max(...enemyCaptures.map(m => {
              const values = { p: 10, n: 30, b: 30, r: 50, q: 90 };
              return values[m.captured] || 0;
            }));
            score -= maxCapture / 2;
          }
          
          return { move, score };
        });
        
        evaluatedMoves.sort((a, b) => b.score - a.score);
        const topMoves = evaluatedMoves.slice(0, 3);
        const chosen = topMoves[Math.floor(Math.random() * topMoves.length)];
        selectedMove = chosen.move;
      }
    }

    currentGame.move(selectedMove);
    setGame(new Chess(currentGame.fen()));
    setGameHistory(prev => [...prev, selectedMove.san || selectedMove]);
  }

  async function analyzeGame() {
    if (gameHistory.length === 0) {
      alert('Juega algunas movidas primero!');
      return;
    }

    setLoading(true);
    setAnalysis('🤖 Analizando...');

    try {
      const response = await fetch('http://localhost:3001/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pgn: game.pgn(),
          moves: gameHistory,
          playerColor: playerColor,
          fen: game.fen(),
          isCheckmate: game.isCheckmate(),
          isCheck: game.isCheck(),
          isDraw: game.isDraw()
        })
      });

      const data = await response.json();

      if (data.success) {
        setAnalysis(`📊 ANÁLISIS\n\n${data.analysis}\n\n---\n🎯 Movimientos: ${data.movesAnalyzed}`);
      } else {
        setAnalysis(`❌ ${data.error}`);
      }
      setLoading(false);
    } catch (error) {
      setAnalysis(`❌ Backend no disponible\n\n${error.message}`);
      setLoading(false);
    }
  }

  function resetGame() {
    const newGame = new Chess();
    setGame(newGame);
    setGameHistory([]);
    setAnalysis('');
    setSelectedSquare(null);
    setPossibleMoves([]);
    setCapturablePieces([]);
    setThreats([]);
    setShowConfetti(false);
    setCheckmatedKingSquare(null);
    setGameStartTime(Date.now());
    
    if (playerColor === 'b') {
      setTimeout(() => makeAIMove(newGame), 500);
    }
  }

  function backToMenu() {
    setGameStarted(false);
    resetGame();
    setPlayerColor('w');
  }

  function toggleTrainingMode() {
    setTrainingMode(!trainingMode);
    setSelectedSquare(null);
    setPossibleMoves([]);
    setCapturablePieces([]);
    if (!trainingMode) {
      const autoThreats = getAllThreatsToPlayerPieces();
      setThreats(autoThreats);
    } else {
      setThreats([]);
    }
  }

  function getSquareStyles() {
    const styles = {};
    if (!trainingMode) return styles;
    
    const threatenedPlayerPieces = new Set();
    threats.forEach(threat => {
      threat.threatens.forEach(square => {
        threatenedPlayerPieces.add(square);
      });
    });
    
    // Piezas del jugador amenazadas (MORADO) - SIN BORDER
    threatenedPlayerPieces.forEach(square => {
      styles[square] = { 
        backgroundColor: 'rgba(147, 51, 234, 0.7)',
        boxShadow: 'inset 0 0 30px rgba(147, 51, 234, 1), 0 0 10px rgba(147, 51, 234, 0.8)'
      };
    });
    
    // Amenazas enemigas (ROJO) - SIN BORDER
    threats.forEach(threat => {
      styles[threat.square] = { 
        backgroundColor: 'rgba(255, 0, 0, 0.8)',
        boxShadow: 'inset 0 0 40px rgba(255, 0, 0, 1), 0 0 15px rgba(255, 0, 0, 0.9)'
      };
    });
    
    // Pieza seleccionada (Amarillo)
    if (selectedSquare) {
      styles[selectedSquare] = { 
        backgroundColor: 'rgba(255, 255, 0, 0.6)',
        boxShadow: 'inset 0 0 20px rgba(255, 255, 0, 0.9)'
      };
    }
    
    // Movimientos posibles (Verde) - círculo interno sin alterar tamaño
    possibleMoves.forEach(square => {
      if (!capturablePieces.includes(square)) {
        styles[square] = { 
          background: 'radial-gradient(circle, rgba(0, 255, 0, 0.7) 25%, transparent 25%)',
          boxShadow: 'inset 0 0 10px rgba(0, 255, 0, 0.3)'
        };
      }
    });
    
    // Capturable (Naranja) - SIN BORDER
    capturablePieces.forEach(square => {
      styles[square] = { 
        backgroundColor: 'rgba(255, 165, 0, 0.7)',
        boxShadow: 'inset 0 0 25px rgba(255, 140, 0, 1), 0 0 12px rgba(255, 140, 0, 0.8)'
      };
    });

    return styles;
  }

  function renderConfetti() {
    if (!showConfetti) return null;
    const confettiPieces = [];
    for (let i = 0; i < 100; i++) {
      const style = {
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 3}s`,
        backgroundColor: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'][Math.floor(Math.random() * 6)]
      };
      confettiPieces.push(<div key={i} className="confetti" style={style}></div>);
    }
    return <div className="confetti-container">{confettiPieces}</div>;
  }

  function renderSkullOverlay() {
    if (!checkmatedKingSquare) return null;
    
    // Calcular posición exacta del rey en el tablero
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const file = checkmatedKingSquare[0];
    const rank = parseInt(checkmatedKingSquare[1]);
    
    const fileIndex = files.indexOf(file);
    const rankIndex = 8 - rank;
    
    // Si el tablero está volteado (jugando con negras)
    const isFlipped = playerColor === 'b';
    
    const squareSize = 500 / 8; // 62.5px por casilla
    const left = isFlipped ? (7 - fileIndex) * squareSize : fileIndex * squareSize;
    const top = isFlipped ? rankIndex * squareSize : (7 - rankIndex) * squareSize;
    
    return (
      <div 
        className="skull-overlay" 
        style={{
          position: 'absolute',
          left: `${left + squareSize / 2}px`,
          top: `${top + squareSize / 2}px`,
          transform: 'translate(-50%, -50%)',
          width: `${squareSize}px`,
          height: `${squareSize}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 1000
        }}
      >
        <div className="skull-animation">💀</div>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginScreen onAuthenticated={handleAuthenticated} />;
  }

  if (!gameStarted) {
    return (
      <WelcomeScreen 
        onStart={handleStartGame}
        onSelectTheme={handleSelectTheme}
      />
    );
  }

  return (
    <div className="App">
      {renderConfetti()}
      
      <header className="App-header">
        <button className="back-btn" onClick={backToMenu}>← Menú</button>
        <div>
          <h1>♟️ AiChessBot</h1>
          <p>
            Jugando con: {playerColor === 'w' ? '⚪ Blancas' : '⚫ Negras'} | 
            Dificultad: {difficulty === 'easy' ? '🌱 Principiante' : difficulty === 'medium' ? '⚔️ Intermedio' : '👑 Avanzado'}
            {trainingMode && ' | 🎓 Modo Entrenamiento'}
          </p>
        </div>
        <AuthButton />
      </header>

      <div className="game-container">
        <div className="board-section">
          <div className="controls">
            <button onClick={resetGame}>🔄 Nueva Partida</button>
            <button 
              onClick={toggleTrainingMode}
              className={trainingMode ? 'training-active' : ''}
            >
              {trainingMode ? '🎓 Entrenamiento ON' : '🎓 Entrenamiento OFF'}
            </button>
            <button onClick={analyzeGame} disabled={loading}>
              {loading ? 'Analizando...' : '🤖 Analizar con IA'}
            </button>
          </div>

          {trainingMode && (
            <div className="training-legend">
              <div className="legend-item">
                <span className="legend-color" style={{background: 'rgba(255, 0, 0, 0.8)', boxShadow: '0 0 8px rgba(255, 0, 0, 0.6)'}}></span>
                <span>🔴 Enemigo atacante</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{background: 'rgba(147, 51, 234, 0.7)', boxShadow: '0 0 8px rgba(147, 51, 234, 0.6)'}}></span>
                <span>🟣 Tu pieza amenazada</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{background: 'rgba(255, 255, 0, 0.7)'}}></span>
                <span>🟡 Seleccionada</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{background: 'radial-gradient(circle, rgba(0, 255, 0, 0.7) 30%, transparent 30%)'}}></span>
                <span>🟢 Movimientos</span>
              </div>
              <div className="legend-item">
                <span className="legend-color" style={{background: 'rgba(255, 165, 0, 0.7)', boxShadow: '0 0 8px rgba(255, 140, 0, 0.6)'}}></span>
                <span>🟠 Capturar</span>
              </div>
            </div>
          )}

          <div className="chessboard-wrapper" style={{ position: 'relative' }}>
            <Chessboard 
              position={game.fen()}
              onPieceDrop={makeMove}
              onSquareClick={onSquareClick}
              boardOrientation={playerColor === 'w' ? 'white' : 'black'}
              boardWidth={500}
              customBoardStyle={{
                borderRadius: '10px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
              }}
              customLightSquareStyle={{ backgroundColor: themes[boardTheme].light }}
              customDarkSquareStyle={{ backgroundColor: themes[boardTheme].dark }}
              customSquareStyles={getSquareStyles()}
            />
            {renderSkullOverlay()}
          </div>

          <div className="game-info">
            <p><strong>Turno:</strong> {game.turn() === playerColor ? 'Tu turno' : 'Turno de IA'}</p>
            <p><strong>Movimientos:</strong> {gameHistory.length}</p>
            {threats.length > 0 && trainingMode && (
              <p className="alert">⚠️ {threats.length} amenaza{threats.length > 1 ? 's' : ''} detectada{threats.length > 1 ? 's' : ''}</p>
            )}
            {game.isCheck() && <p className="alert">⚠️ ¡Rey en jaque!</p>}
            {game.isCheckmate() && (
              <p className="victory">
                {game.turn() === playerColor ? '💀 ¡Perdiste! Jaque mate' : '🎉 ¡Ganaste! Jaque mate'}
              </p>
            )}
          </div>
        </div>

        <div className="analysis-section">
          <h2>📊 Análisis IA</h2>
          <div className="analysis-box">
            {analysis ? <pre>{analysis}</pre> : (
              <p className="placeholder">
                Juega una partida y presiona "Analizar con IA" 
                para recibir consejos personalizados.
              </p>
            )}
          </div>

          <div className="history">
            <h3>Historial</h3>
            <div className="moves-list">
              {gameHistory.map((move, i) => (
                <span key={i} className="move">
                  {Math.floor(i/2) + 1}{i % 2 === 0 ? '. ' : '... '}{move}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <footer>
        <p>🚀 Versión Beta - Análisis IA gratis ilimitado</p>
      </footer>
    </div>
  );
}

export default App;