import React from 'react';
import { DiagnosisItem } from '../types';
import { Lightbulb, AlertCircle } from 'lucide-react';

interface DiagnosisFormProps {
  data: DiagnosisItem[];
  onChange: (data: DiagnosisItem[]) => void;
}

export const DiagnosisForm: React.FC<DiagnosisFormProps> = ({ data, onChange }) => {
  
  const updateItem = (id: string, field: keyof DiagnosisItem, value: any) => {
    onChange(data.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const stages = Array.from(new Set(data.map(item => item.etapa)));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[8px] tracking-[0.1em] uppercase font-black">
            <tr>
              <th className="px-4 py-3 w-2/5">Elemento Auditado</th>
              <th className="px-4 py-3 text-center w-20">Aplica</th>
              <th className="px-4 py-3 w-32">Nivel</th>
              <th className="px-4 py-3">Causa Raíz</th>
              <th className="px-4 py-3 text-center w-20">Prioridad</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stages.map((stage, sIdx) => {
              const stageItems = data.filter(i => i.etapa === stage);
              const stageNumber = sIdx < 10 ? `0${sIdx}` : sIdx;

              return (
                <React.Fragment key={stage}>
                  <tr className="bg-slate-50/50">
                    <td colSpan={5} className="px-4 py-2 font-black text-slate-800 border-y border-slate-100 flex items-center gap-2">
                      <span className="text-brand-600 text-[10px] font-mono">{stageNumber}</span>
                      <span className="uppercase tracking-widest text-[9px]">{stage}</span>
                    </td>
                  </tr>
                  {stageItems.map(item => {
                    const triggersProposal = item.genera && (item.nivel === 'Alto' || item.prioridad === '1');
                    
                    return (
                      <tr key={item.id} className={`transition-colors ${triggersProposal ? 'bg-amber-50/20' : 'hover:bg-slate-50/50'}`}>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-slate-800 leading-tight flex items-center gap-2">
                                {item.elemento}
                                {item.isMandatory && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-red-100 text-red-700 border border-red-200 whitespace-nowrap">
                                        <AlertCircle size={8} /> Ley 1/2025
                                    </span>
                                )}
                            </span>
                            {triggersProposal && (
                              <span className="flex items-center gap-1 text-[8px] text-amber-700 font-black uppercase tracking-wider">
                                <Lightbulb size={10} /> Auto-Propuesta OE
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <input 
                            type="checkbox" 
                            checked={item.genera} 
                            onChange={(e) => updateItem(item.id, 'genera', e.target.checked)}
                            className="w-4 h-4 rounded text-brand-600 border-slate-300 transition-all cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <select 
                            value={item.nivel} 
                            onChange={(e) => updateItem(item.id, 'nivel', e.target.value)}
                            className={`w-full p-1.5 border rounded-lg text-[10px] font-black tracking-wider uppercase transition-all bg-white ${
                              item.nivel === 'Alto' 
                                ? 'text-amber-700 border-amber-300' 
                                : item.nivel === 'Medio'
                                ? 'text-yellow-600 border-yellow-200'
                                : 'text-slate-600 border-slate-200'
                            }`}
                          >
                            <option value="">Nivel...</option>
                            <option value="Bajo">Bajo</option>
                            <option value="Medio">Medio</option>
                            <option value="Alto">Alto</option>
                          </select>
                        </td>
                        <td className="px-4 py-2.5">
                          <input 
                            type="text" 
                            value={item.causa} 
                            onChange={(e) => updateItem(item.id, 'causa', e.target.value)}
                            placeholder="Describir causa..."
                            className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-[10px] italic font-bold text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/10 transition-all"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <select 
                            value={item.prioridad} 
                            onChange={(e) => updateItem(item.id, 'prioridad', e.target.value)}
                            className={`w-12 p-1.5 border rounded-lg text-[10px] font-black text-center transition-all bg-white ${
                              item.prioridad === '1' 
                                ? 'text-red-600 border-red-300' 
                                : item.prioridad === '2'
                                ? 'text-orange-500 border-orange-200'
                                : 'text-slate-600 border-slate-300'
                            }`}
                          >
                            <option value="">-</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};