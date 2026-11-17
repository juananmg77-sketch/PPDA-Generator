// Comprobación común de las funciones de servidor: solo usuarios internos (admin / consultor) con sesión válida del proyecto del PPDA.
/** Solo usuarios internos (admin / consultor) con sesión válida del proyecto del PPDA. */
export async function usuarioAutorizado(req: Request): Promise<boolean> {
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
