import React from 'react';
import { MeasurementConfig } from '../types';
import { Scale, FileBarChart, RefreshCw, CheckSquare, Clock, User } from 'lucide-react';

interface MeasurementFormProps {
  config: MeasurementConfig;
  setConfig: (config: MeasurementConfig) => void;
}

const inputElegantClass = "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 text-xs shadow-sm transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/5 focus:outline-none placeholder:text-slate-400 font-bold";
const labelClass = "text-[9px] uppercase tracking-[0.1em] font-black text-slate-500 ml-1";

export const MeasurementForm: React.FC<MeasurementFormProps> = ({ config, setConfig }) => {
  
  const toggleKPI = (id: string) => {
    const updatedKPIs = config.kpis.map(kpi => 
      kpi.id === id ? { ...kpi, selected: !kpi.selected } : kpi
    );
    setConfig({ ...config, kpis: updatedKPIs });
  };

  const updateKPI = (id: string, field: 'frecuencia' | 'responsable' | 'lineaBase', value: string) => {
    const updatedKPIs = config.kpis.map(kpi => 
      kpi.id === id ? { ...kpi, [field]: value } : kpi
    );
    setConfig({ ...config, kpis: updatedKPIs });
  };

  const updateReporting = (field: 'frecuencia' | 'responsable', value: string) => {
    setConfig({ ...config, reporting: { ...config.reporting, [field]: value } });
  };

  const updateReview = (field: 'frecuencia' | 'responsable', value: string) => {
    setConfig({ ...config, annualReview: { ...config.annualReview, [field]: value } });
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* SECCIÓN 1: SISTEMA DE SEGUIMIENTO (KPIs) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2 pb-2 border-b border-slate-100">
           <Scale size={16} className="text-brand-600" /> Sistema de Seguimiento (Indicadores Clave)
        </h3>
        <p className="text-xs text-slate-500 mb-6 font-medium">Selecciona los indicadores (KPIs) que se emplearán para medir el desempeño del Plan y asigna responsable y frecuencia.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {config.kpis.map((kpi) => (
            <div 
              key={kpi.id} 
              className={`relative rounded-xl border p-4 transition-all ${
                kpi.selected 
                  ? 'border-brand-500 bg-brand-50/30 ring-1 ring-brand-500/20' 
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                 <div 
                    onClick={() => toggleKPI(kpi.id)}
                    className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border cursor-pointer transition-colors ${
                       kpi.selected ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-300 hover:border-brand-400'
                    }`}
                 >
                    {kpi.selected && <CheckSquare size={14} />}
                 </div>
                 <div className="flex-1 cursor-pointer" onClick={() => toggleKPI(kpi.id)}>
                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">{kpi.nombre}</span>
                 </div>
              </div>

              {kpi.selected && (
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-8 animate-in slide-in-from-top-2">
                    <label className="block">
                       <span className={labelClass}>Frecuencia</span>
                       <div className="relative">
                          <Clock size={12} className="absolute top-2.5 left-2.5 text-slate-400" />
                          <input 
                            type="text" 
                            value={kpi.frecuencia} 
                            onChange={(e) => updateKPI(kpi.id, 'frecuencia', e.target.value)} 
                            className={`${inputElegantClass} pl-8`}
                            placeholder="Ej: Diaria" 
                          />
                       </div>
                    </label>
                    <label className="block">
                       <span className={labelClass}>Responsable</span>
                       <div className="relative">
                          <User size={12} className="absolute top-2.5 left-2.5 text-slate-400" />
                          <input 
                            type="text" 
                            value={kpi.responsable} 
                            onChange={(e) => updateKPI(kpi.id, 'responsable', e.target.value)} 
                            className={`${inputElegantClass} pl-8`}
                            placeholder="Ej: Chef" 
                          />
                       </div>
                    </label>
                    <label className="block sm:col-span-2 mt-2">
                       <span className={labelClass}>Línea Base (Valor actual)</span>
                       <div className="relative">
                          <input 
                            type="text" 
                            value={kpi.lineaBase || ''} 
                            onChange={(e) => updateKPI(kpi.id, 'lineaBase', e.target.value)} 
                            className={inputElegantClass}
                            placeholder={kpi.id === 'kpi_1' ? "Ej: 1200 Kg/año" : "Ej: 0.15 Kg/comensal"} 
                          />
                       </div>
                    </label>
                 </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* SECCIÓN 2: REPORTING */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2 pb-2 border-b border-slate-100">
               <FileBarChart size={16} className="text-brand-600" /> Reporting a Dirección
            </h3>
            <div className="space-y-4 flex-1">
                <p className="text-xs text-slate-500 font-medium">Definición de informes internos para la toma de decisiones basada en datos.</p>
                <div className="grid grid-cols-1 gap-4">
                    <label className="block">
                       <span className={labelClass}>Frecuencia del Informe</span>
                       <input 
                         type="text" 
                         value={config.reporting.frecuencia} 
                         onChange={(e) => updateReporting('frecuencia', e.target.value)}
                         className={inputElegantClass} 
                       />
                    </label>
                    <label className="block">
                       <span className={labelClass}>Responsable Elaboración</span>
                       <input 
                         type="text" 
                         value={config.reporting.responsable} 
                         onChange={(e) => updateReporting('responsable', e.target.value)}
                         className={inputElegantClass} 
                       />
                    </label>
                </div>
            </div>
          </div>

          {/* SECCIÓN 3: REVISIÓN ANUAL */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2 pb-2 border-b border-slate-100">
               <RefreshCw size={16} className="text-brand-600" /> Revisión Anual del Plan
            </h3>
            <div className="space-y-4 flex-1">
                <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg">
                    <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wide">
                        Procedimiento obligatorio: Actualización basada en nuevos diagnósticos.
                    </p>
                </div>
                <div className="grid grid-cols-1 gap-4">
                    <label className="block">
                       <span className={labelClass}>Frecuencia Revisión</span>
                       <input 
                         type="text" 
                         value={config.annualReview.frecuencia} 
                         onChange={(e) => updateReview('frecuencia', e.target.value)}
                         className={inputElegantClass} 
                         disabled // Generalmente es anual fijo, pero dejamos el input visualmente
                       />
                    </label>
                    <label className="block">
                       <span className={labelClass}>Responsable Aprobación</span>
                       <input 
                         type="text" 
                         value={config.annualReview.responsable} 
                         onChange={(e) => updateReview('responsable', e.target.value)}
                         className={inputElegantClass} 
                       />
                    </label>
                </div>
            </div>
          </div>
      </div>
    </div>
  );
};