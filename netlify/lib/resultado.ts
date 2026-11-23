// Las lecturas con IA de documentos largos tardan más de lo que admite una función normal (504): se ejecutan en segundo plano y dejan su resultado
// junto al documento, en el almacén privado, para que la aplicación lo recoja.
export async function guardarResultado(req: Request, path: string, estado: number, cuerpo: string): Promise<void> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  const auth = req.headers.get('authorization');
  if (!url || !anon || !auth || !path || path.includes('..')) return;
  let datos: unknown = {};
  try { datos = JSON.parse(cuerpo); } catch { datos = { error: 'Respuesta no válida.' }; }
  await fetch(`${url}/storage/v1/object/hc-facturas/${`${path}.lectura.json`.split('/').map(encodeURIComponent).join('/')}`, {
    method: 'POST',
    headers: { apikey: anon, authorization: auth, 'content-type': 'application/json' },
    body: JSON.stringify({ estado, ...(datos as object) }),
  });
}
