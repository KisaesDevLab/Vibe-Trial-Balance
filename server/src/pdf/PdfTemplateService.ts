/* eslint-disable @typescript-eslint/no-var-requires */
import { Knex } from 'knex';
import type { TDocumentDefinitions, Content, TableCell, Style } from 'pdfmake/interfaces';

// Server-side pdfmake uses the PdfPrinter class from src/printer.js
// vfs_fonts.js exports the font dict directly: { 'Roboto-Regular.ttf': '<base64>', ... }
// We decode each font to a Buffer and pass them to PdfPrinter — no filesystem reads needed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PdfPrinter = require('pdfmake/src/printer') as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const vfsData: Record<string, string> = require('pdfmake/build/vfs_fonts') as any;

const FONTS = {
  Roboto: {
    normal:      Buffer.from(vfsData['Roboto-Regular.ttf'],       'base64'),
    bold:        Buffer.from(vfsData['Roboto-Medium.ttf'],        'base64'),
    italics:     Buffer.from(vfsData['Roboto-Italic.ttf'],        'base64'),
    bolditalics: Buffer.from(vfsData['Roboto-MediumItalic.ttf'],  'base64'),
  },
};

// Colours / sizes used throughout
const COLORS = {
  headerBg:    '#1e3a5f',
  headerText:  '#ffffff',
  subtotalBg:  '#e8edf3',
  altRowBg:    '#f5f7fa',
  negativeText:'#c0392b',
  borderDark:  '#1e3a5f',
  borderLight: '#cccccc',
  sectionHeader:'#2c3e50',
};

const FONT_SIZE = {
  title:    14,
  subtitle: 10,
  body:      8,
  footer:    7,
};

export interface DocOptions {
  title: string;
  clientName: string;
  ein?: string;
  periodName: string;
  startDate?: string;
  endDate?: string;
  preparer?: string;
  content: Content[];
  pageOrientation?: 'portrait' | 'landscape';
}

export class PdfTemplateService {
  private printer: typeof PdfPrinter;
  firmName: string;
  firmAddress: string;

  constructor(firmName = '', firmAddress = '') {
    this.firmName    = firmName;
    this.firmAddress = firmAddress;
    this.printer = new PdfPrinter(FONTS);
  }

  static async fromDb(db: Knex): Promise<PdfTemplateService> {
    try {
      const rows = await db('settings').whereIn('key', ['firm_name', 'firm_address']).select('key', 'value');
      const map: Record<string, string> = {};
      for (const r of rows) map[r.key as string] = r.value as string;
      return new PdfTemplateService(map['firm_name'] ?? '', map['firm_address'] ?? '');
    } catch {
      return new PdfTemplateService();
    }
  }

  // ─────────────────────────────────────────────────
  // Money helpers
  // ─────────────────────────────────────────────────

  /** Format cents as $ amount string: (1,234.56) for negative, — for zero */
  formatCents(cents: number | null | undefined): string {
    if (cents === null || cents === undefined || cents === 0) return '—';
    const abs = Math.abs(cents);
    const dollars = (abs / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return cents < 0 ? `(${dollars})` : dollars;
  }

  private isNegative(cents: number | null | undefined): boolean {
    return typeof cents === 'number' && cents < 0;
  }

  // ─────────────────────────────────────────────────
  // Cell / row helpers
  // ─────────────────────────────────────────────────

  /** Bold header row cells with dark background */
  headerRow(columns: string[]): TableCell[] {
    return columns.map((text) => ({
      text,
      style: 'tableHeader',
      fillColor: COLORS.headerBg,
      color: COLORS.headerText,
      bold: true,
      fontSize: FONT_SIZE.body,
      margin: [3, 4, 3, 4] as [number, number, number, number],
    }));
  }

  /** Data row — cells can be string | number | null; numbers are formatted as money */
  dataRow(
    cells: (string | number | null | undefined)[],
    opts: { bold?: boolean; shade?: boolean; isAlt?: boolean } = {},
  ): TableCell[] {
    const fill = opts.shade
      ? COLORS.subtotalBg
      : opts.isAlt
      ? COLORS.altRowBg
      : undefined;

    return cells.map((cell) => {
      const isNum  = typeof cell === 'number';
      const text   = isNum ? this.formatCents(cell as number) : (cell ?? '');
      const isNeg  = isNum && this.isNegative(cell as number);
      return {
        text: String(text),
        fontSize: FONT_SIZE.body,
        bold:  opts.bold ?? false,
        color: isNeg ? COLORS.negativeText : undefined,
        alignment: isNum ? 'right' : 'left',
        fillColor: fill,
        margin: [3, 3, 3, 3] as [number, number, number, number],
        border: [false, false, false, false] as [boolean, boolean, boolean, boolean],
      } as TableCell;
    });
  }

  /** Single-underline subtotal row spanning colSpan-1 columns then the amount */
  subtotalRow(label: string, amount: number, totalCols: number): TableCell[] {
    const cells: TableCell[] = [];
    // label spans all but last column
    cells.push({
      text: label,
      colSpan: totalCols - 1,
      bold: true,
      fontSize: FONT_SIZE.body,
      fillColor: COLORS.subtotalBg,
      margin: [3, 3, 3, 3] as [number, number, number, number],
      border: [false, false, false, true] as [boolean, boolean, boolean, boolean],
      borderColor: ['', '', '', COLORS.borderDark] as [string, string, string, string],
    } as TableCell);
    for (let i = 1; i < totalCols - 1; i++) cells.push({ text: '' } as TableCell);
    cells.push({
      text: this.formatCents(amount),
      alignment: 'right',
      bold: true,
      fontSize: FONT_SIZE.body,
      color: this.isNegative(amount) ? COLORS.negativeText : undefined,
      fillColor: COLORS.subtotalBg,
      margin: [3, 3, 3, 3] as [number, number, number, number],
      border: [false, false, false, true] as [boolean, boolean, boolean, boolean],
      borderColor: ['', '', '', COLORS.borderDark] as [string, string, string, string],
    } as TableCell);
    return cells;
  }

  /** Double-underline grand total row */
  grandTotalRow(label: string, amount: number, totalCols: number): TableCell[] {
    const cells = this.subtotalRow(label, amount, totalCols);
    // Override border on first and last to double (simulate with thick)
    (cells[0] as Record<string, unknown>).border             = [false, true, false, true];
    (cells[0] as Record<string, unknown>).borderColor        = ['', COLORS.borderDark, '', COLORS.borderDark];
    (cells[totalCols - 1] as Record<string, unknown>).border = [false, true, false, true];
    (cells[totalCols - 1] as Record<string, unknown>).borderColor = ['', COLORS.borderDark, '', COLORS.borderDark];
    (cells[totalCols - 1] as Record<string, unknown>).fillColor   = COLORS.subtotalBg;
    return cells;
  }

  /** Section header row (category label) */
  sectionHeaderRow(label: string, totalCols: number): TableCell[] {
    const cells: TableCell[] = [{
      text: label.toUpperCase(),
      colSpan: totalCols,
      bold: true,
      fontSize: FONT_SIZE.body,
      color: COLORS.sectionHeader,
      fillColor: COLORS.subtotalBg,
      margin: [3, 5, 3, 5] as [number, number, number, number],
      border: [false, false, false, false] as [boolean, boolean, boolean, boolean],
    } as TableCell];
    for (let i = 1; i < totalCols; i++) cells.push({ text: '' } as TableCell);
    return cells;
  }

  // ─────────────────────────────────────────────────
  // Document definition builder
  // ─────────────────────────────────────────────────

  buildDocument(opts: DocOptions): TDocumentDefinitions {
    const {
      title, clientName, ein, periodName, startDate, endDate, preparer, content,
      pageOrientation = 'landscape',
    } = opts;

    const dateRange = startDate && endDate
      ? `${startDate} – ${endDate}`
      : startDate || endDate || periodName;

    const companyLines: Content[] = [
      { text: clientName, fontSize: FONT_SIZE.title, bold: true, color: COLORS.headerBg },
      ...(ein ? [{ text: `EIN: ${ein}`, fontSize: FONT_SIZE.footer, color: '#555555' } as Content] : []),
      ...(this.firmName ? [{ text: `Prepared by: ${this.firmName}`, fontSize: FONT_SIZE.footer, color: '#555555' } as Content] : []),
    ];

    const reportLines: Content[] = [
      { text: title, fontSize: FONT_SIZE.title, bold: true, alignment: 'right', color: COLORS.headerBg } as Content,
      { text: periodName, fontSize: FONT_SIZE.subtitle, bold: true, alignment: 'right' } as Content,
      { text: dateRange, fontSize: FONT_SIZE.footer, alignment: 'right' } as Content,
    ];

    const headerTable: Content = {
      table: {
        widths: ['*', '*'],
        body: [[
          { stack: companyLines, border: [false, false, false, false] },
          { stack: reportLines, border: [false, false, false, false] },
        ]],
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 8] as [number, number, number, number],
    };

    const divider: Content = {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: COLORS.borderDark }],
      margin: [0, 0, 0, 8] as [number, number, number, number],
    };

    return {
      pageSize: 'LETTER',
      pageOrientation,
      pageMargins: [36, 40, 36, 40],
      info: { title, author: this.firmName || 'PdfReports', subject: clientName },
      defaultStyle: { font: 'Roboto', fontSize: FONT_SIZE.body },
      styles: this.buildStyles(),
      header: (currentPage: number, pageCount: number) => ({
        text: `${title} — ${clientName} — ${periodName}   Page ${currentPage} of ${pageCount}`,
        alignment: 'right',
        fontSize: FONT_SIZE.footer,
        color: '#888888',
        margin: [36, 12, 36, 0],
      } as Content),
      footer: (_currentPage: number, _pageCount: number) => {
        const lines: Content[] = [
          { text: `Prepared: ${new Date().toLocaleDateString()}${preparer ? '   Preparer: ' + preparer : ''}`, alignment: 'left' },
          { text: 'CONFIDENTIAL — For Internal Use Only', alignment: 'right' },
        ];
        return {
          columns: lines,
          fontSize: FONT_SIZE.footer,
          color: '#888888',
          margin: [36, 8, 36, 0],
        } as Content;
      },
      content: [headerTable, divider, ...content],
    } as unknown as TDocumentDefinitions;
  }

  buildStyles(): Record<string, Style> {
    return {
      tableHeader: {
        bold: true,
        fontSize: FONT_SIZE.body,
        color: COLORS.headerText,
        fillColor: COLORS.headerBg,
      },
      sectionHeader: {
        bold: true,
        fontSize: FONT_SIZE.body,
        fillColor: COLORS.subtotalBg,
      },
      moneyCell: {
        font: 'Roboto',
        alignment: 'right',
      },
    };
  }

  // ─────────────────────────────────────────────────
  // Generate Buffer
  // ─────────────────────────────────────────────────

  generateBuffer(docDef: TDocumentDefinitions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const pdfDoc = this.printer.createPdfKitDocument(docDef);
        const chunks: Buffer[] = [];
        pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
        pdfDoc.on('error', (err: Error) => reject(err));
        pdfDoc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
