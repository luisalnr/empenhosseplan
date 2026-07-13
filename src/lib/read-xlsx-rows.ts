/**
 * Lê um .xlsx no browser e devolve sempre uma matriz 2D de células.
 *
 * read-excel-file v9+ pode retornar:
 *   - unknown[][]                         (formato clássico)
 *   - { sheet: string; data: unknown[][] }[]  (multi-sheet — formato atual)
 *
 * Sem normalização, código que faz row.some / row.map quebra com
 * "t.some is not a function".
 */
export async function readXlsxRows(file: Blob): Promise<unknown[][]> {
  const readXlsxFile = (await import("read-excel-file/browser")).default;
  const result: unknown = await readXlsxFile(file);
  return normalizeSheetRows(result);
}

export function normalizeSheetRows(result: unknown): unknown[][] {
  if (!Array.isArray(result) || result.length === 0) return [];

  const first = result[0];

  // Formato multi-sheet: [{ sheet, data }, ...]
  if (
    first &&
    typeof first === "object" &&
    !Array.isArray(first) &&
    Array.isArray((first as { data?: unknown }).data)
  ) {
    const sheets = result as { sheet?: string; data: unknown[][] }[];
    const preferred =
      sheets.find((s) =>
        /sheet0|planilha|dados|empenh|liq|pag|ww/i.test(String(s.sheet || ""))
      ) || sheets[0];
    return ensure2d(preferred?.data);
  }

  // Formato clássico: matriz 2D
  if (Array.isArray(first) || first == null) {
    return ensure2d(result as unknown[]);
  }

  return [];
}

function ensure2d(rows: unknown[] | undefined | null): unknown[][] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => (Array.isArray(row) ? row : []));
}
