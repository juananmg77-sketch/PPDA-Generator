import React, { useState } from 'react';
import { Lock, ShieldAlert, LogIn, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../services/supabase';

interface LoginProps {
  onLoginSuccess: (email: string) => void;
}

const HsGreenLogoSmall = () => (
  <svg width="45" height="45" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 35 C 5 35, 25 55, 40 55 C 40 55, 30 35, 15 25 C 10 22, 5 35, 5 35 Z" fill="#66cc33" />
      <path d="M15 25 C 15 25, 30 35, 40 55 C 45 45, 25 25, 15 25" fill="#75c05d" />
      <path d="M5 50 C 5 50, 25 55, 40 65 C 40 65, 35 55, 30 50 C 20 40, 5 50, 5 50 Z" fill="#009933" />
      <path d="M40 55 C 40 55, 45 75, 42 85 C 42 85, 50 75, 52 55 L 40 55" fill="#4ade80" />
      <path d="M52 55 C 52 55, 55 70, 45 85 C 55 80, 65 65, 60 50 L 52 55" fill="#ff9900" />
      <path d="M52 55 L 60 50 C 60 50, 70 50, 75 35 C 75 35, 65 30, 55 40 C 55 40, 50 45, 52 55" fill="#0033cc" />
      <path d="M75 35 L 85 40 L 75 42" fill="#0033cc" />
      <circle cx="68" cy="38" r="2" fill="white" />
  </svg>
);

export const LoginView: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor, introduce email y contraseña.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) throw authError;
      if (data.user?.email) onLoginSuccess(data.user.email);
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('Invalid login')) {
        setError('Email o contraseña incorrectos.');
      } else if (msg.includes('Email not confirmed')) {
        setError('Confirma tu email antes de acceder.');
      } else {
        setError(msg || 'Error al iniciar sesión. Inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md w-full relative overflow-hidden">

        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-400 to-brand-600"></div>

        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2 mb-2">
            <HsGreenLogoSmall />
            <span className="text-2xl font-black text-brand-600 tracking-tight">HSGREEN</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800 text-center uppercase tracking-tight">PPDA Generator</h1>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-1">Acceso Profesional Restringido</p>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-start gap-3 mb-6">
          <Lock className="text-slate-400 shrink-0 mt-0.5" size={16} />
          <p className="text-xs text-slate-600 leading-relaxed">
            Acceso exclusivo para usuarios autorizados por HS Consulting. Introduce tus credenciales corporativas.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
              Email corporativo
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nombre@empresa.com"
              autoComplete="email"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent bg-white"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full px-4 py-2.5 pr-12 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-600/20"
          >
            {loading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <LogIn size={16} />
            )}
            {loading ? 'Accediendo...' : 'Iniciar sesión'}
          </button>
        </form>

        {error && (
          <div className="mt-4 bg-red-50 text-red-600 p-4 rounded-xl text-xs font-bold flex items-start gap-3 border border-red-100">
            <ShieldAlert size={18} className="shrink-0 mt-0.5" />
            <div>
              <p className="uppercase tracking-wider mb-1">Error de Autenticación</p>
              <p className="font-medium opacity-90">{error}</p>
            </div>
          </div>
        )}

        <div className="mt-8 text-center border-t border-slate-100 pt-4">
          <p className="text-[10px] text-slate-400">© {new Date().getFullYear()} HS Consulting Environment & Sustainability</p>
        </div>
      </div>
    </div>
  );
};
