import { describe, it, expect } from "vitest";
import { buildMhtml } from "./contractDoc";

describe("buildMhtml (contrato en Word con imágenes embutidas)", () => {
  const imagen = {
    loc: "file:///C:/rotaazul-contrato/logo",
    mime: "image/png",
    base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFZSVw==",
    w: 120,
    h: 60,
  };

  it("genera cabecera MIME multipart/related", () => {
    const out = buildMhtml("<p>hola</p>", []);
    // Con saltos de línea CRLF
    expect(out).toBeDefined();
    expect(out).toContain("MIME-Version: 1.0\r\n");
    expect(out).toMatch(/Content-Type: multipart\/related; boundary="[^"]+"; type="text\/html"/);
    expect(out).toContain("Content-Type: text/html; charset=\"utf-8\"");
  });

  it("embebe cada imagen como parte base64 con su Content-Location y Content-ID", () => {
    const out = buildMhtml(`<img src="${imagen.loc}">`, [imagen]);
    expect(out).toContain(`Content-Location: ${imagen.loc}`);
    expect(out).toContain("Content-Type: image/png");
    expect(out).toContain("Content-Transfer-Encoding: base64");
    expect(out).toContain("Content-ID: <logo@rotaazul>");
    // El base64 está presente sin los saltos (wrapBase64 lo rompe a 76)
    expect(out).toContain(imagen.base64);
  });

  it("usa el mismo delimiter del boundary al inicio de cada parte", () => {
    const out = buildMhtml("<p>x</p>", [imagen]);
    const boundary = out.match(/boundary="([^"]+)"/)?.[1];
    expect(boundary).toBeDefined();
    expect(out).toContain(`\r\n--${boundary}\r\n`);
    expect(out.trimEnd().endsWith(`--${boundary}--`)).toBe(true);
  });

  it("cierra correctamente el multipart", () => {
    const out = buildMhtml("<p>x</p>", []);
    const boundary = out.match(/boundary="([^"]+)"/)?.[1];
    expect(boundary).toBeDefined();
    expect(out).toContain(`--${boundary}--`);
  });
});