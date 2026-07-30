
import React, { useState } from 'react';
import { Objective, SpecificAction } from '../types';
import { OBJECTIVE_ACTIONS } from '../constants';
import { PHASES, PhaseConfig } from '../phaseConfig';
import {
  CheckCircle2, Circle, ListChecks, Plus, Trash2, Sparkles, ChevronDown
} from 'lucide-react';

interface ObjectiveSelectionProps {
  objectives: Objective[];
  setObjectives: (objs: Objective[]) => void;
  phases?: PhaseConfig[];
}

export const ObjectiveSelection: React.FC<ObjectiveSelectionProps> = ({ objectives, setObjectives, phases = PHASES }) => {
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());

  const togglePhase = (phaseId: string) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId); else next.add(phaseId);
      return next;
    });
  };

  const toggleObjective = (id: string) => {
    setObjectives(objectives.map(o => o.id === id ? { ...o, selected: !o.selected } : o));
  };

  const updateObjective = (id: string, field: keyof Objective, value: string) => {
    setObjectives(objectives.map(o => o.id === id ? { ...o, [field]: value } : o));
  };

  const addAction = (objectiveId: string, description: string) => {
    const parent = objectives.find(o => o.id === objectiveId);
    if (!parent) return;
    const suffix = String.fromCharCode(97 + parent.actions.length);
    const newAction: SpecificAction = {
      id: Date.now().toString() + Math.random().toString(),
      codigo: `${parent.codigo}${suffix}`,
      descripcion: description,
      responsable: parent.responsable || 'Responsable',
      plazo: '',
    };
    setObjectives(objectives.map(o => o.id === objectiveId ? { ...o, actions: [...o.actions, newAction] } : o));
  };

  const updateAction = (objectiveId: string, actionId: string, field: keyof SpecificAction, value: string) => {
    setObjectives(objectives.map(o => {
      if (o.id !== objectiveId) return o;
      return { ...o, actions: o.actions.map(a => a.id === actionId ? { ...a, [field]: value } : a) };
    }));
  };

  const removeAction = (objectiveId: string, actionId: string) => {
    setObjectives(objectives.map(o => {
      if (o.id !== objectiveId) return o;
      const filtered = o.actions.filter(a => a.id !== actionId);
      return { ...o, actions: filtered.map((a, i) => ({ ...a, codigo: `${o.codigo}${String.fromCharCode(97 + i)}` })) };
    }));
  };

  const inputClass = "mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 text-xs shadow-sm transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 focus:outline-none placeholder:text-slate-400 font-semibold";
  const labelClass = "text-[9px] uppercase tracking-wider font-black text-slate-400 ml-0.5";

  // Collect objective IDs that belong to any known phase
  const knownIds = new Set(phases.flatMap(p => p.objectiveIds));
  const orphans = objectives.filter(o => !knownIds.has(o.id));

  return (
    <div className="space-y-6">
      {phases.map((phase) => {
        const phaseObjs = objectives.filter(o => phase.objectiveIds.includes(o.id));
        if (phaseObjs.length === 0) return null;
        const selectedCount = phaseObjs.filter(o => o.selected).length;
        const { Icon } = phase;
        const isCollapsed = collapsedPhases.has(phase.id);

        return (
          <div key={phase.id} className="space-y-2.5">

            {/* Phase header — clickable */}
            <button
              type="button"
              onClick={() => togglePhase(phase.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all cursor-pointer ${phase.header} hover:brightness-95`}
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
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{phase.description}</p>
              </div>
              <div className={`flex-shrink-0 text-xs font-black px-2.5 py-1 rounded-full border ${phase.badge}`}>
                {selectedCount}/{phaseObjs.length}
              </div>
              <ChevronDown
                size={16}
                className={`flex-shrink-0 transition-transform duration-200 ${phase.title} ${isCollapsed ? '-rotate-90' : ''}`}
              />
            </button>

            {/* Objective cards */}
            {!isCollapsed && (
            <div className="grid grid-cols-1 gap-2 pl-3 border-l-2 border-slate-100 ml-4">
              {phaseObjs.map(obj => {
                const availableActions = OBJECTIVE_ACTIONS[obj.id] || [];
                const isAuto = obj.isAutoProposed;

                return (
                  <div
                    key={obj.id}
                    className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                      obj.selected
                        ? (isAuto ? 'border-amber-300 bg-amber-50/20' : phase.cardSel)
                        : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
                    }`}
                  >
                    {/* Card header — always visible */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
                      onClick={() => toggleObjective(obj.id)}
                    >
                      <button
                        onClick={e => { e.stopPropagation(); toggleObjective(obj.id); }}
                        className={`flex-shrink-0 transition-colors ${obj.selected ? (isAuto ? 'text-amber-500' : 'text-brand-600') : 'text-slate-300 hover:text-slate-400'}`}
                      >
                        {obj.selected ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-widest flex-shrink-0 ${phase.objBadge}`}>
                            {obj.codigo}
                          </span>
                          {isAuto && (
                            <span className="text-[7px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-wider flex items-center gap-0.5 flex-shrink-0">
                              <Sparkles size={8} /> Auto
                            </span>
                          )}
                        </div>
                        <p className={`text-sm font-semibold mt-1 leading-snug ${obj.selected ? 'text-slate-900' : 'text-slate-500'}`}>
                          {obj.descripcion}
                        </p>
                      </div>

                      {/* Phase label badge — right side */}
                      <span className={`flex-shrink-0 hidden sm:inline-block text-[9px] font-bold px-2 py-0.5 rounded-full border ${phase.objBadge}`}>
                        {phase.label}
                      </span>
                    </div>

                    {/* Expanded content */}
                    {obj.selected && (
                      <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-3">

                        {/* Fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <label className="block">
                            <span className={labelClass}>Meta</span>
                            <input type="text" value={obj.meta} onChange={e => updateObjective(obj.id, 'meta', e.target.value)} className={inputClass} />
                          </label>
                          <label className="block">
                            <span className={labelClass}>Plazo</span>
                            <input type="date" value={obj.plazo} onChange={e => updateObjective(obj.id, 'plazo', e.target.value)} className={inputClass} />
                          </label>
                          <label className="block">
                            <span className={labelClass}>Responsable</span>
                            <input type="text" value={obj.responsable} onChange={e => updateObjective(obj.id, 'responsable', e.target.value)} className={inputClass} />
                          </label>
                        </div>

                        {/* Suggested actions */}
                        {availableActions.length > 0 && (
                          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap flex items-center gap-1 flex-shrink-0">
                              <ListChecks size={11} /> Sugerencias
                            </span>
                            <select
                              id={`select-${obj.id}`}
                              className="flex-1 text-[10px] bg-white border border-slate-200 rounded-lg px-2 py-1.5 font-semibold text-slate-700 focus:outline-none focus:border-brand-400"
                            >
                              <option value="">Añadir acción recomendada...</option>
                              {availableActions.map((action, idx) => (
                                <option key={idx} value={action}>{action}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => {
                                const sel = document.getElementById(`select-${obj.id}`) as HTMLSelectElement;
                                if (sel.value) { addAction(obj.id, sel.value); sel.value = ''; }
                              }}
                              className="bg-brand-600 text-white px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-brand-700 transition-colors flex-shrink-0"
                            >
                              Añadir
                            </button>
                          </div>
                        )}

                        {/* Action plan */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Plan de Acción</h5>
                            <button
                              onClick={() => addAction(obj.id, 'Nueva acción personalizada...')}
                              className="text-[9px] font-black uppercase text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-100 hover:bg-brand-100 transition-colors flex items-center gap-1"
                            >
                              <Plus size={10} /> Nueva acción
                            </button>
                          </div>

                          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                            <table className="w-full text-left border-collapse">
                              <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                  <th className="px-3 py-2 w-10 text-[8px] font-black text-slate-400 uppercase text-center">ID</th>
                                  <th className="px-3 py-2 text-[8px] font-black text-slate-400 uppercase">Descripción de la acción</th>
                                  <th className="px-3 py-2 w-28 text-[8px] font-black text-slate-400 uppercase text-center">Responsable</th>
                                  <th className="px-3 py-2 w-28 text-[8px] font-black text-slate-400 uppercase text-center">Plazo</th>
                                  <th className="px-3 py-2 w-8"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {obj.actions.length === 0 ? (
                                  <tr>
                                    <td colSpan={5} className="px-4 py-5 text-center text-[10px] text-slate-400 font-medium italic">
                                      Añade acciones usando las sugerencias o crea una nueva acción personalizada
                                    </td>
                                  </tr>
                                ) : (
                                  obj.actions.map(action => (
                                    <tr key={action.id} className="hover:bg-slate-50 transition-colors">
                                      <td className="px-3 py-2 text-center">
                                        <span className="text-[8px] font-black text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-100">
                                          {action.codigo}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2">
                                        <input
                                          type="text"
                                          value={action.descripcion}
                                          onChange={e => updateAction(obj.id, action.id, 'descripcion', e.target.value)}
                                          className="w-full text-[11px] border-transparent bg-transparent focus:ring-0 focus:outline-none font-medium text-slate-800 placeholder:text-slate-300"
                                          placeholder="Describir acción..."
                                        />
                                      </td>
                                      <td className="px-2 py-2">
                                        <input
                                          type="text"
                                          value={action.responsable}
                                          onChange={e => updateAction(obj.id, action.id, 'responsable', e.target.value)}
                                          className="w-full text-[10px] border border-slate-200 bg-white rounded-lg px-2 py-1 font-semibold text-slate-600 focus:border-brand-400 focus:outline-none text-center"
                                          placeholder="Nombre"
                                        />
                                      </td>
                                      <td className="px-2 py-2">
                                        <input
                                          type="date"
                                          value={action.plazo}
                                          onChange={e => updateAction(obj.id, action.id, 'plazo', e.target.value)}
                                          className="w-full text-[10px] border border-slate-200 bg-white rounded-lg px-2 py-1 font-semibold text-slate-600 focus:border-brand-400 focus:outline-none text-center"
                                        />
                                      </td>
                                      <td className="px-2 py-2 text-center">
                                        <button onClick={() => removeAction(obj.id, action.id)} className="text-slate-300 hover:text-red-400 transition-colors p-1">
                                          <Trash2 size={13} />
                                        </button>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>
        );
      })}

      {/* Fallback for objectives not belonging to any defined phase */}
      {orphans.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Otros objetivos</h3>
          </div>
          {orphans.map(obj => {
            const availableActions = OBJECTIVE_ACTIONS[obj.id] || [];
            return (
              <div key={obj.id} className={`rounded-xl border transition-all ${obj.selected ? 'border-brand-300 bg-brand-50/20' : 'border-slate-200 bg-white shadow-sm'}`}>
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => toggleObjective(obj.id)}>
                  <button className={`flex-shrink-0 ${obj.selected ? 'text-brand-600' : 'text-slate-300'}`}>
                    {obj.selected ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                  </button>
                  <div className="flex-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{obj.codigo}</span>
                    <p className={`text-sm font-semibold mt-0.5 ${obj.selected ? 'text-slate-900' : 'text-slate-500'}`}>{obj.descripcion}</p>
                  </div>
                </div>
                {obj.selected && (
                  <div className="px-4 pb-4 space-y-4 border-t border-slate-100 pt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className="block">
                        <span className={labelClass}>Meta</span>
                        <input type="text" value={obj.meta} onChange={e => updateObjective(obj.id, 'meta', e.target.value)} className={inputClass} />
                      </label>
                      <label className="block">
                        <span className={labelClass}>Plazo</span>
                        <input type="date" value={obj.plazo} onChange={e => updateObjective(obj.id, 'plazo', e.target.value)} className={inputClass} />
                      </label>
                      <label className="block">
                        <span className={labelClass}>Responsable</span>
                        <input type="text" value={obj.responsable} onChange={e => updateObjective(obj.id, 'responsable', e.target.value)} className={inputClass} />
                      </label>
                    </div>
                    {availableActions.length > 0 && (
                      <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1 flex-shrink-0">
                          <ListChecks size={11} /> Sugerencias
                        </span>
                        <select id={`select-${obj.id}`} className="flex-1 text-[10px] bg-white border border-slate-200 rounded-lg px-2 py-1.5 font-semibold text-slate-700 focus:outline-none">
                          <option value="">Añadir acción recomendada...</option>
                          {availableActions.map((a, i) => <option key={i} value={a}>{a}</option>)}
                        </select>
                        <button onClick={() => { const s = document.getElementById(`select-${obj.id}`) as HTMLSelectElement; if (s.value) { addAction(obj.id, s.value); s.value = ''; } }} className="bg-brand-600 text-white px-3 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-brand-700 flex-shrink-0">Añadir</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
