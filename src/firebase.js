import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

// Tu configuración de Firebase
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyCszYoYKyde3GOU770WPiibowG9QlbFydc",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "aichessbot-4a415.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "aichessbot-4a415",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "aichessbot-4a415.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "18405457801",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:18405457801:web:eeadadf16f7b387df0ab58",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-2J2F3S23D0"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = getAnalytics(app);

// Providers
const googleProvider = new GoogleAuthProvider();

// ==========================================
// AUTENTICACIÓN
// ==========================================

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Crear/actualizar perfil de usuario
    await createOrUpdateUserProfile(user);
    
    return {
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      }
    };
  } catch (error) {
    console.error('Error en login:', error);
    return { success: false, error: error.message };
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error('Error en logout:', error);
    return { success: false, error: error.message };
  }
};

// ==========================================
// USUARIOS
// ==========================================

export const createOrUpdateUserProfile = async (user) => {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    // Nuevo usuario
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      createdAt: new Date().toISOString(),
      stats: {
        totalGames: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        rating: 1200
      },
      premium: false,
      skins: ['classic', 'modern', 'ocean'], // Skins gratis
      selectedSkin: 'classic'
    });
  } else {
    // Usuario existente - actualizar última conexión
    await setDoc(userRef, {
      lastLogin: new Date().toISOString()
    }, { merge: true });
  }
};

export const getUserProfile = async (uid) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return { success: true, data: userSnap.data() };
    }
    return { success: false, error: 'Usuario no encontrado' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const updateUserStats = async (uid, gameResult) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const currentStats = userSnap.data().stats;
      
      const newStats = {
        totalGames: currentStats.totalGames + 1,
        wins: gameResult === 'win' ? currentStats.wins + 1 : currentStats.wins,
        losses: gameResult === 'loss' ? currentStats.losses + 1 : currentStats.losses,
        draws: gameResult === 'draw' ? currentStats.draws + 1 : currentStats.draws,
        rating: calculateNewRating(currentStats.rating, gameResult)
      };
      
      await setDoc(userRef, { stats: newStats }, { merge: true });
      return { success: true, newStats };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

function calculateNewRating(currentRating, result) {
  const K = 32; // Factor K de ELO
  if (result === 'win') return Math.min(3000, currentRating + K);
  if (result === 'loss') return Math.max(100, currentRating - K);
  return currentRating; // Draw no cambia rating
}

// ==========================================
// PARTIDAS
// ==========================================

export const saveGame = async (uid, gameData) => {
  try {
    const gamesRef = collection(db, 'games');
    const gameDoc = await addDoc(gamesRef, {
      userId: uid,
      pgn: gameData.pgn,
      moves: gameData.moves,
      result: gameData.result,
      difficulty: gameData.difficulty,
      playerColor: gameData.playerColor,
      duration: gameData.duration,
      createdAt: new Date().toISOString(),
      fen: gameData.fen
    });
    
    return { success: true, gameId: gameDoc.id };
  } catch (error) {
    console.error('Error guardando partida:', error);
    return { success: false, error: error.message };
  }
};

export const getUserGames = async (uid, limitCount = 10) => {
  try {
    const gamesRef = collection(db, 'games');
    const q = query(
      gamesRef,
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const games = [];
    
    querySnapshot.forEach((doc) => {
      games.push({ id: doc.id, ...doc.data() });
    });
    
    return { success: true, games };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ==========================================
// RANKINGS
// ==========================================

export const getTopPlayers = async (limitCount = 100) => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      orderBy('stats.rating', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    const rankings = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      rankings.push({
        uid: doc.id,
        displayName: data.displayName,
        photoURL: data.photoURL,
        rating: data.stats.rating,
        totalGames: data.stats.totalGames,
        wins: data.stats.wins,
        premium: data.premium
      });
    });
    
    return { success: true, rankings };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ==========================================
// SKINS
// ==========================================

export const purchaseSkin = async (uid, skinId) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const currentSkins = userSnap.data().skins || [];
      
      if (!currentSkins.includes(skinId)) {
        currentSkins.push(skinId);
        await setDoc(userRef, { skins: currentSkins }, { merge: true });
      }
      
      return { success: true };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const selectSkin = async (uid, skinId) => {
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, { selectedSkin: skinId }, { merge: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// ==========================================
// PREMIUM
// ==========================================

export const upgradeToPremium = async (uid, subscriptionId) => {
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      premium: true,
      premiumSince: new Date().toISOString(),
      subscriptionId: subscriptionId
    }, { merge: true });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Exportar instancias
export { auth, db, analytics };
export default app;