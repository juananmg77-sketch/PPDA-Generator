// Correspondencia con el contenido del apartado 9.3.1 de la ISO 14064-1: cada apartado se marca Cumple / No cumple / No aplica según los datos del inventario.
export type EstadoApartado = 'Cumple' | 'No cumple' | 'No aplica';
export interface FilaCorrespondencia { apartado: string; contenido: string; seccion: string; estado: EstadoApartado; motivo: string }

/** Hechos del inventario de los que depende cada apartado (los calcula el generador del informe). */
export interface ContextoCorrespondencia {
  organizacionCompleta: boolean; responsableCompleto: boolean; criterioConsolidacion: boolean; centros: number;
  /** null = no se ha hecho la evaluación de la significancia. */
  evaluacionCompleta: boolean | null; categoriasSinEvaluar: number;
  exclusiones: { total: number; sinJustificar: number; directasIncompletas: number };
  baseDefinida: boolean; baseConDatos: boolean;
  /** Reglas de recálculo: se disparó alguna y falta la decisión. */
  recalculoSinDecision: boolean; metodologiaDeclarada: boolean;
  hayBiogenico: boolean; resolucionCompleta: boolean; conjuntoFijado: boolean; gwpConFuente: boolean;
  incertidumbreCalculada: boolean; incidenciasIncertidumbre: number; cuadreOk: boolean;
  declaracionCaso: 'a' | 'b'; verificado: boolean; verificacionCompleta: boolean;
}

/** Apartados de la ISO 14064-1:2018, 9.3.1, con la sección del informe donde se recogen. */
export const APARTADOS_ISO: Array<[string, string, string]> = [
  ['a', 'Descripción de la organización que informa', '1'], ['b', 'Persona responsable del informe', '2'], ['c', 'Periodo cubierto', '3'], ['d', 'Límites de la organización', '4'],
  ['e', 'Límites del informe y criterio de significancia', '5'], ['f', 'Emisiones directas por gas, en t CO₂e', '9'], ['g', 'Tratamiento del CO₂ de origen biogénico', '7.4'], ['h', 'Absorciones de GEI, si se cuantifican', '7.4'],
  ['i', 'Fuentes o sumideros excluidos y su razón', '6'], ['j', 'Emisiones indirectas por categoría, en t CO₂e', '9'], ['k', 'Año base', '3'], ['l', 'Cambios y recálculos del año base', '3'],
  ['m', 'Enfoques de cuantificación y sus razones', '7.1'], ['n', 'Cambios de enfoque de cuantificación', '7.1'], ['o', 'Factores de emisión utilizados', '7.3 y Anexo B'], ['p', 'Efecto de las incertidumbres por categoría', '8'],
  ['q', 'Evaluación de la incertidumbre', '8'], ['r', 'Declaración de conformidad con la norma', '11'], ['s', 'Estado de verificación, tipo y nivel de aseguramiento', '11'], ['t', 'Potenciales de calentamiento y su fuente', '7.3'],
];

export function evaluarCorrespondencia(c: ContextoCorrespondencia): FilaCorrespondencia[] {
  const r = (apartado: string, estado: EstadoApartado, motivo: string): FilaCorrespondencia => { const a = APARTADOS_ISO.find((x) => x[0] === apartado)!; return { apartado, contenido: a[1], seccion: a[2], estado, motivo }; };
  const si = (ok: boolean, bien: string, mal: string, apartado: string) => r(apartado, ok ? 'Cumple' : 'No cumple', ok ? bien : mal);
  return [
    si(c.organizacionCompleta, 'Razón social, CIF, dirección, CNAE e IAE constan.', 'Faltan datos de la organización (razón social, CIF, dirección, CNAE o IAE).', 'a'),
    si(c.responsableCompleto, 'Constan nombre, cargo y entidad del responsable.', 'Falta el nombre, el cargo o la entidad del responsable.', 'b'),
    r('c', 'Cumple', 'Periodo anual del inventario.'),
    si(c.criterioConsolidacion && c.centros > 0, 'Criterio de consolidación justificado y centros incluidos.', 'Falta el criterio de consolidación (o su justificación) o los centros.', 'd'),
    c.evaluacionCompleta === null ? r('e', 'No cumple', 'No se ha evaluado la significancia de las emisiones indirectas.') : si(c.evaluacionCompleta, 'Evaluación de la significancia completa.', 'La evaluación de la significancia está incompleta.', 'e'),
    si(c.cuadreOk, 'Emisiones directas por gas, cuadradas con el total.', 'Las emisiones por gas no cuadran con el total.', 'f'),
    c.hayBiogenico ? r('g', 'Cumple', 'Se informa el CO₂ biogénico por separado.') : r('g', 'No aplica', 'No hay combustibles de origen biogénico.'),
    r('h', 'No aplica', 'No se cuantifican absorciones ni sumideros.'),
    c.exclusiones.total === 0 && c.categoriasSinEvaluar === 0 ? r('i', 'No aplica', 'No hay fuentes excluidas.')
      : si(c.exclusiones.sinJustificar === 0 && c.exclusiones.directasIncompletas === 0, 'Las exclusiones constan con su razón.', `${c.exclusiones.sinJustificar + c.exclusiones.directasIncompletas} exclusión(es) sin justificación, porcentaje o evidencia.`, 'i'),
    si(c.categoriasSinEvaluar === 0, 'Todas las categorías indirectas tienen estado.', `${c.categoriasSinEvaluar} categoría(s) indirecta(s) sin evaluar.`, 'j'),
    c.baseConDatos ? r('k', 'Cumple', 'Año base con su inventario y su justificación.') : r('k', 'No cumple', c.baseDefinida ? 'El año base no tiene datos.' : 'No existe inventario del año base.'),
    !c.baseConDatos ? r('l', 'No cumple', 'Sin año base no se pueden evaluar los recálculos.') : si(!c.recalculoSinDecision, 'Reglas de recálculo evaluadas y decisión documentada.', 'Se cumple una regla de recálculo y falta documentar la decisión.', 'l'),
    r('m', 'Cumple', 'Método descrito en el apartado 7.1.'),
    si(c.metodologiaDeclarada, 'Se declara si ha cambiado la metodología.', 'No se ha declarado si ha cambiado la metodología.', 'n'),
    si(c.resolucionCompleta && c.conjuntoFijado, 'Conjunto de factores fijado y resolución citada.', c.conjuntoFijado ? 'La cita de la resolución de factores está incompleta.' : 'El conjunto de factores no está fijado.', 'o'),
    si(c.incertidumbreCalculada, 'Incertidumbre por categoría calculada.', 'No se puede calcular la incertidumbre.', 'p'),
    si(c.incertidumbreCalculada && c.incidenciasIncertidumbre === 0, 'Incertidumbre evaluada con su método.', c.incertidumbreCalculada ? `${c.incidenciasIncertidumbre} ajuste(s) de incertidumbre sin justificación.` : 'No se puede evaluar la incertidumbre.', 'q'),
    c.declaracionCaso === 'a' ? r('r', 'Cumple', 'Conformidad con la norma declarada.') : r('r', 'No cumple', 'Conformidad solo con el programa aplicable: falta completar la evaluación de la significancia.'),
    c.verificado ? si(c.verificacionCompleta, 'Verificación con entidad, nivel, fecha y referencia.', 'Faltan datos de la verificación (entidad, nivel, fecha o referencia).', 's') : r('s', 'No aplica', 'Inventario pendiente de verificación.'),
    si(c.gwpConFuente, 'Potenciales de calentamiento con su fuente.', 'Falta la fuente de los potenciales de calentamiento.', 't'),
  ];
}
