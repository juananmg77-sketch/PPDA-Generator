import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { AppState } from '../types';
import { LogOut, FileText, GitBranch, Calendar, ChevronRight } from 'lucide-react';

interface Plan {
  plan_id: string;
  hotel_name: string;
  version: string;
  estado: string;
  updated_at: string;
  consultor: string | null;
  data: AppState;
}

interface Props {
  currentUser: string;
  onOpenPlan: (data: AppState) => void;
  onLogout: () => void;
}

const ESTADO_COLORS: Record<string, string> = {
  'Borrador':    'bg-yellow-100 text-yellow-700',
  'Activo':      'bg-green-100 text-green-700',
  'En revisión': 'bg-blue-100 text-blue-700',
  'Archivado':   'bg-slate-100 text-slate-500',
};

export const ClientDashboard: React.FC<Props> = ({ currentUser, onOpenPlan, onLogout }) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    // RLS filtra automáticamente los planes asignados al cliente
    const { data, error } = await supabase
      .from('plans')
      .select('plan_id, hotel_name, version, estado, updated_at, consultor, data')
      .order('updated_at', { ascending: false });

    if (!error) setPlans((data as Plan[]) || []);
    setLoading(false);
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/icon-48.png" alt="HsGreen" className="w-9 h-9 rounded-lg object-contain" />
          <div>
            <h1 className="text-sm font-black text-slate-900 tracking-tight">Portal Cliente</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">PPDA Generator</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <span className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Usuario</span>
            <span className="block text-sm font-bold text-slate-700">{currentUser}</span>
          </div>
          <button onClick={onLogout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-black text-slate-900 mb-2">Mis Planes PPDA</h2>
        <p className="text-slate-500 text-sm mb-8">Accede a tus planes de prevención y desperdicio alimentario.</p>

        {loading ? (
          <div className="text-center py-20 text-slate-400">Cargando planes...</div>
        ) : plans.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <FileText size={40} className="mx-auto mb-4 opacity-30" />
            <p className="font-semibold">No tienes planes asignados todavía.</p>
            <p className="text-sm mt-1">Tu consultor te asignará acceso cuando el plan esté listo.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {plans.map(plan => (
              <button
                key={plan.plan_id}
                onClick={() => onOpenPlan(plan.data)}
                className="bg-white rounded-xl border border-slate-200 p-5 text-left hover:border-brand-400 hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-black text-slate-900 text-base">{plan.hotel_name}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ESTADO_COLORS[plan.estado] || 'bg-slate-100 text-slate-500'}`}>
                        {plan.estado}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <GitBranch size={11} /> {plan.version}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={11} /> Actualizado {fmt(plan.updated_at)}
                      </span>
                      {plan.consultor && (
                        <span className="text-slate-400">Consultor: {plan.consultor}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-300 group-hover:text-brand-500 transition-colors mt-1" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
