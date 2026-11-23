// Datos legales de la organización del inventario: razón social (frente al nombre comercial), forma jurídica según el CIF, criterio de consolidación único
// y responsable del informe. Todo lo que el informe afirma sale de estos datos; si falta uno obligatorio es una incidencia, no un valor vacío.

export type CriterioConsolidacion = 'control_operativo' | 'control_financiero' | 'cuota_participacion';
export const CRITERIOS_CONSOLIDACION: ReadonlyArray<{ id: CriterioConsolidacion; titulo: string; descripcion: string }> = [
  { id: 'control_operativo', titulo: 'Control operativo', descripcion: 'Se contabiliza el 100 % de las emisiones de las instalaciones sobre las que la organización tiene el control operativo.' },
  { id: 'control_financiero', titulo: 'Control financiero', descripcion: 'Se contabiliza el 100 % de las emisiones de las instalaciones sobre las que la organización tiene el control financiero.' },
  { id: 'cuota_participacion', titulo: 'Cuota de participación', descripcion: 'Se contabiliza la parte de las emisiones que corresponde a la participación de la organización en cada instalación.' },
];
export const tituloCriterio = (c?: string | null) => CRITERIOS_CONSOLIDACION.find((x) => x.id === c)?.titulo ?? null;
export const esCriterio = (c?: string | null): c is CriterioConsolidacion => CRITERIOS_CONSOLIDACION.some((x) => x.id === c);

/** Formas jurídicas reconocibles en una razón social y a qué letra de CIF corresponden. Tabla de datos: se amplía aquí. */
export interface FormaJuridica { codigo: string; patron: RegExp; letrasCif: string[] }
export const FORMAS_JURIDICAS: FormaJuridica[] = [
  { codigo: 'S.L.U.', patron: /\b(?:S\.?\s?L\.?\s?U\.?|SOCIEDAD\s+LIMITADA\s+UNIPERSONAL)(?![A-Za-z])/i, letrasCif: ['B'] },
  { codigo: 'S.L.', patron: /\b(?:S\.?\s?L\.?|SOCIEDAD\s+LIMITADA)(?![A-Za-z])/i, letrasCif: ['B'] },
  { codigo: 'S.A.U.', patron: /\b(?:S\.?\s?A\.?\s?U\.?|SOCIEDAD\s+AN[ÓO]NIMA\s+UNIPERSONAL)(?![A-Za-z])/i, letrasCif: ['A'] },
  { codigo: 'S.A.', patron: /\b(?:S\.?\s?A\.?|SOCIEDAD\s+AN[ÓO]NIMA)(?![A-Za-z])/i, letrasCif: ['A'] },
  { codigo: 'S.Coop.', patron: /\b(?:S\.?\s?COOP\.?|SOCIEDAD\s+COOPERATIVA)(?![A-Za-z])/i, letrasCif: ['F'] },
  { codigo: 'C.B.', patron: /\b(?:C\.?\s?B\.?|COMUNIDAD\s+DE\s+BIENES)(?![A-Za-z])/i, letrasCif: ['E'] },
  { codigo: 'S.C.', patron: /\b(?:S\.?\s?C\.?|SOCIEDAD\s+(?:CIVIL|COLECTIVA))(?![A-Za-z])/i, letrasCif: ['C', 'J'] },
];
/** Letras de CIF de las que se exige una forma jurídica en la razón social (sociedades mercantiles). */
export const LETRAS_CIF_CON_FORMA = ['A', 'B'];

/** Forma jurídica detectada al final de la razón social (la más específica). */
export const formaJuridicaDe = (razonSocial: string): FormaJuridica | null => FORMAS_JURIDICAS.find((f) => f.patron.test(razonSocial.trim())) ?? null;

const limpiar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.,;:\-_'"()]/g, ' ').replace(/\s+/g, ' ').trim();
const sinForma = (s: string) => limpiar(s).replace(/\b(s l u|s l|s a u|s a|sl|slu|sa|sau|sociedad limitada|sociedad anonima)\b/g, '').replace(/\s+/g, ' ').trim();

/** Avisos sobre la razón social: coincide con el nombre comercial, o la forma jurídica no encaja con la letra del CIF. */
export function avisosRazonSocial(razonSocial: string | null | undefined, nombreComercial: string | null | undefined, cif: string | null | undefined): string[] {
  const rs = (razonSocial ?? '').trim();
  if (!rs) return [];
  const avisos: string[] = [];
  if (nombreComercial && sinForma(rs) === sinForma(nombreComercial) && sinForma(rs) !== '') avisos.push('La razón social coincide con el nombre comercial: indique la denominación legal completa, tal como figura en el CIF.');
  const letra = (cif ?? '').trim().charAt(0).toUpperCase();
  const forma = formaJuridicaDe(rs);
  if (letra && forma && !forma.letrasCif.includes(letra)) avisos.push(`La forma jurídica «${forma.codigo}» no encaja con el CIF (${letra}…): ${letra === 'B' ? 'una B corresponde a S.L. o S.L.U.' : letra === 'A' ? 'una A corresponde a S.A. o S.A.U.' : 'revise la letra del CIF o la razón social.'}`);
  else if (letra && !forma && LETRAS_CIF_CON_FORMA.includes(letra)) avisos.push(`La razón social no indica la forma jurídica (con CIF ${letra}… se espera ${letra === 'B' ? 'S.L. o S.L.U.' : 'S.A. o S.A.U.'}).`);
  return avisos;
}

export interface DatosOrganizacion {
  razonSocial?: string | null; nombreComercial?: string | null; cif?: string | null; cnae?: string | null; iae?: string | null;
  criterioConsolidacion?: string | null; justificacionConsolidacion?: string | null;
  responsableNombre?: string | null; responsableCargo?: string | null; responsableEntidad?: string | null; responsableEmail?: string | null;
}
export interface IncidenciaOrganizacion { campo: string; mensaje: string; /** Falta un dato obligatorio para la versión final. */ obligatorio: boolean }

/** Datos obligatorios de la organización para la versión final y avisos sobre los que hay. El correo del responsable es opcional. */
export function validarOrganizacion(o: DatosOrganizacion): IncidenciaOrganizacion[] {
  const falta = (x?: string | null) => !(x ?? '').trim();
  const out: IncidenciaOrganizacion[] = [];
  if (falta(o.razonSocial)) out.push({ campo: 'razonSocial', mensaje: 'Falta la razón social (denominación legal) de la organización.', obligatorio: true });
  if (falta(o.cif)) out.push({ campo: 'cif', mensaje: 'Falta el CIF de la organización.', obligatorio: true });
  if (falta(o.cnae)) out.push({ campo: 'cnae', mensaje: 'Falta el CNAE de la organización.', obligatorio: true });
  if (falta(o.iae)) out.push({ campo: 'iae', mensaje: 'Falta el IAE de la organización.', obligatorio: true });
  if (!esCriterio(o.criterioConsolidacion)) out.push({ campo: 'criterioConsolidacion', mensaje: 'Falta el criterio de consolidación (control operativo, control financiero o cuota de participación).', obligatorio: true });
  else if (falta(o.justificacionConsolidacion)) out.push({ campo: 'justificacionConsolidacion', mensaje: 'Falta la justificación del criterio de consolidación.', obligatorio: true });
  if (falta(o.responsableNombre)) out.push({ campo: 'responsableNombre', mensaje: 'Falta el nombre del responsable del informe.', obligatorio: true });
  if (falta(o.responsableCargo)) out.push({ campo: 'responsableCargo', mensaje: 'Falta el cargo del responsable del informe.', obligatorio: true });
  if (falta(o.responsableEntidad)) out.push({ campo: 'responsableEntidad', mensaje: 'Falta la entidad del responsable del informe.', obligatorio: true });
  for (const m of avisosRazonSocial(o.razonSocial, o.nombreComercial, o.cif)) out.push({ campo: 'razonSocial', mensaje: m, obligatorio: false });
  return out;
}

/** Texto del responsable para el informe, solo con lo que consta (el correo, si lo hay, al final). */
export function textoResponsable(o: DatosOrganizacion): string | null {
  const partes = [o.responsableNombre, o.responsableCargo, o.responsableEntidad].map((x) => (x ?? '').trim()).filter(Boolean);
  if (!partes.length) return null;
  return `${partes.join(', ')}${(o.responsableEmail ?? '').trim() ? ` (${o.responsableEmail!.trim()})` : ''}`;
}
