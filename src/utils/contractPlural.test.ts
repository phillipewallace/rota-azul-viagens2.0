import { describe, it, expect } from "vitest";
import { pluralizarProduto, displayProduto } from "./contractPdf";

describe("pluralizarProduto", () => {
  it("mantém singular quando quantidade = 1", () => {
    expect(pluralizarProduto("Sanitário Químico Comum", 1)).toBe("Sanitário Químico Comum");
    expect(pluralizarProduto("Sanitário Químico Comum", "1")).toBe("Sanitário Químico Comum");
  });

  it("pluraliza o exemplo do requisito: 2 sanitários químicos comuns", () => {
    expect(pluralizarProduto("Sanitário Químico Comum", 2)).toBe("Sanitários Químicos Comuns");
    expect(pluralizarProduto("sanitário químico comum", 3)).toBe("sanitários químicos comuns");
  });

  it("pluraliza nome sem acento", () => {
    expect(pluralizarProduto("Sanitario Quimico Comum", 5)).toBe("Sanitarios Quimicos Comuns");
  });

  it("mantém 'com pia' invariável (nome do modelo)", () => {
    expect(pluralizarProduto("Sanitário Químico Com Pia", 2)).toBe("Sanitários Químicos Com Pia");
  });

  it("mantém PNE, Standard e Luxo invariáveis", () => {
    expect(pluralizarProduto("Sanitário Químico PNE", 2)).toBe("Sanitários Químicos PNE");
    expect(pluralizarProduto("Sanitário Químico Standard", 2)).toBe("Sanitários Químicos Standard");
    expect(pluralizarProduto("Sanitário Químico Luxo", 2)).toBe("Sanitários Químicos Luxo");
  });

  it("pluraliza Cabine de Banho", () => {
    expect(pluralizarProduto("Cabine de Banho", 2)).toBe("Cabines de Banho");
  });

  it("não corrompe nomes desconhecidos / frases livres", () => {
    expect(pluralizarProduto("Carretinha Frigorífica", 2)).toBe("Carretinha Frigorífica");
    expect(pluralizarProduto("Locação de Sanitário Químico tipo Comum", 2)).toBe(
      "Locação de Sanitário Químico tipo Comum",
    );
  });

  it("não re-pluraliza nomes já no plural", () => {
    expect(pluralizarProduto("Sanitários Químicos Comuns", 2)).toBe("Sanitários Químicos Comuns");
  });

  it("integra com displayProduto (rótulo curto do orçamento)", () => {
    const nome = displayProduto({ produto: "Comum" });
    expect(nome).toBe("Sanitário Químico Comum");
    expect(pluralizarProduto(nome, 2)).toBe("Sanitários Químicos Comuns");
  });
});
