import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

const API = import.meta.env?.VITE_API_URL || 'http://localhost:4000';

export default function App() {
  const [empId, setEmpId] = useState('JA5550');
  const [password, setPassword] = useState('123456');
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('dashboard');
  const [toast, setToast] = useState('');

  // Live PostgreSQL Data
  const [depts, setDepts] = useState([]);
  const [consumables, setConsumables] = useState([]);
  const [equipments, setEquipments] = useState([]);
  const [indents, setIndents] = useState([]);
  const [loans, setLoans] = useState([]);
  const [storekeepers, setStorekeepers] = useState([]);
  const [viewers, setViewers] = useState([]);

  // Filters & Forms
  const [subcat, setSubcat] = useState('ALL');
  const [newDept, setNewDept] = useState('');
  const [confirmDelDept, setConfirmDelDept] = useState(null);
  const [skEmp, setSkEmp] = useState('');
  const [skDept, setSkDept] = useState('');
  const [skScope, setSkScope] = useState('CONSUMABLES_ONLY');
  const [vEmp, setVEmp] = useState('');
  const [vDept, setVDept] = useState('');
  const [inwardMode, setInwardMode] = useState('single');
  const [inwardForm, setInwardForm] = useState({ tender_no: 'TND-2026-01', area: 'CONSUMABLES', sub_category: 'SURGICAL', name: '', dept_id: '', qty: 25, code: '', expiry_date: '2028-06-30' });
  const [multiRows, setMultiRows] = useState([{ area: 'CONSUMABLES', sub_category: 'SURGICAL', name: '', qty: 10, code: '', expiry_date: '2028-06-30' }]);
  const [indForm, setIndForm] = useState({ requesting_unit: '', item_id: '', req_qty: 10 });
  const [loanForm, setLoanForm] = useState({ lender_dept_name: '', item_id: '', qty: 5 });
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ cur: '', nw: '', cf: '' });

  function notify(msg) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  async function api(path, opts = {}) {
    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.token}` } : {}), ...(opts.headers || {}) }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  async function loadAll(activeSession = session) {
    if (!activeSession) return;
    const h = { Authorization: `Bearer ${activeSession.token}` };
    const get = p => fetch(`${API}${p}`, { headers: h }).then(r => (r.ok ? r.json() : []));
    const [d, c, e, i, l, sk, vw] = await Promise.all([
      get('/api/departments'), get('/api/consumables'), get('/api/equipments'),
      activeSession.user.role !== 'VIEWER' ? get('/api/indents') : [],
      activeSession.user.role !== 'VIEWER' ? get('/api/loans') : [],
      get('/api/admin/storekeepers'),
      activeSession.user.role !== 'VIEWER' ? get('/api/storekeeper/viewers') : []
    ]);
    setDepts(d); setConsumables(c); setEquipments(e); setIndents(i); setLoans(l); setStorekeepers(sk); setViewers(vw);
    if (d[0]) {
      setSkDept(s => s || d[0].dept_id);
      setVDept(s => s || d[0].dept_id);
      setInwardForm(f => ({ ...f, dept_id: f.dept_id || d[0].dept_id }));
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ emp_id: empId, password }) });
      setSession(data);
      setTab('dashboard');
      loadAll(data);
    } catch (err) { setError(err.message); }
  }

  async function downloadExcel(area) {
    try {
      const res = await fetch(`${API}/api/reports/export/${area}`, { headers: { Authorization: `Bearer ${session.token}` } });
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `MedStock-${area}-Report.xlsx`;
      a.click();
      notify(`Exported ${area} Excel (.xlsx)`);
    } catch { notify('Export failed'); }
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="bg-gradient-to-b from-[#040B08] via-[#062216] to-[#04140D] text-white">
          <header className="px-6 py-4 flex items-center justify-between max-w-6xl w-full mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 font-bold text-lg">M+</div>
              <div>
                <div className="text-xl font-bold tracking-wide text-white">MedStock</div>
                <div className="text-[11px] text-emerald-300/80 uppercase tracking-widest">Hospital Stock Management</div>
              </div>
            </div>
            <button onClick={() => document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' })} className="px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-xs font-semibold">Staff Sign In</button>
          </header>
          <section className="max-w-4xl w-full mx-auto px-6 py-10 text-center space-y-6">
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight text-white">MedStock — Complete Hospital Consumables &amp; Equipments Control</h1>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto">Department-wise digital control for Surgical &amp; Non-Surgical Consumables and Serial-Tracked Equipments with strict Storekeeper and read-only Viewer permissions.</p>
            <div className="flex justify-center">
              <button onClick={() => document.getElementById('login-section')?.scrollIntoView({ behavior: 'smooth' })} className="px-8 py-3.5 rounded-full bg-[#19A968] hover:bg-[#15935A] text-white font-semibold text-sm shadow-lg">SIGN IN TO STORE &rsaquo;</button>
            </div>
            <div className="pt-4 flex justify-center">
              <img src="/medstock-hero.jpg" alt="MedStock Illustration" className="w-full max-w-md rounded-3xl shadow-2xl border border-emerald-500/20" />
            </div>
          </section>
        </div>
        <section id="login-section" className="flex-1 bg-white text-slate-900 py-14 px-4 flex justify-center items-center">
          <form onSubmit={handleLogin} className="bg-slate-50 border border-slate-200 rounded-3xl p-8 max-w-sm w-full space-y-4 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">M+</div>
              <h2 className="text-lg font-bold">Consumables &amp; Equipments</h2>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Employee ID</label>
              <input value={empId} onChange={e => setEmpId(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm uppercase" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm" />
            </div>
            {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
            <button type="submit" className="w-full py-2.5 bg-[#19A968] text-white rounded-xl text-sm font-semibold">Sign In</button>
          </form>
        </section>
      </div>
    );
  }

  const u = session.user;
  const isViewer = u.role === 'VIEWER';
  const isAdmin = u.role === 'SUPER_ADMIN';
  const scope = u.assignment?.scope || 'BOTH';
  const allowCons = scope !== 'EQUIPMENT_ONLY';
  const allowEquip = scope !== 'CONSUMABLES_ONLY';

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'reports', label: 'Monthly Report' },
    { id: 'consumables', label: 'Consumables' },
    { id: 'equipments', label: 'Equipments' },
    ...(!isViewer ? [{ id: 'indents', label: 'Indent & Borrow' }, { id: 'intake', label: 'Inward Items' }, { id: 'access', label: 'Access Control' }] : [])
  ];

  const uniqueItems = [];
  const seenItemIds = new Set();
  [...consumables, ...equipments].forEach(x => { if (!seenItemIds.has(x.item_id)) { seenItemIds.add(x.item_id); uniqueItems.push(x); } });

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900">
      <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col justify-between p-5 shrink-0">
        <div className="space-y-6">
          <div>
            <div className="font-bold text-lg text-emerald-400">MedStock</div>
            <div className="text-xs text-slate-400">{u.assignment?.dept_name || 'All Departments'}</div>
          </div>
          <nav className="flex flex-col space-y-1">
            {navItems.map(n => (
              <button key={n.id} onClick={() => setTab(n.id)} className={`text-left px-3.5 py-2.5 rounded-xl text-sm font-medium ${tab === n.id ? 'bg-teal-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                {n.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-2">
          <div className="text-xs"><div className="font-bold">{u.emp_id}</div><div className="text-slate-400">{u.role}</div></div>
          <div className="flex gap-1.5">
            <button onClick={() => setShowPwdModal(true)} className="px-2 py-1 bg-slate-800 text-teal-300 text-xs rounded-lg">Password</button>
            <button onClick={() => setSession(null)} className="px-2.5 py-1 bg-slate-800 text-xs rounded-lg">Sign Out</button>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6 max-w-6xl space-y-6">
        {tab === 'dashboard' && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border"><div className="text-xs text-slate-500">Consumables Batches</div><div className="text-2xl font-bold mt-1">{allowCons ? consumables.length : 'Restricted'}</div></div>
            <div className="bg-white p-5 rounded-2xl border"><div className="text-xs text-slate-500">Equipment Assets</div><div className="text-2xl font-bold mt-1">{allowEquip ? equipments.length : 'Restricted'}</div></div>
            <div className="bg-white p-5 rounded-2xl border"><div className="text-xs text-slate-500">Departments</div><div className="text-2xl font-bold mt-1">{depts.length}</div></div>
          </div>
        )}

        {tab === 'reports' && (
          <div className="bg-white p-6 rounded-2xl border space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <h2 className="font-bold text-lg">Monthly Report (Separate Excel Exports)</h2>
              <div className="flex flex-wrap gap-2">
                {allowCons && <button onClick={() => downloadExcel('CONSUMABLES')} className="px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-xl">Consumables (.xlsx)</button>}
                {allowEquip && <button onClick={() => downloadExcel('EQUIPMENTS')} className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl">Equipments (.xlsx)</button>}
                {allowCons && allowEquip && <button onClick={() => downloadExcel('COMBINED')} className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl">Combined (.xlsx)</button>}
              </div>
            </div>
          </div>
        )}

        {tab === 'consumables' && (
          <div className="space-y-4">
            {!allowCons ? <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 text-sm">Restricted: Your scope is Equipments Only.</div> : (
              <>
                <div className="flex gap-2">
                  {['ALL', 'SURGICAL', 'NON_SURGICAL'].map(s => (
                    <button key={s} onClick={() => setSubcat(s)} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${subcat === s ? 'bg-slate-900 text-white' : 'bg-white border'}`}>{s.replace('_', '-')}</button>
                  ))}
                </div>
                <div className="bg-white rounded-2xl border overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500"><tr><th className="p-3">Item</th><th className="p-3">Type</th><th className="p-3">Dept</th><th className="p-3">Batch &amp; Exp</th><th className="p-3">Qty</th><th className="p-3 text-right">Action</th></tr></thead>
                    <tbody className="divide-y">
                      {consumables.filter(c => subcat === 'ALL' || c.sub_category === subcat).map(c => (
                        <tr key={c.batch_id}><td className="p-3 font-medium">{c.name}</td><td className="p-3">{c.sub_category}</td><td className="p-3">{c.dept_name}</td><td className="p-3">{c.batch_no} · {String(c.expiry_date).slice(0, 10)}</td><td className="p-3 font-bold">{c.qty}</td><td className="p-3 text-right">{!isViewer ? <button onClick={async () => { await api(`/api/consumables/use/${c.batch_id}`, { method: 'POST' }); loadAll(); }} className="px-2.5 py-1 bg-slate-100 rounded-lg text-xs">-1 Use</button> : 'Read-Only'}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'equipments' && (
          !allowEquip ? <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 text-sm">Restricted: Your scope is Consumables Only.</div> : (
            <div className="bg-white rounded-2xl border overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b text-xs uppercase text-slate-500"><tr><th className="p-3">Equipment</th><th className="p-3">Serial</th><th className="p-3">Dept</th><th className="p-3">Status</th><th className="p-3 text-right">Action</th></tr></thead>
                <tbody className="divide-y">
                  {equipments.map(eq => (
                    <tr key={eq.asset_id}><td className="p-3 font-medium">{eq.name}</td><td className="p-3 font-mono text-xs">{eq.serial_no}</td><td className="p-3">{eq.dept_name}</td><td className="p-3">{eq.status}</td><td className="p-3 text-right">{!isViewer ? <button onClick={async () => { await api(`/api/equipments/${eq.asset_id}/toggle`, { method: 'PATCH' }); loadAll(); }} className="px-2.5 py-1 bg-slate-100 rounded-lg text-xs">Toggle</button> : 'Read-Only'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === 'indents' && !isViewer && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl border space-y-4">
              <h3 className="font-bold">Ward / OT Indent</h3>
              <form onSubmit={async e => { e.preventDefault(); await api('/api/indents', { method: 'POST', body: JSON.stringify({ ...indForm, store_dept_id: u.assignment?.dept_id || depts[0]?.dept_id }) }); setIndForm({ ...indForm, requesting_unit: '' }); loadAll(); notify('Indent recorded'); }} className="space-y-2">
                <input required placeholder="Ward / OT (e.g. OT-2)" value={indForm.requesting_unit} onChange={e => setIndForm({ ...indForm, requesting_unit: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" />
                <select required value={indForm.item_id} onChange={e => setIndForm({ ...indForm, item_id: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm">
                  <option value="">Select item in stock...</option>
                  {uniqueItems.map(x => <option key={x.item_id} value={x.item_id}>{x.name}</option>)}
                </select>
                <input type="number" min="1" value={indForm.req_qty} onChange={e => setIndForm({ ...indForm, req_qty: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" />
                <button className="w-full py-2 bg-teal-600 text-white rounded-xl text-sm font-semibold">Create Indent</button>
              </form>
              <div className="space-y-2">{indents.map(i => <div key={i.indent_id} className="p-3 border rounded-xl flex justify-between items-center text-sm"><div><strong>{i.item_name}</strong> ({i.req_qty}) · {i.requesting_unit}</div>{i.status === 'PENDING' ? <button onClick={async () => { await api(`/api/indents/${i.indent_id}/issue`, { method: 'POST' }); loadAll(); }} className="px-2.5 py-1 bg-teal-600 text-white text-xs rounded-lg">Issue</button> : <span className="text-xs text-teal-700 font-semibold">Issued</span>}</div>)}</div>
            </div>

            <div className="bg-white p-5 rounded-2xl border space-y-4">
              <h3 className="font-bold">Inter-Store Borrow</h3>
              <form onSubmit={async e => { e.preventDefault(); await api('/api/loans', { method: 'POST', body: JSON.stringify({ ...loanForm, borrower_dept_id: u.assignment?.dept_id || depts[0]?.dept_id }) }); setLoanForm({ ...loanForm, lender_dept_name: '' }); loadAll(); notify('Loan recorded'); }} className="space-y-2">
                <input required placeholder="Lender Store (e.g. OT)" value={loanForm.lender_dept_name} onChange={e => setLoanForm({ ...loanForm, lender_dept_name: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" />
                <select required value={loanForm.item_id} onChange={e => setLoanForm({ ...loanForm, item_id: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm">
                  <option value="">Select item...</option>
                  {uniqueItems.map(x => <option key={x.item_id} value={x.item_id}>{x.name}</option>)}
                </select>
                <input type="number" min="1" value={loanForm.qty} onChange={e => setLoanForm({ ...loanForm, qty: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" />
                <button className="w-full py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold">Record Borrow</button>
              </form>
              <div className="space-y-2">{loans.map(l => <div key={l.loan_id} className="p-3 border rounded-xl flex justify-between items-center text-sm"><div><strong>{l.item_name}</strong> ({l.qty}) · From {l.lender_dept_name}</div>{l.status === 'BORROWED' ? <button onClick={async () => { await api(`/api/loans/${l.loan_id}/return`, { method: 'POST' }); loadAll(); }} className="px-2.5 py-1 bg-slate-800 text-white text-xs rounded-lg">Return</button> : <span className="text-xs text-slate-500">Returned</span>}</div>)}</div>
            </div>
          </div>
        )}

        {tab === 'intake' && !isViewer && (
          <div className="bg-white p-6 rounded-2xl border space-y-4">
            <div className="flex gap-2">
              {[['single', 'Single Entry'], ['multi', 'Multiple Entry'], ['import', 'Import CSV']].map(([k, lbl]) => (
                <button key={k} onClick={() => setInwardMode(k)} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold ${inwardMode === k ? 'bg-slate-900 text-white' : 'border'}`}>{lbl}</button>
              ))}
            </div>
            {inwardMode === 'single' && (
              <form onSubmit={async e => { e.preventDefault(); await api('/api/inward/bulk', { method: 'POST', body: JSON.stringify({ items: [inwardForm] }) }); setInwardForm({ ...inwardForm, name: '', code: '' }); loadAll(); notify('Inward item saved'); }} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input placeholder="Tender / PO No" value={inwardForm.tender_no} onChange={e => setInwardForm({ ...inwardForm, tender_no: e.target.value })} className="px-3 py-2 border rounded-xl text-sm" />
                <select value={inwardForm.area} onChange={e => setInwardForm({ ...inwardForm, area: e.target.value })} className="px-3 py-2 border rounded-xl text-sm"><option value="CONSUMABLES">Consumables</option><option value="EQUIPMENTS">Equipments</option></select>
                {inwardForm.area === 'CONSUMABLES' && <select value={inwardForm.sub_category} onChange={e => setInwardForm({ ...inwardForm, sub_category: e.target.value })} className="px-3 py-2 border rounded-xl text-sm"><option value="SURGICAL">Surgical</option><option value="NON_SURGICAL">Non-Surgical</option></select>}
                <input required placeholder="Item Name" value={inwardForm.name} onChange={e => setInwardForm({ ...inwardForm, name: e.target.value })} className="px-3 py-2 border rounded-xl text-sm" />
                <select value={inwardForm.dept_id} onChange={e => setInwardForm({ ...inwardForm, dept_id: e.target.value })} className="px-3 py-2 border rounded-xl text-sm">{depts.map(d => <option key={d.dept_id} value={d.dept_id}>{d.name}</option>)}</select>
                <input type="number" min="1" value={inwardForm.qty} onChange={e => setInwardForm({ ...inwardForm, qty: e.target.value })} className="px-3 py-2 border rounded-xl text-sm" />
                <input required placeholder="Batch or Serial No" value={inwardForm.code} onChange={e => setInwardForm({ ...inwardForm, code: e.target.value })} className="px-3 py-2 border rounded-xl text-sm" />
                <input type="date" value={inwardForm.expiry_date} onChange={e => setInwardForm({ ...inwardForm, expiry_date: e.target.value })} className="px-3 py-2 border rounded-xl text-sm" />
                <button className="sm:col-span-2 py-2.5 bg-teal-600 text-white rounded-xl text-sm font-semibold">Save Inward Item</button>
              </form>
            )}
            {inwardMode === 'multi' && (
              <div className="space-y-3">
                {multiRows.map((r, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                    <select value={r.area} onChange={e => { const m = [...multiRows]; m[idx].area = e.target.value; setMultiRows(m); }} className="px-2 py-1.5 border rounded-lg text-xs"><option value="CONSUMABLES">Consumables</option><option value="EQUIPMENTS">Equipments</option></select>
                    <select value={r.sub_category} onChange={e => { const m = [...multiRows]; m[idx].sub_category = e.target.value; setMultiRows(m); }} className="px-2 py-1.5 border rounded-lg text-xs"><option value="SURGICAL">Surgical</option><option value="NON_SURGICAL">Non-Surgical</option></select>
                    <input placeholder="Item Name" value={r.name} onChange={e => { const m = [...multiRows]; m[idx].name = e.target.value; setMultiRows(m); }} className="px-2 py-1.5 border rounded-lg text-xs" />
                    <input type="number" min="1" value={r.qty} onChange={e => { const m = [...multiRows]; m[idx].qty = e.target.value; setMultiRows(m); }} className="px-2 py-1.5 border rounded-lg text-xs" />
                    <input placeholder="Batch/Serial" value={r.code} onChange={e => { const m = [...multiRows]; m[idx].code = e.target.value; setMultiRows(m); }} className="px-2 py-1.5 border rounded-lg text-xs" />
                    <input type="date" value={r.expiry_date} onChange={e => { const m = [...multiRows]; m[idx].expiry_date = e.target.value; setMultiRows(m); }} className="px-2 py-1.5 border rounded-lg text-xs" />
                  </div>
                ))}
                <div className="flex gap-2">
                  <button onClick={() => setMultiRows([...multiRows, { area: 'CONSUMABLES', sub_category: 'SURGICAL', name: '', qty: 10, code: '', expiry_date: '2028-06-30' }])} className="px-3 py-2 border rounded-xl text-xs font-semibold">+ Add Row</button>
                  <button onClick={async () => { await api('/api/inward/bulk', { method: 'POST', body: JSON.stringify({ items: multiRows.map(r => ({ ...r, dept_id: u.assignment?.dept_id || depts[0]?.dept_id })) }) }); loadAll(); notify('Saved all rows'); }} className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold">Submit All</button>
                </div>
              </div>
            )}
            {inwardMode === 'import' && (
              <input type="file" accept=".csv" onChange={e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = async ev => { const items = ev.target.result.split(/\r?\n/).filter(Boolean).slice(1).map(l => { const [name, sub_category, qty, code, expiry_date] = l.split(',').map(x => x.trim()); return { area: 'CONSUMABLES', sub_category: sub_category === 'NON_SURGICAL' ? 'NON_SURGICAL' : 'SURGICAL', name, qty: parseInt(qty, 10) || 10, code, expiry_date, dept_id: u.assignment?.dept_id || depts[0]?.dept_id }; }).filter(x => x.name); await api('/api/inward/bulk', { method: 'POST', body: JSON.stringify({ items }) }); loadAll(); notify(`Imported ${items.length} rows`); }; rd.readAsText(f); }} className="text-sm" />
            )}
          </div>
        )}

        {tab === 'access' && !isViewer && (
          <div className="space-y-6">
            {isAdmin && (
              <div className="bg-white p-5 rounded-2xl border space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <h3 className="font-bold">Hospital Departments ({depts.length} total)</h3>
                  <form onSubmit={async e => { e.preventDefault(); try { await api('/api/departments', { method: 'POST', body: JSON.stringify({ name: newDept }) }); setNewDept(''); loadAll(); notify('Department created'); } catch (err) { notify(err.message); } }} className="flex gap-2">
                    <input required placeholder="New Department" value={newDept} onChange={e => setNewDept(e.target.value)} className="px-3 py-1.5 border rounded-xl text-xs" />
                    <button className="px-3 py-1.5 bg-teal-600 text-white rounded-xl text-xs font-semibold">+ Add Dept</button>
                  </form>
                </div>
                <div className="flex flex-wrap gap-2">
                  {depts.map((d, idx) => (
                    <div key={d.dept_id} className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border rounded-xl text-xs">
                      <span className="font-mono font-bold text-teal-700">{idx + 1}.</span><span>{d.name}</span>
                      <button onClick={() => setConfirmDelDept(d)} className="px-2 py-0.5 bg-red-50 text-red-700 rounded-lg font-semibold">Remove</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-2xl border space-y-4">
                <h3 className="font-bold">Storekeepers (Employee ID)</h3>
                {isAdmin && (
                  <form onSubmit={async e => { e.preventDefault(); try { await api('/api/admin/storekeepers', { method: 'POST', body: JSON.stringify({ emp_id: skEmp, dept_id: skDept, scope: skScope }) }); setSkEmp(''); loadAll(); notify('Storekeeper assigned'); } catch (err) { notify(err.message); } }} className="grid grid-cols-3 gap-2">
                    <input required placeholder="Employee ID" value={skEmp} onChange={e => setSkEmp(e.target.value)} className="px-2 py-1.5 border rounded-xl text-xs uppercase" />
                    <select value={skDept} onChange={e => setSkDept(e.target.value)} className="px-2 py-1.5 border rounded-xl text-xs">{depts.map(d => <option key={d.dept_id} value={d.dept_id}>{d.name}</option>)}</select>
                    <div className="flex gap-1"><select value={skScope} onChange={e => setSkScope(e.target.value)} className="flex-1 px-1 py-1.5 border rounded-xl text-xs"><option value="CONSUMABLES_ONLY">Consumables</option><option value="EQUIPMENT_ONLY">Equipments</option><option value="BOTH">Both</option></select><button className="px-2.5 bg-teal-600 text-white rounded-xl text-xs">Add</button></div>
                  </form>
                )}
                <div className="divide-y text-sm">{storekeepers.map(sk => <div key={sk.assign_id} className="py-2.5 flex justify-between items-center"><div><div className="font-mono font-bold">{sk.emp_id}</div><div className="text-xs text-slate-500">{sk.dept_name} · {sk.scope}</div></div>{isAdmin && <button onClick={async () => { await api(`/api/admin/storekeepers/${sk.assign_id}`, { method: 'DELETE' }); loadAll(); notify('Removed'); }} className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded-lg">Remove</button>}</div>)}</div>
              </div>
              <div className="bg-white p-5 rounded-2xl border space-y-4">
                <h3 className="font-bold">Viewers (No-Edit Policy)</h3>
                <form onSubmit={async e => { e.preventDefault(); try { await api('/api/storekeeper/viewers', { method: 'POST', body: JSON.stringify({ emp_id: vEmp, dept_id: vDept }) }); setVEmp(''); loadAll(); notify('Viewer authorized'); } catch (err) { notify(err.message); } }} className="grid grid-cols-3 gap-2">
                  <input required placeholder="Employee ID" value={vEmp} onChange={e => setVEmp(e.target.value)} className="col-span-2 px-2 py-1.5 border rounded-xl text-xs uppercase" />
                  <button className="px-3 py-1.5 bg-slate-900 text-white rounded-xl text-xs">Add</button>
                </form>
                <div className="divide-y text-sm">{viewers.map(v => <div key={v.access_id} className="py-2.5 flex justify-between items-center"><div><div className="font-mono font-bold">{v.emp_id}</div><div className="text-xs text-slate-500">{v.dept_name} · No-Edit</div></div><button onClick={async () => { await api(`/api/storekeeper/viewers/${v.access_id}`, { method: 'DELETE' }); loadAll(); notify('Removed'); }} className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded-lg">Remove</button></div>)}</div>
              </div>
            </div>
          </div>
        )}
      </main>

      {confirmDelDept && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold">Confirm Department Removal</h3>
            <p className="text-sm text-slate-600">Remove "{confirmDelDept.name}"?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelDept(null)} className="px-4 py-2 bg-slate-100 rounded-xl text-xs font-semibold">Cancel</button>
              <button onClick={async () => { await api(`/api/departments/${confirmDelDept.dept_id}`, { method: 'DELETE' }); setConfirmDelDept(null); loadAll(); notify('Department removed'); }} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-semibold">Yes, Remove</button>
            </div>
          </div>
        </div>
      )}

      {showPwdModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={async e => { e.preventDefault(); if (pwdForm.nw !== pwdForm.cf) return notify('Passwords do not match'); try { await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password: pwdForm.cur, new_password: pwdForm.nw }) }); setShowPwdModal(false); setPwdForm({ cur: '', nw: '', cf: '' }); notify('Password updated'); } catch (err) { notify(err.message); } }} className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-3">
            <h3 className="font-bold">Change Password</h3>
            <input type="password" required placeholder="Current Password" value={pwdForm.cur} onChange={e => setPwdForm({ ...pwdForm, cur: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" />
            <input type="password" required placeholder="New Password" value={pwdForm.nw} onChange={e => setPwdForm({ ...pwdForm, nw: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" />
            <input type="password" required placeholder="Confirm New Password" value={pwdForm.cf} onChange={e => setPwdForm({ ...pwdForm, cf: e.target.value })} className="w-full px-3 py-2 border rounded-xl text-sm" />
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowPwdModal(false)} className="px-3 py-2 bg-slate-100 rounded-xl text-xs">Cancel</button><button className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold">Update</button></div>
          </form>
        </div>
      )}

      {toast && <div className="fixed bottom-5 right-5 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm shadow-lg">{toast}</div>}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
