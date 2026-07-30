import React, { useState } from 'react';
import { DiagnosisItem, SistemaMedicionTipo } from '../types';
import {
  Lightbulb, AlertCircle, ChevronDown, Scale, Cpu, CalendarRange, Eye, Building2
} from 'lucide-react';
import {
  Target, Package, ChefHat, UtensilsCrossed, Layers, BarChart2, GraduationCap, Leaf
} from 'lucide-react';

interface DiagnosisFormProps {
  data: DiagnosisItem[];
  onChange: (data: DiagnosisItem[]) => void;
  scope?: 'individual' | 'corporate';
  hotels?: { nombreComercial: string }[];
}

// ─── Sistemáticas de medición ─────────────────────────────────────────────────
const METODOS_MEDICION: {
  tipo: SistemaMedicionTipo; label: string; short: string;
  Icon: React.ElementType; color: string; bg: string; border: string; selBorder: string; selBg: string;
}[] = [
  { tipo: 'bascula', label: 'Báscula manual', short: 'Báscula',
    Icon: Scale,
    color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200',
    selBorder: 'border-sky-500', selBg: 'bg-sky-100' },
  { tipo: 'ia', label: 'Sistema IA', short: 'IA',
    Icon: Cpu,
    color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200',
    selBorder: 'border-violet-500', selBg: 'bg-violet-100' },
  { tipo: 'p1', label: 'Campañas de pesaje (P1)', short: 'P1',
    Icon: CalendarRange,
    color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200',
    selBorder: 'border-amber-500', selBg: 'bg-amber-100' },
  { tipo: 'p3', label: 'Estimación volumétrica (P3)', short: 'P3',
    Icon: Eye,
    color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200',
    selBorder: 'border-teal-500', selBg: 'bg-teal-100' },
];

const STAGE_CONFIG = [
  {
    etapa: 'DIRECCIÓN Y ESTRATEGIA',
    num: 0, label: 'Dirección y Estrategia',
    description: 'Compromisos de gestión, política PPDA y estructura organizativa',
    Icon: Target,
    header: 'bg-purple-50 border-purple-200',
    iconBox: 'bg-purple-100 text-purple-600',
    title: 'text-purple-700',
    badge: 'bg-purple-100 text-purple-700 border-purple-200',
    accent: 'border-l-purple-300',
  },
  {
    etapa: 'COMPRAS Y ALMACENAMIENTO',
    num: 1, label: 'Compras y Almacenamiento',
    description: 'Gestión de entradas, stock y caducidades',
    Icon: Package,
    header: 'bg-sky-50 border-sky-200',
    iconBox: 'bg-sky-100 text-sky-600',
    title: 'text-sky-700',
    badge: 'bg-sky-100 text-sky-700 border-sky-200',
    accent: 'border-l-sky-300',
  },
  {
    etapa: 'PREPARACIÓN',
    num: 2, label: 'Preparación y Producción',
    description: 'Mermas en cocina, mise en place y aprovechamiento de subproductos',
    Icon: ChefHat,
    header: 'bg-amber-50 border-amber-200',
    iconBox: 'bg-amber-100 text-amber-600',
    title: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    accent: 'border-l-amber-300',
  },
  {
    etapa: 'SERVICIO ALIMENTOS',
    num: 3, label: 'Servicio Alimentos',
    description: 'Restos en platos, raciones y política doggy bag',
    Icon: UtensilsCrossed,
    header: 'bg-emerald-50 border-emerald-200',
    iconBox: 'bg-emerald-100 text-emerald-600',
    title: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    accent: 'border-l-emerald-300',
  },
  {
    etapa: 'FIN SERVICIO / BUFFET',
    num: 4, label: 'Fin Servicio / Buffet',
    description: 'Excedentes de buffet, showcooking y snack bar',
    Icon: Layers,
    header: 'bg-orange-50 border-orange-200',
    iconBox: 'bg-orange-100 text-orange-600',
    title: 'text-orange-700',
    badge: 'bg-orange-100 text-orange-700 border-orange-200',
    accent: 'border-l-orange-300',
  },
  {
    etapa: 'MEDICIÓN Y CONTROL',
    num: 5, label: 'Medición y Control',
    description: 'Sistemas de pesaje, registros e indicadores PPDA',
    Icon: BarChart2,
    header: 'bg-violet-50 border-violet-200',
    iconBox: 'bg-violet-100 text-violet-600',
    title: 'text-violet-700',
    badge: 'bg-violet-100 text-violet-700 border-violet-200',
    accent: 'border-l-violet-300',
  },
  {
    etapa: 'FORMACIÓN Y SENSIBILIZACIÓN',
    num: 6, label: 'Formación y Sensibilización',
    description: 'Capacitación del personal y comunicación con clientes',
    Icon: GraduationCap,
    header: 'bg-teal-50 border-teal-200',
    iconBox: 'bg-teal-100 text-teal-600',
    title: 'text-teal-700',
    badge: 'bg-teal-100 text-teal-700 border-teal-200',
    accent: 'border-l-teal-300',
  },
  {
    etapa: 'VALORIZACIÓN',
    num: 7, label: 'Valorización',
    description: 'Donación de excedentes y gestión de residuos orgánicos',
    Icon: Leaf,
    header: 'bg-green-50 border-green-200',
    iconBox: 'bg-green-100 text-green-600',
    title: 'text-green-700',
    badge: 'bg-green-100 text-green-700 border-green-200',
    accent: 'border-l-green-300',
  },
];

export const DiagnosisForm: React.FC<DiagnosisFormProps> = ({ data, onChange, scope = 'individual', hotels = [] }) => {
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set());
  const [expandedMedicion, setExpandedMedicion] = useState<Set<string>>(new Set());
  const isCorporate = scope === 'corporate' && hotels.length > 0;

  const toggleStage = (etapa: string) => {
    setCollapsedStages(prev => {
      const next = new Set(prev);
      if (next.has(etapa)) next.delete(etapa); else next.add(etapa);
      return next;
    });
  };

  const toggleMedicion = (id: string) => {
    setExpandedMedicion(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const updateItem = (id: string, field: keyof DiagnosisItem, value: any) => {
    onChange(data.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  // Actualiza la sistemática para el plan individual
  const setSistemaMedicion = (id: string, tipo: SistemaMedicionTipo) => {
    onChange(data.map(item => item.id === id ? { ...item, sistemaMedicion: tipo } : item));
  };

  // Actualiza la sistemática para un hotel concreto en plan corporativo
  const setSistemaMedicionHotel = (id: string, hotelNombre: string, tipo: SistemaMedicionTipo) => {
    onChange(data.map(item => {
      if (item.id !== id) return item;
      const prev = item.sistemaMedicionPorHotel ?? {};
      return { ...item, sistemaMedicionPorHotel: { ...prev, [hotelNombre]: tipo } };
    }));
  };

  return (
    <div className="space-y-4">
      {STAGE_CONFIG.map((stage) => {
        const items = data.filter(i => i.etapa === stage.etapa);
        if (items.length === 0) return null;

        const { Icon } = stage;
        const isCollapsed = collapsedStages.has(stage.etapa);
        const filledCount = items.filter(i => i.genera || i.prioridad).length;

        return (
          <div key={stage.etapa} className="space-y-0">

            {/* Phase header — clickable */}
            <button
              type="button"
              onClick={() => toggleStage(stage.etapa)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all cursor-pointer hover:brightness-95 ${stage.header} ${!isCollapsed ? 'rounded-b-none border-b-0' : ''}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${stage.iconBox}`}>
                <Icon size={20} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[9px] font-black uppercase tracking-widest ${stage.title}`}>
                    {stage.num === 0 ? 'Gestión' : `Fase ${stage.num}`}
                  </span>
                  <span className="text-slate-300">·</span>
                  <h3 className="text-sm font-black text-slate-800 tracking-tight">{stage.label}</h3>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{stage.description}</p>
              </div>
              <div className={`flex-shrink-0 text-xs font-black px-2.5 py-1 rounded-full border ${stage.badge}`}>
                {filledCount}/{items.length}
              </div>
              <ChevronDown
                size={16}
                className={`flex-shrink-0 transition-transform duration-200 ${stage.title} ${isCollapsed ? '-rotate-90' : ''}`}
              />
            </button>

            {/* Items table */}
            {!isCollapsed && (
              <div className={`rounded-b-2xl border border-t-0 overflow-hidden bg-white ${stage.header.split(' ')[1]}`}>
                <div className={`border-l-4 ${stage.accent}`}>
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-50/80 border-b border-slate-100 text-slate-400 text-[8px] tracking-[0.1em] uppercase font-black">
                      <tr>
                        <th className="px-4 py-2.5 w-2/5">Elemento Auditado</th>
                        <th className="px-4 py-2.5">Situación Observada</th>
                        <th className="px-4 py-2.5 text-center w-16">Prioridad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {items.map(item => {
                        const triggersProposal = item.genera && item.prioridad === '1';
                        const isExpanded = expandedMedicion.has(item.id);
                        const metodoActual = METODOS_MEDICION.find(m => m.tipo === item.sistemaMedicion);
                        const configuredHotels = isCorporate
                          ? hotels.filter(h => item.sistemaMedicionPorHotel?.[h.nombreComercial])
                          : [];

                        return (
                          <React.Fragment key={item.id}>
                            <tr className={`transition-colors ${triggersProposal ? 'bg-amber-50/30' : 'hover:bg-slate-50/60'}`}>
                              {/* Elemento */}
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-bold text-slate-800 leading-tight flex items-center gap-2 flex-wrap">
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
                              {/* Situación Observada — genera se deduce automáticamente */}
                              <td className="px-4 py-3">
                                <input
                                  type="text"
                                  value={item.causa}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    onChange(data.map(i => i.id === item.id
                                      ? { ...i, causa: val, genera: val.trim() !== '' || i.prioridad !== '' }
                                      : i
                                    ));
                                  }}
                                  placeholder="Describir situación observada..."
                                  className="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-[10px] italic font-bold text-slate-700 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/10 transition-all"
                                />
                              </td>
                              {/* Prioridad */}
                              <td className="px-4 py-3 text-center">
                                <select
                                  value={item.prioridad}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    onChange(data.map(i => i.id === item.id
                                      ? { ...i, prioridad: val as any, genera: val !== '' || i.causa.trim() !== '' }
                                      : i
                                    ));
                                  }}
                                  className={`w-12 p-1.5 border rounded-lg text-[10px] font-black text-center transition-all bg-white ${
                                    item.prioridad === '1' ? 'text-red-600 border-red-300'
                                    : item.prioridad === '2' ? 'text-orange-500 border-orange-200'
                                    : 'text-slate-500 border-slate-200'
                                  }`}
                                >
                                  <option value="">-</option>
                                  <option value="1">1</option>
                                  <option value="2">2</option>
                                  <option value="3">3</option>
                                </select>
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
