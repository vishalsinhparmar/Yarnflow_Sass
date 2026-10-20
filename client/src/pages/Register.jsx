import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CheckCircle2, Loader2 } from 'lucide-react';
import { saasAPI } from '../services/saasAPI';
import { PublicShell, fieldClass, buttonClass } from './SaaSPages';

const fields = [
  ['companyName', 'Company name', true],
  ['companyType', 'Company type', true],
  ['contactPerson', 'Contact person', true],
  ['phone', 'Phone', true, 'tel'],
  ['email', 'Business email', true, 'email'],
  ['address', 'Address', true],
  ['city', 'City', true],
  ['state', 'State', true],
  ['pincode', 'Pincode', true],
  ['gstin', 'GSTIN', false],
  ['website', 'Website', false, 'url'],
];

const Register = () => {
  const [formData, setFormData] = useState(Object.fromEntries(fields.map(([key]) => [key, ''])));
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState(null);

  // Redirect if already authenticated
  const handleChange = e => {
    setFormData(previous => ({ ...previous, [e.target.name]: e.target.value }));
    // Clear error for this field
    setSubmitError('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setIsLoading(true); setSubmitError('');
    try {
      const response = await saasAPI.register(Object.fromEntries(Object.entries(formData).map(([key, value]) => [key, value.trim()])));
      if (!response.data?.companyCode) throw new Error('Registration response did not contain a company code. Please contact support before submitting again.');
      setResult(response.data);
    } catch (error) { setSubmitError(error.message); }
    finally { setIsLoading(false); }
  };

  return (
    <PublicShell>
      {/* Animated Background Elements */}
      <main className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
        {/* Header */}
        <div className="mb-8 max-w-2xl">
          <Building2 className="mb-5 h-10 w-10 text-orange-600" />
          <p className="text-xs font-bold uppercase tracking-widest text-orange-600">Your next chapter starts here</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Register your company</h1>
          <p className="mt-4 leading-relaxed text-slate-500">Tell us about your business. Our team will review your registration and prepare your company workspace.</p>
        </div>
        {/* Form Card */}
        {result ? <section role="status" className="rounded-2xl border border-emerald-200 bg-white p-8 shadow-sm">
          <CheckCircle2 className="mb-4 h-12 w-12 text-emerald-600" />
          <h2 className="text-2xl font-bold">Registration received</h2>
          <p className="mt-3 text-slate-600">Your company registration is pending approval. Registration does not provide access to the ERP.</p>
          <div className="my-6 rounded-xl border border-orange-200 bg-orange-50 p-5"><p className="text-xs font-semibold uppercase tracking-widest text-orange-700">Save your company code</p><p className="mt-2 break-all font-mono text-3xl font-bold text-slate-900">{result.companyCode}</p><p className="mt-2 text-sm capitalize text-slate-600">Status: {result.status || 'pending'}</p></div>
          <p className="mb-6 text-sm leading-6 text-slate-500">Once approved, your company administrator will receive access credentials through your onboarding contact. Use your company code when signing in.</p>
          <Link className={buttonClass} to="/">Back to YarnFlow</Link>
        </section> : <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
          <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            {submitError && <p role="alert" className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">{submitError}</p>}
            <h2 className="mb-6 text-lg font-semibold">Company information</h2>
            {/* Email Field */}
            <div className="grid gap-5 sm:grid-cols-2">
              {fields.map(([name, label, required, type = 'text']) => <label key={name} className={`block text-sm font-medium ${name === 'address' ? 'sm:col-span-2' : ''}`}>
                <span className="mb-2 block">{label} {required ? <span className="text-orange-600">*</span> : <span className="font-normal text-slate-400">(optional)</span>}</span>
                {name === 'companyType' ? <select className={fieldClass} name={name} required value={formData[name]} onChange={handleChange}>
                  <option value="">Select company type</option>
                  {['Manufacturer', 'Trader', 'Distributor', 'Wholesaler', 'Retailer', 'Other'].map(value => <option key={value} value={value}>{value}</option>)}
                </select> : <input className={fieldClass} name={name} type={type} required={required} maxLength={name === 'gstin' ? 15 : name === 'pincode' ? 6 : 250} pattern={name === 'pincode' ? '[0-9]{6}' : name === 'gstin' ? '[0-9A-Za-z]{15}' : undefined} inputMode={name === 'pincode' ? 'numeric' : undefined} placeholder={name === 'website' ? 'https://example.com' : undefined} value={formData[name]} onChange={handleChange} />}
              </label>)}
            </div>
            {/* Password Field */}
            {/* Confirm Password Field */}
            <p className="mt-6 rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">No password or ERP access is created at this stage. Your registration is reviewed by the platform administrator.</p>
            {/* Submit Button */}
            <button className={`${buttonClass} mt-6 w-full`} disabled={isLoading}>{isLoading && <Loader2 className="h-4 w-4 animate-spin" />}{isLoading ? 'Submitting registration…' : 'Submit company registration'}</button>
            {/* Login Link */}
            <p className="mt-5 text-center text-sm text-slate-500">Already registered? <Link to="/login" className="font-semibold text-orange-600">Sign in</Link></p>
          </form>
          <aside className="h-fit rounded-2xl bg-slate-900 p-6 text-white"><h2 className="text-lg font-semibold">What happens next?</h2><ol className="mt-6 space-y-6">{[['01', 'Submit your details', 'Receive a unique company code.'], ['02', 'Company review', 'Our team reviews your registration.'], ['03', 'Get your workspace', 'After approval, your admin can sign in and set up your team.']].map(([step, title, text]) => <li key={step}><p className="text-xs font-bold text-orange-400">STEP {step}</p><h3 className="mt-1 font-medium">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-400">{text}</p></li>)}</ol></aside>
        </div>}
        {/* Footer */}
      </main>
    </PublicShell>
  );
};

export default Register;
