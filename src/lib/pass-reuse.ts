/**
 * Un pase se puede volver a usar, las veces que haga falta, mientras siga
 * vigente. Cubre todas las sedes, una lista de sedes, o más de un día.
 * Un pase de un solo día y una sola sede se cierra al salir.
 *
 * La misma regla está en public.pass_is_reusable. Si el cupo cambia, se
 * tocan las dos.
 */
export function passIsReusable(input: {
  allLocations?: boolean | null;
  passValidDays?: number | null;
  accessLocationCount?: number | null;
}) {
  return (
    input.allLocations === true ||
    (input.passValidDays ?? 1) > 1 ||
    (input.accessLocationCount ?? 0) > 0
  );
}
