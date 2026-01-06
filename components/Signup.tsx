import React, { useState } from 'react';
import { db } from '../services/db';

export const Signup: React.FC<{ onSuccess?: () => void; hasAcceptedTerms?: boolean }> = ({ onSuccess, hasAcceptedTerms }) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    // Validate that the onboarding/disclosure has been accepted (when provided)
    if (hasAcceptedTerms === false) {
      // prominent error message
      setError('Action Required: Please accept the Medical Disclosure to continue.');
      return setLoading(false);
    }
    setLoading(true);
    try {
      const resp = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });
      const json = await resp.json();
      if (!resp.ok) {
        setError(json.error || 'Signup failed');
        return;
      }

      const user = json.user;
      db.updateUser(user);
      // navigate to onboarding identity route so user completes identity step
      try {
        window.history.pushState({}, '', '/onboarding/identity');
      } catch (e) {}
      if (onSuccess) onSuccess();
      else window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block">
        <span className="text-xs font-bold">Name</span>
        <input value={name} onChange={e => setName(e.target.value)} type="text" className="w-full mt-1 p-3 rounded-xl border" placeholder="Full name" />
      </label>

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
        <button type="submit" disabled={loading || hasAcceptedTerms === false} className="flex-1 bg-white border border-teal-600 text-teal-600 p-3 rounded-xl font-bold disabled:opacity-50">
          {loading ? 'Creating...' : 'Create account'}
        </button>
      </div>
    </form>
  );
};
