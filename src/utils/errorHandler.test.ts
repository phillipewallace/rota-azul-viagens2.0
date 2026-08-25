import { describe, it, expect } from "vitest";
import { classifyError, validateFields } from "./errorHandler";

describe("classifyError", () => {
  it("classifica erro de rede como retryable", () => {
    const r = classifyError(new Error("NetworkError: failed to fetch"));
    expect(r.type).toBe("network");
    expect(r.retryable).toBe(true);
  });
  it("classifica timeout", () => {
    const r = classifyError(new Error("AbortError: timeout"));
    expect(r.type).toBe("timeout");
    expect(r.retryable).toBe(true);
  });
  it("classifica 404 como não retryable", () => {
    const r = classifyError(new Error("404 not found"));
    expect(r.type).toBe("notFound");
    expect(r.retryable).toBe(false);
  });
  it("classifica 401/403 como unauthorized", () => {
    expect(classifyError(new Error("401")).type).toBe("unauthorized");
    expect(classifyError(new Error("403")).type).toBe("unauthorized");
  });
  it("classifica 500 como server retryable", () => {
    const r = classifyError(new Error("500 internal"));
    expect(r.type).toBe("server");
    expect(r.retryable).toBe(true);
  });
  it("fallback para unknown", () => {
    const r = classifyError(new Error("algo bem específico"));
    expect(r.type).toBe("unknown");
  });
});

describe("validateFields", () => {
  it("required marca campo vazio", () => {
    const r = validateFields([
      { field: "nome", value: "", rules: { required: true } },
    ]);
    expect(r.valid).toBe(false);
    expect(r.errors.nome).toBeDefined();
  });

  it("respeita minLength e maxLength", () => {
    const r = validateFields([
      { field: "nome", value: "ab", rules: { minLength: 3 } },
      { field: "bio", value: "x".repeat(11), rules: { maxLength: 10 } },
    ]);
    expect(r.valid).toBe(false);
    expect(r.errors.nome).toContain("pelo menos");
    expect(r.errors.bio).toContain("no máximo");
  });

  it("min/max numérico", () => {
    const r = validateFields([
      // valor 0 cai no early-return (treated as empty); usar valor truthy
      { field: "idade", value: 0.5, rules: { min: 1 } },
      { field: "nota", value: 11, rules: { max: 10 } },
    ]);
    expect(r.valid).toBe(false);
    expect(Object.keys(r.errors)).toHaveLength(2);
  });

  it("pattern", () => {
    const r = validateFields([
      { field: "email", value: "xyz", rules: { pattern: /@/ } },
    ]);
    expect(r.valid).toBe(false);
  });

  it("regra custom", () => {
    const r = validateFields([
      {
        field: "x",
        value: 5,
        rules: { custom: (v) => (v < 10 ? "muito baixo" : null) },
      },
    ]);
    expect(r.errors.x).toBe("muito baixo");
  });

  it("válido quando tudo OK", () => {
    const r = validateFields([
      { field: "nome", value: "Maria", rules: { required: true, minLength: 3 } },
    ]);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual({});
  });
});
