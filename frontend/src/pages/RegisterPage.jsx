import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate     = useNavigate();
  const [form, setForm]   = useState({ username: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await register(form.username, form.password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4">
      <div className="bg-casino-card border border-gold/30 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <h1 className="text-gold-glow text-3xl font-extrabold text-center mb-2">Create Account</h1>
        <p className="text-gray-500 text-sm text-center mb-6">Start with 1,000 free chips</p>

        {error && (
          <div className="bg-red-900/60 border border-red-500 text-red-200 px-3 py-2 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input label="Username (3–20 chars)" value={form.username}
            onChange={v => setForm(f => ({ ...f, username: v }))} />
          <Input label="Password (min 4 chars)" type="password" value={form.password}
            onChange={v => setForm(f => ({ ...f, password: v }))} />
          <Input label="Confirm Password" type="password" value={form.confirm}
            onChange={v => setForm(f => ({ ...f, confirm: v }))} />

          <button
            type="submit"
            disabled={loading}
            className="btn-gold py-3 rounded-xl font-extrabold text-lg mt-2 disabled:opacity-60"
          >
            {loading ? 'Creating account…' : 'Register & Play'}
          </button>
        </form>

        <p className="text-gray-500 text-sm text-center mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-gold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="text-gray-400 text-xs uppercase tracking-widest mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required
        className="w-full bg-casino-bg border border-gray-700 focus:border-gold rounded-lg px-4 py-2.5
          text-white outline-none transition"
      />
    </div>
  );
}
