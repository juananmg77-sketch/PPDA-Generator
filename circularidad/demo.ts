// Plan de ejemplo (establecimiento ficticio) para presentar el módulo a un cliente. No contiene datos reales.
import type { Plan, SeguimientoAccion, Trimestre } from './plan.ts';
import { vacioSeg } from './plan.ts';

const t = (cumple: boolean, evidencia = ''): Trimestre => ({ cumple, evidencia });
const seg = (a: boolean, b: boolean, c: boolean, d: boolean, notas = '', ev: string[] = []): SeguimientoAccion => ({
  t1: t(a, ev[0] ?? ''), t2: t(b, ev[1] ?? ''), t3: t(c, ev[2] ?? ''), t4: t(d, ev[3] ?? ''), notas,
});

export function planDemo(): Plan {
  return {
    id: 'demo', version: 1, cerrado: false,
    ficha: {
      establecimiento: 'Hotel Mediterráneo Playa (ejemplo)', empresa: 'Hoteles Ejemplo Baleares, S.A.', direccion: 'Av. de la Platja, s/n · Alcúdia (Mallorca)',
      actividad: 'Alojamiento turístico en régimen de todo incluido. Restaurante con cocina propia, lavandería, 2 piscinas y spa.',
      apertura: '15/03 – 31/10', habitaciones: 298, capacidad: 596, pernoctaciones: 61460, superficie: 35760,
      categoria: '4', categoriaTexto: '4 estrellas',
      equipo: [
        { id: 'm1', departamento: 'Calidad', nombre: 'Nombre Apellidos', cargo: 'Responsable de Calidad', email: 'calidad@ejemplo.es', funcion: 'Responsable del plan' },
        { id: 'm2', departamento: 'Dirección', nombre: 'Nombre Apellidos', cargo: 'Director', email: 'direccion@ejemplo.es', funcion: 'Dirección' },
        { id: 'm3', departamento: 'Servicios Técnicos', nombre: 'Nombre Apellidos', cargo: 'Jefe de Servicios Técnicos', email: 'tecnico@ejemplo.es', funcion: 'Responsable línea Energía' },
        { id: 'm4', departamento: 'Mantenimiento', nombre: 'Nombre Apellidos', cargo: 'Jefe de Mantenimiento', email: 'mantenimiento@ejemplo.es', funcion: 'Responsable línea Agua' },
        { id: 'm5', departamento: 'Pisos', nombre: 'Nombre Apellidos', cargo: 'Gobernanta', email: 'pisos@ejemplo.es', funcion: 'Responsable línea Materiales y residuos' },
        { id: 'm6', departamento: 'Cocina', nombre: 'Nombre Apellidos', cargo: 'Chef', email: 'cocina@ejemplo.es', funcion: 'Responsable línea Alimentos' },
        { id: 'm7', departamento: 'Recepción', nombre: 'Nombre Apellidos', cargo: 'Jefe de Recepción', email: 'recepcion@ejemplo.es', funcion: 'Responsable línea Gobernanza y sensibilización' },
      ],
      vigenciaDesde: 2023, vigenciaHasta: 2028, fechaPublicacion: '2023-04-28',
    },
    datos: {
      2022: { huella_kg: 1_150_000, cert_kwh_m2: 168, ren_kwh: 38_000, cons_kwh: 1_647_589, pot_kw: 10, alm_kwh: 0, agua_auto_l: 0, agua_total_l: 41_949_000, agua_red_l: 41_949_000, rcd_rec_t: 12, rcd_tot_t: 80, resid_m3: 1_820, km0_eur: 118_965, ab_eur: 1_404_114, granel_eur: 1_389_672, aprov_eur: 1_404_114, inv_circ: 96_000, inv_tot: 1_480_000, plant_form: 41, plant_tot: 182, prov_circ: 14, prov_tot: 96 },
      2023: { huella_kg: 1_085_000, cert_kwh_m2: 168, ren_kwh: 92_000, cons_kwh: 1_590_000, pot_kw: 15, alm_kwh: 0, agua_auto_l: 0, agua_total_l: 40_420_000, agua_red_l: 40_420_000, rcd_rec_t: 18, rcd_tot_t: 85, resid_m3: 1_760, km0_eur: 156_800, ab_eur: 1_452_000, granel_eur: 1_430_000, aprov_eur: 1_452_000, inv_circ: 142_000, inv_tot: 1_610_000, plant_form: 96, plant_tot: 186, prov_circ: 22, prov_tot: 98 },
      2024: { huella_kg: 1_020_000, cert_kwh_m2: 161, ren_kwh: 148_000, cons_kwh: 1_540_000, pot_kw: 40, alm_kwh: 100, agua_auto_l: 1_200_000, agua_total_l: 39_300_000, agua_red_l: 38_100_000, rcd_rec_t: 26, rcd_tot_t: 90, resid_m3: 1_700, km0_eur: 214_000, ab_eur: 1_498_000, granel_eur: 1_480_000, aprov_eur: 1_498_000, inv_circ: 218_000, inv_tot: 1_705_000, plant_form: 142, plant_tot: 190, prov_circ: 35, prov_tot: 101 },
    },
    letraCertificado: { 2022: 'D', 2023: 'D', 2024: 'C' },
    camasElevablesInstaladas: { 2023: 20, 2024: 30 },
    accionesClientes: [
      'Cartelería en habitaciones con recomendaciones de ahorro de energía y agua',
      'Cambio de toallas y sábanas a petición del cliente',
      'Separación de residuos en habitaciones (3 fracciones)',
      'Buffet con raciones adaptadas y mensajes para reducir el desperdicio',
    ],
    objetivos: [
      { id: 'o1', metaValor: 17.77, codigo: '1', area: 'energia', descripcion: 'Reducir la huella de carbono un 5 % respecto a 2022', indicadorId: 'E1', lineaBase: '18,71 kg CO₂e/pernoctación (2022)', meta: '−5 % en 2028', plazo: '2028', responsable: 'Servicios Técnicos', recursos: 'Estudio energético, contadores y monitorización', inversion: '120.000 €',
        acciones: [
          { id: 'a1', codigo: '1A', descripcion: 'Estudio de consumo y potencial de reducción', responsable: 'Servicios Técnicos', plazo: '2024' },
          { id: 'a2', codigo: '1B', descripcion: 'Monitorización de consumos eléctricos por contador', responsable: 'Servicios Técnicos', plazo: '2024' },
          { id: 'a3', codigo: '1C', descripcion: 'Centralizar la temperatura de A/A y calefacción', responsable: 'Servicios Técnicos', plazo: '2025' },
          { id: 'a4', codigo: '1D', descripcion: 'Protocolo de ahorro eléctrico y concienciación del personal', responsable: 'Calidad', plazo: '2024' },
        ] },
      { id: 'o2', metaValor: 60, codigo: '2', area: 'energia', descripcion: 'Aumentar la potencia renovable instalada de 15 a 60 kW', indicadorId: 'E4', lineaBase: '10 kW (2022)', meta: '60 kW en 2026', plazo: '2026', responsable: 'Propiedad · Servicios Técnicos', recursos: 'Inversión en placas y baterías', inversion: '200.000 €',
        acciones: [
          { id: 'a5', codigo: '2A', descripcion: 'Solicitar presupuestos a empresas instaladoras', responsable: 'Servicios Técnicos', plazo: '2024' },
          { id: 'a6', codigo: '2B', descripcion: 'Instalar las placas fotovoltaicas', responsable: 'Propiedad', plazo: '2024' },
          { id: 'a7', codigo: '2C', descripcion: 'Instalar baterías de almacenamiento (100 kWh)', responsable: 'Propiedad', plazo: '2025' },
        ] },
      { id: 'o3', metaValor: 39851550, codigo: '3', area: 'agua', descripcion: 'Reducir el consumo de agua de la red un 5 %', indicadorId: 'A2', lineaBase: '41.949.000 l (2022)', meta: '−5 % en 2026', plazo: '2026', responsable: 'Servicios Técnicos', recursos: 'Contadores, reductores de flujo y cisternas de doble pulsación', inversion: '35.000 €',
        acciones: [
          { id: 'a8', codigo: '3A', descripcion: 'Contadores de agua y alarmas de consumo excesivo', responsable: 'Servicios Técnicos', plazo: '2024' },
          { id: 'a9', codigo: '3B', descripcion: 'Aireadores y reductores de flujo con mayor ahorro', responsable: 'Servicios Técnicos', plazo: '2024' },
          { id: 'a10', codigo: '3C', descripcion: 'Toallas de piscina: control y cambio a petición', responsable: 'Gobernanta', plazo: '2024' },
        ] },
      { id: 'o4', metaValor: 20, codigo: '4', area: 'alimentos', descripcion: 'Elevar al 20 % el gasto en productos de kilómetro cero', indicadorId: 'AL1', lineaBase: '8,5 % (2022)', meta: '20 % en 2027', plazo: '2027', responsable: 'Chef · Compras', recursos: 'Estudio de proveedores locales', inversion: 'Sin inversión',
        acciones: [
          { id: 'a11', codigo: '4A', descripcion: 'Estudio de proveedores locales', responsable: 'Compras', plazo: '2024' },
          { id: 'a12', codigo: '4B', descripcion: 'Incorporar productos de Baleares a la carta y al buffet', responsable: 'Chef', plazo: '2025' },
          { id: 'a13', codigo: '4C', descripcion: 'Identificar el origen balear en la carta', responsable: 'Maître', plazo: '2024' },
        ] },
      { id: 'o6', metaValor: 0.02664, codigo: '5', area: 'residuos', descripcion: 'Reducir el volumen de residuos por pernoctación y mejorar su segregación', indicadorId: 'R2', lineaBase: '0,0296 m³/pernoctación (2022)', meta: '−10 % en 2027', plazo: '2027', responsable: 'Gobernanta · Servicios Técnicos', recursos: 'Contenedores por fracción y formación', inversion: '12.000 €',
        acciones: [
          { id: 'a16', codigo: '5A', descripcion: 'Auditoría de residuos por fracción', responsable: 'Calidad', plazo: '2024' },
          { id: 'a17', codigo: '5B', descripcion: 'Recogida selectiva en habitaciones y cocina', responsable: 'Gobernanta', plazo: '2024' },
          { id: 'a18', codigo: '5C', descripcion: 'Eliminar los amenities desechables', responsable: 'Gobernanta', plazo: '2024' },
        ] },
      { id: 'o5', metaValor: 90, codigo: '6', area: 'gobernanza', descripcion: 'Formar al 90 % de la plantilla en circularidad', indicadorId: 'G2', lineaBase: '22,5 % (2022)', meta: '90 % en 2025', plazo: '2025', responsable: 'Recursos Humanos', recursos: 'Plan de formación anual', inversion: '8.000 €',
        acciones: [
          { id: 'a14', codigo: '6A', descripcion: 'Plan anual de formación', responsable: 'Recursos Humanos', plazo: '2024' },
          { id: 'a15', codigo: '6B', descripcion: 'Formación a nuevas incorporaciones', responsable: 'Recursos Humanos', plazo: '2025' },
        ] },
    ],
    seguimiento: {
      2024: { cerrado: false, acciones: {
        a1: seg(true, true, true, true, 'Estudio entregado en febrero.', ['Informe de estudio energético', '', '', '']),
        a2: seg(false, true, true, true, 'Instalados 24 contadores.', ['', 'Albaranes de instalación', '', '']),
        a3: seg(false, false, false, false), a4: seg(true, true, true, true),
        a5: seg(true, true, true, true), a6: seg(false, false, true, true, 'Instalación terminada en septiembre.', ['', '', 'Certificado de instalación', '']), a7: seg(false, false, false, true),
        a8: seg(true, true, true, true), a9: seg(true, true, true, false), a10: seg(true, true, true, true),
        a11: seg(true, true, true, true), a12: seg(false, false, true, true), a13: seg(true, true, true, true),
        a16: seg(true, true, true, true, 'Auditoría realizada en marzo.', ['Informe de auditoría', '', '', '']), a17: seg(false, true, true, true), a18: seg(true, true, true, true, '', ['Fichas de compra a granel', '', '', '']),
        a14: seg(true, true, true, true, '142 personas formadas.', ['Listado de asistentes', '', '', '']), a15: seg(false, false, false, false),
      } },
      2025: { cerrado: false, acciones: { a3: seg(true, true, false, false), a7: seg(true, true, false, false), a12: seg(true, false, false, false), a15: seg(true, false, false, false) } },
    },
    requisitos: {
      q1: { estado: 'cumple', evidencia: 'Inspección de instalaciones', nota: '' }, q2: { estado: 'cumple', evidencia: 'Albaranes de compra', nota: '' },
      q3: { estado: 'cumple', evidencia: 'Compromiso con proveedores', nota: '' }, q4: { estado: 'parcial', evidencia: '', nota: 'Falta identificar el origen en el menú del buffet.' },
      q5: { estado: 'no', evidencia: '', nota: 'Calderas de gasoil en 2 edificios; pendiente de sustitución por bomba de calor.' }, q6: { estado: 'cumple', evidencia: 'Registro de temperaturas', nota: '' },
      q7: { estado: 'cumple', evidencia: 'Certificado energético en vigor', nota: '' }, q8: { estado: 'cumple', evidencia: 'Amenities dispensados a granel', nota: '' },
      q9: { estado: 'cumple', evidencia: 'Contrato con gestor', nota: '' }, q10: { estado: 'cumple', evidencia: '', nota: '' }, q11: { estado: 'cumple', evidencia: '', nota: '' }, q12: { estado: 'cumple', evidencia: 'Plan disponible en intranet', nota: '' },
    },
  };
}

export const planVacio = (): Plan => {
  const p = planDemo();
  return { ...p, id: 'nuevo', datos: {}, objetivos: [], seguimiento: {}, requisitos: {}, camasElevablesInstaladas: {}, letraCertificado: {}, accionesClientes: [], ficha: { ...p.ficha, establecimiento: '', empresa: '', direccion: '' } };
};
export { vacioSeg };
