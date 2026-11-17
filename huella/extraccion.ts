// Validación de la lectura de facturas y propuesta de líneas de actividad.
// La lectura automática (IA) solo PROPONE datos; todo pasa por estas comprobaciones y por una revisión humana obligatoria.
import type { ConjuntoFactores, LineaActividad } from './tipos.ts';

export type TipoFactura = 'electricidad' | 'gas_natural' | 'gasoleo' | 'glp' | 'combustible_vehiculo' | 'refrigerante' | 'otro';

/** Lo que devuelve la lectura automática de una factura (todos los campos son propuestas). */
export interface ExtraccionFactura {
  tipo: TipoFactura;
  proveedor?: string;
  /** Punto de suministro: CUPS (luz y gas), nº de contador o de instalación, tal como figura. «VARIOS» si la factura agrupa varios. */
  contador?: string;
  periodoDesde?: string; // AAAA-MM-DD
  periodoHasta?: string;
  cantidad?: number;
  /** Unidad tal como figura en la factura: kWh, kWh PCS, kWh PCI, m3, l, kg... */
  unidad?: string;
  importe?: number;
  /** Combustible o gas concreto si la factura lo indica (p. ej. «Gasóleo C», «R-410A», «Gasolina 95»). */
  producto?: string;
  /** Electricidad: ¿garantía de origen renovable? ¿de Baleares? */
  garantiaOrigen?: 'no' | 'renovable_balear' | 'renovable_otra' | 'desconocida';
  confianza?: number; // 0..1
}

export type Gravedad = 'error' | 'aviso';
export interface Incidencia { gravedad: Gravedad; codigo: string; mensaje: string }

export interface ContextoValidacion {
  anioInventario: number;
  factores: ConjuntoFactores;
  /** Facturas ya cargadas, para detectar duplicados y solapes. */
  existentes?: Array<{ id: string; proveedor?: string; contador?: string; periodoDesde?: string; periodoHasta?: string; cantidad?: number; tipo: TipoFactura }>;
}

const UNIDAD_ESPERADA: Record<TipoFactura, string[]> = {
  electricidad: ['kwh'],
  gas_natural: ['kwh pcs'],
  gasoleo: ['l', 'litros'],
  glp: ['l', 'litros', 'kg'],
  combustible_vehiculo: ['l', 'litros', 'kg'],
  refrigerante: ['kg'],
  otro: [],
};

const norm = (s?: string) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const fecha = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00Z') : null);

export function validarExtraccion(e: ExtraccionFactura, c: ContextoValidacion): Incidencia[] {
  const out: Incidencia[] = [];
  const add = (gravedad: Gravedad, codigo: string, mensaje: string) => out.push({ gravedad, codigo, mensaje });

  if (e.tipo === 'otro') add('aviso', 'tipo_otro', 'La factura no se ha clasificado en un tipo con factor de emisión: hay que decidir cómo se trata o excluirla con justificación.');
  if (typeof e.cantidad !== 'number' || !(e.cantidad >= 0)) add('error', 'cantidad', 'Falta una cantidad válida (no negativa).');
  if (e.cantidad === 0) add('aviso', 'cantidad_cero', 'La cantidad es cero: confirme que no es un error de lectura.');
  if (!e.unidad) add('error', 'unidad', 'Falta la unidad de la cantidad.');

  // Unidad esperada según el tipo (el gas natural exige kWh PCS; con PCI o m3 hay que convertir con el dato de la factura)
  const u = norm(e.unidad);
  const esperadas = UNIDAD_ESPERADA[e.tipo];
  if (u && esperadas.length && !esperadas.includes(u)) {
    if (e.tipo === 'gas_natural' && (u === 'kwh' || u === 'kwh pci' || u === 'm3' || u === 'm³')) {
      add('error', 'unidad_gas', `La calculadora oficial usa kWh PCS y la factura indica «${e.unidad}»: confirme si el kWh es PCS o convierta con el dato de la factura.`);
    } else {
      add('error', 'unidad_incoherente', `Unidad «${e.unidad}» no esperada para una factura de ${e.tipo} (se esperaba ${esperadas.join(' o ')}).`);
    }
  }

  // Periodo
  const d = fecha(e.periodoDesde);
  const h = fecha(e.periodoHasta);
  if (!d || !h) add('error', 'periodo', 'Falta el periodo de facturación (desde y hasta).');
  else {
    if (h < d) add('error', 'periodo_invertido', 'El fin del periodo es anterior al inicio.');
    const ini = Date.UTC(c.anioInventario, 0, 1);
    const fin = Date.UTC(c.anioInventario, 11, 31);
    if (h.getTime() < ini || d.getTime() > fin) add('error', 'fuera_de_anio', `El periodo está fuera del año del inventario (${c.anioInventario}).`);
    else if (d.getTime() < ini || h.getTime() > fin) add('aviso', 'cruza_anio', 'El periodo cruza dos años: hay que repartir el consumo entre ambos (con su justificación).');
    const dias = (h.getTime() - d.getTime()) / 86400000 + 1;
    if (dias > 100) add('aviso', 'periodo_largo', `El periodo abarca ${Math.round(dias)} días: compruebe si es una factura de regularización o varias juntas.`);
  }

  // Producto con factor
  if (e.producto && ['gasoleo', 'glp', 'combustible_vehiculo', 'gas_natural'].includes(e.tipo)) {
    const encontrado = Object.keys(c.factores.combustibles).some((k) => norm(k).startsWith(norm(e.producto)));
    if (!encontrado) add('aviso', 'producto_sin_factor', `No hay un factor claro para «${e.producto}» en el conjunto ${c.factores.id}: elija el combustible de la lista.`);
  }
  if (e.tipo === 'refrigerante' && e.producto && !(e.producto in c.factores.pcaRefrigerantes)) {
    add('error', 'gas_sin_pca', `No hay potencial de calentamiento para «${e.producto}» en el conjunto ${c.factores.id}.`);
  }

  // Electricidad: origen
  if (e.tipo === 'electricidad' && (!e.garantiaOrigen || e.garantiaOrigen === 'desconocida')) {
    add('aviso', 'origen_electricidad', 'No consta el origen de la electricidad (garantía de origen): se tratará como energía de red salvo que se acredite.');
  }

  // Contador / punto de suministro
  if (norm(e.contador) === 'varios') add('aviso', 'varios_contadores', 'La factura agrupa varios contadores o suministros: sepárelos en líneas distintas (un dato por contador) en la pestaña Actividad.');

  // Duplicados y solapes con facturas ya cargadas. Dos facturas que se solapan pueden ser de contadores distintos:
  // solo se comparan entre sí las del mismo contador; si falta el contador en alguna, se avisa de que hay que identificarlo.
  for (const x of c.existentes ?? []) {
    if (x.tipo !== e.tipo) continue;
    if (!(x.proveedor && e.proveedor && norm(x.proveedor) === norm(e.proveedor))) continue;
    const cx = norm(x.contador), ce = norm(e.contador);
    if (cx && ce && cx !== ce) continue; // contadores distintos: no hay conflicto, se suman por separado
    const contadorConocido = !!cx && !!ce;
    const sufijo = contadorConocido ? '' : ' Si son de contadores distintos, indique el contador (CUPS) en cada una.';
    if (x.periodoDesde === e.periodoDesde && x.periodoHasta === e.periodoHasta) {
      add(x.cantidad === e.cantidad ? 'error' : 'aviso', x.cantidad === e.cantidad ? 'duplicada' : 'mismo_periodo',
        x.cantidad === e.cantidad ? `Parece duplicada de la factura ${x.id}.${sufijo}` : `Hay otra factura del mismo proveedor y periodo (${x.id}) con distinta cantidad.${sufijo}`);
    } else {
      const xd = fecha(x.periodoDesde), xh = fecha(x.periodoHasta);
      if (xd && xh && d && h && d <= xh && h >= xd) add('aviso', 'solape', `El periodo se solapa con el de la factura ${x.id} del mismo proveedor.${sufijo}`);
    }
  }

  if (typeof e.confianza === 'number' && e.confianza < 0.8) add('aviso', 'confianza_baja', `La lectura automática tiene una confianza baja (${Math.round(e.confianza * 100)} %): revise todos los campos.`);
  return out;
}

/** Convierte una lectura revisada en una línea de actividad en borrador. La confirmación la hace siempre una persona. */
export function proponerActividad(
  e: ExtraccionFactura,
  o: { id: string; centro: string; documentoId: string; fuenteFactor?: string },
): LineaActividad {
  const categoria: LineaActividad['categoria'] =
    e.tipo === 'electricidad' ? 'electricidad'
    : e.tipo === 'refrigerante' ? 'fugitiva'
    : e.tipo === 'combustible_vehiculo' ? 'combustion_movil'
    : 'combustion_fija';
  const origen: LineaActividad['origenElectricidad'] | undefined =
    e.tipo !== 'electricidad' ? undefined
    : e.garantiaOrigen === 'renovable_balear' ? 'gdo_renovable_balear'
    : e.garantiaOrigen === 'renovable_otra' ? 'gdo_otra'
    : 'red';
  const fuente =
    e.tipo === 'electricidad' ? ''
    : e.tipo === 'gas_natural' ? 'Gas natural (kWhPCS)*'
    : o.fuenteFactor ?? e.producto ?? '';
  return {
    id: o.id,
    centro: o.centro,
    categoria,
    fuente,
    cantidad: e.cantidad ?? 0,
    origenElectricidad: origen,
    evidencia: o.documentoId,
    contador: e.contador || undefined,
  };
}

/** Variación respecto al año anterior: los modelos de referencia exigen analizar la causa si supera el umbral (20 % por defecto). */
export function variacionAnual(actual: number, anterior: number, umbral = 0.2): { variacion: number | null; analizar: boolean } {
  if (!(anterior > 0)) return { variacion: null, analizar: false };
  const v = (actual - anterior) / anterior;
  return { variacion: v, analizar: Math.abs(v) > umbral };
}

/** Criterio de exclusión por insignificancia: cada fuente < 3 % y el total excluido ≤ 5 % (valores configurables). */
export function evaluarExclusiones(
  fuentes: Array<{ fuente: string; kgCO2e: number }>,
  candidatas: string[],
  cfg = { porFuente: 0.03, total: 0.05 },
): { permitido: boolean; detalle: Array<{ fuente: string; porcentaje: number; cumple: boolean }>; porcentajeTotal: number } {
  const total = fuentes.reduce((s, x) => s + x.kgCO2e, 0);
  const detalle = candidatas.map((f) => {
    const kg = fuentes.filter((x) => x.fuente === f).reduce((s, x) => s + x.kgCO2e, 0);
    const porcentaje = total > 0 ? kg / total : 0;
    return { fuente: f, porcentaje, cumple: porcentaje < cfg.porFuente };
  });
  const porcentajeTotal = detalle.reduce((s, x) => s + x.porcentaje, 0);
  return { permitido: detalle.every((x) => x.cumple) && porcentajeTotal <= cfg.total, detalle, porcentajeTotal };
}
