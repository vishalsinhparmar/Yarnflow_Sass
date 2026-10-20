import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Check, CheckCircle2, Layers3, Loader2, Package, ShieldCheck, ShoppingCart, Truck, X } from 'lucide-react';
import { MODULES, saasAPI, SUPER_TOKEN_KEY } from '../services/saasAPI';
import toast from 'react-hot-toast';

export const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-100';
export const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryClass = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';

export function Brand() {
  return <Link to="/" className="inline-flex items-center gap-3 font-bold text-xl tracking-tight"><span className="rounded-xl bg-orange-600 p-2 text-white"><Layers3 className="h-6 w-6" /></span><span>YarnFlow <span className="font-normal opacity-60">ERP</span></span></Link>;
}

export function PublicShell({ children }) {
  return <div className="min-h-screen bg-slate-50 text-slate-900"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5"><Brand /><Link to="/login" className="text-sm font-semibold text-slate-600 hover:text-orange-600">Company sign in <ArrowRight className="ml-1 inline h-4 w-4" /></Link></div></header>{children}<footer className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 px-6 py-8 text-xs text-slate-500"><span>© {new Date().getFullYear()} YarnFlow ERP. Built for the textile business.</span><Link to="/super-admin/login" className="hover:text-orange-600">Platform administration</Link></footer></div>;
}

export function Landing() {
  return <PublicShell><main><section className="relative overflow-hidden bg-slate-900 text-white"><div className="absolute -right-48 -top-48 h-[600px] w-[600px] rounded-full border-[70px] border-white/[0.025]" /><div className="relative mx-auto grid max-w-7xl gap-14 px-6 py-20 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:py-28"><div><p className="mb-6 inline-flex items-center gap-2 rounded-full border border-orange-400/25 bg-orange-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-orange-300"><span className="h-1.5 w-1.5 rounded-full bg-orange-400" /> One workspace. Every thread.</p><h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">YarnFlow ERP<span className="mt-4 block text-3xl font-medium leading-tight sm:text-4xl lg:text-5xl">Smart Management for <span className="text-orange-400">Yarn &amp; Textile</span> Businesses</span></h1><p className="mt-7 max-w-xl text-lg leading-relaxed text-slate-300">From the first purchase order to the final dispatch. Bring your inventory, teams and day-to-day operations together in one company workspace.</p><div className="mt-9 flex flex-wrap gap-3"><Link to="/login" className={buttonClass}>Already registered? Sign in <ArrowRight className="h-4 w-4" /></Link><Link to="/register" className="inline-flex items-center justify-center rounded-xl border border-slate-600 px-5 py-3 text-sm font-semibold hover:border-white hover:bg-white/5">Register your company</Link></div><div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">{['Company-specific access', 'Role-based permissions', 'Connected workflows'].map(text => <span key={text} className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-orange-400" />{text}</span>)}</div></div><div className="relative"><div className="rounded-3xl border border-slate-700 bg-slate-800/80 p-5 shadow-2xl sm:p-7"><div className="mb-7 flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-orange-300">Your operations, connected</p><h2 className="mt-2 text-xl font-semibold">A clear path from order to delivery</h2></div><Layers3 className="h-9 w-9 shrink-0 text-slate-500" /></div><div className="space-y-3">{[[ShoppingCart, '01', 'Purchase & receive', 'Purchase orders and goods receipt notes'], [Package, '02', 'Track every lot', 'Inventory visibility across warehouses'], [Truck, '03', 'Sell & dispatch', 'Sales orders, challans and delivery']].map(([Icon, n, title, description]) => <div key={n} className="flex items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900/60 p-5"><span className="rounded-xl bg-orange-500/10 p-3 text-orange-400"><Icon className="h-6 w-6" /></span><div className="flex-1"><h3 className="font-semibold">{title}</h3><p className="mt-1 text-xs leading-relaxed text-slate-400">{description}</p></div><span className="text-xs text-slate-500">{n}</span></div>)}</div><div className="mt-5 flex items-center gap-2 text-xs text-slate-300"><ShieldCheck className="h-4 w-4 text-orange-400" /> The right modules. The right people. Your company.</div></div></div></div></section><section className="mx-auto max-w-7xl px-6 py-16"><div className="mb-9 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-orange-600">Less complexity. More control.</p><h2 className="mt-3 text-3xl font-bold tracking-tight">Built around the way you work</h2></div><p className="max-w-md text-sm leading-6 text-slate-500">Keep your familiar ERP workflows, with a dedicated workspace and controlled access for your team.</p></div><div className="grid gap-5 md:grid-cols-3">{[[Building2, 'Your company workspace', 'Keep your business records together, from customers and suppliers to products and warehouse locations.'], [ShieldCheck, 'Access with confidence', 'Company administrators manage users and permissions within the modules enabled for their business.'], [Layers3, 'Start simple, stay connected', 'Register your company, receive your company code, and begin once your workspace is approved.']].map(([Icon, title, text]) => <article key={title} className="rounded-2xl border border-slate-200 bg-white p-7"><Icon className="mb-5 h-7 w-7 text-orange-600" /><h3 className="text-lg font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-500">{text}</p></article>)}</div></section></main></PublicShell>;
}

export function SuperAdminLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await saasAPI.superLogin({ email: form.email.trim(), password: form.password });
      if (!response.token) throw new Error('No administrator session returned.');
      localStorage.setItem(SUPER_TOKEN_KEY, response.token);
      navigate('/super-admin', { replace: true });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <PublicShell><main className="mx-auto max-w-md px-6 py-16"><div className="mb-7"><ShieldCheck className="mb-5 h-10 w-10 text-orange-600" /><p className="text-xs font-bold uppercase tracking-widest text-orange-600">Platform administration</p><h1 className="mt-3 text-3xl font-bold">SuperAdmin sign in</h1><p className="mt-3 text-sm text-slate-500">Manage company approvals and platform access. Company users should use the company sign-in page.</p></div><form onSubmit={submit} className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm">{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{['email', 'password'].map(name => <label key={name} className="block text-sm font-medium"><span className="mb-2 block capitalize">{name}</span><input className={fieldClass} type={name} required autoComplete={name === 'password' ? 'current-password' : 'username'} value={form[name]} onChange={event => setForm({ ...form, [name]: event.target.value })} /></label>)}<button disabled={busy} className={`${buttonClass} w-full`}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Sign in as SuperAdmin</button></form><Link to="/login" className="mt-6 block text-center text-sm text-slate-600">Looking for your company workspace?</Link></main></PublicShell>;
}

const statuses = ['pending', 'active', 'rejected', 'inactive'];
const statusClass = { pending: 'bg-amber-50 text-amber-700', active: 'bg-emerald-50 text-emerald-700', rejected: 'bg-red-50 text-red-700', inactive: 'bg-slate-100 text-slate-600' };
const Status = ({ value }) => <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusClass[value] || statusClass.inactive}`}>{value}</span>;

function CompanyDetails({ company, catalog, onClose, onUpdated }) {
  const [modules, setModules] = useState(company.modules || []);
  const [admin, setAdmin] = useState({ name: '', username: '', email: '', password: '' });
  const [reset, setReset] = useState({ password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const run = async (action, success) => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try { await action(); setMessage(success); toast.success(success); await onUpdated(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const changeStatus = status => {
    if (!window.confirm(`Set ${company.companyName} to ${status}? ${status === 'inactive' || status === 'rejected' ? 'Company users will not be able to access their workspace.' : ''}`)) return;
    run(() => saasAPI.updateCompany(company._id, { status }), 'Company status updated.');
  };
  useEffect(() => {
    const close = e => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [busy, onClose]);
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-4 sm:p-8"><section role="dialog" aria-modal="true" aria-labelledby="company-detail-title" className="mx-auto max-w-4xl rounded-2xl bg-white shadow-2xl"><header className="flex items-start justify-between gap-4 border-b p-6"><div><p className="mb-2 text-xs font-mono text-slate-500">{company.companyCode}</p><h2 id="company-detail-title" className="text-2xl font-bold">{company.companyName}</h2><div className="mt-3"><Status value={company.status} /></div></div><button autoFocus disabled={busy} className={secondaryClass} onClick={onClose} aria-label="Close company details"><X className="h-5 w-5" /></button></header><div className="space-y-8 p-6">{error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}{message && <p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">{message}</p>}<dl className="grid gap-5 text-sm sm:grid-cols-3">{['companyType', 'contactPerson', 'phone', 'email', 'address', 'city', 'state', 'pincode', 'gstin', 'website'].map(key => <div key={key}><dt className="mb-1 text-xs capitalize text-slate-500">{key.replace(/([A-Z])/g, ' $1')}</dt><dd className="break-words font-medium">{company[key] || '—'}</dd></div>)}</dl><div className="flex flex-wrap gap-2">{company.status !== 'active' && <button disabled={busy} className={buttonClass} onClick={() => changeStatus('active')}><CheckCircle2 className="h-4 w-4" />{company.status === 'inactive' ? 'Reactivate company' : 'Approve company'}</button>}{company.status === 'pending' && <button disabled={busy} className={secondaryClass} onClick={() => changeStatus('rejected')}>Reject registration</button>}{company.status === 'active' && <button disabled={busy} className={secondaryClass} onClick={() => changeStatus('inactive')}>Deactivate company</button>}</div><section className="border-t pt-6"><h3 className="text-lg font-semibold">Enabled modules</h3><p className="mt-1 text-sm text-slate-500">Only enabled modules are available to company users, subject to their permissions.</p><div className="my-5 grid gap-3 sm:grid-cols-3">{catalog.map(item => <label key={item.key} className="flex items-center gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-orange-600" disabled={busy} checked={modules.includes(item.key)} onChange={e => setModules(e.target.checked ? [...modules, item.key] : modules.filter(key => key !== item.key))} />{item.label}</label>)}</div><button disabled={busy} className={buttonClass} onClick={() => run(() => saasAPI.updateCompany(company._id, { modules }), 'Enabled modules saved.')}>Save modules</button></section><div className="grid gap-6 border-t pt-6 md:grid-cols-2"><form className="space-y-3" onSubmit={e => { e.preventDefault(); run(async () => { await saasAPI.createAdmin(company._id, admin); setAdmin({ name: '', username: '', email: '', password: '' }); }, 'Initial company administrator created.'); }}><h3 className="text-lg font-semibold">Create initial company admin</h3><p className="text-xs leading-5 text-slate-500">Choose a password and share it securely with the company administrator. No password is generated automatically.</p>{['name', 'username', 'email', 'password'].map(key => <label key={key} className="block text-sm"><span className="mb-1 block capitalize">{key}</span><input className={fieldClass} required minLength={key === 'password' ? 8 : undefined} autoComplete={key === 'password' ? 'new-password' : 'off'} type={key === 'password' || key === 'email' ? key : 'text'} value={admin[key]} onChange={e => setAdmin({ ...admin, [key]: e.target.value })} /></label>)}<button disabled={busy} className={buttonClass}>Create company admin</button></form><form className="space-y-3" onSubmit={e => { e.preventDefault(); if (reset.password !== reset.confirm) { setError('Passwords do not match.'); return; } if (!window.confirm('Reset this company administrator’s password?')) return; run(async () => { await saasAPI.resetAdmin(company._id, reset.password); setReset({ password: '', confirm: '' }); }, 'Company administrator password reset.'); }}><h3 className="text-lg font-semibold">Reset admin password</h3><p className="text-xs leading-5 text-slate-500">Update the existing company administrator’s password. Use at least 8 characters and share it through a secure channel.</p>{['password', 'confirm'].map(key => <label key={key} className="block text-sm"><span className="mb-1 block">{key === 'confirm' ? 'Confirm password' : 'New password'}</span><input type="password" autoComplete="new-password" className={fieldClass} required minLength={8} value={reset[key]} onChange={e => setReset({ ...reset, [key]: e.target.value })} /></label>)}<button disabled={busy} className={secondaryClass}>Reset password</button></form></div><section className="border-t pt-6"><h3 className="mb-3 text-lg font-semibold">Basic usage</h3><Usage usage={company.usage} /></section>{busy && <p role="status" className="flex items-center gap-2 text-sm text-orange-600"><Loader2 className="h-4 w-4 animate-spin" />Saving changes…</p>}</div></section></div>;
}

function Usage({ usage }) {
  const entries = Object.entries(usage || {}).filter(([, value]) => typeof value === 'number' || typeof value === 'string');
  return entries.length ? <dl className="flex flex-wrap gap-3">{entries.map(([key, value]) => <div key={key} className="min-w-24 rounded-xl bg-slate-50 p-3"><dt className="text-xs capitalize text-slate-500">{key.replace(/([A-Z])/g, ' $1')}</dt><dd className="mt-1 text-xl font-bold">{value}</dd></div>)}</dl> : <p className="text-sm text-slate-500">No usage data available yet.</p>;
}

export function SuperAdminDashboard() {
  const [companies, setCompanies] = useState([]);
  const [catalog, setCatalog] = useState(MODULES);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const load = async () => {
    setError('');
    try {
      const response = await saasAPI.companies();
      const list = Array.isArray(response.data) ? response.data : response.data?.companies;
      if (!Array.isArray(list)) throw new Error('The company list response was not valid.');
      setCompanies(list); setAuthorized(true);
    } catch (e) { setError(e.message); throw e; }
    finally { setLoading(false); }
  };
  useEffect(() => {
    const expire = () => { setExpired(true); setAuthorized(false); setCompanies([]); setSelected(null); };
    const storageChanged = e => { if (e.key === SUPER_TOKEN_KEY || e.key === null) expire(); };
    window.addEventListener('saas-super-session-expired', expire);
    window.addEventListener('storage', storageChanged);
    if (!localStorage.getItem(SUPER_TOKEN_KEY)) { expire(); setLoading(false); }
    else {
      load().catch(() => {});
      saasAPI.modules().then(response => {
        const items = Array.isArray(response.data) ? response.data : response.data?.modules;
        if (Array.isArray(items) && items.length) setCatalog(items.map(item => typeof item === 'string' ? MODULES.find(module => module.key === item) || { key: item, label: item } : { ...item, key: item.key || item.id, label: item.label || item.name || item.key }));
      }).catch(() => {});
    }
    return () => { window.removeEventListener('saas-super-session-expired', expire); window.removeEventListener('storage', storageChanged); };
  }, []);
  if (expired) return <Navigate to="/super-admin/login" replace />;
  const selectedCompany = companies.find(company => company._id === selected);
  const visible = companies.filter(company => (filter === 'all' || company.status === filter) && `${company.companyName} ${company.companyCode} ${company.email}`.toLowerCase().includes(search.toLowerCase()));
  const logout = () => { localStorage.removeItem(SUPER_TOKEN_KEY); setExpired(true); };
  return <div className="min-h-screen bg-slate-50 text-slate-900"><header className="bg-slate-900 text-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5"><Brand /><div className="flex items-center gap-4"><span className="text-xs uppercase tracking-widest text-slate-400">SuperAdmin</span><button onClick={logout} className="rounded-lg border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800">Sign out</button></div></div></header><main className="mx-auto max-w-7xl space-y-7 px-6 py-9"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-orange-600">Platform overview</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Company management</h1><p className="mt-2 text-sm text-slate-500">Review registrations, enable modules and manage company access.</p></div><button disabled={loading} onClick={() => { setLoading(true); load().catch(() => {}); }} className={secondaryClass}>Refresh companies</button></div>{error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}{loading ? <div role="status" className="flex items-center justify-center gap-3 py-20 text-slate-500"><Loader2 className="h-6 w-6 animate-spin text-orange-600" />Verifying administrator access and loading companies…</div> : authorized && <><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{statuses.map(status => <button key={status} onClick={() => setFilter(status)} className={`rounded-2xl border bg-white p-5 text-left shadow-sm ${filter === status ? 'border-orange-500 ring-1 ring-orange-500' : 'border-slate-200'}`}><Status value={status} /><p className="mt-4 text-3xl font-bold">{companies.filter(company => company.status === status).length}</p><p className="mt-1 text-xs text-slate-500">{status === 'pending' ? 'Awaiting review' : `${status[0].toUpperCase()}${status.slice(1)} companies`}</p></button>)}</div><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center gap-3 border-b p-5"><label className="min-w-52 flex-1"><span className="sr-only">Search companies</span><input className={fieldClass} placeholder="Search company name, code or email…" value={search} onChange={e => setSearch(e.target.value)} /></label><label><span className="sr-only">Filter by status</span><select className={fieldClass} value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All statuses</option>{statuses.map(status => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></label></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{['Company', 'Contact', 'Status', 'Modules', 'Review'].map(label => <th key={label} className="px-5 py-4">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visible.map(company => <tr key={company._id} className="hover:bg-slate-50/60"><td className="px-5 py-5"><p className="font-semibold">{company.companyName}</p><p className="mt-1 font-mono text-xs text-slate-500">{company.companyCode}</p><p className="mt-1 text-xs text-slate-400">{company.companyType}</p></td><td className="px-5 py-5"><p>{company.contactPerson || '—'}</p><p className="mt-1 text-xs text-slate-500">{company.email}</p></td><td className="px-5 py-5"><Status value={company.status} /></td><td className="px-5 py-5 text-slate-500">{company.modules?.length || 0} enabled</td><td className="px-5 py-5"><button className="whitespace-nowrap font-semibold text-orange-600 hover:text-orange-700" onClick={() => setSelected(company._id)}>View details <ArrowRight className="inline h-4 w-4" /></button></td></tr>)}</tbody></table>{!visible.length && <div className="px-6 py-16 text-center"><Building2 className="mx-auto mb-4 h-10 w-10 text-slate-300" /><h2 className="font-semibold">No companies found</h2><p className="mt-2 text-sm text-slate-500">{companies.length ? 'Try a different search or status filter.' : 'Company registrations will appear here for review.'}</p></div>}</div><p className="border-t px-5 py-3 text-xs text-slate-500">Showing {visible.length} of {companies.length} companies</p></section></>}</main>{authorized && selectedCompany && <CompanyDetails key={selected} company={selectedCompany} catalog={catalog} onClose={() => setSelected(null)} onUpdated={load} />}</div>;
}
