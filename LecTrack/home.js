// 1. FIREBASE INITIALIZATION
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

// 2. INSTANT CREDENTIAL LOAD FROM CACHE (Avoids Gater delay)
const cachedName = localStorage.getItem("user_fullName");
const cachedId = localStorage.getItem("user_studentId");
const cachedAvatar = localStorage.getItem("user_avatar");
const cachedRole = localStorage.getItem("user_role");

if (cachedName) {
    document.getElementById('d-name').innerText = cachedName;
    document.getElementById('m-name').innerText = cachedName;
    const mIdEl = document.getElementById('m-id');
    if (mIdEl) mIdEl.innerText = cachedId || "LT/PENDING";

    const dAvatar = document.getElementById('d-avatar');
    const mAvatar = document.getElementById('m-avatar');
    if (dAvatar && cachedAvatar) dAvatar.src = cachedAvatar;
    if (mAvatar && cachedAvatar) mAvatar.src = cachedAvatar;

    const firstName = cachedName.split(' ')[0];
    initFallingText(`Welcome back, ${firstName}`);
} else {
    initFallingText("Welcome back, Gater");
}

// 3. AUTH STATE & USER ROLE DISPATCH
auth.onAuthStateChanged(async user => {
    if (user) {
        // Retrieve profile from Firestore
        db.collection("users").doc(user.uid).get().then(async doc => {
            let fullName = "Gater";
            let studentId = "LT/PENDING";
            let avatar = "";
            let role = "student";

            if (doc.exists) {
                const data = doc.data();
                role = await determineRole(user.email, data.role);
                fullName = data.fullName || user.displayName || (role === "superadmin" || role === "admin" ? "Admin" : "Gater");
                studentId = data.studentId || (role === "superadmin" || role === "admin" ? "Admin Portal" : "LT/PENDING");
                avatar = data.avatar || user.photoURL || "";
            } else {
                role = await determineRole(user.email, "student");
                fullName = user.displayName || (role === "superadmin" || role === "admin" ? "Admin" : "Gater");
                avatar = user.photoURL || "";
            }

            // Sync Google Account profile picture if email matches Gmail and no photo URL is in DB
            if (user.email && (user.email.toLowerCase().endsWith("@gmail.com") || user.email.toLowerCase().endsWith("@googlemail.com"))) {
                let googlePhoto = user.photoURL;
                if (!googlePhoto && user.providerData) {
                    const googleProvider = user.providerData.find(p => p.providerId === "google.com");
                    if (googleProvider && googleProvider.photoURL) {
                        googlePhoto = googleProvider.photoURL;
                    }
                }
                if (googlePhoto && avatar !== googlePhoto) {
                    avatar = googlePhoto;
                    // Update user profile photo URL in Firestore database (non-blocking)
                    db.collection("users").doc(user.uid).update({
                        avatar: googlePhoto
                    }).catch(err => console.warn("Firestore user avatar update warning:", err));
                }
            }

            // Fallback avatar for Gmail accounts (Initials) if not loaded from Google or custom DB
            if (!avatar || avatar.includes("adventurer") || avatar.includes("avataaars")) {
                if (user.email && (user.email.toLowerCase().endsWith("@gmail.com") || user.email.toLowerCase().endsWith("@googlemail.com"))) {
                    avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fullName)}`;
                } else {
                    avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`;
                }
            }

            // Write back to Cache
            localStorage.setItem("user_fullName", fullName);
            localStorage.setItem("user_studentId", studentId);
            localStorage.setItem("user_avatar", avatar);
            localStorage.setItem("user_role", role);
            localStorage.setItem("user_email", user.email);

            // Sync Header UI elements
            document.getElementById('d-name').innerText = fullName;
            document.getElementById('m-name').innerText = fullName;
            const mIdEl = document.getElementById('m-id');
            if (mIdEl) mIdEl.innerText = (role === "superadmin" || role === "admin") ? "Admin Portal" : studentId;

            const dAvatar = document.getElementById('d-avatar');
            const mAvatar = document.getElementById('m-avatar');
            if (dAvatar) dAvatar.src = avatar;
            if (mAvatar) mAvatar.src = avatar;

            const firstName = fullName.split(' ')[0];
            initFallingText(`Welcome back, ${firstName}`);

            // Setup Workspaces & Nav links
            setupRoleWorkspaces(role, fullName, studentId, avatar);

        }).catch(async err => {
            console.warn("Firestore profile fetch failed, using fallback:", err);
            
            const fallbackRole = await determineRole(user.email, localStorage.getItem("user_role"));
            const fallbackName = localStorage.getItem("user_fullName") || user.displayName || (fallbackRole === "superadmin" || fallbackRole === "admin" ? "Admin" : "Gater");
            const fallbackId = localStorage.getItem("user_studentId") || (fallbackRole === "superadmin" || fallbackRole === "admin" ? "Admin Portal" : "LT/PENDING");
            
            let fallbackAvatar = localStorage.getItem("user_avatar");
            if (!fallbackAvatar) {
                if (user.email && (user.email.toLowerCase().endsWith("@gmail.com") || user.email.toLowerCase().endsWith("@googlemail.com"))) {
                    fallbackAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fallbackName)}`;
                } else {
                    fallbackAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`;
                }
            }

            // Sync Header UI elements
            document.getElementById('d-name').innerText = fallbackName;
            document.getElementById('m-name').innerText = fallbackName;
            const mIdEl = document.getElementById('m-id');
            if (mIdEl) mIdEl.innerText = fallbackRole === "admin" ? "Admin Portal" : fallbackId;

            const dAvatar = document.getElementById('d-avatar');
            const mAvatar = document.getElementById('m-avatar');
            if (dAvatar) dAvatar.src = fallbackAvatar;
            if (mAvatar) mAvatar.src = fallbackAvatar;

            const firstName = fallbackName.split(' ')[0];
            initFallingText(`Welcome back, ${firstName}`);

            setupRoleWorkspaces(fallbackRole, fallbackName, fallbackId, fallbackAvatar);
        });

        // LIVE STUDENTS TRACKER: Heartbeat (ping every 15s)
        window.studentHeartbeat = setInterval(() => {
            db.collection("users").doc(user.uid).set({
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).catch(e => console.warn("Heartbeat update blocked by permissions or network"));
        }, 15000);
        // Initial ping
        db.collection("users").doc(user.uid).set({ 
            lastSeen: firebase.firestore.FieldValue.serverTimestamp() 
        }, { merge: true }).catch(e => {});

        // LIVE STUDENTS TRACKER: Admin listener
        setTimeout(() => {
            const role = localStorage.getItem("user_role");
            if (role === "admin") {
                const countEl = document.getElementById("admin-count-online");
                if (countEl) {
                    const fetchOnline = () => {
                        const threeMinsAgo = new Date(Date.now() - 3 * 60000);
                        db.collection("users")
                          .where("lastSeen", ">=", threeMinsAgo)
                          .get()
                          .then(snap => {
                              // Filter in memory to avoid Firestore composite index requirements
                              const count = snap.docs.filter(d => d.data().role !== 'admin').length;
                              countEl.innerText = count;
                          })
                          .catch(e => console.warn("Failed to fetch online students:", e));
                    };
                    fetchOnline();
                    setInterval(fetchOnline, 15000); // Check every 15 seconds
                }
            }
        }, 3000);

    } else {
        if (window.studentHeartbeat) clearInterval(window.studentHeartbeat);
        localStorage.clear();
        window.location.href = "index.html";
    }
});

// 3. FALLING LETTERS BOUNCE-ON-BASE ANIMATION (GSAP)
function initFallingText(text) {
    const container = document.getElementById('welcome-text');
    if (!container) return;
    container.innerHTML = "";
    
    const words = text.split(" ");
    
    words.forEach((word, wIdx) => {
        const wordSpan = document.createElement("span");
        wordSpan.className = "word-wrap";
        
        word.split("").forEach((char) => {
            const charSpan = document.createElement("span");
            charSpan.innerText = char;
            charSpan.style.display = "inline-block";
            charSpan.style.transformOrigin = "bottom center";
            wordSpan.appendChild(charSpan);
            
            gsap.set(charSpan, { y: -150, opacity: 0, scaleY: 1.5, scaleX: 0.7 });
            
            const randomDelay = Math.random() * 0.6;
            
            gsap.to(charSpan, {
                y: 0,
                opacity: 1,
                delay: randomDelay,
                duration: 0.5,
                ease: "power2.in",
                onComplete: () => {
                    const tl = gsap.timeline();
                    tl.to(charSpan, { scaleY: 0.55, scaleX: 1.45, duration: 0.08, ease: "power1.out" })
                      .to(charSpan, { scaleY: 1.25, scaleX: 0.85, y: -22, duration: 0.14, ease: "power1.inOut" })
                      .to(charSpan, { scaleY: 0.88, scaleX: 1.08, y: 0, duration: 0.1, ease: "power1.in" })
                      .to(charSpan, { scaleY: 1, scaleX: 1, duration: 0.08 });
                }
            });
        });
        
        container.appendChild(wordSpan);
        
        if (wIdx < words.length - 1) {
            const spaceSpan = document.createElement("span");
            spaceSpan.innerHTML = "&nbsp;";
            spaceSpan.style.display = "inline-block";
            container.appendChild(spaceSpan);
        }
    });
}

// 4. ROLE-BASED WORKSPACE ADAPTOR
function setupRoleWorkspaces(role, fullName, studentId, avatar) {
    const studentWorkspace = document.getElementById('student-workspace');
    const adminWorkspace = document.getElementById('admin-workspace');
    const welcomeSub = document.getElementById('welcome-sub');
    const menu = document.getElementById('menu');

    if (role === "admin" || role === "superadmin") {
        // Show Admin workspace & hide Student workspace
        studentWorkspace.style.display = 'none';
        adminWorkspace.style.display = 'block';
        welcomeSub.innerText = "System Management Core • Gated Administrator Access";

        // Setup Admin Navigation Menu
        menu.innerHTML = `
            <li><a href="#" class="nav-tab active" data-tab="admin-dashboard"><i class="fa-solid fa-house"></i> Dashboard</a></li>
            <li><a href="#" class="nav-tab" data-tab="admin-students"><i class="fa-solid fa-users"></i> Students</a></li>
            <li><a href="#" class="nav-tab" data-tab="admin-submissions"><i class="fa-solid fa-file-invoice"></i> Submissions</a></li>
            <li><a href="#" class="nav-tab" data-tab="admin-lectures"><i class="fa-solid fa-scroll"></i> Lectures</a></li>
            <li><a href="#" class="nav-tab" data-tab="admin-assignments"><i class="fa-solid fa-tasks"></i> Assignments</a></li>
            <li><a href="#" class="nav-tab" data-tab="admin-notifications"><i class="fa-solid fa-bell"></i> Notifications</a></li>
            ${role === "superadmin" ? '<li><a href="#" class="nav-tab" data-tab="admin-management"><i class="fa-solid fa-user-shield"></i> Manage Admins</a></li>' : ''}
            
            <li class="mobile-only profile-mobile">
                <div class="user-profile-card">
                    <img id="m-avatar" src="${avatar}" alt="DP">
                    <div class="p-meta">
                        <span id="m-name" class="p-name">${fullName}</span>
                        <span id="m-id" class="p-id">${role === "superadmin" ? "Super Admin" : "Admin Portal"}</span>
                    </div>
                </div>
            </li>
            <li class="mobile-only toggle-mobile">
                <button class="theme-switch-btn" onclick="toggleTheme()">
                    <i class="fas fa-moon"></i> <span>Toggle Theme</span>
                </button>
            </li>
        `;

        // Switch admin to overview dashboard panel
        switchTab("admin-dashboard");
        syncAdminDashboard();

    } else {
        // Show Student workspace & hide Admin workspace
        studentWorkspace.style.display = 'block';
        adminWorkspace.style.display = 'none';
        welcomeSub.innerText = "Academic Session: 2026/2027 • Faculty of Technology";

        // Setup Student Navigation Menu
        menu.innerHTML = `
            <li><a href="#" class="nav-tab active" data-tab="student-home"><i class="fa-solid fa-house"></i> Home</a></li>
            <li><a href="#" class="nav-tab" data-tab="student-lectures"><i class="fa-solid fa-book-open"></i> Lectures</a></li>
            <li><a href="#" class="nav-tab" data-tab="student-assignments"><i class="fa-solid fa-file-signature"></i> Assignments</a></li>
            <li><a href="#" class="nav-tab" data-tab="student-grades"><i class="fa-solid fa-chart-simple"></i> Grades</a></li>
            
            <li class="mobile-only profile-mobile">
                <div class="user-profile-card">
                    <img id="m-avatar" src="${avatar}" alt="DP">
                    <div class="p-meta">
                        <span id="m-name" class="p-name">${fullName}</span>
                        <span id="m-id" class="p-id">${studentId}</span>
                    </div>
                </div>
            </li>
            <li class="mobile-only toggle-mobile">
                <button class="theme-switch-btn" onclick="toggleTheme()">
                    <i class="fas fa-moon"></i> <span>Toggle Theme</span>
                </button>
            </li>
        `;

        // Switch student to homepage feed panel
        switchTab("student-home");
        syncStudentDashboard();
    }

    setupTabNavigation();
}

// 5. SPA PANEL TAB CONTROL SYSTEM (GSAP-ANIMATED)
function setupTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        // Remove previous listeners
        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);
        
        newTab.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = newTab.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });
}

function switchTab(tabId) {
    // Update menu classes
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(t => {
        if (t.getAttribute('data-tab') === tabId) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });

    // Toggle panel displays
    const panels = document.querySelectorAll('.tab-panel');
    panels.forEach(p => {
        if (p.id === `panel-${tabId}`) {
            p.style.display = 'block';
            p.classList.add('active');
            gsap.fromTo(p, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" });
        } else {
            p.style.display = 'none';
            p.classList.remove('active');
        }
    });

    // Close hamburger menu on mobile clicks
    const ham = document.getElementById('ham');
    const menu = document.getElementById('menu');
    if (ham && menu) {
        ham.classList.remove('active');
        menu.classList.remove('active');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Recalculate smart footer visibility after transition
    setTimeout(() => {
        footerTriggered = false;
        checkFooterVisibility();
    }, 450);
}

function goToHomeTab() {
    const role = localStorage.getItem("user_role") || "student";
    if (role === "admin") {
        switchTab("admin-dashboard");
    } else {
        switchTab("student-home");
    }
}

// 6. STUDENT SYNCHRONIZATION SYSTEM
function syncStudentDashboard() {
    const user = auth.currentUser;
    if (!user) return;

    // A. Sync student checklist tasks
    db.collection("tasks").where("uid", "==", user.uid).onSnapshot(snap => {
        document.getElementById('count-tasks').innerText = snap.size;
        document.getElementById('task-badge').innerText = `${snap.size} Active`;

        const tasksArray = [];
        snap.forEach(doc => tasksArray.push({ id: doc.id, ...doc.data() }));
        tasksArray.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toMillis() : Date.now();
            const timeB = b.createdAt ? b.createdAt.toMillis() : Date.now();
            return timeB - timeA;
        });
        renderTasks(tasksArray);
    });

    // B. Sync active lectures (only published)
    db.collection("lectures").where("status", "==", "published").onSnapshot(snap => {
        document.getElementById('count-lectures').innerText = snap.size;
        document.getElementById('lecture-badge').innerText = `${snap.size} Modules`;

        const lecturesArray = [];
        snap.forEach(doc => lecturesArray.push({ id: doc.id, ...doc.data() }));
        lecturesArray.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toMillis() : Date.now();
            const timeB = b.createdAt ? b.createdAt.toMillis() : Date.now();
            return timeB - timeA;
        });
        renderStudentLectures(lecturesArray);
    });

    // C. Sync live assignments
    db.collection("assignments").onSnapshot(snap => {
        document.getElementById('count-assignments').innerText = snap.size;
        document.getElementById('assignment-badge').innerText = `${snap.size} Open`;

        const assignmentsArray = [];
        snap.forEach(doc => assignmentsArray.push({ id: doc.id, ...doc.data() }));
        assignmentsArray.sort((a, b) => {
            const timeA = a.createdAt ? a.createdAt.toMillis() : Date.now();
            const timeB = b.createdAt ? b.createdAt.toMillis() : Date.now();
            return timeB - timeA;
        });

        // Pull user submissions to cross check completion status
        db.collection("submissions").where("studentEmail", "==", user.email).onSnapshot(subSnap => {
            const subMap = {};
            subSnap.forEach(d => {
                subMap[d.data().assignmentId] = d.data();
            });
            renderStudentAssignments(assignmentsArray, subMap);
            renderStudentGrades(subSnap);
        });
    });

    // D. Sync Campus announcements & targeted notifications
    db.collection("notifications").onSnapshot(snap => {
        const notifications = [];
        const cutoffTime = Date.now() - (7 * 7 * 24 * 60 * 60 * 1000); // 7 weeks
        const deletedNotifs = JSON.parse(localStorage.getItem('deleted_notifs') || '[]');
        
        snap.forEach(doc => {
            const n = doc.data();
            const notifTime = n.timestamp ? n.timestamp.toMillis() : Date.now();
            if (notifTime >= cutoffTime && !deletedNotifs.includes(doc.id)) {
                if (n.type === "broadcast" || (n.type === "direct" && n.recipientEmail === user.email)) {
                    notifications.push({ id: doc.id, ...n });
                }
            }
        });
        
        notifications.sort((a, b) => {
            const timeA = a.timestamp ? a.timestamp.toMillis() : Date.now();
            const timeB = b.timestamp ? b.timestamp.toMillis() : Date.now();
            return timeB - timeA;
        });

        document.getElementById('student-notification-badge').innerText = `${notifications.length} Alerts`;
        renderStudentNotifications(notifications);
    });
}

// 7. ADMIN SYNCHRONIZATION SYSTEM
function syncAdminDashboard() {
    // A. Sync counts of published objects
    db.collection("lectures").onSnapshot(snap => {
        document.getElementById('admin-count-lectures').innerText = snap.size;
        const lectures = [];
        snap.forEach(doc => lectures.push({ id: doc.id, ...doc.data() }));
        lectures.sort((a,b) => (b.createdAt ? b.createdAt.toMillis() : 0) - (a.createdAt ? a.createdAt.toMillis() : 0));
        renderAdminLectures(lectures);
    });

    db.collection("assignments").onSnapshot(snap => {
        document.getElementById('admin-count-assignments').innerText = snap.size;
        const assignments = [];
        snap.forEach(doc => assignments.push({ id: doc.id, ...doc.data() }));
        assignments.sort((a,b) => (b.createdAt ? b.createdAt.toMillis() : 0) - (a.createdAt ? a.createdAt.toMillis() : 0));
        renderAdminAssignments(assignments);
    });

    // B. Sync Registered Students directory
    db.collection("users").where("role", "==", "student").onSnapshot(snap => {
        document.getElementById('admin-count-students').innerText = snap.size;
        const students = [];
        snap.forEach(doc => students.push({ id: doc.id, ...doc.data() }));
        renderAdminStudents(students);
        populateStudentDropdown(students);
    });

    // C. Sync Student submissions inbox
    db.collection("submissions").onSnapshot(snap => {
        document.getElementById('admin-count-submissions').innerText = snap.size;
        const submissions = [];
        snap.forEach(doc => submissions.push({ id: doc.id, ...doc.data() }));
        submissions.sort((a,b) => (b.submittedAt ? b.submittedAt.toMillis() : 0) - (a.submittedAt ? a.submittedAt.toMillis() : 0));
        renderAdminSubmissions(submissions);
    });

    // D. Sync Sent notifications archive
    db.collection("notifications").onSnapshot(snap => {
        const sent = [];
        const cutoffTime = Date.now() - (7 * 7 * 24 * 60 * 60 * 1000); // 7 weeks
        snap.forEach(doc => {
            const data = doc.data();
            const notifTime = data.timestamp ? data.timestamp.toMillis() : Date.now();
            if (notifTime >= cutoffTime) {
                sent.push({ id: doc.id, ...data });
            }
        });
        document.getElementById('sent-notifications-badge').innerText = sent.length;
        sent.sort((a,b) => (b.timestamp ? b.timestamp.toMillis() : 0) - (a.timestamp ? a.timestamp.toMillis() : 0));
        renderAdminNotifications(sent);
    });

    // E. Sync System security activity logs
    db.collection("login_history").limit(30).onSnapshot(snap => {
        document.getElementById('activity-logs-badge').innerText = snap.size;
        const logs = [];
        snap.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));
        logs.sort((a,b) => (b.timestamp ? b.timestamp.toMillis() : 0) - (a.timestamp ? a.timestamp.toMillis() : 0));
        renderAdminLogs(logs);
    });
    
    // F. Sync Admin Management Panel (if Super Admin)
    syncAdminManagement();
}

// 8. STUDENT FEED RENDERERS
function renderTasks(tasks) {
    const container = document.getElementById('task-list-container');
    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-circle-check"></i>
                <p>No pending tasks. You are all caught up!</p>
            </div>`;
        return;
    }

    container.innerHTML = tasks.map(task => `
        <div class="task-item" id="task-card-${task.id}">
            <div class="task-left">
                <label class="task-checkbox-container">
                    <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTaskState('${task.id}', this.checked)">
                    <span class="checkmark"></span>
                </label>
                <span class="task-text">${escapeHtml(task.text)}</span>
            </div>
            <button class="btn-delete-task" onclick="deleteTask('${task.id}')" title="Delete Task">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `).join('');
}

function renderStudentLectures(lectures) {
    const dashboardContainer = document.getElementById('lectures-feed-container');
    const archiveContainer = document.getElementById('student-lectures-archive-container');

    if (lectures.length === 0) {
        const empty = `
            <div class="empty-state">
                <i class="fa-solid fa-ghost"></i>
                <p>No active lectures scheduled today.</p>
            </div>`;
        dashboardContainer.innerHTML = empty;
        archiveContainer.innerHTML = empty;
        return;
    }

    // Dashboard view: limited to recent 3 lectures
    const recent = lectures.slice(0, 3);
    dashboardContainer.innerHTML = recent.map(lec => `
        <div class="list-item">
            <div class="item-meta-top">
                <span class="item-code">${escapeHtml(lec.courseCode)}</span>
                ${lec.isUpdated ? '<span class="badge" style="background:#f59e0b; color:white;"><i class="fa-solid fa-pen-to-square"></i> Updated</span>' : '<span class="badge sky-badge"><i class="fa-solid fa-signal"></i> Live</span>'}
            </div>
            <h4 class="item-title">${escapeHtml(lec.title)}</h4>
            <div class="item-sub">
                <i class="fa-solid fa-user-tie"></i> <span>${escapeHtml(lec.lecturer)}</span>
            </div>
            <div class="item-sub">
                <i class="fa-solid fa-location-dot"></i> <span>${escapeHtml(lec.room)}</span>
            </div>
        </div>
    `).join('');

    // Archive Grid view — show card with expand button for full content
    archiveContainer.innerHTML = lectures.filter(lec => lec.status !== 'draft').map(lec => {
        const dateStr = lec.createdAt ? new Date(lec.createdAt.toMillis()).toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : 'Just now';
        const plainPreview = lec.content ? lec.content.replace(/<[^>]+>/g, '').substring(0, 160) : '';

        return `
        <div class="list-item grid-card glass-panel lec-student-card" id="stud-lec-${lec.id}">
            <div class="item-meta-top">
                <span class="item-code">${escapeHtml(lec.courseCode || '—')}</span>
                ${lec.isUpdated ? '<span class="badge" style="background:#f59e0b; color:white;"><i class="fa-solid fa-pen-to-square"></i> Updated</span>' : '<span class="badge sky-badge"><i class="fa-solid fa-graduation-cap"></i> Lecture Module</span>'}
            </div>
            <h4 class="item-title">${escapeHtml(lec.title || 'Untitled')}</h4>
            <div class="item-details-body">
                <div class="item-sub"><i class="fa-solid fa-user-tie"></i> <strong>Instructor:</strong> <span>${escapeHtml(lec.lecturer || '—')}</span></div>
                <div class="item-sub"><i class="fa-solid fa-location-dot"></i> <strong>Location:</strong> <span>${escapeHtml(lec.room || '—')}</span></div>
                <div class="item-sub"><i class="fa-solid fa-calendar-days"></i> <strong>Published:</strong> <span>${dateStr}</span></div>
                ${plainPreview ? `<p class="lec-preview-text">${escapeHtml(plainPreview)}${plainPreview.length >= 160 ? '…' : ''}</p>` : ''}
            </div>
            <button class="btn-read-lec" onclick="toggleLecContent('${lec.id}')">
                <i class="fa-solid fa-book-open-reader"></i> Read Lecture
            </button>
            <div class="lec-full-content" id="lec-content-${lec.id}" style="display:none;">
                <div class="lec-content-header" style="padding: 12px 16px; background: rgba(0,0,0,0.02); border-bottom: 1px solid rgba(0,0,0,0.06); margin-bottom: 15px; border-radius: 6px 6px 0 0; color: #64748b; font-size: 13px; font-weight: 500;">
                    <i class="fa-solid fa-clock-rotate-left" style="margin-right: 6px;"></i> Published timestamp: ${dateStr}
                </div>
                <div class="lec-content-body lec-editor-body" style="background-color: ${lec.paperColor || '#ffffff'};">${lec.content || '<p>No content available.</p>'}</div>
            </div>
        </div>`;
    }).join('');
}

// --- STUDENT LECTURE READER LOGIC ---
let currentReaderZoom = 100;

function toggleLecContent(lecId) {
    const card = document.getElementById(`stud-lec-${lecId}`);
    const contentBody = document.getElementById(`lec-content-${lecId}`);
    if (!card || !contentBody) return;

    // Scrape metadata from the card
    const title = card.querySelector('.item-title') ? card.querySelector('.item-title').innerText : 'Lecture';
    const course = card.querySelector('.item-code') ? card.querySelector('.item-code').innerText : '';
    const lecturer = card.querySelector('.item-details-body .item-sub:nth-child(1) span') ? card.querySelector('.item-details-body .item-sub:nth-child(1) span').innerText : '';
    const timestamp = card.querySelector('.item-details-body .item-sub:nth-child(3) span') ? card.querySelector('.item-details-body .item-sub:nth-child(3) span').innerText : '';

    openReaderModal({ title, course, lecturer, timestamp, html: contentBody.querySelector('.lec-content-body').innerHTML, paperColor: contentBody.querySelector('.lec-content-body').style.backgroundColor });
}

function openReaderModal(lecData) {
    const modal = document.getElementById('student-reader-modal');
    if (!modal) return;
    
    document.getElementById('reader-title-display').innerText = lecData.title;
    document.getElementById('reader-meta-header').innerHTML = `
        <strong>${lecData.course}</strong> &bull; By ${lecData.lecturer} <br>
        <i class="fa-regular fa-clock"></i> ${lecData.timestamp}
    `;
    
    const bodyContainer = document.getElementById('reader-content-body');
    bodyContainer.innerHTML = lecData.html;
    
    const pageSurface = document.getElementById('reader-page-surface');
    const paperColor = lecData.paperColor || '#ffffff';
    pageSurface.style.backgroundColor = paperColor;
    pageSurface.style.color = getContrastYIQ(paperColor);

    currentReaderZoom = 100;
    
    modal.style.display = 'flex';
    gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    
    // Wait a tick for display: flex to render dimensions, then fit
    setTimeout(fitPageToScreen, 10);
}

function closeReaderModal() {
    const modal = document.getElementById('student-reader-modal');
    if (!modal) return;
    gsap.to(modal, { opacity: 0, duration: 0.2, onComplete: () => {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }});
}

function zoomReader(delta) {
    currentReaderZoom = Math.max(50, Math.min(200, currentReaderZoom + delta));
    const surface = document.getElementById('reader-page-surface');
    if (surface) surface.style.transform = `scale(${currentReaderZoom / 100})`;
    updateReaderZoomDisplay();
}

function updateReaderZoomDisplay() {
    const el = document.getElementById('reader-zoom-display');
    if (el) el.innerText = currentReaderZoom + '%';
}

function toggleReaderTheme() {
    const modal = document.getElementById('student-reader-modal');
    if (modal) modal.classList.toggle('reader-dark-mode');
}

function downloadReaderPDF() {
    const element = document.getElementById('reader-page-surface');
    const title = document.getElementById('reader-title-display').innerText || 'lecture';
    
    if (typeof html2pdf === 'undefined') {
        alert("PDF generator is loading. Please try again in a few seconds.");
        return;
    }
    
    const opt = {
        margin:       10,
        filename:     `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };
    
    // Temporarily reset transform for PDF rendering and apply black & white theme
    const oldTransform = element.style.transform;
    element.style.transform = 'none';
    element.classList.add('pdf-bw-print');
    
    html2pdf().set(opt).from(element).save().then(() => {
        element.style.transform = oldTransform;
        element.classList.remove('pdf-bw-print');
    });
}

function downloadReaderTXT() {
    const element = document.getElementById('reader-page-surface');
    const title = document.getElementById('reader-title-display').innerText || 'lecture';
    const text = element.innerText;
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

function renderStudentAssignments(assignments, subMap) {
    const dashboardContainer = document.getElementById('assignments-feed-container');
    const archiveContainer = document.getElementById('student-assignments-archive-container');

    if (assignments.length === 0) {
        const empty = `
            <div class="empty-state">
                <i class="fa-solid fa-hourglass-empty"></i>
                <p>Great job! No pending assignments.</p>
            </div>`;
        dashboardContainer.innerHTML = empty;
        archiveContainer.innerHTML = empty;
        return;
    }

    // Filter pending for homepage dashboard feed
    const pending = assignments.filter(a => !subMap[a.id]);

    // Helper to format deadline
    const formatDeadline = (dueDateStr) => {
        const d = new Date(dueDateStr);
        if (isNaN(d.getTime())) return escapeHtml(dueDateStr);
        const diff = d - new Date();
        if (diff < 0) return `<span style="color: var(--danger-color); font-weight: bold;">OVERDUE (${d.toLocaleString(undefined, {month: 'short', day: 'numeric'})})</span>`;
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        let colorStr = days < 3 ? (days < 1 ? "color: var(--danger-color);" : "color: #f59e0b;") : "color: #10b981;";
        let textStr = days > 0 ? `${days}d ${hours}h remaining` : `${hours}h ${Math.floor((diff / 1000 / 60) % 60)}m remaining`;
        
        return `<span style="${colorStr}; font-weight: bold;">${textStr}</span> <span style="font-size:0.8rem; opacity:0.7;">(${d.toLocaleString(undefined, {month: 'short', day: 'numeric', hour:'numeric', minute:'2-digit'})})</span>`;
    };

    if (pending.length === 0) {
        dashboardContainer.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-circle-check"></i>
                <p>All active assignments have been submitted!</p>
            </div>`;
    } else {
        dashboardContainer.innerHTML = pending.slice(0, 3).map(ass => `
            <div class="list-item">
                <div class="item-meta-top">
                    <span class="item-code">${escapeHtml(ass.course)}</span>
                    <span class="badge dark-badge">${ass.points} Pts</span>
                </div>
                <h4 class="item-title">${escapeHtml(ass.title)}</h4>
                ${ass.description ? `<p class="item-desc" style="font-size: 0.85rem; opacity: 0.8; margin-top: 5px;">${escapeHtml(ass.description).substring(0, 80)}...</p>` : ''}
                <div class="item-sub" style="margin-top: 8px;">
                    <i class="fa-solid fa-clock"></i> ${formatDeadline(ass.dueDate)}
                </div>
                <button class="btn-item-action sky" onclick="openSubmissionModal('${ass.id}', '${escapeHtml(ass.title)}', '${escapeHtml(ass.course)}', ${ass.points})" style="margin-top: 10px;">
                    <i class="fa-solid fa-paper-plane"></i> Submit Brief
                </button>
            </div>
        `).join('');
    }

    // Archive view displays everything with status states
    archiveContainer.innerHTML = assignments.map(ass => {
        const submission = subMap[ass.id];
        let actionBtn = "";
        let statusBadge = "";

        if (submission) {
            if (submission.graded) {
                statusBadge = `<span class="badge green-badge"><i class="fa-solid fa-check-double"></i> Graded: ${submission.grade}/${ass.points} Pts</span>`;
                actionBtn = `<div class="sub-graded-msg">Reviewed by Lecturer</div>`;
            } else {
                statusBadge = `<span class="badge yellow-badge"><i class="fa-solid fa-spinner"></i> Submitted (Pending Review)</span>`;
                actionBtn = `<button class="btn-item-action disabled-btn" disabled>Awaiting Grade</button>`;
            }
        } else {
            statusBadge = `<span class="badge dark-badge"><i class="fa-solid fa-hourglass"></i> Open Assignment</span>`;
            actionBtn = `<button class="btn-item-action sky" onclick="openSubmissionModal('${ass.id}', '${escapeHtml(ass.title)}', '${escapeHtml(ass.course)}', ${ass.points})"><i class="fa-solid fa-upload"></i> Upload Submission</button>`;
        }

        return `
            <div class="list-item grid-card glass-panel">
                <div class="item-meta-top">
                    <span class="item-code">${escapeHtml(ass.course)}</span>
                    ${statusBadge}
                </div>
                <h4 class="item-title">${escapeHtml(ass.title)}</h4>
                ${ass.description ? `<div class="item-desc" style="font-size: 0.85rem; opacity: 0.8; margin: 10px 0; padding: 10px; background: rgba(0,0,0,0.1); border-radius: 6px;">${escapeHtml(ass.description)}</div>` : ''}
                <div class="item-details-body" style="margin-top: 15px;">
                    <div class="item-sub">
                        <i class="fa-solid fa-clock"></i> <strong>Deadline:</strong> ${formatDeadline(ass.dueDate)}
                    </div>
                    <div class="item-sub">
                        <i class="fa-solid fa-award"></i> <strong>Max Points:</strong> <span>${ass.points} Pts</span>
                    </div>
                    ${submission ? `
                        <div class="item-sub border-top-sub">
                            <i class="fa-solid fa-link"></i> <strong>My Link:</strong> <a href="${escapeHtml(submission.submissionLink)}" target="_blank">${escapeHtml(submission.submissionLink.substring(0, 25))}...</a>
                        </div>
                    ` : ''}
                </div>
                <div class="grid-card-footer">
                    ${actionBtn}
                </div>
            </div>
        `;
    }).join('');
}

function renderStudentNotifications(notifications) {
    if (typeof setFaviconBadge === 'function') {
        setFaviconBadge(notifications.length > 0);
    }
    
    const container = document.getElementById('student-notifications-container');
    if (notifications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-bell-slash"></i>
                <p>No announcements yet.</p>
            </div>`;
        return;
    }

    container.innerHTML = notifications.map(notif => {
        const isDirect = notif.type === "direct";
        const dateStr = notif.timestamp ? new Date(notif.timestamp.toMillis()).toLocaleString() : 'Just now';
        
        return `
            <div id="student-notif-${notif.id}" class="list-item notification-item ${isDirect ? 'direct-alert' : 'broadcast-alert'}" style="transition: opacity 0.3s; position: relative;">
                <div class="notif-meta">
                    <span class="badge ${isDirect ? 'dark-badge' : 'sky-badge'}">
                        <i class="fa-solid ${isDirect ? 'fa-user-lock' : 'fa-bullhorn'}"></i> ${isDirect ? 'Private Msg' : 'Public Announcement'}
                    </span>
                    <span class="notif-date">${dateStr}</span>
                </div>
                <p class="notif-text">${escapeHtml(notif.message)}</p>
                <div class="notif-sender" style="display: flex; justify-content: space-between; align-items: center;">
                    <span>From: Department Administrator</span>
                    <button class="btn-delete-item" onclick="deleteStudentNotification('${notif.id}')" title="Dismiss Message" style="font-size: 1.1rem;">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderStudentGrades(subSnap) {
    const tableBody = document.getElementById('student-grades-table-body');
    const submittedEl = document.getElementById('student-grade-submitted-count');
    const gradedEl = document.getElementById('student-grade-graded-count');

    let submittedCount = subSnap.size;
    let gradedCount = 0;

    submittedEl.innerText = submittedCount;

    if (submittedCount === 0) {
        gradedEl.innerText = 0;
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="table-empty">No submissions uploaded yet. Go to Assignments to upload.</td>
            </tr>`;
        return;
    }

    const rows = [];
    subSnap.forEach(doc => {
        const sub = doc.data();
        if (sub.graded) gradedCount++;
        
        const statusHTML = sub.graded 
            ? `<span class="table-status green"><i class="fa-solid fa-circle-check"></i> Graded</span>`
            : `<span class="table-status yellow"><i class="fa-solid fa-hourglass-half"></i> Pending</span>`;
        
        rows.push(`
            <tr>
                <td class="font-bold">${escapeHtml(sub.course)}</td>
                <td>${escapeHtml(sub.assignmentTitle)}</td>
                <td><a href="${escapeHtml(sub.submissionLink)}" target="_blank" class="table-link"><i class="fa-solid fa-link"></i> View Submission</a></td>
                <td class="font-bold">${sub.graded ? `${sub.grade} Pts` : 'Awaiting Review'}</td>
                <td class="feedback-cell">${sub.graded ? escapeHtml(sub.feedback || 'Excellent work.') : 'Your lecturer is currently assessing this submission.'}</td>
                <td>${statusHTML}</td>
            </tr>
        `);
    });

    gradedEl.innerText = gradedCount;
    tableBody.innerHTML = rows.join('');
}

// 9. ADMIN FEED RENDERERS
function renderAdminStudents(students) {
    const body = document.getElementById('admin-students-table-body');
    if (students.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="5" class="table-empty">No registered students found.</td>
            </tr>`;
        return;
    }

    body.innerHTML = students.map(student => {
        const enrollDate = student.createdAt ? new Date(student.createdAt.toMillis()).toLocaleDateString() : 'Pending';
        return `
            <tr>
                <td><img class="table-avatar" src="${student.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${student.fullName}`}" alt="DP"></td>
                <td class="font-bold">${escapeHtml(student.fullName)}</td>
                <td>${escapeHtml(student.email)}</td>
                <td class="item-code">${escapeHtml(student.studentId)}</td>
                <td>${enrollDate}</td>
            </tr>
        `;
    }).join('');
}

function filterStudentTable() {
    const query = document.getElementById('student-search-input').value.toLowerCase().trim();
    const rows = document.querySelectorAll('#admin-students-table-body tr');
    
    rows.forEach(row => {
        if (row.classList.contains('table-empty')) return;
        const text = row.innerText.toLowerCase();
        if (text.includes(query)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function populateStudentDropdown(students) {
    const select = document.getElementById('direct-student-select');
    if (!select) return;
    
    // Clear dynamic options
    select.innerHTML = `<option value="">-- Choose Enrolled Student --</option>`;
    students.forEach(student => {
        const option = document.createElement('option');
        option.value = student.email;
        option.innerText = `${student.fullName} (${student.email})`;
        select.appendChild(option);
    });
}

function renderAdminSubmissions(submissions) {
    const body = document.getElementById('admin-submissions-table-body');
    if (submissions.length === 0) {
        body.innerHTML = `
            <tr>
                <td colspan="7" class="table-empty">No student submissions waiting in the inbox.</td>
            </tr>`;
        return;
    }

    body.innerHTML = submissions.map(sub => {
        const dateStr = sub.submittedAt ? new Date(sub.submittedAt.toMillis()).toLocaleString() : 'Just now';
        
        let actionHTML = "";
        let gradeHTML = "";

        if (sub.graded) {
            gradeHTML = `<span class="font-bold graded-points">${sub.grade} Pts</span>`;
            actionHTML = `<span class="table-status green"><i class="fa-solid fa-check-double"></i> Finalized</span>`;
        } else {
            gradeHTML = `<input type="number" class="table-grade-input" id="grade-val-${sub.id}" placeholder="Points" max="200" required>`;
            actionHTML = `
                <div class="grade-action-cell">
                    <input type="text" class="table-feedback-input" id="feedback-val-${sub.id}" placeholder="Feedback Notes">
                    <button class="btn-grade-submit" onclick="submitGrade('${sub.id}', ${sub.points})">
                        <i class="fa-solid fa-check"></i> Submit Grade
                    </button>
                </div>
            `;
        }

        return `
            <tr>
                <td>
                    <div class="sub-student-pill">
                        <strong>${escapeHtml(sub.studentName)}</strong>
                        <span class="sub-student-mail">${escapeHtml(sub.studentEmail)}</span>
                    </div>
                </td>
                <td>
                    <div class="sub-course-pill">
                        <span class="item-code">${escapeHtml(sub.course)}</span>
                        <strong>${escapeHtml(sub.assignmentTitle)}</strong>
                    </div>
                </td>
                <td><a href="${escapeHtml(sub.submissionLink)}" target="_blank" class="table-link"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open Student File</a></td>
                <td class="feedback-cell">${escapeHtml(sub.comments || 'No comments.')}</td>
                <td>${dateStr}</td>
                <td>${gradeHTML}</td>
                <td>${actionHTML}</td>
            </tr>
        `;
    }).join('');
}

function renderAdminLectures(lectures) {
    const container = document.getElementById('admin-lectures-feed-container');
    const badge = document.getElementById('lec-pub-count-badge');
    if (badge) badge.innerText = `${lectures.length} Lecture${lectures.length !== 1 ? 's' : ''}`;

    if (lectures.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-ghost"></i>
                <p>No lectures published yet. Use the editor above to create one.</p>
            </div>`;
        return;
    }

    container.innerHTML = lectures.map(lec => {
        const dateStr = lec.createdAt ? new Date(lec.createdAt.toMillis()).toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        }) : 'Just now';
        const isPublished = lec.status !== 'draft';
        const plainPreview = lec.content ? lec.content.replace(/<[^>]+>/g, '').substring(0, 120) : '—';

        return `
        <div class="lec-pub-card" id="lec-card-${lec.id}">
            <div class="lec-pub-card-left">
                <div class="lec-pub-card-top">
                    <span class="item-code">${escapeHtml(lec.courseCode || '—')}</span>
                    <span class="lec-status-chip ${isPublished ? 'published' : 'draft'}">
                        <i class="fa-solid fa-${isPublished ? 'circle-check' : 'clock'}"></i>
                        ${isPublished ? 'Published' : 'Draft'}
                    </span>
                </div>
                <div class="lec-pub-title">${escapeHtml(lec.title || 'Untitled Lecture')}</div>
                <div class="lec-pub-meta">
                    <span><i class="fa-solid fa-user-tie"></i> ${escapeHtml(lec.lecturer || '—')}</span>
                    <span><i class="fa-solid fa-location-dot"></i> ${escapeHtml(lec.room || '—')}</span>
                    <span><i class="fa-solid fa-calendar-days"></i> ${dateStr}</span>
                </div>
                <div class="lec-pub-preview">${escapeHtml(plainPreview)}${plainPreview.length >= 120 ? '…' : ''}</div>
            </div>
            <div class="lec-pub-card-actions">
                <button class="btn-lec-edit" onclick="editLecture('${lec.id}')">
                    <i class="fa-solid fa-pen-to-square"></i> Edit
                </button>
                <button class="btn-lec-delete" onclick="deleteLecture('${lec.id}')" title="Delete Lecture">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>`;
    }).join('');
}

/* ================================================================
   LECTURE RICH TEXT EDITOR — FULL ENGINE
   ================================================================ */

let currentFontSizePx = 16;
let currentZoom = 100;
let isDrawMode = false;
let currentDrawTool = 'pen'; // 'pen', 'eraser', 'line', 'rect', 'circle'
let isDrawing = false;
let lastX = 0, lastY = 0;
let drawStartX = 0, drawStartY = 0;
let drawSnapshot = null;
let canvasCtx = null;
let editorSaveTimer = null;
let savedRange = null;
let canvasListenersBound = false;
let hasDrawn = false;
let editorInitialized = false;

// ── Selection Preservation ────────────────────────────────────────

function saveSelection() {
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const editor = document.getElementById('lec-editor-body');
        if (editor && editor.contains(range.commonAncestorContainer)) {
            savedRange = range;
        }
    }
}

function restoreSelection() {
    if (!savedRange) return;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
}

function setupEditorSelectionTracking() {
    const editor = document.getElementById('lec-editor-body');
    if (!editor) return;

    editor.addEventListener('keyup', saveSelection);
    editor.addEventListener('mouseup', saveSelection);
    editor.addEventListener('blur', saveSelection);

    document.addEventListener('selectionchange', () => {
        if (document.activeElement === editor) {
            saveSelection();
        }
    });

    // Make links in editor clickable to open in new tab
    editor.addEventListener('click', (e) => {
        const anchor = e.target.closest('a');
        if (anchor) {
            window.open(anchor.href, '_blank');
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        // Drawing wrapper selection logic
        const wrap = e.target.closest('.drawing-wrapper');
        
        // Hide all delete buttons and remove borders
        editor.querySelectorAll('.delete-drawing-btn').forEach(btn => btn.style.display = 'none');
        editor.querySelectorAll('.drag-handle-indicator').forEach(btn => btn.style.display = 'none');
        editor.querySelectorAll('.drawing-wrapper').forEach(w => w.style.borderColor = 'transparent');
        
        if (wrap) {
            wrap.style.borderColor = 'var(--accent, #00d4ff)';
            const btn = wrap.querySelector('.delete-drawing-btn');
            if (btn) btn.style.display = 'flex';
            const handle = wrap.querySelector('.drag-handle-indicator');
            if (handle) handle.style.display = 'flex';
            e.preventDefault();
            e.stopPropagation();
        }
    });

    // Custom drag for absolute shapes
    let activeAbsDrag = null;
    let dragStartX = 0, dragStartY = 0, initLeft = 0, initTop = 0;

    editor.addEventListener('mousedown', (e) => {
        const handle = e.target.closest('.drag-handle-indicator') || e.target.closest('.drawing-wrapper');
        if (handle) {
            const container = handle.closest('.drawing-container');
            if (container && container.style.position === 'absolute') {
                activeAbsDrag = container;
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                initLeft = parseFloat(container.style.left) || 0;
                initTop = parseFloat(container.style.top) || 0;
                container.style.opacity = '0.7';
                e.preventDefault();
            }
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (activeAbsDrag) {
            const dx = e.clientX - dragStartX;
            const dy = e.clientY - dragStartY;
            const zoom = typeof currentZoom !== 'undefined' ? currentZoom / 100 : 1;
            const editorWidth = editor.offsetWidth;
            
            const dxPct = ((dx / zoom) / editorWidth) * 100;
            const editorHeight = editor.offsetHeight;
            const dyPct = ((dy / zoom) / editorHeight) * 100;
            
            activeAbsDrag.style.left = (initLeft + dxPct) + '%';
            if (activeAbsDrag.style.top.includes('%')) {
                activeAbsDrag.style.top = (initTop + dyPct) + '%';
            } else {
                const dyPx = dy / zoom;
                activeAbsDrag.style.top = (initTop + dyPx) + 'px';
            }
        }
    });

    document.addEventListener('mouseup', () => {
        if (activeAbsDrag) {
            activeAbsDrag.style.opacity = '1';
            activeAbsDrag = null;
        }
    });
}

function initToolbarEvents() {
    const toolbar = document.getElementById('lec-toolbar');
    if (!toolbar) return;

    // Prevent button click from clearing selection
    toolbar.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });
    });

    // Handle select dropdown focus
    toolbar.querySelectorAll('select').forEach(sel => {
        sel.addEventListener('mousedown', (e) => {
            saveSelection();
        });
        sel.addEventListener('change', (e) => {
            restoreSelection();
        });
    });
}

function initEditorSystem() {
    if (editorInitialized) return;
    setupEditorSelectionTracking();
    initToolbarEvents();
    setupBlockDeleteButton();
    editorInitialized = true;
}

function setupBlockDeleteButton() {
    const editor = document.getElementById('lec-editor-body');
    const wrap = document.getElementById('lec-doc-surface-wrap');
    if (!editor || !wrap) return;
    
    wrap.style.position = 'relative'; // Ensure absolute positioning works

    let debounceTimer = null;
    const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(syncDeleteButtons, 50);
    });
    
    observer.observe(editor, { childList: true, subtree: true, characterData: true, attributes: true });
    setTimeout(syncDeleteButtons, 100);
}

function syncDeleteButtons() {
    const editor = document.getElementById('lec-editor-body');
    const wrap = document.getElementById('lec-doc-surface-wrap');
    if (!editor || !wrap) return;
    
    // Clear old persistent buttons
    wrap.querySelectorAll('.block-delete-btn-persistent').forEach(b => b.remove());
    
    if (typeof isDrawMode !== 'undefined' && isDrawMode) return;
    
    const blocks = Array.from(editor.querySelectorAll('blockquote, pre'));
    blocks.forEach(block => {
        const btn = document.createElement('button');
        btn.className = 'block-delete-btn-persistent';
        btn.contentEditable = 'false';
        btn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        btn.style.position = 'absolute';
        btn.style.zIndex = '50';
        btn.style.background = '#e11d48';
        btn.style.color = '#fff';
        btn.style.border = 'none';
        btn.style.borderRadius = '4px';
        btn.style.width = '24px';
        btn.style.height = '24px';
        btn.style.cursor = 'pointer';
        btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        btn.title = "Delete block";
        
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            block.remove();
            syncDeleteButtons();
            if (typeof updateWordCount === 'function') updateWordCount();
        });
        
        wrap.appendChild(btn);
        
        const rect = block.getBoundingClientRect();
        const wrapRect = wrap.getBoundingClientRect();
        
        // Position top right inside the block
        btn.style.top = (rect.top - wrapRect.top + wrap.scrollTop + 5) + 'px';
        btn.style.left = (rect.right - wrapRect.left + wrap.scrollLeft - 30) + 'px'; 
    });
}

// ── Open / Close ──────────────────────────────────────────────────

function openLectureEditor(lectureId = null) {
    const wrap = document.getElementById('lec-editor-wrap');
    const body = document.getElementById('lec-editor-body');
    const editIdField = document.getElementById('lec-editing-id');

    // Reset fields
    document.getElementById('lec-title-input').value = '';
    document.getElementById('lec-code-input').value = '';
    document.getElementById('lec-lecturer-input').value = '';
    document.getElementById('lec-room-input').value = '';
    body.innerHTML = '';
    editIdField.value = '';
    currentFontSizePx = 16;
    currentZoom = 100;
    updateFontSizeDisplay();
    updateZoomDisplay();
    updateStatusText('Unsaved');

    if (lectureId) {
        // Edit mode — load existing lecture
        editIdField.value = lectureId;
    }

    wrap.style.display = 'block';
    gsap.fromTo(wrap, { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });

    // Initialize systems
    initEditorSystem();
    initDrawCanvas();

    // Set up word count auto-updater
    body.addEventListener('input', onEditorInput);

    // Scroll editor into view
    setTimeout(() => wrap.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    body.focus();
}

function closeLectureEditor() {
    const wrap = document.getElementById('lec-editor-wrap');
    gsap.to(wrap, {
        opacity: 0, y: -16, duration: 0.25,
        onComplete: () => { wrap.style.display = 'none'; }
    });
    isDrawMode = false;
    currentDrawTool = 'pen';
    ['tb-draw', 'tb-draw-line', 'tb-draw-rect', 'tb-draw-circle', 'tb-eraser'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.remove('on');
    });
    const canvas = document.getElementById('draw-canvas');
    if (canvas) canvas.classList.remove('drawing-active');

    document.getElementById('lec-editor-body').innerHTML = '';
    document.getElementById('lec-editing-id').value = '';
}

// ── Editor Command Dispatcher ─────────────────────────────────────

function edCmd(command, value = null) {
    restoreSelection();
    const editor = document.getElementById('lec-editor-body');
    editor.focus();
    
    try {
        document.execCommand('styleWithCSS', false, true);
    } catch (e) {}

    if (command === 'hiliteColor') {
        try {
            document.execCommand('hiliteColor', false, value);
        } catch (e) {
            document.execCommand('backColor', false, value);
        }
    } else if (command === 'formatBlock') {
        const val = value.startsWith('<') ? value : `<${value}>`;
        document.execCommand('formatBlock', false, val);
    } else if (command === 'fontName') {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
            document.execCommand('fontName', false, value);
            editor.querySelectorAll('font').forEach(el => {
                if (el.hasAttribute('face')) {
                    el.style.fontFamily = el.getAttribute('face');
                    el.removeAttribute('face');
                }
            });
        } else {
            const span = document.createElement('span');
            span.style.fontFamily = value;
            span.innerHTML = '\u200B';
            document.execCommand('insertHTML', false, span.outerHTML);
        }
    } else {
        document.execCommand(command, false, value);
    }
    
    saveSelection();
    updateToolbarState();
}

// ── Font Size ─────────────────────────────────────────────────────

function changeFontSize(delta) {
    const sizes = [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 32, 36, 42, 48, 56, 64, 72];
    restoreSelection();
    const editor = document.getElementById('lec-editor-body');
    if (!editor) return;
    editor.focus();

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    
    let baseSize = currentFontSizePx;
    let node = sel.anchorNode;
    if (node && node.nodeType === 3) node = node.parentElement;
    
    if (node && editor.contains(node)) {
        let compSize = parseInt(window.getComputedStyle(node).fontSize);
        if (compSize && !isNaN(compSize)) baseSize = compSize;
    }
    
    let baseIdx = sizes.findIndex(s => s >= baseSize);
    if (baseIdx === -1) baseIdx = sizes.length - 1;
    let newIdx = Math.max(0, Math.min(sizes.length - 1, baseIdx + delta));
    let targetSize = sizes[newIdx];
    currentFontSizePx = targetSize;

    if (!sel.isCollapsed) {
        let originalFont = '';
        if (node && editor.contains(node)) {
            originalFont = window.getComputedStyle(node).fontFamily;
        }
        
        const tempFont = 'LecTrackTemp' + Date.now();
        document.execCommand('styleWithCSS', false, false);
        document.execCommand('fontName', false, tempFont);
        
        const nodes = editor.querySelectorAll(`font[face="${tempFont}"], span[style*="${tempFont}"]`);
        nodes.forEach(el => {
            if (el.tagName.toLowerCase() === 'font') {
                el.removeAttribute('face');
            }
            if (originalFont) {
                el.style.fontFamily = originalFont;
            } else {
                el.style.fontFamily = '';
            }
            el.style.fontSize = targetSize + 'px';
            if (el.getAttribute('style') === '') {
                el.removeAttribute('style');
            }
        });
    } else {
        const span = document.createElement('span');
        span.style.fontSize = targetSize + 'px';
        span.innerHTML = '\u200B'; // zero-width space placeholder
        document.execCommand('insertHTML', false, span.outerHTML);
    }

    saveSelection();
    updateFontSizeDisplay();
}

function changePaperColor(color) {
    const editorBody = document.getElementById('lec-editor-body');
    if (editorBody) {
        editorBody.style.backgroundColor = color;
        editorBody.style.color = getContrastYIQ(color);
    }
}

function getContrastYIQ(hexcolor) {
    if (!hexcolor || !hexcolor.startsWith('#')) return '#000000';
    hexcolor = hexcolor.replace("#", "");
    if (hexcolor.length === 3) hexcolor = hexcolor.split('').map(c => c+c).join('');
    if (hexcolor.length !== 6 && hexcolor.length !== 8) return '#000000';
    var r = parseInt(hexcolor.substr(0,2),16);
    var g = parseInt(hexcolor.substr(2,2),16);
    var b = parseInt(hexcolor.substr(4,2),16);
    var yiq = ((r*299)+(g*587)+(b*114))/1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
}

function smartFormat() {
    const editor = document.getElementById('lec-editor-body');
    if (!editor) return;
    
    const paragraphs = Array.from(editor.querySelectorAll('p, div:not(.drawing-container)'));
    paragraphs.forEach(p => {
        if(p.innerHTML.trim() === '' || p.innerHTML === '<br>') p.remove();
        else {
            p.style.lineHeight = '1.8';
            p.style.marginBottom = '1em';
            p.style.marginTop = '0';
        }
    });
    
    const headings = editor.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(h => {
        h.style.marginTop = '1.5em';
        h.style.marginBottom = '0.5em';
        h.style.lineHeight = '1.3';
        h.style.fontWeight = 'bold';
    });

    const lists = editor.querySelectorAll('ul, ol');
    lists.forEach(l => {
        l.style.paddingLeft = '30px';
        l.style.marginBottom = '1em';
    });
    
    const preBlocks = editor.querySelectorAll('pre');
    preBlocks.forEach(pre => {
        pre.style.padding = '15px';
        pre.style.borderRadius = '8px';
        pre.style.overflowX = 'auto';
        pre.style.marginBottom = '1em';
    });
    
    editor.querySelectorAll('h1+br, h2+br, h3+br, p+br, div+br, pre+br, ul+br, ol+br').forEach(br => br.remove());

    alert("Smart Assist formatting applied! Layout has been optimally spaced and organized.");
}

function smartToggleContrast() {
    const editor = document.getElementById('lec-editor-body');
    if (!editor) return;
    
    let brightTextCount = 0;
    let darkTextCount = 0;
    
    const spans = editor.querySelectorAll('[style*="color"]');
    spans.forEach(el => {
        if (el.style.color) {
            let rgb = el.style.color.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
                const yiq = ((parseInt(rgb[0])*299)+(parseInt(rgb[1])*587)+(parseInt(rgb[2])*114))/1000;
                if (yiq >= 128) brightTextCount++;
                else darkTextCount++;
            }
        }
    });
    
    let rootRgb = (editor.style.color || '#000000').match(/\d+/g);
    if (rootRgb && rootRgb.length >= 3) {
        const rootYiq = ((parseInt(rootRgb[0])*299)+(parseInt(rootRgb[1])*587)+(parseInt(rootRgb[2])*114))/1000;
        if (rootYiq >= 128) brightTextCount += 2;
        else darkTextCount += 2;
    }
    
    const isTextBright = brightTextCount > darkTextCount;
    
    const newBg = isTextBright ? '#121212' : '#ffffff';
    editor.style.backgroundColor = newBg;
    
    const paperColorInput = document.getElementById('tb-paper-color');
    if (paperColorInput) {
        paperColorInput.value = newBg;
    }
    
    alert(`Smart Contrast Applied: Dominant text is ${isTextBright ? 'Bright' : 'Dark'}, setting background to ${isTextBright ? 'Dark' : 'Light'}.`);
}

function updateFontSizeDisplay() {
    const el = document.getElementById('tb-size-display');
    if (el) el.innerText = currentFontSizePx;
}

// ── Zoom ──────────────────────────────────────────────────────────

function zoomDoc(delta) {
    currentZoom = Math.max(50, Math.min(200, currentZoom + delta));
    const surface = document.getElementById('lec-page-surface');
    if (surface) surface.style.transform = `scale(${currentZoom / 100})`;
    updateZoomDisplay();
}

function updateZoomDisplay() {
    const el = document.getElementById('tb-zoom-display');
    if (el) el.innerText = currentZoom + '%';
}

// ── Link Insertion ────────────────────────────────────────────────

function insertLink() {
    restoreSelection();
    const sel = window.getSelection();
    const selectedText = sel && sel.rangeCount > 0 ? sel.toString() : '';
    const url = prompt('Enter link URL:', 'https://');
    if (!url || url === 'https://') return;

    const editor = document.getElementById('lec-editor-body');
    editor.focus();

    if (selectedText) {
        document.execCommand('createLink', false, url);
        // Make newly created link open in new tab
        editor.querySelectorAll('a').forEach(a => {
            if (a.href === url || a.getAttribute('href') === url) {
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.title = "Click to open link";
            }
        });
    } else {
        const linkText = prompt('Link text:', url);
        const a = `<a href="${url}" target="_blank" rel="noopener noreferrer" title="Click to open link">${linkText || url}</a>`;
        document.execCommand('insertHTML', false, a);
    }
    saveSelection();
}

// ── Table Insertion ───────────────────────────────────────────────

function insertTable() {
    restoreSelection();
    const rows = parseInt(prompt('Number of rows:', '3') || '3');
    const cols = parseInt(prompt('Number of columns:', '3') || '3');
    if (!rows || !cols || rows < 1 || cols < 1) return;

    let html = '<table><thead><tr>';
    for (let c = 0; c < cols; c++) html += `<th>Header ${c + 1}</th>`;
    html += '</tr></thead><tbody>';
    for (let r = 0; r < rows - 1; r++) {
        html += '<tr>';
        for (let c = 0; c < cols; c++) html += '<td>&nbsp;</td>';
        html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';

    const editor = document.getElementById('lec-editor-body');
    editor.focus();
    document.execCommand('insertHTML', false, html);
    saveSelection();
}

// ── Drawing Tool ──────────────────────────────────────────────────

function initDrawCanvas() {
    const canvas = document.getElementById('draw-canvas');
    if (!canvas || canvasListenersBound) return;

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);
    canvas.addEventListener('touchstart', startDrawTouch, { passive: false });
    canvas.addEventListener('touchmove', drawTouch, { passive: false });
    canvas.addEventListener('touchend', stopDraw);

    canvasListenersBound = true;
}

function setDrawTool(tool) {
    const canvas = document.getElementById('draw-canvas');
    const body = document.getElementById('lec-editor-body');
    const surface = document.getElementById('lec-page-surface');
    const btnIds = {
        'pen': 'tb-draw', 'line': 'tb-draw-line',
        'rect': 'tb-draw-rect', 'circle': 'tb-draw-circle', 'eraser': 'tb-eraser',
        'arrow': 'tb-draw-arrow', 'triangle': 'tb-draw-triangle'
    };

    // Case 1: Toggle OFF if clicking the currently active drawing tool
    if (isDrawMode && currentDrawTool === tool) {
        if (hasDrawn) saveCanvasToEditor();
        isDrawMode = false;
        if (canvas) canvas.classList.remove('drawing-active');
        if (body) body.contentEditable = 'true';
        Object.values(btnIds).forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.classList.remove('on');
        });
        return;
    }

    // Case 2: If switching to another tool while drawing is active, stamp the current drawing first
    if (isDrawMode && currentDrawTool !== tool && hasDrawn) {
        saveCanvasToEditor();
    }

    // Enable drawing mode if not active
    if (!isDrawMode) {
        saveSelection();
        isDrawMode = true;
        if (canvas && surface) {
            canvas.width = surface.offsetWidth;
            canvas.height = surface.offsetHeight;
            canvasCtx = canvas.getContext('2d');
            canvas.classList.add('drawing-active');
            hasDrawn = false;
            if (body) body.contentEditable = 'false';
        }
    }

    // Set tool
    currentDrawTool = tool;

    // Toggle styling on the buttons
    Object.keys(btnIds).forEach(t => {
        const btn = document.getElementById(btnIds[t]);
        if (btn) btn.classList.toggle('on', t === tool);
    });
}

function startDraw(e) {
    if (!isDrawMode) return;
    isDrawing = true;
    const pos = getCanvasPos(e);
    lastX = pos.x; lastY = pos.y;
    drawStartX = pos.x; drawStartY = pos.y;
    
    const canvas = document.getElementById('draw-canvas');
    if (canvasCtx && canvas) {
        drawSnapshot = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);
    }
}

function draw(e) {
    if (!isDrawMode || !isDrawing || !canvasCtx) return;
    const size = parseInt(document.getElementById('tb-pen-size').value) || 4;
    const pos = getCanvasPos(e);

    const canvas = document.getElementById('draw-canvas');

    if (currentDrawTool === 'pen' || currentDrawTool === 'eraser') {
        canvasCtx.beginPath();
        canvasCtx.moveTo(lastX, lastY);
        canvasCtx.lineTo(pos.x, pos.y);

        if (currentDrawTool === 'eraser') {
            canvasCtx.globalCompositeOperation = 'destination-out';
            canvasCtx.strokeStyle = 'rgba(0,0,0,1)';
            canvasCtx.lineWidth = size * 3; // Eraser is larger
        } else {
            canvasCtx.globalCompositeOperation = 'source-over';
            canvasCtx.strokeStyle = document.getElementById('tb-pen-color').value;
            canvasCtx.lineWidth = size;
        }

        canvasCtx.lineCap = 'round';
        canvasCtx.lineJoin = 'round';
        canvasCtx.stroke();

        lastX = pos.x; lastY = pos.y;
        hasDrawn = true;
    } else {
        // Shapes preview drawing
        if (drawSnapshot && canvas) {
            canvasCtx.putImageData(drawSnapshot, 0, 0);
        }
        
        canvasCtx.globalCompositeOperation = 'source-over';
        canvasCtx.strokeStyle = document.getElementById('tb-pen-color').value;
        canvasCtx.lineWidth = size;
        canvasCtx.lineCap = 'round';
        canvasCtx.lineJoin = 'round';
        
        canvasCtx.beginPath();
        if (currentDrawTool === 'line') {
            canvasCtx.moveTo(drawStartX, drawStartY);
            canvasCtx.lineTo(pos.x, pos.y);
        } else if (currentDrawTool === 'arrow') {
            const headlen = 10 * (size/4); // length of head in pixels
            const dx = pos.x - drawStartX;
            const dy = pos.y - drawStartY;
            const angle = Math.atan2(dy, dx);
            canvasCtx.moveTo(drawStartX, drawStartY);
            canvasCtx.lineTo(pos.x, pos.y);
            canvasCtx.lineTo(pos.x - headlen * Math.cos(angle - Math.PI / 6), pos.y - headlen * Math.sin(angle - Math.PI / 6));
            canvasCtx.moveTo(pos.x, pos.y);
            canvasCtx.lineTo(pos.x - headlen * Math.cos(angle + Math.PI / 6), pos.y - headlen * Math.sin(angle + Math.PI / 6));
        } else if (currentDrawTool === 'rect') {
            canvasCtx.rect(drawStartX, drawStartY, pos.x - drawStartX, pos.y - drawStartY);
        } else if (currentDrawTool === 'circle') {
            const radius = Math.sqrt(Math.pow(pos.x - drawStartX, 2) + Math.pow(pos.y - drawStartY, 2));
            canvasCtx.arc(drawStartX, drawStartY, radius, 0, 2 * Math.PI);
        } else if (currentDrawTool === 'triangle') {
            canvasCtx.moveTo(drawStartX + (pos.x - drawStartX) / 2, drawStartY);
            canvasCtx.lineTo(pos.x, pos.y);
            canvasCtx.lineTo(drawStartX, pos.y);
            canvasCtx.closePath();
        }
        canvasCtx.stroke();
        hasDrawn = true;
    }
}

function stopDraw() { isDrawing = false; }

function startDrawTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    startDraw({ clientX: touch.clientX, clientY: touch.clientY });
}

function drawTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    draw({ clientX: touch.clientX, clientY: touch.clientY });
}

function getCanvasPos(e) {
    const canvas = document.getElementById('draw-canvas');
    const rect = canvas.getBoundingClientRect();
    const zoom = currentZoom / 100;
    return {
        x: (e.clientX - rect.left) / zoom,
        y: (e.clientY - rect.top) / zoom
    };
}

function getCroppedCanvasData(sourceCanvas) {
    const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    const w = sourceCanvas.width;
    const h = sourceCanvas.height;
    
    let minX = w, minY = h, maxX = 0, maxY = 0;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    
    let found = false;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const alpha = data[(y * w + x) * 4 + 3];
            if (alpha > 0) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                found = true;
            }
        }
    }
    
    if (!found) return null;
    
    const pad = 10;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w, maxX + pad);
    maxY = Math.min(h, maxY + pad);
    
    const cropW = maxX - minX;
    const cropH = maxY - minY;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = cropW;
    tempCanvas.height = cropH;
    const tCtx = tempCanvas.getContext('2d');
    tCtx.drawImage(sourceCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
    
    return {
        dataUrl: tempCanvas.toDataURL(),
        x: minX,
        y: minY,
        w: cropW,
        h: cropH,
        canvasW: w,
        canvasH: h
    };
}

function saveCanvasToEditor() {
    const canvas = document.getElementById('draw-canvas');
    if (!canvas || !hasDrawn) return;

    try {
        const cropData = getCroppedCanvasData(canvas);
        if (!cropData) {
            hasDrawn = false;
            if (canvasCtx) canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        const editor = document.getElementById('lec-editor-body');
        
        const leftPct = (cropData.x / cropData.canvasW) * 100;
        const widthPct = (cropData.w / cropData.canvasW) * 100;
        const topPct = (cropData.y / cropData.canvasH) * 100;
        
        const html = `
<div class="drawing-container" contenteditable="false" draggable="false" style="position:absolute; left:${leftPct}%; top:${topPct}%; width:${widthPct}%; z-index:10; cursor: grab;">
    <span class="drawing-wrapper" style="position:relative; display:block; padding: 0; border: 2px solid transparent;">
        <img src="${cropData.dataUrl}" class="canvas-drawing" draggable="false" style="width:100%; height:auto; display:block; pointer-events: none;" />
        <button class="delete-drawing-btn" title="Delete shape" onclick="if(confirm('Do you want to delete this shape?')) this.closest('.drawing-container').remove()" style="position:absolute; top:-12px; right:-12px; background:#e11d48; color:white; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer; display:none; align-items:center; justify-content:center; box-shadow:0 2px 5px rgba(0,0,0,0.3); z-index: 50;"><i class="fa-solid fa-xmark"></i></button>
        <div class="drag-handle-indicator" title="Drag to move" style="position:absolute; top:-12px; left:-12px; background:var(--accent, #00d4ff); color:white; border-radius:50%; width:24px; height:24px; cursor:grab; display:none; align-items:center; justify-content:center; box-shadow:0 2px 5px rgba(0,0,0,0.3); z-index: 50;"><i class="fa-solid fa-arrows-up-down-left-right" style="font-size:12px;"></i></div>
    </span>
</div>`;
        
        editor.insertAdjacentHTML('beforeend', html);
        
        if (canvasCtx) canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        hasDrawn = false;
    } catch (e) {
        console.error("Failed to save canvas drawing to editor:", e);
    }
}

function clearCanvas() {
    const canvas = document.getElementById('draw-canvas');
    if (canvasCtx && canvas) canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn = false;
    
    const editor = document.getElementById('lec-editor-body');
    if (editor) {
        editor.querySelectorAll('.drawing-container').forEach(w => w.remove());
        editor.querySelectorAll('.drawing-wrapper').forEach(w => w.remove());
        editor.querySelectorAll('img.canvas-drawing').forEach(img => img.remove());
    }
}

// ── Toolbar State Sync ────────────────────────────────────────────

function updateToolbarState() {
    const cmds = [
        { id: 'tb-bold',         cmd: 'bold' },
        { id: 'tb-italic',       cmd: 'italic' },
        { id: 'tb-underline',    cmd: 'underline' },
        { id: 'tb-strike',       cmd: 'strikeThrough' },
        { id: 'tb-super',        cmd: 'superscript' },
        { id: 'tb-sub',          cmd: 'subscript' },
        { id: 'tb-align-left',   cmd: 'justifyLeft' },
        { id: 'tb-align-center', cmd: 'justifyCenter' },
        { id: 'tb-align-right',  cmd: 'justifyRight' },
        { id: 'tb-align-justify',cmd: 'justifyFull' },
        { id: 'tb-ul',           cmd: 'insertUnorderedList' },
        { id: 'tb-ol',           cmd: 'insertOrderedList' },
    ];
    cmds.forEach(({ id, cmd }) => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.toggle('on', document.queryCommandState(cmd));
    });
}

// ── Word Count + Auto-link ────────────────────────────────────────

function onEditorInput() {
    updateWordCount();
    updateStatusText('Unsaved');
    // Debounce auto-link scan
    clearTimeout(editorSaveTimer);
    editorSaveTimer = setTimeout(autoLinkURLs, 800);
}

function updateWordCount() {
    const body = document.getElementById('lec-editor-body');
    const el = document.getElementById('lec-word-count');
    if (!body || !el) return;

    let text = body.innerText || body.textContent || "";
    text = text.replace(/\u200B/g, '');
    text = text.trim();

    // Split by any whitespace to count every single sequence
    const words = text.split(/\s+/).filter(word => word.length > 0);
    const count = words ? words.length : 0;
    el.innerText = `${count} word${count !== 1 ? 's' : ''}`;
}

function autoLinkURLs() {
    // Walk text nodes and convert bare URLs to anchor tags
    const editor = document.getElementById('lec-editor-body');
    if (!editor) return;
    const urlRegex = /\b(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const nodesToProcess = [];
    let node;
    while ((node = walker.nextNode())) {
        if (node.parentElement.tagName !== 'A' && urlRegex.test(node.textContent)) {
            nodesToProcess.push(node);
        }
    }
    nodesToProcess.forEach(textNode => {
        const frag = document.createDocumentFragment();
        const parts = textNode.textContent.split(/\b(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi);
        parts.forEach(part => {
            if (/^(https?:\/\/|www\.)/i.test(part)) {
                const a = document.createElement('a');
                let href = part;
                if (/^www\./i.test(part)) {
                    href = 'https://' + part;
                }
                a.href = href;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                a.textContent = part;
                a.title = "Click to open link";
                frag.appendChild(a);
            } else {
                frag.appendChild(document.createTextNode(part));
            }
        });
        textNode.parentNode.replaceChild(frag, textNode);
    });
}

function updateStatusText(status) {
    const el = document.getElementById('lec-status-text');
    if (!el) return;
    if (status === 'Saved Draft') {
        el.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#f59e0b"></i> Saved as Draft';
    } else if (status === 'Published') {
        el.innerHTML = '<i class="fa-solid fa-circle-check" style="color:#10b981"></i> Published';
    } else {
        el.innerHTML = '<i class="fa-regular fa-circle-dot"></i> Unsaved';
    }
}

// ── Save Draft ────────────────────────────────────────────────────

async function saveLectureDraft() {
    const title = document.getElementById('lec-title-input').value.trim();
    const courseCode = document.getElementById('lec-code-input').value.trim();
    const lecturer = document.getElementById('lec-lecturer-input').value.trim();
    const room = document.getElementById('lec-room-input').value.trim();
    const content = document.getElementById('lec-editor-body').innerHTML;
    const editingId = document.getElementById('lec-editing-id').value;

    if (!title || !courseCode) {
        return alert('Please fill in at least the Lecture Title and Course Code.');
    }

    const draftBtn = document.querySelector('.btn-lec-draft');
    draftBtn.disabled = true;
    draftBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';

    try {
        const data = {
            title, courseCode, lecturer, room, content,
            status: 'draft',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (editingId) {
            await db.collection('lectures').doc(editingId).update(data);
        } else {
            const ref = await db.collection('lectures').add({
                ...data,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            document.getElementById('lec-editing-id').value = ref.id;
        }

        updateStatusText('Saved Draft');
        draftBtn.innerHTML = '<i class="fa-solid fa-check"></i> Draft Saved!';
        setTimeout(() => { draftBtn.disabled = false; draftBtn.innerHTML = '<i class="fa-regular fa-floppy-disk"></i> Save Draft'; }, 2000);
    } catch (err) {
        draftBtn.disabled = false;
        draftBtn.innerHTML = '<i class="fa-regular fa-floppy-disk"></i> Save Draft';
        alert('Draft save error: ' + err.message + '\nStack: ' + err.stack);
    }
}

// ── Publish Lecture ───────────────────────────────────────────────

async function publishLectureDoc() {
    const title = document.getElementById('lec-title-input').value.trim();
    const courseCode = document.getElementById('lec-code-input').value.trim();
    const lecturer = document.getElementById('lec-lecturer-input').value.trim();
    const room = document.getElementById('lec-room-input').value.trim();
    const content = document.getElementById('lec-editor-body').innerHTML;
    const editingId = document.getElementById('lec-editing-id').value;
    const paperColor = document.getElementById('tb-paper-color') ? document.getElementById('tb-paper-color').value : '#ffffff';

    if (!title || !courseCode) {
        return alert('Lecture Title and Course Code are required before publishing.');
    }
    if (!content || content.replace(/<[^>]+>/g, '').trim().length < 10) {
        return alert('Please write some lecture content before publishing.');
    }

    if (!confirm(`Publish "${title}" to all students now?`)) return;

    const pubBtn = document.querySelector('.btn-lec-publish');
    pubBtn.disabled = true;
    pubBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publishing…';

    try {
        const now = firebase.firestore.FieldValue.serverTimestamp();
        const data = { title, courseCode, lecturer, room, content, paperColor, status: 'published', updatedAt: now };

        let lecId;
        if (editingId) {
            await db.collection('lectures').doc(editingId).update({ ...data, isUpdated: true });
            lecId = editingId;
        } else {
            const ref = await db.collection('lectures').add({ ...data, createdAt: now });
            lecId = ref.id;
            document.getElementById('lec-editing-id').value = lecId;
        }

        // Broadcast notification to all students (in a non-blocking try-catch to prevent permissions from halting publish)
        try {
            await db.collection('notifications').add({
                type: 'broadcast',
                message: editingId ? `✏️ Lecture Updated: "${title}" — ${courseCode}. Check your Lectures tab!` : `📚 New Lecture Published: "${title}" — ${courseCode}. Check your Lectures tab!`,
                timestamp: now,
                lectureId: lecId,
                sentBy: localStorage.getItem('user_fullName') || 'Admin'
            });
        } catch (notifErr) {
            console.warn("Notification dispatch skipped due to rules:", notifErr);
        }

        updateStatusText('Published');
        pubBtn.innerHTML = '<i class="fa-solid fa-check"></i> Published!';
        setTimeout(() => {
            pubBtn.disabled = false;
            pubBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publish Lecture';
            closeLectureEditor();
        }, 1800);

    } catch (err) {
        pubBtn.disabled = false;
        pubBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publish Lecture';
        alert('Publish error: ' + err.message + '\nStack: ' + err.stack);
    }
}

// ── Edit Lecture ──────────────────────────────────────────────────

async function editLecture(lectureId) {
    try {
        const doc = await db.collection('lectures').doc(lectureId).get();
        if (!doc.exists) return alert('Lecture not found.');
        const lec = doc.data();

        openLectureEditor(lectureId);

        // Populate fields
        document.getElementById('lec-title-input').value = lec.title || '';
        document.getElementById('lec-code-input').value = lec.courseCode || '';
        document.getElementById('lec-lecturer-input').value = lec.lecturer || '';
        document.getElementById('lec-room-input').value = lec.room || '';
        
        const editorBody = document.getElementById('lec-editor-body');
        editorBody.innerHTML = lec.content || '';
        editorBody.style.backgroundColor = lec.paperColor || '#ffffff';
        
        const paperColorInput = document.getElementById('tb-paper-color');
        if (paperColorInput) {
            paperColorInput.value = lec.paperColor || '#ffffff';
        }
        
        document.getElementById('lec-editing-id').value = lectureId;

        const statusLabel = lec.status === 'draft' ? 'Saved Draft' : 'Published';
        updateStatusText(statusLabel);
        updateWordCount();

    } catch (err) {
        alert('Failed to load lecture: ' + err.message);
    }
}

// ── Delete Lecture ────────────────────────────────────────────────

async function deleteLecture(lectureId) {
    if (!confirm('Permanently delete this lecture and remove it from all students?')) return;
    const card = document.getElementById(`lec-card-${lectureId}`);
    if (card) gsap.to(card, { opacity: 0, x: -40, duration: 0.3, onComplete: () => card.remove() });
    try {
        await db.collection('lectures').doc(lectureId).delete();
    } catch (err) {
        alert('Delete error: ' + err.message);
    }
}


function renderAdminAssignments(assignments) {
    const container = document.getElementById('admin-assignments-feed-container');
    if (assignments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-hourglass-empty"></i>
                <p>No assignments issued to streams yet.</p>
            </div>`;
        return;
    }

    container.innerHTML = assignments.map(ass => `
        <div class="list-item admin-item">
            <div class="item-meta-top">
                <span class="item-code">${escapeHtml(ass.course)}</span>
                <div class="admin-item-right">
                    <span class="badge dark-badge">${ass.points} Pts</span>
                    <button class="btn-delete-item" onclick="deleteAssignment('${ass.id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            <h4 class="item-title">${escapeHtml(ass.title)}</h4>
            ${ass.description ? `<p class="item-desc" style="font-size: 0.85rem; opacity: 0.8; margin-top: 5px;">${escapeHtml(ass.description).substring(0, 100)}...</p>` : ''}
            <div class="item-sub" style="margin-top: 10px;"><i class="fa-solid fa-calendar-xmark"></i> <span>Due: ${new Date(ass.dueDate).toLocaleString(undefined, {weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute:'2-digit'}) !== 'Invalid Date' ? new Date(ass.dueDate).toLocaleString(undefined, {weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute:'2-digit'}) : escapeHtml(ass.dueDate)}</span></div>
        </div>
    `).join('');
}

function renderAdminNotifications(notifications) {
    const container = document.getElementById('admin-notifications-sent-container');
    if (notifications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-bell-slash"></i>
                <p>No notification logs archived.</p>
            </div>`;
        return;
    }

    container.innerHTML = notifications.map(notif => {
        const isDirect = notif.type === "direct";
        const dateStr = notif.timestamp ? new Date(notif.timestamp.toMillis()).toLocaleString() : 'Just now';
        
        return `
            <div class="list-item notification-item admin-notif-log">
                <div class="notif-meta">
                    <span class="badge ${isDirect ? 'dark-badge' : 'sky-badge'}">
                        ${isDirect ? `Private to: ${escapeHtml(notif.recipientEmail)}` : 'Public Broadcast'}
                    </span>
                    <span class="notif-date">${dateStr}</span>
                </div>
                <p class="notif-text">${escapeHtml(notif.message)}</p>
                <button class="btn-delete-log" onclick="deleteNotification('${notif.id}')"><i class="fa-solid fa-trash-can"></i> Delete Alert</button>
            </div>
        `;
    }).join('');
}

function renderAdminLogs(logs) {
    const container = document.getElementById('admin-logs-container');
    if (logs.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-shield-halved"></i>
                <p>No system activity logs found.</p>
            </div>`;
        return;
    }

    container.innerHTML = logs.map(log => {
        const timeStr = log.timestamp ? new Date(log.timestamp.toMillis()).toLocaleString() : 'Just now';
        let actionBadge = "";
        
        if (log.action === "signup" || log.action === "google_signup") {
            actionBadge = `<span class="badge green-badge">SIGNUP</span>`;
        } else if (log.action === "PUBLISH") {
            actionBadge = `<span class="badge" style="background:#10b981; color:white;">PUBLISH</span>`;
        } else if (log.action === "UPDATE") {
            actionBadge = `<span class="badge" style="background:#f59e0b; color:white;">UPDATE</span>`;
        } else if (log.action === "DELETE") {
            actionBadge = `<span class="badge" style="background:#ef4444; color:white;">DELETE</span>`;
        } else if (log.action === "BROADCAST") {
            actionBadge = `<span class="badge" style="background:#8b5cf6; color:white;">BROADCAST</span>`;
        } else {
            actionBadge = `<span class="badge sky-badge">${escapeHtml(log.action || "LOG")}</span>`;
        }

        const detailsStr = log.details || (log.email ? `User: ${log.email}` : "System action");

        return `
            <div class="log-item">
                <div class="log-top">
                    ${actionBadge}
                    <span class="log-time">${timeStr}</span>
                </div>
                <div class="log-body">
                    <strong>${escapeHtml(log.user || "System")}</strong>: ${escapeHtml(detailsStr)}
                </div>
            </div>
        `;
    }).join('');
}

// 10. DATABASE TRANSACTION ACTIONS (Students & Admins)

// Add Personal Student Checklist Task
async function addTask(event) {
    event.preventDefault();
    const input = document.getElementById('task-input');
    const text = input.value.trim();
    if (!text) return;

    try {
        await db.collection("tasks").add({
            uid: auth.currentUser.uid,
            text: text,
            completed: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        input.value = "";
    } catch (err) {
        alert("Error adding task: " + err.message);
    }
}

async function toggleTaskState(taskId, completed) {
    const card = document.getElementById(`task-card-${taskId}`);
    if (completed && card) {
        gsap.to(card, {
            x: 50,
            opacity: 0,
            duration: 0.4,
            ease: "power2.in",
            onComplete: async () => {
                try {
                    await db.collection("tasks").doc(taskId).delete();
                } catch (e) {
                    console.error("Task delete failure:", e);
                }
            }
        });
    } else {
        try {
            await db.collection("tasks").doc(taskId).update({ completed });
        } catch (err) {
            console.error("Error updating task state:", err);
        }
    }
}

async function deleteTask(taskId) {
    const card = document.getElementById(`task-card-${taskId}`);
    if (card) {
        gsap.to(card, {
            scale: 0.8,
            opacity: 0,
            duration: 0.3,
            ease: "back.in(1.7)",
            onComplete: async () => {
                try {
                    await db.collection("tasks").doc(taskId).delete();
                } catch (e) {
                    console.error("Error deleting task:", e);
                }
            }
        });
    } else {
        await db.collection("tasks").doc(taskId).delete();
    }
}

// Open Student Submission Modal
function openSubmissionModal(assignmentId, title, course, maxPoints) {
    document.getElementById('submit-assignment-id').value = assignmentId;
    document.getElementById('submit-assignment-title').value = title;
    document.getElementById('submit-assignment-course').value = course;
    document.getElementById('submit-assignment-points').value = maxPoints;

    document.getElementById('submit-modal-title').innerText = title;
    document.getElementById('submit-modal-course').innerText = `${course} (Max Points: ${maxPoints})`;

    document.getElementById('submit-link').value = "";
    document.getElementById('submit-comments').value = "";

    const modal = document.getElementById('submission-modal');
    modal.style.display = 'flex';
    gsap.fromTo(modal.querySelector('.modal-content'), { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.5)" });
}

function closeSubmissionModal() {
    const modal = document.getElementById('submission-modal');
    gsap.to(modal.querySelector('.modal-content'), { scale: 0.85, opacity: 0, duration: 0.25, onComplete: () => {
        modal.style.display = 'none';
    }});
}

// Handle Student Assignment Upload Submission
async function handleAssignmentSubmit(event) {
    event.preventDefault();
    const assignmentId = document.getElementById('submit-assignment-id').value;
    const title = document.getElementById('submit-assignment-title').value;
    const course = document.getElementById('submit-assignment-course').value;
    const points = parseInt(document.getElementById('submit-assignment-points').value) || 100;
    const link = document.getElementById('submit-link').value.trim();
    const comments = document.getElementById('submit-comments').value.trim();

    if (!link) return alert("Submission URL is required.");

    const user = auth.currentUser;
    const fullName = localStorage.getItem("user_fullName") || "Student";
    
    try {
        const submitBtn = document.getElementById('btn-submit-assignment');
        submitBtn.disabled = true;
        submitBtn.innerText = "Submitting...";

        // Create assignment submission document
        await db.collection("submissions").doc(`${user.uid}_${assignmentId}`).set({
            studentUid: user.uid,
            studentName: fullName,
            studentEmail: user.email,
            assignmentId: assignmentId,
            assignmentTitle: title,
            course: course,
            points: points,
            submissionLink: link,
            comments: comments,
            graded: false,
            grade: 0,
            feedback: "",
            submittedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        submitBtn.disabled = false;
        submitBtn.innerText = "Submit to Portal";
        closeSubmissionModal();
        alert("Success: Your assignment submission has been uploaded!");
    } catch (e) {
        document.getElementById('btn-submit-assignment').disabled = false;
        document.getElementById('btn-submit-assignment').innerText = "Submit to Portal";
        alert("Submission failure: " + e.message);
    }
}

// Admin Grading Submission Action
async function submitGrade(submissionId, maxPoints) {
    const gradeVal = parseInt(document.getElementById(`grade-val-${submissionId}`).value);
    const feedback = document.getElementById(`feedback-val-${submissionId}`).value.trim();

    if (isNaN(gradeVal) || gradeVal < 0 || gradeVal > maxPoints) {
        return alert(`Please enter a valid grade between 0 and ${maxPoints} points.`);
    }

    try {
        await db.collection("submissions").doc(submissionId).update({
            graded: true,
            grade: gradeVal,
            feedback: feedback || "Excellent work.",
            gradedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert("Success: Student grade has been recorded.");
    } catch (e) {
        alert("Grading failure: " + e.message);
    }
}

// Admin Publishing Actions

async function publishAssignment(event) {
    event.preventDefault();
    const title = document.getElementById('admin-assign-title').value.trim();
    const course = document.getElementById('admin-assign-course').value.trim();
    const dueDate = document.getElementById('admin-assign-due').value.trim(); // Now a datetime-local value
    const points = parseInt(document.getElementById('admin-assign-points').value) || 100;
    const description = document.getElementById('admin-assign-desc').value.trim();

    try {
        await db.collection("assignments").add({
            title, course, dueDate, points, description,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById('admin-assignment-form').reset();
        alert("Success: Assignment brief dispatched to all streams!");
    } catch (e) {
        alert("Dispatch failed: " + e.message);
    }
}

async function deleteAssignment(id) {
    if (!confirm("Are you sure you want to delete this assignment brief? This will not delete student submissions.")) return;
    try {
        await db.collection("assignments").doc(id).delete();
    } catch (e) {
        alert("Delete failed: " + e.message);
    }
}

// Admin Notification Relays
async function sendBroadcastNotification(event) {
    event.preventDefault();
    const textEl = document.getElementById('broadcast-message');
    const msg = textEl.value.trim();
    if (!msg) return;

    try {
        await db.collection("notifications").add({
            type: "broadcast",
            message: msg,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        textEl.value = "";
        
        if (typeof addSystemLog === 'function') addSystemLog("BROADCAST", `Sent announcement: "${msg.substring(0, 30)}..."`);
        
        if (typeof showToast === 'function') showToast("Announcement broadcasted to all students!", "success");
        else alert("Success: Announcement broadcasted to all students!");
    } catch (e) {
        if (typeof showToast === 'function') showToast("Broadcast failed: " + e.message, "error");
        else alert("Broadcast failed: " + e.message);
    }
}

async function sendDirectNotification(event) {
    event.preventDefault();
    const email = document.getElementById('direct-student-select').value;
    const textEl = document.getElementById('direct-message');
    const msg = textEl.value.trim();

    if (!email || !msg) return alert("Select a student and write a message.");

    try {
        await db.collection("notifications").add({
            type: "direct",
            recipientEmail: email,
            message: msg,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        textEl.value = "";
        alert("Success: Direct message dispatched to the student's board!");
    } catch (e) {
        alert("Dispatch failed: " + e.message);
    }
}

// ==========================================
// ADMIN MANAGEMENT (Super Admin Only)
// ==========================================
async function syncAdminManagement() {
    if (localStorage.getItem("user_email") !== SUPER_ADMIN) return;
    
    try {
        const rolesDoc = await db.collection("settings").doc("roles").get();
        let adminsList = [];
        if (rolesDoc.exists) {
            adminsList = rolesDoc.data().admins || [];
        }
        
        const badge = document.getElementById("admin-count-badge");
        if (badge) badge.innerText = `${adminsList.length + 1} Admins`;
        
        const container = document.getElementById("admin-list-container");
        if (!container) return;
        
        let html = `
            <div class="list-item" style="border-left-color: var(--primary-color);">
                <div class="item-meta-top">
                    <span class="badge sky-badge"><i class="fa-solid fa-crown"></i> Super Admin</span>
                </div>
                <h4 class="item-title">${SUPER_ADMIN}</h4>
                <div class="item-sub" style="justify-content: flex-start;">
                    <span>System Owner (Immutable)</span>
                </div>
            </div>
        `;
        
        if (adminsList.length === 0) {
            html += `
                <div class="empty-state" style="margin-top: 15px;">
                    <i class="fa-solid fa-user-shield"></i>
                    <p>No additional admins authorized yet.</p>
                </div>
            `;
        } else {
            html += adminsList.map(email => `
                <div class="list-item">
                    <div class="item-meta-top">
                        <span class="badge" style="background:#10b981; color:white;"><i class="fa-solid fa-check-circle"></i> Authorized</span>
                    </div>
                    <h4 class="item-title">${escapeHtml(email)}</h4>
                    <div class="item-sub" style="justify-content: space-between;">
                        <span>Standard Administrator</span>
                        <button class="btn-icon" onclick="removeAdminEmail('${escapeHtml(email)}')"><i class="fa-solid fa-trash" style="color:var(--danger-color);"></i> Revoke</button>
                    </div>
                </div>
            `).join('');
        }
        
        container.innerHTML = html;
        
    } catch (e) {
        console.warn("Failed to sync admin management:", e);
    }
}

async function addAdminEmail(event) {
    event.preventDefault();
    if (localStorage.getItem("user_email") !== SUPER_ADMIN) return;
    
    const emailInput = document.getElementById("new-admin-email");
    const email = emailInput.value.trim().toLowerCase();
    if (!email) return;
    
    if (email === SUPER_ADMIN) {
        if (typeof showToast === 'function') showToast("That is the Super Admin email.", "error");
        return;
    }
    
    try {
        const roleRef = db.collection("settings").doc("roles");
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(roleRef);
            let admins = [];
            if (doc.exists) {
                admins = doc.data().admins || [];
            }
            if (admins.includes(email)) {
                throw new Error("Email is already an administrator.");
            }
            admins.push(email);
            transaction.set(roleRef, { admins }, { merge: true });
        });
        
        emailInput.value = "";
        if (typeof showToast === 'function') showToast("Administrator successfully authorized!", "success");
        if (typeof addSystemLog === 'function') addSystemLog("AUTH", `Granted admin access to ${email}`);
        syncAdminManagement();
    } catch (e) {
        if (typeof showToast === 'function') showToast(e.message, "error");
        else alert(e.message);
    }
}

async function removeAdminEmail(email) {
    if (localStorage.getItem("user_email") !== SUPER_ADMIN) return;
    if (!confirm(`Are you sure you want to revoke admin access for ${email}?`)) return;
    
    try {
        const roleRef = db.collection("settings").doc("roles");
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(roleRef);
            if (!doc.exists) return;
            let admins = doc.data().admins || [];
            admins = admins.filter(a => a !== email);
            transaction.update(roleRef, { admins });
        });
        
} catch (e) {
        if (typeof showToast === 'function') showToast(e.message, "error");
        else alert(e.message);
    }
}

// STUDENT ABILITY TO LOCALLY DELETE/DISMISS NOTIFICATIONS
window.deleteStudentNotification = function(id) {
    let deletedNotifs = JSON.parse(localStorage.getItem('deleted_notifs') || '[]');
    if (!deletedNotifs.includes(id)) {
        deletedNotifs.push(id);
        localStorage.setItem('deleted_notifs', JSON.stringify(deletedNotifs));
        
        const item = document.getElementById('student-notif-' + id);
        if (item) {
            item.style.opacity = '0';
            setTimeout(() => {
                item.remove();
                // We could also re-trigger the snapshot logic, but removing locally is fine for now
                const badge = document.getElementById('student-notification-badge');
                if(badge) {
                    let current = parseInt(badge.innerText) || 0;
                    if(current > 0) badge.innerText = (current - 1) + " Alerts";
                }
            }, 300);
        }
    }
}

// Global functions for inline HTML event handlers
async function deleteNotification(id) {
    if (!confirm("Delete this notification alert from history?")) return;
    try {
        await db.collection("notifications").doc(id).delete();
    } catch (e) {
        alert("Delete failed: " + e.message);
    }
}

// 11. IMAGE CAROUSEL DRAG & SWIPE PHYSICS
let currentSlide = 0;
const track = document.getElementById('carousel');
const slides = document.querySelectorAll('.c-slide');
const dots = document.querySelectorAll('.dot');
const totalSlides = slides.length;

let startX = 0;
let currentTranslate = 0;
let prevTranslate = 0;
let isDraggingCarousel = false;
let autoSlideInterval;

// Carousel Swipe Event Bindings
const container = document.querySelector('.carousel-container');

container.addEventListener('mousedown', dragStart);
container.addEventListener('touchstart', dragStart, { passive: true });
container.addEventListener('mousemove', dragMove);
container.addEventListener('touchmove', dragMove, { passive: true });
container.addEventListener('mouseup', dragEnd);
container.addEventListener('mouseleave', dragEnd);
container.addEventListener('touchend', dragEnd);

function startAutoSlide() {
    stopAutoSlide();
    autoSlideInterval = setInterval(nextSlide, 5000);
}
function stopAutoSlide() {
    if (autoSlideInterval) clearInterval(autoSlideInterval);
}
container.addEventListener('mouseenter', stopAutoSlide);
container.addEventListener('mouseleave', startAutoSlide);

function dragStart(e) {
    isDraggingCarousel = true;
    startX = getPositionX(e);
    stopAutoSlide();
    track.style.transition = 'none';
}

function dragMove(e) {
    if (!isDraggingCarousel) return;
    const currentX = getPositionX(e);
    const diff = currentX - startX;
    currentTranslate = prevTranslate + diff;
    setTrackTranslate(currentTranslate);
}

function dragEnd() {
    if (!isDraggingCarousel) return;
    isDraggingCarousel = false;
    const movedBy = currentTranslate - prevTranslate;
    
    // Swipe threshold: 80px
    if (movedBy < -80 && currentSlide < totalSlides - 1) {
        currentSlide++;
    } else if (movedBy > 80 && currentSlide > 0) {
        currentSlide--;
    }
    
    goToSlide(currentSlide);
    startAutoSlide();
}

function getPositionX(e) {
    return e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
}

function setTrackTranslate(translate) {
    track.style.transform = `translateX(${translate}px)`;
}

function goToSlide(index) {
    currentSlide = index;
    prevTranslate = -index * container.offsetWidth;
    currentTranslate = prevTranslate;
    
    track.style.transition = 'transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    setTrackTranslate(currentTranslate);
    
    // Sync Slides class
    slides.forEach((slide, idx) => {
        slide.classList.toggle('active', idx === index);
    });

    // Sync Dots
    dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === index);
    });
}

function nextSlide() {
    if (currentSlide < totalSlides - 1) {
        goToSlide(currentSlide + 1);
    } else {
        goToSlide(0);
    }
}

function prevSlide() {
    if (currentSlide > 0) {
        goToSlide(currentSlide - 1);
    } else {
        goToSlide(totalSlides - 1);
    }
}

function jumpToSlide(index) {
    goToSlide(index);
}

// Initialize Carousel values on load/resize
window.addEventListener('resize', () => {
    goToSlide(currentSlide);
});
startAutoSlide();

// 9. 3D ROTATING/REVOLVING IMAGE CUBE WITH INTERACTION DRAG
const cube = document.getElementById('cube');
const cubeBoundary = document.getElementById('cube-boundary');

let rotX = -30;
let rotY = 45;
let velX = 0;
let velY = 0;
let isDraggingCube = false;
let prevPointerX = 0;
let prevPointerY = 0;

// Revolve offset parameters (floating in workspace)
let hoverTime = 0;

cubeBoundary.addEventListener('mousedown', startCubeDrag);
cubeBoundary.addEventListener('touchstart', startCubeDrag, { passive: true });
document.addEventListener('mousemove', moveCubeDrag);
document.addEventListener('touchmove', moveCubeDrag, { passive: false });
document.addEventListener('mouseup', endCubeDrag);
document.addEventListener('touchend', endCubeDrag);

function startCubeDrag(e) {
    isDraggingCube = true;
    const coords = getPointerCoords(e);
    prevPointerX = coords.x;
    prevPointerY = coords.y;
    velX = 0;
    velY = 0;
}

function moveCubeDrag(e) {
    if (!isDraggingCube) return;
    
    // Prevent screen scroll when dragging the 3D cube on mobile devices
    if (e.cancelable) e.preventDefault();

    const coords = getPointerCoords(e);
    const deltaX = coords.x - prevPointerX;
    const deltaY = coords.y - prevPointerY;

    // Rotation ratios
    rotY += deltaX * 0.4;
    rotX -= deltaY * 0.4;

    // Clamping rotateX to prevent visual flip issues
    rotX = Math.max(-85, Math.min(85, rotX));

    // Save inertia velocities
    velX = deltaX * 0.4;
    velY = -deltaY * 0.4;

    prevPointerX = coords.x;
    prevPointerY = coords.y;
}

function endCubeDrag() {
    isDraggingCube = false;
}

function getPointerCoords(e) {
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
}

// Continuous Cube Animation Frame Update (Auto-rotate, Revolving Orbit, and Drag inertia decay)
function updateCube() {
    hoverTime += 0.025;

    // Revolving/floating orbit offsets
    const floatY = Math.sin(hoverTime) * 12;
    const floatX = Math.cos(hoverTime * 0.7) * 8;

    if (isDraggingCube) {
        // Handled by mousemove, but keep dampening
    } else {
        // Inertia decay
        rotX += velY;
        rotY += velX;

        velX *= 0.95;
        velY *= 0.95;

        // Base auto-rotation when user releases and velocities fade
        if (Math.abs(velX) < 0.05) rotY += 0.45;
        if (Math.abs(velY) < 0.05) rotX += 0.15;
    }

    // Apply combined floating and 3D rotations
    cube.style.transform = `translate3d(${floatX}px, ${floatY}px, 0) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    requestAnimationFrame(updateCube);
}
requestAnimationFrame(updateCube);

// 10. SCROLL EFFECTS (REVEAL PORTAL & POWER FOOTER)
gsap.registerPlugin(ScrollTrigger);

// Portal fixed image reveal
gsap.to("#portal-bg-img", {
    scrollTrigger: {
        trigger: ".reveal-portal",
        start: "top bottom",
        end: "bottom top",
        scrub: true
    },
    opacity: 0.65,
    scale: 1
});

// Smart Footer end-of-scroll detection and bounce animation
let footerTriggered = false;

function checkFooterVisibility() {
    const totalHeight = document.documentElement.scrollHeight;
    const scrollPosition = window.scrollY + window.innerHeight;
    const isScrollable = totalHeight > window.innerHeight + 60;

    // If the page is too short to scroll, or we are near the bottom of scroll range
    if (!isScrollable || (totalHeight - scrollPosition <= 80)) {
        if (!footerTriggered) {
            footerTriggered = true;
            gsap.to("#footer", {
                y: 0,
                opacity: 1,
                duration: 0.8,
                ease: "power2.out"
            });
        }
    } else {
        if (footerTriggered) {
            footerTriggered = false;
            gsap.to("#footer", {
                y: 100,
                opacity: 0,
                duration: 0.4,
                ease: "power2.in"
            });
        }
    }
}

// Attach listener for scrolling
window.addEventListener('scroll', checkFooterVisibility);

// Check visibility on resize and dynamic page updates
window.addEventListener('resize', checkFooterVisibility);

// Run initial check once workspaces are set up
setTimeout(checkFooterVisibility, 1000);

// 11. HAMBURGER OVERLAY & THEME TOGGLE
const ham = document.getElementById('ham');
const menu = document.getElementById('menu');

ham.onclick = (e) => {
    e.stopPropagation();
    ham.classList.toggle('active');
    menu.classList.toggle('active');
};

// Close mobile navbar on background click
document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && !ham.contains(e.target)) {
        ham.classList.remove('active');
        menu.classList.remove('active');
    }
});

// Close mobile navbar when clicking links
menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        ham.classList.remove('active');
        menu.classList.remove('active');
    });
});

// Theme switch persistence
function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    // Sync active theme icons
    const icons = document.querySelectorAll('.theme-switch i, .theme-switch-btn i');
    icons.forEach(icon => {
        if (isDark) {
            icon.classList.replace('fa-moon', 'fa-sun');
        } else {
            icon.classList.replace('fa-sun', 'fa-moon');
        }
    });
}

// Load persisted theme preference
window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        const icons = document.querySelectorAll('.theme-switch i, .theme-switch-btn i');
        icons.forEach(icon => icon.classList.replace('fa-moon', 'fa-sun'));
    }
});

// 12. BACK TO TOP PROGRESS INDICATOR
const toTopBtn = document.getElementById('toTop');
const progressCircle = document.querySelector('.progress-ring-circle');
const circumference = 2 * Math.PI * 24; // r=24 => 150.796

if (progressCircle) {
    progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    progressCircle.style.strokeDashoffset = circumference;
}

window.addEventListener('scroll', () => {
    const scrollPercent = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
    
    // Display button after scrolling 300px
    if (window.scrollY > 300) {
        toTopBtn.style.display = 'flex';
        gsap.to(toTopBtn, { scale: 1, opacity: 1, duration: 0.25, ease: "back.out(1.7)" });
    } else {
        gsap.to(toTopBtn, { scale: 0.5, opacity: 0, duration: 0.2, onComplete: () => {
            if (window.scrollY <= 300) toTopBtn.style.display = 'none';
        }});
    }

    // Update Progress Ring
    if (progressCircle) {
        const offset = circumference - (scrollPercent * circumference);
        progressCircle.style.strokeDashoffset = Math.max(0, Math.min(circumference, offset));
    }
});

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}

// 13. UTILS (XSS Prevention)
function escapeHtml(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 14. INITIATE PARTICLES
particlesJS("particles-js", {
    "particles": {
        "number": { "value": 60, "density": { "enable": true, "value_area": 800 } },
        "color": { "value": "#00d4ff" },
        "shape": { "type": "circle" },
        "opacity": { "value": 0.3, "random": true },
        "size": { "value": 2.5, "random": true },
        "line_linked": { "enable": true, "distance": 140, "color": "#00d4ff", "opacity": 0.2, "width": 1 },
        "move": { "enable": true, "speed": 1.2, "direction": "none", "random": true, "straight": false, "out_mode": "out" }
    },
    "interactivity": {
        "events": { "onhover": { "enable": true, "mode": "bubble" } },
        "modes": { "bubble": { "distance": 150, "size": 4, "duration": 2, "opacity": 0.5 } }
    }
});

// =============================================
//  DASHBOARD VIDEO MUTE / UNMUTE TOGGLE
// =============================================
function toggleVidMute() {
    const vid = document.getElementById('dashboard-vid');
    const icon = document.getElementById('vid-mute-icon');
    if (!vid) return;
    if (vid.muted) {
        vid.muted = false;
        icon.classList.remove('fa-volume-xmark');
        icon.classList.add('fa-volume-high');
    } else {
        vid.muted = true;
        icon.classList.remove('fa-volume-high');
        icon.classList.add('fa-volume-xmark');
    }
}

// Ensure video autoplays on page load (browsers require muted for autoplay)
document.addEventListener('DOMContentLoaded', () => {
    const vid = document.getElementById('dashboard-vid');
    if (vid) {
        vid.muted = true; // start muted to guarantee autoplay
        vid.play().catch(() => {}); // silent catch if already playing
    }
});

// =============================================
//  SYSTEM LOGS & UI TOAST NOTIFICATIONS
// =============================================
async function addSystemLog(action, details) {
    try {
        await db.collection("login_history").add({
            action: action,
            details: details,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            user: localStorage.getItem("user_fullName") || "Admin"
        });
    } catch(e) {
        console.warn("Log failed:", e);
    }
}

function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;';
        document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#3b82f6');
    toast.style.cssText = `background: ${bgColor}; color: white; padding: 12px 24px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-weight: 500; font-family: 'Plus Jakarta Sans', sans-serif; opacity: 0; transform: translateY(20px); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; gap: 10px;`;
    
    const icon = type === 'success' ? '<i class="fa-solid fa-circle-check"></i>' : (type === 'error' ? '<i class="fa-solid fa-circle-xmark"></i>' : '<i class="fa-solid fa-circle-info"></i>');
    toast.innerHTML = `${icon} <span>${escapeHtml(message)}</span>`;
    
    container.appendChild(toast);
    
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// =============================================
//  RESPONSIVE AUTO-SCALING ENGINE
// =============================================
function fitPageToScreen() {
    const a4WidthPx = 794; // 210mm in pixels at 96dpi
    const padding = 40; // padding around the document
    const isMobile = window.innerWidth <= 768;

    // Fit editor
    const editorContainer = document.querySelector('.lec-doc-surface-wrap');
    const editorSurface = document.getElementById('lec-page-surface');
    if (editorContainer && editorSurface && editorContainer.offsetWidth > 0) {
        if (isMobile) {
            if (typeof currentZoom !== 'undefined') currentZoom = 100;
            editorSurface.style.transform = 'none';
        } else {
            const availableWidth = editorContainer.offsetWidth - padding;
            if (availableWidth < a4WidthPx) {
                const scale = availableWidth / a4WidthPx;
                currentZoom = Math.floor(scale * 100);
            } else {
                currentZoom = 100;
            }
            editorSurface.style.transform = `scale(${currentZoom / 100})`;
        }
        if (typeof updateZoomDisplay === 'function') updateZoomDisplay();
    }

    // Fit reader
    const readerContainer = document.querySelector('.reader-doc-surface-wrap');
    const readerSurface = document.getElementById('reader-page-surface');
    if (readerContainer && readerSurface && readerContainer.offsetWidth > 0) {
        if (isMobile) {
            if (typeof currentReaderZoom !== 'undefined') currentReaderZoom = 100;
            readerSurface.style.transform = 'none';
        } else {
            const availableWidth = readerContainer.offsetWidth - padding;
            if (availableWidth < a4WidthPx) {
                const scale = availableWidth / a4WidthPx;
                currentReaderZoom = Math.floor(scale * 100);
            } else {
                currentReaderZoom = 100;
            }
            readerSurface.style.transform = `scale(${currentReaderZoom / 100})`;
        }
        if (typeof updateReaderZoomDisplay === 'function') updateReaderZoomDisplay();
    }
}

window.addEventListener('resize', () => {
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(fitPageToScreen, 100);
});

// ==========================================
// USER PROFILE MODAL LOGIC
// ==========================================
// Profile logic moved to profile.html / profile.js

function logoutUser() {
    firebase.auth().signOut().then(() => {
        if (window.studentHeartbeat) clearInterval(window.studentHeartbeat);
        localStorage.clear();
        window.location.href = "index.html";
    }).catch(err => {
        console.error("Logout Error:", err);
        alert("Logout failed: " + err.message);
    });
}

// ==========================================
// DYNAMIC FAVICON NOTIFICATION BADGE
// ==========================================
function setFaviconBadge(hasNotification) {
    const faviconSize = 64;
    const canvas = document.createElement('canvas');
    canvas.width = faviconSize;
    canvas.height = faviconSize;
    const ctx = canvas.getContext('2d');
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        ctx.clearRect(0, 0, faviconSize, faviconSize);
        ctx.drawImage(img, 0, 0, faviconSize, faviconSize);
        
        if (hasNotification) {
            ctx.beginPath();
            ctx.arc(faviconSize - 12, 12, 12, 0, 2 * Math.PI);
            ctx.fillStyle = '#ef4444';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#0e2954';
            ctx.stroke();
        }
        
        let link = document.getElementById('dynamic-favicon');
        if (!link) {
            link = document.createElement('link');
            link.id = 'dynamic-favicon';
            link.rel = 'icon';
            link.type = 'image/png';
            document.head.appendChild(link);
        }
        link.href = canvas.toDataURL('image/png');
    };
    img.src = 'logo.png';
}

// ==========================================
// ==========================================
// SMART PWA INSTALL PROMPT
// ==========================================
let deferredPrompt = null;

// Listen for the install prompt
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent default mini-infobar
    e.preventDefault();
    deferredPrompt = e;
});

// Check installation state
setTimeout(() => {
    // Check if running as a standalone PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    
    // Check if user previously dismissed
    const hasDismissed = localStorage.getItem('pwa_prompt_dismissed');
    
    // If not installed and not dismissed, forcefully show our custom prompt
    if (!isStandalone && !hasDismissed) {
        const promptEl = document.getElementById('pwa-install-prompt');
        if (promptEl) promptEl.classList.add('show');
    }
}, 3000); // Wait 3 seconds so it's not instantly obtrusive

function dismissPWA() {
    localStorage.setItem('pwa_prompt_dismissed', 'true');
    const promptEl = document.getElementById('pwa-install-prompt');
    if (promptEl) promptEl.classList.remove('show');
}

const btnPwaInstall = document.getElementById('btn-pwa-install');
if (btnPwaInstall) {
    btnPwaInstall.addEventListener('click', async () => {
        const promptEl = document.getElementById('pwa-install-prompt');
        if (promptEl) promptEl.classList.remove('show');
        
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                localStorage.setItem('pwa_prompt_dismissed', 'true');
            }
            deferredPrompt = null;
        } else {
            // Fallback for browsers that don't support beforeinstallprompt but aren't in standalone mode (e.g. iOS Safari)
            if (typeof showToast === 'function') {
                showToast("To install, tap your browser's share menu and select 'Add to Home Screen'.", "success");
            } else {
                alert("To install, tap your browser's menu (or share icon) and select 'Add to Home Screen' or 'Install App'.");
            }
            localStorage.setItem('pwa_prompt_dismissed', 'true');
        }
    });
}
                       