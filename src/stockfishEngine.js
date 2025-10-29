// stockfishEngine.js - Stockfish 16 NNUE PROFESIONAL
import { Chess } from 'chess.js';

class StockfishEngine {
  constructor() {
    this.engine = null;
    this.isReady = false;
    this.thinking = false;
    this.moveQueue = [];
  }

  init() {
    return new Promise((resolve) => {
      if (this.engine && this.isReady) {
        resolve(true);
        return;
      }

      try {
        // Stockfish 16 WASM oficial (el más potente disponible en CDN)
        const stockfish = new Worker('https://raw.githack.com/nmrugg/stockfish.js/master/stockfish.wasm.js');
        
        this.engine = stockfish;
        let uciOkReceived = false;

        this.engine.onmessage = (event) => {
          const message = event.data;
          
          if (typeof message === 'string') {
            // Log importante para debug
            if (message.includes('Stockfish')) {
              console.log('✅', message);
            }
            
            if (message === 'uciok' && !uciOkReceived) {
              uciOkReceived = true;
              console.log('✅ UCI Protocol activado');
              this.configureEngine();
            }
            
            if (message.includes('readyok')) {
              this.isReady = true;
              console.log('🧠 Stockfish LISTO - Configuración aplicada');
              resolve(true);
            }
          }
        };

        this.engine.postMessage('uci');
        
        // Timeout más largo para cargar WASM
        setTimeout(() => {
          if (!this.isReady) {
            console.warn('⚠️ Timeout carga lenta, continuando...');
            this.isReady = true;
            resolve(true);
          }
        }, 8000);
        
      } catch (error) {
        console.error('❌ Error inicializando:', error);
        resolve(false);
      }
    });
  }

  // Configurar motor al iniciar
  configureEngine() {
    this.engine.postMessage('setoption name UCI_AnalyseMode value true');
    this.engine.postMessage('setoption name Ponder value false');
    this.engine.postMessage('isready');
  }

  async getBestMove(fen, difficulty = 'easy') {
    if (!this.engine || this.thinking) {
      console.warn('⚠️ Motor ocupado o no listo');
      return null;
    }

    return new Promise((resolve) => {
      this.thinking = true;
      let bestMove = null;
      let moveFound = false;
      let searchStartTime = Date.now();

      // CONFIGURACIÓN PROFESIONAL
      const config = {
        easy: { 
          depth: 1,
          skillLevel: 0,
          time: 100,
          limitStrength: true,
          elo: 800,
          threads: 1,
          hash: 16
        },
        medium: { 
          depth: 22,
          skillLevel: 17,
          time: 4000,
          limitStrength: false,
          threads: 2,
          hash: 256
        },
        hard: { 
          depth: 40,           // MUY PROFUNDO
          skillLevel: 20,
          time: 12000,         // 12 SEGUNDOS
          limitStrength: false,
          threads: 4,
          hash: 1024           // 1GB RAM
        }
      };

      const settings = config[difficulty] || config.medium;

      const moveHandler = (event) => {
        const message = event.data;
        
        if (typeof message !== 'string') return;
        
        // Mostrar progreso de búsqueda
        if (message.includes('info depth') && message.includes('score')) {
          const depthMatch = message.match(/depth (\d+)/);
          const scoreMatch = message.match(/score cp (-?\d+)/);
          if (depthMatch && scoreMatch) {
            const depth = depthMatch[1];
            const score = (parseInt(scoreMatch[1]) / 100).toFixed(2);
            console.log(`🔍 [${difficulty.toUpperCase()}] Depth: ${depth}, Score: ${score}`);
          }
        }
        
        if (message.includes('bestmove') && !moveFound) {
          const match = message.match(/bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
          if (match) {
            bestMove = match[1];
            moveFound = true;
            this.thinking = false;
            
            const searchTime = ((Date.now() - searchStartTime) / 1000).toFixed(2);
            console.log(`🎯 [${difficulty.toUpperCase()}] Movimiento: ${bestMove} (${searchTime}s)`);
            
            this.engine.removeEventListener('message', moveHandler);
            resolve(bestMove);
          }
        }
      };

      this.engine.addEventListener('message', moveHandler);

      // CONFIGURAR MOTOR ANTES DE CADA BÚSQUEDA
      console.log(`⚙️ Configurando ${difficulty.toUpperCase()}...`);
      this.engine.postMessage('ucinewgame');
      
      // Configuración según dificultad
      if (difficulty === 'easy') {
        this.engine.postMessage('setoption name Skill Level value 0');
        this.engine.postMessage('setoption name UCI_LimitStrength value true');
        this.engine.postMessage('setoption name UCI_Elo value 800');
        this.engine.postMessage('setoption name Threads value 1');
        this.engine.postMessage('setoption name Hash value 16');
      } else if (difficulty === 'medium') {
        this.engine.postMessage('setoption name Skill Level value 17');
        this.engine.postMessage('setoption name UCI_LimitStrength value false');
        this.engine.postMessage('setoption name Threads value 2');
        this.engine.postMessage('setoption name Hash value 256');
        this.engine.postMessage('setoption name Contempt value 24');
        this.engine.postMessage('setoption name MultiPV value 1');
      } else {
        // HARD: Configuración MÁXIMA
        this.engine.postMessage('setoption name Skill Level value 20');
        this.engine.postMessage('setoption name UCI_LimitStrength value false');
        this.engine.postMessage('setoption name Threads value 4');
        this.engine.postMessage('setoption name Hash value 1024');
        this.engine.postMessage('setoption name Contempt value 100');
        this.engine.postMessage('setoption name MultiPV value 1');
        this.engine.postMessage('setoption name UCI_AnalyseMode value true');
      }
      
      // Esperar a que se apliquen las opciones
      this.engine.postMessage('isready');
      
      // Pequeño delay para asegurar configuración
      setTimeout(() => {
        this.engine.postMessage(`position fen ${fen}`);
        
        // COMANDO GO
        if (difficulty === 'easy') {
          this.engine.postMessage('go depth 1 movetime 100');
        } else if (difficulty === 'medium') {
          this.engine.postMessage(`go depth ${settings.depth} movetime ${settings.time}`);
        } else {
          // HARD: Solo profundidad (sin límite estricto de tiempo)
          this.engine.postMessage(`go depth ${settings.depth}`);
        }
      }, 100);

      // Timeout de seguridad
      const timeoutDuration = difficulty === 'hard' ? 25000 : settings.time + 5000;
      setTimeout(() => {
        if (this.thinking && !moveFound) {
          this.thinking = false;
          this.engine.postMessage('stop');
          this.engine.removeEventListener('message', moveHandler);
          console.warn('⚠️ Timeout - usando mejor movimiento parcial');
          resolve(bestMove);
        }
      }, timeoutDuration);
    });
  }

  uciToMove(game, uciMove) {
    if (!uciMove || uciMove.length < 4) return null;

    const from = uciMove.substring(0, 2);
    const to = uciMove.substring(2, 4);
    const promotion = uciMove.length > 4 ? uciMove[4] : undefined;

    try {
      return game.move({ from, to, promotion });
    } catch (error) {
      console.error('❌ Error convirtiendo:', error);
      return null;
    }
  }

  async makeSmartMove(game, difficulty = 'easy') {
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return null;

    // EASY: Casi todo aleatorio
    if (difficulty === 'easy') {
      if (Math.random() > 0.1) {
        return moves[Math.floor(Math.random() * moves.length)];
      }
      const captures = moves.filter(m => m.captured);
      return captures.length > 0 
        ? captures[Math.floor(Math.random() * captures.length)]
        : moves[Math.floor(Math.random() * moves.length)];
    }

    // Medium y Hard: Usar Stockfish
    if (!this.isReady) {
      console.log('⏳ Inicializando Stockfish...');
      await this.init();
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    const uciMove = await this.getBestMove(game.fen(), difficulty);
    
    if (!uciMove) {
      console.warn('⚠️ Fallback a movimiento inteligente');
      const captures = moves.filter(m => m.captured);
      const checks = moves.filter(m => m.san.includes('+'));
      
      if (checks.length > 0 && Math.random() > 0.5) {
        return checks[0];
      } else if (captures.length > 0 && Math.random() > 0.3) {
        return captures[0];
      }
      return moves[Math.floor(Math.random() * moves.length)];
    }

    return this.uciToMove(game, uciMove);
  }

  async evaluatePosition(fen, depth = 22) {
    if (!this.engine || !this.isReady) {
      await this.init();
    }

    return new Promise((resolve) => {
      let evaluation = 0;
      let bestMove = null;
      let evalFound = false;

      const evalHandler = (event) => {
        const message = event.data;
        if (typeof message !== 'string') return;
        
        if (message.includes('score cp')) {
          const match = message.match(/score cp (-?\d+)/);
          if (match) {
            evaluation = parseInt(match[1]) / 100;
          }
        }
        
        if (message.includes('score mate')) {
          const match = message.match(/score mate (-?\d+)/);
          if (match) {
            evaluation = parseInt(match[1]) > 0 ? 99 : -99;
          }
        }

        if (message.includes('bestmove') && !evalFound) {
          const match = message.match(/bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/);
          if (match) bestMove = match[1];
          evalFound = true;
          this.engine.removeEventListener('message', evalHandler);
          resolve({ evaluation, bestMove });
        }
      };

      this.engine.addEventListener('message', evalHandler);
      this.engine.postMessage('ucinewgame');
      this.engine.postMessage(`position fen ${fen}`);
      this.engine.postMessage(`go depth ${depth}`);

      setTimeout(() => {
        if (!evalFound) {
          this.engine.removeEventListener('message', evalHandler);
          resolve({ evaluation, bestMove });
        }
      }, 15000);
    });
  }

  async analyzeGame(moves, playerColor) {
    const mistakes = [];
    const game = new Chess();
    
    console.log('🔍 Iniciando análisis profundo...');
    
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const isPlayerMove = (i % 2 === 0 && playerColor === 'w') || 
                          (i % 2 === 1 && playerColor === 'b');
      
      if (isPlayerMove) {
        console.log(`📊 Analizando movimiento ${Math.floor(i / 2) + 1}...`);
        const evalBefore = await this.evaluatePosition(game.fen(), 20);
        game.move(move);
        const evalAfter = await this.evaluatePosition(game.fen(), 20);
        
        const diff = Math.abs(evalAfter.evaluation - evalBefore.evaluation);
        if (diff > 1.5) {
          mistakes.push({
            move: move,
            moveNumber: Math.floor(i / 2) + 1,
            evaluation: evalAfter.evaluation,
            better: evalBefore.bestMove,
            loss: diff.toFixed(2)
          });
        }
      } else {
        game.move(move);
      }
    }
    
    console.log(`✅ Análisis completo: ${mistakes.length} errores detectados`);
    return mistakes;
  }

  terminate() {
    if (this.engine) {
      this.engine.terminate();
      this.engine = null;
      this.isReady = false;
      this.thinking = false;
    }
  }
}

let stockfishInstance = null;

export const getStockfishEngine = () => {
  if (!stockfishInstance) {
    stockfishInstance = new StockfishEngine();
  }
  return stockfishInstance;
};

export default StockfishEngine;