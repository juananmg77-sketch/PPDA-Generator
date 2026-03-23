
import React from 'react';
import { Objective, AnnualTracking } from '../types';
import { AlertCircle, Lock, Unlock, Calendar, Clock, Timer, CheckCircle2, Target, User } from 'lucide-react';

interface TrackingViewProps {
  objectives: Objective[];
  setObjectives: (objs: Objective[]) => void;
  currentYear: number;
  setCurrentYear: (year: number) => void;
}

export const TrackingView: React.FC<TrackingViewProps> = ({ objectives, setObjectives, currentYear, setCurrentYear }) => {
  const selectedObjectives = objectives.filter(o => o.selected);
  
  const activeObjectivesInYear = selectedObjectives.filter(obj => {
      if (!obj.plazo) return true; 
      const deadlineYear = new Date(obj.plazo).getFullYear();
      return currentYear <= deadlineYear;
  });

  const years = [2026, 2027, 2028, 2029, 2030];

  const getYearTracking = (obj: Objective, year: number): AnnualTracking => {
    if (obj.trackingHistory[year]) {
      return obj.trackingHistory[year];
    }
    return {
      year,
      isClosed: false,
      globalProgress: 0,
      globalNotes: '',
      lastUpdate: new Date().toISOString(),
      updateSummary: 'Inicialización',
      actions: {}
    };
  };

  const updateYearTracking = (objId: string, year: number, updater: (t: AnnualTracking) => AnnualTracking) => {
    setObjectives(objectives.map(o => {
      if (o.id !== objId) return o;
      const currentTracking = getYearTracking(o, year);
      const updatedTracking = updater({ ...currentTracking });
      return {
        ...o,
        trackingHistory: {
          ...o.trackingHistory,
          [year]: updatedTracking
        }
      };
    }));
  };

  const updateActionTracking = (objId: string, actionId: string, actionCode: string, quarter: 't1' | 't2' | 't3' | 't4', field: 'cumple' | 'evidencia', value: any) => {
     updateYearTracking(objId, currentYear, (tracking) => {
        const actionTracking = tracking.actions[actionId] || { 
            t1: { cumple: false, evidencia: '' },
            t2: { cumple: false, evidencia: '' },
            t3: { cumple: false, evidencia: '' },
            t4: { cumple: false, evidencia: '' },
            notes: '',
            status: 'open'
        };
        return {
            ...tracking,
            lastUpdate: new Date().toISOString(),
            actions: {
                ...tracking.actions,
                [actionId]: {
                    ...actionTracking,
                    [quarter]: { ...actionTracking[quarter], [field]: value }
                }
            }
        };
     });
  };

  const updateActionStatus = (objId: string, actionId: string, value: 'open' | 't1' | 't2' | 't3' | 't4') => {
    updateYearTracking(objId, currentYear, (tracking) => {
        const actionTracking = tracking.actions[actionId] || { 
             t1: { cumple: false, evidencia: '' },
             t2: { cumple: false, evidencia: '' },
             t3: { cumple: false, evidencia: '' },
             t4: { cumple: false, evidencia: '' },
             notes: '',
             status: 'open'
        };
        return {
            ...tracking,
            lastUpdate: new Date().toISOString(),
            actions: {
                ...tracking.actions,
                [actionId]: { ...actionTracking, status: value }
            }
        };
    });
  };

  const updateActionNote = (objId: string, actionId: string, actionCode: string, value: string) => {
    updateYearTracking(objId, currentYear, (tracking) => {
        const actionTracking = tracking.actions[actionId] || { 
             t1: { cumple: false, evidencia: '' },
             t2: { cumple: false, evidencia: '' },
             t3: { cumple: false, evidencia: '' },
             t4: { cumple: false, evidencia: '' },
             notes: '',
             status: 'open'
        };
        return {
            ...tracking,
            lastUpdate: new Date().toISOString(),
            actions: {
                ...tracking.actions,
                [actionId]: { ...actionTracking, notes: value }
            }
        };
    });
  };

  const toggleYearStatus = (objId: string) => {
      updateYearTracking(objId, currentYear, (t) => ({ ...t, isClosed: !t.isClosed }));
  };

  const quarters = ['t1', 't2', 't3', 't4'] as const;

  return (
    <div className="space-y-4">
        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Calendar size={20} className="text-brand-600" /> Seguimiento Operativo
            </h2>
            <div className="flex gap-1 p-1 bg-white rounded-lg border border-slate-200 shadow-sm">
                {years.map(y => (
                    <button
                        key={y}
                        onClick={() => setCurrentYear(y)}
                        className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-md transition-all ${
                            currentYear === y ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
                        }`}
                    >
                        {y}
                    </button>
                ))}
            </div>
        </div>

        {activeObjectivesInYear.length === 0 ? (
             <div className="text-center p-12 bg-white rounded-2xl border border-dashed border-slate-200">
                 <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Sin objetivos para {currentYear}</p>
             </div>
        ) : (
            <div className="space-y-4">
                {activeObjectivesInYear.map(obj => {
                    const tracking = getYearTracking(obj, currentYear);
                    const isYearClosed = tracking.isClosed;

                    // Cálculo dinámico del progreso
                    let progress = 0;
                    if (isYearClosed) {
                        progress = 100;
                    } else {
                        const totalActions = obj.actions.length;
                        if (totalActions > 0) {
                            const closedActions = obj.actions.filter(action => {
                                const actTracking = tracking.actions[action.id];
                                return actTracking && actTracking.status && actTracking.status !== 'open';
                            }).length;
                            progress = Math.round((closedActions / totalActions) * 100);
                        }
                    }

                    return (
                        <div key={obj.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="bg-slate-50 p-3 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="flex flex-wrap items-center gap-3 flex-1">
                                    <span className="text-[9px] font-black text-brand-700 bg-white px-2 py-1 rounded-md uppercase border border-brand-100 shadow-sm whitespace-nowrap">{obj.codigo}</span>
                                    <span className="text-sm font-black text-slate-800 tracking-tight leading-snug mr-2">{obj.descripcion}</span>
                                    <div className="flex flex-wrap gap-2">
                                        {obj.meta && (
                                            <div className={`flex items-center gap-1 text-[9px] font-black uppercase px-2 py-1 rounded-md border whitespace-nowrap ${
                                                isYearClosed 
                                                ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                                                : 'text-slate-600 bg-slate-100 border-slate-200'
                                            }`}>
                                                <Target size={12} />
                                                Meta: {obj.meta}
                                            </div>
                                        )}
                                        {obj.plazo && (
                                        <div className="flex items-center gap-1 text-[9px] font-black uppercase text-amber-800 bg-white px-2 py-1 rounded-md border border-amber-200 whitespace-nowrap">
                                            <Timer size={12} />
                                            Vence: {new Date(obj.plazo).toLocaleDateString()}
                                        </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 self-end sm:self-auto">
                                    <div className="flex flex-col items-end mr-2">
                                        <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider mb-1">Progreso</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                <div className="h-full bg-brand-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                                            </div>
                                            <span className="text-[10px] font-black text-brand-700">{progress}%</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => toggleYearStatus(obj.id)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${
                                            isYearClosed ? 'bg-white text-slate-900 border-slate-400' : 'bg-white text-brand-600 border-brand-200 hover:bg-brand-50'
                                        }`}
                                    >
                                        {isYearClosed ? <><Lock size={12} className="text-slate-900"/> Bloqueado</> : <><Unlock size={12}/> Abierto</>}
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-[10px] text-left border-collapse">
                                    <thead className="bg-slate-50 text-slate-500 uppercase text-[8px] tracking-widest font-black border-b border-slate-100">
                                        <tr>
                                            <th className="px-4 py-2 w-[35%] min-w-[250px]">Acción y Responsable</th>
                                            <th className="px-4 py-2 text-center w-24">Estado</th>
                                            <th className="px-4 py-2 text-center w-12">T1</th>
                                            <th className="px-4 py-2 text-center w-12">T2</th>
                                            <th className="px-4 py-2 text-center w-12">T3</th>
                                            <th className="px-4 py-2 text-center w-12">T4</th>
                                            <th className="px-4 py-2 min-w-[200px]">Evidencia / Notas</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {obj.actions.map(action => {
                                            const actTracking = tracking.actions[action.id] || { 
                                                t1: { cumple: false, evidencia: '' }, 
                                                t2: { cumple: false, evidencia: '' }, 
                                                t3: { cumple: false, evidencia: '' }, 
                                                t4: { cumple: false, evidencia: '' }, 
                                                notes: '',
                                                status: 'open'
                                            };
                                            const actionYear = action.plazo ? new Date(action.plazo).toLocaleDateString() : ''; // Si no hay fecha es string vacio, si hay fecha parsea
                                            // Simplificacion: Solo marcamos expirado si hay plazo y el año actual es mayor al año del plazo
                                            const isExpired = action.plazo && new Date(action.plazo).getFullYear() < currentYear;
                                            
                                            const status = actTracking.status || 'open';
                                            
                                            // Determine index of completion to disable subsequent quarters
                                            const completionIdx = quarters.indexOf(status as any);

                                            return (
                                                <tr key={action.id} className={`${isExpired ? 'bg-red-50' : 'hover:bg-slate-50'} ${status !== 'open' ? 'bg-green-50/50' : ''}`}>
                                                    <td className="px-4 py-3 align-top">
                                                        <div className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                                                            {action.codigo}
                                                            {status !== 'open' && <span className="text-[7px] bg-green-100 text-green-700 px-1 rounded border border-green-200 font-black uppercase flex items-center gap-0.5 whitespace-nowrap"><CheckCircle2 size={8} /> Hecho {status.toUpperCase()}</span>}
                                                            {isExpired && status === 'open' && <span className="text-[7px] bg-white text-red-700 px-1 rounded border border-red-200 font-black uppercase whitespace-nowrap">Expirado</span>}
                                                        </div>
                                                        <div className="text-slate-500 font-bold mb-1.5 whitespace-normal leading-tight" title={action.descripcion}>{action.descripcion}</div>
                                                        <div className="flex items-center gap-1 text-[8px] text-slate-400 font-black uppercase tracking-wider">
                                                            <User size={8} /> {action.responsable}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center align-top">
                                                        <select
                                                            disabled={isYearClosed}
                                                            value={status}
                                                            onChange={(e) => updateActionStatus(obj.id, action.id, e.target.value as any)}
                                                            className={`text-[9px] font-black uppercase rounded-lg border-none py-1 pl-2 pr-6 focus:ring-1 cursor-pointer w-full ${
                                                                status === 'open' ? 'bg-slate-100 text-slate-500' : 'bg-green-100 text-green-700'
                                                            }`}
                                                        >
                                                            <option value="open">En Curso</option>
                                                            <option value="t1">Fin T1</option>
                                                            <option value="t2">Fin T2</option>
                                                            <option value="t3">Fin T3</option>
                                                            <option value="t4">Fin T4</option>
                                                        </select>
                                                    </td>
                                                    {quarters.map((q, idx) => {
                                                        // Disable if Year locked OR if this quarter is AFTER the completion quarter
                                                        const isCompletedBefore = completionIdx !== -1 && idx > completionIdx;
                                                        const isDisabled = isYearClosed || isCompletedBefore;

                                                        return (
                                                            <td key={q} className={`px-4 py-3 text-center align-top ${isCompletedBefore ? 'bg-slate-50/50 opacity-30' : ''}`}>
                                                                <div className="flex justify-center pt-1">
                                                                    <input 
                                                                        type="checkbox"
                                                                        disabled={isDisabled}
                                                                        checked={actTracking[q]?.cumple || false}
                                                                        onChange={(e) => updateActionTracking(obj.id, action.id, action.codigo, q, 'cumple', e.target.checked)}
                                                                        className="w-4 h-4 rounded text-brand-600 border-slate-300 disabled:opacity-30 bg-white cursor-pointer disabled:cursor-not-allowed"
                                                                    />
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-4 py-3 align-top">
                                                        <textarea 
                                                            disabled={isYearClosed}
                                                            value={actTracking.notes || ''}
                                                            onChange={(e) => updateActionNote(obj.id, action.id, action.codigo, e.target.value)}
                                                            placeholder="..."
                                                            rows={2}
                                                            className={`w-full text-[10px] bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold resize-y ${isYearClosed ? 'opacity-50 text-slate-400' : 'text-slate-800 focus:border-brand-500'}`}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
    </div>
  );
};
