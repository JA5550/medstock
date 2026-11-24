import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

const API = import.meta.env?.VITE_API_URL || 'http://localhost:4000';

export default function App() {
  const [empId, setEmpId] = useState('JD5550');
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

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900">
        <form onSubmit={handleLogin} className="bg-white rounded-2xl p-8 max-w-sm w-full space-y-4 shadow-xl">
          <h1 className="text-xl font-bold">Consumables &amp; Equipments</h1>
          <input value={empId} onChange={e => setEmpId(e.target.value)} placeholder="Employee ID" className="w-full px-3 py-2 border rounded-xl text-sm uppercase" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full px-3 py-2 border rounded-xl text-sm" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="submit" className="w-full py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold">Sign In</button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border">
        <div>
          <h2 className="font-bold">Signed in: {session.user.emp_id} ({session.user.role})</h2>
          <p className="text-xs text-slate-500">Scope: {session.user.assignment?.dept_name || 'All Departments'}</p>
        </div>
        <button onClick={() => setSession(null)} className="px-3 py-1.5 bg-slate-900 text-white text-xs rounded-xl">Sign Out</button>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
