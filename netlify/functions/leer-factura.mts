// Función de servidor: lee una factura con IA y devuelve una PROPUESTA validada (nunca guarda nada).
// Variables de entorno en Netlify (nunca en el código): ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY.
import Anthropic from '@anthropic-ai/sdk';
import { cargarConjunto } from '../../huella/catalogo.ts';
import { extractText, getDocumentProxy } from 'unpdf';
import { ESQUEMA_EXTRACCION, LIMITES, instrucciones, leerFactura, validarEntrada } from '../../huella/lectura.ts';
import type { EntradaLectura, LlamarModelo } from '../../huella/lectura.ts';
import type { ExtraccionFactura, TipoFactura } from '../../huella/extraccion.ts';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** Solo usuarios internos (admin / consultor) con sesión válida del proyecto del PPDA. */
async function usuarioAutorizado(req: Request): Promise<boolean> {
  // Se reutilizan las variables públicas del sitio (la clave anónima ya viaja en el navegador); no hace falta añadir otras.
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  const auth = req.headers.get('authorization');
  if (!url || !anon || !auth?.startsWith('Bearer ')) return false;
  const cab = { apikey: anon, authorization: auth };
  const u = await fetch(`${url}/auth/v1/user`, { headers: cab });
  if (!u.ok) return false;
  const { id } = (await u.json()) as { id?: string };
  if (!id) return false;
  const p = await fetch(`${url}/rest/v1/profiles?id=eq.${id}&select=role`, { headers: cab });
  if (!p.ok) return false;
  const filas = (await p.json()) as Array<{ role?: string }>;
  return ['admin', 'consultor'].includes(filas[0]?.role ?? '');
}

function crearLlamada(cliente: Anthropic): LlamarModelo {
  return async (modelo, entrada: EntradaLectura) => {
    const contenido: Anthropic.ContentBlockParam[] = entrada.texto
      ? [{ type: 'text', text: `Texto de la factura:\n\n${entrada.texto}` }]
      : entrada.mediaType === 'application/pdf'
        ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: entrada.base64! } }]
        : [{ type: 'image', source: { type: 'base64', media_type: entrada.mediaType as 'image/jpeg' | 'image/png', data: entrada.base64! } }];
    contenido.push({ type: 'text', text: 'Extrae los datos de esta factura.' });

    const r = await cliente.messages.create({
      model: modelo,
      max_tokens: LIMITES.maxTokensSalida,
      system: instrucciones(entrada.tipoEsperado),
      messages: [{ role: 'user', content: contenido }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA_EXTRACCION as unknown as Record<string, unknown> } },
    });
    if (r.stop_reason === 'refusal' || r.stop_reason === 'max_tokens') throw new Error(`Lectura no válida (${r.stop_reason}).`);
    const bloque = r.content.find((b) => b.type === 'text');
    if (!bloque || bloque.type !== 'text') throw new Error('Respuesta sin contenido.');
    return { extraccion: JSON.parse(bloque.text) as ExtraccionFactura, tokensEntrada: r.usage.input_tokens, tokensSalida: r.usage.output_tokens };
  };
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'Lectura de facturas no configurada (falta la clave en el servidor).' }, 503);
  if (!(await usuarioAutorizado(req))) return json({ error: 'No autorizado.' }, 401);

  let cuerpo: { anioInventario?: number; version?: string; tipo?: TipoFactura; texto?: string; base64?: string; mediaType?: EntradaLectura['mediaType']; existentes?: never };
  try {
    cuerpo = await req.json();
  } catch {
    return json({ error: 'Petición no válida.' }, 400);
  }
  const anio = Number(cuerpo.anioInventario);
  if (!Number.isInteger(anio) || anio < 2020 || anio > 2100) return json({ error: 'Año de inventario no válido.' }, 400);

  const entrada: EntradaLectura = { texto: cuerpo.texto, base64: cuerpo.base64, mediaType: cuerpo.mediaType, tipoEsperado: cuerpo.tipo };
  const problema = validarEntrada(entrada);
  if (problema) return json({ error: problema }, 400);

  // Texto primero: un PDF con capa de texto (facturas de luz y gas) es mucho más rápido y barato que enviarlo como documento.
  if (!entrada.texto && entrada.mediaType === 'application/pdf' && entrada.base64) {
    try {
      const pdf = await getDocumentProxy(new Uint8Array(Buffer.from(entrada.base64, 'base64')));
      const { text } = await extractText(pdf, { mergePages: true });
      if (text.replace(/\s+/g, ' ').trim().length >= 200) {
        entrada.texto = text.slice(0, 40_000);
        entrada.base64 = undefined;
      }
    } catch {
      /* PDF escaneado o ilegible: se envía como documento */
    }
  }

  try {
    const { conjunto: factores } = await cargarConjunto(anio, cuerpo.version);
    const cliente = new Anthropic({ maxRetries: 1, timeout: 60_000 });
    const resultado = await leerFactura(crearLlamada(cliente), entrada, { anioInventario: anio, factores });
    return json(resultado);
  } catch (e) {
    return json({ error: 'No se pudo leer la factura. Inténtelo de nuevo o introduzca los datos a mano.', detalle: e instanceof Error ? e.message : String(e) }, 502);
  }
};

export const config = { path: '/api/leer-factura' };
