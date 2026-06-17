import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';
import { auth, db } from './firebase-config';
import logoSmaich from "./assets/logo-smaich.png";
import TabPengguna from './TabPengguna';
import TabBankSoal from './TabBankSoal';
import TabHasil from './TabHasil';
import TabAnalytics from './TabAnalytics';

export default function Dashboard() {
    const navigate = useNavigate();
    
    const [userProfile, setUserProfile] = useState(null);
    const [activeTab, setActiveTab] = useState('beranda');
    const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') === 'dark');
    
    const [statSiswa, setStatSiswa] = useState(0);
    const [statSoal, setStatSoal] = useState(0);
    const [statUjian, setStatUjian] = useState(0);

    // Jam Real-time (Sudah diperbaiki)
    const [timeString, setTimeString] = useState('Menghubungkan waktu server...');
    useEffect(() => {
        const timer = setInterval(() => {
            const sekarang = new Date();
            const strTanggal = sekarang.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const strJam = sekarang.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':');
            setTimeString(`${strTanggal} | ${strJam} WIB`);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) { navigate('/'); return; }
            const roles = JSON.parse(localStorage.getItem("userRole") || "[]");
            if (!roles.includes("admin") && !roles.includes("guru")) navigate('/exam'); 
            else setUserProfile({ nama: user.displayName || "Guru/Admin", email: user.email });
        });
        return () => unsubscribe();
    }, [navigate]);

    useEffect(() => {
        if (isDarkMode) { document.body.classList.add('dark-mode'); localStorage.setItem('theme', 'dark'); } 
        else { document.body.classList.remove('dark-mode'); localStorage.setItem('theme', 'light'); }
    }, [isDarkMode]);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const usersSnap = await getDocs(collection(db, "users"));
                setStatSiswa(usersSnap.size);

                const soalSnap = await getDocs(collection(db, "bank_soal"));
                const paketUnik = new Set();
                soalSnap.forEach(doc => { 
                    const data = doc.data(); 
                    if(data.mataPelajaran) {
                        // Menggabungkan Mapel dan Kelas sebagai 1 Paket Ujian
                        const kls = Array.isArray(data.kelas) ? [...data.kelas].sort().join(', ') : (data.kelas || 'Umum');
                        paketUnik.add(`${data.mataPelajaran}_${kls}`); 
                    }
                });
                setStatSoal(paketUnik.size); // Sekarang menghitung total Paket Ujian

                const hasilSnap = await getDocs(collection(db, "hasil_ujian"));
                setStatUjian(hasilSnap.size);
            } catch (error) { console.error("Gagal mengambil statistik:", error); }
        };
        if (activeTab === 'beranda') fetchStats();
    }, [activeTab]);

    const handleLogout = async () => {
        if (window.confirm("Yakin ingin keluar dari aplikasi?")) {
            await signOut(auth);
            localStorage.clear();
            navigate('/');
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'beranda':
                return (
                    <div className="content-section active" style={{ animation: 'fadeIn 0.4s ease' }}>
                        <div className="welcome-banner" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--info) 100%)', padding: '35px 40px', borderRadius: 'var(--radius-lg)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
                            <div>
                                <h2 style={{ fontSize: '1.4rem', marginBottom: 5 }}>Assalamu'alaikum, {userProfile?.nama} 🙏</h2>
                                <p style={{ margin: 0, opacity: 0.9 }}>Selamat Datang di Portal CBT-SMAICH</p>
                            </div>
                            <button onClick={() => navigate('/exam')} className="btn-3d" style={{ backgroundColor: 'var(--warning)', color: 'white', margin: 0 }}>
                                <i className="fas fa-laptop-code"></i> Tinjau Ujian
                            </button>
                        </div>

                        {/* KARTU STATISTIK SEBAGAI NAVIGASI */}
                        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 30 }}>
                            <div className="stat-card" onClick={() => setActiveTab('pengguna')} style={{ background: 'white', padding: '25px 30px', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                                <div><p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold' }}>Akses Pengguna</p><h3 style={{ fontSize: '2.2rem', margin: 0, color: 'var(--secondary)' }}>{statSiswa}</h3></div>
                                <div style={{ color: 'var(--info)', fontSize: '2.5rem' }}><i className="fas fa-users"></i></div>
                            </div>
                            
                            {/* PERBAIKAN TEKS: Teks diubah menjadi "Bank Soal" */}
                            <div className="stat-card" onClick={() => setActiveTab('soal')} style={{ background: 'white', padding: '25px 30px', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                                <div><p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold' }}>Bank Soal</p><h3 style={{ fontSize: '2.2rem', margin: 0, color: 'var(--secondary)' }}>{statSoal}</h3></div>
                                <div style={{ color: 'var(--warning)', fontSize: '2.5rem' }}><i className="fas fa-file-alt"></i></div>
                            </div>
                            
                            <div className="stat-card" onClick={() => setActiveTab('hasil')} style={{ background: 'white', padding: '25px 30px', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                                <div><p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'bold' }}>Capaian Siswa</p><h3 style={{ fontSize: '2.2rem', margin: 0, color: 'var(--secondary)' }}>{statUjian}</h3></div>
                                <div style={{ color: 'var(--success)', fontSize: '2.5rem' }}><i className="fas fa-chart-bar"></i></div>
                            </div>
                        </div>

                        {/* GRAFIK ANALYTICS TEPAT DI BAWAH KARTU */}
                        <div style={{ animation: 'fadeIn 0.6s ease' }}>
                            <TabAnalytics />
                        </div>
                    </div>
                );
            case 'soal': return <TabBankSoal />;
            case 'pengguna': return <TabPengguna />;
            case 'hasil': return <TabHasil />;
            default: return null;
        }
    };

    return (
        <div className="app-layout" style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--bg-main)' }}>
            
            {/* HEADER MODERN DENGAN LOGO DI TENGAH */}
            <header className="app-header" style={{ position: 'sticky', top: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', zIndex: 1000, width: '100%' }}>
                
                {/* Bagian Kiri: Tombol Kembali Otomatis (Hanya muncul jika membuka sub-menu) */}
                <div style={{ width: 50, display: 'flex', justifyContent: 'flex-start' }}>
                    {activeTab !== 'beranda' && (
                        <button onClick={() => setActiveTab('beranda')} className="btn-icon" title="Kembali ke Beranda" style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--text-muted)' }}>
                            <i className="fas fa-arrow-left"></i>
                        </button>
                    )}
                </div> 
                
                {/* Bagian Tengah: Logo Sekolah Sempurna Berada di Tengah */}
                <div style={{ cursor: 'pointer', textAlign: 'center', flex: 1 }} onClick={() => setActiveTab('beranda')} title="Kembali ke Beranda">
                    <img src={logoSmaich} alt="Logo Smaich" className="brand-logo" onError={(e)=>e.target.src='https://via.placeholder.com/40x40?text=CBT'} style={{ height: 45, margin: '0 auto' }} />
                    <div id="realtime-clock" style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', marginTop: 3, letterSpacing: '0.2px', textTransform: 'uppercase' }}>
                        <i className="far fa-calendar-alt"></i> {timeString}
                    </div>
                </div>
                
                {/* Bagian Kanan: Dark Mode Toggle */}
                <div style={{ width: 50, display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => setIsDarkMode(!isDarkMode)} className="btn-icon" title="Mode Gelap/Terang" style={{ fontSize: '1.4rem', color: 'var(--text-muted)', border: 'none', background: 'transparent', cursor: 'pointer', padding: 5 }}>
                        <i className={isDarkMode ? "fas fa-sun" : "fas fa-moon"}></i>
                    </button>
                </div>
            </header>

            {/* AREA KONTEN UTAMA */}
            <div className="main-wrapper" style={{ flex: 1, overflowY: 'auto' }}>
                <main className="main-content" style={{ maxWidth: 1400, margin: '0 auto', padding: 30, width: '100%' }}>
                    {renderContent()}
                </main>
            </div>

            {/* TOMBOL LOGOUT HANYA IKON (LINGKARAN) */}
            <button 
                onClick={handleLogout} 
                style={{ 
                    position: 'fixed', 
                    bottom: 30, 
                    right: 30, 
                    background: '#ef4444', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '50%', 
                    width: 55, 
                    height: 55, 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    boxShadow: '0 10px 15px -3px rgba(239, 68, 68, 0.4)', 
                    zIndex: 9999, 
                    cursor: 'pointer',
                    fontSize: '1.25rem'
                }} 
                title="Keluar dari Aplikasi"
            >
                <i className="fas fa-sign-out-alt"></i>
            </button>
        </div>
    );
}