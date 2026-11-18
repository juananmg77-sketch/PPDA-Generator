// Representación del informe en HTML preparado para imprimir o guardar como PDF (A4, imagen corporativa HS Consulting Group / HS GREEN).
import type { Bloque, ModeloInforme } from './informe.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const multi = (s: string) => esc(s).replace(/\n/g, '<br>');

function bloque(b: Bloque): string {
  switch (b.k) {
    case 'p': return `<p>${multi(b.texto)}</p>`;
    case 'h': return `<h3>${esc(b.texto)}</h3>`;
    case 'nota': return `<p class="nota">${multi(b.texto)}</p>`;
    case 'grafico': return `<figure class="graf"><figcaption>${esc(b.titulo)}</figcaption>${b.svg}${b.pie ? `<p class="pie">${esc(b.pie)}</p>` : ''}</figure>`;
    case 'lista': return `<ul>${b.items.map((i) => `<li>${multi(i)}</li>`).join('')}</ul>`;
    case 'tabla': {
      const num = new Set(b.numericas ?? []);
      const cab = b.cab.map((c, i) => `<th${num.has(i) ? ' class="n"' : ''}>${esc(c)}</th>`).join('');
      const filas = b.filas.map((f) => `<tr>${f.map((c, i) => `<td${num.has(i) ? ' class="n"' : ''}>${multi(c)}</td>`).join('')}</tr>`).join('');
      return `<table><thead><tr>${cab}</tr></thead><tbody>${filas}</tbody></table>${b.pie ? `<p class="pie">${esc(b.pie)}</p>` : ''}`;
    }
  }
}

export interface OpcionesHtml { baseUrl?: string }

/** Documento HTML completo (autosuficiente salvo las imágenes de los logos y la tipografía). */
export function informeAHtml(m: ModeloInforme, o: OpcionesHtml = {}): string {
  const base = o.baseUrl ?? '';
  const logoGreen = `${base}/logo-hsgreen-recortado.png`;
  const logoGroup = `${base}/logo-hs-group.png`;
  const indice = m.secciones.map((s) => `<li><span>${esc(s.id)}.</span> ${esc(s.titulo)}</li>`).join('');
  const cuerpo = m.secciones.map((s) => `<section><h2>${esc(s.id)}. ${esc(s.titulo.toUpperCase())}</h2>${s.bloques.map(bloque).join('')}</section>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(m.meta.codigo)} · ${esc(m.meta.titulo)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:26mm 17mm 24mm 17mm;@bottom-right{content:"Página " counter(page) " de " counter(pages);font:8pt Montserrat,Arial,sans-serif;color:#555}}
*{box-sizing:border-box}
body{font:10pt/1.45 Montserrat,Calibri,Arial,sans-serif;color:#333;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.cabecera{position:fixed;top:-20mm;left:0;right:0;height:14mm;display:flex;justify-content:space-between;align-items:center;border-bottom:.5pt solid #9D9D9C}
.cabecera img{height:10mm}
.pie-fijo{position:fixed;bottom:-19mm;left:0;right:0;font-size:7pt;color:#777;display:flex;justify-content:space-between;gap:12mm}
.portada{height:236mm;display:flex;flex-direction:column;justify-content:space-between;page-break-after:always}
.portada .logos{display:flex;justify-content:space-between;align-items:center}
.portada .logos img{height:20mm}
.portada h1{font-size:25pt;line-height:1.15;color:#00093D;margin:0 0 6mm}
.portada .sub{font-size:15pt;color:#0002C9;margin:0 0 10mm}
.portada .banda{height:5mm;background:linear-gradient(90deg,#0002C9,#24CBF5);margin:8mm 0}
.portada table{width:auto}
.estado{display:inline-block;padding:2mm 4mm;border-radius:2mm;font-weight:700;font-size:9pt;background:#FFF3E6;color:#FF6600;margin-top:6mm}
.estado.ok{background:#E6F9E6;color:#006600}
.indice{page-break-after:always}
.indice li{list-style:none;padding:1.6mm 0;border-bottom:.5pt solid #e3e3e3}
.indice li span{display:inline-block;width:9mm;font-weight:700;color:#0002C9}
h2{font-size:11pt;color:#00093D;margin:9mm 0 3mm;padding-bottom:1.5mm;border-bottom:1pt solid #0002C9;break-after:avoid}
h3{font-size:10pt;color:#0002C9;margin:5mm 0 2mm;break-after:avoid}
p{margin:0 0 3mm;text-align:justify}
ul{margin:0 0 3mm;padding-left:5mm}
.pie,.nota{font-size:8pt;color:#666}
table{width:100%;border-collapse:collapse;margin:2mm 0 4mm;font-size:8.5pt;break-inside:auto}
tr{break-inside:avoid}
thead{display:table-header-group}
th{background:#0002C9;color:#fff;text-align:left;padding:1.6mm 2mm;font-weight:600;border:.5pt solid #9D9D9C}
td{padding:1.4mm 2mm;border:.5pt solid #9D9D9C;vertical-align:top}
tbody tr:nth-child(even) td{background:#F2F2F2}
.n{text-align:right;font-variant-numeric:tabular-nums}
.graf{margin:3mm 0 5mm;break-inside:avoid}
.graf figcaption{font-weight:600;font-size:9pt;color:#00093D;margin-bottom:1.5mm}
.graf svg{width:100%;max-width:175mm;height:auto;border:.5pt solid #E5E5E5;border-radius:2mm}
.conf{font-size:7.5pt;color:#777;margin-top:10mm;border-top:.5pt solid #9D9D9C;padding-top:2mm}
</style></head><body>
<div class="cabecera"><img src="${logoGroup}" alt="HS Consulting Group"><img src="${logoGreen}" alt="HS GREEN"></div>
<div class="pie-fijo"><span>${esc(m.meta.codigo)} · ${esc(m.meta.edicion)} · ${esc(m.meta.estado)}</span><span>CONFIDENCIAL · HS CONSULTING GROUP</span></div>
<div class="portada">
  <div class="logos"><img src="${logoGroup}" alt="HS Consulting Group"><img src="${logoGreen}" alt="HS GREEN"></div>
  <div>
    <h1>${esc(m.meta.titulo)}</h1><p class="sub">${esc(m.meta.subtitulo)}</p>
    <div class="banda"></div>
    <table><tbody>
      <tr><td><b>Norma de referencia</b></td><td>${esc(m.meta.norma)}</td></tr>
      <tr><td><b>Código</b></td><td>${esc(m.meta.codigo)}</td></tr>
      <tr><td><b>Edición y fecha</b></td><td>${esc(m.meta.edicion)}</td></tr>
    </tbody></table>
    <span class="estado${m.meta.estado === 'VERIFICADO' ? ' ok' : ''}">${esc(m.meta.estado)}</span>
  </div>
  <p class="conf" style="margin:0">CONFIDENCIALIDAD: Este documento es propiedad de HS CONSULTING GROUP y contiene información confidencial destinada exclusivamente al cliente identificado en la portada. Queda prohibida su reproducción, distribución o comunicación pública sin autorización expresa y por escrito de HS CONSULTING GROUP.</p>
</div>
<div class="indice"><h2>ÍNDICE</h2><ul>${indice}</ul></div>
${cuerpo}
</body></html>`;
}
