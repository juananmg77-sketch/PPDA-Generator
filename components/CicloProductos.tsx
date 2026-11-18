// Portada: los tres productos HS GREEN unidos por un círculo con flechas (ciclo de circularidad).
import React from 'react';
import { Recycle } from 'lucide-react';

const C = { x: 380, y: 290 }, R = 170;
const punto = (grados: number) => { const a = (grados * Math.PI) / 180; return `${(C.x + R * Math.cos(a)).toFixed(1)} ${(C.y + R * Math.sin(a)).toFixed(1)}`; };
const arco = (desde: number, hasta: number) => `M ${punto(desde)} A ${R} ${R} 0 0 1 ${punto(hasta)}`;
// Tramos visibles entre tarjetas (arriba → derecha → izquierda → arriba), en sentido horario
const TRAMOS: Array<[number, number]> = [[-44, 11], [44, 136], [170, 224]];

/** Escritorio: ciclo en triángulo con flechas; móvil: las tarjetas apiladas con una flecha entre ellas. */
export const CicloProductos: React.FC<{ arriba: React.ReactNode; izquierda: React.ReactNode; derecha: React.ReactNode }> = ({ arriba, izquierda, derecha }) => (
  <>
    <div className="hidden md:block relative mx-auto" style={{ width: 760, height: 505 }}>
      <svg className="absolute inset-0 pointer-events-none" width="760" height="505" viewBox="0 0 760 505" aria-hidden="true">
        <defs>
          <marker id="flecha-ciclo" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#00BF46" /></marker>
          <linearGradient id="grad-ciclo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#00BF46" /><stop offset="1" stopColor="#0002C9" /></linearGradient>
        </defs>
        <circle cx={C.x} cy={C.y} r={R} fill="none" stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="3 6" />
        {TRAMOS.map(([a, b], i) => <path key={i} d={arco(a, b)} fill="none" stroke="url(#grad-ciclo)" strokeWidth="3.5" strokeLinecap="round" markerEnd="url(#flecha-ciclo)" />)}
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center" style={{ left: C.x - 80, top: C.y - 62, width: 160, height: 124 }}>
        <span className="w-14 h-14 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center"><Recycle size={28} className="text-brand-600" /></span>
        <span className="mt-2 text-[11px] font-extrabold tracking-wide text-header uppercase">Ciclo circular</span>
        <span className="text-[10px] text-slate-500 leading-tight">Prevenir · Medir · Mejorar</span>
      </div>
      <div className="absolute [&>button]:w-full [&>button]:block" style={{ left: 265, top: 0, width: 230 }}>{arriba}</div>
      <div className="absolute [&>button]:w-full [&>button]:block" style={{ left: 20, top: 330, width: 230 }}>{izquierda}</div>
      <div className="absolute [&>button]:w-full [&>button]:block" style={{ left: 510, top: 330, width: 230 }}>{derecha}</div>
    </div>
    <div className="md:hidden space-y-1 max-w-sm mx-auto">
      {[izquierda, arriba, derecha].map((c, i) => (
        <React.Fragment key={i}>{c}{i < 2 && <div className="flex justify-center text-brand-600 text-2xl leading-none" aria-hidden="true">↓</div>}</React.Fragment>
      ))}
      <div className="flex justify-center text-brand-600 text-sm font-semibold pt-1" aria-hidden="true">↺ ciclo circular</div>
    </div>
  </>
);
