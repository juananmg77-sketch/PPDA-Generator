const plan = {
  plan_id: 'DEMO-1', hotel_name: 'Hotel de ejemplo', scope: 'individual', version: 'V1', estado: 'Activo',
  updated_at: new Date().toISOString(), consultor: 'consultor@ejemplo.es',
  data: { hotelData: { nombreComercial: 'Hotel de ejemplo' }, areas: [
    { id: 'a1', nombre: 'Buffet desayuno', tienePuntoPesaje: true, tipoServicio: 'Desayuno', capacidad: 200, superficie: 100, numServiciosDia: 1, esBuffet: true, horarios: '' },
    { id: 'a2', nombre: 'Cocina', tienePuntoPesaje: true, tipoServicio: 'Cocina', capacidad: 0, superficie: 60, numServiciosDia: 2, esBuffet: false, horarios: '' },
  ] },
};
const tables: Record<string, any[]> = { plans: [plan, { ...plan, plan_id: 'DEMO-2', estado: 'Borrador', version: 'V0' }], plan_access: [], profiles: [{ role: (new URLSearchParams(location.search).get('role') || 'admin'), hotel_nombre: '', email: 'ana@ejemplo.es', full_name: 'Ana Navarro', active: true }] };
const hc: Record<string, any[]> = { hc_organizaciones: [{ id: 'o1', nombre: 'Grupo Hotelero Demo', cnae: '5510', activa: true, consultor_email: 'jamunoz@hsconsulting.es' }], hc_centros: [{ id: 'c1', organizacion_id: 'o1', nombre: 'Hotel Playa Demo', municipio: 'Calvià', isla: 'Mallorca', en_baleares: true }], hc_inventarios: [{ id: 'i1', organizacion_id: 'o1', anio: Number(new URLSearchParams(location.search).get('anio') || 2024), estado: 'borrador', indice_actividad: 'estancias', updated_at: '2026-11-17T10:00:00Z' }], hc_inventario_centros: [], hc_documentos: [], hc_actividad: [], hc_exclusiones: [], hc_no_conformidades: [], hc_plantillas_subcategorias: [{id:'p1',sector:'hoteles',categoria:3,codigo:'3.1',nombre:'Transporte de mercancías (aguas arriba)',orden:1,activa:true},{id:'p2',sector:'hoteles',categoria:3,codigo:'3.2',nombre:'Desplazamientos de los empleados al trabajo',orden:2,activa:true},{id:'p3',sector:'hoteles',categoria:3,codigo:'3.3',nombre:'Transporte de clientes (llegada y salida de los huéspedes)',orden:3,activa:true},{id:'p4',sector:'hoteles',categoria:3,codigo:'3.4',nombre:'Viajes de negocios',orden:4,activa:true},{id:'p5',sector:'hoteles',categoria:4,codigo:'4.1',nombre:'Alimentos y bebidas',orden:5,activa:true},{id:'p6',sector:'hoteles',categoria:4,codigo:'4.2',nombre:'Otros bienes y servicios comprados',orden:6,activa:true},{id:'p7',sector:'hoteles',categoria:4,codigo:'4.3',nombre:'Bienes de capital',orden:7,activa:true},{id:'p8',sector:'hoteles',categoria:4,codigo:'4.4',nombre:'Residuos generados',orden:8,activa:true},{id:'p9',sector:'hoteles',categoria:4,codigo:'4.5',nombre:'Agua',orden:9,activa:true},{id:'p10',sector:'hoteles',categoria:4,codigo:'4.6',nombre:'Lavandería externalizada',orden:10,activa:true},{id:'p11',sector:'hoteles',categoria:5,codigo:'5.1',nombre:'Uso de los productos y servicios ofrecidos a los clientes',orden:11,activa:true},{id:'p12',sector:'hoteles',categoria:5,codigo:'5.2',nombre:'Final de vida de los productos suministrados',orden:12,activa:true},{id:'p13',sector:'hoteles',categoria:6,codigo:'6.1',nombre:'Otras fuentes de emisiones indirectas',orden:13,activa:true}], hc_evaluaciones_significancia: [], hc_configuracion: [] };
if (new URLSearchParams(location.search).get('seed')) {
  const A = (i: number, mes: number, cat: string, fuente: string, cant: number, cont: string | null, origen: string | null = null) => ({ id: 'a' + i, inventario_id: 'i1', centro_id: 'c1', documento_id: 'd' + i, categoria: cat, fuente, cantidad: cant, contador: cont, origen_electricidad: origen, periodo_desde: `2024-${String(mes).padStart(2, '0')}-01`, periodo_hasta: `2024-${String(mes).padStart(2, '0')}-28`, reparto_proporcion: 1, estado: 'confirmada', created_at: '2024-01-01' });
  const D = (a: any, tipo: string, unidad: string, cont: string | null) => ({ id: a.documento_id, inventario_id: 'i1', centro_id: 'c1', tipo, archivo_path: 'x', nombre_archivo: `f_${a.id}.pdf`, estado: 'revisado', periodo_desde: a.periodo_desde, periodo_hasta: a.periodo_hasta, extraccion: { tipo, proveedor: 'Endesa', contador: cont, periodoDesde: a.periodo_desde, periodoHasta: a.periodo_hasta, cantidad: a.cantidad, unidad }, created_at: '2024-01-01' });
  let n = 0; const acts: any[] = [];
  for (let m = 1; m <= 6; m++) { acts.push(A(++n, m, 'electricidad', '', 30000 + m * 2000, 'ES0021A', 'red')); if (!(m === 1 && new URLSearchParams(location.search).get('seed') === '2')) acts.push(A(++n, m, 'electricidad', '', 9000 + m * 500, 'ES0021B', 'red')); }
  for (let m = 1; m <= 4; m++) acts.push(A(++n, m, 'combustion_fija', 'Gas natural (kWhPCS)*', 12000 - m * 1500, null));
  acts.push(A(++n, 2, 'combustion_fija', 'Gasóleo C (l)', 3000, null));
  hc.hc_actividad.push(...acts);
  hc.hc_inventarios.push({ id: 'i0', organizacion_id: 'o1', anio: 2023, estado: 'cerrado', indice_actividad: 'estancias', updated_at: '2026-11-16T09:00:00Z' });
  hc.hc_actividad.push({ ...A(900, 1, 'electricidad', '', 120000, 'ES0021A', 'red'), inventario_id: 'i0', documento_id: null });
  hc.hc_documentos.push(...acts.map((a) => D(a, a.categoria === 'electricidad' ? 'electricidad' : a.fuente.startsWith('Gas') ? 'gas_natural' : 'gasoleo', a.categoria === 'electricidad' ? 'kWh' : a.fuente.startsWith('Gas') ? 'kWh PCS' : 'l', a.contador)));
}
let seq = 100;
const makeHc = (table: string): any => {
  const rows = hc[table]; let op = 'select'; let payload: any; const filt: Array<[string, any]> = []; let one = false;
  const run = () => {
    const match = (r: any) => filt.every(([k, v]) => r[k] === v);
    if (op === 'insert') { const r = { id: 'n' + (++seq), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...(table === 'hc_organizaciones' ? { activa: true } : {}), ...(table === 'hc_inventarios' ? { estado: 'borrador' } : {}), ...payload }; if (table === 'hc_documentos' && !payload.estado) r.estado = 'subido'; rows.push(r); return { data: one ? r : [r], error: null }; }
    if (op === 'upsert') { const i = rows.findIndex((r) => r.inventario_id === payload.inventario_id && r.centro_id === payload.centro_id && r.codigo === payload.codigo); if (i >= 0) Object.assign(rows[i], payload); else rows.push({ id: 'n' + (++seq), ...payload }); return { data: one ? (rows[i >= 0 ? i : rows.length - 1]) : [payload], error: null }; }
    if (op === 'update') { const m = rows.filter(match); m.forEach((r) => Object.assign(r, payload)); return { data: one ? m[0] : m, error: null }; }
    if (op === 'delete') { for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i])) rows.splice(i, 1); return { data: null, error: null }; }
    const m = rows.filter(match); return { data: one ? m[0] ?? null : m, error: null };
  };
  const b: any = { select: () => b, order: () => b, single: () => { one = true; return b; }, maybeSingle: () => { one = true; return b; }, eq: (k: string, v: any) => { filt.push([k, v]); return b; },
    insert: (x: any) => { op = 'insert'; payload = x; return b; }, update: (x: any) => { op = 'update'; payload = x; return b; }, upsert: (x: any) => { op = 'upsert'; payload = x; return b; }, delete: () => { op = 'delete'; return b; },
    then: (res: any) => res(run()) };
  return b;
};
const make = (table: string): any => {
  if (hc[table]) return makeHc(table);
  let single = false;
  const b: any = new Proxy({}, { get: (_t, k) => {
    if (k === 'then') return (res: any) => res({ data: single ? (tables[table] ?? [])[0] ?? null : (tables[table] ?? []), error: null });
    if (k === 'single' || k === 'maybeSingle') return () => { single = true; return b; };
    return () => b;
  } });
  return b;
};
export const supabase: any = {
  from: (t: string) => make(t),
  storage: { from: () => ({ remove: async () => ({ error: null }), upload: async () => ({ error: null }), createSignedUrl: async () => ({ data: { signedUrl: 'about:blank' }, error: null }) }) },
  auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }), getSession: async () => ({ data: { session: (new URLSearchParams(location.search).get('v') === 'huella') ? { access_token: 'tok' } : null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}), signInWithPassword: async () => ({ data: { user: { email: 'ana@ejemplo.es' } }, error: null }), updateUser: async () => ({ error: null }) },
};
