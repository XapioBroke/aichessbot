import React, { useState, useEffect } from 'react';
import { auth, signInWithGoogle } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import './LoginScreen.css';

function LoginScreen({ onAuthenticated }) {
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Esperar 1 segundo para mostrar bienvenida antes de continuar
        setTimeout(() => {
          onAuthenticated(currentUser);
        }, 1500);
      } else {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, [onAuthenticated]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    const result = await signInWithGoogle();
    if (!result.success) {
      alert('Error al iniciar sesión: ' + result.error);
      setLoading(false);
    }
  };

  const handleGuestMode = () => {
    // Continuar sin login
    onAuthenticated(null);
  };

  if (user) {
    // Pantalla de bienvenida después del login
    return (
      <div className="login-screen">
        <div className="login-container welcome-animation">
          <div className="success-icon">✅</div>
          <h2>¡Bienvenido, {user.displayName?.split(' ')[0]}!</h2>
          <p>Cargando tu perfil...</p>
          <div className="loading-bar">
            <div className="loading-progress"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-background">
        <div className="chess-piece piece-1">♔</div>
        <div className="chess-piece piece-2">♕</div>
        <div className="chess-piece piece-3">♖</div>
        <div className="chess-piece piece-4">♗</div>
        <div className="chess-piece piece-5">♘</div>
        <div className="chess-piece piece-6">♙</div>
      </div>

      <div className="login-container">
        <div className="login-logo">
          <div className="logo-icon">♟️</div>
          <h1>AiChessBot</h1>
          <p className="tagline">Mejora tu ajedrez con inteligencia artificial</p>
        </div>

        <div className="login-card">
          <h2>Comienza tu Entrenamiento</h2>
          <p className="login-subtitle">
            Inicia sesión para guardar tu progreso, estadísticas y partidas
          </p>

          <button 
            className="google-login-btn" 
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="btn-spinner"></div>
                <span>Conectando...</span>
              </>
            ) : (
              <>
                <img 
                  src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
                  alt="Google"
                />
                <span>Continuar con Google</span>
              </>
            )}
          </button>

          <div className="divider">
            <span>o</span>
          </div>

          <button 
            className="guest-btn" 
            onClick={handleGuestMode}
            disabled={loading}
          >
            <span>🎮</span>
            <span>Jugar como Invitado</span>
          </button>

          <div className="login-benefits">
            <div className="benefit-item">
              <span className="benefit-icon">📊</span>
              <span>Estadísticas y Rankings</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">💾</span>
              <span>Guarda tus Partidas</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">🏆</span>
              <span>Desbloquea Logros</span>
            </div>
            <div className="benefit-item">
              <span className="benefit-icon">🎨</span>
              <span>Personalización Avanzada</span>
            </div>
          </div>

          <p className="login-privacy">
            Al continuar, aceptas nuestros términos de servicio.
            Tu información está protegida y nunca compartida.
          </p>
        </div>

        <div className="login-stats">
          <div className="stat-box">
            <span className="stat-number">10,000+</span>
            <span className="stat-label">Jugadores</span>
          </div>
          <div className="stat-box">
            <span className="stat-number">50,000+</span>
            <span className="stat-label">Partidas</span>
          </div>
          <div className="stat-box">
            <span className="stat-number">4.9⭐</span>
            <span className="stat-label">Rating</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginScreen;