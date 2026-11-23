// Textos y opciones del informe que son configuración (se guardan en la tabla de configuración y aquí están sus valores por defecto).
export interface ConfigPlantillaInforme {
  /** Cláusula de confidencialidad de la portada. */
  confidencialidad: string;
  /** Las tablas con menos filas que esto no se parten entre páginas. */
  minFilasSinPartir: number;
}
export const CONFIDENCIALIDAD_POR_DEFECTO = 'CONFIDENCIALIDAD: El inventario de gases de efecto invernadero y los datos que contiene pertenecen a la organización cliente identificada en la portada. La metodología, el formato y el diseño de este documento son propiedad de HS CONSULTING GROUP. Queda prohibida su reproducción, distribución o comunicación pública sin autorización expresa y por escrito.';
export const CONFIG_PLANTILLA_POR_DEFECTO: ConfigPlantillaInforme = { confidencialidad: CONFIDENCIALIDAD_POR_DEFECTO, minFilasSinPartir: 12 };
export const configPlantilla = (c?: Partial<ConfigPlantillaInforme> | null): ConfigPlantillaInforme => ({ ...CONFIG_PLANTILLA_POR_DEFECTO, ...(c ?? {}), confidencialidad: (c?.confidencialidad ?? '').trim() || CONFIDENCIALIDAD_POR_DEFECTO });
