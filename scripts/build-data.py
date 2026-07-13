# -*- coding: utf-8 -*-
"""
Gera os JSONs de dados do dashboard SEPLAN/AC a partir das planilhas SICAF/WW:
  - public/data/seed-empenhos.json        (empenhos normalizados + enriquecidos com MTO)
  - public/data/mto/elemento-despesa.json
  - public/data/mto/fonte.json
  - public/data/mto/categoria-economica.json
  - public/data/mto/gnd.json
  - public/data/mto/modalidade-aplicacao.json
  - public/data/mto/classes-credor.json   (classes de credor do WW)

Parser tolerante: localiza a linha de cabecalho pelo texto "Credor" e "Valor".
"""
import zipfile
import xml.etree.ElementTree as ET
import re
import json
import os
import sys
from datetime import datetime, timedelta

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RNS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
EPOCH = datetime(1899, 12, 30)
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "public", "data")
MTO = os.path.join(DATA, "mto")


def load_workbook(path):
    z = zipfile.ZipFile(path)
    ss = ET.fromstring(z.read("xl/sharedStrings.xml"))
    strings = [
        "".join(t.text or "" for t in si.iter(NS + "t"))
        for si in ss.findall(NS + "si")
    ]
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    relmap = {r.attrib["Id"]: r.attrib["Target"] for r in rels}
    smap = {
        s.attrib["name"]: "xl/" + relmap[s.attrib[RNS + "id"]]
        for s in wb.find(NS + "sheets")
    }

    def col_of(ref):
        m = re.match(r"([A-Z]+)", ref)
        c = 0
        for ch in m.group(1):
            c = c * 26 + (ord(ch) - 64)
        return c - 1

    def parse(sheet_name):
        path2 = smap[sheet_name]
        sh = ET.fromstring(z.read(path2))
        rows = {}
        for c in sh.iter(NS + "c"):
            r = c.attrib["r"]
            col = col_of(r)
            row = int(re.search(r"\d+", r).group())
            t = c.attrib.get("t")
            v = c.find(NS + "v")
            val = ""
            if v is not None:
                val = strings[int(v.text)] if t == "s" else v.text
            rows.setdefault(row, {})[col] = val
        return rows

    return parse


def to_num(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return 0.0


def serial_to_iso(s):
    try:
        return (EPOCH + timedelta(days=float(s))).strftime("%Y-%m-%d")
    except (TypeError, ValueError):
        return ""


def build_ref_table(parse, sheet_name):
    rows = parse(sheet_name)
    out = []
    for r in sorted(rows):
        row = rows[r]
        codigo = (row.get(0, "") or "").strip()
        descricao = (row.get(1, "") or "").strip()
        if not codigo:
            continue
        low = codigo.lower()
        if low.startswith("c\u00f3d") or low == "codigo" or low == "classe":
            continue
        out.append({"codigo": codigo, "descricao": descricao})
    return out


def build_classes_table(parse, sheet_name):
    rows = parse(sheet_name)
    out = []
    for r in sorted(rows):
        row = rows[r]
        codigo = (row.get(0, "") or "").strip()
        nome = (row.get(1, "") or "").strip()
        ir = (row.get(3, "") or "").strip()
        if not codigo or codigo.lower() == "classe":
            continue
        out.append({"codigo": codigo, "descricao": nome, "impostoRenda": ir})
    return out


def main():
    os.makedirs(MTO, exist_ok=True)

    # --- Tabelas MTO (referencia estatica) ---
    tparse = load_workbook(os.path.join(ROOT, "TABELAS.xlsx"))
    ref_map = {
        "elemento-despesa": "ElementoDespesa",
        "fonte": "Fonte",
        "categoria-economica": "CategoriaEcon\u00f4mica",
        "gnd": "GrupoNaturezaDespesa",
        "modalidade-aplicacao": "ModalidadeAplica\u00e7\u00e3o",
    }
    refs = {}
    for fname, sheet in ref_map.items():
        data = build_ref_table(tparse, sheet)
        refs[fname] = {r["codigo"]: r["descricao"] for r in data}
        with open(os.path.join(MTO, fname + ".json"), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=None, separators=(",", ":"))
        print("  mto/%s.json -> %d itens" % (fname, len(data)))

    # --- Tabela de Classes de Credor ---
    cparse = load_workbook(os.path.join(ROOT, "ClassesWWExport-4425.xlsx"))
    classes_data = build_classes_table(cparse, "Sheet0")
    classes_map = {c["codigo"]: c["descricao"] for c in classes_data}
    with open(os.path.join(MTO, "classes-credor.json"), "w", encoding="utf-8") as f:
        json.dump(classes_data, f, ensure_ascii=False, indent=None, separators=(",", ":"))
    print("  mto/classes-credor.json -> %d itens" % len(classes_data))

    elmap = refs["elemento-despesa"]
    fmap = refs["fonte"]
    catmap = refs["categoria-economica"]
    gndmap = refs["gnd"]
    modmap = refs["modalidade-aplicacao"]

    def lookup(table, code):
        code = (code or "").strip()
        if not code:
            return {"codigo": "", "descricao": ""}
        desc = table.get(code) or table.get(code.zfill(2))
        return {"codigo": code, "descricao": desc or ""}

    def lookup_classe(raw):
        raw = (raw or "").strip()
        if not raw:
            return {"codigo": "", "descricao": ""}
        try:
            codigo = str(int(float(raw)))
        except (TypeError, ValueError):
            codigo = raw
        desc = classes_map.get(codigo, "")
        return {"codigo": codigo, "descricao": desc}

    # --- Empenhos ---
    empenho_file = sys.argv[1] if len(sys.argv) > 1 else "EmpenhoWWExport-5800.xlsx"
    eparse = load_workbook(os.path.join(ROOT, empenho_file))
    erows = eparse("Sheet0")
    header_row = None
    header = {}
    for r in sorted(erows):
        cells = [(v or "").lower() for v in erows[r].values()]
        if any("credor" in c for c in cells) and any("valor" in c for c in cells):
            header_row = r
            header = {v.strip().lower(): k for k, v in erows[r].items()}
            break
    if header_row is None:
        raise RuntimeError("Cabecalho nao encontrado")

    def h(*keys):
        for k in keys:
            # match exato primeiro (evita pegar "motivo da despesa" ao buscar "despesa")
            for hk, col in header.items():
                if hk == k:
                    return col
            # depois substring
            for hk, col in header.items():
                if k in hk:
                    return col
        return None

    c_num = h("n\u00ba", "n ", "numero", "empenho")
    c_data = h("data", "emiss")
    c_motivo = h("motivo")
    c_tipo = h("tipo")
    c_desc = h("descri")
    c_red = h("reduzido")
    c_desp = h("despesa")
    c_fonte = h("fonte")
    c_cred = h("credor")
    c_classe = h("classe")
    c_val = h("valor")
    c_anul = h("anul")
    c_compl = h("complemento")
    c_liq = h("liquidado", "liquid")
    c_pago = h("pago")
    c_aliq = h("liquidar", "a liquid")

    records = []
    for r in sorted(erows):
        if r <= header_row:
            continue
        row = erows[r]
        num = (row.get(c_num, "") or "").strip()
        if not num:
            continue
        desp = (row.get(c_desp, "") or "").strip()
        fonte_raw = (row.get(c_fonte, "") or "").strip()
        try:
            fonte_code = str(int(float(fonte_raw)))
        except (TypeError, ValueError):
            fonte_code = fonte_raw
        try:
            red_code = str(int(float(row.get(c_red, "") or 0)))
        except (TypeError, ValueError):
            red_code = (row.get(c_red, "") or "").strip()
        elemento_code = desp[4:6] if len(desp) >= 6 else desp
        cat_code = desp[0:1] if desp else ""
        gnd_code = desp[1:2] if desp else ""
        mod_code = desp[2:4] if len(desp) >= 4 else ""
        rec = {
            "numero": num,
            "dataEmissao": serial_to_iso(row.get(c_data, "")),
            "motivo": (row.get(c_motivo, "") or "").strip(),
            "tipo": (row.get(c_tipo, "") or "").strip(),
            "descricao": (row.get(c_desc, "") or "").strip(),
            "reduzido": red_code,
            "despesa": desp,
            "categoria": lookup(catmap, cat_code),
            "gnd": lookup(gndmap, gnd_code),
            "modalidade": lookup(modmap, mod_code),
            "elemento": lookup(elmap, elemento_code),
            "fonte": lookup(fmap, fonte_code),
            "credor": (row.get(c_cred, "") or "").strip(),
            "classe": lookup_classe(row.get(c_classe, "")),
            "valor": round(to_num(row.get(c_val)), 2),
            "anulado": round(to_num(row.get(c_anul)), 2),
            "complemento": round(to_num(row.get(c_compl)), 2),
            "liquidado": round(to_num(row.get(c_liq)), 2),
            "pago": round(to_num(row.get(c_pago)), 2),
            "aLiquidar": round(to_num(row.get(c_aliq)), 2),
        }
        records.append(rec)

    with open(os.path.join(DATA, "seed-empenhos.json"), "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, separators=(",", ":"))
    print("  seed-empenhos.json -> %d registros" % len(records))

    tot = {k: 0.0 for k in ("valor", "anulado", "complemento", "liquidado", "pago", "aLiquidar")}
    for r in records:
        for k in tot:
            tot[k] += r[k]
    print("  TOTAIS:", {k: round(v, 2) for k, v in tot.items()})

    # --- Liquidacoes ---
    build_fases(
        "LiquidacaoWWExport-4654.xlsx",
        os.path.join(DATA, "liquidacoes.json"),
        "liquidacoes.json",
        num_key="liquida",
        data_key="data",
        emp_key="empenho",
        status_key="status",
        valor_key="valor",
    )

    # --- Pagamentos ---
    build_fases(
        "PagamentoWWExport-7497.xlsx",
        os.path.join(DATA, "pagamentos.json"),
        "pagamentos.json",
        num_key="nº pagamento",
        data_key="pagamento",
        emp_key="nº empenho",
        status_key="situa",
        valor_key="valor",
    )


def build_fases(filename, out_path, label, num_key, data_key, emp_key, status_key, valor_key=None):
    """Parser generico para liquidacoes e pagamentos (layout WW)."""
    path = os.path.join(ROOT, filename)
    if not os.path.exists(path):
        print("  [SKIP] %s — arquivo nao encontrado" % label)
        return
    fparse = load_workbook(path)
    frows = fparse("Sheet0")
    header_row = None
    header = {}
    for r in sorted(frows):
        cells = [(v or "").lower() for v in frows[r].values()]
        if any("empenho" in c for c in cells):
            header_row = r
            header = {v.strip().lower(): k for k, v in frows[r].items()}
            break
    if header_row is None:
        print("  [SKIP] %s — cabecalho nao encontrado" % label)
        return

    def h(key):
        key = key.lower()
        for hk, col in header.items():
            if hk == key:
                return col
        for hk, col in header.items():
            if key in hk:
                return col
        return None

    c_num = h(num_key)
    c_data = h(data_key)
    c_emp = h(emp_key)
    c_status = h(status_key)
    c_valor = h(valor_key) if valor_key else None

    records = []
    for r in sorted(frows):
        if r <= header_row:
            continue
        row = frows[r]
        emp = (row.get(c_emp, "") or "").strip()
        if not emp:
            continue
        rec = {
            "numero": (row.get(c_num, "") or "").strip(),
            "data": serial_to_iso(row.get(c_data, "")),
            "numeroEmpenho": emp,
            "status": (row.get(c_status, "") or "").strip(),
        }
        if c_valor is not None:
            rec["valor"] = round(to_num(row.get(c_valor)), 2)
        records.append(rec)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, separators=(",", ":"))
    print("  %s -> %d registros" % (label, len(records)))


if __name__ == "__main__":
    main()
