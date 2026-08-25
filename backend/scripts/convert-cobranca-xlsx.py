#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Converte as planilhas de COBRANÇA (MICBAN / DSR) em JSON enriquecido para
importação no ERP.

Uso:
  python3 backend/scripts/convert-cobranca-xlsx.py \
      --micban "/caminho/COBRANÇA_2026_MICBAN.xlsx" \
      --dsr    "/caminho/COBRANÇA_DSR_-_2026.xlsx"

Saída:
  backend/scripts/legacy-data/cobranca-micban.json
  backend/scripts/legacy-data/cobranca-dsr.json

Regras principais
-----------------
* 1 linha da planilha = 1 mês de faturamento de UMA obra.
  Linhas da mesma (cliente + obra + tipo) em meses diferentes são agrupadas em
  UM contrato só; guardamos o histórico mensal em `historico`.
* `DADOS CADASTRAIS` é uma string densa: extraímos razão social, CNPJ, CEP,
  endereço, responsável (nome/telefone) e e-mails.
* Tipo (COMUM / COM PIA / ACOPLADO / PNE / REDE PÚBLICA) => contrato de obra.
  Qualquer coisa que NÃO seja sanitário químico (carretinha, caminhão pipa,
  apenas limpeza, etc.) => tipo "outro", e o texto original vai na DESCRIÇÃO.
* Nada de inventário/carretinhas: tudo textual na descrição.
"""
import argparse
import json
import os
import re
import unicodedata
from datetime import date

import pandas as pd

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'legacy-data')

MESES = {
    'JAN': 1, 'FEV': 2, 'MAR': 3, 'ABR': 4, 'MAI': 5, 'JUN': 6,
    'JUL': 7, 'AGO': 8, 'SET': 9, 'OUT': 10, 'NOV': 11, 'DEZ': 12,
}

SANITARIO_KEYS = ('COMUM', 'COMUJM', 'COMU', 'PIA', 'ACLOP', 'ACOPL', 'PNE',
                  'QUIMIC', 'QUÍMIC', 'REDE PUBLICA', 'REDE PÚBLICA', 'LUXO')


def strip_accents(s: str) -> str:
    return ''.join(c for c in unicodedata.normalize('NFD', s)
                   if unicodedata.category(c) != 'Mn')


def norm(s) -> str:
    return re.sub(r'\s+', ' ', strip_accents(str(s or '')).upper()).strip()


def clean(v):
    if v is None:
        return None
    if isinstance(v, float) and pd.isna(v):
        return None
    s = re.sub(r'[ \t]+', ' ', str(v)).strip()
    s = re.sub(r'\n{2,}', '\n', s)
    return s or None


def find_col(cols, *keys, exclude=()):
    for c in cols:
        n = norm(c)
        if all(k in n for k in keys) and not any(x in n for x in exclude):
            return c
    return None


def sheet_period(name: str):
    """'AGOSTO 26' / 'JAN 2021' / 'MAIO 26 (2)' -> (ano, mes)"""
    n = norm(name)
    mes = None
    for k, v in MESES.items():
        if n.startswith(k):
            mes = v
            break
    m = re.search(r'(20\d{2}|\b\d{2}\b)', n)
    ano = None
    if m:
        y = int(m.group(1))
        ano = y if y > 999 else 2000 + y
    if mes and ano:
        return ano, mes
    return None


def only_digits(s):
    return re.sub(r'\D', '', s or '')


def parse_cadastrais(raw: str):
    """Extrai razão social, CNPJ, CEP, endereço, responsável, telefone, e-mails."""
    out = {'razao_social': None, 'documento': None, 'cep': None, 'endereco': None,
           'responsavel_nome': None, 'responsavel_telefone': None,
           'responsavel_email': None, 'emails': []}
    if not raw:
        return out
    txt = re.sub(r'\s+', ' ', raw.replace('\n', ' ')).strip()

    emails = re.findall(r'[\w.\-+]+@[\w.\-]+\.\w{2,}', txt)
    seen, uniq = set(), []
    for e in emails:
        k = e.lower()
        if k not in seen:
            seen.add(k)
            uniq.append(e.lower())
    out['emails'] = uniq
    out['responsavel_email'] = uniq[0] if uniq else None

    mc = re.search(r'(\d{2})[.\s]?(\d{3})[.\s]?(\d{3})\s?/\s?(\d{4})[-.\s]?(\d{2})', txt)
    if mc:
        out['documento'] = ''.join(mc.groups())
        out['razao_social'] = re.split(r',|\bCNPJ\b', txt[:mc.start()], flags=re.I)[0].strip(' ,.-') or None
    else:
        out['razao_social'] = re.split(r',', txt)[0].strip(' ,.-') or None

    mcep = re.search(r'CEP[:\s]*([\d.\-]{8,12})', txt, re.I)
    if mcep:
        d = only_digits(mcep.group(1))
        if len(d) == 8:
            out['cep'] = f'{d[:5]}-{d[5:]}'

    mresp = re.search(r'(?:SOLICITADO POR|CONTATO|A/?C|FALAR COM)[:\s]+([^:,;]{2,60})', txt, re.I)
    if mresp:
        out['responsavel_nome'] = mresp.group(1).strip(' ,.-') or None

    mtel = re.search(r'(\(?\d{2}\)?[\s.-]?)?9?\d{4}[-\s.]?\d{4}', txt)
    if mtel:
        tel = only_digits(mtel.group(0))
        if 10 <= len(tel) <= 11:
            out['responsavel_telefone'] = tel

    # endereço = trecho entre CNPJ e o primeiro e-mail / "SOLICITADO POR"
    tail = txt[mc.end():] if mc else txt
    tail = re.split(r'SOLICITADO POR|CONTATO|[\w.\-+]+@', tail, flags=re.I)[0]
    tail = tail.strip(' ,.;-')
    out['endereco'] = tail or None
    return out


def parse_periodo(raw, ano_ref, mes_ref):
    """'26/07/26 Á 25/08/26' | '08/07/2026   07/08/2026' | '31/07 Á 30/08/26'"""
    if not raw:
        return None, None
    pares = re.findall(r'(\d{1,2})\s*/\s*(\d{1,2})(?:\s*/\s*(\d{2,4}))?', str(raw))
    datas = []
    for d, m, y in pares[:2]:
        try:
            d, m = int(d), int(m)
            if y:
                yy = int(y)
                yy = yy if yy > 999 else 2000 + yy
            else:
                yy = ano_ref or date.today().year
            datas.append(date(yy, m, min(d, 28 if m == 2 else 31)).isoformat())
        except ValueError:
            pass
    if len(datas) == 2:
        return datas[0], datas[1]
    if len(datas) == 1:
        return datas[0], None
    return None, None


def parse_data(v):
    if v is None or pd.isna(v):
        return None
    try:
        parsed = pd.to_datetime(v, dayfirst=True)
        if pd.isna(parsed):
            return None
        return parsed.date().isoformat()
    except Exception:
        return None


def parse_valor(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return 0.0
    s = re.sub(r'[^\d,.\-]', '', str(v))
    if s.count(',') and s.count('.'):
        s = s.replace('.', '').replace(',', '.')
    else:
        s = s.replace(',', '.')
    try:
        return round(float(s), 2)
    except ValueError:
        return 0.0


def parse_dia_venc(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    m = re.search(r'\d{1,2}', str(v))
    if not m:
        return None
    n = int(m.group(0))
    return min(max(n, 1), 28)


def parse_int(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    m = re.search(r'\d+', str(v))
    return int(m.group(0)) if m else None


def classificar(tipo_raw, endereco_obra):
    """Retorna (tipo_contrato, tipo_label)."""
    t = norm(tipo_raw)
    blob = f'{t} {norm(endereco_obra)}'
    if any(k in t for k in ('CARRETINH', 'PIPA', 'APENAS LIMPEZA', 'SOMENTE LIMPEZA',
                            'PROPRIEDADE DO CLIENTE', 'CACAMBA', 'CONTAINER')):
        return 'outro', clean(tipo_raw)
    if any(k in t for k in SANITARIO_KEYS):
        label = clean(tipo_raw)
        if t in ('COMUJM', 'COMU'):
            label = 'COMUM'
        return 'obra', label
    if 'CARRETINH' in blob or 'PIPA' in blob:
        return 'outro', clean(tipo_raw) or 'Carretinha'
    if not t or t in ('NAN',) or re.fullmatch(r'[\d.\s]*', t or ''):
        return 'outro', None
    return 'outro', clean(tipo_raw)


def build_descricao(tipo_contrato, tipo_label, qtd, limpezas, endereco_obra):
    partes = []
    if tipo_contrato == 'obra':
        base = f'Locação de {qtd or 1} sanitário(s) químico(s)'
        if tipo_label:
            base += f' — modelo {tipo_label}'
        partes.append(base)
    else:
        partes.append(f'Locação/serviço: {tipo_label or "não especificado"}'
                      + (f' — {qtd} unidade(s)' if qtd else ''))
    if limpezas:
        partes.append(f'{limpezas} limpeza(s)/mês')
    if endereco_obra:
        partes.append(f'Local: {endereco_obra}')
    return ' | '.join(partes)


def extract_extras(*textos):
    """CNO e pedido/ordem de compra soltos no texto."""
    blob = ' '.join(str(t or '') for t in textos)
    cno = None
    mc = re.search(r'CNO(?:/CEI)?(?:\s*DA\s*OBRA)?[:\s]*([\d.\-/]{10,})', blob, re.I)
    if mc:
        cno = mc.group(1).strip(' .,-')
    pedido = None
    mp = re.search(r'(?:PEDIDO DE COMPRA|ORDEM DE COMPRA|ORDEM|OBRA)[:\s]*(\d{2,8})', blob, re.I)
    if mp:
        pedido = mp.group(1)
    return cno, pedido


def convert(path, prefix, label):
    try:
        xl = pd.ExcelFile(path, engine='calamine')
    except Exception:
        xl = pd.ExcelFile(path)
    grupos = {}
    ordem = []
    linhas_lidas = 0

    for sheet in xl.sheet_names:
        per = sheet_period(sheet)
        if not per:
            continue
        ano_ref, mes_ref = per
        df = xl.parse(sheet)
        df = df.dropna(how='all')
        cols = list(df.columns)
        c_emp = find_col(cols, 'EMPRESA')
        if not c_emp:
            continue
        c_obs = find_col(cols, 'OBSERVA')
        c_nf = find_col(cols, 'NF')
        c_per = find_col(cols, 'PERIOD')
        c_qtd = find_col(cols, 'QTD', exclude=('LIMPEZA',))
        c_end = find_col(cols, 'ENDERECO')
        c_val = find_col(cols, 'VALOR')
        c_ven = find_col(cols, 'VENCIM')
        c_tipo = find_col(cols, 'TIPO')
        c_limp = find_col(cols, 'LIMPEZA')
        c_ent = find_col(cols, 'ENTREGA')
        c_ret = find_col(cols, 'RETIRADA')
        c_cad = find_col(cols, 'CADASTRAIS')

        for _, row in df.iterrows():
            empresa = clean(row.get(c_emp))
            if not empresa:
                continue
            linhas_lidas += 1
            cad = parse_cadastrais(clean(row.get(c_cad)) if c_cad else None)
            endereco_obra = clean(row.get(c_end)) if c_end else None
            tipo_raw = clean(row.get(c_tipo)) if c_tipo else None
            obs = clean(row.get(c_obs)) if c_obs else None
            valor = parse_valor(row.get(c_val)) if c_val else 0.0
            qtd = parse_int(row.get(c_qtd)) if c_qtd else None
            limpezas = parse_int(row.get(c_limp)) if c_limp else None
            pi, pf = parse_periodo(clean(row.get(c_per)) if c_per else None, ano_ref, mes_ref)
            entrega = parse_data(row.get(c_ent)) if c_ent else None
            retirada = parse_data(row.get(c_ret)) if c_ret else None
            dia_venc = parse_dia_venc(row.get(c_ven)) if c_ven else None
            nf = clean(row.get(c_nf)) if c_nf else None
            tipo_contrato, tipo_label = classificar(tipo_raw, endereco_obra)
            cno, pedido = extract_extras(endereco_obra, obs)

            doc = cad['documento'] or ''
            chave = '|'.join([
                doc or norm(empresa),
                norm(endereco_obra)[:60],
                norm(tipo_label)[:20],
            ])

            mes_ref_iso = f'{ano_ref:04d}-{mes_ref:02d}'
            hist = {
                'competencia': mes_ref_iso, 'aba': sheet, 'nf': nf, 'valor': valor,
                'periodo_inicio': pi, 'periodo_fim': pf, 'dia_vencimento': dia_venc,
                'qtd': qtd, 'limpezas': limpezas, 'observacao': obs,
            }

            g = grupos.get(chave)
            if not g:
                g = {
                    'chave': chave,
                    'empresa_planilha': empresa,
                    'razao_social': cad['razao_social'] or empresa,
                    'documento': cad['documento'],
                    'endereco_cliente': cad['endereco'],
                    'cep_cliente': cad['cep'],
                    'responsavel_nome': cad['responsavel_nome'],
                    'responsavel_telefone': cad['responsavel_telefone'],
                    'responsavel_email': cad['responsavel_email'],
                    'emails': cad['emails'],
                    'endereco_obra': endereco_obra,
                    'tipo_contrato': tipo_contrato,
                    'tipo_label': tipo_label,
                    'tipo_raw': tipo_raw,
                    'cno': cno,
                    'pedido_compra': pedido,
                    'qtd': qtd,
                    'limpezas': limpezas,
                    'valor_mensal': valor,
                    'dia_vencimento': dia_venc,
                    'data_entrega': entrega,
                    'data_retirada': retirada,
                    'primeira_competencia': mes_ref_iso,
                    'ultima_competencia': mes_ref_iso,
                    'historico': [],
                }
                grupos[chave] = g
                ordem.append(chave)
            # campos "melhores" ganham (o mês mais recente é a verdade atual)
            g['ultima_competencia'] = max(g['ultima_competencia'], mes_ref_iso)
            g['primeira_competencia'] = min(g['primeira_competencia'], mes_ref_iso)
            if mes_ref_iso >= g['ultima_competencia']:
                if valor:
                    g['valor_mensal'] = valor
                if dia_venc:
                    g['dia_vencimento'] = dia_venc
                if qtd:
                    g['qtd'] = qtd
                if limpezas:
                    g['limpezas'] = limpezas
            for k, v in (('cno', cno), ('pedido_compra', pedido), ('data_entrega', entrega),
                         ('data_retirada', retirada), ('endereco_cliente', cad['endereco']),
                         ('cep_cliente', cad['cep']), ('responsavel_nome', cad['responsavel_nome']),
                         ('responsavel_telefone', cad['responsavel_telefone']),
                         ('responsavel_email', cad['responsavel_email'])):
                if v and not g.get(k):
                    g[k] = v
            if cad['emails']:
                g['emails'] = sorted(set(g['emails']) | set(cad['emails']))
            g['historico'].append(hist)

    # numeração com prefixo da empresa emissora + competência inicial
    seq = {}
    saida = []
    for chave in ordem:
        g = grupos[chave]
        comp = g['primeira_competencia']
        seq[comp] = seq.get(comp, 0) + 1
        ano, mes = comp.split('-')
        g['numero'] = f'{prefix}-COB-{ano}/{mes}-{seq[comp]:03d}'
        g['descricao'] = build_descricao(g['tipo_contrato'], g['tipo_label'],
                                         g['qtd'], g['limpezas'], g['endereco_obra'])
        g['historico'].sort(key=lambda h: h['competencia'])
        saida.append(g)

    return saida, linhas_lidas


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--micban')
    ap.add_argument('--dsr')
    args = ap.parse_args()
    os.makedirs(OUT_DIR, exist_ok=True)

    jobs = []
    if args.micban:
        jobs.append((args.micban, 'MIC', 'MIC BAN', 'cobranca-micban.json'))
    if args.dsr:
        jobs.append((args.dsr, 'DSR', 'Debora de S Rodrigues', 'cobranca-dsr.json'))
    if not jobs:
        ap.error('informe --micban e/ou --dsr')

    for path, prefix, label, out in jobs:
        rows, lidas = convert(path, prefix, label)
        dest = os.path.join(OUT_DIR, out)
        with open(dest, 'w', encoding='utf8') as fh:
            json.dump(rows, fh, ensure_ascii=False, indent=1)
        obra = sum(1 for r in rows if r['tipo_contrato'] == 'obra')
        outro = len(rows) - obra
        ativos = sum(1 for r in rows if r['ultima_competencia'] == max(x['ultima_competencia'] for x in rows))
        print(f'[{label}] {lidas} linhas -> {len(rows)} contratos '
              f'(obra={obra}, outro={outro}, no último mês={ativos}) -> {dest}')


if __name__ == '__main__':
    main()
