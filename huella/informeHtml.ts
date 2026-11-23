// Representación del informe en HTML preparado para imprimir o guardar como PDF (A4), con el modelo de imagen corporativa de HS Consulting Group
// (portada de ondas azules con logo blanco, cabecera con logos, pie con banda degradada y «X / Y», tablas de cabecera azul marino).
import type { Bloque, ModeloInforme } from './informe.ts';
import { configPlantilla } from './configInforme.ts';

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
      return `<table><thead><tr>${cab}</tr></thead><tbody>${filas}</tbody></table>${(b.notas ?? []).map((n) => `<p class="pie">${esc(n)}</p>`).join('')}${b.pie ? `<p class="pie">${esc(b.pie)}</p>` : ''}`;
    }
  }
}

export interface OpcionesHtml { baseUrl?: string; /** Logotipo de la división en la cabecera (por defecto HS GREEN). */ division?: 'green' }

/** Documento HTML completo (autosuficiente salvo las imágenes de marca y la tipografía). */
export function informeAHtml(m: ModeloInforme, o: OpcionesHtml = {}): string {
  const base = o.baseUrl ?? '';
  const logoGreen = `${base}/logo-hsgreen-recortado.png`;
  const logoGroup = `${base}/logo-hs-group.png`;
  const logoBlanco = `${base}/brand/informe/logo-hs-group-blanco.png`;
  const portada = `${base}/brand/informe/portada-ondas.jpg`;
  const banda = `${base}/brand/informe/banda-degradado.png`;
  const indice = m.secciones.map((s) => `<li><span>${esc(s.id)}.</span> ${esc(s.titulo)}</li>`).join('');
  const cuerpo = m.secciones.map((s) => `<section><h2>${esc(s.id)}. ${esc(s.titulo.toUpperCase())}</h2>${s.bloques.map(bloque).join('')}</section>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(m.meta.codigo)} · ${esc(m.meta.titulo)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:28mm 17mm 26mm 17mm;
  @bottom-left{content:"${esc(m.meta.codigo)} · ${esc(m.meta.edicion)} · ${esc(m.meta.estado)}";font:7pt Montserrat,Arial,sans-serif;color:#435971;vertical-align:top;padding-top:5mm}
  @bottom-right{content:"HS Consulting Group   " counter(page) " / " counter(pages);font:8pt Montserrat,Arial,sans-serif;color:#435971;vertical-align:top;padding-top:5mm}}
@page :first{margin:0;@bottom-left{content:none}@bottom-right{content:none}}
*{box-sizing:border-box}
body{font:10pt/1.5 Montserrat,Calibri,Arial,sans-serif;color:#344454;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.cabecera{position:fixed;top:-22mm;left:0;right:0;height:13mm;display:flex;justify-content:flex-end;align-items:center;gap:7mm;border-bottom:.5pt solid #E8E8E8}
.cabecera img{height:9.5mm}
.banda{position:fixed;bottom:-26mm;left:-17mm;right:-17mm;height:4mm;background:url(${banda}) center/100% 100% no-repeat}
.portada{position:relative;z-index:10;width:100%;height:297mm;background:#00093D url(${portada}) center/cover no-repeat;color:#fff;page-break-after:always;overflow:hidden}
.portada .logo{position:absolute;top:18mm;left:18mm;height:26mm}
.portada .titulo{position:absolute;left:24mm;right:24mm;top:182mm}
.portada h1{font:500 30pt/1.15 Montserrat,Arial,sans-serif;margin:0 0 3mm;color:#fff;text-transform:uppercase}
.portada .sub{font:400 15pt/1.3 Montserrat,Arial,sans-serif;color:#24CBF5;margin:0 0 6mm;text-transform:uppercase}
.portada .linea{height:.8mm;background:#24CBF5;margin:0 0 8mm}
.portada .edicion{font-size:11pt;margin:0 0 1.5mm;color:#fff}
.estado{display:inline-block;margin-top:6mm;padding:1.6mm 4mm;border-radius:1.5mm;font-weight:600;font-size:8.5pt;background:#24CBF5;color:#00093D;letter-spacing:.04em}
.estado.ok{background:#E6F9E6;color:#006600}
.resumen{break-after:page;page-break-after:always}
.portada .conf{position:absolute;left:24mm;right:24mm;bottom:12mm;font-size:6.5pt;line-height:1.35;color:#E8E8E8;text-align:justify;margin:0}
.indice{page-break-after:always}
.indice li{list-style:none;padding:1.6mm 0;border-bottom:.5pt solid #E8E8E8}
.indice li span{display:inline-block;width:9mm;font-weight:600;color:#0002C9}
h2{font:600 11pt Montserrat,Arial,sans-serif;color:#00093D;margin:9mm 0 3mm;padding-bottom:1.5mm;border-bottom:1pt solid #24CBF5;break-after:avoid}
h3{font:600 10pt Montserrat,Arial,sans-serif;color:#0002C9;margin:5mm 0 2mm;break-after:avoid}
p{margin:0 0 3mm;text-align:justify}
ul{margin:0 0 3mm;padding-left:5mm}
.pie,.nota{font-size:8pt;color:#666}
table{width:100%;border-collapse:collapse;margin:2mm 0 4mm;font-size:8.5pt;break-inside:auto}
tr{break-inside:avoid}
thead{display:table-header-group}
th{background:#002060;color:#fff;text-align:left;padding:1.6mm 2mm;font-weight:600;border:.5pt solid #9D9D9C}
td{padding:1.4mm 2mm;border:.5pt solid #9D9D9C;vertical-align:top}
tbody tr:nth-child(even) td{background:#F2F8FD}
.n{text-align:right;font-variant-numeric:tabular-nums}
.graf{margin:3mm 0 5mm;break-inside:avoid}
.graf figcaption{font-weight:600;font-size:9pt;color:#00093D;margin-bottom:1.5mm}
.graf svg{width:100%;max-width:175mm;height:auto;border:.5pt solid #E5E5E5;border-radius:2mm}
</style></head><body>
<div class="cabecera"><img src="${logoGroup}" alt="HS Consulting Group"><img src="${logoGreen}" alt="HS GREEN"></div>
<div class="banda"></div>
<div class="portada">
  <img class="logo" src="${logoBlanco}" alt="HS Consulting Group">
  <div class="titulo">
    <h1>${esc(m.meta.titulo)}</h1><p class="sub">${esc(m.meta.subtitulo)}</p>
    <div class="linea"></div>
    <p class="edicion">${esc(m.meta.edicion)}</p>
    <p class="edicion" style="font-size:9pt;color:#E8E8E8">${esc(m.meta.norma)} · Código ${esc(m.meta.codigo)}</p>
    <span class="estado${m.meta.estado === 'VERIFICADO' ? ' ok' : ''}">${esc(m.meta.estado)}</span>
  </div>
  <p class="conf">${esc(configPlantilla({ confidencialidad: m.meta.confidencialidad }).confidencialidad)}</p>
</div>
${m.resumen ? `<section class="resumen"><h2>RESUMEN EJECUTIVO</h2>${m.resumen.bloques.map(bloque).join('')}</section>` : ''}
<div class="indice"><h2>ÍNDICE</h2><ul>${indice}</ul></div>
${cuerpo}
<script>
/* Safari y Firefox ignoran los márgenes de @page (y Safari aplica el de la primera página a todas): en ellos los márgenes se logran con un envoltorio de tabla cuyo encabezado y pie, vacíos, se repiten en cada página. Chrome conserva los márgenes de @page y su numeración. */
(function(){
  if (/Chrome|Chromium|CriOS|Edg\//.test(navigator.userAgent)) return;
  var css = document.createElement('style');
  css.textContent = '@page{size:A4;margin:0}@page :first{margin:0}'
    + 'table.envoltura{width:100%;margin:0;font-size:10pt;border-collapse:collapse}'
    + 'table.envoltura>thead>tr>td,table.envoltura>tfoot>tr>td,table.envoltura>tbody>tr>td{padding:0;border:0;background:none}'
    + 'table.envoltura>tbody>tr{break-inside:auto}table.envoltura>tfoot{display:table-footer-group}'
    + '.esp-sup{height:28mm}.esp-inf{height:26mm}.cont-env{padding:0 17mm!important}'
    + '.cabecera{top:9mm;left:17mm;right:17mm}.banda{bottom:0;left:0;right:0}';
  document.head.appendChild(css);
  var portada = document.querySelector('.portada'), fin = document.currentScript;
  if (!portada || !fin) return;
  var t = document.createElement('table'); t.className = 'envoltura';
  t.innerHTML = '<thead><tr><td><div class="esp-sup"></div></td></tr></thead><tfoot><tr><td><div class="esp-inf"></div></td></tr></tfoot><tbody><tr><td class="cont-env"></td></tr></tbody>';
  var cont = t.querySelector('.cont-env');
  while (portada.nextSibling && portada.nextSibling !== fin) cont.appendChild(portada.nextSibling);
  fin.parentNode.insertBefore(t, fin);
})();
</script>
</body></html>`;
}
