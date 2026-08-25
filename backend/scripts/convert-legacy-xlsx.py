#!/usr/bin/env python3
"""
Converte os Excel legados (DSR / MIC BAN) em JSON enriquecido, extraindo
via regex os campos que estão soltos no texto de `Observações`.

Campos extraídos (além dos já colunados):
  - endereco (Local de entrega / Endereço)
  - descricao (primeira linha significativa do texto)
  - cno (coluna Código da Obra, com fallback pra texto)
  - responsavel_nome / responsavel_telefone / responsavel_email
  - quantidade_limpezas
  - data_entrega  (substitui data_inicio se presente)

Ignorados por decisão: vigencia_final, frete, condicoes_pagamento,
e-mails extras, nº/cor sanitário, vendedor, categoria etc.

Uso:
  python3 backend/scripts/convert-legacy-xlsx.py
"""
import json, re, sys
from pathlib import Path
import pandas as pd

HERE = Path(__file__).parent / "legacy-data"

SOURCES = [
    ("DSR.xlsx",    "dsr.json"),
    ("MICBAN.xlsx", "micban.json"),
]

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_RE = re.compile(r"\(?\d{2}\)?\s*9?\d{4,5}[-\s]?\d{4}")

# "Solicitado pelo Samuel : (31) 97314-5803."
RESP_LINE_RE = re.compile(
    r"(?:solicitad[oa]\s+(?:pel[oa]|por)|respons[áa]vel(?:\s+pelo\s+contrato)?|contato)\s*:?\s*([^:\n\r()]+?)\s*(?:[:\-–])?\s*(\(?\d[\d\s()\-]{7,})",
    re.IGNORECASE,
)
RESP_NAME_ONLY_RE = re.compile(
    r"(?:solicitad[oa]\s+(?:pel[oa]|por)|respons[áa]vel(?:\s+pelo\s+contrato)?)\s*:?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,60})",
    re.IGNORECASE,
)

ENDERECO_RE = re.compile(
    r"(?:local\s+de\s+entrega|endere[çc]o(?:\s+de\s+entrega)?)\s*:?\s*([^\n\r]+)",
    re.IGNORECASE,
)

CNO_TEXT_RE = re.compile(r"\bcno\s*:?\s*([\d.\-/]+)", re.IGNORECASE)

DATA_ENTREGA_RE = re.compile(
    r"data\s+d[ae]\s+entrega\s*:?\s*(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})",
    re.IGNORECASE,
)

QTD_LIMP_RE = re.compile(
    r"(?:qtde?|quantidade)\s+de\s+limpezas?\s*:?\s*([^\n\r]+)",
    re.IGNORECASE,
)
# fallback ex: "Limpezas: duas limpezas por semana."
LIMP_ALT_RE = re.compile(r"limpezas?\s*:\s*([^\n\r]+)", re.IGNORECASE)

# Rótulos que NUNCA são a descrição do objeto (para achar a 1ª linha real)
LABEL_LINE_RE = re.compile(
    r"^\s*(?:e-?mail|email|valor\b|quantidade|qtde|n[úu]mero\s+do\s+sanit|"
    r"cor\s+do\s+sanit|respons[áa]vel|solicitad|data\s+d[ae]\s+entrega|"
    r"local\s+de\s+entrega|endere[çc]o|condi[çc][õo]es?\s+de\s+pagamento|"
    r"cno\b|sanit[áa]rio\s+entregue|limpezas?|frete)\b[:\-\s]",
    re.IGNORECASE,
)


def clean(v):
    if v is None:
        return None
    s = str(v).strip()
    if not s or s.lower() == "nan":
        return None
    return s


def normalize_document(v):
    if not v:
        return None
    return re.sub(r"\D", "", str(v)) or None


def parse_observacoes(text):
    """Retorna dict de campos estruturados. Nunca falha; campos ausentes = None."""
    out = {
        "endereco": None,
        "descricao": None,
        "cno_texto": None,
        "responsavel_nome": None,
        "responsavel_telefone": None,
        "responsavel_email": None,
        "quantidade_limpezas": None,
        "data_entrega": None,  # YYYY-MM-DD
    }
    if not text:
        return out
    t = str(text)

    # endereço
    m = ENDERECO_RE.search(t)
    if m:
        out["endereco"] = m.group(1).strip().rstrip(".;,")

    # cno
    m = CNO_TEXT_RE.search(t)
    if m:
        out["cno_texto"] = m.group(1).strip()

    # responsável (nome + telefone juntos)
    m = RESP_LINE_RE.search(t)
    if m:
        out["responsavel_nome"] = re.sub(r"\s+", " ", m.group(1)).strip(" :-,.")
        tel = re.sub(r"\s+", " ", m.group(2)).strip(" :-.")
        out["responsavel_telefone"] = tel
    else:
        m = RESP_NAME_ONLY_RE.search(t)
        if m:
            nome = re.sub(r"\s+", " ", m.group(1)).strip(" :-,.")
            # descarta valores tipo "pela Rota" (Responsável pela Rota: X)
            if nome.lower() not in {"pela rota", "pelo:", "pelo"}:
                out["responsavel_nome"] = nome
        # tenta pegar 1º telefone solto
        m2 = PHONE_RE.search(t)
        if m2 and not out["responsavel_telefone"]:
            out["responsavel_telefone"] = m2.group(0).strip()

    # e-mail (primeiro que aparece)
    m = EMAIL_RE.search(t)
    if m:
        out["responsavel_email"] = m.group(0).strip().rstrip(".,;")

    # data de entrega
    m = DATA_ENTREGA_RE.search(t)
    if m:
        d, mo, y = m.group(1), m.group(2), m.group(3)
        if len(y) == 2:
            y = "20" + y
        try:
            out["data_entrega"] = f"{int(y):04d}-{int(mo):02d}-{int(d):02d}"
        except ValueError:
            pass

    # quantidade de limpezas
    m = QTD_LIMP_RE.search(t)
    if m:
        out["quantidade_limpezas"] = m.group(1).strip().rstrip(".;,")
    else:
        m = LIMP_ALT_RE.search(t)
        if m:
            out["quantidade_limpezas"] = m.group(1).strip().rstrip(".;,")

    # descrição = primeira linha "real" (sem rótulo estruturado, sem e-mail/telefone puro)
    for raw in t.splitlines():
        line = raw.strip(" -•\t")
        if not line or len(line) < 8:
            continue
        if LABEL_LINE_RE.match(line):
            continue
        # ignora linhas que são só um e-mail ou telefone
        if EMAIL_RE.fullmatch(line) or PHONE_RE.fullmatch(line):
            continue
        # ignora linhas que começam com e-mail (continuação de "E-mail:")
        if EMAIL_RE.match(line):
            continue
        out["descricao"] = line
        break

    # limpa prefixos ruins no nome do responsável ("pela R", "e Guilherme", "escritório X", "da obra Engenheiro Thiago" → "Thiago")
    if out["responsavel_nome"]:
        n = out["responsavel_nome"]
        n = re.sub(r"^(?:e\s+|pel[oa]\s+\w*\s*|escrit[óo]rio\s+|da\s+obra\s+|do\s+escrit[óo]rio\s+|engenheir[oa]\s+|sr\.?\s+|sra\.?\s+)+", "", n, flags=re.IGNORECASE).strip()
        # se sobrou algo muito curto ou vazio, mantém o original
        out["responsavel_nome"] = n if len(n) >= 2 else out["responsavel_nome"]

    return out



def situacao_ok(s):
    s = (s or "").strip().lower()
    return s or "ativo"


def convert(xlsx_name, json_name):
    src = HERE / xlsx_name
    if not src.exists():
        print(f"[skip] {src} não existe")
        return
    df = pd.read_excel(src, header=2)
    df = df[df["N° do Contrato"].notna()]  # remove rodapés/vazios

    rows = []
    stats = {"total": 0, "endereco": 0, "resp_nome": 0, "resp_tel": 0,
             "resp_email": 0, "cno": 0, "data_entrega": 0, "descricao": 0,
             "quantidade_limpezas": 0}


    for _, r in df.iterrows():
        obs_raw = clean(r.get("Observações"))
        parsed = parse_observacoes(obs_raw)

        cno_col = clean(r.get("Código da Obra"))
        cno = cno_col or parsed["cno_texto"]

        row = {
            "numero":             clean(r.get("N° do Contrato")),
            "situacao":           situacao_ok(clean(r.get("Situação"))),
            "razao_social":       clean(r.get("Cliente (Razão Social)")) or clean(r.get("Cliente (Nome Fantasia)")),
            "nome_fantasia":      clean(r.get("Cliente (Nome Fantasia)")),
            "documento":          normalize_document(r.get("Cliente (CPF/CNPJ)")),
            "email":              clean(r.get("E-mail")) or parsed["responsavel_email"],
            "telefone":           clean(r.get("Telefone")),
            "contato_col":        clean(r.get("Contato")),
            "dia_faturamento":    clean(r.get("Dia de Faturamento")),
            "vigencia_inicial":   str(r.get("Vigência Inicial")) if pd.notna(r.get("Vigência Inicial")) else None,
            "valor_total":        clean(r.get("Valor Total dos Serviços")),
            "observacoes":        obs_raw,
            # --- novos campos extraídos ---
            "endereco":           parsed["endereco"],
            "descricao":          parsed["descricao"],
            "cno":                cno,
            "responsavel_nome":   parsed["responsavel_nome"] or clean(r.get("Contato")),
            "responsavel_telefone": parsed["responsavel_telefone"] or clean(r.get("Telefone")),
            "responsavel_email":  parsed["responsavel_email"] or clean(r.get("E-mail")),
            "quantidade_limpezas": parsed["quantidade_limpezas"],
            "data_entrega":       parsed["data_entrega"],
        }
        rows.append(row)

        stats["total"] += 1
        for k in ("endereco","descricao","cno","data_entrega","quantidade_limpezas"):
            if row[k]: stats[k] += 1

        if row["responsavel_nome"]:     stats["resp_nome"]  += 1
        if row["responsavel_telefone"]: stats["resp_tel"]   += 1
        if row["responsavel_email"]:    stats["resp_email"] += 1

    out = HERE / json_name
    out.write_text(json.dumps(rows, indent=1, ensure_ascii=False, default=str))
    print(f"\n[{xlsx_name} -> {json_name}]  {stats['total']} contratos")
    for k, v in stats.items():
        if k == "total": continue
        pct = (v * 100 / stats["total"]) if stats["total"] else 0
        print(f"   {k:20s} {v:4d}  ({pct:5.1f}%)")


if __name__ == "__main__":
    for x, j in SOURCES:
        convert(x, j)
    print("\nOK — JSONs enriquecidos gravados em backend/scripts/legacy-data/")
