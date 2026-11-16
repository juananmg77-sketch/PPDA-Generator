import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { AppState } from '../types';
import {
  LogOut, FileText, GitBranch, Calendar, KeyRound,
  Eye, EyeOff, X, Scale, BookOpen, ChevronRight, Building2
} from 'lucide-react';

interface Plan {
  plan_id: string;
  hotel_name: string;
  scope: string;
  version: string;
  estado: string;
  updated_at: string;
  consultor: string | null;
  data: AppState;
}

interface Props {
  currentUser: string;
  onOpenPlan: (data: AppState) => void;
  onOpenRegistros: (data: AppState, planId: string, hotelNombre: string) => void;
  onLogout: () => void;
}

const ESTADO_COLORS: Record<string, string> = {
  'Borrador':    'bg-yellow-50 text-yellow-700 border border-yellow-200',
  'Activo':      'bg-green-50 text-green-700 border border-green-200',
  'En revisión': 'bg-blue-50 text-blue-700 border border-blue-200',
  'Archivado':   'bg-slate-100 text-slate-500 border border-slate-200',
};

export const ClientDashboard: React.FC<Props> = ({
  currentUser, onOpenPlan, onOpenRegistros, onLogout
}) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal selector de hotel (para planes corporativos → Registros)
  const [hotelSelector, setHotelSelector] = useState<{ plan: Plan; hotels: string[] } | null>(null);

  // Modal cambio de contraseña
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [newPwd, setNewPwd]         = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd]       = useState(false);
  const [pwdStatus, setPwdStatus]   = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);

  const [hotelFilterMap, setHotelFilterMap] = useState<Record<string, string | null>>({});

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    setLoading(true);
    const [{ data, error }, { data: accessData }] = await Promise.all([
      supabase
        .from('plans')
        .select('plan_id, hotel_name, scope, version, estado, updated_at, consultor, data')
        .order('updated_at', { ascending: false }),
      supabase
        .from('plan_access')
        .select('plan_id, hotel_filter'),
    ]);
    if (!error) setPlans((data as Plan[]) || []);
    if (accessData) {
      const map: Record<string, string | null> = {};
      for (const row of accessData as any[]) map[row.plan_id] = row.hotel_filter ?? null;
      setHotelFilterMap(map);
    }
    setLoading(false);
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const handleRegistros = (plan: Plan) => {
    if (plan.scope === 'corporate') {
      const allHotels = (plan.data?.hotels || []).map((h: any) => h.nombreComercial).filter(Boolean);
      const filter = hotelFilterMap[plan.plan_id];
      // Si el usuario tiene filtro de hotel, ir directo sin selector
      if (filter) {
        onOpenRegistros(plan.data, plan.plan_id, filter);
        return;
      }
      if (allHotels.length === 1) {
        onOpenRegistros(plan.data, plan.plan_id, allHotels[0]);
      } else {
        setHotelSelector({ plan, hotels: allHotels });
      }
    } else {
      const hotelNombre = plan.data?.hotelData?.nombreComercial || plan.hotel_name;
      onOpenRegistros(plan.data, plan.plan_id, hotelNombre);
    }
  };

  // Zonas con pesaje de un plan (para mostrar contador)
  const countZonasPesaje = (plan: Plan): number => {
    if (plan.scope === 'corporate') {
      return (plan.data?.hotels || []).reduce((s: number, h: any) =>
        s + (h.areas || []).filter((a: any) => a.tienePuntoPesaje).length, 0);
    }
    return (plan.data?.areas || []).filter((a: any) => a.tienePuntoPesaje).length;
  };

  return (
    <div className="min-h-screen flex flex-col font-sans overflow-x-hidden" style={{ backgroundColor: '#f1f5f9' }}>

      {/* ── Header corporativo ── */}
      <header style={{ backgroundColor: '#00093D' }} className="shadow-md flex-shrink-0 w-full">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <span className="bg-white rounded-lg px-2.5 py-1 flex items-center"><img src="/logo-hsgreen-recortado.png" alt="HS GREEN" className="h-7 w-auto object-contain" /></span>
            <div className="w-px h-5 bg-white/20" />
            <div>
              <h1 className="text-sm font-semibold text-white leading-none">Portal Cliente</h1>
              <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                {currentUser}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setShowChangePwd(true); setPwdStatus(null); setNewPwd(''); setConfirmPwd(''); }}
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'rgba(255,255,255,0.6)' }}
              title="Cambiar contraseña"
            >
              <KeyRound size={18} />
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              <LogOut size={15} /> Salir
            </button>
          </div>
        </div>
      </header>

      {/* ── Contenido ── */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 overflow-x-hidden">

        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-800">Mis Planes PPDA</h2>
          <p className="text-sm text-slate-500 mt-1">Accede al plan o introduce los registros diarios de pesaje.</p>
        </div>

        {loading ? (
          <div className="text-center py-20 text-slate-400 text-sm">Cargando planes...</div>
        ) : plans.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <FileText size={40} className="mx-auto mb-4 opacity-30" />
            <p className="font-semibold">No tienes planes asignados todavía.</p>
            <p className="text-sm mt-1">Tu consultor te asignará acceso cuando el plan esté listo.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {plans.map(plan => {
              const zonas = countZonasPesaje(plan);
              const isCorp = plan.scope === 'corporate';
              const borderColor = plan.estado === 'Activo' ? '#00093D' : plan.estado === 'En revisión' ? '#0002C9' : '#cbd5e1';
              return (
                <div key={plan.plan_id}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden flex"
                  style={{ border: '1px solid #e2e8f0' }}
                >
                  {/* Borde izquierdo de estado */}
                  <div className="w-1.5 flex-shrink-0 rounded-l-2xl" style={{ backgroundColor: borderColor }} />

                  <div className="flex-1 min-w-0 p-5">
                    {/* Nombre del hotel */}
                    <h3 className="text-xl font-black text-slate-900 leading-tight truncate mb-2">
                      {plan.hotel_name}
                    </h3>

                    {/* Metadata */}
                    <div className="flex items-center gap-2 flex-wrap mb-5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ESTADO_COLORS[plan.estado] || 'bg-slate-100 text-slate-500'}`}>
                        {plan.estado}
                      </span>
                      {isCorp && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-header/10 text-header border border-header/20">
                          Corporativo
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <GitBranch size={10} /> {plan.version}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Calendar size={10} /> {fmt(plan.updated_at)}
                      </span>
                    </div>

                    {/* Botones */}
                    <div className="flex flex-col gap-2.5">
                      {/* Registrar Desperdicio — primario */}
                      <button
                        onClick={() => handleRegistros(plan)}
                        disabled={zonas === 0}
                        className="relative w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden"
                        style={{ backgroundColor: '#00923A' }}
                      >
                        <div className="absolute inset-0 opacity-10"
                          style={{ background: 'radial-gradient(circle at 85% 50%, #4ade80, transparent 55%)' }} />
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
                          <Scale size={18} className="text-white" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-white font-bold text-base leading-none">Registrar Pesajes</p>
                          <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
                            {zonas > 0 ? `${zonas} zona${zonas !== 1 ? 's' : ''} con báscula` : 'Sin zonas configuradas'}
                          </p>
                        </div>
                        <ChevronRight size={17} className="flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
                      </button>

                      {/* Ver Plan — secundario */}
                      <button
                        onClick={() => onOpenPlan(plan.data)}
                        className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border-2 border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 transition-all text-sm font-semibold text-slate-700"
                      >
                        <BookOpen size={15} className="text-slate-500 flex-shrink-0" />
                        Ver Plan de Desperdicio
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ── Modal selector hotel (corporativo) ── */}
      {hotelSelector && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"
              style={{ backgroundColor: '#00093D' }}>
              <div>
                <p className="text-white font-semibold text-sm">Selecciona el establecimiento</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  {hotelSelector.plan.hotel_name}
                </p>
              </div>
              <button onClick={() => setHotelSelector(null)} style={{ color: 'rgba(255,255,255,0.6)' }}>
                <X size={18} />
              </button>
            </div>
            <div className="py-2">
              {hotelSelector.hotels.map(hotel => (
                <button
                  key={hotel}
                  onClick={() => {
                    onOpenRegistros(hotelSelector.plan.data, hotelSelector.plan.plan_id, hotel);
                    setHotelSelector(null);
                  }}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{ backgroundColor: '#00093D22', color: '#00093D' }}>
                    {hotel.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-slate-800 flex-1 truncate">{hotel}</span>
                  <ChevronRight size={15} className="text-slate-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal cambio contraseña ── */}
      {showChangePwd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: '#00093D' }}>
              <div className="flex items-center gap-3">
                <KeyRound size={18} className="text-white/70" />
                <div>
                  <p className="text-white font-semibold text-sm leading-none">Cambiar contraseña</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{currentUser}</p>
                </div>
              </div>
              <button onClick={() => setShowChangePwd(false)} style={{ color: 'rgba(255,255,255,0.6)' }}>
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {pwdStatus && (
                <div className={`rounded-lg px-4 py-3 text-sm font-medium ${pwdStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {pwdStatus.msg}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Nueva contraseña</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} value={newPwd} onChange={e => setNewPwd(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Confirmar contraseña</label>
                <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)}
                  placeholder="Repite la contraseña"
                  className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <button
                onClick={async () => {
                  if (newPwd.length < 8) { setPwdStatus({ type: 'error', msg: 'Mínimo 8 caracteres.' }); return; }
                  if (newPwd !== confirmPwd) { setPwdStatus({ type: 'error', msg: 'Las contraseñas no coinciden.' }); return; }
                  setPwdLoading(true);
                  const { error } = await supabase.auth.updateUser({ password: newPwd });
                  setPwdLoading(false);
                  if (error) { setPwdStatus({ type: 'error', msg: error.message }); }
                  else { setPwdStatus({ type: 'success', msg: '¡Contraseña actualizada!' }); setNewPwd(''); setConfirmPwd(''); setTimeout(() => setShowChangePwd(false), 1800); }
                }}
                disabled={pwdLoading || !newPwd || !confirmPwd}
                className="w-full py-2.5 text-white rounded-lg font-semibold text-sm transition-all disabled:opacity-40"
                style={{ backgroundColor: '#00093D' }}
              >
                {pwdLoading ? 'Guardando…' : 'Cambiar contraseña'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
