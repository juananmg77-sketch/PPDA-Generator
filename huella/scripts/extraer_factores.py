#!/usr/bin/env python3
"""
Extrae el catálogo de factores de emisión de la hoja oculta «Dades» de la calculadora oficial del
Registro balear de huella de carbono (Govern de les Illes Balears) y lo guarda como JSON.

Uso:  python3 -I extraer_factores.py <calculadora.xlsx> <salida.json> <identificador-version>

Solo usa la biblioteca estándar. No modifica el Excel. Cada JSON lleva su procedencia (archivo y versión),
porque los factores de un mismo año cambian entre versiones del documento del MITECO.
"""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}


def col_num(letters):
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n


def col_letters(n):
    s = ''
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(65 + r) + s
    return s


def cargar_hoja(ruta, nombre_hoja):
    z = zipfile.ZipFile(ruta)
    ss = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS):
            ss.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = {r.get('Id'): r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    destino = None
    for s in wb.find('m:sheets', NS):
        if s.get('name') == nombre_hoja:
            t = rels[s.get('{%s}id' % NS['r'])].lstrip('/')
            destino = t if t.startswith('xl/') else 'xl/' + t
    if destino is None:
        raise SystemExit('No se encuentra la hoja ' + nombre_hoja)
    celdas = {}
    for c in ET.fromstring(z.read(destino)).iter('{%s}c' % NS['m']):
        ref = c.get('r')
        m = re.match(r'([A-Z]+)(\d+)', ref)
        v = c.find('m:v', NS)
        if v is None or v.text is None:
            continue
        val = ss[int(v.text)] if c.get('t') == 's' else v.text
        celdas[(m.group(1), int(m.group(2)))] = val
    return celdas


def num(v):
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def txt(celdas, col, fila):
    v = celdas.get((col, fila))
    return None if v is None else str(v).strip()


def filas_de_cabecera(celdas):
    """Filas con años 2007, 2007, 2007, 2008... en F, G, H, I (inicio de una tabla de factores por año)."""
    return sorted(r for (c, r), v in celdas.items()
                  if c == 'F' and txt(celdas, 'F', r) == '2007' and txt(celdas, 'G', r) == '2007'
                  and txt(celdas, 'I', r) == '2008')


def leer_tabla_anual(celdas, fila_anios, col_etiqueta, col_categoria=None):
    """Lee una tabla de factores por año: cada año ocupa 3 columnas (CO2, CH4, N2O)."""
    ultima_col = max(col_num(c) for (c, r) in celdas if r == fila_anios)
    anios = {}
    for n in range(col_num('F'), ultima_col + 1, 3):
        a = txt(celdas, col_letters(n), fila_anios)
        if a and a.isdigit():
            anios[int(a)] = n
    resultado = {}
    r = fila_anios + 3
    while True:
        etiqueta = txt(celdas, col_etiqueta, r)
        if not etiqueta:
            break
        categoria = txt(celdas, col_categoria, r) if col_categoria else None
        clave = etiqueta + ('|' + categoria if categoria else '')
        por_anio = {}
        for anio, n in anios.items():
            co2 = num(celdas.get((col_letters(n), r)))
            ch4 = num(celdas.get((col_letters(n + 1), r)))
            n2o = num(celdas.get((col_letters(n + 2), r)))
            if co2 is None and ch4 is None and n2o is None:
                continue
            por_anio[str(anio)] = {'co2': co2, 'ch4': ch4, 'n2o': n2o}
        resultado[clave] = por_anio
        r += 1
    return resultado


def unidad_de(clave):
    m = re.search(r'\(([^)]*)\)', clave)
    return m.group(1) if m else None


def main(ruta, salida, version):
    d = cargar_hoja(ruta, 'Dades')
    cabeceras = filas_de_cabecera(d)
    if len(cabeceras) < 3:
        raise SystemExit('No se han encontrado las tres tablas anuales esperadas: %s' % cabeceras)
    # 1) combustibles fijos (etiqueta en E), 2) vehículos por litro/kg (C + D), 3) vehículos por km (C + D)
    fijos = leer_tabla_anual(d, cabeceras[0], 'E')
    veh_ud = leer_tabla_anual(d, cabeceras[1], 'C', 'D')
    veh_km = leer_tabla_anual(d, cabeceras[2], 'C', 'D')

    # Refrigerantes (tabla A) y otros gases (tabla B)
    pca = {}
    r0 = next(r for (c, r), v in d.items() if c == 'C' and str(v).strip() == 'Lista refrigerantes')
    r = r0 + 1
    while True:
        nombre = txt(d, 'C', r)
        if nombre is None and r > r0 + 3:
            break
        if nombre and nombre != 'Otros':
            pca[nombre] = {'formula': txt(d, 'D', r), 'pca': num(d.get(('E', r)))}
        if nombre == 'Otros':
            break
        r += 1
    otros = {}
    rb = next((r for (c, r), v in d.items() if c == 'C' and str(v).strip() == 'Nombre'
               and (txt(d, 'E', r) or '').startswith('PCA')), None)
    if rb:
        r = rb + 1
        while True:
            nombre = txt(d, 'C', r)
            if not nombre or nombre == 'Otros':
                break
            otros[nombre] = {'formula': txt(d, 'D', r), 'pca': num(d.get(('E', r)))}
            r += 1

    # GWP de CH4 y N2O que aplica la calculadora
    gwp = {}
    for (c, r), v in d.items():
        if c == 'G' and v in ('Metà (CH4)', 'Metano (CH4)'):
            gwp['ch4'] = num(d.get(('H', r)))
        if c == 'G' and v in ('Òxid nitròs (N2O)', 'Óxido nitroso (N2O)'):
            gwp['n2o'] = num(d.get(('H', r)))
    if 'ch4' not in gwp or 'n2o' not in gwp:
        # calculadora 2023.2: están en la tabla B
        gwp['ch4'] = otros.get('Metano', {}).get('pca')
        gwp['n2o'] = otros.get('Óxido nitroso', {}).get('pca')

    # Mix eléctrico balear por año y reglas especiales
    mix = {}
    rm = next(r for (c, r), v in d.items() if c == 'C' and str(v).strip() == 'Any'
              and (txt(d, 'D', r) or '').startswith('kg CO2'))
    r = rm + 1
    while txt(d, 'C', r) and (txt(d, 'C', r) or '').isdigit():
        mix[txt(d, 'C', r)] = num(d.get(('D', r)))
        r += 1
    especiales = {}
    for (c, r), v in d.items():
        if c == 'C' and str(v).strip() in ('Autoconsumo', 'GdO origen renovable Illes Balears'):
            especiales[str(v).strip()] = num(d.get(('D', r)))

    anio_calc = txt(d, 'F', 2)
    datos = {
        'version': version,
        'procedencia': 'Calculadora de la huella de carbono para organizaciones (Govern de les Illes Balears), hoja oculta «Dades»',
        'anioSeleccionadoEnLaCalculadora': int(anio_calc) if anio_calc and anio_calc.isdigit() else None,
        'gwpCalculadora': gwp,
        'combustiblesFijos': {k: {'unidad': unidad_de(k), 'porAnio': v} for k, v in fijos.items()},
        'vehiculosPorUnidad': {k: {'unidad': unidad_de(k.split('|')[0]), 'porAnio': v} for k, v in veh_ud.items()},
        'vehiculosPorKm': {k: {'unidad': 'km', 'porAnio': v} for k, v in veh_km.items()},
        'refrigerantes': pca,
        'otrosGases': otros,
        'mixElectricoBalear': mix,
        'electricidadEspecial': especiales,
    }
    with open(salida, 'w', encoding='utf-8') as f:
        json.dump(datos, f, ensure_ascii=False, indent=1, sort_keys=True)
    print('%s: %d combustibles fijos, %d vehículos (ud), %d vehículos (km), %d refrigerantes, mix %s-%s, GWP %s'
          % (version, len(fijos), len(veh_ud), len(veh_km), len(pca), min(mix), max(mix), gwp))


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2], sys.argv[3])
