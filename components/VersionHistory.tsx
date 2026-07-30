import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { GitBranch, Clock } from 'lucide-react';

interface HistoryEntry {
  id: string;
  version: string;
  version_num: number;
  saved_at: string;
  change_description?: string;
}

interface Props {
  planId: string;
}

export const VersionHistory: React.FC<Props> = ({ planId }) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!planId) { setLoading(false); return; }
    supabase
      .from('plan_history')
      .select('id, version, version_num, saved_at, change_description')
      .eq('plan_id', planId)
      .order('version_num', { ascending: false })
      .then(({ data }) => {
        setHistory((data as HistoryEntry[]) || []);
        setLoading(false);
      });
  }, [planId]);

  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return <div className="p-8 text-center text-slate-400 text-sm">Cargando historial...</div>;

  if (!planId) return (
    <div className="p-8 text-center text-slate-400 text-sm">
      Guarda el plan primero para ver el historial de versiones.
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <GitBranch size={18} className="text-brand-600" />
        <h2 className="text-lg font-bold text-slate-800">Historial de versiones</h2>
      </div>

      {history.length === 0 ? (
        <p className="text-slate-400 text-sm">No hay versiones anteriores registradas. Las versiones se crean al pulsar "Nueva Versión".</p>
      ) : (
        <div className="space-y-4">
          {history.map((entry) => (
            <div key={entry.id} className="border-l-2 border-brand-400 pl-4 py-1">
              <div className="flex items-center gap-3">
                <span className="text-xs font-black uppercase tracking-wider bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
                  {entry.version}
                </span>
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  <Clock size={11} /> {fmt(entry.saved_at)}
                </span>
              </div>
              {entry.change_description && (
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{entry.change_description}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
