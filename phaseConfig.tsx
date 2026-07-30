import { ElementType } from 'react';
import { Package, ChefHat, UtensilsCrossed, BarChart2, GraduationCap, Leaf } from 'lucide-react';

export interface PhaseConfig {
  id: string;
  num: number;
  label: string;
  description: string;
  Icon: ElementType;
  objectiveIds: string[];
  header: string;
  iconBox: string;
  title: string;
  badge: string;
  cardSel: string;
  objBadge: string;
  accentBar: string;
  accentBorder: string;
}

export const PHASES: PhaseConfig[] = [
  {
    id: 'compras', num: 1,
    label: 'Compras y Almacenamiento',
    description: 'Optimiza la entrada de producto y minimiza pérdidas en origen',
    Icon: Package,
    objectiveIds: ['1', '2', '3', '16', '19'],
    header: 'bg-sky-50 border-sky-200',
    iconBox: 'bg-sky-100 text-sky-600',
    title: 'text-sky-700',
    badge: 'bg-sky-100 text-sky-700 border-sky-200',
    cardSel: 'border-sky-300 bg-sky-50/30',
    objBadge: 'bg-sky-50 text-sky-600 border-sky-200',
    accentBar: 'bg-sky-400',
    accentBorder: 'border-l-sky-300',
  },
  {
    id: 'produccion', num: 2,
    label: 'Preparación y Producción',
    description: 'Reduce mermas en cocina y aprovecha al máximo los subproductos',
    Icon: ChefHat,
    objectiveIds: ['4', '5', '17', '20'],
    header: 'bg-amber-50 border-amber-200',
    iconBox: 'bg-amber-100 text-amber-600',
    title: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    cardSel: 'border-amber-300 bg-amber-50/30',
    objBadge: 'bg-amber-50 text-amber-600 border-amber-200',
    accentBar: 'bg-amber-400',
    accentBorder: 'border-l-amber-300',
  },
  {
    id: 'servicio', num: 3,
    label: 'Servicio',
    description: 'Controla el desperdicio en buffet, sala y comedor de personal',
    Icon: UtensilsCrossed,
    objectiveIds: ['6', '7', '8', '9', '15'],
    header: 'bg-emerald-50 border-emerald-200',
    iconBox: 'bg-emerald-100 text-emerald-600',
    title: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    cardSel: 'border-emerald-300 bg-emerald-50/30',
    objBadge: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    accentBar: 'bg-emerald-400',
    accentBorder: 'border-l-emerald-300',
  },
  {
    id: 'medicion', num: 4,
    label: 'Medición y Seguimiento',
    description: 'Implanta indicadores y sistemas de control del desperdicio',
    Icon: BarChart2,
    objectiveIds: ['10', '11', '18'],
    header: 'bg-violet-50 border-violet-200',
    iconBox: 'bg-violet-100 text-violet-600',
    title: 'text-violet-700',
    badge: 'bg-violet-100 text-violet-700 border-violet-200',
    cardSel: 'border-violet-300 bg-violet-50/30',
    objBadge: 'bg-violet-50 text-violet-600 border-violet-200',
    accentBar: 'bg-violet-400',
    accentBorder: 'border-l-violet-300',
  },
  {
    id: 'formacion', num: 5,
    label: 'Formación',
    description: 'Capacita al 100% del personal en la gestión del desperdicio alimentario',
    Icon: GraduationCap,
    objectiveIds: ['12'],
    header: 'bg-teal-50 border-teal-200',
    iconBox: 'bg-teal-100 text-teal-600',
    title: 'text-teal-700',
    badge: 'bg-teal-100 text-teal-700 border-teal-200',
    cardSel: 'border-teal-300 bg-teal-50/30',
    objBadge: 'bg-teal-50 text-teal-600 border-teal-200',
    accentBar: 'bg-teal-400',
    accentBorder: 'border-l-teal-300',
  },
  {
    id: 'valorizacion', num: 6,
    label: 'Valorización y Salida',
    description: 'Dona excedentes aptos y valoriza los residuos orgánicos no evitables',
    Icon: Leaf,
    objectiveIds: ['13', '14'],
    header: 'bg-green-50 border-green-200',
    iconBox: 'bg-green-100 text-green-600',
    title: 'text-green-700',
    badge: 'bg-green-100 text-green-700 border-green-200',
    cardSel: 'border-green-300 bg-green-50/30',
    objBadge: 'bg-green-50 text-green-600 border-green-200',
    accentBar: 'bg-green-400',
    accentBorder: 'border-l-green-300',
  },
];

export const getPhaseForObjective = (objectiveId: string): PhaseConfig | undefined =>
  PHASES.find(p => p.objectiveIds.includes(objectiveId));

// ─── INTELIER PHASES ─────────────────────────────────────────────────────────
// Mapping correcto para el plan corporativo INTELIER (IDs 1-20)
export const INTELIER_PHASES: PhaseConfig[] = [
  {
    id: 'compras', num: 1,
    label: 'Compras y Almacenamiento',
    description: 'Optimiza la entrada de producto y minimiza pérdidas en origen',
    Icon: Package,
    objectiveIds: ['6', '16', '19'],
    header: 'bg-sky-50 border-sky-200',
    iconBox: 'bg-sky-100 text-sky-600',
    title: 'text-sky-700',
    badge: 'bg-sky-100 text-sky-700 border-sky-200',
    cardSel: 'border-sky-300 bg-sky-50/30',
    objBadge: 'bg-sky-50 text-sky-600 border-sky-200',
    accentBar: 'bg-sky-400',
    accentBorder: 'border-l-sky-300',
  },
  {
    id: 'produccion', num: 2,
    label: 'Preparación y Producción',
    description: 'Reduce mermas en cocina y aprovecha al máximo los subproductos',
    Icon: ChefHat,
    objectiveIds: ['5', '17', '20'],
    header: 'bg-amber-50 border-amber-200',
    iconBox: 'bg-amber-100 text-amber-600',
    title: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    cardSel: 'border-amber-300 bg-amber-50/30',
    objBadge: 'bg-amber-50 text-amber-600 border-amber-200',
    accentBar: 'bg-amber-400',
    accentBorder: 'border-l-amber-300',
  },
  {
    id: 'servicio', num: 3,
    label: 'Servicio',
    description: 'Controla el desperdicio en buffet, sala y comedor de personal',
    Icon: UtensilsCrossed,
    objectiveIds: ['1', '2', '3', '4', '14', '15'],
    header: 'bg-emerald-50 border-emerald-200',
    iconBox: 'bg-emerald-100 text-emerald-600',
    title: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    cardSel: 'border-emerald-300 bg-emerald-50/30',
    objBadge: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    accentBar: 'bg-emerald-400',
    accentBorder: 'border-l-emerald-300',
  },
  {
    id: 'medicion', num: 4,
    label: 'Medición y Seguimiento',
    description: 'Implanta indicadores y sistemas de control del desperdicio',
    Icon: BarChart2,
    objectiveIds: ['12', '18'],
    header: 'bg-violet-50 border-violet-200',
    iconBox: 'bg-violet-100 text-violet-600',
    title: 'text-violet-700',
    badge: 'bg-violet-100 text-violet-700 border-violet-200',
    cardSel: 'border-violet-300 bg-violet-50/30',
    objBadge: 'bg-violet-50 text-violet-600 border-violet-200',
    accentBar: 'bg-violet-400',
    accentBorder: 'border-l-violet-300',
  },
  {
    id: 'formacion', num: 5,
    label: 'Formación',
    description: 'Capacita al 100% del personal en la gestión del desperdicio alimentario',
    Icon: GraduationCap,
    objectiveIds: ['10', '11'],
    header: 'bg-teal-50 border-teal-200',
    iconBox: 'bg-teal-100 text-teal-600',
    title: 'text-teal-700',
    badge: 'bg-teal-100 text-teal-700 border-teal-200',
    cardSel: 'border-teal-300 bg-teal-50/30',
    objBadge: 'bg-teal-50 text-teal-600 border-teal-200',
    accentBar: 'bg-teal-400',
    accentBorder: 'border-l-teal-300',
  },
  {
    id: 'valorizacion', num: 6,
    label: 'Valorización y Salida',
    description: 'Dona excedentes aptos y valoriza los residuos orgánicos no evitables',
    Icon: Leaf,
    objectiveIds: ['7', '8', '9', '13'],
    header: 'bg-green-50 border-green-200',
    iconBox: 'bg-green-100 text-green-600',
    title: 'text-green-700',
    badge: 'bg-green-100 text-green-700 border-green-200',
    cardSel: 'border-green-300 bg-green-50/30',
    objBadge: 'bg-green-50 text-green-600 border-green-200',
    accentBar: 'bg-green-400',
    accentBorder: 'border-l-green-300',
  },
];

// Devuelve la configuración de fases correcta según el planId
export const getPhasesForPlan = (planId: string): PhaseConfig[] =>
  planId === 'INTELIER-HOTELES-SL' ? INTELIER_PHASES : PHASES;
