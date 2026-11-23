// Busca hoteles en la base de HS Suite (solo lectura) para dar de alta centros y organizaciones de Huella de carbono.
// Solo admin / consultor con sesión válida. Llama a una consulta de la Suite que exige una contraseña interna
// (variable HS_SUITE_LOOKUP_TOKEN en Netlify) y solo devuelve columnas de identificación (nada de contactos).
import { usuarioAutorizado } from '../lib/auth.ts';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  const url = process.env.HS_SUITE_URL, anon = process.env.HS_SUITE_ANON_KEY, token = process.env.HS_SUITE_LOOKUP_TOKEN;
  if (!url || !anon || !token) return json({ error: 'La búsqueda en HS Suite no está configurada en el servidor.' }, 503);
  if (!(await usuarioAutorizado(req))) return json({ error: 'No autorizado.' }, 401);

  let c: { texto?: string; cadena?: string; id?: string; limite?: number };
  try { c = await req.json(); } catch { return json({ error: 'Petición no válida.' }, 400); }
  const texto = typeof c.texto === 'string' ? c.texto.slice(0, 80) : null;
  const cadena = typeof c.cadena === 'string' ? c.cadena.slice(0, 120) : null;
  const id = typeof c.id === 'string' && /^[0-9a-f-]{36}$/i.test(c.id) ? c.id : null;
  if (!id && (texto ?? '').trim().length < 2 && (cadena ?? '').trim().length < 2) return json({ error: 'Escriba al menos 2 caracteres.' }, 400);

  try {
    const r = await fetch(`${url}/rest/v1/rpc/hsgreen_buscar_hoteles_v2`, {
      method: 'POST',
      headers: { apikey: anon, authorization: `Bearer ${anon}`, 'content-type': 'application/json' },
      body: JSON.stringify({ p_token: token, p_texto: texto, p_cadena: cadena, p_id: id, p_limit: Math.min(Number(c.limite) || 50, 200) }),
    });
    if (!r.ok) return json({ error: 'HS Suite no ha podido atender la búsqueda.' }, 502);
    return json({ hoteles: await r.json() });
  } catch {
    return json({ error: 'No se pudo conectar con HS Suite.' }, 502);
  }
};

export const config = { path: '/api/buscar-hoteles' };
