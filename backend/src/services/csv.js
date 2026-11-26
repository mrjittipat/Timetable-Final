import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import ExcelJS from 'exceljs';

export function stripBom(text) {
  return String(text || '').replace(/^\uFEFF/, '');
}

export function parseCsv(text) {
  const clean = stripBom(text);
  if (!clean.trim()) return [];
  return parse(clean, {
    columns: (headers) => headers.map((h) => stripBom(h).trim()),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
}

export function toCsv(rows, fields) {
  return stringify(rows, { header: true, columns: fields });
}

function cellText(v) {
  if (v == null) return '';
  if (v instanceof Date) {
    const h = v.getUTCHours();
    const m = String(v.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((r) => r.text || '').join('');
    if (v.text != null) return String(v.text);
    if (v.result != null) return cellText(v.result);
  }
  return String(v);
}

export async function parseXlsx(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const result = {};
  for (const ws of wb.worksheets) {
    let headers = null;
    const rows = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals = row.values.slice(1).map((c) => cellText(c).trim());
      if (vals.every((v) => !v)) return;
      if (!headers) {
        headers = vals.map((h) => stripBom(h).trim());
        return;
      }
      const obj = {};
      headers.forEach((h, i) => {
        if (h) obj[h] = vals[i] ?? '';
      });
      rows.push(obj);
    });
    result[ws.name] = rows;
  }
  return result;
}
