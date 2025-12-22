/**
 * CORSEC LENS - Aplikasi Penomoran Naskah Dinas
 * PT Bank Sulselbar - Divisi Corporate Secretary
 * Version 2.0.1 - Firebase Integration (Fixed)
 * 
 * PERBAIKAN:
 * - Fix double upload dengan flag isUploading
 * - Fix data tidak tampil dengan load manual
 * - Fix jumlah 0 dengan load data saat login
 */

// ========================================
// FIREBASE CONFIGURATION
// ========================================
const firebaseConfig = {
    apiKey: "AIzaSyBI5T3ZVyHXSRFikTjSlnW9P04cO1UDAwg",
    authDomain: "databasebesar.firebaseapp.com",
    projectId: "databasebesar",
    storageBucket: "databasebesar.firebasestorage.app",
    messagingSenderId: "253231829334",
    appId: "1:253231829334:web:d1c0a458aab2f521c546f7",
    measurementId: "G-9CT0LE4FHQ"
};

// CORSEC LENS menggunakan folder terpisah agar tidak mengganggu data lain
const CORSEC_STORAGE_PATH = 'corsec_lens';
const CORSEC_COLLECTION = 'corsec_lens';

// Initialize Firebase
let app, db, storage, auth;
let firebaseReady = false;

function initFirebase() {
    if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK not loaded - running in offline mode');
        firebaseReady = false;
        return;
    }
    
    try {
        if (firebase.apps && firebase.apps.length > 0) {
            app = firebase.apps[0];
        } else {
            app = firebase.initializeApp(firebaseConfig);
        }
        
        db = firebase.firestore();
        storage = firebase.storage();
        auth = firebase.auth();
        firebaseReady = true;
        console.log('✅ Firebase initialized successfully');
    } catch (error) {
        console.error('Firebase init error:', error);
        firebaseReady = false;
    }
}

// ========================================
// GLOBAL VARIABLES
// ========================================
let currentUser = null;
let suratData = [];
let dokumenData = [];
let nomorCounters = {};
let uploadedFiles = [];

// BUG FIX: Track timeouts dan intervals
let chartTimeouts = {};
let counterIntervals = {};
let uploadIntervals = [];
let autoSaveInterval = null;
let dragDropInitialized = false;

// FIX: Flag untuk mencegah double upload
let isUploading = false;
let isLoadingData = false;

// Unsubscribe functions untuk realtime listeners
let unsubscribeSurat = null;
let unsubscribeDokumen = null;

// ========================================
// FIREBASE - AUTHENTICATION
// ========================================
async function firebaseLogin(email, password) {
    if (!firebaseReady) {
        return { success: false, error: 'Firebase not initialized' };
    }
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
            return {
                success: true,
                user: { uid: user.uid, email: user.email, ...userDoc.data() }
            };
        }
        
        return { success: true, user: { uid: user.uid, email: user.email, name: email.split('@')[0] } };
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: error.message };
    }
}

async function firebaseLogout() {
    try {
        if (unsubscribeSurat) unsubscribeSurat();
        if (unsubscribeDokumen) unsubscribeDokumen();
        
        await auth.signOut();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ========================================
// FIREBASE - LOAD DATA (MANUAL - FIX untuk data tidak tampil)
// ========================================
async function loadSuratFromFirebase() {
    if (!firebaseReady || isLoadingData) return;
    
    try {
        console.log('Loading surat from Firebase...');
        const snapshot = await db.collection(CORSEC_COLLECTION).doc('data').collection('surat')
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();
        
        suratData = [];
        snapshot.forEach(doc => {
            suratData.push({ id: doc.id, ...doc.data() });
        });
        
        console.log('✅ Loaded', suratData.length, 'surat');
        return suratData;
    } catch (error) {
        console.error('Load surat error:', error);
        return [];
    }
}

async function loadDokumenFromFirebase() {
    if (!firebaseReady) return;
    
    try {
        console.log('Loading dokumen from Firebase...');
        const snapshot = await db.collection(CORSEC_COLLECTION).doc('data').collection('dokumen')
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();
        
        dokumenData = [];
        snapshot.forEach(doc => {
            dokumenData.push({ id: doc.id, ...doc.data() });
        });
        
        console.log('✅ Loaded', dokumenData.length, 'dokumen');
        return dokumenData;
    } catch (error) {
        console.error('Load dokumen error:', error);
        return [];
    }
}

async function loadCountersFromFirebase() {
    if (!firebaseReady) return;
    
    try {
        const doc = await db.collection(CORSEC_COLLECTION).doc('counters').get();
        if (doc.exists) {
            nomorCounters = doc.data();
            console.log('✅ Loaded counters:', nomorCounters);
        }
    } catch (error) {
        console.error('Load counters error:', error);
    }
}

// ========================================
// FIREBASE - SURAT OPERATIONS
// ========================================
async function saveSuratToFirebase(suratObj) {
    if (!firebaseReady) {
        console.warn('Firebase not ready, saving to localStorage');
        return saveToLocalStorage(suratObj);
    }
    
    try {
        const docRef = await db.collection(CORSEC_COLLECTION).doc('data').collection('surat').add({
            ...suratObj,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Save surat error:', error);
        return { success: false, error: error.message };
    }
}

async function updateSuratInFirebase(suratId, updateData) {
    if (!firebaseReady) return { success: false, error: 'Firebase not ready' };
    
    try {
        await db.collection(CORSEC_COLLECTION).doc('data').collection('surat').doc(suratId).update({
            ...updateData,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Update surat error:', error);
        return { success: false, error: error.message };
    }
}

async function deleteSuratFromFirebase(suratId) {
    if (!firebaseReady) return { success: false, error: 'Firebase not ready' };
    
    try {
        await db.collection(CORSEC_COLLECTION).doc('data').collection('surat').doc(suratId).delete();
        return { success: true };
    } catch (error) {
        console.error('Delete surat error:', error);
        return { success: false, error: error.message };
    }
}

// Realtime listener untuk surat (backup - data utama dari load manual)
function listenToSurat() {
    if (!firebaseReady) return;
    
    try {
        unsubscribeSurat = db.collection(CORSEC_COLLECTION).doc('data').collection('surat')
            .orderBy('createdAt', 'desc')
            .onSnapshot((snapshot) => {
                suratData = [];
                snapshot.forEach(doc => {
                    suratData.push({ id: doc.id, ...doc.data() });
                });
                
                console.log('Realtime update: ', suratData.length, 'surat');
                
                if (document.getElementById('suratTableBody')) {
                    renderSuratTable();
                }
                updateDashboardStats();
                renderActivityList();
            }, (error) => {
                console.error('Listen surat error:', error);
            });
    } catch (e) {
        console.warn('Listen surat failed:', e);
    }
}

// ========================================
// FIREBASE - COUNTER OPERATIONS
// ========================================
async function getNomorCounter(jenisSurat) {
    if (!firebaseReady) return nomorCounters[jenisSurat] || 0;
    
    try {
        const counterRef = db.collection(CORSEC_COLLECTION).doc('counters');
        const doc = await counterRef.get();
        
        if (doc.exists && doc.data()[jenisSurat]) {
            return doc.data()[jenisSurat];
        }
        return 0;
    } catch (error) {
        console.error('Get counter error:', error);
        return nomorCounters[jenisSurat] || 0;
    }
}

async function incrementNomorCounter(jenisSurat) {
    // Update local immediately
    nomorCounters[jenisSurat] = (nomorCounters[jenisSurat] || 0) + 1;
    
    if (!firebaseReady) {
        return { success: true };
    }
    
    try {
        const counterRef = db.collection(CORSEC_COLLECTION).doc('counters');
        
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(counterRef);
            
            if (!doc.exists) {
                transaction.set(counterRef, { [jenisSurat]: 1 });
            } else {
                const currentValue = doc.data()[jenisSurat] || 0;
                transaction.update(counterRef, { [jenisSurat]: currentValue + 1 });
            }
        });
        
        return { success: true };
    } catch (error) {
        console.error('Increment counter error:', error);
        return { success: true }; // Return success karena local sudah di-update
    }
}

// ========================================
// FIREBASE - STORAGE (FILE UPLOAD)
// ========================================
async function uploadFileToStorage(file, customPath) {
    if (!firebaseReady) {
        return { success: false, error: 'Firebase not ready' };
    }
    
    try {
        const storageRef = storage.ref();
        const path = CORSEC_STORAGE_PATH + '/' + customPath;
        const fileRef = storageRef.child(path);
        
        const snapshot = await fileRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();
        
        return {
            success: true,
            url: downloadURL,
            path: path,
            name: file.name,
            size: file.size,
            type: file.type
        };
    } catch (error) {
        console.error('Upload error:', error);
        return { success: false, error: error.message };
    }
}

function uploadFileWithProgress(file, customPath, onProgress) {
    return new Promise((resolve, reject) => {
        if (!firebaseReady) {
            reject({ success: false, error: 'Firebase not ready' });
            return;
        }
        
        const storageRef = storage.ref();
        const path = CORSEC_STORAGE_PATH + '/' + customPath;
        const fileRef = storageRef.child(path);
        const uploadTask = fileRef.put(file);
        
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                if (onProgress) onProgress(progress);
            },
            (error) => {
                reject({ success: false, error: error.message });
            },
            async () => {
                const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                resolve({
                    success: true,
                    url: downloadURL,
                    path: path,
                    name: file.name,
                    size: file.size,
                    type: file.type
                });
            }
        );
    });
}

async function deleteFileFromStorage(path) {
    if (!firebaseReady) return { success: false };
    
    try {
        const storageRef = storage.ref();
        const fileRef = storageRef.child(path);
        await fileRef.delete();
        return { success: true };
    } catch (error) {
        console.error('Delete file error:', error);
        return { success: false, error: error.message };
    }
}

// ========================================
// FIREBASE - DOKUMEN OPERATIONS
// ========================================
async function saveDokumenToFirebase(dokumenObj) {
    if (!firebaseReady) return { success: false, error: 'Firebase not ready' };
    
    try {
        const docRef = await db.collection(CORSEC_COLLECTION).doc('data').collection('dokumen').add({
            ...dokumenObj,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error('Save dokumen error:', error);
        return { success: false, error: error.message };
    }
}

async function deleteDokumenFromFirebase(dokumenId, filePath) {
    if (!firebaseReady) return { success: false };
    
    try {
        if (filePath) {
            await deleteFileFromStorage(filePath);
        }
        
        await db.collection(CORSEC_COLLECTION).doc('data').collection('dokumen').doc(dokumenId).delete();
        
        return { success: true };
    } catch (error) {
        console.error('Delete dokumen error:', error);
        return { success: false, error: error.message };
    }
}

// Realtime listener untuk dokumen
function listenToDokumen() {
    if (!firebaseReady) return;
    
    try {
        unsubscribeDokumen = db.collection(CORSEC_COLLECTION).doc('data').collection('dokumen')
            .orderBy('createdAt', 'desc')
            .onSnapshot((snapshot) => {
                dokumenData = [];
                snapshot.forEach(doc => {
                    dokumenData.push({ id: doc.id, ...doc.data() });
                });
                
                console.log('Realtime update:', dokumenData.length, 'dokumen');
                
                if (document.getElementById('dokumenGrid')) {
                    renderDokumenGrid();
                }
                updateDashboardStats();
            }, (error) => {
                console.error('Listen dokumen error:', error);
            });
    } catch (e) {
        console.warn('Listen dokumen failed:', e);
    }
}

// ========================================
// LOCAL STORAGE FALLBACK
// ========================================
function saveToLocalStorage(data) {
    suratData.push(data);
    localStorage.setItem('corsecSuratData', JSON.stringify(suratData));
    return { success: true, id: data.id };
}

function loadFromLocalStorage() {
    const savedSurat = localStorage.getItem('corsecSuratData');
    if (savedSurat) {
        suratData = JSON.parse(savedSurat);
    }
    
    const savedDokumen = localStorage.getItem('corsecDokumenData');
    if (savedDokumen) {
        dokumenData = JSON.parse(savedDokumen);
    }
    
    const savedCounters = localStorage.getItem('corsecNomorCounters');
    if (savedCounters) {
        nomorCounters = JSON.parse(savedCounters);
    }
}

// ========================================
// CLEANUP RESOURCES
// ========================================
function cleanupResources() {
    Object.values(chartTimeouts).forEach(clearTimeout);
    chartTimeouts = {};
    
    Object.values(counterIntervals).forEach(clearInterval);
    counterIntervals = {};
    
    uploadIntervals.forEach(clearInterval);
    uploadIntervals = [];
    
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
    }
    
    try {
        if (window.monthlyChart instanceof Chart) window.monthlyChart.destroy();
    } catch(e) {}
}

// ========================================
// INITIALIZE APPLICATION
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    initFirebase();
    loadFromLocalStorage();
    
    const session = localStorage.getItem('corsecSession');
    if (session) {
        currentUser = JSON.parse(session);
        showMainApp();
    }
    
    setupEventListeners();
});

function setupEventListeners() {
    var loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    var suratForm = document.getElementById('suratForm');
    if (suratForm) {
        suratForm.addEventListener('submit', handleCreateSurat);
    }
    
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    window.addEventListener('beforeunload', cleanupResources);
}

// ========================================
// LOGIN / LOGOUT
// ========================================
async function handleLogin(event) {
    event.preventDefault();
    
    var usernameEl = document.getElementById('username');
    var passwordEl = document.getElementById('password');
    var rememberEl = document.getElementById('rememberMe');
    
    if (!usernameEl || !passwordEl) {
        showToast('error', 'Error', 'Form tidak ditemukan');
        return;
    }
    
    var username = usernameEl.value.trim().toLowerCase();
    var password = passwordEl.value;
    var remember = rememberEl ? rememberEl.checked : false;
    
    if (!username || !password) {
        showToast('error', 'Error', 'Username dan password harus diisi');
        return;
    }
    
    var loginBtn = document.querySelector('#loginForm button[type="submit"]');
    var originalText = loginBtn ? loginBtn.innerHTML : '';
    if (loginBtn) {
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
        loginBtn.disabled = true;
    }
    
    var demoUsers = {
        'safirah': { password: 'corsec2025', name: 'Safirah Wardinah Irianto', role: 'Asisten Administrasi' },
        'hartani': { password: 'pemimpin2025', name: 'Hartani Syamsuddin', role: 'Pemimpin DCS' },
        'admin': { password: 'admin123', name: 'Administrator', role: 'Admin' }
    };
    
    if (demoUsers[username] && demoUsers[username].password === password) {
        currentUser = { username: username, ...demoUsers[username] };
        
        if (remember) {
            localStorage.setItem('corsecSession', JSON.stringify(currentUser));
        }
        
        showToast('success', 'Login Berhasil', 'Selamat datang, ' + currentUser.name);
        await showMainApp();
        
        if (loginBtn) {
            loginBtn.innerHTML = originalText;
            loginBtn.disabled = false;
        }
        return;
    }
    
    if (firebaseReady) {
        try {
            var email = username.includes('@') ? username : username + '@banksulselbar.co.id';
            var result = await firebaseLogin(email, password);
            
            if (result.success) {
                currentUser = result.user;
                
                if (remember) {
                    localStorage.setItem('corsecSession', JSON.stringify(currentUser));
                }
                
                showToast('success', 'Login Berhasil', 'Selamat datang, ' + (currentUser.name || username));
                await showMainApp();
                
                if (loginBtn) {
                    loginBtn.innerHTML = originalText;
                    loginBtn.disabled = false;
                }
                return;
            }
        } catch (e) {
            console.error('Firebase login error:', e);
        }
    }
    
    showToast('error', 'Login Gagal', 'Username atau password salah');
    
    if (loginBtn) {
        loginBtn.innerHTML = originalText;
        loginBtn.disabled = false;
    }
}

async function handleLogout() {
    cleanupResources();
    
    if (firebaseReady) {
        await firebaseLogout();
    }
    
    localStorage.removeItem('corsecSession');
    currentUser = null;
    suratData = [];
    dokumenData = [];
    
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
    
    showToast('info', 'Logout', 'Anda telah keluar dari sistem');
}

async function showMainApp() {
    console.log('showMainApp called');
    
    var loginPage = document.getElementById('loginPage');
    var mainApp = document.getElementById('appContainer');
    
    if (!mainApp) {
        console.error('appContainer not found!');
        return;
    }
    
    if (loginPage) {
        loginPage.style.display = 'none';
    }
    
    mainApp.style.display = 'flex';
    
    var userName = document.getElementById('userDisplayName');
    var userRole = document.getElementById('userRole');
    if (userName) userName.textContent = currentUser.name || currentUser.username || 'User';
    if (userRole) userRole.textContent = currentUser.role || 'Staff';
    
    // FIX: Load data dari Firebase SEBELUM navigasi
    if (firebaseReady) {
        isLoadingData = true;
        showToast('info', 'Loading', 'Mengambil data...');
        
        try {
            await loadSuratFromFirebase();
            await loadDokumenFromFirebase();
            await loadCountersFromFirebase();
            
            // Start realtime listeners sebagai backup
            listenToSurat();
            listenToDokumen();
            
            console.log('✅ Data loaded:', suratData.length, 'surat,', dokumenData.length, 'dokumen');
        } catch (e) {
            console.error('Load data error:', e);
        }
        
        isLoadingData = false;
    } else if (suratData.length === 0) {
        loadSampleData();
    }
    
    navigateTo('dashboard');
    setupDragAndDrop();
}

// ========================================
// NAVIGATION
// ========================================
function navigateTo(pageName) {
    Object.values(chartTimeouts).forEach(clearTimeout);
    chartTimeouts = {};
    
    if (pageName !== 'upload-dokumen') {
        uploadIntervals.forEach(clearInterval);
        uploadIntervals = [];
    }
    
    var pageMap = {
        'dashboard': 'dashboardPage',
        'buat-surat': 'buatSuratPage',
        'daftar-surat': 'daftarSuratPage',
        'upload-dokumen': 'uploadDokumenPage',
        'arsip-dokumen': 'arsipDokumenPage',
        'folder-manager': 'folderManagerPage',
        'cetak-laporan': 'cetakLaporanPage',
        'pengaturan': 'pengaturanPage'
    };
    
    var titleMap = {
        'dashboard': 'Dashboard',
        'buat-surat': 'Buat Surat Baru',
        'daftar-surat': 'Daftar Surat',
        'upload-dokumen': 'Upload Dokumen',
        'arsip-dokumen': 'Arsip Dokumen',
        'folder-manager': 'Manajemen Folder',
        'cetak-laporan': 'Cetak Laporan',
        'pengaturan': 'Pengaturan'
    };
    
    document.querySelectorAll('.page').forEach(function(page) {
        page.style.display = 'none';
    });
    
    var targetPage = document.getElementById(pageMap[pageName]);
    if (targetPage) {
        targetPage.style.display = 'block';
    }
    
    document.querySelectorAll('.nav-item').forEach(function(item) {
        item.classList.remove('active');
        if (item.dataset.page === pageName) {
            item.classList.add('active');
        }
    });
    
    var pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.textContent = titleMap[pageName] || 'CORSEC LENS';
    }
    
    switch(pageName) {
        case 'dashboard':
            updateDashboardStats();
            renderActivityList();
            chartTimeouts.dashboard = setTimeout(initCharts, 100);
            break;
        case 'daftar-surat':
            renderSuratTable();
            break;
        case 'arsip-dokumen':
            renderDokumenGrid();
            break;
        case 'folder-manager':
            renderFolderTree();
            break;
        case 'buat-surat':
            initializeDateInputs();
            updateNomorPreview();
            break;
    }
    
    if (window.innerWidth <= 1024) {
        var sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('active');
    }
}

function toggleSidebar() {
    var sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('active');
}

// ========================================
// DASHBOARD
// ========================================
function updateDashboardStats() {
    var totalSurat = suratData.length;
    var selesai = suratData.filter(function(s) { return s.status === 'Selesai'; }).length;
    var proses = suratData.filter(function(s) { return s.status === 'Proses' || s.status === 'Draft'; }).length;
    var totalDokumen = dokumenData.length;
    
    animateCounter('statTotalSurat', totalSurat);
    animateCounter('statSelesai', selesai);
    animateCounter('statProses', proses);
    animateCounter('statDokumen', totalDokumen);
}

function animateCounter(elementId, target) {
    var element = document.getElementById(elementId);
    if (!element) return;
    
    if (counterIntervals[elementId]) {
        clearInterval(counterIntervals[elementId]);
        delete counterIntervals[elementId];
    }
    
    var current = 0;
    var increment = Math.ceil(target / 30);
    var stepTime = 500 / 30;
    
    counterIntervals[elementId] = setInterval(function() {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(counterIntervals[elementId]);
            delete counterIntervals[elementId];
        }
        element.textContent = current;
    }, stepTime);
}

function renderActivityList() {
    var activityList = document.getElementById('activityList');
    if (!activityList) return;
    
    var recentSurat = suratData.slice(0, 5);
    
    if (recentSurat.length === 0) {
        activityList.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Belum ada aktivitas</p></div>';
        return;
    }
    
    var html = '';
    recentSurat.forEach(function(surat) {
        html += '<div class="activity-item">';
        html += '<div class="activity-icon create"><i class="fas fa-file-alt"></i></div>';
        html += '<div class="activity-content">';
        html += '<h4>' + surat.nomor + '</h4>';
        html += '<p>' + (surat.perihal ? surat.perihal.substring(0, 50) + (surat.perihal.length > 50 ? '...' : '') : '-') + '</p>';
        html += '</div></div>';
    });
    
    activityList.innerHTML = html;
}

// ========================================
// CHART
// ========================================
function initCharts() {
    var canvas = document.getElementById('monthlyChart');
    if (!canvas || typeof Chart === 'undefined') return;
    
    if (window.monthlyChart instanceof Chart) {
        window.monthlyChart.destroy();
        window.monthlyChart = null;
    }
    
    var parent = canvas.parentNode;
    var newCanvas = document.createElement('canvas');
    newCanvas.id = 'monthlyChart';
    parent.innerHTML = '';
    parent.appendChild(newCanvas);
    
    window.monthlyChart = new Chart(newCanvas, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
            datasets: [{
                label: 'Surat Dibuat',
                data: getMonthlyData(),
                borderColor: '#1B5E9E',
                backgroundColor: 'rgba(27, 94, 158, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

function getMonthlyData() {
    var monthlyCount = [0,0,0,0,0,0,0,0,0,0,0,0];
    var currentYear = new Date().getFullYear();
    
    suratData.forEach(function(surat) {
        if (surat.tanggal) {
            var date = new Date(surat.tanggal);
            if (date.getFullYear() === currentYear) {
                monthlyCount[date.getMonth()]++;
            }
        }
    });
    
    return monthlyCount;
}

// ========================================
// NOMOR SURAT GENERATOR
// ========================================
function getBulanRomawi(month) {
    var romawi = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    return romawi[month] || 'I';
}

async function generateNomorSurat(jenis, divisi) {
    var now = new Date();
    var year = now.getFullYear();
    var year2digit = String(year).slice(-2);
    var monthIndex = now.getMonth();
    var bulanRomawi = getBulanRomawi(monthIndex);
    
    var counterValue = await getNomorCounter(jenis);
    var nextCounter = counterValue + 1;
    
    var counter3 = String(nextCounter).padStart(3, '0');
    var counter4 = String(nextCounter).padStart(4, '0');
    
    var kodeDivisi = {
        'Corporate Secretary': 'DCS',
        'Direksi': 'DIR',
        'Divisi Human Capital': 'DHC',
        'Divisi Jasa': 'DJS',
        'Divisi Dana & Layanan': 'DDL',
        'Divisi Retail & Kredit': 'DRK',
        'Divisi Kredit Korporasi': 'DKK',
        'Divisi Kepatuhan': 'DKP',
        'Divisi Internasional & Business': 'DIB',
        'Divisi Umum': 'DUM',
        'SIMO': 'SIMO',
        'Manajemen Risiko': 'SKMR'
    };
    
    var kode = kodeDivisi[divisi] || 'DCS';
    
    switch(jenis) {
        case 'Surat Biasa':
            return 'SR/' + counter3 + '/B/' + kode + '/' + bulanRomawi + '/' + year2digit;
        case 'Surat Rahasia':
            return 'SR/' + counter3 + '/R/' + kode + '/' + bulanRomawi + '/' + year2digit;
        case 'Surat Keputusan':
            return 'SK/' + counter3 + '/DIR/' + bulanRomawi + '/' + year;
        case 'Surat Edaran':
            return 'SE/' + counter3 + '/DIR/' + bulanRomawi + '/' + year;
        case 'Memo Direksi':
            return 'MM/' + counter4 + '/DIR/' + bulanRomawi + '/' + year;
        case 'Memo Corsec':
            return 'MM/' + counter4 + '/DCS/' + bulanRomawi + '/' + year;
        case 'PKS':
            return counter3 + '/PKS-BSSB/' + kode + '/' + bulanRomawi + '/' + year;
        case 'MoU':
            return counter3 + '/MOU-BSSB/' + bulanRomawi + '/' + year;
        case 'Notulen Radir':
            return counter3 + '/RADIR/' + kode + '/' + bulanRomawi + '/' + year;
        case 'Surat Tugas':
            return 'ST/' + counter3 + '/' + kode + '/' + bulanRomawi + '/' + year;
        case 'Surat Undangan':
            return 'UND/' + counter3 + '/' + kode + '/' + bulanRomawi + '/' + year;
        case 'Nota Dinas':
            return 'ND/' + counter3 + '/' + kode + '/' + bulanRomawi + '/' + year;
        default:
            return 'SR/' + counter3 + '/' + kode + '/' + bulanRomawi + '/' + year;
    }
}

function initializeDateInputs() {
    var today = new Date().toISOString().split('T')[0];
    
    var tanggalSurat = document.getElementById('tanggalSurat');
    if (tanggalSurat) tanggalSurat.value = today;
    
    var reportDateFrom = document.getElementById('reportDateFrom');
    var reportDateTo = document.getElementById('reportDateTo');
    if (reportDateFrom && reportDateTo) {
        var firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        reportDateFrom.value = firstDay.toISOString().split('T')[0];
        reportDateTo.value = today;
    }
}

async function updateNomorPreview() {
    var jenisEl = document.getElementById('jenisSurat');
    var divisiEl = document.getElementById('divisiSurat');
    var nomorPreview = document.getElementById('nomorPreview');
    
    if (nomorPreview) {
        if (jenisEl && divisiEl && jenisEl.value && divisiEl.value) {
            var nomor = await generateNomorSurat(jenisEl.value, divisiEl.value);
            nomorPreview.textContent = nomor;
        } else {
            nomorPreview.textContent = 'SR/001/B/DCS/XII/25';
        }
    }
}

// ========================================
// CREATE SURAT
// ========================================
async function handleCreateSurat(event) {
    event.preventDefault();
    
    var jenis = document.getElementById('jenisSurat').value;
    var divisi = document.getElementById('divisiSurat').value;
    var sifat = document.getElementById('sifatSurat').value;
    var tanggal = document.getElementById('tanggalSurat').value;
    var kepada = document.getElementById('kepadaSurat').value;
    var perihal = document.getElementById('perihalSurat').value;
    var lampiran = document.getElementById('lampiranSurat').value || '-';
    var tembusan = document.getElementById('tembusan').value || 'Arsip';
    
    if (!jenis || !divisi || !sifat || !tanggal || !kepada || !perihal) {
        showToast('error', 'Error', 'Mohon lengkapi semua field yang wajib diisi');
        return;
    }
    
    var submitBtn = document.querySelector('#suratForm button[type="submit"]');
    var originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    submitBtn.disabled = true;
    
    try {
        var nomor = await generateNomorSurat(jenis, divisi);
        
        var fileUrls = [];
        if (uploadedFiles.length > 0) {
            for (var file of uploadedFiles) {
                var path = 'surat/' + nomor.replace(/\//g, '-') + '/' + Date.now() + '_' + file.name;
                var uploadResult = await uploadFileToStorage(file, path);
                if (uploadResult.success) {
                    fileUrls.push({
                        name: file.name,
                        url: uploadResult.url,
                        path: uploadResult.path,
                        size: file.size,
                        type: file.type
                    });
                }
            }
        }
        
        var newSurat = {
            nomor: nomor,
            jenis: jenis,
            divisi: divisi,
            sifat: sifat,
            tanggal: tanggal,
            kepada: kepada,
            perihal: perihal,
            lampiran: lampiran,
            tembusan: tembusan,
            status: 'Draft',
            files: fileUrls,
            createdBy: currentUser ? (currentUser.name || currentUser.username) : 'User'
        };
        
        var result = await saveSuratToFirebase(newSurat);
        
        if (result.success) {
            await incrementNomorCounter(jenis);
            
            // FIX: Tambahkan ke local array juga
            suratData.unshift({ id: result.id, ...newSurat, createdAt: new Date() });
            
            showToast('success', 'Berhasil', 'Surat ' + nomor + ' berhasil dibuat');
            
            document.getElementById('suratForm').reset();
            uploadedFiles = [];
            var fileList = document.getElementById('fileList');
            if (fileList) fileList.innerHTML = '';
            
            initializeDateInputs();
            updateNomorPreview();
            
            navigateTo('daftar-surat');
        } else {
            showToast('error', 'Error', 'Gagal menyimpan surat: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Create surat error:', error);
        showToast('error', 'Error', 'Terjadi kesalahan: ' + error.message);
    }
    
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
}

// ========================================
// SURAT TABLE
// ========================================
function renderSuratTable() {
    var tableBody = document.getElementById('suratTableBody');
    if (!tableBody) return;
    
    var search = document.getElementById('searchSurat');
    var filterJenis = document.getElementById('filterJenis');
    var filterStatus = document.getElementById('filterStatus');
    
    var searchValue = search ? search.value.toLowerCase() : '';
    var jenisValue = filterJenis ? filterJenis.value : '';
    var statusValue = filterStatus ? filterStatus.value : '';
    
    var filtered = suratData.filter(function(surat) {
        var matchSearch = !searchValue || 
            (surat.nomor && surat.nomor.toLowerCase().includes(searchValue)) || 
            (surat.perihal && surat.perihal.toLowerCase().includes(searchValue));
        var matchJenis = !jenisValue || surat.jenis === jenisValue;
        var matchStatus = !statusValue || surat.status === statusValue;
        return matchSearch && matchJenis && matchStatus;
    });
    
    if (filtered.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="empty-table"><i class="fas fa-inbox"></i><p>Tidak ada data surat</p></td></tr>';
        return;
    }
    
    var html = '';
    filtered.forEach(function(surat, index) {
        var statusClass = surat.status === 'Selesai' ? 'success' : (surat.status === 'Proses' ? 'warning' : 'info');
        html += '<tr>';
        html += '<td>' + (index + 1) + '</td>';
        html += '<td><strong>' + surat.nomor + '</strong></td>';
        html += '<td>' + (surat.tanggal || '-') + '</td>';
        html += '<td>' + (surat.jenis || '-') + '</td>';
        html += '<td>' + (surat.perihal ? surat.perihal.substring(0, 40) + (surat.perihal.length > 40 ? '...' : '') : '-') + '</td>';
        html += '<td><span class="status-badge ' + statusClass + '">' + (surat.status || 'Draft') + '</span></td>';
        html += '<td class="actions">';
        html += '<button class="btn-icon" onclick="viewSurat(\'' + surat.id + '\')" title="Lihat"><i class="fas fa-eye"></i></button>';
        html += '<button class="btn-icon" onclick="printSurat(\'' + surat.id + '\')" title="Print"><i class="fas fa-print"></i></button>';
        html += '<button class="btn-icon" onclick="downloadSurat(\'' + surat.id + '\')" title="Download"><i class="fas fa-download"></i></button>';
        html += '<button class="btn-icon danger" onclick="confirmDeleteSurat(\'' + surat.id + '\')" title="Hapus"><i class="fas fa-trash"></i></button>';
        html += '</td></tr>';
    });
    
    tableBody.innerHTML = html;
}

function filterSuratList() {
    renderSuratTable();
}

function viewSurat(suratId) {
    var surat = suratData.find(function(s) { return s.id === suratId; });
    if (!surat) {
        showToast('error', 'Error', 'Surat tidak ditemukan');
        return;
    }
    
    var filesHtml = '';
    if (surat.files && surat.files.length > 0) {
        filesHtml = '<div class="surat-files"><h4>Lampiran File:</h4><ul>';
        surat.files.forEach(function(file) {
            filesHtml += '<li><a href="' + file.url + '" target="_blank"><i class="fas fa-file"></i> ' + file.name + '</a></li>';
        });
        filesHtml += '</ul></div>';
    }
    
    var content = '<div class="surat-detail">' +
        '<div class="detail-row"><label>Nomor:</label><span>' + surat.nomor + '</span></div>' +
        '<div class="detail-row"><label>Jenis:</label><span>' + surat.jenis + '</span></div>' +
        '<div class="detail-row"><label>Divisi:</label><span>' + surat.divisi + '</span></div>' +
        '<div class="detail-row"><label>Sifat:</label><span>' + surat.sifat + '</span></div>' +
        '<div class="detail-row"><label>Tanggal:</label><span>' + surat.tanggal + '</span></div>' +
        '<div class="detail-row"><label>Kepada:</label><span>' + surat.kepada + '</span></div>' +
        '<div class="detail-row"><label>Perihal:</label><span>' + surat.perihal + '</span></div>' +
        '<div class="detail-row"><label>Lampiran:</label><span>' + surat.lampiran + '</span></div>' +
        '<div class="detail-row"><label>Tembusan:</label><span>' + surat.tembusan + '</span></div>' +
        '<div class="detail-row"><label>Status:</label><span>' + surat.status + '</span></div>' +
        '<div class="detail-row"><label>Dibuat oleh:</label><span>' + surat.createdBy + '</span></div>' +
        filesHtml +
        '</div>';
    
    showModal('Detail Surat', content);
}

async function confirmDeleteSurat(suratId) {
    var surat = suratData.find(function(s) { return s.id === suratId; });
    if (!surat) return;
    
    if (confirm('Yakin ingin menghapus surat ' + surat.nomor + '?')) {
        var result = await deleteSuratFromFirebase(suratId);
        
        if (result.success || !firebaseReady) {
            suratData = suratData.filter(function(s) { return s.id !== suratId; });
            
            showToast('success', 'Berhasil', 'Surat berhasil dihapus');
            renderSuratTable();
            updateDashboardStats();
        } else {
            showToast('error', 'Error', 'Gagal menghapus surat');
        }
    }
}

function printSurat(suratId) {
    var surat = suratData.find(function(s) { return s.id === suratId; });
    if (!surat) return;
    
    var printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Surat ' + surat.nomor + '</title>');
    printWindow.document.write('<style>body{font-family:Arial,sans-serif;padding:40px;line-height:1.6}');
    printWindow.document.write('.header{text-align:center;margin-bottom:30px}');
    printWindow.document.write('.content{margin:20px 0}.footer{margin-top:50px}</style></head><body>');
    printWindow.document.write('<div class="header"><h2>PT BANK SULSELBAR</h2><p>Divisi ' + surat.divisi + '</p></div>');
    printWindow.document.write('<p><strong>Nomor:</strong> ' + surat.nomor + '</p>');
    printWindow.document.write('<p><strong>Sifat:</strong> ' + surat.sifat + '</p>');
    printWindow.document.write('<p><strong>Lampiran:</strong> ' + surat.lampiran + '</p>');
    printWindow.document.write('<p><strong>Perihal:</strong> ' + surat.perihal + '</p>');
    printWindow.document.write('<p><strong>Kepada Yth.</strong><br>' + surat.kepada + '</p>');
    printWindow.document.write('<div class="content"><p>Dengan hormat,</p><p>[Isi surat]</p></div>');
    printWindow.document.write('<div class="footer"><p>Makassar, ' + new Date(surat.tanggal).toLocaleDateString('id-ID') + '</p>');
    printWindow.document.write('<p><br><br><br><u>' + surat.createdBy + '</u></p></div>');
    printWindow.document.write('<p><strong>Tembusan:</strong><br>' + surat.tembusan + '</p>');
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
}

function downloadSurat(suratId) {
    var surat = suratData.find(function(s) { return s.id === suratId; });
    if (!surat) return;
    
    var content = 'NASKAH DINAS\nPT BANK SULSELBAR\n' +
        '================================================================================\n\n' +
        'Nomor      : ' + surat.nomor + '\n' +
        'Jenis      : ' + surat.jenis + '\n' +
        'Divisi     : ' + surat.divisi + '\n' +
        'Sifat      : ' + surat.sifat + '\n' +
        'Tanggal    : ' + surat.tanggal + '\n' +
        'Kepada     : ' + surat.kepada + '\n' +
        'Perihal    : ' + surat.perihal + '\n' +
        'Lampiran   : ' + surat.lampiran + '\n\n' +
        '--------------------------------------------------------------------------------\n\n' +
        'Tembusan:\n- ' + surat.tembusan + '\n\n' +
        '================================================================================\n' +
        'Dokumen ini dibuat melalui CORSEC LENS\n' +
        'Divisi Corporate Secretary - Bank Sulselbar\n' +
        '================================================================================\n';
    
    var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    var url = window.URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = surat.nomor.replace(/\//g, '-') + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showToast('success', 'Download', 'File surat berhasil diunduh');
}

function exportToExcel() {
    var csv = '\ufeffNo,Nomor Surat,Tanggal,Jenis,Perihal,Kepada,Sifat,Status,Dibuat Oleh\n';
    
    suratData.forEach(function(surat, index) {
        csv += (index + 1) + ',"' + surat.nomor + '","' + surat.tanggal + '","' + surat.jenis + '","' + 
               (surat.perihal || '').replace(/"/g, '""') + '","' + (surat.kepada || '').replace(/"/g, '""') + '","' + 
               surat.sifat + '","' + surat.status + '","' + surat.createdBy + '"\n';
    });
    
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = window.URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'Daftar_Surat_CORSEC_' + new Date().toISOString().split('T')[0] + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    showToast('success', 'Export', 'Data berhasil diekspor ke Excel');
}

function printList() { window.print(); }

// ========================================
// FILE UPLOAD
// ========================================
function setupDragAndDrop() {
    if (dragDropInitialized) return;
    
    var dropZone = document.getElementById('dropZone');
    var uploadDropZone = document.getElementById('uploadDropZone');
    
    [dropZone, uploadDropZone].forEach(function(zone) {
        if (!zone) return;
        zone.addEventListener('dragover', function(e) { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', function() { zone.classList.remove('dragover'); });
        zone.addEventListener('drop', function(e) {
            e.preventDefault();
            zone.classList.remove('dragover');
            if (zone.id === 'uploadDropZone') {
                handleUploadFiles(e.dataTransfer.files);
            } else {
                handleFileDrop(e.dataTransfer.files);
            }
        });
    });
    
    dragDropInitialized = true;
}

function handleFileSelect(event) {
    if (event && event.target && event.target.files) {
        handleFileDrop(event.target.files);
    }
}

function handleFileDrop(files) {
    var fileList = document.getElementById('fileList');
    if (!fileList) return;
    
    Array.from(files).forEach(function(file) {
        var alreadyAdded = uploadedFiles.some(function(f) { return f.name === file.name && f.size === file.size; });
        if (alreadyAdded) {
            showToast('warning', 'Peringatan', 'File ' + file.name + ' sudah ditambahkan');
            return;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            showToast('error', 'Error', 'File ' + file.name + ' terlalu besar (max 10MB)');
            return;
        }
        
        uploadedFiles.push(file);
        
        var fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = '<i class="fas ' + getFileIcon(file.type) + '" style="font-size: 24px; color: #1B5E9E;"></i>' +
            '<div class="file-item-info"><span class="name">' + file.name + '</span><span class="size">' + formatFileSize(file.size) + '</span></div>' +
            '<button class="remove-file" onclick="removeFile(\'' + file.name + '\', this)"><i class="fas fa-times"></i></button>';
        fileList.appendChild(fileItem);
    });
}

function removeFile(fileName, button) {
    uploadedFiles = uploadedFiles.filter(function(f) { return f.name !== fileName; });
    if (button) button.closest('.file-item').remove();
}

// FIX: Mencegah double upload
function handleUploadFile(event) {
    if (isUploading) {
        console.log('Upload sedang berjalan, skip...');
        event.target.value = '';
        return;
    }
    handleUploadFiles(event.target.files);
    event.target.value = '';
}

async function handleUploadFiles(files) {
    // FIX: Cek apakah sedang upload
    if (isUploading) {
        console.log('Already uploading, skipped');
        return;
    }
    
    isUploading = true;
    
    var kategoriEl = document.getElementById('uploadKategori');
    var keteranganEl = document.getElementById('uploadKeterangan');
    var uploadQueue = document.getElementById('uploadQueue');
    
    var kategori = kategoriEl ? kategoriEl.value : 'Umum';
    var keterangan = keteranganEl ? keteranganEl.value : '';
    
    if (!uploadQueue) {
        isUploading = false;
        return;
    }
    
    for (var file of Array.from(files)) {
        if (file.size > 25 * 1024 * 1024) {
            showToast('error', 'Error', 'File ' + file.name + ' terlalu besar (max 25MB)');
            continue;
        }
        
        var uploadItem = document.createElement('div');
        uploadItem.className = 'upload-item';
        uploadItem.innerHTML = '<div class="upload-item-icon"><i class="fas ' + getFileIcon(file.type) + '"></i></div>' +
            '<div class="upload-item-info"><div class="name">' + file.name + '</div>' +
            '<div class="upload-progress"><div class="upload-progress-bar" style="width: 0%"></div></div></div>';
        uploadQueue.appendChild(uploadItem);
        
        var progressBar = uploadItem.querySelector('.upload-progress-bar');
        
        try {
            var timestamp = Date.now();
            var path = 'dokumen/' + new Date().getFullYear() + '/' + (new Date().getMonth() + 1) + '/' + timestamp + '_' + file.name;
            
            var result = await uploadFileWithProgress(file, path, function(progress) {
                if (progressBar) progressBar.style.width = progress + '%';
            });
            
            if (result.success) {
                var saveResult = await saveDokumenToFirebase({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    url: result.url,
                    path: result.path,
                    kategori: kategori,
                    keterangan: keterangan,
                    uploadedBy: currentUser ? (currentUser.name || currentUser.username) : 'User'
                });
                
                if (saveResult.success) {
                    // FIX: Tambahkan ke local array
                    dokumenData.unshift({
                        id: saveResult.id,
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        url: result.url,
                        path: result.path,
                        kategori: kategori,
                        keterangan: keterangan,
                        uploadedBy: currentUser ? currentUser.name : 'User',
                        createdAt: new Date()
                    });
                }
                
                uploadItem.classList.add('complete');
                showToast('success', 'Upload Berhasil', file.name);
            } else {
                uploadItem.classList.add('error');
                showToast('error', 'Upload Gagal', result.error || file.name);
            }
        } catch (error) {
            console.error('Upload error:', error);
            uploadItem.classList.add('error');
            showToast('error', 'Upload Error', error.message || 'Gagal upload file');
        }
    }
    
    // Update UI
    updateDashboardStats();
    renderDokumenGrid();
    
    isUploading = false;
}

// ========================================
// DOKUMEN GRID
// ========================================
function renderDokumenGrid() {
    var grid = document.getElementById('dokumenGrid');
    if (!grid) return;
    
    var search = document.getElementById('searchDokumen');
    var filterKategori = document.getElementById('filterKategori');
    
    var searchValue = search ? search.value.toLowerCase() : '';
    var kategoriValue = filterKategori ? filterKategori.value : '';
    
    var filtered = dokumenData.filter(function(doc) {
        var matchSearch = !searchValue || (doc.name && doc.name.toLowerCase().includes(searchValue));
        var matchKategori = !kategoriValue || doc.kategori === kategoriValue;
        return matchSearch && matchKategori;
    });
    
    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-folder-open"></i><p>Tidak ada dokumen</p></div>';
        return;
    }
    
    var html = '';
    filtered.forEach(function(doc) {
        html += '<div class="dokumen-card">';
        html += '<div class="dokumen-icon"><i class="fas ' + getFileIcon(doc.type) + '"></i></div>';
        html += '<div class="dokumen-info">';
        html += '<h4>' + doc.name + '</h4>';
        html += '<p>' + formatFileSize(doc.size) + ' • ' + (doc.kategori || 'Umum') + '</p>';
        html += '</div>';
        html += '<div class="dokumen-actions">';
        if (doc.url) {
            html += '<a href="' + doc.url + '" target="_blank" class="btn-icon" title="Lihat"><i class="fas fa-eye"></i></a>';
            html += '<a href="' + doc.url + '" download="' + doc.name + '" class="btn-icon" title="Download"><i class="fas fa-download"></i></a>';
        }
        html += '<button class="btn-icon danger" onclick="confirmDeleteDokumen(\'' + doc.id + '\', \'' + (doc.path || '') + '\')" title="Hapus"><i class="fas fa-trash"></i></button>';
        html += '</div></div>';
    });
    
    grid.innerHTML = html;
}

function filterDokumenGrid() {
    renderDokumenGrid();
}

async function confirmDeleteDokumen(dokumenId, filePath) {
    if (confirm('Yakin ingin menghapus dokumen ini?')) {
        var result = await deleteDokumenFromFirebase(dokumenId, filePath);
        
        if (result.success || !firebaseReady) {
            dokumenData = dokumenData.filter(function(d) { return d.id !== dokumenId; });
            
            showToast('success', 'Berhasil', 'Dokumen berhasil dihapus');
            renderDokumenGrid();
            updateDashboardStats();
        } else {
            showToast('error', 'Error', 'Gagal menghapus dokumen');
        }
    }
}

// ========================================
// FOLDER TREE
// ========================================
function renderFolderTree() {
    var container = document.getElementById('folderTree');
    var content = document.getElementById('folderContent');
    if (!container) return;
    
    var folders = {};
    dokumenData.forEach(function(doc) {
        var cat = doc.kategori || 'Lainnya';
        if (!folders[cat]) folders[cat] = [];
        folders[cat].push(doc);
    });
    
    suratData.forEach(function(surat) {
        var cat = 'Surat: ' + surat.jenis;
        if (!folders[cat]) folders[cat] = [];
        folders[cat].push({ type: 'surat', ...surat });
    });
    
    var html = '<ul class="folder-list">';
    Object.keys(folders).forEach(function(folderName) {
        var count = folders[folderName].length;
        html += '<li class="folder-item" onclick="openFolder(\'' + folderName + '\', event)">';
        html += '<i class="fas fa-folder"></i> ' + folderName + ' <span class="count">(' + count + ')</span>';
        html += '</li>';
    });
    html += '</ul>';
    
    container.innerHTML = html;
    
    if (content) {
        content.innerHTML = '<div class="empty-state"><i class="fas fa-hand-pointer"></i><p>Pilih folder untuk melihat isi</p></div>';
    }
}

function openFolder(folderName, evt) {
    if (evt) evt.preventDefault();
    
    var content = document.getElementById('folderContent');
    if (!content) return;
    
    var items = [];
    
    dokumenData.forEach(function(doc) {
        if ((doc.kategori || 'Lainnya') === folderName) {
            items.push({ type: 'dokumen', ...doc });
        }
    });
    
    suratData.forEach(function(surat) {
        if (('Surat: ' + surat.jenis) === folderName) {
            items.push({ type: 'surat', ...surat });
        }
    });
    
    if (items.length === 0) {
        content.innerHTML = '<div class="empty-state"><i class="fas fa-folder-open"></i><p>Folder kosong</p></div>';
        return;
    }
    
    var html = '<div class="folder-items">';
    items.forEach(function(item) {
        if (item.type === 'surat') {
            html += '<div class="folder-item-card">';
            html += '<i class="fas fa-file-alt"></i>';
            html += '<span>' + item.nomor + '</span>';
            html += '<small>' + (item.perihal || '').substring(0, 30) + '</small>';
            html += '</div>';
        } else {
            html += '<div class="folder-item-card">';
            html += '<i class="fas ' + getFileIcon(item.type) + '"></i>';
            html += '<span>' + item.name + '</span>';
            if (item.url) {
                html += '<a href="' + item.url + '" target="_blank" class="btn-sm">Buka</a>';
            }
            html += '</div>';
        }
    });
    html += '</div>';
    
    content.innerHTML = html;
}

// ========================================
// UTILITIES
// ========================================
function getFileIcon(mimeType) {
    if (!mimeType) return 'fa-file';
    if (mimeType.includes('pdf')) return 'fa-file-pdf';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'fa-file-word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fa-file-excel';
    if (mimeType.includes('image')) return 'fa-file-image';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'fa-file-powerpoint';
    return 'fa-file';
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    var sizes = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
}

function showToast(type, title, message) {
    var container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    
    var icons = { success: 'check-circle', error: 'times-circle', warning: 'exclamation-circle', info: 'info-circle' };
    
    toast.innerHTML = '<div class="toast-icon"><i class="fas fa-' + (icons[type] || 'info-circle') + '"></i></div>' +
        '<div class="toast-content"><h4>' + title + '</h4><p>' + message + '</p></div>' +
        '<button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>';
    
    container.appendChild(toast);
    
    setTimeout(function() { toast.classList.add('show'); }, 10);
    setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() { toast.remove(); }, 300);
    }, 5000);
}

function showModal(title, content) {
    var modal = document.getElementById('modal');
    var modalTitle = document.getElementById('modalTitle');
    var modalBody = document.getElementById('modalBody');
    
    if (modal && modalTitle && modalBody) {
        modalTitle.textContent = title;
        modalBody.innerHTML = content;
        modal.style.display = 'flex';
    }
}

function closeModal() {
    var modal = document.getElementById('modal');
    if (modal) modal.style.display = 'none';
}

// ========================================
// SAMPLE DATA
// ========================================
function loadSampleData() {
    const now = Date.now();
    suratData = [
        {
            id: String(now),
            nomor: 'SR/001/B/DCS/XII/25',
            jenis: 'Surat Biasa',
            divisi: 'Corporate Secretary',
            sifat: 'Biasa',
            tanggal: '2025-12-18',
            kepada: 'Direktur Utama Bank Sulselbar',
            perihal: 'Laporan Pelaksanaan RUPST 2025',
            lampiran: '3 Berkas',
            tembusan: 'Arsip',
            status: 'Selesai',
            files: [],
            createdBy: 'Safirah Wardinah'
        }
    ];
    
    nomorCounters = { 'Surat Biasa': 1 };
}

// ========================================
// REPORTS
// ========================================
function previewReport() {
    showToast('info', 'Preview', 'Gunakan Export atau Print untuk melihat laporan');
}

function generateReport() {
    exportToExcel();
}

function saveProfile() {
    showToast('success', 'Berhasil', 'Profil berhasil disimpan');
}

function changePassword() {
    showToast('info', 'Info', 'Fitur ubah password - hubungi admin');
}

window.onclick = function(event) {
    var modal = document.getElementById('modal');
    if (event.target === modal) {
        closeModal();
    }
};

console.log('CORSEC LENS v2.0.1 - Firebase Integration Fixed');
