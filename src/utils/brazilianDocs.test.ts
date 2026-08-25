import { describe, it, expect } from "vitest";
import {
  onlyDigits,
  maskCpf,
  maskCnpj,
  maskCep,
  maskPhone,
  isValidCpf,
  isValidCnpj,
  isValidDocument,
} from "./brazilianDocs";

describe("onlyDigits", () => {
  it("remove tudo que não é dígito", () => {
    expect(onlyDigits("abc 123-45.6")).toBe("123456");
  });
  it("aceita null/undefined", () => {
    expect(onlyDigits(null)).toBe("");
    expect(onlyDigits(undefined)).toBe("");
  });
});

describe("máscaras", () => {
  it("formata CPF progressivamente", () => {
    expect(maskCpf("12345678909")).toBe("123.456.789-09");
    expect(maskCpf("123")).toBe("123");
    expect(maskCpf("123456")).toBe("123.456");
  });
  it("limita CPF a 11 dígitos", () => {
    expect(maskCpf("123456789091111")).toBe("123.456.789-09");
  });
  it("formata CNPJ", () => {
    expect(maskCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });
  it("formata CEP e telefone", () => {
    expect(maskCep("01310100")).toBe("01310-100");
    expect(maskPhone("11987654321")).toBe("(11) 98765-4321");
    expect(maskPhone("1133334444")).toBe("(11) 3333-4444");
  });
});

describe("validação CPF/CNPJ", () => {
  it("CPF válido", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
  });
  it("CPF inválido (dígitos errados)", () => {
    expect(isValidCpf("123.456.789-00")).toBe(false);
  });
  it("CPF inválido (todos iguais)", () => {
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });
  it("CPF inválido (tamanho errado)", () => {
    expect(isValidCpf("1234")).toBe(false);
  });
  it("CNPJ válido", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
  });
  it("CNPJ inválido", () => {
    expect(isValidCnpj("11.222.333/0001-00")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
  });
  it("isValidDocument roteia por tipo", () => {
    expect(isValidDocument("529.982.247-25", "PF")).toBe(true);
    expect(isValidDocument("11.222.333/0001-81", "PJ")).toBe(true);
    expect(isValidDocument("11.222.333/0001-81", "PF")).toBe(false);
  });
});
