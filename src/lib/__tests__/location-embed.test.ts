import { describe, expect, it } from "vitest";
import {
  invitationTimezoneSelect,
  invitationVisitSelect,
  visitLocationEmbed,
} from "../location-embed";

describe("embed de la sede de la visita", () => {
  it("nombra la llave foránea para no chocar con las sedes del pase", () => {
    const embed = visitLocationEmbed("timezone");
    expect(embed).toBe(
      "location:locations!visits_location_id_fkey(timezone)",
    );
    expect(embed).not.toContain("locations(timezone)");
    expect(invitationTimezoneSelect).toBe(embed);
    expect(invitationVisitSelect).toContain(embed);
  });
});
