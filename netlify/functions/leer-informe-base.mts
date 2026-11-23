// Función de servidor: lee con IA el informe de huella del año base (PDF) y devuelve una PROPUESTA de datos (nunca guarda nada).
// El archivo se sube antes al almacén privado y aquí se descarga con la sesión de la persona.
import Anthropic from '@anthropic-ai/sdk';
import { extractText, getDocumentProxy } from 'unpdf';
import { usuarioAutorizado } from '../lib/auth.ts';
import { ESQUEMA_INFORME_BASE, INSTRUCCIONES_INFORME_BASE, limpiarLecturaBase } from '../../huella/lecturaInformeBase.ts';
import type { LecturaInformeBase } from '../../huella/lecturaInformeBase.ts';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const MODELO = 'claude-sonnet-5-5';
const BYTES_MAX = 25 * 1024 * 1024;

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Lectura no configurada (falta la clave en el servidor).' }, 503);
  if (!(await usuarioAutorizado(req))) return json({ error: 'No autorizado.' }, 401);

  let path: string | undefined;
  try { path = ((await req.json()) as { path?: string }).path; } catch { return json({ error: 'Petición no válida.' }, 400); }
  if (!path || path.includes('..') || path.length > 300) return json({ error: 'Ruta no válida.' }, 400);

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  const descarga = await fetch(`${url}/storage/v1/object/hc-facturas/${path.split('/').map(encodeURIComponent).join('/')}`, { headers: { apikey: anon!, authorization: req.headers.get('authorization')! } });
  if (!descarga.ok) return json({ error: 'No se pudo recuperar el informe subido.' }, 404);
  const bytes = new Uint8Array(await descarga.arrayBuffer());
  if (bytes.length > BYTES_MAX) return json({ error: 'El archivo supera 25 MB.' }, 400);
  if (String.fromCharCode(...bytes.slice(0, 4)) !== '%PDF') return json({ error: 'Suba el informe en PDF.' }, 400);

  try {
    // Texto primero (un informe generado por ordenador lo tiene): es más rápido y barato que enviar el PDF; si está escaneado, se envía como documento.
    let contenido: Anthropic.ContentBlockParam[];
    let texto = '';
    try {
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      texto = (await extractText(pdf, { mergePages: false })).text.map((t, i) => `[Página ${i + 1}]\n${t}`).join('\n\n');
    } catch { /* PDF escaneado o ilegible */ }
    if (texto.replace(/\s+/g, ' ').trim().length >= 800) contenido = [{ type: 'text', text: `Texto del informe:\n\n${texto.slice(0, 120_000)}` }];
    else contenido = [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: Buffer.from(bytes).toString('base64') } }];
    contenido.push({ type: 'text', text: 'Extrae los datos del año base de este informe.' });

    const cliente = new Anthropic({ maxRetries: 1, timeout: 55_000 });
    const r = await cliente.messages.create({
      model: MODELO, max_tokens: 4000, system: INSTRUCCIONES_INFORME_BASE,
      messages: [{ role: 'user', content: contenido }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA_INFORME_BASE as unknown as Record<string, unknown> } },
    });
    if (r.stop_reason === 'refusal' || r.stop_reason === 'max_tokens') throw new Error(`Lectura no válida (${r.stop_reason}).`);
    const b = r.content.find((x) => x.type === 'text');
    if (!b || b.type !== 'text') throw new Error('Respuesta sin contenido.');
    return json({ ...limpiarLecturaBase(JSON.parse(b.text) as LecturaInformeBase), modelo: MODELO, desdeTexto: texto.length >= 800 });
  } catch (e) {
    return json({ error: 'No se pudo leer el informe. Introduzca los datos a mano.', detalle: e instanceof Error ? e.message : String(e) }, 502);
  }
};

export const config = { path: '/api/leer-informe-base' };
