import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centroDesdeHotel, enBaleares, normalizarIsla, organizacionDesdeHotel } from '../hotelesSuite.ts';
import type { HotelSuite } from '../hotelesSuite.ts';

const h = (o: Partial<HotelSuite> = {}): HotelSuite => ({ id: '11111111-1111-1111-1111-111111111111', codigo_hotel: 'H001', nombre_hotel: ' Hotel Playa ', cadena_hotelera: 'Cadena Sol', titular: 'Sol SL', cif: 'B123',
  pais: 'España', ccaa: 'Illes Balears', isla: 'Eivissa', municipio: 'Sant Antoni', direccion_completa: 'C/ Mar 1', num_habitaciones: 120, num_plazas: 240, activo: true, ...o });

test('islas: se normalizan nombres en catalán y se rechazan las desconocidas', () => {
  assert.equal(normalizarIsla('Eivissa'), 'Ibiza');
  assert.equal(normalizarIsla('MALLORCA'), 'Mallorca');
  assert.equal(normalizarIsla('Maó, Menorca'), 'Menorca');
  assert.equal(normalizarIsla('Tenerife'), null);
  assert.equal(normalizarIsla(null), null);
});

test('un hotel está en Baleares por su comunidad o por su isla', () => {
  assert.equal(enBaleares({ ccaa: 'Illes Balears', isla: null }), true);
  assert.equal(enBaleares({ ccaa: null, isla: 'Formentera' }), true);
  assert.equal(enBaleares({ ccaa: 'Canarias', isla: 'Tenerife' }), false);
});

test('centro desde hotel: rellena dirección, isla, habitaciones y el enlace con HS Suite', () => {
  const c = centroDesdeHotel(h());
  assert.deepEqual([c.nombre, c.direccion, c.municipio, c.isla, c.en_baleares, c.unidades_alojamiento, c.suite_codigo], ['Hotel Playa', 'C/ Mar 1', 'Sant Antoni', 'Ibiza', true, 120, 'H001']);
  assert.equal(c.suite_hotel_id, '11111111-1111-1111-1111-111111111111');
  const fuera = centroDesdeHotel(h({ ccaa: 'Canarias', isla: 'Tenerife', municipio: 'Adeje' }));
  assert.deepEqual([fuera.en_baleares, fuera.isla], [false, null]);
});

test('organización desde hotel: una cadena da nombre al grupo; sin cadena, el titular', () => {
  assert.deepEqual(organizacionDesdeHotel(h()), { nombre: 'Cadena Sol', cif: 'B123', direccion: null, suite_cadena: 'Cadena Sol', cnae: '5510' });
  const suelto = organizacionDesdeHotel(h({ cadena_hotelera: null }));
  assert.deepEqual([suelto.nombre, suelto.direccion, suelto.suite_cadena], ['Sol SL', 'C/ Mar 1', null]);
  assert.equal(organizacionDesdeHotel(h({ cadena_hotelera: null, titular: null })).nombre, 'Hotel Playa');
});
