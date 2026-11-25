import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

const API = import.meta.env?.VITE_API_URL || 'http://localhost:4000';

export default function App() {
  const [empId, setEmpId] = useState('JA5550');
  const [password, setPassword] = useState('123456');
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emp_id: empId, password })
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || 'Sign in failed');
      setSession(data);
    } catch {
      setError('Cannot reach backend API. Check VITE_API_URL.');
    }
  }

  function scrollToLogin() {
    document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' });
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Dark Emerald Hero Section */}
        <div className="bg-gradient-to-b from-[#040B08] via-[#062216] to-[#04140D] text-white">
          <header className="px-6 py-4 flex items-center justify-between max-w-6xl w-full mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 font-bold text-lg">
                M+
              </div>
              <div>
                <div className="text-xl font-bold tracking-wide text-white">MedStock</div>
                <div className="text-[11px] text-emerald-300/80 uppercase tracking-widest">Hospital Stock Management</div>
              </div>
            </div>
            <button
              onClick={scrollToLogin}
              className="px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/25 transition"
            >
              Staff Sign In
            </button>
          </header>

          <section className="max-w-4xl w-full mx-auto px-6 py-10 text-center space-y-6">
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight text-white">
              MedStock — Complete Hospital Consumables &amp; Equipments Control
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
              MedStock provides department-wise digital control for your entire hospital supply chain—separating Surgical &amp; Non-Surgical Consumables and Serial-Tracked Equipments across Gastro, ICU, Operation Theatre, and General Wards with strict Storekeeper and read-only Viewer permissions.
            </p>
            <div className="flex justify-center">
              <button
                onClick={scrollToLogin}
                className="px-8 py-3.5 rounded-full bg-[#19A968] hover:bg-[#15935A] text-white font-semibold text-sm tracking-wide shadow-lg shadow-emerald-950/50 transition flex items-center gap-2"
              >
                SIGN IN TO STORE <span>&rsaquo;</span>
              </button>
            </div>
            <div className="pt-4 flex justify-center">
              <img
                src="/medstock-hero.jpg"
                alt="MedStock Hospital Network Illustration"
                className="w-full max-w-md rounded-3xl shadow-2xl border border-emerald-500/20"
              />
            </div>
          </section>
        </div>

        {/* User Login Section Directly Below the Image */}
        <section id="login-section" className="flex-1 bg-white text-slate-900 py-14 px-4 flex flex-col items-center justify-center">
          <form onSubmit={handleLogin} className="bg-slate-50 border border-slate-200 rounded-3xl p-8 max-w-sm w-full space-y-4 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">M+</div>
              <h2 className="text-lg font-bold text-slate-
