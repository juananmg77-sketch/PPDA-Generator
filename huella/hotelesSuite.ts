// Datos de hoteles de HS Suite y su traslado a centros y organizaciones de Huella de carbono.

export interface HotelSuite {
  id: string; codigo_hotel: string | null; nombre_hotel: string | null; cadena_hotelera: string | null; titular: string | null; cif: string | null;
  pais: string | null; ccaa: string | null; isla: string | null; municipio: string | null; direccion_completa: string | null;
  num_habitaciones: number | null; num_plazas: number | null; activo: boolean | null;
  /** Geocodificación de HS Suite (solo si la función de búsqueda la devuelve). */
  latitud?: number | string | null; longitud?: number | string | null;
}

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const ISLAS = ['Mallorca', 'Menorca', 'Ibiza', 'Formentera'] as const;

/** Normaliza el nombre de la isla (admite Eivissa, Maó…); null si no es una isla balear conocida. */
export function normalizarIsla(isla?: string | null): (typeof ISLAS)[number] | null {
  const x = sinAcentos(isla ?? '');
  if (!x) return null;
  if (x.includes('mallorca') || x.includes('majorca')) return 'Mallorca';
  if (x.includes('menorca')) return 'Menorca';
  if (x.includes('ibiza') || x.includes('eivissa')) return 'Ibiza';
  if (x.includes('formentera')) return 'Formentera';
  return null;
}

export function enBaleares(h: Pick<HotelSuite, 'ccaa' | 'isla'>): boolean {
  return /balear|illes/.test(sinAcentos(h.ccaa ?? '')) || normalizarIsla(h.isla) !== null;
}

export interface CentroDesdeSuite {
  nombre: string; direccion: string | null; municipio: string | null; isla: string | null; en_baleares: boolean; unidades_alojamiento: number | null;
  suite_hotel_id: string; suite_codigo: string | null; latitud: number | null; longitud: number | null;
}
/** Número válido de latitud/longitud (|x| ≤ máximo) o null. */
export function coordenada(x: number | string | null | undefined, max: number): number | null {
  const n = typeof x === 'string' ? Number(x.replace(',', '.')) : x;
  return typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= max && !(n === 0) ? n : null;
}

export function centroDesdeHotel(h: HotelSuite): CentroDesdeSuite {
  const balear = enBaleares(h);
  return {
    nombre: (h.nombre_hotel ?? '').trim(), direccion: h.direccion_completa?.trim() || null, municipio: h.municipio?.trim() || null,
    isla: balear ? normalizarIsla(h.isla) : null, en_baleares: balear, unidades_alojamiento: h.num_habitaciones ?? null,
    suite_hotel_id: h.id, suite_codigo: h.codigo_hotel, latitud: coordenada(h.latitud, 90), longitud: coordenada(h.longitud, 180),
  };
}

/** Datos para una organización nueva a partir de un hotel: si pertenece a una cadena se nombra por la cadena; si no, por el titular o el propio hotel. */
/** CNAE de un hotel de HS Suite: 5510, hoteles y alojamientos similares (la base de HS Suite solo contiene hoteles). */
export const CNAE_HOTEL = '5510';

export function organizacionDesdeHotel(h: HotelSuite): { nombre: string; cif: string | null; direccion: string | null; suite_cadena: string | null; cnae: string } {
  const cadena = h.cadena_hotelera?.trim() || null;
  return {
    nombre: cadena ?? (h.titular?.trim() || (h.nombre_hotel ?? '').trim()),
    cif: h.cif?.trim() || null,
    direccion: cadena ? null : h.direccion_completa?.trim() || null,
    suite_cadena: cadena, cnae: CNAE_HOTEL,
  };
}
