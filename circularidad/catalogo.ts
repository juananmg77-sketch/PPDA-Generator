// Catálogo del Plan de Circularidad (Ley 3/2022 de las Illes Balears y guía AETIB): áreas, indicadores, requisitos obligatorios con fecha y medidas sugeridas.
// Los textos resumen lo exigido; la norma completa no se reproduce. Las fechas y porcentajes están pendientes de contraste final con el texto legal.

export type Area = 'energia' | 'agua' | 'residuos' | 'alimentos' | 'gobernanza';
export const AREAS: Record<Area, { nombre: string; color: string }> = {
  energia: { nombre: 'Energía', color: '#EA980F' },
  agua: { nombre: 'Agua', color: '#24CBF5' },
  residuos: { nombre: 'Materiales y residuos', color: '#C234D6' },
  alimentos: { nombre: 'Alimentos', color: '#00BF46' },
  gobernanza: { nombre: 'Gobernanza y sensibilización', color: '#0002C9' },
};
export const ORDEN_AREAS: Area[] = ['energia', 'agua', 'residuos', 'alimentos', 'gobernanza'];

/** Datos de entrada de un año: cada indicador se calcula a partir de uno o varios. */
export interface CampoEntrada { id: string; etiqueta: string; unidad: string; ayuda?: string }
export interface Indicador {
  id: string; area: Area; nombre: string; unidad: string; decimales: number;
  /** Cómo se obtiene: 'directo' (se introduce), o fórmula a partir de campos de entrada. */
  formula: string; campos: CampoEntrada[];
  /** true si un valor más alto es mejor (para el semáforo de evolución). */
  masEsMejor: boolean;
  origenSugerido?: 'huella' | 'pesajes' | 'manual';
  calcular: (v: Record<string, number | undefined>, ficha: { pernoctaciones?: number }) => number | undefined;
}

const pct = (a?: number, b?: number) => (a !== undefined && b !== undefined && b > 0 ? (a / b) * 100 : undefined);

export const INDICADORES: Indicador[] = [
  { id: 'E1', area: 'energia', nombre: 'Huella de carbono por pernoctación', unidad: 'kg CO₂e/pernoctación', decimales: 2, masEsMejor: false, origenSugerido: 'huella',
    formula: 'Huella de carbono anual ÷ pernoctaciones anuales', campos: [{ id: 'huella_kg', etiqueta: 'Huella de carbono anual', unidad: 'kg CO₂e', ayuda: 'Se trae del cálculo de Huella' }],
    calcular: (v, f) => (v.huella_kg !== undefined && f.pernoctaciones ? v.huella_kg / f.pernoctaciones : undefined) },
  { id: 'E2', area: 'energia', nombre: 'Certificación de eficiencia energética del edificio', unidad: 'kWh/m²·año', decimales: 0, masEsMejor: false,
    formula: 'Consumo de energía primaria del certificado (RD 390/2021)', campos: [{ id: 'cert_kwh_m2', etiqueta: 'Consumo del certificado', unidad: 'kWh/m²·año' }], calcular: (v) => v.cert_kwh_m2 },
  { id: 'E3', area: 'energia', nombre: 'Capacidad de abastecimiento de energía', unidad: '%', decimales: 1, masEsMejor: true,
    formula: '100 × energía renovable autogenerada ÷ consumo total anual', campos: [{ id: 'ren_kwh', etiqueta: 'Energía renovable autogenerada', unidad: 'kWh' }, { id: 'cons_kwh', etiqueta: 'Consumo total de energía', unidad: 'kWh' }],
    calcular: (v) => pct(v.ren_kwh, v.cons_kwh) },
  { id: 'E4', area: 'energia', nombre: 'Potencia renovable instalada', unidad: 'kW', decimales: 1, masEsMejor: true,
    formula: 'Potencia instalada (RD 413/2014, art. 3)', campos: [{ id: 'pot_kw', etiqueta: 'Potencia renovable instalada', unidad: 'kW' }], calcular: (v) => v.pot_kw },
  { id: 'E5', area: 'energia', nombre: 'Capacidad de almacenamiento', unidad: 'kWh', decimales: 0, masEsMejor: true,
    formula: 'Capacidad de las baterías de la energía renovable', campos: [{ id: 'alm_kwh', etiqueta: 'Capacidad de almacenamiento', unidad: 'kWh' }], calcular: (v) => v.alm_kwh },
  { id: 'A1', area: 'agua', nombre: 'Capacidad de autoabastecimiento de agua', unidad: '%', decimales: 1, masEsMejor: true,
    formula: '100 × agua autocaptada o depurada ÷ consumo total de agua', campos: [{ id: 'agua_auto_l', etiqueta: 'Agua autocaptada / depurada', unidad: 'litros' }, { id: 'agua_total_l', etiqueta: 'Consumo total de agua', unidad: 'litros' }],
    calcular: (v) => pct(v.agua_auto_l, v.agua_total_l) },
  { id: 'A2', area: 'agua', nombre: 'Consumo anual de agua de la red pública', unidad: 'litros', decimales: 0, masEsMejor: false,
    formula: 'Agua consumida de la red pública', campos: [{ id: 'agua_red_l', etiqueta: 'Consumo de la red pública', unidad: 'litros' }], calcular: (v) => v.agua_red_l },
  { id: 'R1', area: 'residuos', nombre: 'Reciclaje de residuos de obras, reformas y demoliciones', unidad: '%', decimales: 1, masEsMejor: true,
    formula: '100 × materiales reciclados o reutilizados ÷ material total utilizado', campos: [{ id: 'rcd_rec_t', etiqueta: 'Material reciclado o reutilizado', unidad: 't' }, { id: 'rcd_tot_t', etiqueta: 'Material total utilizado', unidad: 't' }],
    calcular: (v) => pct(v.rcd_rec_t, v.rcd_tot_t) },
  { id: 'R2', area: 'residuos', nombre: 'Recogida selectiva de residuos', unidad: 'm³/pernoctación', decimales: 4, masEsMejor: false, origenSugerido: 'pesajes',
    formula: '(Contenedores anuales × volumen) ÷ pernoctaciones', campos: [{ id: 'resid_m3', etiqueta: 'Volumen anual recogido selectivamente', unidad: 'm³', ayuda: 'Papel/cartón, vidrio, envases… (contenedores × volumen o registro del gestor)' }],
    calcular: (v, f) => (v.resid_m3 !== undefined && f.pernoctaciones ? v.resid_m3 / f.pernoctaciones : undefined) },
  { id: 'AL1', area: 'alimentos', nombre: 'Consumo de productos de kilómetro cero', unidad: '%', decimales: 1, masEsMejor: true,
    formula: '100 × gasto en alimentos y bebidas de Baleares ÷ gasto total en alimentos y bebidas', campos: [{ id: 'km0_eur', etiqueta: 'Gasto en productos km 0', unidad: '€' }, { id: 'ab_eur', etiqueta: 'Gasto total en alimentos y bebidas', unidad: '€' }],
    calcular: (v) => pct(v.km0_eur, v.ab_eur) },
  { id: 'AL2', area: 'alimentos', nombre: 'Cesta de la compra que minimiza el uso de envases', unidad: '%', decimales: 1, masEsMejor: true,
    formula: '100 × gasto a granel o en envase reutilizable/biodegradable ÷ gasto de aprovisionamiento', campos: [{ id: 'granel_eur', etiqueta: 'Gasto a granel o envase reutilizable', unidad: '€' }, { id: 'aprov_eur', etiqueta: 'Gasto total de aprovisionamiento', unidad: '€' }],
    calcular: (v) => pct(v.granel_eur, v.aprov_eur) },
  { id: 'G1', area: 'gobernanza', nombre: 'Inversión vinculada a buenas prácticas circulares', unidad: '%', decimales: 1, masEsMejor: true,
    formula: '100 × inversión circular ÷ inversión total de los últimos tres ejercicios', campos: [{ id: 'inv_circ', etiqueta: 'Inversión circular (3 ejercicios)', unidad: '€' }, { id: 'inv_tot', etiqueta: 'Inversión total (3 ejercicios)', unidad: '€' }],
    calcular: (v) => pct(v.inv_circ, v.inv_tot) },
  { id: 'G2', area: 'gobernanza', nombre: 'Plantilla formada en circularidad', unidad: '%', decimales: 1, masEsMejor: true,
    formula: '100 × trabajadores formados en el último ejercicio ÷ plantilla total', campos: [{ id: 'plant_form', etiqueta: 'Trabajadores formados', unidad: 'personas' }, { id: 'plant_tot', etiqueta: 'Plantilla total', unidad: 'personas' }],
    calcular: (v) => pct(v.plant_form, v.plant_tot) },
  { id: 'G3', area: 'gobernanza', nombre: 'Proveedores con código de conducta circular', unidad: '%', decimales: 1, masEsMejor: true,
    formula: '100 × proveedores con código circular ÷ proveedores habituales', campos: [{ id: 'prov_circ', etiqueta: 'Proveedores con código circular', unidad: 'proveedores' }, { id: 'prov_tot', etiqueta: 'Proveedores habituales', unidad: 'proveedores' }],
    calcular: (v) => pct(v.prov_circ, v.prov_tot) },
];

export const indicador = (id: string) => INDICADORES.find((i) => i.id === id)!;

// ───────────── Requisitos obligatorios con fecha ─────────────
export type EstadoReq = 'cumple' | 'parcial' | 'no' | 'na' | 'pendiente';
export interface Requisito { id: string; area: Area | 'general'; texto: string; norma: string; desde: string; /** Fecha límite si es progresiva o con plazo. */ hasta?: string }
export const REQUISITOS: Requisito[] = [
  { id: 'q1', area: 'agua', texto: 'Doble pulsador o pulsador con interrupción de descarga en las cisternas de WC', norma: 'Ley 3/2022', desde: '2022-06-17' },
  { id: 'q2', area: 'agua', texto: 'Aireadores o difusores en grifos de lavabos, bañeras y duchas', norma: 'Ley 3/2022', desde: '2022-06-17' },
  { id: 'q3', area: 'alimentos', texto: 'No consumir especies clasificadas como amenazadas', norma: 'Ley 3/2022', desde: '2022-02-12' },
  { id: 'q4', area: 'alimentos', texto: 'Identificar en carta o menú el pescado y marisco de origen balear y los productos con denominación de origen, con trazabilidad acreditable', norma: 'Ley 3/2022', desde: '2023-05-01' },
  { id: 'q5', area: 'energia', texto: 'Eliminar las instalaciones térmicas de fueloil o gasoil (salvo imposibilidad técnica acreditada)', norma: 'Ley 3/2022', desde: '2026-05-01' },
  { id: 'q6', area: 'energia', texto: 'Temperatura de recintos: calefacción ≤ 21 °C y refrigeración ≥ 26 °C, con humedad entre el 30 y el 70 %', norma: 'RD 1027/2007', desde: '2022-06-17' },
  { id: 'q7', area: 'energia', texto: 'Disponer del certificado de eficiencia energética del edificio', norma: 'RD 390/2021', desde: '2022-06-03' },
  { id: 'q8', area: 'residuos', texto: 'No ofrecer amenities desechables salvo a petición del cliente y con envases reutilizables, reciclables, biodegradables o compostables', norma: 'Ley 3/2022', desde: '2022-06-17' },
  { id: 'q9', area: 'residuos', texto: 'Recogida selectiva de residuos', norma: 'Ley 8/2019', desde: '2022-06-17' },
  { id: 'q10', area: 'general', texto: 'Limpieza diaria en establecimientos categorizados por estrellas', norma: 'Ley 3/2022', desde: '2022-06-17' },
  { id: 'q11', area: 'general', texto: 'Sin autodispensadores de bebidas alcohólicas', norma: 'Ley 3/2022', desde: '2022-06-17' },
  { id: 'q12', area: 'general', texto: 'Plan de circularidad disponible para la administración y los representantes de los trabajadores, con revisión anual', norma: 'Ley 3/2022', desde: '2023-05-01' },
];

/** Camas elevables: porcentaje mínimo por categoría y año (resumen de la guía; verificar con el texto legal). */
export type CategoriaHotel = '5' | '4S' | '4' | '1-3';
export const CATEGORIAS_HOTEL: Record<CategoriaHotel, string> = { '5': '5 estrellas', '4S': '4 estrellas superior', '4': '4 estrellas', '1-3': '1, 2 y 3 estrellas (incl. hoteles rurales)' };
const CAMAS: Record<CategoriaHotel, Record<number, number>> = {
  '5': { 2023: 30, 2024: 50, 2025: 60, 2026: 75, 2027: 100 },
  '4S': { 2023: 25, 2024: 40, 2025: 50, 2026: 75, 2027: 100 },
  '4': { 2023: 20, 2024: 30, 2025: 40, 2026: 60, 2027: 75, 2028: 100 },
  '1-3': { 2024: 15, 2025: 30, 2026: 50, 2027: 75, 2028: 100 },
};
/** Porcentaje de camas elevables exigido ese año (0 antes de que empiece la obligación; el último valor se mantiene después). */
export function camasElevablesExigidas(cat: CategoriaHotel, anio: number): number {
  const t = CAMAS[cat]; const anios = Object.keys(t).map(Number).sort((a, b) => a - b);
  if (anio < anios[0]) return 0;
  if (anio >= anios[anios.length - 1]) return t[anios[anios.length - 1]];
  return t[anio] ?? 0;
}
export const tablaCamas = () => (Object.keys(CAMAS) as CategoriaHotel[]).map((c) => ({ categoria: c, nombre: CATEGORIAS_HOTEL[c], porAnio: [2023, 2024, 2025, 2026, 2027, 2028].map((a) => camasElevablesExigidas(c, a) || null) }));

// ───────────── Medidas sugeridas (para elegir al planificar) ─────────────
export interface MedidaSugerida { area: Area; objetivo: string; indicador: string; acciones: string[] }
export const MEDIDAS: MedidaSugerida[] = [
  { area: 'energia', objetivo: 'Reducir la huella de carbono un 5 %', indicador: 'E1', acciones: ['Estudio de consumo y potencial de reducción', 'Contadores de consumo eléctrico y monitorización', 'Centralizar la temperatura de A/A y calefacción', 'Anular el A/A al abrir terrazas o abandonar la habitación', 'Protocolo de ahorro eléctrico y concienciación del personal', 'Sensibilización del cliente'] },
  { area: 'energia', objetivo: 'Incrementar la potencia renovable instalada', indicador: 'E4', acciones: ['Contactar con empresa instaladora', 'Solicitar presupuestos', 'Instalar las placas', 'Instalar baterías de almacenamiento'] },
  { area: 'agua', objetivo: 'Reducir el consumo de agua un 5 %', indicador: 'A2', acciones: ['Estudio del consumo actual', 'Contadores de agua y alarmas de consumo excesivo', 'Aireadores y reductores de flujo', 'Cisternas de doble pulsación', 'Toallas de piscina y cambio a petición del cliente', 'Sensibilización del cliente'] },
  { area: 'residuos', objetivo: 'Mejorar la segregación de residuos', indicador: 'R2', acciones: ['Auditoría de residuos por fracción', 'Recogida selectiva en habitaciones y cocina', 'Formación del personal', 'Eliminar amenities desechables'] },
  { area: 'alimentos', objetivo: 'Incrementar la compra de producto local (km 0)', indicador: 'AL1', acciones: ['Estudio de proveedores locales', 'Incorporar productos de Baleares a la carta y al buffet', 'Identificar el origen en la carta'] },
  { area: 'alimentos', objetivo: 'Reducir envases de un solo uso en la compra', indicador: 'AL2', acciones: ['Compra a granel y envases reutilizables', 'Acuerdos con proveedores', 'Sustituir monodosis'] },
  { area: 'gobernanza', objetivo: 'Formar a la plantilla en circularidad', indicador: 'G2', acciones: ['Plan anual de formación', 'Formación a nuevas incorporaciones', 'Registro de asistentes'] },
  { area: 'gobernanza', objetivo: 'Incrementar proveedores con código de conducta circular', indicador: 'G3', acciones: ['Cuestionario ambiental a proveedores', 'Priorizar proveedores con Ecolabel o EMAS', 'Cláusulas en contratos'] },
];
