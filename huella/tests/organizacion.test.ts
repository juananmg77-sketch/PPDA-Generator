import test from 'node:test';
import assert from 'node:assert/strict';
import { avisosRazonSocial, formaJuridicaDe, textoResponsable, validarOrganizacion, CRITERIOS_CONSOLIDACION } from '../organizacion.ts';

test('forma jurídica de la razón social y su encaje con la letra del CIF', () => {
  assert.equal(formaJuridicaDe('Hoteles del Sol, S.L.')?.codigo, 'S.L.');
  assert.equal(formaJuridicaDe('Hoteles del Sol SLU')?.codigo, 'S.L.U.');
  assert.equal(formaJuridicaDe('Astoria Playa Sociedad Limitada')?.codigo, 'S.L.');
  assert.equal(formaJuridicaDe('Costa S.A.')?.codigo, 'S.A.');
  assert.equal(formaJuridicaDe('Costa SAU')?.codigo, 'S.A.U.');
  assert.equal(formaJuridicaDe('Mar y Sol'), null);
  assert.deepEqual(avisosRazonSocial('Hoteles del Sol, S.L.', 'Hotel Sol', 'B12345678'), []);
  assert.deepEqual(avisosRazonSocial('Costa, S.A.', 'Hotel Costa', 'A12345678'), []);
  assert.match(avisosRazonSocial('Costa, S.A.', 'Hotel Costa', 'B12345678')[0], /no encaja con el CIF.*B corresponde a S\.L\./);
  assert.match(avisosRazonSocial('Costa, S.L.', 'Hotel Costa', 'A12345678')[0], /A corresponde a S\.A\./);
  assert.match(avisosRazonSocial('Mar y Sol', 'Hotel Mar', 'B12345678')[0], /no indica la forma jurídica/);
  assert.deepEqual(avisosRazonSocial('Asociación Mar', 'Mar', 'G12345678'), []); // otras letras no exigen forma
});
test('aviso si la razón social coincide con el nombre comercial (con o sin forma jurídica)', () => {
  assert.match(avisosRazonSocial('Astoria Playa', 'Astoria Playa', 'B57198053')[0], /coincide con el nombre comercial/);
  assert.ok(avisosRazonSocial('Astoria Playa, S.L.', 'Astoria Playa', 'B57198053').some((a) => /coincide/.test(a)));
  assert.ok(!avisosRazonSocial('Hoteles Alcúdia, S.L.', 'Astoria Playa', 'B57198053').some((a) => /coincide/.test(a)));
  assert.deepEqual(avisosRazonSocial('', 'x', 'B1'), []);
});
const ok = { razonSocial: 'Hoteles Alcúdia, S.L.', nombreComercial: 'Astoria Playa', cif: 'B57198053', cnae: '5510', iae: '681', criterioConsolidacion: 'control_operativo', justificacionConsolidacion: 'La organización explota y gestiona el hotel.', responsableNombre: 'Juan Pérez', responsableCargo: 'Consultor', responsableEntidad: 'HS Consulting Group' };
test('obligatorios: razón social, CIF, CNAE, IAE, criterio con justificación y responsable (nombre, cargo, entidad); el correo no', () => {
  assert.deepEqual(validarOrganizacion(ok), []);
  const campos = (o: object) => validarOrganizacion({ ...ok, ...o }).filter((x) => x.obligatorio).map((x) => x.campo);
  assert.deepEqual(campos({ razonSocial: ' ' }), ['razonSocial']);
  assert.deepEqual(campos({ cnae: null, iae: '' }), ['cnae', 'iae']);
  assert.deepEqual(campos({ criterioConsolidacion: null }), ['criterioConsolidacion']);
  assert.deepEqual(campos({ criterioConsolidacion: 'control' }), ['criterioConsolidacion']); // «control» a secas ya no es un valor válido
  assert.deepEqual(campos({ justificacionConsolidacion: '' }), ['justificacionConsolidacion']);
  assert.deepEqual(campos({ responsableNombre: null, responsableCargo: null, responsableEntidad: null }), ['responsableNombre', 'responsableCargo', 'responsableEntidad']);
  assert.deepEqual(campos({ responsableEmail: null }), []); // opcional
});
test('un único criterio de consolidación entre tres; el responsable se escribe solo con lo que consta', () => {
  assert.deepEqual(CRITERIOS_CONSOLIDACION.map((x) => x.id), ['control_operativo', 'control_financiero', 'cuota_participacion']);
  assert.equal(textoResponsable(ok), 'Juan Pérez, Consultor, HS Consulting Group');
  assert.equal(textoResponsable({ ...ok, responsableEmail: 'jp@hs.es' }), 'Juan Pérez, Consultor, HS Consulting Group (jp@hs.es)');
  assert.equal(textoResponsable({}), null);
});
