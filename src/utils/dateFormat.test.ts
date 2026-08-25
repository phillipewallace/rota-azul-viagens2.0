import { describe, it, expect } from "vitest";
import { formatDateBR } from "./dateFormat";

describe("formatDateBR", () => {
  it("retorna travessão para vazio", () => {
    expect(formatDateBR(null)).toBe("—");
    expect(formatDateBR(undefined)).toBe("—");
    expect(formatDateBR("")).toBe("—");
  });

  it("formata ISO puro sem deslocar timezone", () => {
    // Bug conhecido: 'YYYY-MM-DD' parseado como UTC vira -1 dia no BR.
    // Deve manter o mesmo dia.
    expect(formatDateBR("2025-04-07")).toBe("07/04/2025");
    expect(formatDateBR("2025-12-31")).toBe("31/12/2025");
  });

  it("formata ISO com hora", () => {
    const out = formatDateBR("2025-04-07T15:30:00Z");
    expect(out).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it("formata Date", () => {
    const d = new Date(2025, 3, 7); // 07/abr/2025 local
    expect(formatDateBR(d)).toBe("07/04/2025");
  });

  it("retorna travessão para entrada inválida", () => {
    expect(formatDateBR("não-é-data")).toBe("—");
  });
});
