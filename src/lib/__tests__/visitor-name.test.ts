import { describe, expect, it } from "vitest";
import { validateRegistration, defaultVisitorFlow } from "../visitor-flow";
import {
  displayVisitorName,
  isPlaceholderVisitorName,
  matchVisitorId,
} from "../visitor-name";

const complete = {
  fullName: "Sofía Rivera",
  email: "sofia@example.test",
  phone: "5512345678",
  company: "Arco Studio",
  vehiclePlate: "ABC-1234",
  visitorNotes: "Llego con equipo",
  consent: true,
  identityPhotos: 2,
  vehiclePhotos: 1,
  attachmentItems: 1,
};

describe("nombre del pase", () => {
  it("usa el nombre que el visitante escribió y no el respaldo", () => {
    expect(
      displayVisitorName(["Sofía Rivera", "datos pendientes"], "Visitante"),
    ).toBe("Sofía Rivera");
    expect(
      displayVisitorName(["Visitante", "Ana López"], "Por confirmar"),
    ).toBe("Ana López");
    expect(displayVisitorName(["", null], "Por confirmar")).toBe(
      "Por confirmar",
    );
  });

  it("conserva un pase viejo que solo tiene el nombre de respaldo", () => {
    expect(displayVisitorName(["Visitante"], "Por confirmar")).toBe("Visitante");
    expect(displayVisitorName(["datos pendientes"], "Visitante")).toBe(
      "datos pendientes",
    );
    expect(displayVisitorName(["QA Visitante"], "Visitante")).toBe(
      "QA Visitante",
    );
  });

  it("no acepta un nombre de respaldo como registro completo", () => {
    expect(isPlaceholderVisitorName("datos pendientes")).toBe(true);
    expect(isPlaceholderVisitorName("  Por confirmar ")).toBe(true);
    expect(
      validateRegistration(
        { ...complete, fullName: "datos pendientes" },
        defaultVisitorFlow,
      ),
    ).toBe("name_required");
    expect(validateRegistration(complete, defaultVisitorFlow)).toBeNull();
  });

  it("reutiliza una sola ficha por correo o teléfono y no mezcla dos personas", () => {
    const ana = { id: "ana", email: "Ana@Firma.test", phone: "(664) 111-2233" };
    const leo = { id: "leo", email: "leo@firma.test", phone: "6649998877" };
    expect(matchVisitorId([ana, leo], "ana@firma.test", "")).toBe("ana");
    expect(matchVisitorId([ana, leo], "", "6641112233")).toBe("ana");
    expect(matchVisitorId([ana, leo], "ana@firma.test", "6649998877")).toBeNull();
    expect(
      matchVisitorId(
        [ana, { ...ana, id: "copia", email: "ana@firma.test" }],
        "ana@firma.test",
        "",
      ),
    ).toBeNull();
  });
});
