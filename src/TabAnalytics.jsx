import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase-config';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function TabAnalytics() {
    const [dataGrafik, setDataGrafik] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDataMapel();
    }, []);

    const fetchDataMapel = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, "hasil_ujian"));
            const mapelCounts = {};
            
            // Mengelompokkan dan menghitung jumlah siswa per mata pelajaran
            snap.forEach(doc => {
                const mapel = doc.data().mataPelajaran || "Tanpa Mapel";
                if (!mapelCounts[mapel]) {
                    mapelCounts[mapel] = 0;
                }
                mapelCounts[mapel]++;
            });

            // Mengubah format data agar bisa dibaca oleh Recharts
            const formattedData = Object.keys(mapelCounts).map(key => ({
                mapel: key,
                jumlah: mapelCounts[key]
            }));
            
            setDataGrafik(formattedData);
        } catch (e) {
            console.error("Gagal ambil data:", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card" style={{ padding: '25px', background: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#1e293b', fontSize: '1.2rem' }}>
                <i className="fas fa-chart-line" style={{ color: '#3b82f6', marginRight: '8px' }}></i> 
                Statistik Progres Ujian (Per Mapel)
            </h3>
            
            {loading ? (
                <p style={{ textAlign: 'center', color: '#64748b' }}><i className="fas fa-spinner fa-spin"></i> Memuat data progres...</p>
            ) : dataGrafik.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#64748b' }}>Belum ada data hasil ujian yang masuk ke sistem.</p>
            ) : (
                <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={dataGrafik} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="mapel" tick={{ fill: '#475569', fontWeight: 600 }} />
                        <YAxis allowDecimals={false} tick={{ fill: '#475569' }} />
                        <Tooltip 
                            cursor={{ fill: '#f8fafc' }} 
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar 
                            dataKey="jumlah" 
                            fill="#3b82f6" 
                            name="Jumlah Siswa Ujian" 
                            radius={[6, 6, 0, 0]} 
                            barSize={60}
                        />
                    </BarChart>
                </ResponsiveContainer>
            )}
        </div>
    );
}