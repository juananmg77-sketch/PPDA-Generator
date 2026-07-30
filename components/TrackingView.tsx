import React, { useState } from 'react';
import { Objective, AnnualTracking, SpecificAction } from '../types';
import { PHASES, PhaseConfig } from '../phaseConfig';
import {
  AlertCircle, Lock, Unlock, Calendar, Clock, Timer, CheckCircle2,
  Target, User, Pencil, X, Save, ChevronDown
} from 'lucide-react';

interface TrackingViewProps {
  objectives: Objective[];
  setObjectives: (objs: Objective[]) => void;
  currentYear: number;
  setCurrentYear: (year: number) => void;
  phases?: PhaseConfig[];
}

export const TrackingView: React.FC<TrackingViewProps> = ({ objectives, setObjectives, currentYear, setCurrentYear, phases = PHASES }) => {
  const selectedObjectives = objectives.filter(o => o.selected);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());

  const editingObj = editingId ? objectives.find(o => o.id === editingId) ?? null : null;

  const openEdit = (id: string) => setEditingId(id);
  const closeEdit = () => setEditingId(null);

  const togglePhase = (phaseId: string) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId); else next.add(phaseId);
      return next;
    });
  };

  const updateObjField = (field: keyof Objective, value: string) => {
    if (!editingId) return;
    setObjectives(objectives.map(o => o.id === editingId ? { ...o, [field]: value } : o));
  };

  const updateActionField = (actionId: string, field: keyof SpecificAction, value: string) => {
    if (!editingId) return;
    setObjectives(objectives.map(o => {
      if (o.id !== editingId) return o;
      return { ...o, actions: o.actions.map(a => a.id === actionId ? { ...a, [field]: value } : a) };
    }));
  };

  const inputClass = "mt-0.5 block w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-900 text-[11px] shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 focus:outline-none font-bold";
  const labelClass = "text-[8px] uppercase tracking-wider font-black text-slate-500";

  const activeObjectivesInYear = selectedObjectives.filter(obj => {
    if (obj.plazo) {
      const deadlineYear = new Date(obj.plazo).getFullYear();
      if (currentYear > deadlineYear) return false;
    }
    const prevYearTracking = obj.trackingHistory[currentYear - 1];
    if (prevYearTracking?.isClosed) return false;
    return true;
  });

  const years = [2026, 2027, 2028, 2029, 2030];

  const getYearTracking = (obj: Objective, year: number): AnnualTracking => {
    if (obj.trackingHistory[year]) return obj.trackingHistory[year];
    return { year, isClosed: false, globalProgress: 0, globalNotes: '', lastUpdate: new Date().toISOString(), updateSummary: 'Inicialización', actions: {} };
  };

  const updateYearTracking = (objId: string, year: number, updater: (t: AnnualTracking) => AnnualTracking) => {
    setObjectives(objectives.map(o => {
      if (o.id !== objId) return o;
      const current = getYearTracking(o, year);
      return { ...o, trackingHistory: { ...o.trackingHistory, [year]: updater({ ...current }) } };
    }));
  };

  const updateActionTracking = (objId: string, actionId: string, quarter: 't1'|'t2'|'t3'|'t4', field: 'cumple'|'evidencia', value: any) => {
    updateYearTracking(objId, currentYear, (tracking) => {
      const at = tracking.actions[actionId] || { t1:{cumple:false,evidencia:''}, t2:{cumple:false,evidencia:''}, t3:{cumple:false,evidencia:''}, t4:{cumple:false,evidencia:''}, notes:'', status:'open' };
      return { ...tracking, lastUpdate: new Date().toISOString(), actions: { ...tracking.actions, [actionId]: { ...at, [quarter]: { ...at[quarter], [field]: value } } } };
    });
  };

  const updateActionStatus = (objId: string, actionId: string, value: 'open'|'t1'|'t2'|'t3'|'t4') => {
    updateYearTracking(objId, currentYear, (tracking) => {
      const at = tracking.actions[actionId] || { t1:{cumple:false,evidencia:''}, t2:{cumple:false,evidencia:''}, t3:{cumple:false,evidencia:''}, t4:{cumple:false,evidencia:''}, notes:'', status:'open' };
      return { ...tracking, lastUpdate: new Date().toISOString(), actions: { ...tracking.actions, [actionId]: { ...at, status: value } } };
    });
  };

  const updateActionNote = (objId: string, actionId: string, value: string) => {
    updateYearTracking(objId, currentYear, (tracking) => {
      const at = tracking.actions[actionId] || { t1:{cumple:false,evidencia:''}, t2:{cumple:false,evidencia:''}, t3:{cumple:false,evidencia:''}, t4:{cumple:false,evidencia:''}, notes:'', status:'open' };
      return { ...tracking, lastUpdate: new Date().toISOString(), actions: { ...tracking.actions, [actionId]: { ...at, notes: value } } };
    });
  };

  const toggleYearStatus = (objId: string) => {
    updateYearTracking(objId, currentYear, (t) => ({ ...t, isClosed: !t.isClosed }));
  };

  const quarters = ['t1', 't2', 't3', 't4'] as const;

  const getProgress = (obj: Objective, tracking: AnnualTracking): number => {
    if (tracking.isClosed) return 100;
    const total = obj.actions.length;
    if (total === 0) return 0;
    const closed = obj.actions.filter(a => {
      const at = tracking.actions[a.id];
      return at && at.status && at.status !== 'open';
    }).length;
    return Math.round((closed / total) * 100);
  };

  return (
    <div className="space-y-4">

      {/* Edit modal */}
      {editingObj && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={closeEdit}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl flex-shrink-0">
              <div className="flex-1 min-w-0 pr-4">
                <span className="text-[9px] font-black text-brand-700 uppercase tracking-widest block">{editingObj.codigo}</span>
                <h3 className="text-sm font-black text-slate-900 leading-tight mt-0.5">{editingObj.descripcion}</h3>
              </div>
              <button onClick={closeEdit} className="p-2 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors flex-shrink-0"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              <div className="space-y-4">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <span className="flex-1 border-t border-slate-200"></span> Objetivo <span className="flex-1 border-t border-slate-200"></span>
                </h4>
                <label className="block">
                  <span className={labelClass}>Descripción</span>
                  <textarea rows={2} value={editingObj.descripcion} onChange={e => updateObjField('descripcion', e.target.value)} className={inputClass + ' resize-none'} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className={labelClass}>Meta / Objetivo cuantitativo</span>
                    <input type="text" value={editingObj.meta} onChange={e => updateObjField('meta', e.target.value)} className={inputClass} placeholder="ej: Reducir 20%" />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Indicador de medición</span>
                    <input type="text" value={editingObj.indicador} onChange={e => updateObjField('indicador', e.target.value)} className={inputClass} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className={labelClass}>Fecha límite del objetivo</span>
                    <input type="date" value={editingObj.plazo} onChange={e => updateObjField('plazo', e.target.value)} className={inputClass} />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Responsable</span>
                    <input type="text" value={editingObj.responsable} onChange={e => updateObjField('responsable', e.target.value)} className={inputClass} />
                  </label>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <span className="flex-1 border-t border-slate-200"></span> Acciones del plan <span className="flex-1 border-t border-slate-200"></span>
                </h4>
                {editingObj.actions.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">Sin acciones definidas. Ve a <strong>Estrategia SMART</strong> para añadirlas.</p>
                ) : (
                  editingObj.actions.map(action => (
                    <div key={action.id} className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                      <span className="text-[9px] font-black text-brand-700 uppercase tracking-wider">{action.codigo}</span>
                      <label className="block">
                        <span className={labelClass}>Descripción de la acción</span>
                        <textarea rows={2} value={action.descripcion} onChange={e => updateActionField(action.id, 'descripcion', e.target.value)} className={inputClass + ' resize-none'} />
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className={labelClass}>Responsable</span>
                          <input type="text" value={action.responsable} onChange={e => updateActionField(action.id, 'responsable', e.target.value)} className={inputClass} />
                        </label>
                        <label className="block">
                          <span className={labelClass}>Fecha límite</span>
                          <input type="date" value={action.plazo} onChange={e => updateActionField(action.id, 'plazo', e.target.value)} className={inputClass} />
                        </label>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 bg-white rounded-b-2xl flex-shrink-0">
              <button onClick={closeEdit} className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white py-2.5 rounded-xl font-black text-sm hover:bg-brand-700 transition-colors shadow-sm">
                <Save size={15} /> Guardar y cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header with year selector */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-3">
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
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Sin objetivos activos para {currentYear}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {phases.map(phase => {
            const phaseObjs = activeObjectivesInYear.filter(o => phase.objectiveIds.includes(o.id));
            if (phaseObjs.length === 0) return null;

            const { Icon } = phase;
            const isCollapsed = collapsedPhases.has(phase.id);
            const doneCount = phaseObjs.filter(o => {
              const t = getYearTracking(o, currentYear);
              return getProgress(o, t) === 100;
            }).length;

            return (
              <div key={phase.id} className="space-y-2.5">

                {/* Phase header */}
                <button
                  type="button"
                  onClick={() => togglePhase(phase.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all cursor-pointer hover:brightness-95 ${phase.header}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${phase.iconBox}`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-black uppercase tracking-widest ${phase.title}`}>Fase {phase.num}</span>
                      <span className="text-slate-300">·</span>
                      <h3 className="text-sm font-black text-slate-800 tracking-tight">{phase.label}</h3>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">{phase.description}</p>
                  </div>
                  <div className={`flex-shrink-0 text-xs font-black px-2.5 py-1 rounded-full border ${phase.badge}`}>
                    {doneCount}/{phaseObjs.length}
                  </div>
                  <ChevronDown
                    size={16}
                    className={`flex-shrink-0 transition-transform duration-200 ${phase.title} ${isCollapsed ? '-rotate-90' : ''}`}
                  />
                </button>

                {/* Objective cards */}
                {!isCollapsed && (
                  <div className="space-y-3 pl-3 border-l-2 border-slate-100 ml-4">
                    {phaseObjs.map(obj => {
                      const tracking = getYearTracking(obj, currentYear);
                      const isYearClosed = tracking.isClosed;
                      const progress = getProgress(obj, tracking);

                      return (
                        <div key={obj.id} className={`bg-white rounded-2xl border overflow-hidden shadow-sm ${isYearClosed ? 'border-slate-300' : phase.cardSel || 'border-slate-200'}`}>

                          {/* Obj header */}
                          <div className={`p-3 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${phase.header}`}>
                            <div className="flex flex-wrap items-center gap-2 flex-1">
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-widest flex-shrink-0 ${phase.objBadge}`}>{obj.codigo}</span>
                              <span className="text-sm font-black text-slate-800 tracking-tight leading-snug">{obj.descripcion}</span>
                              {obj.meta && (
                                <div className={`flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded border whitespace-nowrap ${isYearClosed ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-600 bg-white/70 border-slate-200'}`}>
                                  <Target size={10} /> {obj.meta}
                                </div>
                              )}
                              {obj.plazo && (
                                <div className="flex items-center gap-1 text-[9px] font-black uppercase text-amber-800 bg-white/70 px-2 py-0.5 rounded border border-amber-200 whitespace-nowrap">
                                  <Timer size={10} /> Vence: {new Date(obj.plazo).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                              {/* Progress */}
                              <div className="flex flex-col items-end mr-1">
                                <span className="text-[8px] font-black uppercase text-slate-400 tracking-wider mb-1">Progreso</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 bg-white/60 rounded-full overflow-hidden border border-slate-200">
                                    <div className={`h-full transition-all duration-500 ${phase.accentBar}`} style={{ width: `${progress}%` }} />
                                  </div>
                                  <span className={`text-[10px] font-black ${phase.title}`}>{progress}%</span>
                                </div>
                              </div>
                              <button
                                onClick={() => openEdit(obj.id)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all bg-white text-slate-600 border-slate-200 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 whitespace-nowrap"
                              >
                                <Pencil size={11} /> Editar
                              </button>
                              <button
                                onClick={() => toggleYearStatus(obj.id)}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all whitespace-nowrap ${
                                  isYearClosed ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-white text-brand-600 border-brand-200 hover:bg-brand-50'
                                }`}
                              >
                                {isYearClosed ? <><Lock size={11} /> Cerrado</> : <><Unlock size={11} /> Abierto</>}
                              </button>
                            </div>
                          </div>

                          {/* Actions table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-[10px] text-left border-collapse">
                              <thead className="bg-slate-50 text-slate-400 uppercase text-[8px] tracking-widest font-black border-b border-slate-100">
                                <tr>
                                  <th className="px-4 py-2 w-[35%] min-w-[250px]">Acción y Responsable</th>
                                  <th className="px-4 py-2 text-center w-28 min-w-[7rem]">Estado</th>
                                  <th className="px-4 py-2 text-center w-10">T1</th>
                                  <th className="px-4 py-2 text-center w-10">T2</th>
                                  <th className="px-4 py-2 text-center w-10">T3</th>
                                  <th className="px-4 py-2 text-center w-10">T4</th>
                                  <th className="px-4 py-2 min-w-[180px]">Evidencia / Notas</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {obj.actions.length === 0 ? (
                                  <tr>
                                    <td colSpan={7} className="px-4 py-5 text-center text-[10px] text-slate-400 italic">
                                      Sin acciones — añádelas en Estrategia SMART
                                    </td>
                                  </tr>
                                ) : (
                                  obj.actions.map(action => {
                                    const at = tracking.actions[action.id] || {
                                      t1:{cumple:false,evidencia:''}, t2:{cumple:false,evidencia:''},
                                      t3:{cumple:false,evidencia:''}, t4:{cumple:false,evidencia:''},
                                      notes:'', status:'open'
                                    };
                                    const isExpired = action.plazo && new Date(action.plazo).getFullYear() < currentYear;
                                    const status = at.status || 'open';
                                    const completionIdx = quarters.indexOf(status as any);

                                    return (
                                      <tr key={action.id} className={`${isExpired ? 'bg-red-50/50' : ''} ${status !== 'open' ? 'bg-green-50/30' : 'hover:bg-slate-50/60'}`}>
                                        <td className="px-4 py-3 align-top">
                                          <div className="font-bold text-slate-800 flex items-center gap-1.5 mb-0.5 flex-wrap">
                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${phase.objBadge}`}>{action.codigo}</span>
                                            {status !== 'open' && <span className="text-[7px] bg-green-100 text-green-700 px-1 rounded border border-green-200 font-black uppercase flex items-center gap-0.5 whitespace-nowrap"><CheckCircle2 size={8} /> Hecho {status.toUpperCase()}</span>}
                                            {isExpired && status === 'open' && <span className="text-[7px] bg-white text-red-700 px-1 rounded border border-red-200 font-black uppercase whitespace-nowrap">Expirado</span>}
                                          </div>
                                          <div className="text-slate-600 font-semibold mb-1 leading-tight text-[10px]">{action.descripcion}</div>
                                          <div className="flex items-center gap-1 text-[8px] text-slate-400 font-black uppercase tracking-wider">
                                            <User size={8} /> {action.responsable}
                                          </div>
                                          {action.plazo && (
                                            <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider mt-0.5 text-amber-600">
                                              <Timer size={8} /> Límite: {new Date(action.plazo).toLocaleDateString('es-ES')}
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 text-center align-top">
                                          <select
                                            disabled={isYearClosed}
                                            value={status}
                                            onChange={e => updateActionStatus(obj.id, action.id, e.target.value as any)}
                                            className={`text-[10px] font-black rounded-lg border-none py-1 px-2 focus:ring-1 cursor-pointer w-full ${
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
                                          const isDisabled = isYearClosed || (completionIdx !== -1 && idx > completionIdx);
                                          return (
                                            <td key={q} className={`px-2 py-3 text-center align-top ${completionIdx !== -1 && idx > completionIdx ? 'opacity-30' : ''}`}>
                                              <div className="flex justify-center pt-1">
                                                <input
                                                  type="checkbox"
                                                  disabled={isDisabled}
                                                  checked={at[q]?.cumple || false}
                                                  onChange={e => updateActionTracking(obj.id, action.id, q, 'cumple', e.target.checked)}
                                                  className="w-4 h-4 rounded text-brand-600 border-slate-300 disabled:opacity-30 bg-white cursor-pointer disabled:cursor-not-allowed"
                                                />
                                              </div>
                                            </td>
                                          );
                                        })}
                                        <td className="px-4 py-3 align-top">
                                          <textarea
                                            disabled={isYearClosed}
                                            value={at.notes || ''}
                                            onChange={e => updateActionNote(obj.id, action.id, e.target.value)}
                                            placeholder="..."
                                            rows={2}
                                            className={`w-full text-[10px] bg-white border border-slate-200 rounded-lg px-2 py-1 font-bold resize-y ${isYearClosed ? 'opacity-50 text-slate-400' : 'text-slate-800 focus:border-brand-500'}`}
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
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
          })}

          {/* Orphan objectives (ids not in any phase) */}
          {(() => {
            const knownIds = new Set(phases.flatMap(p => p.objectiveIds));
            const orphans = activeObjectivesInYear.filter(o => !knownIds.has(o.id));
            if (orphans.length === 0) return null;
            return (
              <div className="space-y-3">
                <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Otros objetivos</h3>
                </div>
                {orphans.map(obj => {
                  const tracking = getYearTracking(obj, currentYear);
                  const isYearClosed = tracking.isClosed;
                  const progress = getProgress(obj, tracking);
                  return (
                    <div key={obj.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center gap-3">
                        <div className="flex items-center gap-2 flex-1 flex-wrap">
                          <span className="text-[9px] font-black text-brand-700 bg-white px-2 py-0.5 rounded border border-brand-100">{obj.codigo}</span>
                          <span className="text-sm font-black text-slate-800">{obj.descripcion}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-brand-700">{progress}%</span>
                          <button onClick={() => openEdit(obj.id)} className="px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase border bg-white text-slate-600 border-slate-200 hover:bg-brand-50 hover:text-brand-700 flex items-center gap-1">
                            <Pencil size={11} /> Editar
                          </button>
                          <button onClick={() => toggleYearStatus(obj.id)} className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase border flex items-center gap-1 ${isYearClosed ? 'bg-slate-100 text-slate-700 border-slate-300' : 'bg-white text-brand-600 border-brand-200'}`}>
                            {isYearClosed ? <><Lock size={11} /> Cerrado</> : <><Unlock size={11} /> Abierto</>}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
