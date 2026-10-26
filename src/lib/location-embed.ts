/**
 * `visit_access_locations` is a second visits↔locations relationship.
 * PostgREST answers `location:locations(…)` with HTTP 300 unless the foreign
 * key is named. The guest registration treated that empty result as a dead link.
 */
export function visitLocationEmbed(columns: string) {
  return `location:locations!visits_location_id_fkey(${columns})`;
}

export const invitationVisitSelect =
  "id,organization_id,visitor_id,starts_at,ends_at,pass_valid_days,location:locations!visits_location_id_fkey(timezone)" as const;

export const invitationTimezoneSelect =
  "location:locations!visits_location_id_fkey(timezone)" as const;
