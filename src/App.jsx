import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Login from './Login';
import Dashboard from './Dashboard';
import ExamAttempt from './ExamAttempt'; 

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/exam" element={<ExamAttempt />} /> 
      </Routes>
    </HashRouter>
  );
}