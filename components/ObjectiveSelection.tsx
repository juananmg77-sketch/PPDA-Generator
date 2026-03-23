
import React from 'react';
import { Objective, SpecificAction } from '../types';
import { OBJECTIVE_ACTIONS } from '../constants';
import { CheckCircle2, Circle, ListChecks, Plus, Trash2, Sparkles } from 'lucide-react';

interface ObjectiveSelectionProps {
  objectives: Objective[];
  setObjectives: (objs: Objective[]) => void;
}

export const ObjectiveSelection: React.FC<ObjectiveSelectionProps> = ({ objectives, setObjectives }) => {
  
  const toggleObjective = (id: string) => {
    setObjectives(objectives.map(o => o.id === id ? { ...o, selected: !o.selected } : o));
  };

  const updateObjective = (id: string, field: keyof Objective, value: string) => {
    setObjectives(objectives.map(o => o.id === id ? { ...o, [field]: value } : o));
  };

  const addAction = (objectiveId: string, description: string) => {
    const parentObjective = objectives.find(o => o.id === objectiveId);
    if (!parentObjective) return;

    const currentActionsCount = parentObjective.actions.length;
    const suffix = String.fromCharCode(97 + currentActionsCount);
    const code = `${parentObjective.codigo}${suffix}`;
    
    const newAction: SpecificAction = {
      id: Date.now().toString() + Math.random().toString(),
      codigo: code,
      descripcion: description,
      responsable: parentObjective.responsable || 'Responsable',
      plazo: ''
    };
    
    setObjectives(objectives.map(o => {
      if (o.id === objectiveId) {
        return { ...o, actions: [...o.actions, newAction] };
      }
      return o;
    }));
  };

  const updateAction = (objectiveId: string, actionId: string, field: keyof SpecificAction, value: string) => {
    setObjectives(objectives.map(o => {
      if (o.id === objectiveId) {
        const newActions = o.actions.map(a => a.id === actionId ? { ...a, [field]: value } : a);
        return { ...o, actions: newActions };
      }
      return o;
    }));
  };

  const removeAction = (objectiveId: string, actionId: string) => {
    setObjectives(objectives.map(o => {
      if (o.id === objectiveId) {
        const filteredActions = o.actions.filter(a => a.id !== actionId);
        const reindexedActions = filteredActions.map((action, index) => ({
           ...action,
           codigo: `${o.codigo}${String.fromCharCode(97 + index)}`
        }));
        return { ...o, actions: reindexedActions };
      }
      return o;
    }));
  };

  const inputElegantClass = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-900 text-[11px] shadow-sm transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 focus:outline-none placeholder:text-slate-400 font-bold";
  const labelClass = "text-[8px] uppercase tracking-wider font-black text-slate-500 ml-1";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3">
        {objectives.map(obj => {
          const availableActions = OBJECTIVE_ACTIONS[obj.id] || [];
          const isAuto = obj.isAutoProposed;

          return (
            <div 
              key={obj.id} 
              className={`rounded-xl border transition-all duration-200 ${
                  obj.selected 
                  ? (isAuto ? 'border-amber-300 bg-amber-50/20' : 'border-brand-300 bg-brand-50/20') 
                  : 'border-slate-200 bg-white hover:border-slate-300 shadow-sm'
              }`}
            >
              <div className="p-3 flex items-start gap-3">
                <button onClick={() => toggleObjective(obj.id)} className={`mt-0.5 flex-shrink-0 transition-transform ${obj.selected ? (isAuto ? 'text-amber-600' : 'text-brand-600') : 'text-slate-300'}`}>
                  {obj.selected ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </button>
                
                <div className="flex-1">
                  <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleObjective(obj.id)}>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{obj.codigo}</span>
                      <h4 className={`text-sm font-black tracking-tight leading-tight ${obj.selected ? 'text-slate-900' : 'text-slate-400'}`}>
                        {obj.descripcion}
                      </h4>
                      {isAuto && (
                        <span className="text-[7px] bg-amber-600 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-wider flex items-center gap-1">
                          <Sparkles size={8} /> Auto
                        </span>
                      )}
                    </div>
                  </div>

                  {obj.selected && (
                    <div className="mt-3 space-y-4">
                      {/* Fila de campos principales compressed */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/40 p-2 rounded-lg border border-slate-100">
                        <label className="block">
                          <span className={labelClass}>Meta</span>
                          <input type="text" value={obj.meta} onChange={(e) => updateObjective(obj.id, 'meta', e.target.value)} className={inputElegantClass} />
                        </label>
                        <label className="block">
                          <span className={labelClass}>Plazo OE</span>
                          <input type="date" value={obj.plazo} onChange={(e) => updateObjective(obj.id, 'plazo', e.target.value)} className={inputElegantClass} />
                        </label>
                        <label className="block">
                          <span className={labelClass}>Responsable</span>
                          <input type="text" value={obj.responsable} onChange={(e) => updateObjective(obj.id, 'responsable', e.target.value)} className={inputElegantClass} />
                        </label>
                      </div>
                       
                       {/* Selector de acciones predefinidas ultra-compacto */}
                       {availableActions.length > 0 && (
                          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap flex items-center gap-1">
                              <ListChecks size={10} /> Sugerencias:
                            </span>
                            <select 
                              className="flex-1 text-[10px] bg-white border border-slate-300 rounded-md px-2 py-1 font-bold text-slate-700 focus:outline-none"
                              id={`select-${obj.id}`}
                            >
                              <option value="">Añadir acción recomendada...</option>
                              {availableActions.map((action, idx) => (
                                <option key={idx} value={action}>{action}</option>
                              ))}
                            </select>
                            <button 
                              onClick={() => {
                                const select = document.getElementById(`select-${obj.id}`) as HTMLSelectElement;
                                if (select.value) {
                                  addAction(obj.id, select.value);
                                  select.value = "";
                                }
                              }}
                              className="bg-brand-600 text-white px-3 py-1 rounded-md font-black text-[9px] uppercase tracking-widest hover:bg-brand-700 shadow-sm"
                            >
                              Añadir
                            </button>
                          </div>
                       )}

                       {/* Tabla de acciones detallada densificada */}
                       <div className="space-y-1.5">
                         <div className="flex justify-between items-center px-1">
                            <h5 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Plan de Acción</h5>
                            <button onClick={() => addAction(obj.id, "Nueva acción personalizada...")} className="text-[8px] font-black uppercase text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-100 hover:bg-brand-100 transition-all flex items-center gap-1"><Plus size={10} /> Nueva</button>
                         </div>

                         <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                           <table className="w-full text-left border-collapse">
                             <thead className="bg-slate-50 border-b border-slate-100">
                               <tr>
                                 <th className="p-2 w-8 text-[8px] font-black text-slate-400 text-center uppercase">ID</th>
                                 <th className="p-2 text-[8px] font-black text-slate-400 uppercase">Descripción de la Acción</th>
                                 <th className="p-2 w-24 text-[8px] font-black text-slate-400 uppercase text-center">Responsable</th>
                                 <th className="p-2 w-24 text-[8px] font-black text-slate-400 uppercase text-center">Plazo</th>
                                 <th className="p-2 w-8"></th>
                               </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-50">
                               {obj.actions.length === 0 ? (
                                 <tr>
                                   <td colSpan={5} className="p-4 text-center text-[9px] text-slate-400 font-bold uppercase tracking-widest italic">Define acciones para este objetivo</td>
                                 </tr>
                               ) : (
                                 obj.actions.map((action) => (
                                   <tr key={action.id} className="hover:bg-slate-50 transition-colors">
                                     <td className="p-1.5 text-center">
                                       <span className="text-[8px] font-black text-brand-700 bg-white px-1 py-0.5 rounded border border-brand-100">{action.codigo}</span>
                                     </td>
                                     <td className="p-1.5">
                                       <input 
                                          type="text" 
                                          value={action.descripcion} 
                                          onChange={(e) => updateAction(obj.id, action.id, 'descripcion', e.target.value)} 
                                          className="w-full text-[10px] border-transparent bg-transparent p-0 focus:ring-0 font-bold text-slate-800 placeholder:text-slate-300" 
                                          placeholder="Describir acción..." 
                                        />
                                     </td>
                                     <td className="p-1.5">
                                       <input 
                                          type="text" 
                                          value={action.responsable} 
                                          onChange={(e) => updateAction(obj.id, action.id, 'responsable', e.target.value)} 
                                          className="w-full text-[9px] border-slate-200 bg-white rounded px-1.5 py-0.5 font-bold text-slate-600 focus:border-brand-400 text-center border" 
                                          placeholder="Nombre" 
                                        />
                                     </td>
                                     <td className="p-1.5">
                                       <input 
                                          type="date" 
                                          value={action.plazo} 
                                          onChange={(e) => updateAction(obj.id, action.id, 'plazo', e.target.value)} 
                                          className="w-full text-[9px] border-slate-200 bg-white rounded px-1.5 py-0.5 font-bold text-slate-600 focus:border-brand-400 text-center border" 
                                        />
                                     </td>
                                     <td className="p-1.5 text-center">
                                       <button onClick={() => removeAction(obj.id, action.id)} className="text-slate-300 hover:text-red-500 p-1"><Trash2 size={12} /></button>
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
