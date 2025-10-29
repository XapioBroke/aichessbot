import React, { useState } from 'react';
import AuthButton from './AuthButton';
import './WelcomeScreen.css';

function WelcomeScreen({ onStart, onSelectTheme }) {
  const [selectedDifficulty, setSelectedDifficulty] = useState('easy');
  const [selectedTheme, setSelectedTheme] = useState('classic');
  const [selectedColor, setSelectedColor] = useState('random');
  const [showSettings, setShowSettings] = useState(false);

  const themes = [
    { id: 'classic', name: '♟️ Clásico', colors: { light: '#f0d9b5', dark: '#b58863' } },
    { id: 'modern', name: '🎨 Moderno', colors: { light: '#eeeed2', dark: '#769656' } },
    { id: 'ocean', name: '🌊 Océano', colors: { light: '#a8dadc', dark: '#457b9d' } },
    { id: 'sunset', name: '🌅 Atardecer', colors: { light: '#ffd6a5', dark: '#ff8c42' } }
  ];

  const handleStart = () => {
    let finalColor = selectedColor;
    if (selectedColor === 'white') {
      finalColor = 'w';
    } else if (selectedColor === 'black') {
      finalColor = 'b';
    } else if (selectedColor === 'random') {
      finalColor = 'random';
    }
    
    onSelectTheme(selectedTheme);
    onStart(selectedDifficulty, finalColor);
  };

  return (
    <div className="welcome-screen">
      <div className="auth-button-container">
        <AuthButton />
      </div>
      
      <div className="welcome-content">
        <div className="logo-section">
          <div className="logo-animation">♟️</div>
          <h1 className="title">AiChessBot</h1>
          <p className="subtitle">Aprende ajedrez con inteligencia artificial</p>
        </div>

        <div className="selection-panel">
          <div className="difficulty-selector">
            <h3>Selecciona Dificultad</h3>
            <div className="difficulty-buttons">
              <button 
                className={`diff-btn ${selectedDifficulty === 'easy' ? 'active' : ''}`}
                onClick={() => setSelectedDifficulty('easy')}
              >
                <span className="diff-icon">🌱</span>
                <span className="diff-name">Principiante</span>
                <span className="diff-desc">ELO ~600 | Muchos errores</span>
              </button>
              <button 
                className={`diff-btn ${selectedDifficulty === 'medium' ? 'active' : ''}`}
                onClick={() => setSelectedDifficulty('medium')}
              >
                <span className="diff-icon">⚔️</span>
                <span className="diff-name">Intermedio</span>
                <span className="diff-desc">ELO ~1700 | Táctica sólida</span>
              </button>
              <button 
                className={`diff-btn ${selectedDifficulty === 'hard' ? 'active' : ''}`}
                onClick={() => setSelectedDifficulty('hard')}
              >
                <span className="diff-icon">👑</span>
                <span className="diff-name">Avanzado</span>
                <span className="diff-desc">ELO ~2700 | Gran Maestro</span>
              </button>
            </div>
          </div>

          <div className="color-selector">
            <h3>Jugar con:</h3>
            <div className="color-buttons">
              <button 
                className={`color-btn ${selectedColor === 'white' ? 'active' : ''}`}
                onClick={() => setSelectedColor('white')}
              >
                <span className="color-icon">⚪</span>
                <span>Blancas</span>
                <span className="color-desc">(Juegas primero)</span>
              </button>
              <button 
                className={`color-btn ${selectedColor === 'random' ? 'active' : ''}`}
                onClick={() => setSelectedColor('random')}
              >
                <span className="color-icon">🎲</span>
                <span>Aleatorio</span>
                <span className="color-desc">(Sorpresa)</span>
              </button>
              <button 
                className={`color-btn ${selectedColor === 'black' ? 'active' : ''}`}
                onClick={() => setSelectedColor('black')}
              >
                <span className="color-icon">⚫</span>
                <span>Negras</span>
                <span className="color-desc">(IA juega primero)</span>
              </button>
            </div>
          </div>

          <button 
            className="theme-toggle"
            onClick={() => setShowSettings(!showSettings)}
          >
            {showSettings ? '❌ Cerrar Temas' : '🎨 Personalizar Tablero'}
          </button>

          {showSettings && (
            <div className="theme-selector">
              <h3>Tema del Tablero</h3>
              <div className="theme-grid">
                {themes.map(theme => (
                  <button
                    key={theme.id}
                    className={`theme-btn ${selectedTheme === theme.id ? 'active' : ''}`}
                    onClick={() => setSelectedTheme(theme.id)}
                  >
                    <div className="theme-preview">
                      <div 
                        className="theme-square" 
                        style={{ background: theme.colors.light }}
                      />
                      <div 
                        className="theme-square" 
                        style={{ background: theme.colors.dark }}
                      />
                    </div>
                    <span>{theme.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button className="start-btn" onClick={handleStart}>
            <span className="start-icon">⚡</span>
            Comenzar Partida
            <span className="start-arrow">→</span>
          </button>
        </div>

        <div className="features-list">
          <div className="feature">
            <span className="feature-icon">🤖</span>
            <span>Análisis IA ilimitado</span>
          </div>
          <div className="feature">
            <span className="feature-icon">📊</span>
            <span>Consejos personalizados</span>
          </div>
          <div className="feature">
            <span className="feature-icon">🎯</span>
            <span>Modo entrenamiento visual</span>
          </div>
          <div className="feature">
            <span className="feature-icon">🎨</span>
            <span>Múltiples temas de tablero</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WelcomeScreen;