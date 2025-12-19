/**
 * CORSEC LENS - Aplikasi Penomoran Naskah Dinas
 * PT Bank Sulselbar - Divisi Corporate Secretary
 * Version 1.0.3 - Chart Bug Fixed
 * 
 * Changelog v1.0.3:
 * - Fixed: Chart BENAR-BENAR dibersihkan dengan clearRect()
 * - Added: Helper function destroyChart() untuk clear canvas
 * 
 * Changelog v1.0.2:
 * - Fixed: Chart infinite bertambah saat navigasi cepat
 * - Fixed: Memory leak pada upload progress interval
 * - Fixed: AnimateCounter multiple intervals
 * - Fixed: Event listener accumulation
 * - Fixed: Undefined event variable di openFolder
 * - Added: Proper cleanup untuk semua timeouts/intervals
 * - Updated: Format penomoran sesuai Bank Sulselbar
 */

// ========================================
// DATA STORAGE
// ========================================
let currentUser = null;
let suratData = [];
let dokumenData = [];
let uploadedFiles = [];
let currentPage = 1;
const itemsPerPage = 10;

// ========================================
// BUG FIX: Tracking untuk timeouts dan intervals
// ========================================
let chartTimeouts = {};
let counterIntervals = {};
let uploadIntervals = [];
let autoSaveInterval = null;
let dragDropInitialized = false;

// Counter penomoran untuk setiap jenis surat (sesuai format Bank Sulselbar)
let nomorCounters = {
    'Surat Biasa': 1,
    'Surat Rahasia': 1,
    'Surat Keputusan': 1,
    'Surat Edaran': 1,
    'Memo Direksi': 1,
    'Memo Corsec': 1,
    'PKS': 1,
    'MoU': 1,
    'Notulen Radir': 1,
    'Surat Tugas': 1,
    'Surat Undangan': 1,
    'Nota Dinas': 1
};

// User accounts for authentication
const userAccounts = [
    {
        username: 'safirah',
        password: 'corsec2025',
        name: 'Safirah Wardinah Irianto',
        nip: '199501012020012001',
        role: 'Asisten Administrasi',
        division: 'Corporate Secretary'
    },
    {
        username: 'hartani',
        password: 'pemimpin2025',
        name: 'Hartani Djurnie',
        nip: '198001012010011001',
        role: 'Pemimpin DCS',
        division: 'Corporate Secretary'
    },
    {
        username: 'admin',
        password: 'admin123',
        name: 'Administrator',
        nip: '-',
        role: 'Administrator',
        division: 'Corporate Secretary'
    }
];

// ========================================
// INITIALIZATION
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    loadFromStorage();
    
    const savedSession = localStorage.getItem('corsecSession') || sessionStorage.getItem('corsecSession');
    if (savedSession) {
        currentUser = JSON.parse(savedSession);
        showApp();
    }
    
    updateCurrentDate();
    initializeDateInputs();
    setupDragAndDrop();
    updateDashboardStats();
    startAutoSave();
}

// BUG FIX: Tracked auto-save interval
function startAutoSave() {
    if (autoSaveInterval) clearInterval(autoSaveInterval);
    autoSaveInterval = setInterval(function() { 
        if (suratData.length > 0 || dokumenData.length > 0) saveToStorage(); 
    }, 30000);
}

// BUG FIX: Cleanup function untuk semua resources
function cleanupResources() {
    // Clear all chart timeouts
    Object.values(chartTimeouts).forEach(clearTimeout);
    chartTimeouts = {};
    
    // Clear all counter intervals
    Object.values(counterIntervals).forEach(clearInterval);
    counterIntervals = {};
    
    // Clear upload intervals
    uploadIntervals.forEach(clearInterval);
    uploadIntervals = [];
    
    // Clear auto-save
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
    }
    
    // Destroy dashboard chart safely
    try {
        if (window.monthlyChart instanceof Chart) window.monthlyChart.destroy();
    } catch(e) {
        console.warn('Chart cleanup error:', e);
    }
}

function loadFromStorage() {
    const savedSurat = localStorage.getItem('corsecSuratData');
    if (savedSurat) {
        suratData = JSON.parse(savedSurat);
    } else {
        loadSampleData();
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

function saveToStorage() {
    localStorage.setItem('corsecSuratData', JSON.stringify(suratData));
    localStorage.setItem('corsecDokumenData', JSON.stringify(dokumenData));
    localStorage.setItem('corsecNomorCounters', JSON.stringify(nomorCounters));
}

function loadSampleData() {
    const now = Date.now();
    // Sample data dengan format penomoran Bank Sulselbar yang benar
    suratData = [
        {
            id: now,
            nomor: 'SR/001/B/DCS/XII/25',
            jenis: 'Surat Biasa',
            divisi: 'Corporate Secretary',
            sifat: 'Biasa',
            tanggal: '2025-12-18',
            kepada: 'Direktur Utama Bank Sulselbar',
            perihal: 'Laporan Pelaksanaan Rapat Umum Pemegang Saham Tahunan (RUPST) 2025',
            lampiran: '3 (Tiga) Berkas',
            tembusan: 'Arsip',
            status: 'Selesai',
            files: [],
            createdAt: new Date().toISOString(),
            createdBy: 'Safirah Wardinah Irianto'
        },
        {
            id: now + 1,
            nomor: 'SK/001/DIR/XII/2025',
            jenis: 'Surat Keputusan',
            divisi: 'Direksi',
            sifat: 'Segera',
            tanggal: '2025-12-17',
            kepada: 'Seluruh Pegawai Bank Sulselbar',
            perihal: 'Pemberian Penghargaan Masa Kerja Kepada Pegawai PT Bank Sulselbar',
            lampiran: '1 (Satu) Lampiran',
            tembusan: 'Divisi Human Capital',
            status: 'Selesai',
            files: [],
            createdAt: new Date().toISOString(),
            createdBy: 'Safirah Wardinah Irianto'
        },
        {
            id: now + 2,
            nomor: 'MM/0001/DCS/XII/2025',
            jenis: 'Memo Corsec',
            divisi: 'Corporate Secretary',
            sifat: 'Biasa',
            tanggal: '2025-12-16',
            kepada: 'Divisi Human Capital',
            perihal: 'Pemberitahuan Jadwal Libur Akhir Tahun 2025',
            lampiran: '-',
            tembusan: 'Arsip',
            status: 'Proses',
            files: [],
            createdAt: new Date().toISOString(),
            createdBy: 'Safirah Wardinah Irianto'
        },
        {
            id: now + 3,
            nomor: 'SR/001/R/DCS/XII/25',
            jenis: 'Surat Rahasia',
            divisi: 'Corporate Secretary',
            sifat: 'Rahasia',
            tanggal: '2025-12-15',
            kepada: 'Dewan Komisaris',
            perihal: 'Tanggapan Surat OJK & Usulan Agenda Tambahan RUPS LB',
            lampiran: '2 (Dua) Dokumen',
            tembusan: 'Arsip',
            status: 'Draft',
            files: [],
            createdAt: new Date().toISOString(),
            createdBy: 'Safirah Wardinah Irianto'
        },
        {
            id: now + 4,
            nomor: 'SE/001/DIR/XII/2025',
            jenis: 'Surat Edaran',
            divisi: 'Direksi',
            sifat: 'Biasa',
            tanggal: '2025-12-14',
            kepada: 'Seluruh Karyawan Bank Sulselbar',
            perihal: 'Tata Cara Penggunaan Aplikasi CORSEC LENS',
            lampiran: '1 (Satu) Panduan',
            tembusan: 'Arsip',
            status: 'Selesai',
            files: [],
            createdAt: new Date().toISOString(),
            createdBy: 'Safirah Wardinah Irianto'
        },
        {
            id: now + 5,
            nomor: '001/PKS-BSSB/DJS/XII/2025',
            jenis: 'PKS',
            divisi: 'Divisi Jasa',
            sifat: 'Biasa',
            tanggal: '2025-12-13',
            kepada: 'PT Airport Lounge Indonesia',
            perihal: 'Perjanjian Penggunaan Fasilitas Airport Lounge',
            lampiran: '5 (Lima) Dokumen',
            tembusan: 'Divisi Legal',
            status: 'Selesai',
            files: [],
            createdAt: new Date().toISOString(),
            createdBy: 'Safirah Wardinah Irianto'
        }
    ];
    
    // Counter dengan format baru
    nomorCounters = {
        'Surat Biasa': 2,
        'Surat Rahasia': 2,
        'Surat Keputusan': 2,
        'Surat Edaran': 2,
        'Memo Direksi': 1,
        'Memo Corsec': 2,
        'PKS': 2,
        'MoU': 1,
        'Notulen Radir': 1,
        'Surat Tugas': 1,
        'Surat Undangan': 1,
        'Nota Dinas': 1
    };
    
    saveToStorage();
}

// ========================================
// AUTHENTICATION
// ========================================
function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    
    const user = userAccounts.find(u => 
        u.username.toLowerCase() === username.toLowerCase() && 
        u.password === password
    );
    
    if (user) {
        currentUser = {
            username: user.username,
            name: user.name,
            nip: user.nip,
            role: user.role,
            division: user.division,
            loginTime: new Date().toISOString()
        };
        
        if (rememberMe) {
            localStorage.setItem('corsecSession', JSON.stringify(currentUser));
        } else {
            sessionStorage.setItem('corsecSession', JSON.stringify(currentUser));
        }
        
        showToast('success', 'Login Berhasil', 'Selamat datang, ' + user.name + '!');
        
        setTimeout(function() {
            showApp();
        }, 500);
    } else {
        showToast('error', 'Login Gagal', 'Username atau password salah!');
        document.getElementById('password').value = '';
    }
}

function handleLogout() {
    if (confirm('Apakah Anda yakin ingin keluar?')) {
        // BUG FIX: Cleanup semua resources saat logout
        cleanupResources();
        
        currentUser = null;
        localStorage.removeItem('corsecSession');
        sessionStorage.removeItem('corsecSession');
        
        document.getElementById('appContainer').style.display = 'none';
        document.getElementById('loginPage').style.display = 'flex';
        document.getElementById('loginForm').reset();
        
        showToast('info', 'Logout', 'Anda telah keluar dari sistem');
    }
}

function showApp() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('appContainer').style.display = 'flex';
    updateUserInfo();
    navigateTo('dashboard');
}

function updateUserInfo() {
    if (currentUser) {
        var displayName = document.getElementById('userDisplayName');
        var userRole = document.getElementById('userRole');
        var headerUserName = document.getElementById('headerUserName');
        var welcomeName = document.getElementById('welcomeName');
        
        if (displayName) displayName.textContent = currentUser.name;
        if (userRole) userRole.textContent = currentUser.role;
        if (headerUserName) {
            var names = currentUser.name.split(' ');
            headerUserName.textContent = names[0] + (names[1] ? ' ' + names[1].charAt(0) + '.' : '');
        }
        if (welcomeName) welcomeName.textContent = currentUser.name.split(' ')[0];
    }
}

function togglePassword() {
    var passwordInput = document.getElementById('password');
    var eyeIcon = document.getElementById('eyeIcon');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    }
}

// ========================================
// NAVIGATION
// ========================================
function navigateTo(pageName) {
    // BUG FIX: Clear previous timeouts sebelum navigasi
    Object.values(chartTimeouts).forEach(clearTimeout);
    chartTimeouts = {};
    
    // BUG FIX: Clear upload intervals saat meninggalkan halaman upload
    uploadIntervals.forEach(clearInterval);
    uploadIntervals = [];
    
    var pages = document.querySelectorAll('.page');
    pages.forEach(function(page) {
        page.style.display = 'none';
    });
    
    var navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(function(item) {
        item.classList.remove('active');
        if (item.getAttribute('data-page') === pageName) {
            item.classList.add('active');
        }
    });
    
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
    
    var pageId = pageMap[pageName];
    if (pageId) {
        var pageElement = document.getElementById(pageId);
        if (pageElement) {
            pageElement.style.display = 'block';
        }
    }
    
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
    
    var pageTitle = document.getElementById('pageTitle');
    var breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
    
    if (pageTitle) pageTitle.textContent = titleMap[pageName] || 'Dashboard';
    if (breadcrumbCurrent) breadcrumbCurrent.textContent = titleMap[pageName] || 'Dashboard';
    
    switch(pageName) {
        case 'dashboard':
            updateDashboardStats();
            renderActivityList();
            // BUG FIX: Track timeout untuk bisa di-cancel
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
function updateCurrentDate() {
    var options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    var dateStr = new Date().toLocaleDateString('id-ID', options);
    var dateElement = document.getElementById('currentDate');
    if (dateElement) {
        dateElement.textContent = dateStr;
    }
}

function updateDashboardStats() {
    var totalSurat = suratData.length;
    var suratSelesai = suratData.filter(function(s) { return s.status === 'Selesai'; }).length;
    var suratProses = suratData.filter(function(s) { return s.status === 'Proses' || s.status === 'Draft'; }).length;
    var totalDokumen = dokumenData.length;
    
    animateCounter('totalSurat', totalSurat);
    animateCounter('suratSelesai', suratSelesai);
    animateCounter('suratProses', suratProses);
    animateCounter('totalDokumen', totalDokumen);
    
    var suratCount = document.getElementById('suratCount');
    var arsipCount = document.getElementById('arsipCount');
    if (suratCount) suratCount.textContent = totalSurat;
    if (arsipCount) arsipCount.textContent = totalDokumen;
}

function animateCounter(elementId, target) {
    var element = document.getElementById(elementId);
    if (!element) return;
    
    // BUG FIX: Clear interval lama sebelum membuat baru
    if (counterIntervals[elementId]) {
        clearInterval(counterIntervals[elementId]);
        delete counterIntervals[elementId];
    }
    
    // Jika target 0, langsung set tanpa animasi
    if (target === 0) {
        element.textContent = '0';
        return;
    }
    
    var current = 0;
    var increment = target / 50;
    counterIntervals[elementId] = setInterval(function() {
        current += increment;
        if (current >= target) {
            element.textContent = target;
            clearInterval(counterIntervals[elementId]);
            delete counterIntervals[elementId];
        } else {
            element.textContent = Math.floor(current);
        }
    }, 20);
}

function renderActivityList() {
    var activityList = document.getElementById('activityList');
    if (!activityList) return;
    
    var recentSurat = suratData.slice().sort(function(a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
    }).slice(0, 5);
    
    if (recentSurat.length === 0) {
        activityList.innerHTML = '<div style="padding: 30px; text-align: center; color: #999;"><i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 10px; display: block;"></i>Belum ada aktivitas</div>';
        return;
    }
    
    var html = '';
    recentSurat.forEach(function(surat) {
        html += '<div class="activity-item" style="cursor: pointer;" onclick="viewSuratDetail(' + surat.id + ')">';
        html += '<div class="activity-icon create"><i class="fas fa-file-alt"></i></div>';
        html += '<div class="activity-content">';
        html += '<h4>' + surat.nomor + '</h4>';
        html += '<p>' + surat.perihal.substring(0, 50) + (surat.perihal.length > 50 ? '...' : '') + '</p>';
        html += '</div></div>';
    });
    
    activityList.innerHTML = html;
}

// ========================================
// CHART HELPER - Destroy dan Clear Canvas
// ========================================
function destroyChart(chartInstance, canvasElement) {
    if (chartInstance instanceof Chart) {
        chartInstance.destroy();
    }
    if (canvasElement) {
        var ctx = canvasElement.getContext('2d');
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    }
    return null;
}

function initCharts() {
    var canvas = document.getElementById('monthlyChart');
    if (!canvas || typeof Chart === 'undefined') return;
    
    // Destroy dan clear canvas
    window.monthlyChart = destroyChart(window.monthlyChart, canvas);
    
    window.monthlyChart = new Chart(canvas, {
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
        var date = new Date(surat.tanggal);
        if (date.getFullYear() === currentYear) {
            monthlyCount[date.getMonth()]++;
        }
    });
    
    return monthlyCount;
}

// ========================================
// SURAT MANAGEMENT
// ========================================
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

function updateNomorPreview() {
    var jenisEl = document.getElementById('jenisSurat');
    var divisiEl = document.getElementById('divisiSurat');
    var nomorPreview = document.getElementById('nomorPreview');
    
    if (nomorPreview) {
        if (jenisEl && divisiEl && jenisEl.value && divisiEl.value) {
            nomorPreview.textContent = generateNomorSurat(jenisEl.value, divisiEl.value);
        } else {
            nomorPreview.textContent = '-/---/---/--/----';
        }
    }
}

// ========================================
// FUNGSI KONVERSI BULAN KE ROMAWI
// ========================================
function getBulanRomawi(month) {
    var romawi = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    return romawi[month] || 'I';
}

// ========================================
// GENERATE NOMOR SURAT - FORMAT BANK SULSELBAR
// ========================================
function generateNomorSurat(jenis, divisi, sifat) {
    var now = new Date();
    var year = now.getFullYear();
    var year2digit = String(year).slice(-2);
    var monthIndex = now.getMonth();
    var bulanRomawi = getBulanRomawi(monthIndex);
    
    var counter3 = String(nomorCounters[jenis] || 1).padStart(3, '0');
    var counter4 = String(nomorCounters[jenis] || 1).padStart(4, '0');
    
    // Kode divisi sesuai standar Bank Sulselbar
    var kodeDivisi = {
        'Corporate Secretary': 'DCS',
        'Divisi Human Capital': 'DHC',
        'Divisi Jasa': 'DJS',
        'Divisi Dana & Layanan': 'DDL',
        'Divisi Retail & Kredit': 'DRK',
        'Divisi Kredit Korporasi': 'DKK',
        'Divisi Kepatuhan': 'DKP',
        'Divisi Internasional & Business': 'DIB',
        'Divisi Umum': 'DUM',
        'SIMO': 'SIMO',
        'Manajemen Risiko': 'SKMR',
        'Direksi': 'DIR'
    };
    
    var kode = kodeDivisi[divisi] || 'DCS';
    
    // Format nomor berdasarkan jenis surat (sesuai Excel Penomoran 2025)
    switch(jenis) {
        case 'Surat Biasa':
            // Format: SR/{counter}/B/DCS/{bulan}/{tahun_2digit}
            return 'SR/' + counter3 + '/B/' + kode + '/' + bulanRomawi + '/' + year2digit;
            
        case 'Surat Rahasia':
            // Format: SR/{counter}/R/DCS/{bulan}/{tahun_2digit}
            return 'SR/' + counter3 + '/R/' + kode + '/' + bulanRomawi + '/' + year2digit;
            
        case 'Surat Keputusan':
            // Format: SK/{counter}/DIR/{bulan}/{tahun}
            return 'SK/' + counter3 + '/DIR/' + bulanRomawi + '/' + year;
            
        case 'Surat Edaran':
            // Format: SE/{counter}/DIR/{bulan}/{tahun}
            return 'SE/' + counter3 + '/DIR/' + bulanRomawi + '/' + year;
            
        case 'Memo Direksi':
            // Format: MM/{counter_4digit}/DIR/{bulan}/{tahun}
            return 'MM/' + counter4 + '/DIR/' + bulanRomawi + '/' + year;
            
        case 'Memo Corsec':
            // Format: MM/{counter_4digit}/DCS/{bulan}/{tahun}
            return 'MM/' + counter4 + '/DCS/' + bulanRomawi + '/' + year;
            
        case 'PKS':
            // Format: {counter}/PKS-BSSB/{divisi}/{bulan}/{tahun}
            return counter3 + '/PKS-BSSB/' + kode + '/' + bulanRomawi + '/' + year;
            
        case 'MoU':
            // Format: {counter}/MOU-BSSB/{bulan}/{tahun}
            return counter3 + '/MOU-BSSB/' + bulanRomawi + '/' + year;
            
        case 'Notulen Radir':
            // Format: {counter}/RADIR/{divisi}/{bulan}/{tahun}
            return counter3 + '/RADIR/' + kode + '/' + bulanRomawi + '/' + year;
            
        case 'Surat Tugas':
            // Format: ST/{counter}/DCS/{bulan}/{tahun}
            return 'ST/' + counter3 + '/' + kode + '/' + bulanRomawi + '/' + year;
            
        case 'Surat Undangan':
            // Format: UND/{counter}/DCS/{bulan}/{tahun}
            return 'UND/' + counter3 + '/' + kode + '/' + bulanRomawi + '/' + year;
            
        case 'Nota Dinas':
            // Format: ND/{counter}/DCS/{bulan}/{tahun}
            return 'ND/' + counter3 + '/' + kode + '/' + bulanRomawi + '/' + year;
            
        default:
            // Default format
            return 'SR/' + counter3 + '/' + kode + '/' + bulanRomawi + '/' + year;
    }
}

function handleCreateSurat(event) {
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
    
    var nomor = generateNomorSurat(jenis, divisi);
    
    var newSurat = {
        id: Date.now(),
        nomor: nomor,
        jenis: jenis,
        divisi: divisi,
        sifat: sifat,
        tanggal: tanggal,
        kepada: kepada,
        perihal: perihal,
        lampiran: lampiran,
        tembusan: tembusan,
        status: 'Selesai',
        files: uploadedFiles.slice(),
        createdAt: new Date().toISOString(),
        createdBy: currentUser ? currentUser.name : 'System'
    };
    
    suratData.unshift(newSurat);
    nomorCounters[jenis]++;
    saveToStorage();
    
    showToast('success', 'Surat Berhasil Dibuat', 'Nomor: ' + nomor);
    resetForm();
    
    setTimeout(function() {
        navigateTo('daftar-surat');
    }, 1000);
}

function resetForm() {
    var form = document.getElementById('suratForm');
    if (form) form.reset();
    uploadedFiles = [];
    var fileList = document.getElementById('fileList');
    if (fileList) fileList.innerHTML = '';
    initializeDateInputs();
    updateNomorPreview();
}

function saveDraft() {
    showToast('info', 'Draft Disimpan', 'Surat disimpan sebagai draft');
}

// ========================================
// SURAT TABLE
// ========================================
function renderSuratTable() {
    var tbody = document.getElementById('suratTableBody');
    if (!tbody) return;
    
    var searchEl = document.getElementById('searchSurat');
    var filterJenisEl = document.getElementById('filterJenis');
    var filterStatusEl = document.getElementById('filterStatus');
    
    var searchTerm = searchEl ? searchEl.value.toLowerCase() : '';
    var filterJenis = filterJenisEl ? filterJenisEl.value : '';
    var filterStatus = filterStatusEl ? filterStatusEl.value : '';
    
    var filteredData = suratData.filter(function(surat) {
        var match = true;
        if (searchTerm) {
            match = surat.nomor.toLowerCase().indexOf(searchTerm) > -1 ||
                    surat.perihal.toLowerCase().indexOf(searchTerm) > -1 ||
                    surat.kepada.toLowerCase().indexOf(searchTerm) > -1;
        }
        if (filterJenis) match = match && surat.jenis === filterJenis;
        if (filterStatus) match = match && surat.status === filterStatus;
        return match;
    });
    
    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 50px;"><i class="fas fa-inbox" style="font-size: 48px; color: #ccc; display: block; margin-bottom: 15px;"></i><p style="color: #999;">Tidak ada data surat</p></td></tr>';
        return;
    }
    
    var startIndex = (currentPage - 1) * itemsPerPage;
    var paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);
    
    var html = '';
    paginatedData.forEach(function(surat, index) {
        html += '<tr>';
        html += '<td>' + (startIndex + index + 1) + '</td>';
        html += '<td class="nomor-surat">' + surat.nomor + '</td>';
        html += '<td>' + formatDate(surat.tanggal) + '</td>';
        html += '<td>' + surat.jenis + '</td>';
        html += '<td title="' + surat.perihal + '">' + surat.perihal.substring(0, 40) + (surat.perihal.length > 40 ? '...' : '') + '</td>';
        html += '<td title="' + surat.kepada + '">' + surat.kepada.substring(0, 30) + (surat.kepada.length > 30 ? '...' : '') + '</td>';
        html += '<td><span class="badge badge-' + surat.status.toLowerCase() + '">' + surat.status + '</span></td>';
        html += '<td><div class="action-btns">';
        html += '<button class="action-btn view" onclick="viewSuratDetail(' + surat.id + ')" title="Lihat Detail"><i class="fas fa-eye"></i></button>';
        html += '<button class="action-btn edit" onclick="previewSurat(' + surat.id + ')" title="Preview & Print"><i class="fas fa-print"></i></button>';
        html += '<button class="action-btn download" onclick="downloadSurat(' + surat.id + ')" title="Download"><i class="fas fa-download"></i></button>';
        html += '<button class="action-btn delete" onclick="deleteSurat(' + surat.id + ')" title="Hapus"><i class="fas fa-trash"></i></button>';
        html += '</div></td></tr>';
    });
    
    tbody.innerHTML = html;
    renderPagination(filteredData.length);
}

function filterSuratList() {
    currentPage = 1;
    renderSuratTable();
}

function renderPagination(totalItems) {
    var pagination = document.getElementById('pagination');
    if (!pagination) return;
    
    var totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    var html = '<button onclick="goToPage(' + (currentPage - 1) + ')"' + (currentPage === 1 ? ' disabled' : '') + '><i class="fas fa-chevron-left"></i></button>';
    for (var i = 1; i <= totalPages; i++) {
        html += '<button onclick="goToPage(' + i + ')" class="' + (i === currentPage ? 'active' : '') + '">' + i + '</button>';
    }
    html += '<button onclick="goToPage(' + (currentPage + 1) + ')"' + (currentPage === totalPages ? ' disabled' : '') + '><i class="fas fa-chevron-right"></i></button>';
    
    pagination.innerHTML = html;
}

function goToPage(page) {
    var totalPages = Math.ceil(suratData.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderSuratTable();
}

// ========================================
// VIEW SURAT DETAIL - FIXED
// ========================================
function viewSuratDetail(id) {
    var surat = suratData.find(function(s) { return s.id === id; });
    if (!surat) {
        showToast('error', 'Error', 'Surat tidak ditemukan');
        return;
    }
    
    var modal = document.getElementById('detailModal');
    var modalBody = document.getElementById('modalBody');
    var modalFooter = document.getElementById('modalFooter');
    var modalTitle = document.getElementById('modalTitle');
    
    if (!modal || !modalBody || !modalFooter) return;
    
    if (modalTitle) modalTitle.textContent = 'Detail Surat';
    
    var sifatClass = surat.sifat === 'Sangat Segera' ? 'badge-draft' : surat.sifat === 'Segera' ? 'badge-proses' : 'badge-selesai';
    
    modalBody.innerHTML = '' +
        '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 20px;">' +
            '<div><label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px; text-transform: uppercase;">Nomor Surat</label>' +
            '<p style="font-size: 20px; font-weight: 700; color: #1B5E9E; font-family: monospace; margin: 0;">' + surat.nomor + '</p></div>' +
            '<div><label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px; text-transform: uppercase;">Tanggal</label>' +
            '<p style="font-size: 16px; color: #333; margin: 0;">' + formatDate(surat.tanggal) + '</p></div>' +
            '<div><label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px; text-transform: uppercase;">Jenis Surat</label>' +
            '<p style="font-size: 16px; color: #333; margin: 0;">' + surat.jenis + '</p></div>' +
            '<div><label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px; text-transform: uppercase;">Sifat</label>' +
            '<span class="badge ' + sifatClass + '" style="font-size: 13px; padding: 6px 14px;">' + surat.sifat + '</span></div>' +
            '<div><label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px; text-transform: uppercase;">Status</label>' +
            '<span class="badge badge-' + surat.status.toLowerCase() + '" style="font-size: 13px; padding: 6px 14px;">' + surat.status + '</span></div>' +
            '<div><label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px; text-transform: uppercase;">Divisi</label>' +
            '<p style="font-size: 16px; color: #333; margin: 0;">' + surat.divisi + '</p></div>' +
        '</div>' +
        '<hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">' +
        '<div style="margin-bottom: 20px;"><label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px; text-transform: uppercase;">Kepada</label>' +
        '<p style="font-size: 16px; color: #333; margin: 0; font-weight: 500;">' + surat.kepada + '</p></div>' +
        '<div style="margin-bottom: 20px;"><label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px; text-transform: uppercase;">Perihal</label>' +
        '<div style="background: linear-gradient(135deg, #f8f9fa, #fff); padding: 20px; border-radius: 10px; border-left: 4px solid #1B5E9E;">' +
        '<p style="font-size: 16px; color: #333; margin: 0; line-height: 1.6;">' + surat.perihal + '</p></div></div>' +
        '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 20px;">' +
            '<div><label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px; text-transform: uppercase;">Lampiran</label>' +
            '<p style="font-size: 16px; color: #333; margin: 0;">' + (surat.lampiran || '-') + '</p></div>' +
            '<div><label style="font-size: 12px; color: #666; display: block; margin-bottom: 5px; text-transform: uppercase;">Tembusan</label>' +
            '<p style="font-size: 16px; color: #333; margin: 0;">' + (surat.tembusan || '-') + '</p></div>' +
        '</div>' +
        '<hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">' +
        '<div style="background: #f8f9fa; padding: 15px; border-radius: 8px;">' +
        '<p style="font-size: 12px; color: #666; margin: 0 0 5px 0;"><i class="fas fa-user" style="width: 16px;"></i> Dibuat oleh: <strong>' + surat.createdBy + '</strong></p>' +
        '<p style="font-size: 12px; color: #666; margin: 0;"><i class="fas fa-clock" style="width: 16px;"></i> Tanggal dibuat: <strong>' + new Date(surat.createdAt).toLocaleString('id-ID') + '</strong></p></div>';
    
    modalFooter.innerHTML = '' +
        '<button class="btn-secondary" onclick="closeModal(\'detailModal\')"><i class="fas fa-times"></i> Tutup</button>' +
        '<button class="btn-secondary" onclick="previewSurat(' + surat.id + '); closeModal(\'detailModal\');"><i class="fas fa-print"></i> Preview & Print</button>' +
        '<button class="btn-primary" onclick="downloadSurat(' + surat.id + ')"><i class="fas fa-download"></i> Download</button>';
    
    modal.classList.add('active');
}

// ========================================
// PREVIEW SURAT - NEW FEATURE
// ========================================
function previewSurat(id) {
    var surat = suratData.find(function(s) { return s.id === id; });
    if (!surat) {
        showToast('error', 'Error', 'Surat tidak ditemukan');
        return;
    }
    
    var previewWindow = window.open('', '_blank', 'width=800,height=600');
    
    var previewContent = '<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
        '<title>Preview - ' + surat.nomor + '</title>' +
        '<style>' +
        '* { margin: 0; padding: 0; box-sizing: border-box; }' +
        'body { font-family: "Times New Roman", Times, serif; font-size: 12pt; line-height: 1.5; padding: 20mm; background: #f5f5f5; }' +
        '.page { background: white; padding: 20mm; max-width: 210mm; margin: 0 auto; box-shadow: 0 0 10px rgba(0,0,0,0.1); min-height: 297mm; }' +
        '.header { text-align: center; border-bottom: 3px double #1B5E9E; padding-bottom: 15px; margin-bottom: 20px; }' +
        '.header h1 { font-size: 16pt; color: #1B5E9E; margin-bottom: 2px; }' +
        '.header h2 { font-size: 14pt; color: #8BC34A; font-weight: normal; }' +
        '.header p { font-size: 10pt; color: #666; }' +
        '.surat-info { margin-bottom: 20px; }' +
        '.surat-info table { width: 100%; }' +
        '.surat-info td { padding: 3px 0; vertical-align: top; }' +
        '.surat-info td:first-child { width: 120px; }' +
        '.surat-title { text-align: center; margin: 30px 0; }' +
        '.surat-title h3 { font-size: 14pt; text-decoration: underline; margin-bottom: 5px; }' +
        '.kepada { margin-bottom: 20px; }' +
        '.perihal { margin-bottom: 30px; text-align: justify; }' +
        '.footer { margin-top: 50px; text-align: right; }' +
        '.footer .ttd { display: inline-block; text-align: center; min-width: 200px; }' +
        '.footer .ttd-space { height: 60px; }' +
        '.tembusan { margin-top: 40px; font-size: 11pt; }' +
        '.watermark { position: fixed; bottom: 20px; left: 20px; font-size: 9pt; color: #ccc; }' +
        '.print-btn { position: fixed; top: 20px; right: 20px; padding: 10px 20px; background: #1B5E9E; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; z-index: 100; }' +
        '.print-btn:hover { background: #134A7C; }' +
        '@media print { body { padding: 0; background: white; } .page { box-shadow: none; padding: 15mm; } .print-btn { display: none; } .watermark { position: absolute; } }' +
        '</style></head><body>' +
        '<button class="print-btn" onclick="window.print()">🖨️ Cetak Surat</button>' +
        '<div class="page">' +
        '<div class="header">' +
        '<h1>PT BANK PEMBANGUNAN DAERAH</h1>' +
        '<h2>SULAWESI SELATAN DAN SULAWESI BARAT</h2>' +
        '<p>Jl. Dr. Sam Ratulangi No. 16 Makassar 90125</p>' +
        '<p>Telp. (0411) 859171 • Fax. (0411) 859188 • www.banksulselbar.co.id</p>' +
        '</div>' +
        '<div class="surat-info"><table>' +
        '<tr><td>Nomor</td><td>: <strong>' + surat.nomor + '</strong></td></tr>' +
        '<tr><td>Sifat</td><td>: ' + surat.sifat + '</td></tr>' +
        '<tr><td>Lampiran</td><td>: ' + surat.lampiran + '</td></tr>' +
        '<tr><td>Perihal</td><td>: <strong>' + surat.perihal + '</strong></td></tr>' +
        '</table></div>' +
        '<div class="surat-title"><h3>' + surat.jenis.toUpperCase() + '</h3><p>Nomor: ' + surat.nomor + '</p></div>' +
        '<div class="kepada"><p>Kepada Yth.</p><p><strong>' + surat.kepada + '</strong></p><p>di Tempat</p></div>' +
        '<div class="perihal"><p>Dengan hormat,</p><br><p>' + surat.perihal + '</p><br><p>Demikian surat ini kami sampaikan, atas perhatian dan kerjasamanya kami ucapkan terima kasih.</p></div>' +
        '<div class="footer"><p>Makassar, ' + formatDateLong(surat.tanggal) + '</p><br>' +
        '<div class="ttd"><p><strong>' + surat.divisi + '</strong></p><div class="ttd-space"></div><p><strong>_______________________</strong></p><p>Pemimpin Divisi</p></div></div>' +
        '<div class="tembusan"><p><strong>Tembusan:</strong></p><p>- ' + surat.tembusan + '</p></div>' +
        '<div class="watermark">Dicetak dari CORSEC LENS pada ' + new Date().toLocaleString('id-ID') + '</div>' +
        '</div></body></html>';
    
    previewWindow.document.write(previewContent);
    previewWindow.document.close();
}

function deleteSurat(id) {
    if (confirm('Apakah Anda yakin ingin menghapus surat ini?\n\nTindakan ini tidak dapat dibatalkan.')) {
        suratData = suratData.filter(function(s) { return s.id !== id; });
        saveToStorage();
        renderSuratTable();
        updateDashboardStats();
        showToast('success', 'Berhasil', 'Surat berhasil dihapus');
    }
}

function downloadSurat(id) {
    var surat = suratData.find(function(s) { return s.id === id; });
    if (!surat) return;
    
    var content = '\n================================================================================\n' +
        '                          PT BANK SULSELBAR\n' +
        '          BANK PEMBANGUNAN DAERAH SULAWESI SELATAN DAN SULAWESI BARAT\n' +
        '================================================================================\n\n' +
        surat.jenis.toUpperCase() + '\nNomor: ' + surat.nomor + '\n\n' +
        '================================================================================\n\n' +
        'Tanggal     : ' + formatDate(surat.tanggal) + '\n' +
        'Sifat       : ' + surat.sifat + '\n' +
        'Lampiran    : ' + surat.lampiran + '\n\n' +
        '--------------------------------------------------------------------------------\n\n' +
        'Kepada Yth.\n' + surat.kepada + '\ndi Tempat\n\n' +
        'Perihal: ' + surat.perihal + '\n\n' +
        '--------------------------------------------------------------------------------\n\n' +
        'Dengan hormat,\n\n' + surat.perihal + '\n\n' +
        'Demikian surat ini kami sampaikan, atas perhatian dan kerjasamanya\n' +
        'kami ucapkan terima kasih.\n\n' +
        '                                          Makassar, ' + formatDateLong(surat.tanggal) + '\n\n' +
        '                                          ' + surat.divisi + '\n\n\n\n' +
        '                                          _______________________\n' +
        '                                          Pemimpin Divisi\n\n' +
        '--------------------------------------------------------------------------------\n\n' +
        'Tembusan:\n- ' + surat.tembusan + '\n\n' +
        '================================================================================\n' +
        'Dokumen ini dibuat secara elektronik melalui CORSEC LENS\n' +
        'Divisi Corporate Secretary - Bank Sulselbar\n' +
        'Dicetak pada: ' + new Date().toLocaleString('id-ID') + '\n' +
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
               surat.perihal.replace(/"/g, '""') + '","' + surat.kepada.replace(/"/g, '""') + '","' + 
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
    // BUG FIX: Prevent multiple event listener registration
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
            var files = e.dataTransfer.files;
            if (zone === dropZone) handleFiles(files);
            else handleUploadFiles(files);
        });
    });
    
    dragDropInitialized = true;
}

function handleFileSelect(event) { handleFiles(event.target.files); }

function handleFiles(files) {
    var fileList = document.getElementById('fileList');
    if (!fileList) return;
    
    Array.from(files).forEach(function(file) {
        if (file.size > 10 * 1024 * 1024) {
            showToast('error', 'Error', 'File ' + file.name + ' terlalu besar (max 10MB)');
            return;
        }
        if (uploadedFiles.find(function(f) { return f.name === file.name; })) {
            showToast('warning', 'Perhatian', 'File ' + file.name + ' sudah ditambahkan');
            return;
        }
        uploadedFiles.push({ name: file.name, size: file.size, type: file.type });
        
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

function handleUploadFile(event) { handleUploadFiles(event.target.files); }

function handleUploadFiles(files) {
    var kategoriEl = document.getElementById('uploadKategori');
    var keteranganEl = document.getElementById('uploadKeterangan');
    var uploadQueue = document.getElementById('uploadQueue');
    
    var kategori = kategoriEl ? kategoriEl.value : 'Umum';
    var keterangan = keteranganEl ? keteranganEl.value : '';
    
    if (!uploadQueue) return;
    
    Array.from(files).forEach(function(file) {
        if (file.size > 25 * 1024 * 1024) {
            showToast('error', 'Error', 'File ' + file.name + ' terlalu besar (max 25MB)');
            return;
        }
        
        var uploadItem = document.createElement('div');
        uploadItem.className = 'upload-item';
        uploadItem.innerHTML = '<div class="upload-item-icon"><i class="fas ' + getFileIcon(file.type) + '"></i></div>' +
            '<div class="upload-item-info"><div class="name">' + file.name + '</div>' +
            '<div class="upload-progress"><div class="upload-progress-bar" style="width: 0%"></div></div></div>';
        uploadQueue.appendChild(uploadItem);
        
        var progress = 0;
        var progressBar = uploadItem.querySelector('.upload-progress-bar');
        var interval = setInterval(function() {
            // BUG FIX: Check if element still exists before updating
            if (!progressBar || !uploadItem.parentNode) {
                clearInterval(interval);
                var idx = uploadIntervals.indexOf(interval);
                if (idx > -1) uploadIntervals.splice(idx, 1);
                return;
            }
            
            progress += Math.random() * 30;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                
                // BUG FIX: Remove from tracked intervals
                var idx = uploadIntervals.indexOf(interval);
                if (idx > -1) uploadIntervals.splice(idx, 1);
                
                dokumenData.push({
                    id: Date.now() + Math.random(),
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    kategori: kategori,
                    keterangan: keterangan,
                    uploadedAt: new Date().toISOString(),
                    uploadedBy: currentUser ? currentUser.name : 'System'
                });
                
                saveToStorage();
                
                setTimeout(function() {
                    if (uploadItem.parentNode) uploadItem.remove();
                    showToast('success', 'Upload Berhasil', file.name);
                    var arsipCount = document.getElementById('arsipCount');
                    if (arsipCount) arsipCount.textContent = dokumenData.length;
                }, 500);
            }
            if (progressBar) progressBar.style.width = progress + '%';
        }, 200);
        
        // BUG FIX: Track interval untuk cleanup
        uploadIntervals.push(interval);
    });
}

// ========================================
// DOKUMEN & FOLDER MANAGEMENT
// ========================================
function renderDokumenGrid() {
    var grid = document.getElementById('dokumenGrid');
    if (!grid) return;
    
    var searchEl = document.getElementById('searchDokumen');
    var filterEl = document.getElementById('filterKategori');
    var searchTerm = searchEl ? searchEl.value.toLowerCase() : '';
    var filterKategori = filterEl ? filterEl.value : '';
    
    var filteredData = dokumenData.filter(function(doc) {
        var match = true;
        if (searchTerm) match = doc.name.toLowerCase().indexOf(searchTerm) > -1;
        if (filterKategori) match = match && doc.kategori === filterKategori;
        return match;
    });
    
    if (filteredData.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; padding: 60px; text-align: center;">' +
            '<i class="fas fa-folder-open" style="font-size: 64px; color: #ccc; margin-bottom: 15px;"></i>' +
            '<p style="color: #999;">Tidak ada dokumen</p>' +
            '<button class="btn-primary" style="margin-top: 20px;" onclick="navigateTo(\'upload-dokumen\')">' +
            '<i class="fas fa-upload"></i> Upload Dokumen</button></div>';
        return;
    }
    
    var html = '';
    filteredData.forEach(function(doc) {
        html += '<div class="dokumen-card" onclick="viewDokumen(\'' + doc.id + '\')">' +
            '<div class="dokumen-card-icon ' + getFileClass(doc.type) + '"><i class="fas ' + getFileIcon(doc.type) + '"></i></div>' +
            '<h4 title="' + doc.name + '">' + doc.name + '</h4>' +
            '<p>' + formatFileSize(doc.size) + ' • ' + formatDate(doc.uploadedAt) + '</p>' +
            '<span class="dokumen-card-badge">' + doc.kategori + '</span></div>';
    });
    grid.innerHTML = html;
}

function filterDokumenList() { renderDokumenGrid(); }

function setView(view) {
    var gridBtn = document.getElementById('gridViewBtn');
    var listBtn = document.getElementById('listViewBtn');
    if (gridBtn) gridBtn.classList.toggle('active', view === 'grid');
    if (listBtn) listBtn.classList.toggle('active', view === 'list');
}

function viewDokumen(id) {
    var doc = dokumenData.find(function(d) { return d.id == id; });
    if (doc) showToast('info', 'Dokumen', doc.name + '\nKategori: ' + doc.kategori + '\nUkuran: ' + formatFileSize(doc.size));
}

function renderFolderTree() {
    var folderTree = document.getElementById('folderTree');
    if (!folderTree) return;
    
    var html = '';
    suratData.forEach(function(surat) {
        var files = dokumenData.filter(function(d) { return d.suratId === surat.id; });
        // BUG FIX: Pass event parameter
        html += '<div class="folder-tree-item" onclick="openFolder(' + surat.id + ', \'surat\', event)">' +
            '<i class="fas fa-file-alt"></i><span title="' + surat.perihal + '">' + surat.nomor.replace(/\//g, '-').substring(0, 25) + '</span>' +
            (files.length > 0 ? '<span style="margin-left: auto; font-size: 11px; color: #999; background: #eee; padding: 2px 6px; border-radius: 10px;">' + files.length + '</span>' : '') +
            '</div>';
    });
    
    ['Surat Masuk', 'Laporan', 'Notulen', 'Umum', 'Lainnya'].forEach(function(cat) {
        var files = dokumenData.filter(function(d) { return d.kategori === cat && !d.suratId; });
        // BUG FIX: Pass event parameter
        html += '<div class="folder-tree-item" onclick="openFolder(\'' + cat + '\', \'category\', event)">' +
            '<i class="fas fa-folder"></i><span>' + cat + '</span>' +
            (files.length > 0 ? '<span style="margin-left: auto; font-size: 11px; color: #999; background: #eee; padding: 2px 6px; border-radius: 10px;">' + files.length + '</span>' : '') +
            '</div>';
    });
    
    folderTree.innerHTML = html;
}

// BUG FIX: Tambahkan event parameter
function openFolder(folderId, type, evt) {
    var folderContent = document.getElementById('folderContent');
    if (!folderContent) return;
    
    var files = [];
    var folderTitle = '';
    
    if (type === 'surat') {
        var surat = suratData.find(function(s) { return s.id == folderId; });
        if (surat) {
            files = dokumenData.filter(function(d) { return d.suratId == surat.id; });
            folderTitle = surat.nomor;
        }
    } else {
        files = dokumenData.filter(function(d) { return d.kategori === folderId && !d.suratId; });
        folderTitle = folderId;
    }
    
    document.querySelectorAll('.folder-tree-item').forEach(function(item) { item.classList.remove('active'); });
    // BUG FIX: Use evt parameter instead of global event
    if (evt && evt.target) {
        var target = evt.target.closest('.folder-tree-item');
        if (target) target.classList.add('active');
    }
    
    if (files.length === 0) {
        folderContent.innerHTML = '<div style="text-align: center; padding: 40px;"><i class="fas fa-folder-open" style="font-size: 48px; color: #ccc;"></i>' +
            '<p style="color: #999; margin-top: 15px;">Folder <strong>' + folderTitle + '</strong> kosong</p></div>';
        return;
    }
    
    var html = '<h3 style="margin-bottom: 20px; color: #1B5E9E;"><i class="fas fa-folder-open"></i> ' + folderTitle + '</h3>' +
        '<div class="dokumen-grid" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));">';
    files.forEach(function(doc) {
        html += '<div class="dokumen-card" onclick="viewDokumen(\'' + doc.id + '\')">' +
            '<div class="dokumen-card-icon ' + getFileClass(doc.type) + '"><i class="fas ' + getFileIcon(doc.type) + '"></i></div>' +
            '<h4 title="' + doc.name + '">' + doc.name.substring(0, 20) + (doc.name.length > 20 ? '...' : '') + '</h4>' +
            '<p>' + formatFileSize(doc.size) + '</p></div>';
    });
    html += '</div>';
    folderContent.innerHTML = html;
}

// ========================================
// REPORTS & SETTINGS
// ========================================
function previewReport() {
    showToast('info', 'Preview', 'Fitur preview laporan - silahkan gunakan Export atau Print');
}

function generateReport() {
    exportToExcel();
}

function saveSettings() {
    var nameEl = document.getElementById('settingName');
    var nipEl = document.getElementById('settingNIP');
    var jabatanEl = document.getElementById('settingJabatan');
    
    if (currentUser && nameEl) {
        currentUser.name = nameEl.value;
        if (nipEl) currentUser.nip = nipEl.value;
        if (jabatanEl) currentUser.role = jabatanEl.value;
        localStorage.setItem('corsecSession', JSON.stringify(currentUser));
        updateUserInfo();
    }
    showToast('success', 'Pengaturan', 'Pengaturan berhasil disimpan');
}

function showChangePassword() {
    showToast('info', 'Ubah Password', 'Fitur ubah password dalam pengembangan');
}

// ========================================
// MODAL & TOAST
// ========================================
function closeModal(modalId) {
    var modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
};

function showToast(type, title, message) {
    var container = document.getElementById('toastContainer');
    if (!container) return;
    
    var icons = { success: 'fa-check', error: 'fa-times', warning: 'fa-exclamation', info: 'fa-info' };
    
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML = '<div class="toast-icon"><i class="fas ' + (icons[type] || 'fa-info') + '"></i></div>' +
        '<div class="toast-content"><h4>' + title + '</h4><p>' + message + '</p></div>' +
        '<button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>';
    
    container.appendChild(toast);
    
    setTimeout(function() {
        if (toast.parentElement) {
            toast.style.animation = 'toastSlide 0.3s ease reverse';
            setTimeout(function() { toast.remove(); }, 300);
        }
    }, 5000);
}

// ========================================
// UTILITY FUNCTIONS
// ========================================
function formatDate(dateString) {
    if (!dateString) return '-';
    var date = new Date(dateString);
    var options = { day: '2-digit', month: 'short', year: 'numeric' };
    return date.toLocaleDateString('id-ID', options);
}

function formatDateLong(dateString) {
    if (!dateString) return '-';
    var date = new Date(dateString);
    var options = { day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('id-ID', options);
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    var k = 1024;
    var sizes = ['Bytes', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(type) {
    if (!type) return 'fa-file';
    if (type.indexOf('pdf') > -1) return 'fa-file-pdf';
    if (type.indexOf('word') > -1 || type.indexOf('document') > -1) return 'fa-file-word';
    if (type.indexOf('excel') > -1 || type.indexOf('spreadsheet') > -1) return 'fa-file-excel';
    if (type.indexOf('image') > -1) return 'fa-file-image';
    return 'fa-file';
}

function getFileClass(type) {
    if (!type) return '';
    if (type.indexOf('pdf') > -1) return 'pdf';
    if (type.indexOf('word') > -1 || type.indexOf('document') > -1) return 'doc';
    if (type.indexOf('excel') > -1 || type.indexOf('spreadsheet') > -1) return 'xls';
    if (type.indexOf('image') > -1) return 'img';
    return '';
}

function handleGlobalSearch(event) {
    if (event.key === 'Enter') {
        var query = event.target.value.trim();
        if (query) {
            navigateTo('daftar-surat');
            setTimeout(function() {
                var searchInput = document.getElementById('searchSurat');
                if (searchInput) {
                    searchInput.value = query;
                    filterSuratList();
                }
            }, 100);
        }
    }
}

function toggleNotifications() {
    showToast('info', 'Notifikasi', 'Tidak ada notifikasi baru');
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.ctrlKey && e.key === 'n') { e.preventDefault(); if (currentUser) navigateTo('buat-surat'); }
    if (e.ctrlKey && e.key === 'd') { e.preventDefault(); if (currentUser) navigateTo('dashboard'); }
    if (e.key === 'Escape') { document.querySelectorAll('.modal.active').forEach(function(m) { m.classList.remove('active'); }); }
});

// BUG FIX: Auto-save sekarang dikelola oleh startAutoSave() yang ter-track
// setInterval yang lama telah dihapus untuk mencegah memory leak

// Window resize
window.addEventListener('resize', function() {
    if (window.innerWidth > 1024) {
        var sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('active');
    }
});

// BUG FIX: Cleanup saat page unload
window.addEventListener('beforeunload', function() {
    cleanupResources();
});

console.log('CORSEC LENS v1.0.3 - Chart Bug Fixed - Loaded Successfully');
