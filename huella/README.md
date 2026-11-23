# Motor de cálculo de la huella de carbono (fase 1)

Calcula las **Categorías 1 y 2** del Registro balear de huella de carbono (Decreto 48/2021) siguiendo la ISO 14064-1.
Código puro (sin dependencias, sin acceso a datos): recibe líneas de actividad y un conjunto de factores y devuelve emisiones con su trazabilidad.

| Archivo | Para qué |
|---|---|
| `tipos.ts` | Tipos: factores, líneas de actividad, resultados y totales |
| `factores.ts` | Construye el **conjunto de factores de un inventario** a partir de una versión de la calculadora oficial; los cambios manuales exigen justificación |
| `motor.ts` | Cálculo: combustión (fija y móvil), emisiones fugitivas, electricidad con los dos métodos (ubicación y mercado) y totales |
| `datos/factores-calculadora-*.json` | Factores oficiales extraídos de las calculadoras 2023.2 y 2024.1 (hoja oculta «Dades») |
| `scripts/extraer_factores.py` | Genera esos JSON desde el Excel de la calculadora |
| `extraccion.ts` | Validación de la **lectura de facturas** (unidades, periodos, duplicados, solapes, PCS/PCI), propuesta de líneas de actividad en borrador, variación anual (>20 %) y criterio de exclusión (<3 % y ≤5 %) |
| `sql/` | Esquema de la base (tablas `hc_*`, RLS, auditoría, bloqueo de inventarios cerrados, carpeta privada de facturas) |
| `tests/` | Pruebas unitarias y **prueba de aceptación** con el informe de ejemplo (inventario 2022) |

## Reglas
- Los factores se guardan **por año y por versión del documento**: el mismo año cambia entre versiones (p. ej. gasóleo C 2022: 2,705 en la calculadora 2023.2 y 2,881 en la 2024.1). Un inventario cerrado no se recalcula con factores nuevos.
- Si falta un factor se lanza un error; nunca se asume cero.
- Se calcula en kg y solo se redondea al presentar.
- Electricidad: el valor del registro balear (0 con autoconsumo o garantía de origen renovable de Baleares) y los dos métodos de la ISO (ubicación y mercado) se devuelven **por separado**.

## Cómo ejecutar las pruebas
```
npm run test:huella
```
(necesita Node 22.6 o superior; no instala nada).

## Cómo regenerar los factores
```
python3 -I huella/scripts/extraer_factores.py <calculadora.xlsx> huella/datos/factores-calculadora-<version>.json calculadora-<version>
```

## Pendiente
- Factores de maquinaria (la gasolina de maquinaria del informe de ejemplo usa 2,263 kg/l, que no figura en la calculadora).
- PCA AR5 de refrigerantes y GWP de 2022 (28 y 265): proceden del informe de ejemplo; contrastar con el documento del MITECO y el BOIB.
- Mix eléctrico de 2024 (0,348): contrastar con la resolución del Govern.
- Factores del registro estatal (mix por comercializadora): fuera de la primera versión.

## Calculadora oficial cumplimentada (paquete del verificador)
- `calculadoraOficial.ts` rellena el libro oficial del Registro balear (`public/plantillas/calculadora-2023.2.xlsx` y `-2024.1.xlsx`, según los factores del cálculo) editando solo el XML de las celdas de entrada: se conservan fórmulas, listas, protección y hojas ocultas, y el libro se marca para recalcular al abrirlo (los resultados 4.1 los calcula Excel).
- Rellena 0.1 (organización, índice de actividad, centros), 1.1 (instalaciones fijas), 1.2 (vehículos A.1 y A.2), 1.4 (gases, recarga anual) y 2.1 (electricidad por centro, comercializadora y tipo: «No», «Autoconsumo» o «GdO origen renovable Illes Balears»). Cada bloque del libro admite 22 filas (20 en A.2): si se superan, falla con mensaje claro.
- No se rellenan: tipo de organización, coordenadas, tipo de equipo y carga inicial de los gases, plan de reducción (0.2), procesos (1.3), categorías 3-6 ni la hoja estatal. La pantalla Informe los lista como «pendientes».
- Botones en Informe: «Paquete del verificador (ZIP)» (xlsx de recálculo + calculadora + LEEME) y «Calculadora oficial (Excel)».
- Verificación: recalculando el libro relleno con un motor de fórmulas independiente, 1.1, 1.2, 1.4 y 2.1 dan los mismos kg CO₂e por línea que el motor de la app.
