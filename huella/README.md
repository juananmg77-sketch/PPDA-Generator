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
