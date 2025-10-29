import React, { useState, useEffect, useCallback } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import LoginScreen from './LoginScreen';
import WelcomeScreen from './WelcomeScreen';
import AuthButton from './AuthButton';
import { saveGame, updateUserStats } from './firebase';
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
  const [aiThinking, setAiThinking] = useState(false);

  const themes = {
    classic: { light: '#f0d9b5', dark: '#b58863' },
    modern: { light: '#eeeed2', dark: '#769656' },
    ocean: { light: '#a8dadc', dark: '#457b9d' },
    sunset: { light: '#ffd6a5', dark: '#ff8c42' }
  };

  const findKingSquare = useCallback((color) => {
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
  }, [game]);

  const getAllThreatsToPlayerPieces = useCallback(() => {
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
    const fenParts = fen.split(' ');
    fenParts[1] = enemyColor;
    fenParts[3] = '-';
    fen = fenParts.join(' ');
    
    let tempGame;
    try {
      tempGame = new Chess(fen);
    } catch (error) {
      console.error('Error creando Chess temporal:', error);
      return threats;
    }
    
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
  }, [game, playerColor]);

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
  }, [game, user, gameStartTime, gameHistory, difficulty, playerColor, findKingSquare]);

  useEffect(() => {
    if (trainingMode && game.turn() === playerColor && gameStarted) {
      const autoThreats = getAllThreatsToPlayerPieces();
      setThreats(autoThreats);
    } else if (!trainingMode) {
      setThreats([]);
    }
  }, [game, trainingMode, gameStarted, playerColor, getAllThreatsToPlayerPieces]);

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
    if (aiThinking) return false;
    
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
        setTimeout(() => makeAIMove(gameCopy), 300);
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // FUNCIÓN OPTIMIZADA - Movimientos fluidos como Chess.com
  async function makeAIMove(currentGame) {
    if (aiThinking) return;
    
    setAiThinking(true);
    const moves = currentGame.moves({ verbose: true });
    if (moves.length === 0) {
      setAiThinking(false);
      return;
    }

    try {
      const fen = currentGame.fen();
      
      // EASY: Movimientos aleatorios rápidos
      if (difficulty === 'easy') {
        // Delay mínimo natural (200-500ms)
        await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
        
        if (Math.random() > 0.15) {
          const randomMove = moves[Math.floor(Math.random() * moves.length)];
          currentGame.move(randomMove);
          setGame(new Chess(currentGame.fen()));
          setGameHistory(prev => [...prev, randomMove.san]);
        } else {
          const captures = moves.filter(m => m.captured);
          const chosen = captures.length > 0 
            ? captures[Math.floor(Math.random() * captures.length)]
            : moves[Math.floor(Math.random() * moves.length)];
          currentGame.move(chosen);
          setGame(new Chess(currentGame.fen()));
          setGameHistory(prev => [...prev, chosen.san]);
        }
      } 
      // MEDIUM y HARD: Lichess API en background
      else {
        // Llamada API sin bloquear UI
        const response = await fetch(
          `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}&multiPv=1`,
          { method: 'GET', headers: { 'Accept': 'application/json' } }
        );

        if (!response.ok) throw new Error('Lichess API error');

        const data = await response.json();
        
        // Delay natural breve (300-600ms) para simular "pensamiento" sin ser obvio
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 300));
        
        if (data.pvs && data.pvs.length > 0 && data.pvs[0].moves) {
          const uciMove = data.pvs[0].moves.split(' ')[0];
          const from = uciMove.substring(0, 2);
          const to = uciMove.substring(2, 4);
          const promotion = uciMove.length > 4 ? uciMove[4] : undefined;
          
          const move = currentGame.move({ from, to, promotion });
          setGame(new Chess(currentGame.fen()));
          setGameHistory(prev => [...prev, move.san]);
        } else {
          throw new Error('No moves from Lichess');
        }
      }
      
    } catch (error) {
      console.error('❌ Error IA:', error);
      // Fallback silencioso
      const captures = moves.filter(m => m.captured);
      const checks = moves.filter(m => m.san.includes('+'));
      
      let chosenMove;
      if (checks.length > 0 && Math.random() > 0.5) {
        chosenMove = checks[0];
      } else if (captures.length > 0 && Math.random() > 0.3) {
        chosenMove = captures[0];
      } else {
        chosenMove = moves[Math.floor(Math.random() * moves.length)];
      }
      
      currentGame.move(chosenMove);
      setGame(new Chess(currentGame.fen()));
      setGameHistory(prev => [...prev, chosenMove.san]);
    }
    
    setAiThinking(false);
  }

  async function analyzeGame() {
    if (gameHistory.length === 0) {
      alert('Juega algunas movidas primero!');
      return;
    }

    setLoading(true);
    setAnalysis('🤖 Analizando con Lichess...');

    try {
      const mistakes = [];
      const tempGame = new Chess();
      
      for (let i = 0; i < gameHistory.length; i++) {
        const move = gameHistory[i];
        const isPlayerMove = (i % 2 === 0 && playerColor === 'w') || 
                            (i % 2 === 1 && playerColor === 'b');
        
        if (isPlayerMove) {
          const fenBefore = tempGame.fen();
          const responseBefore = await fetch(
            `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fenBefore)}&multiPv=1`
          );
          const dataBefore = await responseBefore.json();
          
          tempGame.move(move);
          
          const fenAfter = tempGame.fen();
          const responseAfter = await fetch(
            `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fenAfter)}&multiPv=1`
          );
          const dataAfter = await responseAfter.json();
          
          let evalBefore = 0;
          let evalAfter = 0;
          let better = null;
          
          if (dataBefore.pvs && dataBefore.pvs[0]) {
            evalBefore = dataBefore.pvs[0].cp ? dataBefore.pvs[0].cp / 100 : 0;
            if (dataBefore.pvs[0].moves) {
              better = dataBefore.pvs[0].moves.split(' ')[0];
            }
          }
          
          if (dataAfter.pvs && dataAfter.pvs[0]) {
            evalAfter = dataAfter.pvs[0].cp ? dataAfter.pvs[0].cp / 100 : 0;
          }
          
          const diff = Math.abs(evalAfter - evalBefore);
          if (diff > 1.5) {
            mistakes.push({
              move: move,
              moveNumber: Math.floor(i / 2) + 1,
              evaluation: evalAfter,
              better: better,
              loss: diff.toFixed(2)
            });
          }
        } else {
          tempGame.move(move);
        }
      }
      
      if (mistakes.length === 0) {
        setAnalysis('🎯 ¡Excelente! No se detectaron errores significativos.');
      } else {
        let analysisText = '📊 ANÁLISIS LICHESS\n\n';
        analysisText += `⚠️ ${mistakes.length} movimiento(s) subóptimo(s):\n\n`;
        
        mistakes.forEach((mistake, i) => {
          analysisText += `${i + 1}. Mov. ${mistake.moveNumber}: ${mistake.move}\n`;
          analysisText += `   Pérdida: ${mistake.loss} pawns\n`;
          if (mistake.better) {
            analysisText += `   💡 Mejor: ${mistake.better}\n`;
          }
          analysisText += '\n';
        });
        
        setAnalysis(analysisText);
      }
      
      setLoading(false);
    } catch (error) {
      setAnalysis(`❌ Error al analizar: ${error.message}`);
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
    setAiThinking(false);
    
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
    
    threatenedPlayerPieces.forEach(square => {
      styles[square] = { 
        backgroundColor: 'rgba(147, 51, 234, 0.7)',
        boxShadow: 'inset 0 0 30px rgba(147, 51, 234, 1), 0 0 10px rgba(147, 51, 234, 0.8)'
      };
    });
    
    threats.forEach(threat => {
      styles[threat.square] = { 
        backgroundColor: 'rgba(255, 0, 0, 0.8)',
        boxShadow: 'inset 0 0 40px rgba(255, 0, 0, 1), 0 0 15px rgba(255, 0, 0, 0.9)'
      };
    });
    
    if (selectedSquare) {
      styles[selectedSquare] = { 
        backgroundColor: 'rgba(255, 255, 0, 0.6)',
        boxShadow: 'inset 0 0 20px rgba(255, 255, 0, 0.9)'
      };
    }
    
    possibleMoves.forEach(square => {
      if (!capturablePieces.includes(square)) {
        styles[square] = { 
          background: 'radial-gradient(circle, rgba(0, 255, 0, 0.7) 25%, transparent 25%)',
          boxShadow: 'inset 0 0 10px rgba(0, 255, 0, 0.3)'
        };
      }
    });
    
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
    
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const file = checkmatedKingSquare[0];
    const rank = parseInt(checkmatedKingSquare[1]);
    
    const fileIndex = files.indexOf(file);
    const rankIndex = 8 - rank;
    
    const isFlipped = playerColor === 'b';
    
    const squareSize = 500 / 8;
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
            {aiThinking && ' | 🤔 Lichess pensando...'}
          </p>
        </div>
        <AuthButton />
      </header>

      <div className="game-container">
        <div className="board-section">
          <div className="controls">
            <button onClick={resetGame} disabled={aiThinking}>
              🔄 Nueva Partida
            </button>
            <button 
              onClick={toggleTrainingMode}
              className={trainingMode ? 'training-active' : ''}
              disabled={aiThinking}
            >
              {trainingMode ? '🎓 Entrenamiento ON' : '🎓 Entrenamiento OFF'}
            </button>
            <button onClick={analyzeGame} disabled={loading || aiThinking}>
              {loading ? 'Analizando...' : '🧠 Analizar con Lichess'}
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
                boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
                opacity: aiThinking ? 0.7 : 1,
                pointerEvents: aiThinking ? 'none' : 'auto'
              }}
              customLightSquareStyle={{ backgroundColor: themes[boardTheme].light }}
              customDarkSquareStyle={{ backgroundColor: themes[boardTheme].dark }}
              customSquareStyles={getSquareStyles()}
            />
            {renderSkullOverlay()}
            {aiThinking && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'rgba(0,0,0,0.8)',
                color: 'white',
                padding: '20px 40px',
                borderRadius: '10px',
                fontSize: '20px',
                fontWeight: 'bold',
                zIndex: 1001
              }}>
                🧠 Lichess pensando...
              </div>
            )}
          </div>

          <div className="game-info">
            <p><strong>Turno:</strong> {game.turn() === playerColor ? 'Tu turno' : 'Turno de IA'}</p>
            <p><strong>Movimientos:</strong> {gameHistory.length}</p>
            <p><strong>Motor:</strong> 🧠 Lichess API</p>
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
          <h2>📊 Análisis Lichess</h2>
          <div className="analysis-box">
            {analysis ? <pre>{analysis}</pre> : (
              <p className="placeholder">
                Juega una partida y presiona "Analizar con Lichess" 
                para recibir análisis profesional.
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
        <p>🚀 Potenciado por Lichess API</p>
      </footer>
    </div>
  );
}

export default App;