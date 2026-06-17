import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase-config';
import * as XLSX from 'xlsx';

export default function TabHasil() {
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('summary'); // 'summary' atau 'detail'
    
    // State Data
    const [rawData, setRawData] = useState([]);
    const [groupedHasil, setGroupedHasil] = useState([]);
    const [selectedPaket, setSelectedPaket] = useState(null);
    const [detailList, setDetailList] = useState([]);

    // State Modal Koreksi/Review
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [selectedResult, setSelectedResult] = useState(null);
    const [manualScore, setManualScore] = useState('');
    const [isSavingScore, setIsSavingScore] = useState(false);

    useEffect(() => {
        fetchDataHasil();
    }, []);

    const fetchDataHasil = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, "hasil_ujian"));
            const dataArray = [];
            const groups = {};

            snap.forEach(document => {
                const data = { id: document.id, ...document.data() };
                dataArray.push(data);

                // Grouping berdasarkan Mapel dan Kelas
                const mapel = data.mataPelajaran || 'Tanpa Mapel';
                const kls = Array.isArray(data.kelas) ? [...data.kelas].sort().join(', ') : (data.kelas || 'Umum');
                const key = `${mapel}_${kls}`;

                if (!groups[key]) {
                    groups[key] = { mapel, kelas: kls, peserta: 0, totalNilai: 0, key };
                }
                groups[key].peserta += 1;
                groups[key].totalNilai += (Number(data.nilaiAkhir) || 0);
            });

            const finalGroups = Object.values(groups).map(g => ({
                ...g,
                rataRata: g.peserta > 0 ? (g.totalNilai / g.peserta).toFixed(1) : 0
            }));

            setRawData(dataArray);
            setGroupedHasil(finalGroups);
        } catch (error) {
            console.error("Gagal memuat hasil ujian:", error);
        } finally {
            setLoading(false);
        }
    };

    // ==========================================
    // FUNGSI NAVIGASI & AKSI
    // ==========================================
    const bukaDetailPaket = (paket) => {
        const filtered = rawData.filter(d => {
            const dMapel = d.mataPelajaran || 'Tanpa Mapel';
            const dKls = Array.isArray(d.kelas) ? [...d.kelas].sort().join(', ') : (d.kelas || 'Umum');
            return dMapel === paket.mapel && dKls === paket.kelas;
        });
        setDetailList(filtered);
        setSelectedPaket(paket);
        setViewMode('detail');
    };

    const kosongkanHasilPaket = async () => {
        if (!window.confirm(`PERINGATAN!\n\nHapus SEMUA data capaian siswa untuk paket ${selectedPaket.mapel} (${selectedPaket.kelas})?\nTindakan ini tidak dapat dibatalkan!`)) return;
        
        setLoading(true);
        try {
            const batchPromises = detailList.map(item => deleteDoc(doc(db, "hasil_ujian", item.id)));
            await Promise.all(batchPromises);
            alert("Data capaian paket ini berhasil dikosongkan.");
            setViewMode('summary');
            fetchDataHasil();
        } catch (error) {
            alert("Gagal menghapus data: " + error.message);
            setLoading(false);
        }
    };

    const exportToExcel = () => {
        if (detailList.length === 0) return alert("Tidak ada data untuk didownload.");
        
        const wsData = detailList.map((item, idx) => ({
            "No": idx + 1,
            "Nama Siswa": item.namaSiswa || item.nama || '-',
            "NIS / Email": item.nis || item.email || item.username || '-',
            "Mata Pelajaran": item.mataPelajaran || '-',
            "Kelas": Array.isArray(item.kelas) ? item.kelas.join(', ') : (item.kelas || '-'),
            "Nilai Akhir": item.nilaiAkhir || 0,
            "Status": item.status || 'Selesai'
        }));

        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Capaian");
        XLSX.writeFile(wb, `Nilai_${selectedPaket.mapel}_${selectedPaket.kelas}.xlsx`.replace(/\s+/g, '_'));
    };

    // ==========================================
    // FUNGSI KOREKSI / REVIEW
    // ==========================================
    const bukaReview = (hasil) => {
        setSelectedResult(hasil);
        setManualScore(hasil.nilaiAkhir || 0);
        setShowReviewModal(true);
    };

    const simpanKoreksiNilai = async () => {
        if(!manualScore || isNaN(manualScore)) return alert("Masukkan nilai berupa angka yang valid.");
        setIsSavingScore(true);
        try {
            await updateDoc(doc(db, "hasil_ujian", selectedResult.id), {
                nilaiAkhir: Number(manualScore)
            });
            alert("Nilai berhasil diperbarui!");
            setShowReviewModal(false);
            
            // Update UI State locally
            const updatedRaw = rawData.map(d => d.id === selectedResult.id ? { ...d, nilaiAkhir: Number(manualScore) } : d);
            setRawData(updatedRaw);
            const updatedDetail = detailList.map(d => d.id === selectedResult.id ? { ...d, nilaiAkhir: Number(manualScore) } : d);
            setDetailList(updatedDetail);
            
        } catch (error) {
            alert("Gagal menyimpan nilai: " + error.message);
        } finally {
            setIsSavingScore(false);
        }
    };

    // Render Bantuan Jawaban Siswa
    const renderJawabanSiswa = () => {
        if (!selectedResult || !selectedResult.detailJawaban) {
            return (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', background: 'var(--bg-main)', borderRadius: '8px' }}>
                    <i className="fas fa-box-open fa-2x" style={{ marginBottom: '10px' }}></i>
                    <p>Detail log jawaban untuk siswa ini tidak tersedia di database.</p>
                </div>
            );
        }

        const answers = selectedResult.detailJawaban; // Misal berupa array object { nomor, pertanyaan, jawabanSiswa, kunci, isBenar, tipe }
        if (!Array.isArray(answers) || answers.length === 0) return <p style={{ color: 'var(--text-muted)' }}>Format data jawaban tidak dikenali.</p>;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {answers.map((ans, idx) => (
                    <div key={idx} style={{ background: 'var(--bg-main)', border: `1px solid ${ans.isBenar ? '#10b981' : (ans.tipe === 'Essay' ? '#3b82f6' : '#ef4444')}`, borderRadius: '10px', padding: '15px', position: 'relative' }}>
                        
                        {/* Lencana Status */}
                        <div style={{ position: 'absolute', top: '15px', right: '15px' }}>
                            {ans.tipe === 'Essay' ? (
                                <span style={{ background: '#dbeafe', color: '#2563eb', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>Perlu Dikoreksi</span>
                            ) : ans.isBenar ? (
                                <span style={{ background: '#dcfce7', color: '#10b981', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}><i className="fas fa-check"></i> Benar</span>
                            ) : (
                                <span style={{ background: '#fee2e2', color: '#dc2626', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}><i className="fas fa-times"></i> Salah</span>
                            )}
                        </div>

                        <h5 style={{ margin: '0 0 10px 0', color: 'var(--text-main)' }}>Soal {ans.nomor || idx + 1} <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 'normal' }}>({ans.tipe || 'PG'})</span></h5>
                        <p style={{ margin: '0 0 15px 0', color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: 1.5 }}>{ans.pertanyaan || 'Teks pertanyaan tidak terekam.'}</p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', background: 'var(--card-bg)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div>
                                <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 'bold' }}>Jawaban Siswa:</span>
                                <span style={{ color: ans.isBenar ? '#10b981' : (ans.tipe === 'Essay' ? 'var(--text-main)' : '#ef4444'), fontWeight: 'bold' }}>
                                    {Array.isArray(ans.jawabanSiswa) ? ans.jawabanSiswa.join(', ') : (ans.jawabanSiswa || '- Kosong -')}
                                </span>
                            </div>
                            <div>
                                <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 'bold' }}>Kunci Jawaban:</span>
                                <span style={{ color: '#10b981', fontWeight: 'bold' }}>
                                    {Array.isArray(ans.kunci) ? ans.kunci.join(', ') : (ans.kunci || '-')}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };


    return (
        <div id="admin-hasil-ujian" style={{ animation: 'fadeIn 0.5s' }}>
            
            {/* VIEW 1: SUMMARY (KARTU PER PAKET SOAL) */}
            {viewMode === 'summary' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <i className="fas fa-chart-bar" style={{ color: '#3b82f6' }}></i> Capaian Siswa Per Paket
                        </h3>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 50, color: 'var(--text-muted)' }}><i className="fas fa-spinner fa-spin fa-2x"></i><br/>Memuat Data...</div>
                    ) : groupedHasil.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 50, color: 'var(--text-muted)', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <i className="fas fa-box-open fa-3x" style={{ marginBottom: 15, color: 'var(--border-color)' }}></i>
                            <p>Belum ada siswa yang menyelesaikan ujian.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                            {groupedHasil.map((paket, idx) => (
                                <div key={idx} style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '20px', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s', cursor: 'pointer' }} onClick={() => bukaDetailPaket(paket)}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                                        <div>
                                            <h4 style={{ margin: '0 0 5px 0', color: 'var(--text-main)', fontSize: '1.1rem' }}>{paket.mapel}</h4>
                                            <span style={{ background: 'var(--bg-main)', color: 'var(--text-muted)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', border: '1px solid var(--border-color)', fontWeight: 'bold' }}>{paket.kelas}</span>
                                        </div>
                                        <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                                            <i className="fas fa-folder-open"></i>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '15px', marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
                                        <div style={{ flex: 1 }}>
                                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>PESERTA</span>
                                            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>{paket.peserta} <small style={{ fontSize: '0.8rem', fontWeight: 'normal' }}>Siswa</small></span>
                                        </div>
                                        <div style={{ flex: 1, borderLeft: '1px solid var(--border-color)', paddingLeft: '15px' }}>
                                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>RATA-RATA</span>
                                            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981' }}>{paket.rataRata}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* VIEW 2: DETAIL TABEL SISWA PER PAKET */}
            {viewMode === 'detail' && selectedPaket && (
                <div className="card" style={{ padding: 0, overflow: 'hidden', background: 'var(--card-bg)', borderRadius: 12, boxShadow: 'var(--shadow-md)' }}>
                    
                    {/* Header Detail */}
                    <div style={{ padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: 15, background: 'var(--bg-main)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                            <button onClick={() => setViewMode('summary')} style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: `1px solid var(--border-color)`, padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', boxShadow: 'var(--shadow-sm)' }} title="Kembali"><i className="fas fa-arrow-left"></i></button>
                            <div>
                                <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.15rem' }}>{selectedPaket.mapel}</h3>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Kelas: {selectedPaket.kelas}</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={kosongkanHasilPaket} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <i className="fas fa-trash"></i> Kosongkan
                            </button>
                            <button onClick={exportToExcel} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <i className="fas fa-file-excel"></i> Download Excel
                            </button>
                        </div>
                    </div>

                    {/* Tabel Daftar Siswa */}
                    <div style={{ padding: '0', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 900 }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border-color)', background: 'var(--card-bg)' }}>
                                    <th style={{ padding: '15px 25px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 800 }}>NAMA SISWA</th>
                                    <th style={{ padding: '15px 25px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 800 }}>NIS / EMAIL</th>
                                    <th style={{ padding: '15px 25px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 800, textAlign: 'center' }}>MAPEL</th>
                                    <th style={{ padding: '15px 25px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 800, textAlign: 'center' }}>NILAI AKHIR</th>
                                    <th style={{ padding: '15px 25px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 800, textAlign: 'center' }}>STATUS</th>
                                    <th style={{ padding: '15px 25px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 800, textAlign: 'center' }}>AKSI</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detailList.length === 0 ? (
                                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>Belum ada capaian untuk paket ini.</td></tr>
                                ) : (
                                    detailList.map((item, idx) => (
                                        <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'var(--bg-main)' : 'var(--card-bg)', color: 'var(--text-main)', transition: '0.2s' }} onMouseOver={(e) => e.currentTarget.style.background='rgba(59, 130, 246, 0.05)'} onMouseOut={(e) => e.currentTarget.style.background=idx % 2 === 0 ? 'var(--bg-main)' : 'var(--card-bg)'}>
                                            <td style={{ padding: '15px 25px', fontWeight: 'bold' }}>{item.namaSiswa || item.nama || '-'}</td>
                                            <td style={{ padding: '15px 25px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{item.nis || item.email || item.username || '-'}</td>
                                            <td style={{ padding: '15px 25px', textAlign: 'center' }}>
                                                <span style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '4px 10px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 'bold' }}>{item.mataPelajaran || '-'}</span>
                                            </td>
                                            <td style={{ padding: '15px 25px', textAlign: 'center' }}>
                                                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: item.nilaiAkhir >= 75 ? '#10b981' : (item.nilaiAkhir > 0 ? '#f59e0b' : '#ef4444') }}>{item.nilaiAkhir || 0}</span>
                                            </td>
                                            <td style={{ padding: '15px 25px', textAlign: 'center' }}>
                                                <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 10px', borderRadius: 6, fontSize: '0.8rem', fontWeight: 'bold' }}><i className="fas fa-check-circle"></i> Selesai</span>
                                            </td>
                                            <td style={{ padding: '15px 25px', textAlign: 'center' }}>
                                                <button onClick={() => bukaReview(item)} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)' }}>
                                                    <i className="fas fa-search"></i> Tinjau
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ========================================== */}
            {/* MODAL 3: TINJAU & KOREKSI JAWABAN SISWA */}
            {/* ========================================== */}
            {showReviewModal && selectedResult && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.85)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <div style={{ background: 'var(--card-bg)', width: '850px', maxWidth: '98%', maxHeight: '95vh', overflow: 'hidden', borderRadius: '18px', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' }}>
                        
                        {/* Header Modal Koreksi */}
                        <div style={{ padding: '20px 25px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)' }}>
                            <div>
                                <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.2rem' }}><i className="fas fa-user-edit" style={{ color: '#3b82f6', marginRight: '8px' }}></i> Lembar Jawaban Siswa</h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}><b>{selectedResult.namaSiswa || selectedResult.nama}</b> ({selectedResult.nis || selectedResult.username})</p>
                            </div>
                            <button onClick={() => setShowReviewModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '1.8rem', cursor: 'pointer', color: 'var(--text-muted)', transition: '0.2s' }}>&times;</button>
                        </div>

                        {/* Konten Scrollable */}
                        <div style={{ padding: '25px', overflowY: 'auto', flex: 1, background: 'var(--card-bg)' }}>
                            
                            {/* Panel Koreksi Nilai Manual */}
                            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', marginBottom: '25px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
                                <div>
                                    <h4 style={{ margin: '0 0 5px 0', color: 'var(--text-main)', fontSize: '1rem' }}><i className="fas fa-calculator" style={{ color: '#f59e0b' }}></i> Koreksi Nilai Akhir</h4>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Ubah nilai sistem secara manual (Sangat berguna untuk tipe soal Essay).</p>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <input 
                                        type="number" 
                                        className="input-text" 
                                        value={manualScore} 
                                        onChange={(e) => setManualScore(e.target.value)} 
                                        style={{ width: '80px', padding: '10px', fontSize: '1.1rem', fontWeight: 'bold', textAlign: 'center', color: '#10b981', border: '2px solid #10b981', background: 'rgba(16, 185, 129, 0.05)' }} 
                                    />
                                    <button onClick={simpanKoreksiNilai} disabled={isSavingScore} style={{ background: '#10b981', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <i className="fas fa-save"></i> {isSavingScore ? 'Menyimpan...' : 'Simpan Nilai'}
                                    </button>
                                </div>
                            </div>

                            <hr style={{ border: 'none', borderTop: '1px dashed var(--border-color)', margin: '0 0 25px 0' }} />

                            {/* Daftar Jawaban */}
                            <h4 style={{ color: 'var(--text-main)', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}><i className="fas fa-list-ul"></i> Detail Pilihan Siswa</h4>
                            {renderJawabanSiswa()}

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}