// Función de servidor: lee con IA el certificado / facturas de mantenimiento de extintores y devuelve una PROPUESTA (nunca guarda nada).
// El archivo se sube antes al almacén privado (puede superar el límite de la petición) y aquí se descarga con la sesión de la persona.
import Anthropic from '@anthropic-ai/sdk';
import { PDFDocument } from 'pdf-lib';
import { usuarioAutorizado } from '../lib/auth.ts';
import { guardarResultado } from '../lib/resultado.ts';
import { ESQUEMA_EXTINTORES, INSTRUCCIONES_EXTINTORES, limpiarLectura } from '../../huella/extintores.ts';
import type { LecturaExtintores } from '../../huella/extintores.ts';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const MODELO = 'claude-sonnet-5-5';
const PAGINAS_POR_TRAMO = 8;
const BYTES_MAX = 25 * 1024 * 1024;

async function leerTramo(cliente: Anthropic, pdf: Uint8Array, desde: number): Promise<LecturaExtintores> {
  const r = await cliente.messages.create({
    model: MODELO,
    max_tokens: 6000,
    system: INSTRUCCIONES_EXTINTORES,
    messages: [{ role: 'user', content: [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from(pdf).toString('base64') } },
      { type: 'text', text: `Extrae las operaciones sobre extintores de estas páginas (la primera es la página ${desde + 1} del documento original).` },
    ] }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA_EXTINTORES as unknown as Record<string, unknown> } },
  });
  if (r.stop_reason === 'refusal' || r.stop_reason === 'max_tokens') throw new Error(`Lectura no válida (${r.stop_reason}).`);
  const b = r.content.find((x) => x.type === 'text');
  if (!b || b.type !== 'text') throw new Error('Respuesta sin contenido.');
  const l = JSON.parse(b.text) as LecturaExtintores;
  // La página que devuelve el modelo es relativa al tramo: se pasa a la del documento original.
  return { ...l, lineas: (l.lineas ?? []).map((x) => ({ ...x, pagina: x.pagina ? x.pagina + desde : undefined })) };
}

const manejar = async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Lectura no configurada (falta la clave en el servidor).' }, 503);
  if (!(await usuarioAutorizado(req))) return json({ error: 'No autorizado.' }, 401);

  let path: string | undefined;
  try { path = ((await req.json()) as { path?: string }).path; } catch { return json({ error: 'Petición no válida.' }, 400); }
  if (!path || path.includes('..') || path.length > 300) return json({ error: 'Ruta no válida.' }, 400);

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  const descarga = await fetch(`${url}/storage/v1/object/hc-facturas/${path.split('/').map(encodeURIComponent).join('/')}`, { headers: { apikey: anon!, authorization: req.headers.get('authorization')! } });
  if (!descarga.ok) return json({ error: 'No se pudo recuperar el certificado subido.' }, 404);
  const bytes = new Uint8Array(await descarga.arrayBuffer());
  if (bytes.length > BYTES_MAX) return json({ error: 'El archivo supera 25 MB.' }, 400);

  try {
    const cliente = new Anthropic({ maxRetries: 1, timeout: 240_000 });
    const esPdf = String.fromCharCode(...bytes.slice(0, 4)) === '%PDF';
    let tramos: Array<{ datos: Uint8Array; desde: number }>;
    if (esPdf) {
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const n = doc.getPageCount();
      tramos = [];
      for (let i = 0; i < n; i += PAGINAS_POR_TRAMO) {
        const parte = await PDFDocument.create();
        const copiadas = await parte.copyPages(doc, Array.from({ length: Math.min(PAGINAS_POR_TRAMO, n - i) }, (_, k) => i + k));
        copiadas.forEach((p) => parte.addPage(p));
        tramos.push({ datos: await parte.save(), desde: i });
      }
    } else {
      return json({ error: 'Suba el certificado en PDF (las imágenes sueltas no se leen todavía).' }, 400);
    }
    const lecturas = await Promise.allSettled(tramos.map((t) => leerTramo(cliente, t.datos, t.desde)));
    const ok = lecturas.filter((x): x is PromiseFulfilledResult<LecturaExtintores> => x.status === 'fulfilled').map((x) => x.value);
    if (!ok.length) return json({ error: 'No se pudo leer el certificado. Introduzca los datos a mano.', detalle: String((lecturas[0] as PromiseRejectedResult).reason) }, 502);
    const fallidos = lecturas.length - ok.length;
    const lectura = limpiarLectura({
      lineas: ok.flatMap((x) => x.lineas),
      observaciones: [...ok.map((x) => x.observaciones).filter(Boolean), fallidos ? `${fallidos} tramo(s) de páginas no se pudieron leer: revise el certificado.` : ''].filter(Boolean).join(' '),
    });
    return json({ ...lectura, modelo: MODELO, paginas: tramos.length ? tramos[tramos.length - 1].desde + 1 : 0 });
  } catch (e) {
    return json({ error: 'No se pudo leer el certificado. Introduzca los datos a mano.', detalle: e instanceof Error ? e.message : String(e) }, 502);
  }
};

/** Función en segundo plano: responde 202 enseguida y deja el resultado junto al documento (`<ruta>.lectura.json`). */
export default async (req: Request): Promise<Response> => {
  const copia = req.clone();
  const respuesta = await manejar(req);
  try {
    const { path } = (await copia.json()) as { path?: string };
    if (path) await guardarResultado(copia, path, respuesta.status, await respuesta.text());
  } catch { /* sin ruta válida no hay dónde dejar el resultado */ }
  return new Response(null, { status: 202 });
};
