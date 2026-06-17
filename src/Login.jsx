import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase-config';
import logoSmaich from "./assets/logo-smaich.png";
import './index.css'; 

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') === 'dark');
    
    const navigate = useNavigate();

    // Jam Real-time
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

    // Efek Mode Gelap
    useEffect(() => {
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-mode');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    // PROTEKSI AKUN HANTU DI HALAMAN LOGIN
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    // Cek apakah akun ini masih ADA di database Firestore
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (!userDoc.exists()) {
                        // Jika dihapus oleh admin, paksa keluar dan bersihkan memori
                        await signOut(auth);
                        localStorage.clear();
                        setMessage({ type: 'error', text: 'Akses Ditolak: Akun Anda telah dihapus secara permanen oleh Administrator.' });
                    } else {
                        // Jika aman, lanjutkan ke halaman sesuai Role
                        const userData = userDoc.data();
                        const roles = userData.role || [];
                        localStorage.setItem("userRole", JSON.stringify(roles));
                        
                        if (roles.includes("admin") || roles.includes("guru")) navigate('/dashboard');
                        else if (roles.includes("siswa")) navigate('/exam');
                    }
                } catch (error) {
                    console.error("Gagal memvalidasi sesi:", error);
                }
            }
        });
        return () => unsubscribe();
    }, [navigate]);

    const handleManualLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: 'info', text: 'Memverifikasi kredensial Anda...' });

        const formattedUsername = username.trim().toLowerCase();
        const dummyEmail = formattedUsername.includes("@") ? formattedUsername : `${formattedUsername}@cbt.smaich.id`;

        try {
            const userCred = await signInWithEmailAndPassword(auth, dummyEmail, password);
            const userDoc = await getDoc(doc(db, "users", userCred.user.uid));

            if (!userDoc.exists()) {
                await signOut(auth);
                throw new Error("Akun terdaftar di Auth, namun profil di Database tidak ditemukan (Telah dihapus).");
            }

            const userData = userDoc.data();
            const roles = userData.role || [];
            localStorage.setItem("userRole", JSON.stringify(roles));

            if (roles.includes('guru') || roles.includes('admin')) {
                localStorage.setItem("userMapel", JSON.stringify(userData.mapel || []));
                localStorage.setItem("userKelas", JSON.stringify(userData.kelas || []));
                navigate('/dashboard');
            } else {
                navigate('/exam');
            }
        } catch (error) {
            console.error("Detail Error Firebase:", error); 
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                setMessage({ type: 'error', text: 'Kredensial tidak valid. Periksa kembali username/password Anda.' });
            } else if (error.code === 'permission-denied') {
                setMessage({ type: 'error', text: 'Akses ditolak oleh database. Periksa aturan (Rules) Firestore.' });
            } else {
                setMessage({ type: 'error', text: `Sistem Error: ${error.message}` });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            const userDocRef = doc(db, "users", result.user.uid);
            const userDocSnap = await getDoc(userDocRef);

            let roles = ['siswa'];
            if (!userDocSnap.exists()) {
                await setDoc(userDocRef, {
                    nama: result.user.displayName || "Siswa Baru",
                    username: result.user.email,
                    role: roles,
                    kelas: ['Umum']
                });
            } else {
                roles = userDocSnap.data().role || ['siswa'];
            }
            
            localStorage.setItem("userRole", JSON.stringify(roles));
            navigate(roles.includes('guru') || roles.includes('admin') ? '/dashboard' : '/exam');
        } catch (error) {
            setMessage({ type: 'error', text: 'Gagal masuk dengan Google.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page-bg">
            <button className="btn-icon" onClick={() => setIsDarkMode(!isDarkMode)} style={{ position: 'absolute', top: 20, right: 20, fontSize: '1.4rem', color: 'var(--text-muted)', zIndex: 1000 }}>
                <i className={isDarkMode ? "fas fa-sun" : "fas fa-moon"}></i>
            </button>

            <div className="login-container">
                <div className="login-card">
                    <div className="login-header" style={{ marginBottom: 20 }}>
                        <span className="login-badge" style={{ marginBottom: 12 }}><i className="fas fa-shield-alt"></i>CBT-SMAICH</span>
                        <img src={logoSmaich} alt="Logo Smaich" className="main-logo" style={{ height: 70, margin: '0 auto 12px auto' }} onError={(e)=>e.target.src='https://via.placeholder.com/80?text=Logo'} />
                        <div className="realtime-clock" style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)', margin: '4px 0 14px 0', textTransform: 'uppercase' }}>
                            <i className="far fa-calendar-alt"></i> {timeString}
                        </div>
                    </div>

                    {message && (
                        <div className={`auth-status ${message.type}`}>
                            {message.text}
                        </div>
                    )}

                    <form onSubmit={handleManualLogin}>
                        <div className="input-group">
                            <input type="text" className="input-text" placeholder="Username / NIS / NIP" value={username} onChange={(e) => setUsername(e.target.value)} required />
                        </div>
                        <div className="input-group">
                            <input type="password" className="input-text" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                        </div>
                        <button type="submit" className="btn-3d" disabled={loading}>
                            {loading ? <><i className="fas fa-spinner fa-spin"></i> MEMPROSES...</> : <><i className="fas fa-sign-in-alt"></i> MASUK</>}
                        </button>
                    </form>

                    <div style={{ textAlign: 'center', margin: '15px 0', color: 'var(--text-muted)' }}>ATAU</div>

                    <button type="button" onClick={handleGoogleLogin} className="btn-3d" disabled={loading} style={{ backgroundColor: 'white', color: '#475569', border: '1px solid #cbd5e1', width: '100%' }}>
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" style={{ width: 20 }} />
                        Masuk dengan Akun Google
                    </button>
                </div>
            </div>
        </div>
    );
}