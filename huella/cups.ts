// El CUPS español (ES + 16 cifras + 2 letras de control) se puede validar: las letras salen del resto de dividir las 16 cifras entre 529.
// Las facturas escaneadas se leen con errores de una cifra (un 9 por un 8…): se detectan y, si hay una sola corrección posible, se aplican.
const LETRAS = 'TRWAGMYFPDXBNJZSQVHLCKE';

export function letrasControl(cifras: string): string {
  const r = Number(BigInt(cifras) % 529n);
  return LETRAS[Math.floor(r / 23)] + LETRAS[r % 23];
}

/** true/false si tiene forma de CUPS (20 caracteres, con o sin los 2 de control del final); null si no es un CUPS. */
export function cupsValido(c?: string | null): boolean | null {
  const x = (c ?? '').toUpperCase().replace(/[\s\-.]/g, '');
  const m = /^ES(\d{16})([A-Z]{2})/.exec(x);
  return m ? letrasControl(m[1]) === m[2] : null;
}

export interface ReparacionCups { cups: string; corregido: boolean; /** Lo leído, si se ha corregido. */ leido?: string; /** Hay varias correcciones posibles y ninguna conocida: se deja lo leído y se avisa. */ ambiguo?: boolean; invalido?: boolean }

/**
 * Devuelve el CUPS corregido si lo leído no cumple el dígito de control: se prueba cambiar una cifra o quitar la cifra sobrante
 * y se acepta la corrección si es única, o si coincide con un CUPS ya conocido del mismo centro (`conocidos`).
 */
export function repararCups(leido: string, conocidos: string[] = []): ReparacionCups {
  const x = leido.toUpperCase().replace(/[\s\-.]/g, '');
  const m = /^ES(\d{15,17})([A-Z]{2})/.exec(x);
  if (!m) return { cups: leido, corregido: false };
  const [, cifras, letras] = m;
  if (cifras.length === 16 && letrasControl(cifras) === letras) return { cups: `ES${cifras}${letras}`, corregido: false };
  const candidatos = new Set<string>();
  const prueba = (c: string) => { if (c.length === 16 && letrasControl(c) === letras) candidatos.add(`ES${c}${letras}`); };
  if (cifras.length === 16) for (let i = 0; i < 16; i++) for (const d of '0123456789') if (d !== cifras[i]) prueba(cifras.slice(0, i) + d + cifras.slice(i + 1));
  if (cifras.length === 17) for (let i = 0; i < 17; i++) prueba(cifras.slice(0, i) + cifras.slice(i + 1));
  const lista = [...candidatos];
  const conocido = lista.filter((c) => conocidos.map((k) => k.toUpperCase().slice(0, 20)).includes(c));
  const elegido = lista.length === 1 ? lista[0] : conocido.length === 1 ? conocido[0] : undefined;
  if (elegido) return { cups: elegido, corregido: true, leido: x.slice(0, 20) };
  return { cups: x.slice(0, 20), corregido: false, ambiguo: lista.length > 1, invalido: true };
}
