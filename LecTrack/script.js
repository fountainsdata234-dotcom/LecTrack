// 1. FIREBASE CONFIGURATION
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

const SUPER_ADMIN = "fountainsdata234@gmail.com";

async function determineRole(email, currentDbRole) {
    const emailVal = (email || "").toLowerCase();
    if (emailVal === SUPER_ADMIN) return "superadmin";

    try {
        const rolesDoc = await db.collection("settings").doc("roles").get();
        if (rolesDoc.exists) {
            const adminsList = rolesDoc.data().admins || [];
            if (adminsList.includes(emailVal)) return "admin";
        }
    } catch (e) {
        console.warn("Failed to fetch settings/roles:", e);
    }
    
    return currentDbRole || "student";
}

// 2. LIVELY BACKGROUND & MOUSE TRACKING
particlesJS("particles-js", {
    "particles": {
        "number": { "value": 80, "density": { "enable": true, "value_area": 800 } },
        "color": { "value": "#00d4ff" },
        "shape": { "type": "circle" },
        "opacity": { "value": 0.5 },
        "size": { "value": 3 },
        "line_linked": { "enable": true, "distance": 150, "color": "#00d4ff", "opacity": 0.5, "width": 1 },
        "move": { "enable": true, "speed": -5 }
    },
    "interactivity": {
        "events": { "onhover": { "enable": true, "mode": "grab" } }
    }
});

// FLUID BLOB MOVEMENT (Follows the mouse closely, centered on cursor)
const blobBlack = document.querySelector(".b-black");
const blobSkyblue = document.querySelector(".b-skyblue");

if (blobBlack && blobSkyblue) {
    // Reveal blobs only after we know the mouse position (avoids flash at top-left)
    let revealed = false;

    document.addEventListener('mousemove', (e) => {
        const { clientX, clientY } = e;

        if (!revealed) {
            gsap.to([blobBlack, blobSkyblue], { opacity: 0.55, duration: 0.6 });
            revealed = true;
        }

        const blackHalf = blobBlack.offsetWidth / 2;
        const skyHalf = blobSkyblue.offsetWidth / 2;

        // SkyBlue blob: tightly tracks the cursor, centered on it
        gsap.to(blobSkyblue, {
            x: clientX - skyHalf,
            y: clientY - skyHalf,
            duration: 0.5,
            ease: "power3.out"
        });

        // Black blob: slightly softer follow, still centered on cursor, minimal lag
        gsap.to(blobBlack, {
            x: clientX - blackHalf,
            y: clientY - blackHalf,
            duration: 0.9,
            ease: "power2.out"
        });
    });

    // Start hidden until first mouse move
    gsap.set([blobBlack, blobSkyblue], { opacity: 0 });
}


// 3. UI UTILITIES
window.onload = () => {
    // Animate hero content immediately
    gsap.from(".hero-content.gsap-reveal", { y: 40, opacity: 0, duration: 1.2, ease: "power4.out" });
    
    // Register ScrollTrigger for scroll-based animation
    gsap.registerPlugin(ScrollTrigger);
    
    // Animate about section when it scrolls into view
    gsap.from(".info-container.gsap-reveal", {
        scrollTrigger: {
            trigger: ".info-container.gsap-reveal",
            start: "top 85%",
            toggleActions: "play none none none"
        },
        y: 40,
        opacity: 0,
        duration: 1.2,
        ease: "power4.out"
    });

    // Debug Help: Print registered students & pre-enrolled credentials to console
    db.collection("users").get().then(snapshot => {
        console.log("%c=== LECTRACK REGISTERED USERS ===", "color: #00d4ff; font-weight: bold;");
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`Name: ${data.fullName} | Email: ${data.email} | Student ID: ${data.studentId} | Role: ${data.role}`);
        });
    }).catch(err => {
        console.warn("Note: Active Firestore rules blocked public user list query:", err.message);
    });

    db.collection("enrollment").get().then(snapshot => {
        console.log("%c=== LECTRACK PRE-AUTHORIZED ENROLLMENTS ===", "color: #ffaa00; font-weight: bold;");
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`Email: ${doc.id} | Student ID: ${data.studentId} | Passkey: ${data.passkey}`);
        });
    }).catch(err => {
        console.warn("Note: Active Firestore rules blocked public enrollment list query:", err.message);
    });
};

function openAuth(type) {
    const modal = document.getElementById('auth-modal');
    modal.style.display = 'flex';
    switchForm(type);
    
    // Clear any previous inline styles to allow from animation to work correctly
    gsap.set(".modal-content", { clearProps: "all" });
    
    // Reset loader states
    setLoading('btn-login', false);
    setLoading('btn-reg', false);
    
    gsap.from(".modal-content", { scale: 0.8, opacity: 0, duration: 0.5, ease: "back.out(1.7)" });
}

function closeAuth() {
    gsap.to(".modal-content", { scale: 0.8, opacity: 0, duration: 0.3, onComplete: () => {
        document.getElementById('auth-modal').style.display = 'none';
        // Clear properties so modal isn't stuck with opacity 0 next time it opens
        gsap.set(".modal-content", { clearProps: "all" });
    }});
}

function switchForm(type) {
    document.getElementById('login-form').classList.toggle('hidden', type !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', type !== 'register');
}

function togglePass(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (input.type === "password") {
        input.type = "text";
        icon.classList.replace("fa-eye", "fa-eye-slash");
    } else {
        input.type = "password";
        icon.classList.replace("fa-eye-slash", "fa-eye");
    }
}

function setLoading(btnId, isLoading) {
    const btn = document.getElementById(btnId);
    if (isLoading) btn.classList.add('btn-loading');
    else btn.classList.remove('btn-loading');
}

// 4. AUTHENTICATION LOGIC (THE GATEKEEPER)

// WHATSAPP ID REQUEST
function requestAccess() {
    const email = prompt("Please enter the email you wish to register with:");
    if (!email || !email.includes('@')) return alert("Valid email required.");

    const receipt = `
*LECTRACK INSTITUTIONAL PORTAL*
---------------------------------------
*ID & PASSCODE REQUEST RECEIPT*
Student Email: ${email}
Status: PENDING VERIFICATION
---------------------------------------
Hi Admin, I wish to enroll. Please generate my Student ID and Passcode for this email.`;

    window.open(`https://wa.me/2348029772375?text=${encodeURIComponent(receipt)}`, "_blank");
}

// REGISTRATION
async function handleRegister() {
    const name = document.getElementById('r-name').value.trim();
    const mail = document.getElementById('r-email').value.trim().toLowerCase();
    const pass = document.getElementById('r-pass').value;
    const stuId = document.getElementById('r-id').value.trim();
    const key = document.getElementById('r-key').value.trim();

    if(!name || !mail || !pass || !stuId || !key) return alert("All credentials required.");

    setLoading('btn-reg', true);

    try {
        // Verify against Admin's pre-registered list
        const verifyRef = db.collection("enrollment").doc(mail);
        const doc = await verifyRef.get();
        
console.log("Database ID found?", doc.exists);
if(doc.exists) console.log("Database Data:", doc.data());

        if (!doc.exists || doc.data().studentId !== stuId || doc.data().passkey !== key) {
            setLoading('btn-reg', false);
            return alert("Security Mismatch: Your Student ID or Passcode is incorrect.");
        }

        // Create Official Account
        const cred = await auth.createUserWithEmailAndPassword(mail, pass);

        const roleVal = await determineRole(mail, "student");
        let avatarVal = `https://api.dicebear.com/7.x/avataaars/svg?seed=${cred.user.uid}`;
        if (mail.endsWith("@gmail.com") || mail.endsWith("@googlemail.com")) {
            avatarVal = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
        }

        // Store login info in localStorage immediately for instant access
        localStorage.setItem("user_fullName", name);
        localStorage.setItem("user_email", mail);
        localStorage.setItem("user_studentId", stuId);
        localStorage.setItem("user_role", roleVal);
        localStorage.setItem("user_avatar", avatarVal);

        // Create Student Profile in Firestore (non-blocking)
        try {
            await db.collection("users").doc(cred.user.uid).set({
                fullName: name,
                email: mail,
                studentId: stuId,
                avatar: avatarVal,
                role: roleVal,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (dbErr) {
            console.warn("Firestore profile creation warning:", dbErr);
        }

        // Record signup & login in login history (non-blocking)
        try {
            await db.collection("login_history").add({
                email: mail,
                uid: cred.user.uid,
                action: "signup",
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userAgent: navigator.userAgent
            });
        } catch (dbErr) {
            console.warn("Firestore login history logging warning:", dbErr);
        }

        window.location.href = "home.html";

    } catch (e) {
        setLoading('btn-reg', false);
        alert("Enrollment Error: " + e.message);
    }
}

// LOGIN
async function handleLogin() {
    const mail = document.getElementById('l-email').value.trim().toLowerCase();
    const pass = document.getElementById('l-pass').value;

    if(!mail || !pass) return alert("Fill in your details.");
    setLoading('btn-login', true);

    try {
        const cred = await auth.signInWithEmailAndPassword(mail, pass);
        
        let fetchedData = null;
        // Fetch user profile from Firestore (non-blocking)
        try {
            const userDoc = await db.collection("users").doc(cred.user.uid).get();
            if (userDoc.exists) {
                fetchedData = userDoc.data();
            }
        } catch (dbErr) {
            console.warn("Firestore profile fetch warning:", dbErr);
        }

        const roleVal = await determineRole(mail, fetchedData?.role);
        const nameVal = fetchedData?.fullName || (roleVal === "superadmin" || roleVal === "admin" ? "Admin" : "Gater");
        const idVal = fetchedData?.studentId || "LT/PENDING";
        
        let avatarVal = fetchedData?.avatar;
        if (!avatarVal) {
            if (mail.endsWith("@gmail.com") || mail.endsWith("@googlemail.com")) {
                avatarVal = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(nameVal)}`;
            } else {
                avatarVal = `https://api.dicebear.com/7.x/avataaars/svg?seed=${cred.user.uid}`;
            }
        }

        localStorage.setItem("user_fullName", nameVal);
        localStorage.setItem("user_email", mail);
        localStorage.setItem("user_studentId", idVal);
        localStorage.setItem("user_role", roleVal);
        localStorage.setItem("user_avatar", avatarVal);

        // Record login in login history (non-blocking)
        try {
            await db.collection("login_history").add({
                email: mail,
                uid: cred.user.uid,
                action: "login",
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userAgent: navigator.userAgent
            });
        } catch (dbErr) {
            console.warn("Firestore login history logging warning:", dbErr);
        }

        window.location.href = "home.html";
    } catch (e) {
        setLoading('btn-login', false);
        alert("Login Error: " + e.message);
    }
}

// FORGOTTEN PASSWORD
function handleForgot() {
    const email = document.getElementById('l-email').value.trim();
    if (!email) return alert("Enter your email in the login box first.");
    
    auth.sendPasswordResetEmail(email).then(() => {
        alert("Recovery link sent to your email!");
    }).catch(e => alert(e.message));
}

// GOOGLE FLOW (GATED)

// Detect mobile / in-app browsers where popups are unreliable, so we
// automatically fall back to a full-page redirect flow.
function isMobileOrInApp() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    return /android|iphone|ipad|ipod|iemobile|opera mini|webos|FBAN|FBAV|Instagram/i.test(ua);
}

async function handleGoogleSignIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    // On mobile / in-app browsers, popups are frequently blocked or fail
    // silently, so we redirect instead. The result is captured on page
    // load via auth.getRedirectResult() below.
    if (isMobileOrInApp()) {
        try {
            await auth.signInWithRedirect(provider);
        } catch (e) {
            alert("Google Sign-In Error: " + e.message);
        }
        return;
    }

    try {
        const result = await auth.signInWithPopup(provider);
        await processGoogleUser(result.user);
    } catch (e) {
        // If the popup was blocked/failed for a non-mobile browser, retry with redirect.
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
            try {
                await auth.signInWithRedirect(provider);
            } catch (err) {
                alert("Google Sign-In Error: " + err.message);
            }
        } else if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
            // User simply closed the popup — no need to alert an error.
        } else {
            alert("Google Sign-In Error: " + e.message);
        }
    }
}

// Handles both popup results and redirect results (called on every page load).
async function processGoogleUser(user) {
    if (!user) return;

    try {
        let fetchedData = null;
        // Check if user already exists (non-blocking)
        try {
            const userDoc = await db.collection("users").doc(user.uid).get();
            if (userDoc.exists) {
                fetchedData = userDoc.data();
            }
        } catch (dbErr) {
            console.warn("Firestore profile check warning:", dbErr);
        }

        if (fetchedData) {
            // FIX: declare emailVal first so nameVal can safely reference it
            const emailVal = (fetchedData.email || user.email || "").toLowerCase();
            const roleVal = await determineRole(emailVal, fetchedData.role);
            const nameVal = fetchedData.fullName || user.displayName || (roleVal === "superadmin" || roleVal === "admin" ? "Admin" : "Gater");
            const idVal = fetchedData.studentId || "LT/PENDING";
            
            // Prefer the live Google photo URL (always up to date), then stored, then generated
            let avatarVal = user.photoURL || fetchedData.avatar;
            if (!avatarVal) {
                if (emailVal.endsWith("@gmail.com") || emailVal.endsWith("@googlemail.com")) {
                    avatarVal = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(nameVal)}`;
                } else {
                    avatarVal = `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`;
                }
            }

            localStorage.setItem("user_fullName", nameVal);
            localStorage.setItem("user_email", emailVal);
            localStorage.setItem("user_studentId", idVal);
            localStorage.setItem("user_role", roleVal);
            localStorage.setItem("user_avatar", avatarVal);

            // Update Firestore with fresh Google photo URL (non-blocking)
            try {
                await db.collection("users").doc(user.uid).update({ avatar: avatarVal });
            } catch (_) {}

            // Record login in login history (non-blocking)
            try {
                await db.collection("login_history").add({
                    email: emailVal,
                    uid: user.uid,
                    action: "google_login",
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    userAgent: navigator.userAgent
                });
            } catch (dbErr) {
                console.warn("Firestore login history logging warning:", dbErr);
            }

            window.location.href = "home.html";
            return;
        }


        // NEW GOOGLE USER MUST VERIFY ID
        const id = prompt("New Enrollment via Google. Enter your Student ID:");
        if (id === null) return; // user cancelled — leave their auth session as-is, don't delete

        const key = prompt("Enter your Passcode:");
        if (key === null) return; // user cancelled

        // Verify ID against admin list
        let verifyDocExists = false;
        let verifyDocData = null;
        try {
            const verifyDoc = await db.collection("enrollment").doc(user.email.toLowerCase()).get();
            if (verifyDoc.exists) {
                verifyDocExists = true;
                verifyDocData = verifyDoc.data();
            }
        } catch (dbErr) {
            console.error("Enrollment check error:", dbErr);
            alert("Enrollment Check Failed: Database error.");
            return;
        }

        if (!verifyDocExists || verifyDocData.studentId !== id.trim() || verifyDocData.passkey !== key.trim()) {
            alert("Authorization Failed: Student ID or Passcode incorrect.");
            await user.delete().catch(() => auth.signOut());
            return;
        }

        const roleVal = await determineRole(user.email, "student");
        const nameVal = user.displayName || (roleVal === "superadmin" || roleVal === "admin" ? "Admin" : "Gater");
        let avatarVal = user.photoURL;
        if (!avatarVal) {
            if (user.email.toLowerCase().endsWith("@gmail.com") || user.email.toLowerCase().endsWith("@googlemail.com")) {
                avatarVal = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(nameVal)}`;
            } else {
                avatarVal = `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`;
            }
        }

        // Cache immediately in localstorage
        localStorage.setItem("user_fullName", nameVal);
        localStorage.setItem("user_email", user.email);
        localStorage.setItem("user_studentId", id.trim());
        localStorage.setItem("user_role", roleVal);
        localStorage.setItem("user_avatar", avatarVal);

        // Save profile in Firestore (non-blocking)
        try {
            await db.collection("users").doc(user.uid).set({
                fullName: nameVal,
                studentId: id.trim(),
                email: user.email,
                avatar: avatarVal,
                role: roleVal,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (dbErr) {
            console.warn("Firestore profile creation warning:", dbErr);
        }

        // Record signup & login in login history (non-blocking)
        try {
            await db.collection("login_history").add({
                email: user.email.toLowerCase(),
                uid: user.uid,
                action: "google_signup",
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userAgent: navigator.userAgent
            });
        } catch (dbErr) {
            console.warn("Firestore login history logging warning:", dbErr);
        }

        window.location.href = "home.html";

    } catch (e) {
        alert("Google Sign-In Error: " + e.message);
    }
}

// Catch the result of a redirect-based sign-in (mobile fallback) as soon
// as the page loads.
auth.getRedirectResult().then((result) => {
    if (result && result.user) {
        processGoogleUser(result.user);
    }
}).catch((e) => {
    if (e && e.code && e.code !== 'auth/no-current-user') {
        console.error("Redirect sign-in error:", e.message);
    }
});

// Landing page mobile menu toggle
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');
if (navToggle && navMenu) {
    navToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        navToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!navMenu.contains(e.target) && !navToggle.contains(e.target)) {
            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
        }
    });

    // Close menu when clicking a link
    navMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });
}


