// FIREBASE INITIALIZATION
const firebaseConfig = {
  apiKey: "AIzaSyD3eOebiiCJNj7FUHtux1_GAq8-CDz0dXo",
  authDomain: "vibestack-60d3a.firebaseapp.com",
  projectId: "vibestack-60d3a",
  storageBucket: "vibestack-60d3a.firebasestorage.app",
  messagingSenderId: "718837803041",
  appId: "1:718837803041:web:3ce299704c1380235ddb60",
  measurementId: "G-9S56SCHHQP"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// UI Elements
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const profileImg = document.getElementById('profile-img');
const googleWarning = document.getElementById('google-warning');
const btnGenerate = document.getElementById('btn-generate-avatar');
const loadingOverlay = document.getElementById('loading-overlay');

// Auth State Observer
auth.onAuthStateChanged(user => {
    if (user) {
        profileName.innerText = user.displayName || localStorage.getItem('user_name') || 'No Name';
        profileEmail.innerText = user.email || 'No Email';
        
        const currentAvatar = user.photoURL || localStorage.getItem('user_avatar') || 'https://api.dicebear.com/7.x/bottts/svg?seed=default';
        profileImg.src = currentAvatar;
        
        const isGoogle = user.providerData.some(p => p.providerId === 'google.com');
        if (isGoogle) {
            googleWarning.style.display = 'block';
            btnGenerate.style.display = 'none';
        } else {
            googleWarning.style.display = 'none';
            btnGenerate.style.display = 'flex';
        }
    } else {
        window.location.href = 'index.html'; // Redirect if not logged in
    }
});

// Generate Unique Avatar
function generateUniqueAvatar() {
    const user = auth.currentUser;
    if (!user) return;
    
    // Generate a globally unique seed (timestamp + random string + user ID)
    const uniqueSeed = Date.now().toString(36) + Math.random().toString(36).substr(2) + user.uid;
    const newAvatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${uniqueSeed}`;
    
    // Show spinner
    loadingOverlay.style.display = 'flex';
    
    // Save to Firebase Auth
    user.updateProfile({ photoURL: newAvatarUrl })
    .then(() => {
        // Save to Firestore
        return db.collection('users').doc(user.uid).set({ avatar: newAvatarUrl }, { merge: true });
    })
    .then(() => {
        // Save to localStorage so home.html can easily pick it up
        localStorage.setItem('user_avatar', newAvatarUrl);
        profileImg.src = newAvatarUrl;
        loadingOverlay.style.display = 'none';
    })
    .catch(err => {
        loadingOverlay.style.display = 'none';
        console.error('Error updating avatar:', err);
        alert('Failed to update avatar: ' + err.message);
    });
}

// Log Out
function logoutUser() {
    auth.signOut().then(() => {
        localStorage.clear();
        window.location.href = "index.html";
    }).catch(err => {
        console.error("Logout Error:", err);
        alert("Logout failed: " + err.message);
    });
}
