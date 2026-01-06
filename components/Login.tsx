import React, { useState } from 'react';
import { db } from '../services/db';

export const Login: React.FC<{ onSuccess?: () => void }> = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const json = await resp.json();
      if (!resp.ok) {
        setError(json.error || 'Login failed');
        return;
      }

      const user = json.user;
      // Persist locally
      db.updateUser(user);
      if (onSuccess) onSuccess();
      else {
        // navigate to onboarding identity if not completed or reload
        if (!user?.onboardingCompleted) {
          try { window.history.pushState({}, '', '/onboarding/identity'); } catch(e){}
        }
        window.location.reload();
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block">
        <span className="text-xs font-bold">Email</span>
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full mt-1 p-3 rounded-xl border" placeholder="you@example.com" required />
      </label>

      <label className="block">
        <span className="text-xs font-bold">Password</span>
        <input value={password} onChange={e => setPassword(e.target.value)} type="password" className="w-full mt-1 p-3 rounded-xl border" placeholder="password" required />
      </label>

      {error && <div role="alert" className="text-sm text-red-600 font-bold">{error}</div>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="flex-1 bg-teal-600 text-white p-3 rounded-xl font-bold">
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </div>
    </form>
  );
};
