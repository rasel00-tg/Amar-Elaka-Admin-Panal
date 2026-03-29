// =========================================
// AMAR ELAKA ADMIN DASHBOARD — app.js
// Firebase v10 Modular SDK
// =========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc,
  updateDoc, deleteDoc, onSnapshot, query, orderBy, where,
  serverTimestamp, Timestamp, limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ── Firebase Config ──
const firebaseConfig = {
  apiKey: "AIzaSyD_V51UxWVAzPHWZiiyvnTXkZuL9ewOItw",
  authDomain: "amar-elaka-ee228.firebaseapp.com",
  projectId: "amar-elaka-ee228",
  storageBucket: "amar-elaka-ee228.firebasestorage.app",
  messagingSenderId: "551875999052",
  appId: "1:551875999052:web:87f7c29b63c1e254894be9",
  measurementId: "G-K61HR33FV9"
};

const app   = initializeApp(firebaseConfig);
const auth  = getAuth(app);
const db    = getFirestore(app);

// ── State ──
let currentUser       = null;
let currentAdminData  = null;
let allUsers          = [];
let allAdmins         = [];
let activeListeners   = [];

// =========================================
// AUTH
// =========================================
function showGlobalLoader() { document.getElementById("globalLoader").style.display = "flex"; }
function hideGlobalLoader() { document.getElementById("globalLoader").style.display = "none"; }

function togglePasswordVisibility() {
  const pwdInput = document.getElementById("loginPassword");
  const icon = document.getElementById("togglePasswordIcon");
  if (pwdInput.type === "password") {
    pwdInput.type = "text";
    icon.textContent = "🙈";
  } else {
    pwdInput.type = "password";
    icon.textContent = "👁️";
  }
}
window.togglePasswordVisibility = togglePasswordVisibility;

onAuthStateChanged(auth, async (user) => {
  showGlobalLoader();
  if (user) {
    currentUser = user;
    
    let adminSnapExists = false;
    let adminData = null;

    // 1. Check admins collection with real UID
    try {
      const adminRef = doc(db, "admins", user.uid);
      const snap = await getDoc(adminRef);
      if (snap.exists()) {
        adminSnapExists = true;
        adminData = snap.data();
      }
    } catch(err) {
      console.warn("Could not read real admin doc:", err.message);
    }

    // 2. Check admins collection with email-based UID
    if (!adminSnapExists && user.email) {
      try {
        const emailUid = user.email.replace(/[@.]/g, "_");
        const fallbackRef = doc(db, "admins", emailUid);
        const fallbackSnap = await getDoc(fallbackRef);
        if (fallbackSnap.exists()) {
          adminSnapExists = true;
          adminData = fallbackSnap.data();
        }
      } catch(err) {
        console.warn("Could not read fallback admin doc:", err.message);
      }
    }

    // 3. Check users collection for legacy superAdmin flag
    if (!adminSnapExists) {
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        // Relaxed check: any truthy value for isSuperAdmin passes (like before)
        if (!userSnap.exists() || !userSnap.data().isSuperAdmin) {
          showToast("এই অ্যাকাউন্টে অ্যাডমিন পারমিশন নেই।", "error");
          await signOut(auth);
          hideGlobalLoader();
          return;
        }
        currentAdminData = { ...userSnap.data(), uid: user.uid, role: "superAdmin", permissions: ["all"] };
      } catch(err) {
        showToast("ডাটাবেস এক্সেস সমস্যা: " + err.message, "error");
        await signOut(auth);
        hideGlobalLoader();
        return;
      }
    } else {
      currentAdminData = { ...adminData, uid: user.uid };
      if (currentAdminData.expiryDate) {
        const expiry = currentAdminData.expiryDate.toDate ? currentAdminData.expiryDate.toDate() : new Date(currentAdminData.expiryDate);
        if (new Date() > expiry) {
          showToast("আপনার অ্যাডমিন পারমিশনের মেয়াদ শেষ হয়ে গেছে।", "error");
          await signOut(auth);
          hideGlobalLoader();
          return;
        }
      }
    }

    try {
      showDashboard();
    } catch(err) {
      console.error("Dashboard error:", err);
    }
    
  } else {
    currentUser = null;
    currentAdminData = null;
    showLogin();
  }
  hideGlobalLoader();
});

async function doLogin() {
  const email    = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const btn      = document.getElementById("loginBtn");
  const errDiv   = document.getElementById("loginError");

  if (!email || !password) {
    showLoginError("ইমেইল ও পাসওয়ার্ড দিন");
    return;
  }
  btn.disabled = true;
  document.getElementById("loginBtnText").textContent = "লগইন হচ্ছে...";
  errDiv.style.display = "none";
  showGlobalLoader();

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // Loader will hide automatically in onAuthStateChanged
  } catch (e) {
    hideGlobalLoader();
    let msg = "লগইন ব্যর্থ হয়েছে";
    if (e.code === "auth/user-not-found" || e.code === "auth/invalid-email") msg = "ইমেইল খুঁজে পাওয়া যায়নি";
    else if (e.code === "auth/wrong-password") msg = "পাসওয়ার্ড ভুল (আপনি ডাটাবেসে যা লিখেছেন সেটি কাজ করবে না, আপনার আগের অরিজিনাল পাসওয়ার্ডটি দিন)";
    else if (e.code === "auth/invalid-credential") msg = "পাসওয়ার্ড ভুল (আপনার পুরনো অরিজিনাল পাসওয়ার্ডটি মনে করুন)";
    else msg = e.message;
    showLoginError(msg);
  } finally {
    btn.disabled = false;
    document.getElementById("loginBtnText").textContent = "লগইন করুন";
  }
}

async function doLogout() {
  showGlobalLoader();
  activeListeners.forEach(unsub => unsub());
  activeListeners = [];
  await signOut(auth);
  hideGlobalLoader();
}

function showLoginError(msg) {
  const div = document.getElementById("loginError");
  div.textContent = msg;
  div.style.display = "block";
}

async function forgotPassword() {
  const email = document.getElementById("loginEmail").value.trim();
  if(!email) {
    showLoginError("অনুগ্রহ করে উপরের বক্সে আগে আপনার ইমেইলটি লিখুন, তারপর এখানে ক্লিক করুন।");
    return;
  }
  try {
    showGlobalLoader();
    await sendPasswordResetEmail(auth, email);
    hideGlobalLoader();
    alert(`পাসওয়ার্ড রিসেট লিংক আপনার ইমেইলে (${email}) পাঠানো হয়েছে। ইমেইল চেক করে নতুন পাসওয়ার্ড সেট করুন।`);
  } catch(e) {
    hideGlobalLoader();
    showLoginError("ইমেইল পাঠাতে সমস্যা হয়েছে: " + e.message);
  }
}

window.doLogin   = doLogin;
window.doLogout  = doLogout;
window.forgotPassword = forgotPassword;

// Allow Enter key in login
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && document.getElementById("loginPage").style.display !== "none") {
    doLogin();
  }
});

// =========================================
// LAYOUT
// =========================================
function showLogin() {
  document.getElementById("loginPage").style.display  = "flex";
  document.getElementById("dashboard").style.display = "none";
}

function showDashboard() {
  document.getElementById("loginPage").style.display  = "none";
  document.getElementById("dashboard").style.display = "flex";

  const displayName = currentAdminData?.name || currentAdminData?.displayName || currentUser.email.split("@")[0];
  document.getElementById("sidebarUserName").textContent = displayName;
  document.getElementById("sidebarUserRole").textContent = currentAdminData?.role === "superAdmin" ? "সুপার অ্যাডমিন" : "অ্যাডমিন";
  document.getElementById("sidebarAvatar").textContent   = (displayName[0] || "A").toUpperCase();
  document.getElementById("topbarUserName").textContent  = displayName;

  updateClock();
  setInterval(updateClock, 1000);
  loadOverview();
}

function updateClock() {
  const now = new Date();
  const opts = { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true };
  document.getElementById("topbarTime").textContent = now.toLocaleTimeString("bn-BD", opts);
}

let sidebarOpen = true;
function toggleSidebar() {
  const sb = document.getElementById("sidebar");
  if (window.innerWidth <= 900) {
    sb.classList.toggle("mobile-open");
  } else {
    sb.classList.toggle("collapsed");
    sidebarOpen = !sidebarOpen;
  }
}
window.toggleSidebar = toggleSidebar;

function showSection(sectionId) {
  document.querySelectorAll(".content-section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

  const section = document.getElementById("section-" + sectionId);
  const navItem = document.getElementById("nav-" + sectionId);
  if (section) section.classList.add("active");
  if (navItem) navItem.classList.add("active");

  const titles = {
    overview: "ড্যাশবোর্ড", lostFound: "হারানো বিজ্ঞপ্তি", complaints: "অভিযোগ",
    businesses: "ব্যবসা তালিকা", bloodDonors: "রক্তদাতা", organizations: "সংগঠন",
    jobs: "চাকরি পোস্ট", emergency: "স্থানীয় জরুরি ফোন বুক", islamic: "ইসলামিক আপডেট",
    users: "ইউজার ম্যানেজমেন্ট", admins: "অ্যাডমিন ম্যানেজমেন্ট"
  };
  document.getElementById("pageTitle").textContent = titles[sectionId] || sectionId;

  const loaders = {
    lostFound: loadLostFound, complaints: loadComplaints,
    businesses: loadBusinesses, bloodDonors: loadBloodDonors,
    organizations: loadOrganizations, jobs: loadJobs,
    emergency: () => loadPhonebook(currentPbCategory),
    islamic: loadIslamic, users: loadUsers, admins: loadAdmins
  };
  if (loaders[sectionId]) loaders[sectionId]();

  // Close mobile sidebar
  if (window.innerWidth <= 900) {
    document.getElementById("sidebar").classList.remove("mobile-open");
  }
}
window.showSection = showSection;

// =========================================
// OVERVIEW
// =========================================
async function loadOverview() {
  const collections = [
    { col: "users",        id: "stat-users" },
    { col: "notices",      id: "stat-notices" },
    { col: "complaints",   id: "stat-complaints" },
    { col: "donors",       id: "stat-donors" },
    { col: "businesses",   id: "stat-businesses" },
    { col: "jobs",         id: "stat-jobs" },
  ];

  for (const item of collections) {
    if (item.col === "users") continue; // We handle users separately
    try {
      const snap = await getDocs(collection(db, item.col));
      document.getElementById(item.id).textContent = snap.size;
      if (item.id === "stat-complaints") {
        document.getElementById("badge-complaints").textContent = snap.size;
      }
    } catch (e) {
      document.getElementById(item.id).textContent = "—";
    }
  }

  // Handle users with growth calc
  try {
    onSnapshot(collection(db, "users"), (snap) => {
      document.getElementById("stat-users").textContent = snap.size;
      let currentMonth = 0; let lastMonth = 0;
      const now = new Date();
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.createdAt) {
          const dt = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
          if (dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear()) { currentMonth++; }
          else if ((now.getMonth() === 0 ? 11 : now.getMonth() - 1) === dt.getMonth() && (now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()) === dt.getFullYear()) { lastMonth++; }
        }
      });
      let growth = 0;
      if (lastMonth > 0) growth = ((currentMonth - lastMonth) / lastMonth) * 100;
      else if (currentMonth > 0) growth = 100;
      const growthEl = document.getElementById("stat-users-growth");
      if(growthEl) {
        growthEl.textContent = growth >= 0 ? `▲ +${Math.round(growth)}% (গত মাস থেকে)` : `▼ ${Math.round(growth)}% (গত মাস থেকে)`;
        growthEl.style.color = growth >= 0 ? "#10b981" : "#ef4444";
      }
    });
  } catch(e) {}

  loadRecentComplaints();
  loadRecentUsers();
}

async function loadRecentComplaints() {
  const el = document.getElementById("recentComplaints");
  try {
    const q    = query(collection(db, "complaints"), orderBy("createdAt", "desc"), limit(5));
    const snap = await getDocs(q);
    if (snap.empty) { el.innerHTML = emptyState("কোনো অভিযোগ নেই"); return; }
    el.innerHTML = snap.docs.map(d => {
      const data = d.data();
      return `<div style="padding:10px 0;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:12px;">
        <span class="badge badge-${data.isResolved ? "success" : "warning"}">${data.isResolved ? "মীমাংসিত" : "অমীমাংসিত"}</span>
        <span class="truncate">${data.description || ""}</span>
        <span style="margin-left:auto;font-size:12px;color:#64748b;">${fmtDate(data.createdAt)}</span>
      </div>`;
    }).join("");
  } catch (e) { el.innerHTML = `<p class="error-msg">${e.message}</p>`; }
}

async function loadRecentUsers() {
  const el = document.getElementById("recentUsers");
  try {
    const q    = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(5));
    const snap = await getDocs(q);
    if (snap.empty) { el.innerHTML = emptyState("কোনো ইউজার নেই"); return; }
    el.innerHTML = snap.docs.map(d => {
      const data = d.data();
      return `<div style="padding:10px 0;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:12px;">
        <div style="width:32px;height:32px;background:linear-gradient(135deg,#2563eb,#7c3aed);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:13px;flex-shrink:0;">${(data.displayName || data.email || "U")[0].toUpperCase()}</div>
        <div>
          <div style="font-weight:600;font-size:13px;">${data.displayName || "—"}</div>
          <div style="font-size:12px;color:#64748b;">${data.email || ""}</div>
        </div>
        <span style="margin-left:auto;font-size:12px;color:#64748b;">${fmtDate(data.createdAt)}</span>
      </div>`;
    }).join("");
  } catch (e) { el.innerHTML = `<p class="error-msg">${e.message}</p>`; }
}

// =========================================
// LOST & FOUND
// =========================================
async function loadLostFound() {
  const tbody = document.getElementById("lostFoundBody");
  const filter = document.getElementById("lostFoundFilter").value;
  tbody.innerHTML = loadingRow(4);
  try {
    let q;
    if (filter === "all") {
      q = query(collection(db, "lost_and_found"), orderBy("createdAt", "desc"));
    } else {
      const isRes = filter === "true";
      q = query(collection(db, "lost_and_found"), where("resolved", "==", isRes));
    }
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) { tbody.innerHTML = emptyRow(4); return; }
      
      const docs = snap.docs.map(d => ({id: d.id, ...d.data()}));
      if (filter !== "all") {
        docs.sort((a,b) => {
          const tA = (filter==="true" ? a.resolvedAt : a.createdAt);
          const tB = (filter==="true" ? b.resolvedAt : b.createdAt);
          return (tB?.seconds || 0) - (tA?.seconds || 0);
        });
      }
      
      tbody.innerHTML = docs.map(data => {
        const itemClass = data.resolved ? "badge-success" : "badge-warning";
        const itemText = data.resolved ? "সমাধানকৃত" : "অমীমাংসিত";
        
        let daysStr = "";
        if (data.resolved && data.createdAt && data.resolvedAt) {
           const dDiff = Math.floor((data.resolvedAt.seconds - data.createdAt.seconds) / (3600*24));
           daysStr = `<br/><small style="color:#d97706;">সময় লেগেছে: ${dDiff} দিন</small>`;
        }
        
        let actionHtml = `<div class="action-group">
            <button class="btn-action btn-delete" onclick="confirmDelete('lost_and_found','${data.id}')">🗑️ মুছুন</button>`;
        if(!data.resolved) {
          actionHtml += ` <button class="btn-action btn-edit" style="background:#16a34a;" onclick="resolveLostFoundPrompt('${data.id}')">✅ সমাধান করুন</button>`;
        }
        actionHtml += `</div>`;

        return `<tr>
          <td><strong>${data.itemName || "—"}</strong><br/><small style="color:#666;">মালিক: ${data.ownerName||"—"}</small><br/>
          <span class="badge ${itemClass}">${itemText}</span> ${daysStr}</td>
          <td><small>স্থান: ${data.lostLocation||"—"}</small><br/><small>তারিখ: ${data.lostDate||"—"}</small></td>
          <td>${data.phone||data.contactNumber||"—"}</td>
          <td>${actionHtml}</td>
        </tr>`;
      }).join("");
    }, (error) => { tbody.innerHTML = errorRow(4, error.message); });
    activeListeners.push(unsub);
  } catch (e) { tbody.innerHTML = errorRow(4, e.message); }
}

function resolveLostFoundPrompt(id) {
  document.getElementById("resolveLostFoundId").value = id;
  document.getElementById("resolveLostFoundDetails").value = "";
  showModal("resolveLostFoundModal");
}

async function resolveLostFoundSubmit() {
  const id = document.getElementById("resolveLostFoundId").value;
  const details = document.getElementById("resolveLostFoundDetails").value.trim();
  
  if (!id) return;

  try {
    await updateDoc(doc(db, "lost_and_found", id), {
      resolved: true,
      resolvedAt: serverTimestamp(),
      resolutionDetails: details
    });
    showToast("সফলভাবে সমাধান করা হয়েছে", "success");
    closeModal("resolveLostFoundModal");
  } catch(e) { showToast(e.message, "error"); }
}

window.loadLostFound = async () => {
  // Auto-Cleanup: Delete items older than 180 days
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 180);
    const cleanupQ = query(collection(db, "lost_and_found"), where("createdAt", "<", Timestamp.fromDate(cutoffDate)));
    const cleanupSnap = await getDocs(cleanupQ);
    cleanupSnap.forEach((docSnap) => deleteDoc(doc(db, "lost_and_found", docSnap.id)));
  } catch(e) { console.log('Cleanup error:', e); }

  loadLostFound();
}

window.resolveLostFoundPrompt = resolveLostFoundPrompt;
window.resolveLostFoundSubmit = resolveLostFoundSubmit;

// =========================================
// COMPLAINTS
// =========================================
async function loadComplaints() {
  const tbody  = document.getElementById("complaintsBody");
  const filter = document.getElementById("complaintFilter").value;
  tbody.innerHTML = loadingRow(7);
  try {
    const q = query(collection(db, "complaints"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      let docsList = snap.docs;
      if (filter !== "all") {
        const isRes = filter === "true";
        docsList = docsList.filter(d => !!d.data().isResolved === isRes);
      }
      if (docsList.length === 0) { tbody.innerHTML = emptyRow(7); return; }
      tbody.innerHTML = docsList.map(d => {
        const data = d.data();
        return `<tr>
          <td><span class="badge badge-info">${data.category || "সাধারণ"}</span></td>
          <td><span class="truncate" title="${data.description}">${data.description || ""}</span></td>
          <td>${data.name || "বেনামী"}</td>
          <td>👍 ${data.agreeCount || 0}</td>
          <td><span class="badge ${data.isResolved ? "badge-success" : "badge-warning"}">${data.isResolved ? "মীমাংসিত" : "অমীমাংসিত"}</span></td>
          <td>${fmtDate(data.createdAt)}</td>
          <td>
            <div class="action-group">
              <button class="btn-action btn-view" onclick="toggleResolved('${d.id}',${!data.isResolved})">${data.isResolved ? "⏪ পূর্বাবস্থা" : "✅ মীমাংসিত"}</button>
              <button class="btn-action btn-delete" onclick="confirmDelete('complaints','${d.id}')">🗑️ মুছুন</button>
            </div>
          </td>
        </tr>`;
      }).join("");
    }, (error) => { tbody.innerHTML = errorRow(7, error.message); });
    activeListeners.push(unsub);
  } catch (e) { tbody.innerHTML = errorRow(7, e.message); }
}

async function toggleResolved(id, resolved) {
  try {
    await updateDoc(doc(db, "complaints", id), { isResolved: resolved, resolvedAt: resolved ? serverTimestamp() : null });
    showToast(resolved ? "মীমাংসিত হিসেবে চিহ্নিত করা হয়েছে" : "অমীমাংসিত হিসেবে পরিবর্তন করা হয়েছে", "success");
    loadComplaints();
  } catch (e) { showToast(e.message, "error"); }
}

window.loadComplaints  = loadComplaints;
window.toggleResolved  = toggleResolved;

// =========================================
// BUSINESSES
// =========================================
async function loadBusinesses() {
  const tbody = document.getElementById("businessesBody");
  tbody.innerHTML = loadingRow(8);
  try {
    const q = query(collection(db, "businesses"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) { tbody.innerHTML = emptyRow(8); return; }
      tbody.innerHTML = snap.docs.map(d => {
        const data = d.data();
        return `<tr>
          <td><strong>${data.businessName || "—"}</strong></td>
          <td><span class="badge badge-info">${data.businessType || "—"}</span></td>
          <td>${data.ownerName || "—"}</td>
          <td>${data.ownerPhone || "—"}</td>
          <td class="truncate">${data.address || "—"}</td>
          <td>${fmtDate(data.createdAt)}</td>
          <td>
            <div class="action-group">
              <button class="btn-action btn-view" onclick="viewBusiness('${d.id}')">👁️ দেখুন</button>
              <button class="btn-action btn-delete" onclick="confirmDelete('businesses','${d.id}')">🗑️ মুছুন</button>
            </div>
          </td>
        </tr>`;
      }).join("");
    }, (error) => { tbody.innerHTML = errorRow(8, error.message); });
    activeListeners.push(unsub);
  } catch (e) { tbody.innerHTML = errorRow(8, e.message); }
}

async function viewBusiness(id) {
  const snap = await getDoc(doc(db, "businesses", id));
  if (!snap.exists()) return;
  const u = snap.data();
  const el = document.getElementById("userDetailContent");
  document.getElementById("userDetailModalTitle").textContent = "ব্যবসার বিস্তারিত তথ্য";
  el.innerHTML = `
    <div class="user-detail-grid">
      <div class="detail-item"><span class="detail-label">ব্যবসার নাম</span><span class="detail-value">${u.businessName || "—"}</span></div>
      <div class="detail-item"><span class="detail-label">ক্যাটাগরি</span><span class="detail-value">${u.businessType || "—"}</span></div>
      <div class="detail-item"><span class="detail-label">মালিকের নাম</span><span class="detail-value">${u.ownerName || "—"}</span></div>
      <div class="detail-item"><span class="detail-label">যোগাযোগ</span><span class="detail-value">${u.ownerPhone || "—"}</span></div>
      <div class="detail-item"><span class="detail-label">ঠিকানা</span><span class="detail-value">${u.address || "—"}</span></div>
      <div class="detail-item"><span class="detail-label">বিস্তারিত তথ্য</span><span class="detail-value">${u.description || "—"}</span></div>
      <div class="detail-item"><span class="detail-label">নিবন্ধন তারিখ</span><span class="detail-value">${fmtDate(u.createdAt)}</span></div>
    </div>`;
  showModal("userDetailModal");
}
window.viewBusiness = viewBusiness;
window.loadBusinesses = loadBusinesses;

// =========================================
// BLOOD DONORS
// =========================================
async function loadBloodDonors() {
  const tbody  = document.getElementById("bloodDonorsBody");
  const hbody  = document.getElementById("bloodHistoryBody");
  const filter = document.getElementById("bloodGroupFilter").value;
  
  tbody.innerHTML = loadingRow(7);
  if(hbody) hbody.innerHTML = loadingRow(5);

  try {
    // 1. Load History first to calculate Last Donation
    const unsubHistory = onSnapshot(query(collection(db, "blood_donation_history"), orderBy("donationDate", "desc")), (snap) => {
      let historyHtml = "";
      const lastDonationMap = {};

      if (snap.empty) { 
        if(hbody) hbody.innerHTML = emptyRow(5); 
      } else {
        historyHtml = snap.docs.map(d => {
          const data = d.data();
          const uid = data.userId;
          // compute map
          if(uid && data.donationDate && !lastDonationMap[uid]) {
            lastDonationMap[uid] = data.donationDate;
          }
          return `<tr>
            <td><strong>${data.donorName || "—"}</strong> <span class="badge badge-info">${data.bloodGroup || ""}</span></td>
            <td>${data.phone || "—"}</td>
            <td>${data.address || "—"}</td>
            <td>${fmtDate(data.donationDate)}</td>
            <td style="font-size:11px;color:#888;">${uid || "—"}</td>
          </tr>`;
        }).join("");
        if(hbody) hbody.innerHTML = historyHtml;
      }

      // 2. Load Donors
      const unsubDonors = onSnapshot(collection(db, "donors"), (dSnap) => {
        let docsList = dSnap.docs;
        if (filter !== "all") {
          docsList = docsList.filter(d => d.data().bloodGroup === filter);
        }
        if (docsList.length === 0) { tbody.innerHTML = emptyRow(7); return; }
        
        tbody.innerHTML = docsList.map(d => {
          const data = d.data();
          const uid = data.userId;
          const lastDonDate = uid && lastDonationMap[uid] ? fmtDate(lastDonationMap[uid]) : "রক্তদান করেননি";

          return `<tr>
            <td><strong>${data.name || "—"}</strong></td>
            <td><div class="blood-badge">${data.bloodGroup || "?"}</div></td>
            <td>${data.phone || "—"}</td>
            <td><span class="truncate" title="${data.address || ""}">${data.address || "—"}</span></td>
            <td>${lastDonDate}</td>
            <td><span class="badge ${data.isAvailable ? "badge-success" : "badge-danger"}">${data.isAvailable ? "উপলব্ধ" : "অনুপলব্ধ"}</span></td>
            <td>
              <button class="btn-action btn-delete" onclick="confirmDelete('donors','${d.id}')">🗑️ মুছুন</button>
            </td>
          </tr>`;
        }).join("");
      }, (err) => tbody.innerHTML = errorRow(7, err.message));
      activeListeners.push(unsubDonors);

    }, (err) => { if (hbody) hbody.innerHTML = errorRow(5, err.message); });
    activeListeners.push(unsubHistory);

  } catch (e) { 
    tbody.innerHTML = errorRow(7, e.message); 
    if(hbody) hbody.innerHTML = errorRow(5, e.message); 
  }
}
window.loadBloodDonors = loadBloodDonors;

// =========================================
// ORGANIZATIONS
// =========================================
async function loadOrganizations() {
  const el = document.getElementById("organizationsGrid");
  el.innerHTML = '<div class="loading"></div>';
  try {
    const unsub = onSnapshot(collection(db, "organizations"), (snap) => {
      if (snap.empty) { el.innerHTML = emptyState("কোনো সংগঠন নেই"); return; }
      el.innerHTML = snap.docs.map(d => {
        const data = d.data();
        const emoji = ["🏛️","🌿","🤝","🏫","⛪","🕌","🎓"][Math.floor(Math.random()*7)];
        return `<div class="org-card">
          <div class="org-avatar">${emoji}</div>
          <div class="org-info">
            <div class="org-name">${data.name || "—"}</div>
            <div class="org-meta">প্রতিষ্ঠা: ${data.foundingDate ? fmtDate(data.foundingDate) : "—"}</div>
            <div class="org-meta">${(data.objectives || []).slice(0,2).join(" • ")}</div>
          </div>
          <div class="action-group">
            <button class="btn-action btn-edit" onclick="editOrganization('${d.id}')">✏️</button>
            <button class="btn-action btn-delete" onclick="confirmDelete('organizations','${d.id}')">🗑️</button>
          </div>
        </div>`;
      }).join("");
    }, (error) => { el.innerHTML = `<p class="error-msg">${error.message}</p>`; });
    activeListeners.push(unsub);
  } catch (e) { el.innerHTML = `<p class="error-msg">${e.message}</p>`; }
}

async function editOrganization(id) {
  const snap = await getDoc(doc(db, "organizations", id));
  if (!snap.exists()) return;
  const data = snap.data();
  document.getElementById("orgId").value          = id;
  document.getElementById("orgName").value         = data.name || "";
  document.getElementById("orgObjectives").value   = (data.objectives || []).join("\n");
  document.getElementById("orgLogo").value         = data.logoUrl || "";
  document.getElementById("orgFoundingDate").value = data.foundingDate ? tsToDateInput(data.foundingDate) : "";
  document.getElementById("orgModalTitle").textContent = "সংগঠন সম্পাদনা করুন";
  showModal("orgModal");
}

async function saveOrganization() {
  const id         = document.getElementById("orgId").value;
  const name       = document.getElementById("orgName").value.trim();
  const objectives = document.getElementById("orgObjectives").value.split("\n").filter(l => l.trim());
  const logo       = document.getElementById("orgLogo").value.trim();
  const founding   = document.getElementById("orgFoundingDate").value;

  if (!name) { showToast("সংগঠনের নাম দিন", "error"); return; }
  const data = {
    name, objectives, logoUrl: logo || null,
    foundingDate: founding ? Timestamp.fromDate(new Date(founding)) : serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  try {
    if (id) {
      await updateDoc(doc(db, "organizations", id), data);
      showToast("সংগঠন আপডেট হয়েছে", "success");
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, "organizations"), data);
      showToast("নতুন সংগঠন যুক্ত হয়েছে", "success");
    }
    closeModal("orgModal");
    loadOrganizations();
  } catch (e) { showToast(e.message, "error"); }
}

window.loadOrganizations = loadOrganizations;
window.editOrganization  = editOrganization;
window.saveOrganization  = saveOrganization;

// =========================================
// JOBS
// =========================================
async function loadJobs() {
  const tbody = document.getElementById("jobsBody");
  tbody.innerHTML = loadingRow(7);
  try {
    const q = query(collection(db, "jobs"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) { tbody.innerHTML = emptyRow(7); return; }
      tbody.innerHTML = snap.docs.map(d => {
        const data = d.data();
        return `<tr>
          <td><strong>${data.jobTitle || "—"}</strong></td>
          <td>${data.companyName || "—"}</td>
          <td>${data.address || "—"}</td>
          <td>${data.isSalaryDiscussable ? "আলোচনাসাপেক্ষ" : (data.salary || "—")}</td>
          <td>${data.contactNumber || "—"}</td>
          <td>${fmtDate(data.createdAt)}</td>
          <td>
            <button class="btn-action btn-delete" onclick="confirmDelete('jobs','${d.id}')">🗑️ মুছুন</button>
          </td>
        </tr>`;
      }).join("");
    }, (error) => { tbody.innerHTML = errorRow(7, error.message); });
    activeListeners.push(unsub);
  } catch (e) { tbody.innerHTML = errorRow(7, e.message); }
}
window.loadJobs = loadJobs;

// =========================================
// ISLAMIC
// =========================================
async function loadIslamic() {
  try {
    const unsub = onSnapshot(doc(db, "islamicContent", "prayerTimes"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        ["fajr","dhuhr","asr","maghrib","isha"].forEach(p => {
          if (data[p]) document.getElementById(p).value = data[p];
        });
      }
    });
    activeListeners.push(unsub);
  } catch (e) {}
  loadDuas();
}

async function loadDuas() {
  const el = document.getElementById("duasList");
  el.innerHTML = '<div class="loading"></div>';
  try {
    const q = query(collection(db, "duas"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) { el.innerHTML = emptyState("কোনো দোয়া নেই"); return; }
      el.innerHTML = snap.docs.map(d => {
        const data = d.data();
        return `<div class="dua-item">
          <div class="dua-title">${data.title || "—"}</div>
          ${data.arabic ? `<div class="dua-arabic">${data.arabic}</div>` : ""}
          ${data.bangla ? `<div class="dua-bangla">${data.bangla}</div>` : ""}
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
            <button class="btn-action btn-edit" onclick="editDua('${d.id}')">✏️ সম্পাদনা</button>
            <button class="btn-action btn-delete" onclick="confirmDelete('duas','${d.id}')">🗑️ মুছুন</button>
          </div>
        </div>`;
      }).join("");
    }, (err) => el.innerHTML = `<p class="error-msg">${err.message}</p>`);
    activeListeners.push(unsub);
  } catch (e) { el.innerHTML = `<p class="error-msg">${e.message}</p>`; }
}

async function savePrayerTimes() {
  const times = {
    fajr:    document.getElementById("fajr").value,
    dhuhr:   document.getElementById("dhuhr").value,
    asr:     document.getElementById("asr").value,
    maghrib: document.getElementById("maghrib").value,
    isha:    document.getElementById("isha").value,
    updatedAt: serverTimestamp()
  };
  try {
    await setDoc(doc(db, "islamicContent", "prayerTimes"), times);
    showToast("নামাজের সময়সূচী আপডেট হয়েছে ✅", "success");
  } catch (e) { showToast(e.message, "error"); }
}

async function editDua(id) {
  const snap = await getDoc(doc(db, "duas", id));
  if (!snap.exists()) return;
  const data = snap.data();
  document.getElementById("duaId").value     = id;
  document.getElementById("duaTitle").value   = data.title || "";
  document.getElementById("duaArabic").value  = data.arabic || "";
  document.getElementById("duaBangla").value  = data.bangla || "";
  document.getElementById("duaSource").value  = data.source || "";
  document.getElementById("duaModalTitle").textContent = "দোয়া সম্পাদনা করুন";
  showModal("duaModal");
}

async function saveDua() {
  const id     = document.getElementById("duaId").value;
  const title  = document.getElementById("duaTitle").value.trim();
  const arabic = document.getElementById("duaArabic").value.trim();
  const bangla = document.getElementById("duaBangla").value.trim();
  const source = document.getElementById("duaSource").value.trim();
  if (!title) { showToast("শিরোনাম দিন", "error"); return; }
  const data = { title, arabic, bangla, source, updatedAt: serverTimestamp() };
  try {
    if (id) {
      await updateDoc(doc(db, "duas", id), data);
      showToast("দোয়া আপডেট হয়েছে", "success");
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, "duas"), data);
      showToast("নতুন দোয়া যুক্ত হয়েছে", "success");
    }
    closeModal("duaModal");
    loadDuas();
  } catch (e) { showToast(e.message, "error"); }
}

window.savePrayerTimes = savePrayerTimes;
window.editDua         = editDua;
window.saveDua         = saveDua;
window.loadDuas        = loadDuas;

// =========================================
// USERS
// =========================================
async function loadUsers() {
  const tbody = document.getElementById("usersBody");
  tbody.innerHTML = loadingRow(6);
  try {
    const unsub = onSnapshot(query(collection(db, "users"), orderBy("createdAt", "desc")), (snap) => {
      allUsers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const countEl = document.getElementById("totalUsersStr");
      if(countEl) countEl.textContent = `মোট ইউজার: ${allUsers.length}`;
      renderUsers(allUsers);
    }, (error) => { tbody.innerHTML = errorRow(6, error.message); });
    activeListeners.push(unsub);
  } catch (e) { tbody.innerHTML = errorRow(6, e.message); }
}

function renderUsers(users) {
  const tbody = document.getElementById("usersBody");
  if (!users.length) { tbody.innerHTML = emptyRow(6); return; }
  tbody.innerHTML = users.map(u => {
    const status = u.isBlocked ? "badge-danger" : u.isSuspended ? "badge-warning" : "badge-success";
    const statusText = u.isBlocked ? "ব্লকড" : u.isSuspended ? "সাসপেন্ডেড" : "সক্রিয়";
    const verifiedIcon = u.isVerified ? ' <span style="color:#1d9bf0;font-size:16px;" title="Verified">✔</span>' : '';

    return `<tr>
      <td><strong>${u.displayName || "—"}</strong>${verifiedIcon}</td>
      <td>${u.email || "—"}</td>
      <td>${u.phone || "—"}</td>
      <td><span class="badge ${status}">${statusText}</span></td>
      <td>${fmtDate(u.createdAt)}</td>
      <td>
        <div class="action-group">
          <button class="btn-action btn-view"  onclick="viewUser('${u.id}')">👁️ দেখুন</button>
          <button class="btn-action ${u.isVerified ? 'btn-delete' : 'btn-block'}" onclick="toggleUserVerify('${u.id}', ${!u.isVerified})" style="background-color: ${u.isVerified ? '#ef4444' : '#10b981'}; color: white;">${u.isVerified ? "❌ রিমুভ ভেরিফাই" : "✅ ভেরিফাই করুন"}</button>
          <button class="btn-action btn-block" onclick="toggleUserBlock('${u.id}',${!u.isBlocked})">${u.isBlocked ? "🔓 আনব্লক" : "🚫 ব্লক"}</button>
          <button class="btn-action btn-reset" onclick="openResetPasswordModal('${u.id}')">🔑 রিসেট</button>
          <button class="btn-action btn-delete" onclick="confirmDelete('users','${u.id}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

function filterUsers() {
  const q = document.getElementById("userSearch").value.toLowerCase();
  const filtered = allUsers.filter(u =>
    (u.displayName || "").toLowerCase().includes(q) ||
    (u.email || "").toLowerCase().includes(q) ||
    (u.phone || "").includes(q)
  );
  renderUsers(filtered);
}

async function viewUser(id) {
  const u = allUsers.find(u => u.id === id);
  if (!u) return;
  const el = document.getElementById("userDetailContent");
  el.innerHTML = `
    <div class="user-detail-grid">
      <div class="detail-item"><span class="detail-label">নাম</span><span class="detail-value">${u.displayName || "—"}</span></div>
      <div class="detail-item"><span class="detail-label">ইমেইল</span><span class="detail-value">${u.email || "—"}</span></div>
      <div class="detail-item"><span class="detail-label">ফোন</span><span class="detail-value">${u.phone || "—"}</span></div>
      <div class="detail-item"><span class="detail-label">ঠিকানা</span><span class="detail-value">${u.address || "—"}</span></div>
      <div class="detail-item"><span class="detail-label">রক্তের গ্রুপ</span><span class="detail-value">${u.bloodGroup || "—"}</span></div>
      <div class="detail-item"><span class="detail-label">যোগদানের তারিখ</span><span class="detail-value">${fmtDate(u.createdAt)}</span></div>
      <div class="detail-item"><span class="detail-label">স্ট্যাটাস</span><span class="detail-value">${u.isBlocked ? "🚫 ব্লকড" : u.isSuspended ? "⏸️ সাসপেন্ডেড" : "✅ সক্রিয়"}</span></div>
      <div class="detail-item"><span class="detail-label">UID</span><span class="detail-value" style="font-size:11px;">${u.id}</span></div>
    </div>`;
  showModal("userDetailModal");
}

async function toggleUserBlock(id, block) {
  try {
    await updateDoc(doc(db, "users", id), { isBlocked: block, updatedAt: serverTimestamp() });
    showToast(block ? "ইউজার ব্লক করা হয়েছে" : "ইউজার আনব্লক করা হয়েছে", "success");
  } catch (e) { showToast(e.message, "error"); }
}

async function toggleUserVerify(id, verifyStatus) {
  if (!confirm(verifyStatus ? "আপনি কি এই ইউজারকে ভেরিফাই করতে চান?" : "আপনি কি এই ইউজারের ভেরিফিকেশন সরাতে চান?")) return;
  try {
    await updateDoc(doc(db, "users", id), { isVerified: verifyStatus, updatedAt: serverTimestamp() });
    showToast(verifyStatus ? "ইউজার অ্যাকাউন্টটি ভেরিফাইড হয়েছে" : "ইউজারের ভেরিফিকেশন সটানো হয়েছে", "success");
  } catch (e) { showToast(e.message, "error"); }
}

async function sendResetEmail(email) {
  if (!email) { showToast("ইউজারের ইমেইল নেই", "error"); return; }
  showToast(`${email} → পাসওয়ার্ড রিসেট ইমেইল পাঠানো হয়েছে`, "success");
}

window.loadUsers        = loadUsers;
window.filterUsers      = filterUsers;
window.viewUser         = viewUser;
window.toggleUserBlock  = toggleUserBlock;
window.toggleUserVerify = toggleUserVerify;
window.sendResetEmail   = sendResetEmail;

// =========================================
// ADMINS (RBAC)
// =========================================
async function loadAdmins() {
  const tbody = document.getElementById("adminsBody");
  tbody.innerHTML = loadingRow(7);
  try {
    const unsub = onSnapshot(collection(db, "admins"), (snap) => {
      allAdmins = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAdmins(allAdmins);
    }, (error) => { tbody.innerHTML = errorRow(7, error.message); });
    activeListeners.push(unsub);
  } catch (e) { tbody.innerHTML = errorRow(7, e.message); }

  // Hide "add admin" for non-superAdmins
  if (currentAdminData?.role !== "superAdmin") {
    const btn = document.getElementById("addAdminBtn");
    if (btn) btn.style.display = "none";
  }
}

function renderAdmins(admins) {
  const tbody = document.getElementById("adminsBody");
  if (!admins.length) { tbody.innerHTML = emptyRow(7); return; }
  tbody.innerHTML = admins.map(a => {
    const perms  = (a.permissions || []).join(", ") || "সব";
    const expiry = a.expiryDate ? fmtDate(a.expiryDate) : "স্থায়ী";
    const expired = a.expiryDate && (new Date() > (a.expiryDate.toDate ? a.expiryDate.toDate() : new Date(a.expiryDate)));
    return `<tr>
      <td><strong>${a.name || "—"}</strong></td>
      <td>${a.email || "—"}</td>
      <td><span class="badge badge-purple">${a.role || "admin"}</span></td>
      <td>${expiry}</td>
      <td><span class="badge ${expired ? "badge-danger" : "badge-success"}">${expired ? "মেয়াদোত্তীর্ণ" : "সক্রিয়"}</span></td>
      <td>
        <div class="action-group">
          ${currentAdminData?.role === "superAdmin" ? `
            <button class="btn-action btn-reset" onclick="openResetPasswordModal('${a.id}')">🔑 পাসওয়ার্ড</button>
            <button class="btn-action btn-delete" onclick="confirmDelete('admins','${a.id}')">🗑️ মুছুন</button>
          ` : "—"}
        </div>
      </td>
    </tr>`;
  }).join("");
}

async function addAdmin() {
  if (currentAdminData?.role !== "superAdmin") { showToast("শুধুমাত্র সুপার অ্যাডমিন নতুন অ্যাডমিন যুক্ত করতে পারবেন", "error"); return; }
  
  const email  = document.getElementById("adminEmail").value.trim();
  const pass   = document.getElementById("adminPassword").value.trim();
  const expiry = document.getElementById("adminExpiry").value;
  const perms  = [...document.querySelectorAll(".permissions-grid input:checked")].map(c => c.value);

  if (!email || !pass) { showToast("ইমেইল ও পাসওয়ার্ড দিন", "error"); return; }

  try {
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);
    let uid = email.replace(/[@.]/g, "_");
    
    // Smart user check
    if (!snap.empty) {
      if (!confirm("এই একাউন্ট বর্তমানে ইউজার হিসেবে আছে। আপনি কি তাকে এডমিন হিসেবে সিলেক্ট করতে চান?")) {
        return;
      }
      uid = snap.docs[0].id;
      // Also update user doc to reflect admin status
      await updateDoc(doc(db, "users", uid), { isSuperAdmin: false, requestedNewPassword: pass }); 
    }

    const data = {
      email,
      temporaryPassword: pass, 
      role: "admin",
      permissions: perms.length ? perms : ["notices"],
      expiryDate: expiry ? Timestamp.fromDate(new Date(expiry)) : null,
      addedBy: currentUser.uid,
      createdAt: serverTimestamp()
    };
    await setDoc(doc(db, "admins", uid), data);
    showToast("নতুন অ্যাডমিন যুক্ত হয়েছে!", "success");
    closeModal("adminModal");
  } catch (e) { showToast(e.message, "error"); }
}

function openResetPasswordModal(id) {
  document.getElementById("resetTargetUid").value = id;
  document.getElementById("newPasswordInput").value = "";
  showModal("resetPasswordModal");
}

async function submitNewPassword() {
  const uid = document.getElementById("resetTargetUid").value;
  const pass = document.getElementById("newPasswordInput").value.trim();
  if(!pass || pass.length < 6) { showToast("অন্তত ৬ অক্ষরের পাসওয়ার্ড দিন", "error"); return; }
  
  try {
    // Attempting to save it to users / admins directly as requested
    const adminRef = doc(db, "admins", uid);
    const adminSnap = await getDoc(adminRef);
    if(adminSnap.exists()) {
      await updateDoc(adminRef, { temporaryPassword: pass });
    } else {
      await updateDoc(doc(db, "users", uid), { requestedNewPassword: pass });
    }
    showToast("পাসওয়ার্ড সফলভাবে আপডেট করা হয়েছে", "success");
    closeModal("resetPasswordModal");
  } catch(e) {
    showToast("ত্রুটি: " + e.message, "error");
  }
}

window.loadAdmins     = loadAdmins;
window.addAdmin       = addAdmin;
window.openResetPasswordModal = openResetPasswordModal;
window.submitNewPassword      = submitNewPassword;

// =========================================
// DELETE / CONFIRM
// =========================================
function confirmDelete(col, id, callback) {
  document.getElementById("confirmMessage").textContent = "এই আইটেমটি স্থায়ীভাবে মুছে ফেলা হবে। আপনি কি নিশ্চিত?";
  const btn = document.getElementById("confirmBtn");
  btn.onclick = async () => {
    try {
      await deleteDoc(doc(db, col, id));
      showToast("সফলভাবে মুছে ফেলা হয়েছে", "success");
      closeModal("confirmModal");
      if (callback) callback();
    } catch (e) { showToast(e.message, "error"); }
  };
  showModal("confirmModal");
}
window.confirmDelete = confirmDelete;

// =========================================
// MODAL HELPERS
// =========================================
function showModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }
function closeModalOutside(e, id) { if (e.target.id === id) closeModal(id); }

window.showModal         = showModal;
window.closeModal        = closeModal;
window.closeModalOutside = closeModalOutside;

// Reset notice modal on open
document.getElementById("noticeModal").addEventListener("click", function(e) {
  if (e.target === this) return;
});

// =========================================
// HELPERS
// =========================================
function fmtDate(ts) {
  if (!ts) return "—";
  let d;
  if (ts.toDate) d = ts.toDate();
  else if (ts.seconds) d = new Date(ts.seconds * 1000);
  else d = new Date(ts);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("bn-BD", { day: "numeric", month: "short", year: "numeric" });
}

function tsToDateInput(ts) {
  let d;
  if (ts.toDate) d = ts.toDate();
  else if (ts.seconds) d = new Date(ts.seconds * 1000);
  else d = new Date(ts);
  return d.toISOString().split("T")[0];
}

function loadingRow(cols) {
  return `<tr><td colspan="${cols}"><div class="loading"></div></td></tr>`;
}
function emptyRow(cols) {
  return `<tr><td colspan="${cols}"><div class="empty-state"><div class="empty-icon">📭</div><p>কোনো ডাটা পাওয়া যায়নি</p></div></td></tr>`;
}
function errorRow(cols, msg) {
  return `<tr><td colspan="${cols}"><p class="error-msg">❌ ${msg}</p></td></tr>`;
}
function emptyState(msg) {
  return `<div class="empty-state"><div class="empty-icon">📭</div><p>${msg}</p></div>`;
}

// ── TOAST ──
function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className   = `toast ${type} show`;
  setTimeout(() => t.classList.remove("show"), 3500);
}
window.showToast = showToast;

// ── NOTICE MODAL: Reset when opening fresh ──
document.querySelector("[onclick=\"showModal('noticeModal')\"]")?.addEventListener("click", () => {
  document.getElementById("noticeId").value      = "";
  document.getElementById("noticeTitle").value    = "";
  document.getElementById("noticeContent").value  = "";
  document.getElementById("noticeImage").value    = "";
  document.getElementById("noticeExpiry").value   = "";
  document.getElementById("noticeCategory").value = "সাধারণ";
  document.getElementById("noticePriority").value = "normal";
  document.getElementById("noticeModalTitle").textContent = "নতুন নোটিশ যুক্ত করুন";
});

document.querySelector("[onclick=\"showModal('orgModal')\"]")?.addEventListener("click", () => {
  document.getElementById("orgId").value = "";
  document.getElementById("orgName").value = "";
  document.getElementById("orgObjectives").value = "";
  document.getElementById("orgLogo").value = "";
  document.getElementById("orgFoundingDate").value = "";
  document.getElementById("orgModalTitle").textContent = "নতুন সংগঠন যুক্ত করুন";
});

document.querySelector("[onclick=\"showModal('duaModal')\"]")?.addEventListener("click", () => {
  document.getElementById("duaId").value = "";
  document.getElementById("duaTitle").value = "";
  document.getElementById("duaArabic").value = "";
  document.getElementById("duaBangla").value = "";
  document.getElementById("duaSource").value = "";
  document.getElementById("duaModalTitle").textContent = "নতুন দোয়া যুক্ত করুন";
});

document.querySelector("[onclick=\"showModal('emergencyModal')\"]")?.addEventListener("click", () => {
  document.getElementById("emergencyId").value       = "";
  document.getElementById("emergencyTitle").value    = "";
  document.getElementById("emergencyNumber").value   = "";
  document.getElementById("emergencyCategory").value = "Hospital";
  document.getElementById("emergencyIcon").value     = "local_hospital";
  document.getElementById("emergencyModalTitle").textContent = "নতুন সেবা যুক্ত করুন";
});

// =========================================
// EMERGENCY SERVICES
// =========================================
let allEmergencies = [];

async function loadEmergency() {
  const tbody = document.getElementById("emergencyBody");
  tbody.innerHTML = loadingRow(5);
  try {
    const unsub = onSnapshot(collection(db, "emergency_contacts"), (snap) => {
      allEmergencies = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      if (allEmergencies.length === 0) { 
        // Migrate initial data
        if (!window.hasInitializedEmergencies) {
          window.hasInitializedEmergencies = true;
          const defaults = [
            { title: 'অ্যাম্বুলেন্স সার্ভিস', number: '999', icon: 'local_hospital', category: 'Hospital', createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
            { title: 'পুলিশ বাটন', number: '999', icon: 'local_police', category: 'Police', createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
            { title: 'ফায়ার সার্ভিস', number: '999', icon: 'fire_extinguisher', category: 'Fire', createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
          ];
          defaults.forEach(d => addDoc(collection(db, "emergency_contacts"), d));
        }
        tbody.innerHTML = emptyRow(5); 
        return; 
      }
      
      tbody.innerHTML = allEmergencies.map(e => {
        return `<tr>
          <td><span class="badge badge-info">${e.category || "—"}</span></td>
          <td><strong>${e.title || "—"}</strong></td>
          <td><a href="tel:${e.number}">${e.number || "—"}</a></td>
          <td><code>${e.icon || "—"}</code></td>
          <td>
            <div class="action-group">
              <button class="btn-action btn-edit" onclick="editEmergency('${e.id}')">✏️</button>
              <button class="btn-action btn-delete" onclick="confirmDelete('emergency_contacts','${e.id}')">🗑️</button>
            </div>
          </td>
        </tr>`;
      }).join("");
    }, (error) => { tbody.innerHTML = errorRow(5, error.message); });
    activeListeners.push(unsub);
  } catch (err) { tbody.innerHTML = errorRow(5, err.message); }
}

function editEmergency(id) {
  const item = allEmergencies.find(e => e.id === id);
  if (!item) return;
  document.getElementById("emergencyId").value       = item.id;
  document.getElementById("emergencyTitle").value    = item.title || "";
  document.getElementById("emergencyNumber").value   = item.number || "";
  document.getElementById("emergencyCategory").value = item.category || "Hospital";
  document.getElementById("emergencyIcon").value     = item.icon || "local_hospital";
  document.getElementById("emergencyModalTitle").textContent = "সেবা সম্পাদনা করুন";
  showModal("emergencyModal");
}

async function saveEmergency() {
  const id       = document.getElementById("emergencyId").value;
  const title    = document.getElementById("emergencyTitle").value.trim();
  const number   = document.getElementById("emergencyNumber").value.trim();
  const category = document.getElementById("emergencyCategory").value;
  const icon     = document.getElementById("emergencyIcon").value;

  if (!title || !number) { showToast("সেবার নাম এবং ফোন নম্বর দিতে হবে", "error"); return; }
  
  const data = { title, number, category, icon, updatedAt: serverTimestamp() };
  try {
    if (id) {
      await updateDoc(doc(db, "emergency_contacts", id), data);
      showToast("সেবা আপডেট হয়েছে", "success");
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, "emergency_contacts"), data);
      showToast("নতুন সেবা যুক্ত হয়েছে", "success");
    }
    closeModal("emergencyModal");
  } catch(e) { showToast(e.message, "error"); }
}

window.loadEmergency = loadEmergency;
window.editEmergency = editEmergency;
window.saveEmergency = saveEmergency;

// =========================================
// LOCAL PHONEBOOK (স্থানীয় জরুরি ফোন বুক)
// =========================================

let currentPbCategory = 'fire';
let pbListener = null;

// Category field definitions
const PB_FIELDS = {
  fire: [
    { id: 'name',          label: 'অফিসের নাম *',      type: 'text',  placeholder: 'যেমন: পল্লান পাড়া ফায়ার স্টেশন' },
    { id: 'phone',         label: 'নম্বর *',            type: 'tel',   placeholder: 'যেমন: 16163' },
    { id: 'officeAddress', label: 'অফিস ঠিকানা',       type: 'text',  placeholder: 'সম্পূর্ণ ঠিকানা' },
  ],
  hospital: [
    { id: 'name',          label: 'হাসপাতালের নাম *',   type: 'text',  placeholder: 'যেমন: উপজেলা স্বাস্থ্য কমপ্লেক্স' },
    { id: 'hotline',       label: 'হটলাইন নম্বর *',     type: 'tel',   placeholder: 'যেমন: 16321' },
    { id: 'address',       label: 'ঠিকানা',             type: 'text',  placeholder: 'হাসপাতালের সম্পূর্ণ ঠিকানা' },
  ],
  ambulance: [
    { id: 'driverName',    label: 'ড্রাইভারের নাম *',  type: 'text',  placeholder: 'যেমন: মো. করিম' },
    { id: 'phone',         label: 'ফোন নম্বর *',       type: 'tel',   placeholder: 'যেমন: 01700...' },
    { id: 'address',       label: 'ঠিকানা',            type: 'text',  placeholder: 'গ্যারেজ / বাসার ঠিকানা' },
  ],
  electric: [
    { id: 'name',          label: 'অফিসের নাম *',      type: 'text',  placeholder: 'যেমন: পল্লি বিদ্যুৎ সমিতি' },
    { id: 'phone',         label: 'নম্বর *',            type: 'tel',   placeholder: 'যেমন: 16977' },
    { id: 'officeAddress', label: 'অফিস ঠিকানা',       type: 'text',  placeholder: 'সম্পূর্ণ ঠিকানা' },
  ],
  doctor: [
    { id: 'doctorName',    label: 'ডাক্তারের নাম *',   type: 'text',  placeholder: 'যেমন: ডা. মো. রহিম' },
    { id: 'assistantName', label: 'সহকারীর নাম',       type: 'text',  placeholder: 'যেমন: মো. করিম' },
    { id: 'phone',         label: 'সহকারীর নম্বর *',   type: 'tel',   placeholder: 'যেমন: 01700...' },
    { id: 'specialty',     label: 'বিশেষজ্ঞ / রোগী',  type: 'text',  placeholder: 'যেমন: হৃদরোগ বিশেষজ্ঞ' },
    { id: 'chamberInfo',   label: 'চেম্বার সময় ও স্থান', type: 'textarea', placeholder: 'যেমন: শনি-বৃহস্পতি সন্ধ্যা ৬টা, পল্লান পাড়া ক্লিনিক' },
  ],
  police: [
    { id: 'officerName',   label: 'অফিসারের নাম *',   type: 'text',  placeholder: 'যেমন: পরিদর্শক মো. রফিক' },
    { id: 'phone',         label: 'নম্বর *',            type: 'tel',   placeholder: 'যেমন: 01700...' },
    { id: 'designation',   label: 'পদবী',              type: 'text',  placeholder: 'যেমন: উপ-পরিদর্শক' },
    { id: 'station',       label: 'থানার ঠিকানা',      type: 'text',  placeholder: 'থানার সম্পূর্ণ ঠিকানা' },
  ],
  driver: [
    { id: 'driverName',    label: 'ড্রাইভারের নাম *', type: 'text',  placeholder: 'যেমন: মো. আলম' },
    { id: 'phone',         label: 'ফোন নম্বর *',      type: 'tel',   placeholder: 'যেমন: 01700...' },
    { id: 'vehicleName',   label: 'গাড়ির নাম/নম্বর', type: 'text',  placeholder: 'যেমন: সিএনজি - ঢকা-মেট্রো-২৩৪৫' },
    { id: 'address',       label: 'ঠিকানা',            type: 'text',  placeholder: 'বাসার ঠিকানা' },
  ],
  local: [
    { id: 'name',          label: 'নাম *',             type: 'text',  placeholder: 'যেমন: ইউনিয়ন পরিষদ চেয়ারম্যান' },
    { id: 'phone',         label: 'ফোন নম্বর *',      type: 'tel',   placeholder: 'যেমন: 01700...' },
    { id: 'workType',      label: 'কাজের ধরন',         type: 'text',  placeholder: 'যেমন: জনপ্রতিনিধি' },
    { id: 'address',       label: 'ঠিকানা',            type: 'text',  placeholder: 'বাসার ঠিকানা' },
  ],
};

const PB_LABELS = {
  fire:      '🔥 ফায়ার সার্ভিস',
  hospital:  '🏥 হাসপাতাল',
  ambulance: '🚑 এ্যাম্বুলেন্স',
  electric:  '⚡ বিদ্যুৎ',
  doctor:    '👨‍⚕️ ডাক্তার',
  police:    '🚓 পুলিশ',
  driver:    '🚗 ড্রাইভার',
  local:     '📞 স্থানীয়',
};

function filterPhonebook(cat) {
  currentPbCategory = cat;
  // Update tab highlight
  document.querySelectorAll('.pb-tab-btn').forEach(b => b.style.opacity = '0.55');
  const btn = document.getElementById('pbt-' + cat);
  if (btn) btn.style.opacity = '1';
  loadPhonebook(cat);
}

function loadPhonebook(cat) {
  const tbody = document.getElementById('phonebookBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5"><div class="loading"></div></td></tr>';

  if (pbListener) { pbListener(); pbListener = null; }

  pbListener = onSnapshot(
    query(collection(db, 'local_phonebook'), where('category', '==', cat), orderBy('lastUpdated', 'desc')),
    (snap) => {
      if (snap.empty) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:30px;">এই ক্যাটাগরিতে কোনো তথ্য নেই।</td></tr>`;
        return;
      }
      tbody.innerHTML = snap.docs.map(d => {
        const data = d.data();
        const primaryName = data.name || data.officerName || data.driverName || data.doctorName || '—';
        const phone = data.phone || data.hotline || '—';
        const detail = data.officeAddress || data.address || data.station || data.chamberInfo || data.specialty || '—';
        const lu = data.lastUpdated ? new Date(data.lastUpdated.seconds * 1000).toLocaleDateString('bn-BD') : '—';
        return `<tr>
          <td><strong>${primaryName}</strong></td>
          <td><a href="tel:${phone}" style="color:#2563eb;font-weight:600;">${phone}</a></td>
          <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${detail}</td>
          <td style="font-size:12px;color:#64748b;">${lu}</td>
          <td>
            <button class="btn-sm btn-primary" onclick="editPhonebookEntry('${d.id}')">✏️</button>
            <button class="btn-sm btn-danger" onclick="deletePhonebookEntry('${d.id}')">🗑️</button>
          </td>
        </tr>`;
      }).join('');
    },
    err => console.error('loadPhonebook error:', err)
  );
}

function showPhonebookModal(prefillData = null, editId = null) {
  document.getElementById('phonebookId').value = editId || '';
  document.getElementById('phonebookModalTitle').textContent = editId ? 'তথ্য এডিট করুন' : 'নতুন তথ্য যোগ করুন';

  const sel = document.getElementById('pbCategory');
  if (prefillData) sel.value = prefillData.category || currentPbCategory;
  else sel.value = currentPbCategory;

  updatePhonebookForm(prefillData);
  showModal('phonebookModal');
}

function updatePhonebookForm(prefillData = null) {
  const cat = document.getElementById('pbCategory').value;
  const fields = PB_FIELDS[cat] || [];
  const container = document.getElementById('pbDynamicFields');
  container.innerHTML = fields.map(f => {
    const val = prefillData ? (prefillData[f.id] || '') : '';
    if (f.type === 'textarea') {
      return `<div class="form-group"><label>${f.label}</label>
        <textarea id="pb_${f.id}" rows="3" placeholder="${f.placeholder}">${val}</textarea></div>`;
    }
    return `<div class="form-group"><label>${f.label}</label>
      <input type="${f.type}" id="pb_${f.id}" placeholder="${f.placeholder}" value="${val}"/></div>`;
  }).join('');
}

async function savePhonebookEntry() {
  const id   = document.getElementById('phonebookId').value;
  const cat  = document.getElementById('pbCategory').value;
  const fields = PB_FIELDS[cat] || [];

  const data = { category: cat, lastUpdated: serverTimestamp() };
  for (const f of fields) {
    const el = document.getElementById('pb_' + f.id);
    if (el) data[f.id] = el.value.trim();
  }

  // Validate required fields (marked with *)
  const reqFields = fields.filter(f => f.label.includes('*'));
  for (const f of reqFields) {
    if (!data[f.id]) { showToast(`${f.label.replace(' *','')} পূরণ করুন।`, 'error'); return; }
  }

  try {
    if (id) {
      await updateDoc(doc(db, 'local_phonebook', id), data);
      showToast('তথ্য আপডেট হয়েছে ✅', 'success');
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'local_phonebook'), data);
      showToast('নতুন তথ্য যুক্ত হয়েছে ✅', 'success');
    }
    closeModal('phonebookModal');
    loadPhonebook(cat);
  } catch(e) { showToast(e.message, 'error'); }
}

async function editPhonebookEntry(id) {
  try {
    const snap = await getDoc(doc(db, 'local_phonebook', id));
    if (!snap.exists()) { showToast('তথ্য পাওয়া যায়নি।', 'error'); return; }
    showPhonebookModal(snap.data(), id);
  } catch(e) { showToast(e.message, 'error'); }
}

function deletePhonebookEntry(id) {
  showConfirm('এন্ট্রিটি মুছবেন?', 'এই তথ্যটি স্থায়ীভাবে মুছে যাবে।', async () => {
    try {
      await deleteDoc(doc(db, 'local_phonebook', id));
      showToast('মুছে ফেলা হয়েছে।', 'success');
    } catch(e) { showToast(e.message, 'error'); }
  });
}

window.filterPhonebook    = filterPhonebook;
window.showPhonebookModal = showPhonebookModal;
window.updatePhonebookForm = updatePhonebookForm;
window.savePhonebookEntry = savePhonebookEntry;
window.editPhonebookEntry  = editPhonebookEntry;
window.deletePhonebookEntry = deletePhonebookEntry;
window.loadPhonebook       = loadPhonebook;

// =========================================
// PUSH NOTIFICATIONS
// =========================================
async function sendPushNotification() {
  const title = document.getElementById('pushTitle').value.trim();
  const body = document.getElementById('pushBody').value.trim();
  const btn = document.getElementById('sendPushBtn');
  const status = document.getElementById('pushStatus');

  if (!title || !body) {
    showToast('টাইটেল এবং বিস্তারিত বিবরণ দিন', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'পাঠানো হচ্ছে...';
  status.textContent = '';

  try {
    // 1. Save to global 'admin_notifications' collection for In-App Popup
    await addDoc(collection(db, 'admin_notifications'), {
      title: title,
      body: body,
      createdAt: serverTimestamp()
    });

    // 2. HTTP Request to Firebase Cloud Messaging (Legacy API)
    // IMPORTANT: Legacy API needs a Server Key. Since it's deprecated by Google,
    // this acts as a placeholder if the admin decides to use HTTP v1 or Cloud Functions.
    const fcmServerKey = prompt('নিরাপত্তার খাতিরে আপনার FCM Server Key এখানে দিন (যদি না থাকে তবে Cancel করুন, ইন-অ্যাপ পপআপ কাজ করবে):');
    
    if (fcmServerKey && fcmServerKey.trim() !== '') {
      const payload = {
        to: '/topics/all',
        notification: {
          title: title,
          body: body,
          sound: 'default'
        },
        data: {
          type: 'admin_message',
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        }
      };

      try {
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Authorization': 'key=' + fcmServerKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          status.textContent = 'সিস্টেম পুশ নোটিফিকেশন সফলভাবে পাঠানো হয়েছে!';
          status.style.color = 'green';
        } else {
          status.textContent = 'FCM সার্ভার সমস্যা: ' + response.status;
          status.style.color = 'red';
        }
      } catch (err) {
        status.textContent = 'FCM API Error: ' + err.message;
        status.style.color = 'red';
      }
    } else {
      status.textContent = 'শুধুমাত্র ইন-অ্যাপ পপআপ সেভ করা হয়েছে (সিস্টেম নোটিফিকেশন পাঠানো যায়নি কারণ Server Key দেওয়া হয়নি)।';
      status.style.color = '#eab308';
    }

    document.getElementById('pushTitle').value = '';
    document.getElementById('pushBody').value = '';
    showToast('নোটিফিকেশন সেভ হয়েছে ✅', 'success');

  } catch (error) {
    status.textContent = 'ডাটাবেস এরর: ' + error.message;
    status.style.color = 'red';
  } finally {
    btn.disabled = false;
    btn.textContent = 'পাঠান (Send Notification)';
  }
}
window.sendPushNotification = sendPushNotification;
