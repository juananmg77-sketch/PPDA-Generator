// Imágenes de marca del modelo de documento corporativo para el Word (cargadas desde /public en el navegador).
import type { Logos } from './informeDocx.ts';

const bytes = async (url: string) => { try { const r = await fetch(url); return r.ok ? new Uint8Array(await r.arrayBuffer()) : undefined; } catch { return undefined; } };

export async function cargarMarca(): Promise<Logos> {
  const [green, group, groupBlanco, portada, banda] = await Promise.all([
    bytes('/logo-hsgreen-recortado.png'), bytes('/logo-hs-group.png'), bytes('/brand/informe/logo-hs-group-blanco.png'), bytes('/brand/informe/portada-ondas.jpg'), bytes('/brand/informe/banda-degradado.png'),
  ]);
  return { green, group, groupBlanco, portada, banda };
}
