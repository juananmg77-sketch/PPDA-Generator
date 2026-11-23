// Calculadora oficial del Registro balear de huella de carbono (Govern de les Illes Balears) cumplimentada con los datos de un inventario.
// Se rellena el propio libro oficial editando solo el XML de las celdas de entrada: así se conservan las fórmulas, las listas
// desplegables, la protección de hojas y el formato. Excel recalcula los resultados (hojas 4.x) al abrirlo.
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import type { Categoria, OrigenElectricidad } from './tipos.ts';

export interface LineaOficial {
  centro: string;
  categoria: Categoria;
  /** Clave del factor: «Gasóleo C (l)», «B7 (l)|Furgonetas y furgones (N1)», «HFC-134a»… o vacío (electricidad). */
  fuente: string;
  /** Ya multiplicada por el reparto (unidad del factor; kWh en electricidad; kg en gases). */
  cantidad: number;
  origenElectricidad?: OrigenElectricidad;
  /** Comercializadora (electricidad). */
  proveedor?: string;
}
export interface CentroOficial { nombre: string; enBaleares: boolean; isla?: string | null; municipio?: string | null; direccion?: string | null }
export interface DatosOficiales {
  anio: number;
  organizacion: { nombre: string; cif?: string | null; cnae?: string | null };
  centros: CentroOficial[];
  indice?: { nombre: string; valor: number; unidades: string };
  /** El libro se entrega para verificación (o ya verificado). */
  verificacion: boolean;
  lineas: LineaOficial[];
}
export interface Celda { hoja: string; ref: string; valor: string | number }
export interface PlanCalculadora { celdas: Celda[]; /** Avisos que pueden afectar a las cifras. */ avisos: string[]; /** Datos que el libro pide y la app no tiene. */ pendientes: string[] }

export const HOJAS = {
  org: '0.1_Datos generales organiz.', fijas: '1.1_Instalaciones fijas', vehiculos: '1.2_Vehículos y maquinaria', fugitivas: '1.4_Emisiones fugitivas', electricidad: '2.1_Categoría 2 Balears',
} as const;
/** Filas de entrada de cada bloque del libro oficial (no se pueden añadir más: las hojas están protegidas). */
const CAP = { centros: [44, 293], fijas: [15, 36], vehUnidad: [23, 44], vehKm: [51, 70], fugitivas: [15, 36], electricidad: [18, 39] } as const;

/** Sección de la CNAE-2009 a partir de su división (los dos primeros dígitos). */
export function sectorDesdeCnae(cnae?: string | null): string | null {
  const d = Number((cnae ?? '').replace(/\D/g, '').slice(0, 2));
  if (!d) return null;
  const tramos: Array<[number, number, string]> = [
    [1, 3, 'A.- Agricultura, ganadería, silvicultura y pesca'], [5, 9, 'B.- Industrias extractivas'], [10, 33, 'C.- Industria manufacturera'],
    [35, 35, 'D.- Suministro de energía eléctrica, gas, vapor y aire acondicionado'], [36, 39, 'E.- Suministro de agua, actividades de saneamiento, gestión de residuos y descontaminación'],
    [41, 43, 'F.- Construcción'], [45, 47, 'G.- Comercio al por mayor y al por menor; reparación de vehículos de motor y motocicletes'], [49, 53, 'H.- Transporte i almacenaje'],
    [55, 56, 'I.- Hostelería'], [58, 63, 'J.- Información y comunicaciones'], [64, 66, 'K.- Actividades financieras y de seguros'], [68, 68, 'L.- Actividades immobiliarias'],
    [69, 75, 'M.- Actividades profesionales, científicas y técnicas'], [77, 82, 'N.- Actividades administrativas y servicios auxiliares'], [84, 84, 'O.- Administración pública y defensa; seguridad social obligatoria'],
    [85, 85, 'P.- Educación'], [86, 88, 'Q.- Actividades sanitarias y de servicios sociales'], [90, 93, 'R.- Actividades artísticas, recreativas y de entretenimiento'], [94, 96, 'S.- Otros servicios'],
  ];
  return tramos.find(([a, b]) => d >= a && d <= b)?.[2] ?? null;
}

/** Combustibles que el libro calcula pero no ofrece en el desplegable de su hoja (versiones recientes). */
const FUERA_DE_DESPLEGABLE = new Set(['Gasolina  (l)', 'Gasóleo A (l)', 'Gasolina (l)', 'Gasóleo (l)']);
const redondear = (v: number) => Math.round(v * 1e6) / 1e6;

/** Suma por clave conservando el orden de aparición. */
function agrupar<T>(items: T[], clave: (x: T) => string, valor: (x: T) => number): Array<{ x: T; total: number }> {
  const m = new Map<string, { x: T; total: number }>();
  for (const it of items) { const k = clave(it); const e = m.get(k); if (e) e.total += valor(it); else m.set(k, { x: it, total: valor(it) }); }
  return [...m.values()];
}

/** Traduce el inventario a celdas del libro oficial. */
export function planCalculadora(d: DatosOficiales): PlanCalculadora {
  const celdas: Celda[] = []; const avisos: string[] = []; const pendientes: string[] = [];
  const poner = (hoja: string, ref: string, valor: string | number | null | undefined) => { if (valor !== null && valor !== undefined && valor !== '') celdas.push({ hoja, ref, valor }); };
  const hay = (nombre: string, filas: number, [a, b]: readonly [number, number], hoja: string) => {
    if (filas > b - a + 1) throw new Error(`El bloque «${nombre}» de la hoja ${hoja} tiene ${filas} filas y el libro oficial solo admite ${b - a + 1}. Reduzca el número de combinaciones centro/fuente o divida el cálculo.`);
  };

  // 0.1 Datos generales
  const o = HOJAS.org;
  poner(o, 'G3', d.anio);
  poner(o, 'D6', d.organizacion.nombre); poner(o, 'J6', d.organizacion.cif);
  const sector = sectorDesdeCnae(d.organizacion.cnae);
  if (sector) poner(o, 'D9', sector); else pendientes.push('Sector de la organización (falta el CNAE).');
  pendientes.push('Tipo de organización (Micro, Pequeña, Mediana, Gran empresa…): no consta en la aplicación.');
  poner(o, 'H11', d.verificacion ? 'Sí' : 'No');
  poner(o, 'J14', 'No');
  poner(o, 'O6', d.organizacion.nombre); poner(o, 'P6', d.organizacion.cif); poner(o, 'Q6', 'Sí');
  if (d.indice && d.indice.valor > 0) { poner(o, 'E22', d.indice.nombre); poner(o, 'F22', d.indice.valor); poner(o, 'G22', d.indice.unidades); }
  else pendientes.push('Índice de actividad (estancias): sin indicar.');
  hay('centros', d.centros.length, CAP.centros, o);
  if (new Set(d.centros.map((c) => c.nombre)).size !== d.centros.length) avisos.push('Hay centros con el mismo nombre: el libro los identifica por nombre y los datos podrían mezclarse.');
  d.centros.forEach((c, i) => {
    const r = CAP.centros[0] + i;
    poner(o, `E${r}`, c.nombre); poner(o, `G${r}`, c.enBaleares ? 'Sí' : 'No');
    if (c.enBaleares) { poner(o, `H${r}`, c.isla); poner(o, `I${r}`, c.municipio); }
    poner(o, `J${r}`, c.direccion); poner(o, `M${r}`, d.organizacion.nombre);
  });
  if (d.centros.some((c) => !c.enBaleares)) avisos.push('Hay centros fuera de las Illes Balears: la hoja 2.1 (registro balear) solo admite centros baleares; su electricidad no se ha trasladado correctamente.');
  if (d.centros.some((c) => c.enBaleares && (!c.isla || !c.municipio))) pendientes.push('Isla y municipio de algún centro balear (el libro los exige y son listas cerradas).');
  pendientes.push('Coordenadas (latitud y longitud) de los centros.');

  // 1.1 Instalaciones fijas
  const fijas = agrupar(d.lineas.filter((l) => l.categoria === 'combustion_fija'), (l) => `${l.centro}|${l.fuente}`, (l) => l.cantidad);
  hay('Instalaciones fijas', fijas.length, CAP.fijas, HOJAS.fijas);
  fijas.forEach(({ x, total }, i) => { const r = CAP.fijas[0] + i; poner(HOJAS.fijas, `E${r}`, x.centro); poner(HOJAS.fijas, `G${r}`, x.fuente); poner(HOJAS.fijas, `H${r}`, redondear(total)); });

  // 1.2 Vehículos: opción A.1 (combustible) y A.2 (kilómetros)
  const mov = d.lineas.filter((l) => l.categoria === 'combustion_movil');
  const porKm = mov.filter((l) => /\(km\)\|/.test(l.fuente)); const porUd = mov.filter((l) => !/\(km\)\|/.test(l.fuente));
  const escribirVeh = (lista: typeof mov, cap: readonly [number, number], nombre: string) => {
    const g = agrupar(lista, (l) => `${l.centro}|${l.fuente}`, (l) => l.cantidad); hay(nombre, g.length, cap, HOJAS.vehiculos);
    g.forEach(({ x, total }, i) => {
      const r = cap[0] + i; const [comb, cat] = x.fuente.split('|');
      poner(HOJAS.vehiculos, `E${r}`, x.centro); poner(HOJAS.vehiculos, `G${r}`, cat ?? ''); poner(HOJAS.vehiculos, `H${r}`, comb); poner(HOJAS.vehiculos, `I${r}`, redondear(total));
    });
  };
  escribirVeh(porUd, CAP.vehUnidad, 'Vehículos (combustible)'); escribirVeh(porKm, CAP.vehKm, 'Vehículos (kilómetros)');

  // 1.4 Fugitivas: recarga anual de cada gas
  const fug = agrupar(d.lineas.filter((l) => l.categoria === 'fugitiva'), (l) => `${l.centro}|${l.fuente}`, (l) => l.cantidad);
  hay('Emisiones fugitivas', fug.length, CAP.fugitivas, HOJAS.fugitivas);
  fug.forEach(({ x, total }, i) => { const r = CAP.fugitivas[0] + i; poner(HOJAS.fugitivas, `E${r}`, x.centro); poner(HOJAS.fugitivas, `G${r}`, x.fuente); poner(HOJAS.fugitivas, `N${r}`, redondear(total)); });
  if (fug.length) avisos.push('Gases fugitivos: se han declarado como recarga anual (kg) en la tabla A de equipos; el libro pide además tipo de equipo y carga inicial, que la aplicación no recoge.');

  // 2.1 Electricidad: edificio, comercializadora, tipo de energía y kWh
  const tipoEnergia = (l: LineaOficial) => (l.origenElectricidad === 'autoconsumo' ? 'Autoconsumo' : l.origenElectricidad === 'gdo_renovable_balear' ? 'GdO origen renovable Illes Balears' : 'No');
  const elec = agrupar(d.lineas.filter((l) => l.categoria === 'electricidad'), (l) => `${l.centro}|${l.proveedor ?? ''}|${tipoEnergia(l)}`, (l) => l.cantidad);
  hay('Electricidad', elec.length, CAP.electricidad, HOJAS.electricidad);
  elec.forEach(({ x, total }, i) => {
    const r = CAP.electricidad[0] + i;
    poner(HOJAS.electricidad, `E${r}`, x.centro); poner(HOJAS.electricidad, `F${r}`, x.proveedor || 'No consta'); poner(HOJAS.electricidad, `G${r}`, tipoEnergia(x)); poner(HOJAS.electricidad, `H${r}`, redondear(total));
  });
  if (elec.some(({ x }) => !x.proveedor)) avisos.push('Electricidad: hay facturas sin comercializadora identificada («No consta»).');
  if (elec.length) avisos.push('Electricidad: la comercializadora se ha escrito tal como figura en la factura; el libro tiene una lista cerrada por año y conviene elegirla allí.');
  if (d.lineas.some((l) => l.categoria === 'electricidad' && l.origenElectricidad === 'gdo_otra')) avisos.push('Electricidad con garantía de origen renovable de fuera de Baleares: el registro balear la trata como energía de red («No»).');

  const raros = [...new Set(d.lineas.filter((l) => l.categoria !== 'electricidad' && l.categoria !== 'fugitiva').map((l) => l.fuente.split('|')[0]).filter((f) => FUERA_DE_DESPLEGABLE.has(f)))];
  if (raros.length) avisos.push(`Combustibles que no figuran en el desplegable de su hoja (${raros.join(', ')}): compruebe que el libro los calcula.`);
  return { celdas, avisos, pendientes };
}

// ───────────────────────────── Edición del XML del libro ─────────────────────────────
const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colNum = (ref: string) => [...ref.replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const filaDe = (ref: string) => Number(ref.replace(/\D/g, ''));

function celdaXml(ref: string, estilo: string | null, valor: string | number): string {
  const s = estilo ? ` s="${estilo}"` : '';
  if (typeof valor === 'number') return `<c r="${ref}"${s}><v>${valor}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escXml(valor)}</t></is></c>`;
}

/** Escribe valores en las celdas indicadas de una hoja (XML de worksheet), conservando el estilo de cada celda. */
export function ponerCeldasEnHoja(xml: string, celdas: Array<{ ref: string; valor: string | number }>): string {
  const porFila = new Map<number, Array<{ ref: string; valor: string | number }>>();
  for (const c of celdas) { const f = filaDe(c.ref); porFila.set(f, [...(porFila.get(f) ?? []), c]); }
  let salida = xml;
  for (const [fila, lista] of [...porFila.entries()].sort((a, b) => a[0] - b[0])) {
    const reFila = new RegExp(`<row\\b[^>]*?\\br="${fila}"[^>]*?(?:/>|>[\\s\\S]*?</row>)`);
    const m = reFila.exec(salida);
    if (!m) {
      // fila inexistente: se crea en su sitio dentro de sheetData
      const nueva = `<row r="${fila}">${lista.sort((a, b) => colNum(a.ref) - colNum(b.ref)).map((c) => celdaXml(c.ref, null, c.valor)).join('')}</row>`;
      const filas = [...salida.matchAll(/<row\b[^>]*?\br="(\d+)"/g)];
      const siguiente = filas.find((x) => Number(x[1]) > fila);
      if (siguiente) salida = salida.slice(0, siguiente.index!) + nueva + salida.slice(siguiente.index!);
      else if (/<sheetData\s*\/>/.test(salida)) salida = salida.replace(/<sheetData\s*\/>/, `<sheetData>${nueva}</sheetData>`);
      else salida = salida.replace('</sheetData>', `${nueva}</sheetData>`);
      continue;
    }
    let filaXml = m[0];
    const abre = /^<row\b[^>]*?>/.exec(filaXml)![0];
    if (abre.endsWith('/>')) filaXml = abre.slice(0, -2) + '></row>';
    for (const c of lista.sort((a, b) => colNum(a.ref) - colNum(b.ref))) {
      const reCelda = new RegExp(`<c\\b[^>]*?\\br="${c.ref}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`);
      const cm = reCelda.exec(filaXml);
      if (cm) {
        const estilo = /\bs="(\d+)"/.exec(/^<c\b[^>]*?>/.exec(cm[0])![0])?.[1] ?? null;
        filaXml = filaXml.replace(cm[0], celdaXml(c.ref, estilo, c.valor));
      } else {
        const todas = [...filaXml.matchAll(/<c\b[^>]*?\br="([A-Z]+)\d+"/g)];
        const sig = todas.find((x) => colNum(x[1]) > colNum(c.ref));
        const nueva = celdaXml(c.ref, null, c.valor);
        filaXml = sig ? filaXml.slice(0, sig.index!) + nueva + filaXml.slice(sig.index!) : filaXml.replace('</row>', `${nueva}</row>`);
      }
    }
    salida = salida.replace(m[0], filaXml);
  }
  return salida;
}

/** Nombre del archivo XML de cada hoja, a partir de workbook.xml y sus relaciones. */
function archivosDeHojas(wbXml: string, relsXml: string): Record<string, string> {
  const dest: Record<string, string> = {};
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1]; const t = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
    if (id && t) dest[id] = t.replace(/^\/?(xl\/)?/, 'xl/');
  }
  const out: Record<string, string> = {};
  for (const m of wbXml.matchAll(/<sheet\b[^>]*>/g)) {
    const nombre = /\bname="([^"]+)"/.exec(m[0])?.[1]; const rid = /\br:id="([^"]+)"/.exec(m[0])?.[1];
    if (nombre && rid && dest[rid]) out[nombre.replace(/&amp;/g, '&')] = dest[rid];
  }
  return out;
}

/** Rellena el libro oficial con las celdas indicadas y lo marca para recalcular al abrirlo. */
export function rellenarLibro(plantilla: Uint8Array, celdas: Celda[]): Uint8Array {
  const ficheros = unzipSync(plantilla);
  const wbXml = strFromU8(ficheros['xl/workbook.xml']);
  const hojas = archivosDeHojas(wbXml, strFromU8(ficheros['xl/_rels/workbook.xml.rels']));
  const porHoja = new Map<string, Celda[]>();
  for (const c of celdas) porHoja.set(c.hoja, [...(porHoja.get(c.hoja) ?? []), c]);
  for (const [hoja, lista] of porHoja) {
    const ruta = hojas[hoja];
    if (!ruta || !ficheros[ruta]) throw new Error(`La plantilla no tiene la hoja «${hoja}»: no es la calculadora oficial esperada.`);
    ficheros[ruta] = strToU8(ponerCeldasEnHoja(strFromU8(ficheros[ruta]), lista));
  }
  // Excel recalcula todo al abrir: los resultados (hojas 4.x) salen de las fórmulas oficiales
  ficheros['xl/workbook.xml'] = strToU8(wbXml.replace(/<calcPr\b([^>]*?)\/>/, (_m, a: string) => `<calcPr${a.replace(/\sfullCalcOnLoad="[^"]*"/, '')} fullCalcOnLoad="1"/>`));
  return zipSync(ficheros, { level: 6 });
}

/** Versiones de la calculadora oficial incorporadas (coinciden con los conjuntos de factores de la aplicación). */
export const VERSIONES_CALCULADORA = ['2023.2', '2024.1'] as const;
export function versionDeFactores(version?: string | null): string | null {
  const v = (version ?? '').replace(/^calculadora-/, '');
  return (VERSIONES_CALCULADORA as readonly string[]).includes(v) ? v : null;
}

export function rellenarCalculadora(plantilla: Uint8Array, d: DatosOficiales): { bytes: Uint8Array; avisos: string[]; pendientes: string[] } {
  const plan = planCalculadora(d);
  return { bytes: rellenarLibro(plantilla, plan.celdas), avisos: plan.avisos, pendientes: plan.pendientes };
}
