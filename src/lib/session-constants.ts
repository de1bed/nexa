/** Nombres de cookie compartidos por servidor y navegador. */
export const ORG_COOKIE = "nexa-org";
export const SHOWCASE_ROLE_COOKIE = "nexa-role";
/** Guardia concreto de la demostración. El rol solo dice «guardia». */
export const DEMO_ACTOR_COOKIE = "nexa-demo-actor";
export const DEMO_ACTOR_NAME_COOKIE = "nexa-demo-actor-name";
/** Marca el recorrido público de demostración. No abre datos reales. */
export const DEMO_COOKIE = "nexa-demo";
/**
 * Empresa que el superadmin está viendo como su administrador.
 * Si tiene valor, esa membresía se creó solo para el apoyo y se retira al salir.
 */
export const SUPPORT_ORG_COOKIE = "nexa-support-org";
/** La demostración avisa la misma vista sin abrir datos reales. */
export const SUPPORT_VIEW_COOKIE = "nexa-support-view";
/**
 * Tableta ya abierta. HttpOnly: el guardia no puede leer el usuario ni la clave.
 * El id no es el nombre de usuario.
 */
export const STATION_COOKIE = "nexa-station";
/** Caseta de ese usuario de tableta. Tampoco lleva el nombre de usuario. */
export const STATION_BOOTH_COOKIE = "nexa-station-booth";
