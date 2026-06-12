import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRegister } from '../../hooks/useAuth';

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    orgName: '',
  });

  const register = useRegister();

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    register.mutate(form);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">FI</span>
            </div>
            <span className="text-white text-xl font-semibold">FinIntel</span>
          </div>
          <p className="text-gray-400 text-sm">AI-Powered Financial Intelligence</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
          <h1 className="text-white text-2xl font-semibold mb-1">Create account</h1>
          <p className="text-gray-400 text-sm mb-6">Set up your organization's workspace</p>

          {register.isError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">
                {(register.error as Error)?.message ?? 'Registration failed. Please try again.'}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm text-gray-300 mb-1.5">Organization name</label>
                <input
                  type="text"
                  value={form.orgName}
                  onChange={set('orgName')}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Acme Capital"
                  required
                  minLength={2}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm text-gray-300 mb-1.5">Your name</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={set('fullName')}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Jane Smith"
                  required
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm text-gray-300 mb-1.5">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="jane@acme.com"
                  required
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm text-gray-300 mb-1.5">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={set('password')}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3.5 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={register.isPending}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {register.isPending ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-600 mt-4">
          You'll be set as the organization owner with full access.
        </p>
      </div>
    </div>
  );
}
