import React, { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove, addDoc } from 'firebase/firestore';
import { db } from './firebase-config';
import * as XLSX from 'xlsx';

export default function TabBankSoal() {
    const [paketSoal, setPaketSoal] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('summary'); 
    const [selectedPaket, setSelectedPaket] = useState(null);
    const [soalList, setSoalList] = useState([]);
    const [loadingSoal, setLoadingSoal] = useState(false);

    // STATE DRAG & DROP
    const [dragId, setDragId] = useState(null);
    const [dragOverId, setDragOverId] = useState(null);

    // STATE DATA MASTER
    const [showMasterModal, setShowMasterModal] = useState(false);
    const [masterData, setMasterData] = useState({ mapel: [], kelas: [] });
    const [masterInputType, setMasterInputType] = useState('mapel');
    const [masterInputValue, setMasterInputValue] = useState('');
    const [isEditMasterMode, setIsEditMasterMode] = useState(false);

    // STATE ATUR BOBOT MASSAL
    const [showBobotModal, setShowBobotModal] = useState(false);
    const [massBobot, setMassBobot] = useState({ PG: 2, PGK: 3, Menjodohkan: 4, Essay: 5 });

    // STATE INPUT / EDIT SOAL
    const [showInputModal, setShowInputModal] = useState(false);
    const [isSavingSoal, setIsSavingSoal] = useState(false);

    const defaultSoalData = {
        id: null, nomor: 1, bobot: 1, mataPelajaran: '', kelas: [], tipe: 'PG', 
        pertanyaan: '', tipeMediaUtama: 'file', mediaUtamaUrl: '',
        opsiA: '', opsiB: '', opsiC: '', opsiD: '', opsiE: '', 
        mediaOpsi: { A: {tipe: 'file', url: ''}, B: {tipe: 'file', url: ''}, C: {tipe: 'file', url: ''}, D: {tipe: 'file', url: ''}, E: {tipe: 'file', url: ''} },
        kunciPG: 'A', kunciPGK: [], kunciEssay: ''
    };
    const [formData, setFormData] = useState(defaultSoalData);

    useEffect(() => {
        loadDataLengkap();
        loadDataMaster();
    }, []);

    // ==========================================
    // LOAD DATA
    // ==========================================
    const loadDataLengkap = async () => {
        setLoading(true);
        try {
            const soalSnap = await getDocs(collection(db, "bank_soal"));
            const grouped = {};
            soalSnap.forEach(d => {
                const data = d.data();
                const mapel = data.mataPelajaran || "Tanpa Mapel";
                const kelasArr = Array.isArray(data.kelas) ? data.kelas : [data.kelas || "Umum"];
                const kelasKey = [...kelasArr].sort().join(', ');
                const dbKey = `${mapel}_${kelasKey}`;
                if (!grouped[dbKey]) grouped[dbKey] = { dbKey, mapel, kelasKey, count: 0, jadwal: '', durasi: '', token: '', acak: false };
                grouped[dbKey].count++;
            });

            const [waktuSnap, tokenSnap, acakSnap, jadwalSnap] = await Promise.all([
                getDoc(doc(db, "pengaturan", "waktu_ujian")), getDoc(doc(db, "pengaturan", "token_ujian")),
                getDoc(doc(db, "pengaturan", "acak_soal")), getDoc(doc(db, "pengaturan", "jadwal_ujian"))
            ]);

            const finalData = Object.values(grouped).map(item => ({
                ...item,
                durasi: waktuSnap.exists() ? (waktuSnap.data()[item.dbKey] || '') : '',
                token: tokenSnap.exists() ? (tokenSnap.data()[`token_${item.dbKey}`]?.code || tokenSnap.data()[`token_${item.dbKey}`] || '') : '',
                acak: acakSnap.exists() ? (acakSnap.data()[item.dbKey] || false) : false,
                jadwal: jadwalSnap.exists() ? (jadwalSnap.data()[item.dbKey] || '') : ''
            }));
            setPaketSoal(finalData);
        } catch (error) { console.error("Gagal memuat:", error); } finally { setLoading(false); }
    };

    const loadDataMaster = async () => {
        try {
            const docRef = doc(db, "pengaturan", "data_master");
            const docSnap = await getDoc(docRef);
            let mapelData = [], kelasData = [];

            if (docSnap.exists()) {
                const d = docSnap.data();
                if (d.mapel && d.mapel.length > 0) mapelData = d.mapel;
                if (d.kelas && d.kelas.length > 0) kelasData = d.kelas;
            }

            if (mapelData.length === 0 || kelasData.length === 0) {
                mapelData = ['Pendidikan Agama Islam', 'Pendidikan Pancasila dan Kewarganegaraan', 'Bahasa Indonesia', 'Matematika', 'Sejarah Indonesia', 'Bahasa Inggris', 'Seni Budaya', 'Pendidikan Jasmani', 'Prakarya dan Kewirausahaan', 'Biologi', 'Fisika', 'Kimia', 'Geografi', 'Sosiologi', 'Ekonomi', 'Bahasa Arab', 'Informatika', 'Koding dan Kecerdasan Artifisial', 'Bimbingan Konseling', 'Contoh Mapel'];
                kelasData = ['X-1', 'X-2', 'X-3', 'X-4', 'XI-1', 'XI-2', 'XI-3', 'XI-4', 'XII-1', 'XII-2', 'XII-3', 'XII-4', 'Umum'];
                await setDoc(docRef, { mapel: mapelData, kelas: kelasData });
            }
            setMasterData({ mapel: mapelData, kelas: kelasData });
        } catch (error) { console.error(error); }
    };

    const handleAddMaster = async () => {
        if (!masterInputValue.trim()) return;
        try {
            const docRef = doc(db, "pengaturan", "data_master");
            await updateDoc(docRef, { [masterInputType]: arrayUnion(masterInputValue.trim()) });
            setMasterInputValue('');
            loadDataMaster();
        } catch (error) { alert("Gagal menambah: " + error.message); }
    };

    const handleDeleteMaster = async (type, value) => {
        if (!window.confirm(`Hapus ${value} dari daftar ${type}?`)) return;
        try {
            const docRef = doc(db, "pengaturan", "data_master");
            await updateDoc(docRef, { [type]: arrayRemove(value) });
            loadDataMaster();
        } catch (error) { alert("Gagal menghapus: " + error.message); }
    };

    // ==========================================
    // KELOLA PAKET SOAL (DETAIL & DRAG DROP)
    // ==========================================
    const bukaDetailPaket = async (paket) => {
        setSelectedPaket(paket);
        setViewMode('detail');
        setLoadingSoal(true);
        try {
            const snap = await getDocs(collection(db, "bank_soal"));
            const list = [];
            snap.forEach(d => {
                const data = d.data();
                const kKey = Array.isArray(data.kelas) ? [...data.kelas].sort().join(', ') : (data.kelas || 'Umum');
                if (data.mataPelajaran === paket.mapel && kKey === paket.kelasKey) list.push({ id: d.id, ...data });
            });
            list.sort((a, b) => (a.nomor || 0) - (b.nomor || 0));
            setSoalList(list);
        } catch (error) { console.error(error); } finally { setLoadingSoal(false); }
    };

    const handleDragStart = (e, index) => { e.dataTransfer.effectAllowed = "move"; setDragId(index); };
    const handleDragOver = (e, index) => { e.preventDefault(); setDragOverId(index); };
    const handleDrop = async (e, dropIndex) => {
        e.preventDefault();
        if (dragId === null || dragId === dropIndex) return;
        const items = [...soalList];
        const dragItem = items.splice(dragId, 1)[0];
        items.splice(dropIndex, 0, dragItem);
        const updatedItems = items.map((item, i) => ({...item, nomor: i + 1}));
        setSoalList(updatedItems);
        setDragId(null);
        setDragOverId(null);
        try { await Promise.all(updatedItems.map(item => updateDoc(doc(db, "bank_soal", item.id), { nomor: item.nomor }))); } catch(error) { console.error(error); }
    };

    const handleSimpanBobotMassal = async () => {
        setIsSavingSoal(true);
        try {
            const batchPromises = soalList.map(soal => {
                const rawTipe = String(soal.tipe || '').toLowerCase();
                const isPG = rawTipe === 'pg' || (rawTipe.includes('ganda') && !rawTipe.includes('kompleks'));
                const isPGK = rawTipe === 'pgk' || rawTipe.includes('kompleks');
                const isEssay = rawTipe.includes('essay') || rawTipe.includes('uraian');
                const isJodoh = rawTipe.includes('jodoh');
                
                let tipeKunci = 'PG';
                if(isPGK) tipeKunci = 'PGK'; else if(isEssay) tipeKunci = 'Essay'; else if(isJodoh) tipeKunci = 'Menjodohkan';

                const newBobot = Number(massBobot[tipeKunci]) || 1;
                if(soal.bobot !== newBobot) return updateDoc(doc(db, "bank_soal", soal.id), { bobot: newBobot });
                return null;
            }).filter(p => p !== null);

            await Promise.all(batchPromises);
            alert("Bobot diperbarui massal!");
            setShowBobotModal(false);
            bukaDetailPaket(selectedPaket);
        } catch (error) { alert("Gagal memperbarui bobot: " + error.message); } finally { setIsSavingSoal(false); }
    };

    // ==========================================
    // FUNGSI SOAL INDIVIDU
    // ==========================================
    const handleSaveSoal = async (e) => {
        e.preventDefault();
        setIsSavingSoal(true);
        try {
            let finalKunci = '';
            if (formData.tipe === 'PG') finalKunci = formData.kunciPG;
            else if (formData.tipe === 'PGK') finalKunci = formData.kunciPGK; 
            else finalKunci = formData.kunciEssay; 

            const soalData = {
                nomor: Number(formData.nomor), bobot: Number(formData.bobot),
                mataPelajaran: formData.mataPelajaran,
                kelas: typeof formData.kelas === 'string' ? formData.kelas.split(',').map(s=>s.trim()) : formData.kelas,
                tipe: formData.tipe, pertanyaan: formData.pertanyaan, soal: formData.pertanyaan, teks_soal: formData.pertanyaan,
                mediaUtamaUrl: formData.mediaUtamaUrl, tipeMediaUtama: formData.tipeMediaUtama,
                opsi: (formData.tipe === 'PG' || formData.tipe === 'PGK') ? { A: formData.opsiA, B: formData.opsiB, C: formData.opsiC, D: formData.opsiD, E: formData.opsiE } : null,
                mediaOpsi: (formData.tipe === 'PG' || formData.tipe === 'PGK') ? formData.mediaOpsi : null,
                kunci: finalKunci, updatedAt: new Date().toISOString()
            };

            if (formData.id) {
                await updateDoc(doc(db, "bank_soal", formData.id), soalData);
                setShowInputModal(false); bukaDetailPaket(selectedPaket);
            } else {
                await addDoc(collection(db, "bank_soal"), soalData);
                setShowInputModal(false); setFormData(defaultSoalData);
                if(viewMode === 'detail') bukaDetailPaket(selectedPaket); else loadDataLengkap();
            }
        } catch (error) { alert("Gagal menyimpan: " + error.message); } finally { setIsSavingSoal(false); }
    };

    const handleDeleteSoal = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm("Yakin ingin menghapus soal ini?")) return;
        try { await deleteDoc(doc(db, "bank_soal", id)); bukaDetailPaket(selectedPaket); } catch (error) {}
    };

    const hapusKeseluruhan = async (mapel, kelasKey) => {
        if (!window.confirm(`Hapus SEMUA soal ${mapel} - ${kelasKey}?`)) return;
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, "bank_soal"));
            const batch = [];
            snap.forEach(d => {
                const data = d.data();
                const kKey = Array.isArray(data.kelas) ? [...data.kelas].sort().join(', ') : (data.kelas || 'Umum');
                if (data.mataPelajaran === mapel && kKey === kelasKey) batch.push(deleteDoc(doc(db, "bank_soal", d.id)));
            });
            await Promise.all(batch);
            loadDataLengkap();
        } catch (e) { alert("Gagal: " + e.message); setLoading(false); }
    };

    const openEditSoal = (soal) => {
        const rawTipe = String(soal.tipe || '').toLowerCase();
        const isPG = rawTipe === 'pg' || (rawTipe.includes('ganda') && !rawTipe.includes('kompleks'));
        const isPGK = rawTipe === 'pgk' || rawTipe.includes('kompleks');
        const isEssay = rawTipe.includes('essay') || rawTipe.includes('uraian');
        
        const teksPertanyaan = soal.pertanyaan || soal.teks_soal || soal.soal || soal.teks || soal.Pertanyaan || '';
        const kunciJawaban = soal.kunci || soal.Kunci || soal.jawaban || soal.Jawaban || '';

        setFormData({
            id: soal.id, nomor: soal.nomor || 1, bobot: soal.bobot || 1,
            mataPelajaran: soal.mataPelajaran, kelas: soal.kelas, 
            tipe: isPG ? 'PG' : (isPGK ? 'PGK' : (isEssay ? 'Essay' : 'PG')),
            pertanyaan: teksPertanyaan, 
            tipeMediaUtama: soal.tipeMediaUtama || 'file', mediaUtamaUrl: soal.mediaUtamaUrl || '',
            opsiA: soal.opsi?.A || soal.opsiA || soal.A || '', opsiB: soal.opsi?.B || soal.opsiB || soal.B || '', 
            opsiC: soal.opsi?.C || soal.opsiC || soal.C || '', opsiD: soal.opsi?.D || soal.opsiD || soal.D || '', opsiE: soal.opsi?.E || soal.opsiE || soal.E || '',
            mediaOpsi: soal.mediaOpsi || defaultSoalData.mediaOpsi,
            kunciPG: isPG ? String(kunciJawaban).toUpperCase().trim() : 'A', 
            kunciPGK: isPGK ? (Array.isArray(kunciJawaban) ? kunciJawaban : String(kunciJawaban).split(',')) : [],
            kunciEssay: (!isPG && !isPGK) ? kunciJawaban : ''
        });
        setShowInputModal(true);
    };

    // ==========================================
    // SISTEM IMPORT MASSAL CERDAS & G-DRIVE
    // ==========================================
    const downloadTemplateWord = () => {
        const textTemplate = `=== TEMPLATE SOAL CBT (FORMAT AI) ===\nCopy paste jawaban AI (Gemini/ChatGPT) Anda langsung ke format ini.\n\n1. Bahasa pemrograman yang berjalan di sisi klien (client-side) adalah...\nA. Python\nB. PHP\nC. JavaScript\nD. C++\nE. SQL\nKUNCI: C\nTIPE: PG\nBOBOT: 2\n\n2. Jelaskan pengertian dari Jaringan Komputer!\nKUNCI: Jaringan komputer adalah dua atau lebih perangkat yang terhubung untuk berbagi data.\nTIPE: ESSAY\nBOBOT: 5\n\n3. Manakah di bawah ini yang merupakan sistem operasi? (Pilih 2)\nA. Windows\nB. Microsoft Word\nC. Linux\nD. Google Chrome\nKUNCI: A, C\nTIPE: PGK\nBOBOT: 3`;
        const blob = new Blob([textTemplate], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'Template_Soal_Format_AI.txt';
        link.click();
    };

    const downloadTemplateExcel = () => {
        const wsData = [
            { Nomor: 1, Pertanyaan: "Apa ibukota Indonesia?", Tipe: "PG", OpsiA: "Jakarta", OpsiB: "Bandung", OpsiC: "Surabaya", OpsiD: "Semarang", OpsiE: "Bali", Kunci: "A", Bobot: 2 },
            { Nomor: 2, Pertanyaan: "Sebutkan dasar negara Indonesia!", Tipe: "Essay", OpsiA: "", OpsiB: "", OpsiC: "", OpsiD: "", OpsiE: "", Kunci: "Pancasila", Bobot: 5 }
        ];
        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Format_Soal");
        XLSX.writeFile(wb, "Template_Soal_Excel.xlsx");
    };

    const parseAITextToJSON = (rawText) => {
        const questions = [];
        const blocks = rawText.split(/(?=\n\s*\d+\.\s)/g);
        let currentNo = 1;
        blocks.forEach(block => {
            if (!block.trim() || block.includes('=== TEMPLATE')) return;
            const lines = block.split('\n').map(l => l.trim()).filter(l => l);
            let qObj = { nomor: currentNo, pertanyaan: '', opsiA: '', opsiB: '', opsiC: '', opsiD: '', opsiE: '', kunci: 'A', tipe: '', bobot: 1 };
            const qMatch = lines[0].match(/^\d+\.\s*(.*)/);
            if(qMatch) qObj.pertanyaan = qMatch[1]; else qObj.pertanyaan = lines[0];

            for(let i=1; i<lines.length; i++) {
                const line = lines[i];
                if(line.match(/^[Aa][\.\)]\s*(.*)/)) qObj.opsiA = line.replace(/^[Aa][\.\)]\s*/, '');
                else if(line.match(/^[Bb][\.\)]\s*(.*)/)) qObj.opsiB = line.replace(/^[Bb][\.\)]\s*/, '');
                else if(line.match(/^[Cc][\.\)]\s*(.*)/)) qObj.opsiC = line.replace(/^[Cc][\.\)]\s*/, '');
                else if(line.match(/^[Dd][\.\)]\s*(.*)/)) qObj.opsiD = line.replace(/^[Dd][\.\)]\s*/, '');
                else if(line.match(/^[Ee][\.\)]\s*(.*)/)) qObj.opsiE = line.replace(/^[Ee][\.\)]\s*/, '');
                else if(line.match(/^KUNCI/i)) qObj.kunci = line.replace(/^KUNCI[\s:]*/i, '').toUpperCase();
                else if(line.match(/^TIPE/i)) qObj.tipe = line.replace(/^TIPE[\s:]*/i, '').toUpperCase();
                else if(line.match(/^BOBOT/i)) qObj.bobot = parseInt(line.replace(/^BOBOT[\s:]*/i, '')) || 1;
                else if(!qObj.opsiA && !line.match(/^[A-Ea-e][\.\)]/)) qObj.pertanyaan += '\n' + line;
            }
            if(!qObj.tipe) qObj.tipe = (qObj.opsiA && qObj.opsiB) ? 'PG' : 'Essay';
            if(qObj.pertanyaan) { questions.push(qObj); currentNo++; }
        });
        return questions;
    };

    const saveMassalToDatabase = async (jsonArray) => {
        if(!formData.mataPelajaran || !formData.kelas || formData.kelas.length === 0) {
            return alert("Pilih Mata Pelajaran dan Kelas Sasaran di formulir bawah terlebih dahulu sebelum meng-upload file!");
        }
        setIsSavingSoal(true);
        try {
            let count = 0;
            const kelasArray = typeof formData.kelas === 'string' ? formData.kelas.split(',').map(s=>s.trim()) : formData.kelas;
            
            for (const item of jsonArray) {
                const finalTipe = String(item.Tipe || item.tipe || 'PG').toUpperCase();
                const isPGK = finalTipe === 'PGK';
                let finalKunci = item.Kunci || item.kunci || 'A';
                if (isPGK && typeof finalKunci === 'string') finalKunci = finalKunci.split(',').map(s => s.trim());

                await addDoc(collection(db, "bank_soal"), {
                    nomor: parseInt(item.Nomor || item.nomor) || count + 1,
                    bobot: parseInt(item.Bobot || item.bobot) || 1,
                    mataPelajaran: formData.mataPelajaran, kelas: kelasArray, tipe: finalTipe,
                    pertanyaan: item.Pertanyaan || item.pertanyaan || '',
                    soal: item.Pertanyaan || item.pertanyaan || '',
                    opsi: (finalTipe === 'PG' || finalTipe === 'PGK') ? { A: item.OpsiA || item.opsiA || '', B: item.OpsiB || item.opsiB || '', C: item.OpsiC || item.opsiC || '', D: item.OpsiD || item.opsiD || '', E: item.OpsiE || item.opsiE || '' } : null,
                    kunci: finalKunci, updatedAt: new Date().toISOString()
                });
                count++;
            }
            alert(`Berhasil mengimpor ${count} soal!`);
            setShowInputModal(false);
            if(viewMode === 'detail') bukaDetailPaket(selectedPaket); else loadDataLengkap();
        } catch (error) { alert("Gagal import: " + error.message); } finally { setIsSavingSoal(false); }
    };

    const handleUploadFileSoal = async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const ext = file.name.split('.').pop().toLowerCase();
        const reader = new FileReader();

        if (ext === 'txt') {
            reader.onload = async (e) => {
                const parsed = parseAITextToJSON(e.target.result);
                if(parsed.length > 0) saveMassalToDatabase(parsed);
                else alert("Gagal mendeteksi soal. Pastikan format file .txt sesuai template.");
            };
            reader.readAsText(file);
        } else if (ext === 'xlsx' || ext === 'xls') {
            reader.onload = async (e) => {
                const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                saveMassalToDatabase(json);
            };
            reader.readAsArrayBuffer(file);
        } else {
            alert("Harap gunakan format .TXT (Format AI) atau .XLSX (Excel).");
        }
    };

    // FUNGSI TARIK DATA DARI LINK GDRIVE
    const processLinkImport = async () => {
        const url = prompt("Masukkan link Google Sheets atau Google Docs\n\n(Pastikan akses link telah disetel ke 'Siapa saja yang memiliki link' / 'Anyone with link'):");
        if (!url) return;
        
        setIsSavingSoal(true);
        try {
            let sheetMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            let docMatch = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
            
            if (sheetMatch) {
                const res = await fetch(`https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/export?format=csv`);
                if (!res.ok) throw new Error("Gagal mengunduh Spreadsheet. Pastikan link bersifat public.");
                const csvText = await res.text();
                const workbook = XLSX.read(csvText, { type: 'string' });
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                saveMassalToDatabase(json);
            } else if (docMatch) {
                const res = await fetch(`https://docs.google.com/document/d/${docMatch[1]}/export?format=txt`);
                if (!res.ok) throw new Error("Gagal mengunduh Docs. Pastikan link bersifat public.");
                const txt = await res.text();
                const parsed = parseAITextToJSON(txt);
                if (parsed.length > 0) saveMassalToDatabase(parsed);
                else alert("Format teks di Google Docs tidak dikenali sesuai template.");
            } else {
                alert("Link tidak valid! Harap masukkan link Google Sheets atau Google Docs.");
                setIsSavingSoal(false);
            }
        } catch (error) {
            alert("Terjadi kesalahan: " + error.message);
            setIsSavingSoal(false);
        }
    };

    const actionBtnStyle = (bgColor) => ({
        background: bgColor, color: 'white', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer', 
        display: 'flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    });

    return (
        <div id="admin-bank-soal" style={{ animation: 'fadeIn 0.5s' }}>
            
            {/* VIEW SUMMARY (TABEL UTAMA) */}
            {viewMode === 'summary' && (
                <div className="card" style={{ padding: 0, overflow: 'hidden', background: 'var(--card-bg)', borderRadius: 12, boxShadow: 'var(--shadow-md)' }}>
                    <div style={{ padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: 10 }}>
                        <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: 10 }}><i className="fas fa-file-alt"></i> Bank Soal</h3>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => setShowMasterModal(true)} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}><i className="fas fa-database"></i> Data Master</button>
                            <button onClick={() => { setFormData(defaultSoalData); setShowInputModal(true); }} style={{ background: '#10b981', color: 'white', border: 'none', padding: '8px 16px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' }}><i className="fas fa-file-import"></i> Input Soal</button>
                        </div>
                    </div>

                    <div style={{ padding: '0', overflowX: 'auto' }}>
                        {loading ? ( <div style={{ textAlign: 'center', padding: 50, color: 'var(--text-muted)' }}><i className="fas fa-spinner fa-spin fa-2x"></i><br/>Memuat Paket...</div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 1000 }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border-color)', background: 'var(--bg-main)' }}>
                                        <th style={{ padding: '15px 20px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 800 }}>MATA PELAJARAN</th>
                                        <th style={{ padding: '15px 20px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 800 }}>KELAS</th>
                                        <th style={{ padding: '15px 20px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 800 }}>JADWAL UJIAN</th>
                                        <th style={{ padding: '15px 20px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 800, textAlign: 'center' }}>DURASI</th>
                                        <th style={{ padding: '15px 20px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 800, textAlign: 'center' }}>TOKEN</th>
                                        <th style={{ padding: '15px 20px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 800, textAlign: 'center' }}>JML SOAL</th>
                                        <th style={{ padding: '15px 20px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 800, textAlign: 'center' }}>AKSI</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paketSoal.map((paket, idx) => (
                                        <tr key={paket.dbKey} style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-main)' }}>
                                            <td style={{ padding: '15px 20px', fontWeight: 'bold' }}>{paket.mapel}</td>
                                            <td style={{ padding: '15px 20px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-muted)' }}>{paket.kelasKey}</td>
                                            <td style={{ padding: '15px 20px' }}>
                                                <input type="datetime-local" className="input-text" value={paket.jadwal} onChange={(e) => { const nd = [...paketSoal]; nd[idx].jadwal = e.target.value; setPaketSoal(nd); }} style={{ width: '100%', padding: '6px' }} />
                                            </td>
                                            <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                                                <input type="number" className="input-text" value={paket.durasi} onChange={(e) => { const nd = [...paketSoal]; nd[idx].durasi = e.target.value; setPaketSoal(nd); }} style={{ width: 50, textAlign: 'center', padding: '5px' }} />
                                            </td>
                                            <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                                                    <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: 6, overflow: 'hidden' }}>
                                                        <input type="text" className="input-text" value={paket.token} onChange={(e) => { const nd = [...paketSoal]; nd[idx].token = e.target.value.toUpperCase(); setPaketSoal(nd); }} style={{ width: 65, border: 'none', padding: '5px 8px', textAlign: 'center', fontWeight: 'bold' }} />
                                                        <button onClick={() => { const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; let res = ''; for (let i = 0; i < 6; i++) res += chars.charAt(Math.floor(Math.random() * chars.length)); const nd = [...paketSoal]; nd[idx].token = res; setPaketSoal(nd); }} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0 8px', cursor: 'pointer' }}><i className="fas fa-power-off"></i></button>
                                                    </div>
                                                    <label style={{ fontSize: '0.75rem', color: '#3b82f6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><input type="checkbox" checked={paket.acak} onChange={(e) => { const nd = [...paketSoal]; nd[idx].acak = e.target.checked; setPaketSoal(nd); }} /> Acak</label>
                                                </div>
                                            </td>
                                            <td style={{ padding: '15px 20px', textAlign: 'center', fontWeight: 'bold', color: 'var(--text-muted)' }}>{paket.count} Soal</td>
                                            <td style={{ padding: '15px 20px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                                                    <button onClick={async () => { try { await setDoc(doc(db, "pengaturan", "waktu_ujian"), { [paket.dbKey]: paket.durasi }, { merge: true }); await setDoc(doc(db, "pengaturan", "jadwal_ujian"), { [paket.dbKey]: paket.jadwal }, { merge: true }); await setDoc(doc(db, "pengaturan", "token_ujian"), { [`token_${paket.dbKey}`]: paket.token }, { merge: true }); await setDoc(doc(db, "pengaturan", "acak_soal"), { [paket.dbKey]: paket.acak }, { merge: true }); alert(`Tersimpan!`); } catch(e) {} }} style={actionBtnStyle('#10b981')} title="Simpan Jadwal/Token"><i className="fas fa-save"></i></button>
                                                    <button onClick={() => bukaDetailPaket(paket)} style={actionBtnStyle('#3b82f6')} title="Kelola/Edit Soal"><i className="fas fa-edit"></i></button>
                                                    <button onClick={() => hapusKeseluruhan(paket.mapel, paket.kelasKey)} style={actionBtnStyle('#ef4444')} title="Hapus Paket"><i className="fas fa-trash"></i></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* VIEW DETAIL (KELOLA SOAL - DRAG DROP) */}
            {viewMode === 'detail' && selectedPaket && (
                <div style={{ padding: '0 0 40px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 25, background: 'var(--card-bg)', padding: '18px 25px', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', flexWrap: 'wrap', gap: 15 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                            <button onClick={() => { setViewMode('summary'); loadDataLengkap(); }} style={{ background: 'var(--bg-main)', color: 'var(--text-main)', border: `1px solid var(--border-color)`, padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem' }}><i className="fas fa-arrow-left"></i></button>
                            <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.25rem', fontWeight: 800 }}>Kelola Paket: {selectedPaket.mapel} ({selectedPaket.kelasKey})</h3>
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button onClick={() => setShowBobotModal(true)} style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}><i className="fas fa-balance-scale"></i> Atur Bobot</button>
                            <button onClick={() => { setViewMode('summary'); loadDataLengkap(); }} style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}><i className="fas fa-check-circle"></i> Selesai Mengelola</button>
                        </div>
                    </div>
                    
                    {loadingSoal ? (
                        <div style={{ textAlign: 'center', padding: 50, color: 'var(--text-muted)' }}><i className="fas fa-spinner fa-spin fa-2x"></i><br/>Memuat Daftar Soal...</div>
                    ) : (
                        <div style={{ padding: '0 20px' }}>
                            <div style={{ textAlign: 'center', margin: '20px 0', position: 'relative' }}>
                                <hr style={{ border: 'none', borderTop: '1px dashed var(--border-color)', position: 'absolute', top: '50%', width: '100%', zIndex: 1 }} />
                                <button onClick={() => { setFormData({...defaultSoalData, mataPelajaran: selectedPaket.mapel, kelas: selectedPaket.kelasKey, nomor: 1}); setShowInputModal(true); }} style={{ position: 'relative', zIndex: 2, background: 'var(--card-bg)', color: '#10b981', border: '1px solid #10b981', padding: '8px 20px', borderRadius: '30px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'bold' }}><i className="fas fa-plus"></i> Sisipkan Soal di Sini</button>
                            </div>

                            {soalList.map((soal, idx) => {
                                const rawTipe = String(soal.tipe || '').toLowerCase();
                                const isPG = rawTipe === 'pg' || (rawTipe.includes('ganda') && !rawTipe.includes('kompleks'));
                                const isPGK = rawTipe === 'pgk' || rawTipe.includes('kompleks');
                                const isEssay = rawTipe.includes('essay') || rawTipe.includes('uraian');
                                const displayTipe = isPG ? 'PG' : (isPGK ? 'PGK' : (isEssay ? 'Essay' : soal.tipe));
                                const teksPertanyaan = soal.pertanyaan || soal.teks_soal || soal.soal || soal.teks || soal.Pertanyaan || '';
                                const kunciJawaban = soal.kunci || soal.Kunci || soal.jawaban || soal.Jawaban || '';

                                return (
                                <React.Fragment key={soal.id}>
                                    <div draggable onDragStart={(e) => handleDragStart(e, idx)} onDragOver={(e) => handleDragOver(e, idx)} onDrop={(e) => handleDrop(e, idx)} onClick={() => openEditSoal(soal)} style={{ background: dragOverId === idx ? 'var(--bg-main)' : 'var(--card-bg)', border: dragOverId === idx ? '2px dashed #3b82f6' : '1px solid var(--border-color)', borderRadius: '12px', padding: '25px', marginBottom: '10px', position: 'relative', boxShadow: 'var(--shadow-sm)', cursor: 'pointer', transition: 'all 0.2s', color: 'var(--text-main)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                                <i className="fas fa-grip-vertical" style={{ color: 'var(--text-muted)', cursor: 'grab', marginRight: 10, fontSize: '1.2rem' }}></i>
                                                <span style={{ color: '#10b981', fontWeight: 800, fontSize: '1.15rem' }}>Soal {soal.nomor || idx + 1}</span>
                                                <span style={{ background: '#3b82f6', color: 'white', padding: '3px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>{displayTipe}</span>
                                                <span style={{ background: '#f59e0b', color: 'white', padding: '3px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold' }}>Bobot: {soal.bobot || 1}</span>
                                            </div>
                                            <button onClick={(e) => handleDeleteSoal(e, soal.id)} style={{ background: '#fee2e2', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', color: '#dc2626' }} title="Hapus Soal"><i className="fas fa-trash"></i></button>
                                        </div>

                                        <div style={{ fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: '25px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                            {teksPertanyaan ? teksPertanyaan : <em style={{ color: 'var(--text-muted)' }}>Teks pertanyaan tidak tersedia.</em>}
                                        </div>

                                        {(isPG || isPGK) && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {['A', 'B', 'C', 'D', 'E'].map(opt => {
                                                    let isCorrect = false;
                                                    if (isPG) isCorrect = String(kunciJawaban).toUpperCase().trim() === opt;
                                                    if (isPGK) isCorrect = Array.isArray(kunciJawaban) ? kunciJawaban.includes(opt) : String(kunciJawaban).toUpperCase().includes(opt);
                                                    
                                                    const optText = soal.opsi?.[opt] || soal[`opsi${opt}`] || soal[opt] || '-';
                                                    const optStyle = isCorrect ? { background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981' } : { background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)' };
                                                    return (
                                                        <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '14px 20px', borderRadius: '8px', ...optStyle }}>
                                                            <span style={{ fontWeight: 800, fontSize: '1rem', width: '25px' }}>{isCorrect ? <i className="fas fa-check-circle" style={{ fontSize: '1.2rem' }}></i> : `${opt}.`}</span>
                                                            <span style={{ fontSize: '0.95rem', fontWeight: isCorrect ? 600 : 400 }}>{optText}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {(!isPG && !isPGK) && (
                                            <div style={{ background: 'var(--bg-main)', padding: '18px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                <strong style={{ color: '#0284c7' }}><i className="fas fa-key"></i> Kunci Jawaban / Rubrik ({displayTipe}):</strong><br/><br/>
                                                <span style={{ color: 'var(--text-muted)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{kunciJawaban || 'Tidak ada panduan rubrik.'}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ textAlign: 'center', margin: '20px 0', position: 'relative' }}>
                                        <hr style={{ border: 'none', borderTop: '1px dashed var(--border-color)', position: 'absolute', top: '50%', width: '100%', zIndex: 1 }} />
                                        <button onClick={() => { setFormData({...defaultSoalData, mataPelajaran: selectedPaket.mapel, kelas: selectedPaket.kelasKey, nomor: (soal.nomor || idx+1) + 1}); setShowInputModal(true); }} style={{ position: 'relative', zIndex: 2, background: 'var(--card-bg)', color: '#10b981', border: '1px solid #10b981', padding: '8px 20px', borderRadius: '30px', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 'bold' }}><i className="fas fa-plus"></i> Sisipkan Soal di Sini</button>
                                    </div>
                                </React.Fragment>
                            )})}
                        </div>
                    )}
                </div>
            )}

            {/* ========================================== */}
            {/* MODAL INPUT / EDIT SOAL LENGKAP & IMPORT */}
            {/* ========================================== */}
            {showInputModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <div style={{ background: 'var(--card-bg)', width: '760px', maxWidth: '96%', maxHeight: '92vh', overflow: 'hidden', borderRadius: '18px', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' }}>
                        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-main)' }}>
                            <h3 style={{ margin: 0, color: 'var(--text-main)' }}><i className="fas fa-pen-to-square"></i> {formData.id ? 'Edit Soal' : 'Input Soal Baru'}</h3>
                            <button onClick={() => setShowInputModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
                        </div>
                        <form onSubmit={handleSaveSoal} style={{ padding: '22px 24px', overflowY: 'auto', flex: 1, color: 'var(--text-main)' }}>
                            
                            {/* MENU IMPORT MASSAL (Hanya muncul saat tambah baru) */}
                            {!formData.id && (
                                <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '18px 20px', marginBottom: '22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
                                    <div style={{ flex: 1, minWidth: '200px' }}>
                                        <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1rem', fontWeight: 700 }}><i className="fas fa-bolt" style={{ color: '#f59e0b' }}></i> Import Massal Soal</h4>
                                        <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Support Teks AI (.txt), Word (.docx), atau Excel (.xlsx).</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <button type="button" onClick={downloadTemplateExcel} style={{ background: '#ecfdf5', color: '#059669', padding: '8px 12px', fontSize: '0.85rem', border: '1px solid #a7f3d0', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}><i className="fas fa-file-excel"></i> Excel</button>
                                        <button type="button" onClick={downloadTemplateWord} style={{ background: '#eff6ff', color: '#2563eb', padding: '8px 12px', fontSize: '0.85rem', border: '1px solid #bfdbfe', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}><i className="fas fa-file-word"></i> Teks / Word</button>
                                        <button type="button" onClick={processLinkImport} style={{ background: '#fffbeb', color: '#d97706', padding: '8px 12px', fontSize: '0.85rem', border: '1px solid #fde68a', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}><i className="fas fa-link"></i> GDrive Link</button>
                                        <div style={{ width: '1px', height: '28px', background: 'var(--border-color)', margin: '0 4px', display: 'inline-block' }}></div>
                                        <label style={{ background: '#10b981', color: 'white', padding: '8px 15px', fontSize: '0.85rem', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                                            <i className="fas fa-cloud-upload-alt"></i> Upload
                                            <input type="file" accept=".xlsx,.xls,.txt,.doc,.docx" onChange={handleUploadFileSoal} style={{ display: 'none' }} />
                                        </label>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '20px' }}>
                                <div style={{ width: '70px' }}>
                                    <label style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>No</label>
                                    <input type="number" className="input-text" value={formData.nomor} onChange={e => setFormData({...formData, nomor: e.target.value})} style={{ width: '100%', padding: '10px', textAlign: 'center' }} />
                                </div>
                                <div style={{ width: '80px' }}>
                                    <label style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>Bobot</label>
                                    <input type="number" className="input-text" value={formData.bobot} onChange={e => setFormData({...formData, bobot: e.target.value})} style={{ width: '100%', padding: '10px', color: '#d97706', textAlign: 'center', fontWeight: 'bold' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>Tipe Soal</label>
                                    <select className="input-text" value={formData.tipe} onChange={e => setFormData({...formData, tipe: e.target.value})} style={{ width: '100%', padding: '10px' }}>
                                        <option value="PG">Pilihan Ganda</option>
                                        <option value="PGK">Pilihan Ganda Kompleks</option>
                                        <option value="Menjodohkan">Menjodohkan</option>
                                        <option value="Essay">Essay / Uraian</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}><i className="fas fa-align-left" style={{ color: '#10b981' }}></i> Teks Pertanyaan</label>
                                <textarea className="input-text" value={formData.pertanyaan} onChange={e => setFormData({...formData, pertanyaan: e.target.value})} rows="4" style={{ width: '100%', padding: '12px', minHeight: '100px', resize: 'vertical', whiteSpace: 'pre-wrap' }} required></textarea>
                            </div>

                            {/* MEDIA UTAMA DIPINDAH KE BAWAH PERTANYAAN */}
                            <div style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', marginBottom: '20px' }}>
                                <label style={{ fontWeight: 600, marginBottom: '8px', display: 'block', fontSize: '0.88rem', color: 'var(--text-main)' }}><i className="fas fa-photo-video" style={{ color: '#0ea5e9' }}></i> Sisipkan Media Utama (Gambar/Audio/Video)</label>
                                <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                                    <label style={{ fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-main)' }}><input type="radio" checked={formData.tipeMediaUtama === 'file'} onChange={() => setFormData({...formData, tipeMediaUtama: 'file'})} /> Upload File</label>
                                    <label style={{ fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-main)' }}><input type="radio" checked={formData.tipeMediaUtama === 'url'} onChange={() => setFormData({...formData, tipeMediaUtama: 'url'})} /> Link (URL)</label>
                                </div>
                                {formData.tipeMediaUtama === 'file' ? (
                                    <input type="file" className="input-text" accept="image/*,video/*,audio/*" style={{ width: '100%', padding: '8px', fontSize: '0.85rem' }} />
                                ) : (
                                    <input type="text" className="input-text" value={formData.mediaUtamaUrl} onChange={e => setFormData({...formData, mediaUtamaUrl: e.target.value})} placeholder="https://... (Link Gambar/Video dari internet)" style={{ width: '100%', padding: '8px', fontSize: '0.85rem' }} />
                                )}
                            </div>

                            {(formData.tipe === 'PG' || formData.tipe === 'PGK') && (
                                <div>
                                    <label style={{ fontWeight: 700, marginBottom: '10px', display: 'block', fontSize: '0.9rem', color: 'var(--text-main)' }}><i className="fas fa-list-ol" style={{ color: '#10b981' }}></i> Opsi Jawaban & Media</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {['A', 'B', 'C', 'D', 'E'].map(opsi => {
                                            const isChecked = formData.tipe === 'PG' ? formData.kunciPG === opsi : formData.kunciPGK.includes(opsi);
                                            return (
                                                <div key={opsi} style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px', display: 'flex', gap: '10px', flexDirection: 'column' }}>
                                                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                                        <div style={{ width: '28px', height: '28px', background: isChecked ? '#22c55e' : 'var(--card-bg)', color: isChecked ? 'white' : '#10b981', border: `1px solid ${isChecked ? '#22c55e' : '#10b981'}`, borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0 }}>{opsi}</div>
                                                        <input type="text" className="input-text" value={formData[`opsi${opsi}`]} onChange={e => setFormData({...formData, [`opsi${opsi}`]: e.target.value})} placeholder={`Teks Pilihan ${opsi}...`} style={{ flex: 1, padding: '8px 10px' }} required={isChecked} />
                                                        
                                                        {formData.tipe === 'PG' ? (
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: '#10b981', fontWeight: 600, cursor: 'pointer' }}>
                                                                <input type="radio" name="kunci-pg" checked={isChecked} onChange={() => setFormData({...formData, kunciPG: opsi})} /> Kunci
                                                            </label>
                                                        ) : (
                                                            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: '#0ea5e9', fontWeight: 600, cursor: 'pointer' }}>
                                                                <input type="checkbox" checked={isChecked} onChange={(e) => {
                                                                    const newKunciPGK = e.target.checked ? [...formData.kunciPGK, opsi] : formData.kunciPGK.filter(k => k !== opsi);
                                                                    setFormData({...formData, kunciPGK: newKunciPGK});
                                                                }} /> Benar
                                                            </label>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingLeft: '38px' }}>
                                                        <select className="input-text" value={formData.mediaOpsi?.[opsi]?.tipe || 'file'} onChange={e => setFormData({...formData, mediaOpsi: {...formData.mediaOpsi, [opsi]: {...formData.mediaOpsi[opsi], tipe: e.target.value}}})} style={{ width: '70px', padding: '4px', fontSize: '0.75rem' }}>
                                                            <option value="file">File</option><option value="url">URL</option>
                                                        </select>
                                                        {formData.mediaOpsi?.[opsi]?.tipe === 'file' ? (
                                                            <input type="file" className="input-text" accept="image/*,video/*,audio/*" style={{ flex: 1, fontSize: '0.75rem', padding: '4px' }} title="Pilih media opsional" />
                                                        ) : (
                                                            <input type="text" className="input-text" value={formData.mediaOpsi?.[opsi]?.url || ''} onChange={e => setFormData({...formData, mediaOpsi: {...formData.mediaOpsi, [opsi]: {...formData.mediaOpsi[opsi], url: e.target.value}}})} placeholder="https://..." style={{ flex: 1, fontSize: '0.75rem', padding: '4px' }} />
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {(formData.tipe === 'Essay' || formData.tipe === 'Menjodohkan') && (
                                <div>
                                    <label style={{ fontWeight: 700, marginBottom: '8px', display: 'block', color: 'var(--text-main)' }}><i className="fas fa-align-justify" style={{ color: '#0284c7' }}></i> Kunci Jawaban / Rubrik</label>
                                    <textarea className="input-text" value={formData.kunciEssay} onChange={e => setFormData({...formData, kunciEssay: e.target.value})} rows="3" style={{ width: '100%', padding: '12px' }} placeholder="Tuliskan panduan atau kunci jawaban..."></textarea>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '25px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                                <button type="submit" disabled={isSavingSoal} style={{ background: '#10b981', color: 'white', border: 'none', padding: '12px 30px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: '1rem' }}>
                                    <i className="fas fa-save"></i> {isSavingSoal ? 'Menyimpan...' : 'Simpan'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL ATUR BOBOT MASSAL */}
            {showBobotModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.8)', zIndex: 10006, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ background: 'var(--card-bg)', width: '450px', maxWidth: '90%', padding: '35px 25px', borderRadius: '10px' }}>
                        <span onClick={() => setShowBobotModal(false)} style={{ float: 'right', cursor: 'pointer', fontSize: '1.5rem', color: 'var(--text-muted)' }}>&times;</span>
                        <h3 style={{ margin: '0 0 5px 0', color: 'var(--text-main)' }}><i className="fas fa-balance-scale"></i> Atur Bobot Massal</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>Tentukan bobot poin otomatis berdasarkan tipe soal untuk paket <b>{selectedPaket?.mapel}</b>.</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                            <div><label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Pilihan Ganda (PG)</label><input type="number" className="input-text" value={massBobot.PG} onChange={(e) => setMassBobot({...massBobot, PG: e.target.value})} style={{ width: '100%', padding: '10px' }} min="1" /></div>
                            <div><label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)' }}>PG Kompleks</label><input type="number" className="input-text" value={massBobot.PGK} onChange={(e) => setMassBobot({...massBobot, PGK: e.target.value})} style={{ width: '100%', padding: '10px' }} min="1" /></div>
                            <div><label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Menjodohkan</label><input type="number" className="input-text" value={massBobot.Menjodohkan} onChange={(e) => setMassBobot({...massBobot, Menjodohkan: e.target.value})} style={{ width: '100%', padding: '10px' }} min="1" /></div>
                            <div><label style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)' }}>Essay / Uraian</label><input type="number" className="input-text" value={massBobot.Essay} onChange={(e) => setMassBobot({...massBobot, Essay: e.target.value})} style={{ width: '100%', padding: '10px' }} min="1" /></div>
                        </div>
                        <button onClick={handleSimpanBobotMassal} disabled={isSavingSoal} style={{ width: '100%', background: '#f59e0b', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                            <i className="fas fa-sync-alt"></i> {isSavingSoal ? 'Menyimpan...' : 'Terapkan Bobot'}
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL DATA MASTER */}
            {showMasterModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ background: 'var(--card-bg)', width: '600px', maxWidth: '90%', padding: '35px 25px', borderRadius: '10px' }}>
                        <span onClick={() => setShowMasterModal(false)} style={{ float: 'right', cursor: 'pointer', fontSize: '1.5rem', color: 'var(--text-muted)' }}>&times;</span>
                        <h3 style={{ marginTop: 0, color: 'var(--text-main)' }}>Data Master</h3>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
                            <select className="input-text" value={masterInputType} onChange={(e) => setMasterInputType(e.target.value)} style={{ flex: 1, padding: '10px' }}>
                                <option value="mapel">Mata Pelajaran</option>
                                <option value="kelas">Kelas</option>
                            </select>
                            <input type="text" className="input-text" value={masterInputValue} onChange={(e) => setMasterInputValue(e.target.value)} placeholder="Ketik nama data..." style={{ flex: 2, padding: '10px' }} />
                            <button onClick={handleAddMaster} style={{ padding: '10px 15px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Tambah</button>
                        </div>
                        <button onClick={() => setIsEditMasterMode(!isEditMasterMode)} style={{ marginBottom: '15px', width: '100%', padding: '10px', background: isEditMasterMode ? '#ef4444' : 'var(--bg-main)', color: isEditMasterMode ? 'white' : 'var(--text-main)', border: `1px solid var(--border-color)`, borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                            <i className="fas fa-edit"></i> {isEditMasterMode ? 'Selesai Edit' : 'Mode Hapus Data'}
                        </button>
                        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1 }}>
                                <h4 style={{ color: 'var(--text-main)' }}>Mapel ({masterData.mapel?.length || 0})</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto' }}>
                                    {masterData.mapel?.map((m, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px' }}>
                                            <span>{m}</span>{isEditMasterMode && <button onClick={() => handleDeleteMaster('mapel', m)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><i className="fas fa-trash"></i></button>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <h4 style={{ color: 'var(--text-main)' }}>Kelas ({masterData.kelas?.length || 0})</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto' }}>
                                    {masterData.kelas?.map((k, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: 'var(--bg-main)', border: '1px solid var(--border-color)', color: 'var(--text-main)', borderRadius: '6px' }}>
                                            <span>{k}</span>{isEditMasterMode && <button onClick={() => handleDeleteMaster('kelas', k)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}><i className="fas fa-trash"></i></button>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}