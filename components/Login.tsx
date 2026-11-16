import React, { useState, useEffect } from 'react';
import { Lock, ShieldAlert, LogIn, Eye, EyeOff, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { supabase } from '../services/supabase';

const PROD_URL = 'https://ppdagenerator.netlify.app';

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
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setRecoveryMode(true);
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSetNewPassword = async () => {
    if (newPassword.length < 8) {
      setRecoveryStatus({ type: 'error', msg: 'La contraseña debe tener al menos 8 caracteres.' });
      return;
    }
    setRecoveryLoading(true);
    setRecoveryStatus(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setRecoveryLoading(false);
    if (error) {
      setRecoveryStatus({ type: 'error', msg: error.message });
    } else {
      setRecoveryStatus({ type: 'success', msg: '¡Contraseña actualizada correctamente! Ya puedes iniciar sesión.' });
      setRecoveryMode(false);
      setNewPassword('');
      window.location.hash = '';
    }
  };

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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Introduce tu email corporativo.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: PROD_URL }
      );
      if (resetError) throw resetError;
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || 'Error al enviar el email. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (recoveryMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-8 w-full max-w-sm">
          <div className="flex justify-center mb-5">
            <HsGreenLogoSmall />
          </div>
          <h2 className="text-lg font-bold text-slate-800 text-center mb-1">Establece tu nueva contraseña</h2>
          <p className="text-sm text-slate-500 text-center mb-6">Introduce la contraseña que quieres usar a partir de ahora.</p>

          {recoveryStatus && (
            <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${recoveryStatus.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
              {recoveryStatus.msg}
            </div>
          )}

          {!recoveryStatus?.type || recoveryStatus.type === 'error' ? (
            <>
              <div className="relative mb-4">
                <input
                  type={showNewPwd ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Nueva contraseña (mín. 8 caracteres)"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  onKeyDown={e => e.key === 'Enter' && handleSetNewPassword()}
                />
                <button type="button" onClick={() => setShowNewPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                onClick={handleSetNewPassword}
                disabled={recoveryLoading || !newPassword}
                className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-black py-3 rounded-xl transition-colors"
              >
                {recoveryLoading ? 'Guardando…' : 'Cambiar contraseña'}
              </button>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen relative flex"
      style={{ backgroundImage: "url('/login-hotel.jpg')", backgroundSize: 'cover', backgroundPosition: '28% center' }}
    >
      {/* Filo inferior con el degradado de marca */}
      <div className="absolute inset-x-0 bottom-0 h-2 z-20" style={{ background: 'linear-gradient(90deg,#24CBF5,#0002C9)' }} />

      {/* Zona de imagen: limpia, sin textos encima */}
      <div className="hidden lg:block flex-1" />
      <span className="absolute left-4 bottom-5 z-10 text-[10px] text-white/90 bg-[#00093D]/50 px-2 py-0.5 rounded">Imagen ilustrativa</span>

      {/* Bloque de acceso a la derecha, en cristal */}
      <div
        className="relative z-10 w-full lg:w-[34%] min-h-screen flex flex-col items-center justify-center px-9 py-10"
        style={{ background: 'rgba(255,255,255,0.74)', backdropFilter: 'blur(18px) saturate(1.2)', WebkitBackdropFilter: 'blur(18px) saturate(1.2)', borderLeft: '1px solid rgba(255,255,255,0.6)' }}
      >
        <img src="/logo-hsgreen-recortado.png" alt="HS GREEN · Environment & Sustainability" className="w-56 h-auto mb-8" />

        <div className="w-full max-w-sm">

          {/* ── Modo recuperación: confirmación enviada ── */}
          {forgotMode && resetSent ? (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle2 size={48} style={{ color: '#00BF46' }} />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Revisa tu email</h2>
              <p className="text-sm text-slate-700 mb-6">
                Hemos enviado un enlace de recuperación a <strong>{email}</strong>. El enlace caduca en 24 horas.
              </p>
              <button
                onClick={() => { setForgotMode(false); setResetSent(false); setError(null); }}
                className="text-sm font-semibold flex items-center gap-1.5 mx-auto"
                style={{ color: '#00BF46' }}
              >
                <ArrowLeft size={14} /> Volver al inicio de sesión
              </button>
            </div>

          ) : forgotMode ? (
            /* ── Modo recuperación: formulario ── */
            <>
              <div className="mb-5">
                <button
                  onClick={() => { setForgotMode(false); setError(null); }}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-800 mb-4"
                >
                  <ArrowLeft size={13} /> Volver
                </button>
                <h2 className="text-xl font-bold text-slate-900">Recuperar contraseña</h2>
                <p className="text-sm text-slate-700 mt-1">Te enviaremos un enlace a tu email corporativo</p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Email corporativo
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="nombre@empresa.com"
                    autoComplete="email"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 text-sm text-slate-800 bg-white/75 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                  />
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
                  style={{ backgroundColor: loading ? '#94a3b8' : '#00BF46' }}
                >
                  {loading
                    ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    : <Mail size={16} />}
                  {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                </button>
              </form>
            </>

          ) : (
            /* ── Login normal ── */
            <>
              <div className="mb-5">
                <h2 className="text-xl font-bold text-slate-900">Iniciar sesión</h2>
                <p className="text-sm text-slate-700 mt-1">Introduce tus credenciales corporativas</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Email corporativo
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="nombre@empresa.com"
                    autoComplete="email"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 text-sm text-slate-800 bg-white/75 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                    style={{ '--tw-ring-color': '#00BF46' } as any}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-800">
                      Contraseña
                    </label>
                    <button
                      type="button"
                      onClick={() => { setForgotMode(true); setError(null); }}
                      className="text-xs font-medium hover:underline"
                      style={{ color: '#00BF46' }}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full px-4 py-3 pr-12 rounded-lg border border-slate-200 text-sm text-slate-800 bg-white/75 focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800"
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
                  style={{ backgroundColor: loading ? '#94a3b8' : '#00BF46' }}
                >
                  {loading
                    ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    : <LogIn size={16} />}
                  {loading ? 'Accediendo...' : 'Iniciar sesión'}
                </button>
              </form>
            </>
          )}



          <div className="mt-8 flex flex-col items-center gap-1">
            <span className="text-[11px] font-semibold text-slate-600">Una marca de</span>
            <img src="/logo-hs-group.png" alt="HS Consulting Group" className="w-40 h-auto" />
          </div>
          <p className="text-[11px] text-slate-500 text-center mt-4">
            © {new Date().getFullYear()} HS Consulting · Environment & Sustainability
          </p>
        </div>
      </div>

    </div>
  );
};
