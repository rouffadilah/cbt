import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './Login';
import Dashboard from './Dashboard';
import ExamAttempt from './ExamAttempt'; // Import halaman baru ini

export default function App() {
  return (
    <BrowserRouter basename="/cbt">
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/exam" element={<ExamAttempt />} /> {/* Tambahkan baris ini */}
      </Routes>
    </BrowserRouter>
  );
}