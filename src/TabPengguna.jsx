import React, { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase-config';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

// Fungsi bantuan diletakkan di luar komponen agar memori lebih efisien & tidak memicu eror re-render
const generateSortKey = (kode) => {
    if (kode && kode.length >= 4) {
        const prefix = kode.substring(0, 3); // Contoh: E24
        const status = kode.charAt(3);       // Contoh: T atau H
        const suffix = kode.substring(4);    // Sisa kode di belakangnya
        
        let sortStatus = status;
        if (status === 'T') sortStatus = '1';      // Angka 1 menang atas 2, sehingga T naik ke atas H
        else if (status === 'H') sortStatus = '2'; 
        
        return prefix + sortStatus + suffix;
    }
    return kode || "";
};

export default function TabPengguna() {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    const [openGuru, setOpenGuru] = useState(true);
    const [openGmail, setOpenGmail] = useState(false);
    const [openSiswa, setOpenSiswa] = useState(true);

    const [fGuruId, setFGuruId] = useState('');
    const [fGuruNama, setFGuruNama] = useState('');
    const [fGuruRole, setFGuruRole] = useState('');
    const [fGuruDetail, setFGuruDetail] = useState('');
    const [fGmailEmail, setFGmailEmail] = useState('');
    const [fGmailNama, setFGmailNama] = useState('');
    const [fSiswaNis, setFSiswaNis] = useState('');
    const [fSiswaNama, setFSiswaNama] = useState('');
    const [fSiswaRole, setFSiswaRole] = useState('');
    const [fSiswaKelas, setFSiswaKelas] = useState('');

    const [showEditModal, setShowEditModal] = useState(false);
    const [editData, setEditData] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const [showAddModal, setShowAddModal] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [excelFile, setExcelFile] = useState(null);
    const [spreadsheetLink, setSpreadsheetLink] = useState('');
    const [newUserData, setNewUserData] = useState({ 
        username: '', nama: '', password: '', role: 'siswa', mapel: '', kelas: '' 
    });

    useEffect(() => {
        // PELINDUNG EROR: Mengamankan pembacaan userRole dari localStorage agar tidak crash
        try {
            const storedRole = localStorage.getItem("userRole");
            if (storedRole) {
                if (storedRole.startsWith("[")) {
                    const rolesArray = JSON.parse(storedRole);
                    setIsAdmin(rolesArray.includes("admin"));
                } else {
                    setIsAdmin(storedRole.trim().toLowerCase() === "admin");
                }
            }
        } catch (error) {
            console.error("Gagal membaca role login:", error);
            setIsAdmin(false);
        }
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "users"));
            const usersData = [];
            querySnapshot.forEach((doc) => {
                usersData.push({ uid: doc.id, ...doc.data() });
            });
            setUsers(usersData);
        } catch (error) { 
            console.error(error); 
        } finally { 
            setLoading(false); 
        }
    };

    const getRoleDisplay = (roleData) => Array.isArray(roleData) ? roleData.join(", ") : (roleData || "-");
    const getArrayString = (arrData) => Array.isArray(arrData) ? arrData.join(", ") : (arrData || "-");

    const handleSaveAddManual = async (e) => {
        e.preventDefault();
        setIsAdding(true);
        try {
            const roleArr = newUserData.role.split(',').map(s => s.trim()).filter(s => s);
            const mapelArr = newUserData.mapel.split(',').map(s => s.trim()).filter(s => s);
            const kelasArr = newUserData.kelas.split(',').map(s => s.trim()).filter(s => s);

            await setDoc(doc(db, "users", newUserData.username), {
                username: newUserData.username, nama: newUserData.nama, password: newUserData.password,
                role: roleArr, mapel: mapelArr, kelas: kelasArr
            });
            alert("Pengguna berhasil ditambahkan!");
            setShowAddModal(false);
            setNewUserData({ username: '', nama: '', password: '', role: 'siswa', mapel: '', kelas: '' });
            fetchUsers();
        } catch (error) { 
            alert("Gagal menambahkan: " + error.message); 
        } finally { 
            setIsAdding(false); 
        }
    };

    const prosesJsonKeFirebase = async (json) => {
        let count = 0;
        for (const row of json) {
            if (row.Username && row.Nama) {
                const roleArr = row.Role ? String(row.Role).split(',').map(s=>s.trim()) : ['siswa'];
                const mapelArr = row.Mapel ? String(row.Mapel).split(',').map(s=>s.trim()) : [];
                const kelasArr = row.Kelas ? String(row.Kelas).split(',').map(s=>s.trim()) : [];
                await setDoc(doc(db, "users", String(row.Username)), {
                    username: String(row.Username), nama: String(row.Nama), password: String(row.Password || '123456'),
                    role: roleArr, mapel: mapelArr, kelas: kelasArr
                });
                count++;
            }
        }
        return count;
    };

    const handleOpenEdit = (user) => {
        setEditData({
            uid: user.uid, username: user.username || '', nama: user.nama || '',
            role: getArrayString(user.role), mapel: getArrayString(user.mapel), kelas: getArrayString(user.kelas)
        });
        setShowEditModal(true);
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const userRef = doc(db, "users", editData.uid);
            const rArr = editData.role.split(',').map(s => s.trim()).filter(s => s);
            const mArr = editData.mapel.split(',').map(s => s.trim()).filter(s => s);
            const kArr = editData.kelas.split(',').map(s => s.trim()).filter(s => s);

            await updateDoc(userRef, {
                username: editData.username, nama: editData.nama, 
                role: rArr, mapel: mArr, kelas: kArr
            });
            
            setUsers(prevUsers => prevUsers.map(u => u.uid === editData.uid ? { ...u, username: editData.username, nama: editData.nama, role: rArr, mapel: mArr, kelas: kArr } : u));
            alert("Data diperbarui!"); 
            setShowEditModal(false); 
        } catch (error) { 
            alert("Gagal: " + error.message); 
        } finally { 
            setIsSaving(false); 
        }
    };

    const handleDeleteFromModal = async () => {
        if (!window.confirm("Yakin ingin menghapus pengguna ini dari database secara permanen?")) return;
        setIsSaving(true);
        try {
            await deleteDoc(doc(db, "users", editData.uid));
            setUsers(prevUsers => prevUsers.filter(user => user.uid !== editData.uid));
            alert("Akun berhasil deleted!"); 
            setShowEditModal(false); 
        } catch (error) { 
            alert(`Gagal menghapus: ${error.message}`); 
        } finally { 
            setIsSaving(false); 
        }
    };

    // FILTER DAN SORTING GURU
    const guruUsers = users.filter(u => {
        const roleArr = Array.isArray(u.role) ? u.role : String(u.role || '').split(',');
        const isGmail = u.username && String(u.username).toLowerCase().includes('@');
        const isOnlySiswa = roleArr.length === 1 && roleArr[0].trim().toLowerCase() === 'siswa';
        if (isGmail || isOnlySiswa) return false;
        
        const roleDisplay = getRoleDisplay(u.role).toLowerCase();
        const mapel = getArrayString(u.mapel).toLowerCase();
        const kelas = getArrayString(u.kelas).toLowerCase();
        
        return (u.username || "").toLowerCase().includes(fGuruId.toLowerCase()) && 
               (u.nama || "").toLowerCase().includes(fGuruNama.toLowerCase()) && 
               roleDisplay.includes(fGuruRole.toLowerCase()) && 
               `${mapel} ${kelas}`.includes(fGuruDetail.toLowerCase());
    }).sort((a, b) => {
        const kodeA = (a.username || "").trim().toUpperCase();
        const kodeB = (b.username || "").trim().toUpperCase();

        // 1. E98 Wajib Di Atas Sendiri
        const is98A = kodeA.startsWith("E98");
        const is98B = kodeB.startsWith("E98");
        if (is98A && !is98B) return -1;
        if (!is98A && is98B) return 1;

        // 2. Urut Berdasarkan Rekayasa Huruf T dan H
        const keyA = generateSortKey(kodeA);
        const keyB = generateSortKey(kodeB);
        return keyA.localeCompare(keyB);
    });

    const gmailUsers = users.filter(u => u.username && String(u.username).toLowerCase().includes('@') && (u.username || "").toLowerCase().includes(fGmailEmail.toLowerCase()) && (u.nama || "").toLowerCase().includes(fGmailNama.toLowerCase())).sort((a, b) => (a.username || "").localeCompare(b.username || ""));

    const siswaUsers = users.filter(u => {
        const roleArr = Array.isArray(u.role) ? u.role : String(u.role || '').split(',');
        const isExactSiswa = roleArr.some(r => r.trim().toLowerCase() === 'siswa') || roleArr.length === 0;
        const hasStaffRole = roleArr.some(r => r.trim().toLowerCase().includes('guru') || r.trim().toLowerCase().includes('admin') || r.trim().toLowerCase().includes('waka'));
        if ((u.username && String(u.username).toLowerCase().includes('@')) || !isExactSiswa || hasStaffRole) return false;
        return (u.username || "").toLowerCase().includes(fSiswaNis.toLowerCase()) && (u.nama || "").toLowerCase().includes(fSiswaNama.toLowerCase()) && getRoleDisplay(u.role).toLowerCase().includes(fSiswaRole.toLowerCase()) && getArrayString(u.kelas).toLowerCase().includes(fSiswaKelas.toLowerCase());
    }).sort((a, b) => getArrayString(a.kelas).localeCompare(getArrayString(b.kelas)) || (a.nama || "").localeCompare(b.nama || ""));

    const editBtnStyle = { background: '#3b82f6', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' };

    return (
        <div id="admin-manajemen-pengguna" style={{ position: 'relative', animation: 'fadeIn 0.5s' }}>
            <div className="card" style={{ padding: 0, marginBottom: 20, overflow: 'hidden', background: 'var(--card-bg)', boxShadow: 'var(--shadow-md)' }}>
                <div style={{ padding: '15px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: 10 }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 10 }}><i className="fas fa-users"></i> Akses Pengguna</h3>
                    {isAdmin && <button onClick={() => setShowAddModal(true)} style={{ background: 'var(--success)', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '1rem', cursor: 'pointer' }}><i className="fas fa-plus"></i> Tambah</button>}
                </div>

                <div style={{ padding: 25, background: 'var(--card-bg)' }}>
                    {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}><i className="fas fa-spinner fa-spin fa-2x"></i> Memuat data...</div> : (
                        <>
                            {/* TABEL GURU */}
                            <div className="toggle-accordion" onClick={() => setOpenGuru(!openGuru)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, cursor: 'pointer', padding: 10, background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                                <h4 style={{ margin: 0, color: '#0ea5e9', fontSize: '1.05rem' }}><i className="fas fa-chalkboard-teacher"></i> Akun Guru & Staf ({guruUsers.length})</h4>
                                <i className="fas fa-chevron-up toggle-icon" style={{ transition: '0.3s', transform: openGuru ? 'rotate(0deg)' : 'rotate(180deg)', color: 'var(--text-muted)' }}></i>
                            </div>
                            {openGuru && (
                                <div className="table-container" style={{ marginBottom: 30 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                        <thead><tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
                                            <th style={{ padding: 8 }}><input type="text" className="input-text" placeholder="Cari ID..." value={fGuruId} onChange={e => setFGuruId(e.target.value)} style={{ width: '100%', padding: '6px' }} /></th>
                                            <th style={{ padding: 8 }}><input type="text" className="input-text" placeholder="Cari Nama..." value={fGuruNama} onChange={e => setFGuruNama(e.target.value)} style={{ width: '100%', padding: '6px' }} /></th>
                                            <th style={{ padding: 8 }}><input type="text" className="input-text" placeholder="Cari Role..." value={fGuruRole} onChange={e => setFGuruRole(e.target.value)} style={{ width: '100%', padding: '6px' }} /></th>
                                            <th style={{ padding: 8 }}><input type="text" className="input-text" placeholder="Cari Detail..." value={fGuruDetail} onChange={e => setFGuruDetail(e.target.value)} style={{ width: '100%', padding: '6px' }} /></th>
                                            {isAdmin && <th style={{ width: 60 }}></th>}
                                        </tr></thead>
                                        <tbody>{guruUsers.map(user => (
                                            <tr key={user.uid} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                                                <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>{user.username}</td>
                                                <td style={{ padding: '12px 8px' }}>{user.nama}</td>
                                                <td style={{ padding: '12px 8px' }}><span style={{ background: 'var(--bg-main)', padding: '4px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 600 }}>{getRoleDisplay(user.role)}</span></td>
                                                <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}><small><b>Mapel:</b> {getArrayString(user.mapel)}<br/><b>Kelas:</b> {getArrayString(user.kelas)}</small></td>
                                                {isAdmin && <td style={{ padding: '12px 8px', textAlign: 'center' }}><button onClick={() => handleOpenEdit(user)} style={editBtnStyle}><i className="fas fa-edit"></i></button></td>}
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            )}

                            {/* TABEL GMAIL */}
                            <div className="toggle-accordion" onClick={() => setOpenGmail(!openGmail)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, cursor: 'pointer', padding: 10, background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                                <h4 style={{ margin: 0, color: '#ef4444', fontSize: '1.05rem' }}><i className="fab fa-google"></i> Akun Google / Gmail ({gmailUsers.length})</h4>
                                <i className="fas fa-chevron-up toggle-icon" style={{ transition: '0.3s', transform: openGmail ? 'rotate(0deg)' : 'rotate(180deg)', color: 'var(--text-muted)' }}></i>
                            </div>
                            {openGmail && (
                                <div className="table-container" style={{ marginBottom: 30 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                        <thead><tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
                                            <th style={{ padding: 8 }}><input type="text" className="input-text" placeholder="Cari Email..." value={fGmailEmail} onChange={e => setFGmailEmail(e.target.value)} style={{ width: '100%', padding: '6px' }} /></th>
                                            <th style={{ padding: 8 }}><input type="text" className="input-text" placeholder="Cari Nama..." value={fGmailNama} onChange={e => setFGmailNama(e.target.value)} style={{ width: '100%', padding: '6px' }} /></th>
                                            <th style={{ padding: 8, color: 'var(--text-muted)', fontSize: '0.8rem' }}>ROLE</th>
                                            {isAdmin && <th style={{ width: 60 }}></th>}
                                        </tr></thead>
                                        <tbody>{gmailUsers.map(user => (
                                            <tr key={user.uid} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                                                <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>{user.username}</td>
                                                <td style={{ padding: '12px 8px' }}>{user.nama}</td>
                                                <td style={{ padding: '12px 8px' }}><span style={{ background: 'var(--bg-main)', padding: '4px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 600 }}>{getRoleDisplay(user.role)}</span></td>
                                                {isAdmin && <td style={{ padding: '12px 8px', textAlign: 'center' }}><button onClick={() => handleOpenEdit(user)} style={editBtnStyle}><i className="fas fa-edit"></i></button></td>}
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            )}

                            {/* TABEL SISWA */}
                            <div className="toggle-accordion" onClick={() => setOpenSiswa(!openSiswa)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, cursor: 'pointer', padding: 10, background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                                <h4 style={{ margin: 0, color: '#10b981', fontSize: '1.05rem' }}><i className="fas fa-user-graduate"></i> Akun Siswa ({siswaUsers.length})</h4>
                                <i className="fas fa-chevron-up toggle-icon" style={{ transition: '0.3s', transform: openSiswa ? 'rotate(0deg)' : 'rotate(180deg)', color: 'var(--text-muted)' }}></i>
                            </div>
                            {openSiswa && (
                                <div className="table-container">
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                        <thead><tr style={{ background: 'var(--bg-main)', borderBottom: '1px solid var(--border-color)' }}>
                                            <th style={{ padding: 8 }}><input type="text" className="input-text" placeholder="Cari NIS..." value={fSiswaNis} onChange={e => setFSiswaNis(e.target.value)} style={{ width: '100%', padding: '6px' }} /></th>
                                            <th style={{ padding: 8 }}><input type="text" className="input-text" placeholder="Cari Nama..." value={fSiswaNama} onChange={e => setFSiswaNama(e.target.value)} style={{ width: '100%', padding: '6px' }} /></th>
                                            <th style={{ padding: 8 }}><input type="text" className="input-text" placeholder="Cari Role..." value={fSiswaRole} onChange={e => setFSiswaRole(e.target.value)} style={{ width: '100%', padding: '6px' }} /></th>
                                            <th style={{ padding: 8 }}><input type="text" className="input-text" placeholder="Cari Kelas..." value={fSiswaKelas} onChange={e => setFSiswaKelas(e.target.value)} style={{ width: '100%', padding: '6px' }} /></th>
                                            {isAdmin && <th style={{ width: 60 }}></th>}
                                        </tr></thead>
                                        <tbody>{siswaUsers.map(user => (
                                            <tr key={user.uid} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                                                <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>{user.username}</td>
                                                <td style={{ padding: '12px 8px' }}>{user.nama}</td>
                                                <td style={{ padding: '12px 8px' }}><span style={{ background: 'var(--bg-main)', padding: '4px 8px', borderRadius: 4, fontSize: '0.8rem', fontWeight: 600 }}>{getRoleDisplay(user.role)}</span></td>
                                                <td style={{ padding: '12px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>{getArrayString(user.kelas)}</td>
                                                {isAdmin && <td style={{ padding: '12px 8px', textAlign: 'center' }}><button onClick={() => handleOpenEdit(user)} style={editBtnStyle}><i className="fas fa-edit"></i></button></td>}
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* MODAL EDIT DATA */}
            {showEditModal && editData && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <div style={{ background: 'var(--card-bg)', padding: 30, borderRadius: 12, width: '100%', maxWidth: 500, boxShadow: 'var(--shadow-lg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ margin: 0, color: 'var(--text-main)' }}><i className="fas fa-user-edit"></i> Edit Pengguna</h3>
                            <button onClick={() => setShowEditModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
                        </div>
                        <form onSubmit={handleSaveEdit}>
                            <div style={{ marginBottom: 15 }}><label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-main)' }}>Username / NIS</label><input type="text" className="input-text" value={editData.username} onChange={e => setEditData({...editData, username: e.target.value})} required disabled={editData.username && editData.username.includes('@')} style={{ width: '100%', padding: '10px' }} /></div>
                            <div style={{ marginBottom: 15 }}><label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-main)' }}>Nama Lengkap</label><input type="text" className="input-text" value={editData.nama} onChange={e => setEditData({...editData, nama: e.target.value})} required style={{ width: '100%', padding: '10px' }} /></div>
                            <div style={{ marginBottom: 15 }}><label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-main)' }}>Role</label><input type="text" className="input-text" value={editData.role} onChange={e => setEditData({...editData, role: e.target.value})} required style={{ width: '100%', padding: '10px' }} /></div>
                            <div style={{ marginBottom: 15 }}><label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-main)' }}>Mapel</label><input type="text" className="input-text" value={editData.mapel} onChange={e => setEditData({...editData, mapel: e.target.value})} style={{ width: '100%', padding: '10px' }} /></div>
                            <div style={{ marginBottom: 25 }}><label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-main)' }}>Kelas</label><input type="text" className="input-text" value={editData.kelas} onChange={e => setEditData({...editData, kelas: e.target.value})} style={{ width: '100%', padding: '10px' }} /></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <button type="button" onClick={handleDeleteFromModal} disabled={isSaving} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '10px 15px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}><i className="fas fa-trash"></i> Hapus</button>
                                <button type="submit" disabled={isSaving} style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}><i className="fas fa-save"></i> Simpan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL TAMBAH */}
            {showAddModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <div style={{ background: 'var(--card-bg)', padding: '30px', borderRadius: 12, width: '100%', maxWidth: 500, boxShadow: 'var(--shadow-lg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ margin: 0, color: 'var(--text-main)' }}>Tambah Akun Baru</h3>
                            <button onClick={() => setShowAddModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
                        </div>
                        <p style={{color: 'var(--text-muted)'}}>Mode Input Manual:</p>
                        <form onSubmit={handleSaveAddManual}>
                            <input type="text" className="input-text" value={newUserData.username} onChange={e => setNewUserData({...newUserData, username: e.target.value})} placeholder="NIS / ID" required style={{ width: '100%', padding: '10px', marginBottom: 10 }} />
                            <input type="text" className="input-text" value={newUserData.nama} onChange={e => setNewUserData({...newUserData, nama: e.target.value})} placeholder="Nama Lengkap" required style={{ width: '100%', padding: '10px', marginBottom: 10 }} />
                            <input type="text" className="input-text" value={newUserData.password} onChange={e => setNewUserData({...newUserData, password: e.target.value})} placeholder="Password" required style={{ width: '100%', padding: '10px', marginBottom: 10 }} />
                            <input type="text" className="input-text" value={newUserData.role} onChange={e => setNewUserData({...newUserData, role: e.target.value})} placeholder="Role (siswa, guru, dll)" required style={{ width: '100%', padding: '10px', marginBottom: 10 }} />
                            <button type="submit" disabled={isAdding} style={{ width: '100%', background: '#10b981', color: 'white', border: 'none', padding: '12px', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}>Simpan Pengguna</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}