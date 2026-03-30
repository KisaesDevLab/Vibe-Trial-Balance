import XLSX from 'xlsx-js-style';

export interface XlsxCellComment {
  /** 0-based data row (0 = first data row, not the header) */
  row: number;
  /** 0-based column index */
  col: number;
  text: string;
}

export interface XlsxColMeta {
  /** Character width for column (default 14) */
  width?: number;
  /** If true, apply right-alignment and number format */
  numeric?: boolean;
}

// ─── Shared style tokens ─────────────────────────────────────────────────────

const HEADER_BG  = '1E3A5F';   // dark navy
const HEADER_FG  = 'FFFFFF';
const STRIPE_BG  = 'EEF2F7';   // light blue-gray
const BORDER_CLR = 'D1D5DB';   // gray-300

const thin = (color = BORDER_CLR) => ({ style: 'thin', color: { rgb: color } });

const border = {
  top:    thin(),
  bottom: thin(),
  left:   thin(),
  right:  thin(),
};

function headerStyle(): object {
  return {
    font:      { bold: true, color: { rgb: HEADER_FG }, sz: 10 },
    fill:      { fgColor: { rgb: HEADER_BG }, patternType: 'solid' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
    border,
  };
}

function dataStyle(rowIndex: number, numeric: boolean): object {
  const even = rowIndex % 2 === 0;
  return {
    font:  { sz: 10 },
    fill:  even
      ? { fgColor: { rgb: 'FFFFFF' }, patternType: 'solid' }
      : { fgColor: { rgb: STRIPE_BG }, patternType: 'solid' },
    alignment: { horizontal: numeric ? 'right' : 'left', vertical: 'center' },
    ...(numeric ? { numFmt: '#,##0.00;(#,##0.00)' } : {}),
    border,
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Downloads a 2-D string[][] as a formatted Excel .xlsx file.
 * Row 0 is treated as the header. Numeric-looking strings become numbers.
 */
export function downloadXlsx(
  filename: string,
  rows: string[][],
  comments?: XlsxCellComment[],
  colMeta?: XlsxColMeta[],
): void {
  if (!rows.length) return;

  const colCount = rows[0].length;

  // Build cell data with styles
  const styledData = rows.map((row, rowIdx) =>
    row.map((cell, colIdx) => {
      const isHeader = rowIdx === 0;
      const isNumeric = colMeta?.[colIdx]?.numeric ?? false;
      const n = Number(cell);
      const value = !isHeader && cell !== '' && !isNaN(n) ? n : cell;

      return {
        v: value,
        t: typeof value === 'number' ? 'n' : 's',
        s: isHeader ? headerStyle() : dataStyle(rowIdx - 1, isNumeric && typeof value === 'number'),
      };
    }),
  );

  const ws = XLSX.utils.aoa_to_sheet(styledData);

  // Column widths
  ws['!cols'] = Array.from({ length: colCount }, (_, i) => ({
    wch: colMeta?.[i]?.width ?? 14,
  }));

  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };

  // Cell comments (hidden by default)
  if (comments) {
    for (const { row, col, text } of comments) {
      const ref = XLSX.utils.encode_cell({ r: row + 1, c: col });
      if (!ws[ref]) ws[ref] = { t: 's', v: '' };
      ws[ref].c = [{ a: 'Note', t: text }];
      ws[ref].c.hidden = true;
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Trial Balance');

  const xlsxFilename = filename.endsWith('.xlsx') ? filename : filename.replace(/\.csv$/, '.xlsx');
  XLSX.writeFile(wb, xlsxFilename);
}

/**
 * Downloads a multi-sheet Excel workbook. Each sheet has its own header + data rows.
 */
export function downloadXlsxMultiSheet(
  filename: string,
  sheets: Array<{ name: string; rows: string[][] }>,
): void {
  if (!sheets.length) return;

  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    if (!sheet.rows.length) continue;
    const colCount = sheet.rows[0].length;

    const styledData = sheet.rows.map((row, rowIdx) =>
      row.map((cell) => {
        const isHeader = rowIdx === 0;
        const n = Number(cell);
        const value = !isHeader && cell !== '' && !isNaN(n) ? n : cell;
        return {
          v: value,
          t: typeof value === 'number' ? 'n' as const : 's' as const,
          s: isHeader ? headerStyle() : dataStyle(rowIdx - 1, typeof value === 'number'),
        };
      }),
    );

    const ws = XLSX.utils.aoa_to_sheet(styledData);
    ws['!cols'] = Array.from({ length: colCount }, () => ({ wch: 16 }));
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };

    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }

  const xlsxFilename = filename.endsWith('.xlsx') ? filename : filename.replace(/\.csv$/, '.xlsx');
  XLSX.writeFile(wb, xlsxFilename);
}
