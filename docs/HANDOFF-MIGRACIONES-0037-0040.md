# Traspaso: migraciones 0037 a 0040 (correcciones de la reunión de planta)

**Para:** quien tenga acceso al proyecto de Supabase de producción.
**Fecha:** 6 de noviembre de 2026.

Varias fallas que vio el equipo de planta están corregidas **en la base**, no
solo en el código. Si las migraciones no se aplican, la tableta seguirá
diciendo «Actualización no permitida para guardia» y la hora seguirá
saliendo dos horas adelantada.

## 1. Primero verifica qué ya está aplicado

```sql
select version from supabase_migrations.schema_migrations
where version >= '202611020037' order by version;
```

Deben quedar las cuatro: `202611020037`, `202611030038`, `202611060039`, `202611060040`.

## 2. Qué hace cada una

| Archivo | Corrige | ¿Toca datos? |
| --- | --- | --- |
| `202611020037_guard_booth_columns.sql` | La tableta registraba la caseta y el disparador lo rechazaba: «Actualización no permitida para guardia». | No. |
| `202611030038_reusable_pass.sql` | El QR de varias sedes o varios días se quemaba al salir de la planta 1 y salía «código no válido» en la planta 2. | No. |
| `202611060039_tijuana_timezone.sql` | La hora salía **+2 h**: sedes que quedaron en `America/Mexico_City`. Las pasa a `America/Tijuana` y conserva la hora escrita de las citas. Agrega `set_location_timezone` para cambiar la zona desde Ubicaciones. | **Sí.** Ver abajo. |
| `202611060040_security_documents.sql` | Documentos de seguridad que el visitante abre y acepta antes de llegar. Tablas `organization_security_documents`, `visit_security_acceptances` y bucket privado `security-documents`. | No. |

### Antes de la 0039

Revisa qué sedes cambian de zona. Ninguna debería operar de verdad en la
Ciudad de México; si alguna sí, quítala del `do $$ ... $$` antes de aplicar.

```sql
select o.name as empresa, l.name as sede, l.timezone
from public.locations l
join public.organizations o on o.id = l.organization_id
where l.timezone = 'America/Mexico_City';
```

## 3. Orden

1. `npx supabase db push` (aplica las que falten, en orden).
2. Después despliega el código.

## 4. Comprobación rápida después de aplicar

```sql
-- No debe quedar ninguna sede en la Ciudad de México.
select count(*) from public.locations where timezone = 'America/Mexico_City';

-- El disparador ignora las columnas de caseta.
select pg_get_functiondef('public.enforce_visit_update_permissions'::regproc)
  like '%check_in_booth_id%';

-- Existe el bucket privado de documentos de seguridad.
select id, public from storage.buckets where id = 'security-documents';
```

## 5. Pruebas con el equipo de planta (criterio de cierre)

No se da por terminado porque funcione en la computadora. Raúl y los
guardias repiten en sus tabletas:

| Prueba | Resultado esperado |
| --- | --- |
| Escanear el QR primero en la tableta, sin la computadora | Registra la entrada; no aparece «no permitida». |
| Entrada y salida en planta 1, luego acceso en planta 2 con el mismo QR | Entra en las dos si la invitación incluye ambas. |
| Lo mismo en la caseta peatonal y la vehicular de una sede | Cada caseta registra por su lado (la ficha dice cuál). |
| INE, licencia y pasaporte | Solo esos tres tipos. Nombre y folio se llenan solos o se pide corregirlos. El pasaporte pide una sola foto. |
| Visita con motivo «Otro» | Se escribe el motivo y se ve en la ficha y en el Excel. |
| Invitación con documentos de seguridad | El visitante los abre antes de llegar y no recibe el pase sin aceptarlos. La ficha, la caseta y el Excel muestran la fecha de aceptación. |
| Departamento del anfitrión y Excel | Columna «Departamento»; entrada y salida como `05/11/2026 7:20 p.m.` |
| Editar y dar de baja un guardia; editar y eliminar un departamento | Se guarda y se refleja. |
| Hora de una entrada | Coincide con el reloj de Tijuana. |

Pruebas negativas (que lo corregido no abra de más):

- QR de una sola sede en otra planta → «Este pase no es válido en esta sede».
- QR de un solo uso después de salir → bloqueado.
- Anfitrión intentando registrar un acceso → «Acceso denegado».
- Visitante sin aceptar los documentos de seguridad → no se registra.
- Caseta desactivada → su tableta no abre.

Las reglas de la base están cubiertas por pruebas automáticas en
`src/lib/__tests__/access-decision-flow.test.ts` y
`src/lib/__tests__/tijuana-timezone-migration.test.ts`.
