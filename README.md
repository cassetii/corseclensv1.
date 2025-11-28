# CORSEC LENS
## Aplikasi Penomoran Naskah Dinas
### PT Bank Pembangunan Daerah Sulawesi Selatan dan Sulawesi Barat

---

## 📋 Deskripsi

**CORSEC LENS** adalah aplikasi penomoran naskah dinas yang dikembangkan khusus untuk Divisi Corporate Secretary PT Bank Sulselbar. Aplikasi ini dibangun menggunakan HTML5, CSS3, dan JavaScript murni (vanilla) tanpa framework tambahan.

Aplikasi ini dibuat berdasarkan **Kerangka Acuan Kerja (KAK)** pengadaan Aplikasi Penomoran Naskah Dinas yang akan menjadi milik Divisi Corporate Secretary PT Bank Sulselbar secara utuh.

---

## ✨ Fitur Utama

### 🔐 Autentikasi Login
- Sistem login dengan username dan password
- Session management (Remember Me)
- Multi-user support dengan role berbeda

### 📝 Penomoran Otomatis
- Format nomor: `[KODE_JENIS]/[COUNTER]/[DIVISI]/[BULAN]/[TAHUN]`
- Counter otomatis untuk setiap jenis surat
- Preview nomor surat sebelum disimpan

### 📂 Manajemen Dokumen
- Upload dokumen pendukung (PDF, DOC, DOCX, XLS, XLSX)
- Drag & drop file upload
- Auto-create folder berdasarkan nomor dan perihal surat
- Arsip dokumen dengan kategori

### 📊 Dashboard & Statistik
- Statistik real-time
- Grafik bulanan
- Activity log
- Quick actions

### 📑 Laporan
- Export data ke Excel/CSV
- Cetak laporan
- Filter berdasarkan periode

---

## 👤 Akun Demo

| Username | Password | Role |
|----------|----------|------|
| safirah | corsec2025 | Asisten Administrasi |
| hartani | pemimpin2025 | Pemimpin DCS |
| admin | admin123 | Administrator |

---

## 🎨 Branding & Color Palette

Aplikasi menggunakan color palette resmi Bank Sulselbar:

| Warna | Hex Code | Penggunaan |
|-------|----------|------------|
| Primary Blue | #1B5E9E | Header, Sidebar, Buttons |
| Primary Green | #8BC34A | Aksen, Badge, Success |
| Blue Dark | #134A7C | Hover, Active States |
| Green Light | #A5D16C | Highlights |

---

## 📁 Struktur File

```
corsec-lens/
├── index.html              # File HTML utama
├── styles.css              # Stylesheet dengan color palette Bank Sulselbar
├── app.js                  # JavaScript dengan semua fungsi aplikasi
├── logo-bank-sulselbar.png # Logo Bank Sulselbar
└── README.md               # Dokumentasi
```

---

## 🚀 Cara Menjalankan

1. **Download** semua file dalam satu folder
2. Pastikan file `logo-bank-sulselbar.png` ada di folder yang sama
3. **Buka** file `index.html` menggunakan browser modern
4. **Login** menggunakan akun demo yang tersedia

---

## 📱 Format Penomoran

### Kode Jenis Surat

| Kode | Jenis Surat |
|------|-------------|
| SK | Surat Keluar |
| MI | Memo Internal |
| KEP | Surat Keputusan |
| SE | Surat Edaran |
| UND | Surat Undangan |
| ST | Surat Tugas |
| ND | Nota Dinas |

### Kode Divisi

| Kode | Divisi |
|------|--------|
| CORSEC | Corporate Secretary |
| COMP | Direktorat Kepatuhan |
| SDM | Divisi SDM |
| KRD | Divisi Kredit |
| DANA | Divisi Dana |
| OPS | Divisi Operasional |
| IT | Divisi IT |
| LEG | Divisi Legal |
| UMM | Divisi Umum |

### Contoh Format

```
SK/001/CORSEC/11/2025
MI/015/SDM/11/2025
KEP/003/COMP/11/2025
```

---

## 💾 Penyimpanan Data

- Data disimpan di **localStorage** browser
- Auto-save setiap 30 detik
- Backup otomatis saat membuat surat baru
- Data tetap tersimpan meskipun browser ditutup

### Reset Data

Untuk reset semua data, buka Console browser dan jalankan:
```javascript
localStorage.clear();
location.reload();
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Fungsi |
|----------|--------|
| Ctrl + N | Buat surat baru |
| Ctrl + D | Kembali ke Dashboard |
| Escape | Tutup modal |

---

## 📋 Fitur Sesuai KAK

Berdasarkan Kerangka Acuan Kerja, aplikasi ini memenuhi:

1. ✅ Penomoran naskah dinas otomatis
2. ✅ Dikelola oleh Divisi Corporate Secretary
3. ✅ Branding perusahaan Bank Sulselbar
4. ✅ Tanpa biaya pelaksanaan (swakelola)
5. ✅ Kepemilikan penuh tanpa jangka waktu tertentu
6. ✅ Mendukung POJK No. 12/POJK.03/2021 tentang transformasi bank digital

---

## 👥 Tim Pelaksana

- **Ketua Tim**: Hartani Djurnie (Pemimpin DCS)
- **User**: Safirah Wardinah Irianto (Asisten Administrasi)

---

## 🔒 Keamanan

- Autentikasi login wajib
- Session timeout otomatis
- Data tersimpan lokal (tidak dikirim ke server)
- Privasi data terjaga

---

## 📞 Informasi

**Divisi Corporate Secretary**
PT Bank Pembangunan Daerah Sulawesi Selatan dan Sulawesi Barat
(Bank Sulselbar)

---

## 📄 Lisensi

Aplikasi ini adalah milik penuh **PT Bank Sulselbar** dan dikelola oleh **Divisi Corporate Secretary**.

---

**CORSEC LENS v1.0.0**
© 2025 PT Bank Sulselbar - Divisi Corporate Secretary
