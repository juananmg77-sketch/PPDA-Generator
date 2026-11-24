// Lectura de facturas en segundo plano: la lectura con IA puede pasar del límite de una función normal (504).
// La factura ya está subida al almacén privado: aquí se descarga con la sesión de la persona, se lee con la misma lógica que `leer-factura`
// y el resultado queda junto al documento (`<ruta>.lectura.json`) para que la aplicación lo recoja.
import { guardarResultado } from '../lib/resultado.ts';
import { manejarLectura } from './leer-factura.mts';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const tipoMime = (b: Uint8Array): 'application/pdf' | 'image/png' | 'image/jpeg' | null =>
  String.fromCharCode(...b.slice(0, 4)) === '%PDF' ? 'application/pdf' : b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : null;

const manejar = async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  let c: { path?: string; anioInventario?: number; version?: string; tipo?: string; cupsConocidos?: string[] };
  try { c = await req.json(); } catch { return json({ error: 'Petición no válida.' }, 400); }
  if (!c.path || c.path.includes('..') || c.path.length > 300) return json({ error: 'Ruta no válida.' }, 400);
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  const descarga = await fetch(`${url}/storage/v1/object/hc-facturas/${c.path.split('/').map(encodeURIComponent).join('/')}`, { headers: { apikey: anon!, authorization: req.headers.get('authorization')! } });
  if (!descarga.ok) return json({ error: 'No se pudo recuperar la factura subida.' }, 404);
  const bytes = new Uint8Array(await descarga.arrayBuffer());
  const mediaType = tipoMime(bytes);
  if (!mediaType) return json({ error: 'Formato no admitido (PDF, JPG o PNG).' }, 400);
  // Misma lógica y mismas comprobaciones que la función normal: se le pasa una petición equivalente
  const peticion = new Request('http://interna/leer', {
    method: 'POST',
    headers: { authorization: req.headers.get('authorization')!, 'content-type': 'application/json' },
    body: JSON.stringify({ anioInventario: c.anioInventario, version: c.version, tipo: c.tipo, cupsConocidos: c.cupsConocidos, base64: Buffer.from(bytes).toString('base64'), mediaType }),
  });
  return manejarLectura(peticion);
};

/** Responde 202 enseguida y deja el resultado junto al documento. */
export default async (req: Request): Promise<Response> => {
  const copia = req.clone();
  const respuesta = await manejar(req);
  try {
    const { path } = (await copia.json()) as { path?: string };
    if (path) await guardarResultado(copia, path, respuesta.status, await respuesta.text());
  } catch { /* sin ruta válida no hay dónde dejar el resultado */ }
  return new Response(null, { status: 202 });
};
