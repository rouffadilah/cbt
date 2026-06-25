import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, where, addDoc } from 'firebase/firestore';
import { auth, db } from './firebase-config';
import logoSmaich from "./assets/logo-smaich.png";

export default function ExamAttempt() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    
    const [isExamActive, setIsExamActive] = useState(false);
    const [student, setStudent] = useState(null);
    const [loading, setLoading] = useState(false);
    
    const [inputNama, setInputNama] = useState('');
    const [selectedKelas, setSelectedKelas] = useState('');
    const [selectedMapel, setSelectedMapel] = useState('');
    const [tokenInput, setTokenInput] = useState('');
    const [showTokenField, setShowTokenField] = useState(true);
    
    const [listKelas, setListKelas] = useState([]);
    const [listMapel, setListMapel] = useState([]);
    
    const [arraySoal, setArraySoal] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [jawabanSiswa, setJawabanSiswa] = useState({});
    const [raguRagu, setRaguRagu] = useState({});
    const [durasiDetik, setDurasiDetik] = useState(0);
    const [pelanggaran, setPelanggaran] = useState(0);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') === 'dark');

    const maxPelanggaran = 3;
    const timerIntervalRef = useRef(null);
    const isPrivilegedRef = useRef(false);

    const [testMode, setTestMode] = useState('preview'); 
    const originalPrivilegeRef = useRef(false); // Menyimpan role asli untuk jaga-jaga
    
    // Pengunci loop alert saat jendela kehilangan fokus
    const isAlertShowingRef = useRef(false); 

    // Jam Real-time
    const [timeString, setTimeString] = useState('Menghubungkan waktu server...');
    useEffect(() => {
        const timer = setInterval(() => {
            const sekarang = new Date();
            const strTanggal = sekarang.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const strJam = ThermalClock(sekarang);
            setTimeString(`${strTanggal} | ${strJam} WIB`);
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const ThermalClock = (d) => {
        return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':');
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) return;
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const roles = userData.role || [];
                    
                    const isStaff = roles.includes('admin') || roles.includes('guru');
                    isPrivilegedRef.current = isStaff;
                    originalPrivilegeRef.current = isStaff; // Tambahkan baris ini
                    
                    setStudent({ uid: user.uid, ...userData });
                    setInputNama(userData.nama || user.displayName || '');
                } else navigate('/dashboard');
            } catch (e) { console.error(e); }
        });
        return () => unsubscribe();
    }, [navigate]);
    
    useEffect(() => {
        const loadAkademik = async () => {
            try {
                const docSnap = await getDoc(doc(db, "pengaturan", "data_akademik"));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setListKelas(data.list_kelas || []);
                    setListMapel(data.list_mapel || []);
                    const urlMapel = searchParams.get('mapel');
                    const urlKelas = searchParams.get('kelas');
                    if (urlMapel || urlKelas) {
                        setShowTokenField(false);
                        setTokenInput('BYPASS');
                        if (urlMapel) setSelectedMapel(urlMapel);
                        if (urlKelas) setSelectedKelas(urlKelas);
                    }
                }
            } catch (e) { console.error(e); }
        };
        loadAkademik();
    }, [searchParams]);

    useEffect(() => {
        const checkTokenRequired = async () => {
            const urlMapel = searchParams.get('mapel');
            const urlKelas = searchParams.get('kelas');
            if (urlMapel || urlKelas || !selectedKelas || !selectedMapel) return;
            try {
                const tSnap = await getDoc(doc(db, "pengaturan", "token_ujian"));
                if (tSnap.exists()) {
                    const tokenData = tSnap.data();
                    const tokenKey = `token_${selectedMapel}_${selectedKelas}`;
                    if (tokenData[tokenKey] && tokenData[tokenKey].code && tokenData[tokenKey].code.trim() !== '') {
                        setShowTokenField(true); setTokenInput('');
                    } else { setShowTokenField(false); setTokenInput('BYPASS'); }
                }
            } catch (e) { console.log(e); }
        };
        checkTokenRequired();
    }, [selectedKelas, selectedMapel, searchParams]);

    useEffect(() => {
        if (isDarkMode) { document.body.classList.add('dark-mode'); localStorage.setItem('theme', 'dark'); } 
        else { document.body.classList.remove('dark-mode'); localStorage.setItem('theme', 'light'); }
    }, [isDarkMode]);

    // ==========================================
    // LAYER SECURITY 1: PERTAHANAN KEYBOARD & KLIK
    // ==========================================
    useEffect(() => {
        const handleContextMenu = (e) => { if (!isPrivilegedRef.current) e.preventDefault(); };
        const handleClipboard = (e) => { if (!isPrivilegedRef.current) e.preventDefault(); };
        const handleKeyDown = (e) => {
            if (isPrivilegedRef.current) return;
            const forbidden = ['F12', 'PrintScreen', 'Meta', 'OS', 'ContextMenu'];
            if (forbidden.includes(e.key) || (e.ctrlKey && ['c', 'v', 'x', 'u', 'p', 's', 'a', 'f'].includes(e.key.toLowerCase())) || (e.ctrlKey && e.shiftKey && ['i', 'j', 'c', 's'].includes(e.key.toLowerCase()))) { 
                e.preventDefault(); 
            }
        };
        
        document.addEventListener('contextmenu', handleContextMenu);
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('copy', handleClipboard);
        document.addEventListener('cut', handleClipboard);
        document.addEventListener('paste', handleClipboard);
        
        return () => { 
            document.removeEventListener('contextmenu', handleContextMenu); 
            document.removeEventListener('keydown', handleKeyDown); 
            document.removeEventListener('copy', handleClipboard);
            document.removeEventListener('cut', handleClipboard);
            document.removeEventListener('paste', handleClipboard);
        };
    }, []);

    // ==========================================
    // LAYER SECURITY 2: DETEKSI GAIB (TAB & WINDOW BLUR)
    // ==========================================
    useEffect(() => {
        if (!isExamActive || isPrivilegedRef.current) return;

        const pemicuPelanggaranDefansif = (pesan) => {
            if (isAlertShowingRef.current) return; 
            document.body.style.filter = "blur(30px)";
            pemicuPelanggaran(pesan);
        };

        const handleVisibilityChange = () => { 
            if (document.hidden) pemicuPelanggaranDefansif("Sistem mendeteksi Anda meminimalkan browser atau membuka tab baru!"); 
        };

        const handleWindowBlur = () => {
            // Menangkap split screen atau klik di luar jendela ujian
            pemicuPelanggaranDefansif("Fokus Ujian Hilang! Anda terdeteksi mengklik aplikasi lain atau melakukan split screen!");
        };

        const handleFullscreenChange = () => { 
            if (!document.fullscreenElement) pemicuPelanggaranDefansif("Mode Layar Penuh (Fullscreen) dimatikan secara sengaja!"); 
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleWindowBlur);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => { 
            document.removeEventListener('visibilitychange', handleVisibilityChange); 
            window.removeEventListener('blur', handleWindowBlur);
            document.removeEventListener('fullscreenchange', handleFullscreenChange); 
        };
    }, [isExamActive, pelanggaran]);

    const pemicuPelanggaran = (alasan) => {
        isAlertShowingRef.current = true;
        const upPelanggaran = pelanggaran + 1;
        setPelanggaran(upPelanggaran);

        if (upPelanggaran >= maxPelanggaran) {
            clearInterval(timerIntervalRef.current);
            setIsExamActive(false);
            alert(`Ujian dihentikan! Anda telah mencapai batas maksimal ${maxPelanggaran} kali pelanggaran.\n\nPelanggaran Terakhir: ${alasan}`);
            isAlertShowingRef.current = false;
            eksekusiSelesaiUjian("DISKUALIFIKASI", upPelanggaran);
        } else {
            alert(`TINDAKAN KECURANGAN TERDETEKSI!\n\nAlasan: ${alasan}\n\nPeringatan Ke: ${upPelanggaran} dari ${maxPelanggaran}.\nJika melanggar lagi, ujian otomatis dikunci & nilai dinolkan.`);
            document.body.style.filter = "none";
            isAlertShowingRef.current = false;
            masukFullscreen();
        }
    };

    const masukFullscreen = () => { if (isPrivilegedRef.current) return; const el = document.documentElement; if (el.requestFullscreen) el.requestFullscreen().catch(() => {}); };
    const keluarFullscreen = () => { if (document.fullscreenElement && document.exitFullscreen) { document.exitFullscreen().catch(() => {}); } };

    // ==========================================
    // LAYER SECURITY 3: ENKRIPSI AUTO SAVE LOKAL
    // ==========================================
    const triggerAutosaveLokal = (jwbUpdate, raguUpdate) => {
        if (!student || !selectedMapel) return;
        const paketData = {
            jawabanSiswa: jwbUpdate,
            raguRagu: raguUpdate,
            savedAt: Date.now()
        };
        // Enkripsi Base64 sederhana agar tidak bisa diedit di Application tab DevTools
        const encrypted = btoa(unescape(encodeURIComponent(JSON.stringify(paketData))));
        localStorage.setItem(`cbt_secure_ans_${student.uid}_${selectedMapel}`, encrypted);
    };

    const muatAutosaveLokal = (studentId, mapelKey) => {
        const dataMentah = localStorage.getItem(`cbt_secure_ans_${studentId}_${mapelKey}`);
        if (!dataMentah) return null;
        try {
            const decrypted = JSON.parse(decodeURIComponent(escape(atob(dataMentah))));
            return decrypted;
        } catch(e) {
            console.error("Gagal memulihkan jawaban cadangan lokal karena enkripsi rusak.");
            return null;
        }
    };

    const handleMulaiUjian = async () => {
        if (!student && !inputNama.trim()) return alert("Silakan isi Nama Lengkap Anda!");
        if (!selectedMapel || !selectedKelas) return alert("Pilih Mapel dan Kelas Anda!");
        let currentStudentData = student;
        if (!currentStudentData) {
            currentStudentData = { uid: "publik-" + Date.now(), nama: inputNama.trim(), username: "Tanpa Akun", kelas: selectedKelas };
            setStudent(currentStudentData);
        }
        masukFullscreen(); setLoading(true);

        try {
            const jadwalKey = `${selectedMapel}_${selectedKelas}`;
            const tokenKeyDb = `token_${selectedMapel}_${selectedKelas}`;
            const [timeSnap, tokenSnap, acakSnap] = await Promise.all([ getDoc(doc(db, "pengaturan", "waktu_ujian")), getDoc(doc(db, "pengaturan", "token_ujian")), getDoc(doc(db, "pengaturan", "acak_soal")) ]);

            if (showTokenField && tokenInput !== 'BYPASS') {
                let currentTokenDb = "";
                if (tokenSnap.exists() && tokenSnap.data()[tokenKeyDb]) {
                    const tData = tokenSnap.data()[tokenKeyDb];
                    currentTokenDb = typeof tData === 'object' ? tData.code : tData;
                }
                if (currentTokenDb && tokenInput.toUpperCase().trim() !== currentTokenDb) throw new Error("Token yang Anda masukkan SALAH!");
            }

            let durasiMenit = 90;
            if (timeSnap.exists() && timeSnap.data()[jadwalKey]) durasiMenit = parseInt(timeSnap.data()[jadwalKey]);
            setDurasiDetik(durasiMenit * 60);

            const qSoal = query(collection(db, "bank_soal"), where("mataPelajaran", "==", selectedMapel));
            const soalSnap = await getDocs(qSoal);
            let listSoalLoaded = [];
            
            soalSnap.forEach(d => {
                let data = d.data();
                let arrKelas = Array.isArray(data.kelas) ? data.kelas : [data.kelas];
                if (arrKelas.includes(selectedKelas) || arrKelas.includes("Umum") || arrKelas.length === 0) listSoalLoaded.push({ id: d.id, ...data });
            });

            if (listSoalLoaded.length === 0) throw new Error("Soal belum tersedia untuk kelas & mapel ini.");

            let isAcak = acakSnap.exists() && acakSnap.data()[jadwalKey];
            if (isAcak) {
                for (let i = listSoalLoaded.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [listSoalLoaded[i], listSoalLoaded[j]] = [listSoalLoaded[j], listSoalLoaded[i]];
                }
            } else { listSoalLoaded.sort((a, b) => (a.nomor_soal || 0) - (b.nomor_soal || 0)); }

            // Memulihkan data jawaban otomatis jika mati lampu/mati jaringan internet
            const dataPulih = muatAutosaveLokal(currentStudentData.uid, selectedMapel);
            if (dataPulih) {
                if (dataPulih.jawabanSiswa) setJawabanSiswa(dataPulih.jawabanSiswa);
                if (dataPulih.raguRagu) setRaguRagu(dataPulih.raguRagu);
            }
           // SINKRONISASI HAK ISTIMEWA SEBELUM MASUK UJIAN
            const roleLocal = (localStorage.getItem("userRole") || "").toLowerCase();
            const roleDb = (currentStudentData?.role || []).join(",").toLowerCase();
            const isStaffUser = roleLocal.includes("admin") || roleLocal.includes("guru") || 
                                roleDb.includes("admin") || roleDb.includes("guru");

            if (isStaffUser) {
                if (testMode === 'simulate_student') {
                    isPrivilegedRef.current = false; // Matikan hak istimewa (akan terdeteksi melanggar jika buka tab)
                } else {
                    isPrivilegedRef.current = true;  // Anda bebas memantau soal tanpa takut ditendang sistem
                }
            }

            setArraySoal(listSoalLoaded); 
            setIsExamActive(true); 
            jalankanTimerCountdown();       
        } catch (e) { keluarFullscreen(); alert(e.message); } finally { setLoading(false); }
    };

    const jalankanTimerCountdown = () => {
        timerIntervalRef.current = setInterval(() => {
            setDurasiDetik((prevDetik) => {
                if (prevDetik <= 1) { clearInterval(timerIntervalRef.current); alert("Waktu ujian telah habis! Jawaban otomatis dikirim."); eksekusiSelesaiUjian("WAKTU HABIS", pelanggaran); return 0; }
                return prevDetik - 1;
            });
        }, 1000);
    };

    const formatWaktu = (totalDetik) => {
        const j = Math.floor(totalDetik / 3600).toString().padStart(2, '0');
        const m = Math.floor((totalDetik % 3600) / 60).toString().padStart(2, '0');
        const d = (totalDetik % 60).toString().padStart(2, '0');
        return `${j}:${m}:${d}`;
    };

    const handleInputJawaban = (soalId, value, tipeSoal) => {
        let updated = { ...jawabanSiswa };
        if (tipeSoal === 'PGK') {
            let currentArr = updated[soalId] || [];
            if (currentArr.includes(value)) currentArr = currentArr.filter(v => v !== value);
            else currentArr.push(value);
            updated[soalId] = currentArr;
        } else { updated[soalId] = value; }
        setJawabanSiswa(updated); triggerAutosaveLokal(updated, raguRagu);
    };

    const handleInputMenjodohkan = (soalId, kiri, kanan) => {
        let updated = { ...jawabanSiswa }; let currentObj = updated[soalId] || {};
        currentObj[kiri] = kanan; updated[soalId] = currentObj;
        setJawabanSiswa(updated); triggerAutosaveLokal(updated, raguRagu);
    };

    const toggleRaguRagu = (soalId) => {
        let updated = { ...raguRagu, [soalId]: !raguRagu[soalId] };
        setRaguRagu(updated); triggerAutosaveLokal(jawabanSiswa, updated);
    };

    const checkSelesaiUjian = () => {
        let dijawab = 0;
        arraySoal.forEach(s => {
            let ans = jawabanSiswa[s.id]; let tipe = (s.tipe || 'PG').toUpperCase();
            if (tipe === 'PG' && ans) dijawab++;
            else if (tipe === 'PGK' && Array.isArray(ans) && ans.length > 0) dijawab++;
            else if (tipe === 'MENJODOHKAN' && typeof ans === 'object' && Object.values(ans).some(v => v !== '')) dijawab++;
            else if (tipe === 'ESSAY' && ans && ans.trim() !== '') dijawab++;
        });

        let infoMsg = `Anda telah menjawab ${dijawab} dari ${arraySoal.length} soal.`;
        if (dijawab < arraySoal.length) infoMsg += `\n\n⚠️ Masih ada ${arraySoal.length - dijawab} soal KOSONG.`;
        if (Object.values(raguRagu).includes(true)) infoMsg += `\n\n⚠️ Terdapat soal RAGU-RAGU.`;

        if (window.confirm(`${infoMsg}\n\nApakah Anda YAKIN ingin mengumpulkan lembar ujian?`)) {
            clearInterval(timerIntervalRef.current); eksekusiSelesaiUjian("NORMAL", pelanggaran);
        }
    };

    const eksekusiSelesaiUjian = async (statusAkhir, finalPelanggaran) => {
        setIsExamActive(false); keluarFullscreen(); setLoading(true);
        let totalBobotPG = 0; let skorDiperolehPG = 0;

        arraySoal.forEach(s => {
            const tipeSoal = (s.tipe || 'PG').toUpperCase();
            const bobot = parseFloat(s.bobot) || 1;
            const jwb = jawabanSiswa[s.id];

            if (tipeSoal === 'PG') {
                totalBobotPG += bobot;
                if (jwb === (s.kunci_jawaban || s.jawaban_benar)) skorDiperolehPG += bobot;
            } else if (tipeSoal === 'PGK') {
                totalBobotPG += bobot; let kunciArr = s.kunci_jawaban || []; let jwbArr = jwb || [];
                if (kunciArr.length > 0 && jwbArr.length === kunciArr.length && kunciArr.every(k => jwbArr.includes(k))) skorDiperolehPG += bobot;
            } else if (tipeSoal === 'MENJODOHKAN' && s.pasangan) {
                totalBobotPG += bobot; let totalPairs = s.pasangan.length; let correctPairs = 0; let jwbObj = jwb || {};
                s.pasangan.forEach(p => { if (jwbObj[p.kiri] === p.kanan) correctPairs++; });
                if (totalPairs > 0) skorDiperolehPG += (correctPairs / totalPairs) * bobot;
            }
        });

        let skorAkhir = totalBobotPG > 0 ? Math.round((skorDiperolehPG / totalBobotPG) * 100) : 0;
        const payload = { uid: student.uid, nama: student.nama, username: student.username, kelas: selectedKelas, mataPelajaran: selectedMapel, jawaban: jawabanSiswa, pelanggaran: finalPelanggaran, skorPG: skorAkhir, skor: skorAkhir, waktuSubmit: new Date().toISOString(), statusPelanggaran: statusAkhir };

        try {
            await addDoc(collection(db, "hasil_ujian"), payload);
            // Hapus cadangan enkripsi setelah sukses mengirim agar memori browser bersih kembali
            localStorage.removeItem(`cbt_secure_ans_${student.uid}_${selectedMapel}`);
            alert("Lembar jawaban Anda berhasil direkam dengan aman oleh server!");
            navigate('/dashboard'); 
        } catch (e) { alert("Gagal Menyimpan! Hubungi pengawas ruangan dan JANGAN tutup halaman ini."); } finally { setLoading(false); }
    };

    const handleKeluarPortal = async () => {
        if (window.confirm("Yakin ingin membatalkan dan kembali ke halaman Login?")) {
            await signOut(auth); localStorage.clear(); navigate('/dashboard');
        }
    };

    // --- RENDER PORTAL SEBELUM UJIAN ---
    if (!isExamActive) {
        // DETEKSI ROLE SUPER KETAT (Bypass Case Sensitive & Null)
        const roleLocal = (localStorage.getItem("userRole") || "").toLowerCase();
        const roleDb = (student?.role || []).join(",").toLowerCase();
        const isStaff = roleLocal.includes("admin") || roleLocal.includes("guru") || 
                        roleDb.includes("admin") || roleDb.includes("guru");

        return (
            <div className="pre-exam-container" style={{ position: 'relative' }}>
                <button className="btn-attempt-dark-mode" onClick={() => setIsDarkMode(!isDarkMode)} style={{ position: 'absolute', top: 15, right: 15, background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--secondary)' }}>
                    <i className={isDarkMode ? "fas fa-sun" : "fas fa-moon"}></i>
                </button>
                <div className="login-container" style={{ margin: '0 auto' }}>
                    <div className="login-card" style={{ padding: '35px 30px' }}>
                        
                        <div className="login-header" style={{ marginBottom: 20 }}>
                            <span className="login-badge" style={{ marginBottom: 12 }}><i className="fas fa-file-signature"></i> Portal Ujian</span>
                            <img src={logoSmaich} alt="Logo Smaich" className="main-logo" style={{ margin: '0 auto 8px auto', height: 70 }} onError={(e)=>e.target.src='https://via.placeholder.com/80?text=Logo'} />
                            <div className="realtime-clock" style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                                <i className="far fa-calendar-alt"></i> {timeString}
                            </div>
                        </div>

                        <div className="warning-box" style={{ padding: '12px 15px', fontSize: '0.8rem', textAlign: 'left', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', borderRadius: 8 }}>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}><i className="fas fa-shield-alt"></i> Pengawasan Aktif</div>
                            Keluar dari layar penuh atau membuka tab lain otomatis memicu pelanggaran sistem.
                        </div>

                        <div style={{ margin: '15px 0' }}>
                            <input type="text" className="input-text" placeholder="Nama Lengkap" value={inputNama} onChange={(e) => setInputNama(e.target.value)} disabled={!!auth.currentUser} />
                        </div>

                        <div className="input-group" style={{ marginBottom: 15 }}>
                            <select className="input-text" value={selectedKelas} onChange={(e) => setSelectedKelas(e.target.value)}>
                                <option value="" disabled>-- Pilih Kelas Anda --</option>
                                {listKelas.map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                        </div>

                        <div className="input-group" style={{ marginBottom: 15 }}>
                            <select className="input-text" value={selectedMapel} onChange={(e) => setSelectedMapel(e.target.value)}>
                                <option value="" disabled>-- Pilih Mapel Ujian --</option>
                                {listMapel.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>

                        {showTokenField && (
                            <div className="input-group" style={{ marginBottom: 25 }}>
                                <input type="text" className="input-text" placeholder="TOKEN UJIAN" value={tokenInput} onChange={(e) => setTokenInput(e.target.value.toUpperCase())} style={{ textTransform: 'uppercase', fontSize: '1.15rem', fontWeight: 800, letterSpacing: 4, textAlign: 'center', color: 'var(--danger)' }} />
                            </div>
                        )}

                        {/* ============================================== */}
                        {/* FITUR MODE PENGUJIAN (HANYA MUNCUL JIKA STAFF) */}
                        {/* ============================================== */}
                        {isStaff && (
                            <div className="input-group" style={{ marginBottom: 25, background: '#eff6ff', padding: '15px', borderRadius: '8px', border: '1px solid #bfdbfe', textAlign: 'left' }}>
                                <label style={{display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#1e40af', marginBottom: 10}}>
                                    <i className="fas fa-user-shield"></i> Mode Uji Coba (Khusus Guru)
                                </label>
                                <select 
                                    className="input-text" 
                                    value={testMode} 
                                    onChange={(e) => setTestMode(e.target.value)}
                                    style={{ background: 'white', color: '#1e40af', fontWeight: 'bold', width: '100%' }}
                                >
                                    <option value="preview">Hanya Tinjau Soal (Bypass Keamanan)</option>
                                    <option value="simulate_student">Simulasi Siswa (Keamanan Ketat)</option>
                                </select>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'center', gap: 15, marginTop: 10 }}>
                            <button onClick={handleKeluarPortal} className="btn-exit-modern" style={{ padding: '10px 20px', minWidth: 120, justifyContent: 'center' }}>Keluar</button>
                            <button onClick={handleMulaiUjian} className="btn-3d" style={{ padding: '10px 20px', minWidth: 120, margin: 0 }} disabled={loading}>
                                {loading ? 'Memuat...' : 'Mulai'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- RENDER WORKSPACE UTAMA UJIAN AKTIF ---
    const currentSoal = arraySoal[currentIndex];
    const tipeSoal = (currentSoal?.tipe || 'PG').toUpperCase();

    return (
        <div id="exam-workspace" style={{ display: 'flex', height: '100vh', flexDirection: 'column', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>
            <header className="exam-header">
                <div className="exam-header-center">
                    <img src={logoSmaich} alt="Logo" onError={(e)=>e.target.src='https://via.placeholder.com/120x40?text=CBT'} style={{ height: 42, width: 'auto', objectFit: 'contain' }} />
                </div>
                
                <div className="exam-header-bottom">
                    <div className="exam-header-left">
                        <h3 id="exam-mapel-title" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--secondary)', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>UJIAN: {selectedMapel.toUpperCase()}</h3>
                        <p id="exam-student-name" style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{student?.nama} ({student?.username})</p>
                        <div className="realtime-clock-display" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <i className="far fa-clock"></i> {timeString.split('|')[1]}
                        </div>
                    </div>
                    
                    <div className="exam-header-right">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="btn-toggle-nav btn-3d btn-secondary" style={{ padding: '8px 10px', margin: 0, fontSize: '1rem' }}><i className="fas fa-th-large"></i></button>
                    </div>
                </div>
            </header>

            <div className="exam-body" style={{ display: 'flex', flex: 1, overflow: 'hidden', width: '100%' }}>
                <main className="question-area" style={{ flex: 1, padding: 30, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: 'white' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25, paddingBottom: 15, borderBottom: '2px dashed var(--border-color)' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>Soal No. <span style={{ color: 'var(--primary)', fontSize: '1.5rem' }}>{currentIndex + 1}</span></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, border: '1.5px solid var(--border-color)' }}>
                                <i className="fas fa-stopwatch" style={{ color: 'var(--danger)' }}></i>
                                <span style={{ fontFamily: 'monospace', fontSize: '1.05rem', fontWeight: 800, color: 'var(--danger)' }}>{formatWaktu(durasiDetik)}</span>
                            </div>
                            <div style={{ background: 'var(--info)', color: 'white', padding: '5px 12px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 'bold' }}>{tipeSoal}</div>
                        </div>
                    </div>

                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '1.1rem', lineHeight: '1.6', marginBottom: 15 }} dangerouslySetInnerHTML={{ __html: currentSoal?.teks_soal || currentSoal?.pertanyaan }} />
                        
                        {currentSoal?.media_soal && currentSoal.media_soal.url && (
                            <div style={{ marginBottom: 20, textAlign: 'center' }}>
                                {currentSoal.media_soal.type === 'image' && <img src={currentSoal.media_soal.url} alt="Media Soal" style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8 }} />}
                                {currentSoal.media_soal.type === 'video' && <video src={currentSoal.media_soal.url} controls style={{ maxWidth: '100%', borderRadius: 8 }} />}
                                {currentSoal.media_soal.type === 'audio' && <audio src={currentSoal.media_soal.url} controls style={{ width: '100%' }} />}
                            </div>
                        )}

                        {tipeSoal === 'PG' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {['A', 'B', 'C', 'D', 'E'].map(o => {
                                    const opsiText = currentSoal?.opsi?.[o] || currentSoal?.[`opsi${o}`];
                                    if (!opsiText) return null;
                                    const isChecked = jawabanSiswa[currentSoal.id] === o;
                                    return (
                                        <label key={o} className={`option-label ${isChecked ? 'selected' : ''}`}>
                                            <input type="radio" name="answer_pg" value={o} checked={isChecked} onChange={() => handleInputJawaban(currentSoal.id, o, 'PG')} style={{ marginRight: 12 }} />
                                            <span><b>{o}.</b> {opsiText}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}

                        {tipeSoal === 'PGK' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {['A', 'B', 'C', 'D', 'E'].map(o => {
                                    const opsiText = currentSoal?.opsi?.[o] || currentSoal?.[`opsi${o}`];
                                    if (!opsiText) return null;
                                    const isChecked = (jawabanSiswa[currentSoal.id] || []).includes(o);
                                    return (
                                        <label key={o} className={`option-label ${isChecked ? 'selected' : ''}`}>
                                            <input type="checkbox" name="answer_pgk" value={o} checked={isChecked} onChange={() => handleInputJawaban(currentSoal.id, o, 'PGK')} style={{ marginRight: 12 }} />
                                            <span><b>{o}.</b> {opsiText}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}

                        {tipeSoal === 'MENJODOHKAN' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {(currentSoal?.pasangan || []).map((p, pIdx) => {
                                    const selectedKanan = (jawabanSiswa[currentSoal.id] || {})[p.kiri] || '';
                                    return (
                                        <div key={pIdx} style={{ display: 'flex', flexDirection: 'column', background: '#f8fafc', padding: 15, border: '1px solid #cbd5e1', borderRadius: 8 }}>
                                            <div style={{ fontWeight: 600, marginBottom: 10 }}>{p.kiri}</div>
                                            <select className="input-text" value={selectedKanan} onChange={(e) => handleInputMenjodohkan(currentSoal.id, p.kiri, e.target.value)} style={{ background: 'white' }}>
                                                <option value="">-- Pilih Pasangan --</option>
                                                {(currentSoal?.pasangan || []).map((pSub, sIdx) => (
                                                    <option key={sIdx} value={pSub.kanan}>{pSub.kanan}</option>
                                                ))}
                                            </select>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {tipeSoal === 'ESSAY' && (
                            <textarea className="input-text" rows={5} placeholder="Ketik jawaban uraian Anda di sini..." value={jawabanSiswa[currentSoal.id] || ''} onChange={(e) => handleInputJawaban(currentSoal.id, e.target.value, 'ESSAY')} style={{ resize: 'vertical' }} />
                        )}
                    </div>

                    {/* NAVIGASI BAWAH BAR */}
                    <div className="nav-bottom-container" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 20 }}>
                        <button onClick={() => setCurrentIndex(currentIndex - 1)} style={{ visibility: currentIndex === 0 ? 'hidden' : 'visible', background: '#475569', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
                            &laquo; Sebelumnya
                        </button>
                        
                        <label style={{ background: '#f59e0b', color: 'white', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', margin: 0 }}>
                            <input type="checkbox" checked={!!raguRagu[currentSoal?.id]} onChange={() => toggleRaguRagu(currentSoal.id)} style={{ transform: 'scale(1.3)' }} /> Ragu-ragu
                        </label>
                        
                        {currentIndex === arraySoal.length - 1 ? (
                            <button onClick={checkSelesaiUjian} style={{ background: '#ef4444', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
                                Selesai <i className="fas fa-check"></i>
                            </button>
                        ) : (
                            <button onClick={() => setCurrentIndex(currentIndex + 1)} style={{ background: '#10b981', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
                                Selanjutnya &raquo;
                            </button>
                        )}
                    </div>
                </main>

                {/* SIDEBAR NOMOR SOAL */}
                <aside className={`sidebar-area ${isSidebarOpen ? 'open' : ''}`} style={{ width: 320, background: '#f8fafc', padding: 25, display: 'flex', flexDirection: 'column', overflowY: 'auto', borderLeft: '1px solid #e2e8f0' }}>
                    <h3 style={{ marginBottom: 20, color: '#334155' }}><i className="fas fa-list-ol"></i> Navigasi Soal</h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(45px, 1fr))', gap: 10, alignContent: 'start' }}>
                        {arraySoal.map((s, idx) => {
                            let isFilled = false;
                            let ans = jawabanSiswa[s.id];
                            let t = (s.tipe || 'PG').toUpperCase();
                            if (t === 'PG' && ans) isFilled = true;
                            if (t === 'PGK' && Array.isArray(ans) && ans.length > 0) isFilled = true;
                            if (t === 'MENJODOHKAN' && typeof ans === 'object' && Object.values(ans).some(v => v !== '')) isFilled = true;
                            if (t === 'ESSAY' && ans && ans.trim() !== '') isFilled = true;

                            let bgColor = 'white';
                            let textColor = '#475569';
                            let borderStyle = '1px solid #cbd5e1';

                            if (raguRagu[s.id]) {
                                bgColor = '#f59e0b';
                                textColor = 'white';
                                borderStyle = '1px solid #d97706';
                            } else if (isFilled) {
                                bgColor = '#10b981';
                                textColor = 'white';
                                borderStyle = '1px solid #059669';
                            }

                            if (currentIndex === idx) {
                                borderStyle = '3px solid #3b82f6';
                            }

                            return (
                                <button 
                                    key={s.id} 
                                    onClick={() => { setCurrentIndex(idx); setIsSidebarOpen(false); }} 
                                    style={{ 
                                        background: bgColor, 
                                        color: textColor, 
                                        border: borderStyle,
                                        padding: '12px 0',
                                        borderRadius: '6px',
                                        fontWeight: 'bold',
                                        fontSize: '0.95rem',
                                        cursor: 'pointer',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                    }}
                                >
                                    {idx + 1}
                                </button>
                            );
                        })}
                    </div>
                    
                    <div style={{ marginTop: 'auto', paddingTop: 20, textAlign: 'center' }}>
                        <div style={{ color: '#ef4444', fontWeight: 'bold', marginBottom: 10 }}>
                            <i className="fas fa-exclamation-triangle"></i> Pelanggaran: {pelanggaran}/{maxPelanggaran}
                        </div>
                        <button onClick={checkSelesaiUjian} style={{ width: '100%', background: '#ef4444', color: 'white', padding: '12px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
                            <i className="fas fa-flag-checkered"></i> Kumpulkan Ujian
                        </button>
                    </div>
                </aside>
            </div>
            
            {/* Watermark Pengawasan */}
            <div style={{ position: 'fixed', bottom: 10, left: 10, pointerEvents: 'none', opacity: 0.15, fontSize: '0.8rem', fontWeight: 'bold', color: '#000', zIndex: 9999 }}>
                {student?.nama} | Secure CBT-SMAICH
            </div>
        </div>
    );
}
