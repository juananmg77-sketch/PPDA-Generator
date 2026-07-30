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
    <div className="min-h-screen flex">

      {/* ── Panel izquierdo corporativo ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center px-16 py-12" style={{ backgroundColor: '#1a3d2b' }}>
        {/* Logo grande — fondo transparente, directo sobre verde */}
        <div className="mb-10" style={{ width: '280px' }}>
          <img src="/logo-hsgreen.png" alt="HS Green" className="w-full h-auto object-contain drop-shadow-lg" />
        </div>

        {/* Título y descripción */}
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold text-white leading-snug mb-3">
            Creación de Planes de Desperdicio PPDA
          </h1>
          <p className="text-sm leading-relaxed mb-6" style={{ color: 'rgba(255,255,255,0.65)' }}>
            Plataforma profesional para la elaboración, gestión y seguimiento de Planes de Prevención y Reducción del Desperdicio Alimentario.
          </p>
          <span className="inline-block text-xs font-semibold px-3 py-1.5 rounded-full border border-white/20 text-white/70">
            Ley 1/2025 · Ley 7/2022
          </span>
        </div>

        {/* Footer panel */}
        <div className="mt-auto pt-12 text-center">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
            © {new Date().getFullYear()} HS Consulting · Environment & Sustainability
          </p>
        </div>
      </div>

      {/* ── Panel derecho: formulario ── */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center px-8 py-12 bg-slate-50">

        {/* Logo mobile (solo visible en < lg) */}
        <div className="lg:hidden mb-8" style={{ width: '200px' }}>
          <img src="/logo-hsgreen.png" alt="HS Green" className="w-full h-auto object-contain" />
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-800">Iniciar sesión</h2>
            <p className="text-sm text-slate-500 mt-1">Introduce tus credenciales corporativas</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Email corporativo
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="nombre@empresa.com"
                autoComplete="email"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                style={{ '--tw-ring-color': '#1a3d2b' } as any}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-12 rounded-lg border border-slate-200 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:border-transparent transition-all"
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

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm flex items-start gap-2.5 border border-red-100">
                <ShieldAlert size={15} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 text-white rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
              style={{ backgroundColor: loading ? '#94a3b8' : '#1a3d2b' }}
            >
              {loading
                ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                : <LogIn size={16} />}
              {loading ? 'Accediendo...' : 'Iniciar sesión'}
            </button>
          </form>

          <p className="text-xs text-slate-400 text-center mt-8">
            © {new Date().getFullYear()} HS Consulting · Environment & Sustainability
          </p>
        </div>
      </div>

    </div>
  );
};
