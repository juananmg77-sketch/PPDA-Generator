// Conversión de un SVG a PNG en el navegador (para incrustar los gráficos del informe en Word). Solo funciona con DOM.
export async function svgAPng(svg: string, ancho: number, alto: number, escala = 2): Promise<Uint8Array> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((ok, ko) => { img.onload = () => ok(); img.onerror = () => ko(new Error('No se pudo dibujar el gráfico.')); img.src = url; });
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(ancho * escala); lienzo.height = Math.round(alto * escala);
    const ctx = lienzo.getContext('2d');
    if (!ctx) throw new Error('El navegador no permite dibujar el gráfico.');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    const png = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/png'));
    if (!png) throw new Error('No se pudo generar la imagen del gráfico.');
    return new Uint8Array(await png.arrayBuffer());
  } finally { URL.revokeObjectURL(url); }
}
