// Catálogo de notas al pie de las fuentes y factores. Una marca (*, **, †) al final del nombre de una fuente genera su nota debajo de la tabla donde aparece.
// El texto es un dato del catálogo: se corrige aquí, no en el generador del informe.
export const NOTAS_FUENTES: Record<string, string> = {
  '*': 'Gas natural: la cantidad se expresa en kWh de poder calorífico superior (PCS), unidad que exige la calculadora oficial. Si la factura indica PCI se convierte con el factor 0,901 y, si da m³, con el factor de conversión de la factura.',
  '**': 'Combustible de origen biogénico: su CO₂ biogénico no se suma a las emisiones totales; el CH₄ y el N₂O sí se contabilizan.',
  '†': 'Dato estimado: no procede de una medición facturada.',
};

/** Marcas (*, **, †…) con que termina el texto de una celda que nombra una fuente o factor. */
export const marcaFinal = (texto: string): string | null => /\S((?:\*{1,3})|†)$/.exec(texto.trim())?.[1] ?? null;
