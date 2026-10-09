import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseRotasWorkbook } from './rotasExcelParser';

/** Monta um workbook em memória: { nomeAba: matriz } -> ArrayBuffer. */
function buildWorkbook(sheets: Record<string, unknown[][]>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as unknown;
  if (out instanceof ArrayBuffer) return out;
  return (out as Uint8Array).buffer as ArrayBuffer;
}

describe('parseRotasWorkbook', () => {
  it('cada aba vira uma rota e cada linha vira um ponto', () => {
    const buf = buildWorkbook({
      'Centro Barreiro': [
        ['Empresa', 'Endereço', 'Contato'],
        ['Padaria Pão Dourado', 'Rua A, 100', 'Maria 9999'],
        ['Mercado Central', 'Rua B, 200', 'João 8888'],
      ],
      'Savassi': [
        ['Empresa', 'Endereço'],
        ['Café Aroma', 'Rua C, 300'],
      ],
    });

    const rotas = parseRotasWorkbook(buf);
    expect(rotas).toHaveLength(2);

    const centro = rotas.find((r) => r.name === 'Centro Barreiro')!;
    expect(centro.pontos).toHaveLength(2);
    expect(centro.pontos[0].company).toBe('Padaria Pão Dourado');
    expect(centro.pontos[0].address).toBe('Rua A, 100');
    expect(centro.pontos[0].contact).toBe('Maria 9999');

    const savassi = rotas.find((r) => r.name === 'Savassi')!;
    expect(savassi.pontos).toHaveLength(1);
  });

  it('reconhece sinônimos e ignora acentos/maiúsculas', () => {
    const buf = buildWorkbook({
      'Rota 1': [
        ['CLIENTE', 'LOGRADOURO', 'TELEFONE', 'OBSERVAÇÃO', 'Nº SANITÁRIO', 'MODELO', 'COR'],
        ['Empresa X', 'Rua Z', '9999', 'obs aqui', '12', 'STD', 'Azul'],
      ],
    });

    const [rota] = parseRotasWorkbook(buf);
    expect(rota.pontos).toHaveLength(1);
    const [p] = rota.pontos;
    expect(p.company).toBe('Empresa X');
    expect(p.address).toBe('Rua Z');
    expect(p.contact).toBe('9999');
    expect(p.observation).toBe('obs aqui');
    expect(p.sanitarioNumber).toBe('12');
    expect(p.model).toBe('STD');
    expect(p.color).toBe('Azul');
  });

  it('ignora abas vazias e usa fallback posicional sem cabeçalho', () => {
    const buf = buildWorkbook({
      Vazia: [],
      'Sem cabecalho': [
        ['Empresa Y', 'Rua W, 10', '2x semana', '3', 'Pedro', 'nota'],
      ],
    });

    const rotas = parseRotasWorkbook(buf);
    expect(rotas).toHaveLength(1);
    expect(rotas[0].name).toBe('Sem cabecalho');
    expect(rotas[0].headerRowIndex).toBe(-1);
    const [p] = rotas[0].pontos;
    expect(p.company).toBe('Empresa Y');
    expect(p.address).toBe('Rua W, 10');
  });

  it('pula linhas de título antes do cabeçalho', () => {
    const buf = buildWorkbook({
      'Rota 2': [
        ['RELATÓRIO DE ROTAS - JANEIRO'],
        [''],
        ['Empresa', 'Endereço', 'Banheiros'],
        ['Loja Q', 'Av Q, 5', '2'],
      ],
    });

    const [rota] = parseRotasWorkbook(buf);
    // O título não pode virar ponto
    expect(rota.pontos).toHaveLength(1);
    expect(rota.pontos[0].company).toBe('Loja Q');
    expect(rota.pontos[0].bathrooms).toBe('2');
  });
});
