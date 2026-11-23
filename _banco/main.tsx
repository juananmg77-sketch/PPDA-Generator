import React from 'react';
import { createRoot } from 'react-dom/client';
import { ClientDashboard } from '../components/ClientDashboard';
import { RegistrosView } from '../components/RegistrosView';
import App from '../App';
import HuellaView from '../components/HuellaView';
import CircularidadView from '../components/CircularidadView';
const v = new URLSearchParams(location.search).get('v') || 'client';
const planData: any = { hotelData: { nombreComercial: 'Hotel de ejemplo' }, areas: [
  { id: 'a1', nombre: 'Buffet desayuno', tienePuntoPesaje: true, tipoServicio: 'Desayuno', capacidad: 200, superficie: 100, numServiciosDia: 1, esBuffet: true, horarios: '' },
  { id: 'a2', nombre: 'Cocina', tienePuntoPesaje: true, tipoServicio: 'Cocina', capacidad: 0, superficie: 60, numServiciosDia: 2, esBuffet: false, horarios: '' } ] };
if (v === 'huella') {
  const orig = window.fetch;
  window.fetch = (async (u: any, o: any) => {
    if (String(u).includes('/api/leer-factura')) {
      await new Promise((r) => setTimeout(r, 700));
      const b = JSON.parse(o.body); const n = (window as any).__n = ((window as any).__n || 0) + 1; const mes = String(((n - 1) % 12) + 1).padStart(2, '0'); const e: any = { tipo: b.tipo || 'electricidad', proveedor: 'Endesa', periodoDesde: `2024-${mes}-01`, periodoHasta: `2024-${mes}-28`, cantidad: 40000 + n * 1000, unidad: b.tipo === 'gas_natural' ? 'kWh' : 'kWh', garantiaOrigen: 'no', confianza: 0.93, contador: undefined }; if (n === 3) { e.cantidad = undefined; e.confianza = 0.4; } if (n === 4) { e.cantidad = 0; e.unidad = undefined; } if (b.tipo === 'refrigerante') { e.producto = 'R448A'; e.unidad = 'kg'; e.cantidad = 3; } if (b.tipo === 'glp') { e.producto = 'Butano'; e.unidad = n % 2 ? 'bombonas' : 'kilos'; e.cantidad = n % 2 ? 20 : 300; }
      return new Response(JSON.stringify({ extraccion: e, incidencias: [{ gravedad: 'aviso', codigo: 'origen_electricidad', mensaje: 'x' }].slice(0, 0), modelo: 'claude-haiku-5-5', usoRefuerzo: false, consumo: [] }), { status: 200 });
    }
    if (String(u).includes('/api/buscar-hoteles')) {
      await new Promise((r) => setTimeout(r, 300));
      const b = JSON.parse(o.body);
      const H = (i: number, n: string, cad: string | null, mun: string, isla: string, act = true) => ({ id: `00000000-0000-0000-0000-00000000000${i}`, codigo_hotel: `H00${i}`, nombre_hotel: n, cadena_hotelera: cad, titular: cad ? `${cad} SL` : 'Titular SL', cif: `B1234567${i}`, pais: 'España', ccaa: 'Illes Balears', isla, municipio: mun, direccion_completa: `C/ Mar ${i}, ${mun}`, num_habitaciones: 100 + i, num_plazas: 200, activo: act });
      const todos = [H(1, 'Hotel Sol Playa', 'Cadena Sol', 'Calvià', 'Mallorca'), H(2, 'Hotel Sol Palma', 'Cadena Sol', 'Palma', 'Mallorca'), H(3, 'Sol Ibiza Beach', 'Cadena Sol', 'Sant Antoni', 'Eivissa'), H(4, 'Sol Antiguo', 'Cadena Sol', 'Alcúdia', 'Mallorca', false), H(5, 'Hotel Luna', null, 'Maó', 'Menorca')];
      const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      let r = todos;
      if (b.id) r = todos.filter((x) => x.id === b.id);
      else if (b.cadena) r = todos.filter((x) => norm(x.cadena_hotelera ?? '') === norm(b.cadena));
      else if (b.texto) r = todos.filter((x) => b.texto.toLowerCase().split(' ').every((w: string) => norm(JSON.stringify(x)).includes(norm(w))));
      return new Response(JSON.stringify({ hoteles: r }), { status: 200 });
    }
    return orig(u, o);
  }) as any;
  createRoot(document.getElementById('root')!).render(<HuellaView onBack={() => {}} currentUser={new URLSearchParams(location.search).get('rol') === 'cliente' ? 'cliente@hotel.es' : 'consultor@ejemplo.es'} rol={new URLSearchParams(location.search).get('rol') === 'cliente' ? 'cliente' : 'consultor'} />);
} else if (v === 'circ') {
  createRoot(document.getElementById('root')!).render(<CircularidadView onBack={() => {}} currentUser="consultor@ejemplo.es" />);
} else if (v === 'login') {
  createRoot(document.getElementById('root')!).render(<App />);
} else if (v === 'app') {
  createRoot(document.getElementById('root')!).render(<App />);
  const setVal = (el: HTMLInputElement, val: string) => { const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!; d.set!.call(el, val); el.dispatchEvent(new Event('input', { bubbles: true })); };
  setTimeout(() => {
    const ins = document.querySelectorAll('input'); setVal(ins[0] as HTMLInputElement, 'ana@ejemplo.es'); setVal(ins[1] as HTMLInputElement, 'x1234567');
    (document.querySelector('form button[type=submit]') as HTMLButtonElement)?.click();
    const label = new URLSearchParams(location.search).get('click');
    if (label) label.split('|').forEach((l, i) => setTimeout(() => { [...document.querySelectorAll('button')].find(b => b.textContent?.includes(l))?.click(); }, 2600 + i * 3500));
  }, 700);
} else createRoot(document.getElementById('root')!).render(
  v === 'client'
    ? <ClientDashboard currentUser="cliente@ejemplo.es" onOpenPlan={() => {}} onOpenRegistros={() => {}} onLogout={() => {}} />
    : <RegistrosView planId="DEMO-1" hotelNombre="Hotel de ejemplo" planData={planData} currentUser="cliente@ejemplo.es" onBack={() => {}} onLogout={() => {}} initialSection={v === 'don' ? 'donaciones' : undefined} />
);
