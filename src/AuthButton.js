import React, { useState, useEffect } from 'react';
import { auth, signInWithGoogle, logOut, getUserProfile } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import './AuthButton.css';

function AuthButton() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        // Cargar perfil completo
        const profileData = await getUserProfile(currentUser.uid);
        if (profileData.success) {
          setProfile(profileData.data);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const result = await signInWithGoogle();
    if (!result.success) {
      alert('Error al iniciar sesión: ' + result.error);
    }
  };

  const handleLogout = async () => {
    const result = await logOut();
    if (result.success) {
      setShowProfile(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <button className="login-btn" onClick={handleLogin}>
        <img 
          src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
          alt="Google"
        />
        Iniciar Sesión
      </button>
    );
  }

  return (
    <div className="auth-container">
      <button 
        className="profile-btn"
        onClick={() => setShowProfile(!showProfile)}
      >
        <img 
          src={user.photoURL || 'https://via.placeholder.com/40'} 
          alt={user.displayName}
          className="profile-avatar"
        />
        <span className="profile-name">{user.displayName?.split(' ')[0]}</span>
        {profile?.premium && <span className="premium-badge">⭐ PRO</span>}
      </button>

      {showProfile && (
        <div className="profile-dropdown">
          <div className="profile-header">
            <img 
              src={user.photoURL || 'https://via.placeholder.com/60'} 
              alt={user.displayName}
            />
            <div>
              <h3>{user.displayName}</h3>
              <p>{user.email}</p>
            </div>
          </div>

          {profile && (
            <div className="profile-stats">
              <div className="stat-item">
                <span className="stat-label">Rating</span>
                <span className="stat-value">{profile.stats.rating}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Partidas</span>
                <span className="stat-value">{profile.stats.totalGames}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Victorias</span>
                <span className="stat-value">{profile.stats.wins}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">W/L Ratio</span>
                <span className="stat-value">
                  {profile.stats.totalGames > 0 
                    ? ((profile.stats.wins / profile.stats.totalGames) * 100).toFixed(1) + '%'
                    : '0%'
                  }
                </span>
              </div>
            </div>
          )}

          <div className="profile-actions">
            {!profile?.premium && (
              <button className="upgrade-btn">
                ⭐ Upgrade a PRO
              </button>
            )}
            <button className="logout-btn" onClick={handleLogout}>
              🚪 Cerrar Sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuthButton;