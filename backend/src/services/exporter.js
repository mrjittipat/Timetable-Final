import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { ASSET_DIR, FONT_DIR } from './paths.js';
import { OUTPUT_FIELDS } from './schema.js';
import { toCsv } from './csv.js';
import { buildGrid, entitiesFor, subjectSummary, VIEWS } from './grid.js';
import { DEFAULT_CONFIG } from './config.js';

const segmenter = new Intl.Segmenter('th', { granularity: 'grapheme' });

function clipText(doc, text, maxWidth) {
  const str = String(text || '');
  if (!str) return '';
  if (doc.widthOfString(str) <= maxWidth) return str;
  const clusters = [...segmenter.segment(str)].map((s) => s.segment);
  let lo = 0;
  let hi = clusters.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const cand = clusters.slice(0, mid).join('') + '…';
    if (doc.widthOfString(cand) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return clusters.slice(0, lo).join('') + '…';
}

function docInfo(ctx) {
  return { ...DEFAULT_CONFIG.document, ...(ctx.config?.document || {}) };
}

function pdfConfig(ctx) {
  return { ...DEFAULT_CONFIG.appearance.pdf, ...(ctx.config?.appearance?.pdf || {}) };
}

function resolveEntities(ctx, view = 'group', id = null) {
  const views = view === 'all' ? VIEWS : [view];
  const out = [];
  for (const v of views) {
    const list = entitiesFor(v, ctx);
    for (const e of list) {
      if (id && e.id !== id) continue;
      out.push({ view: v, entity: e });
    }
  }
  return out;
}

function totalPeriodsLabel(grid) {
  let special = 0;
  for (const daySpans of grid.cells || []) {
    for (const sp of daySpans || []) {
      if (sp.subject_id === 'ADVISOR' || sp.subject_id === 'ACTIVITY') special += sp.span || 1;
    }
  }
  const academic = Math.max(0, (grid.total || 0) - special);
  if (special > 0) return `รวม ${academic} คาบวิชา (+${special} ที่ปรึกษา/กิจกรรม)`;
  return `รวม ${grid.total || 0} คาบ/สัปดาห์`;
}

function cellLines(view, span) {
  const code = span.display_code || span.subject_id;
  let who = '';
  if (view === 'teacher') who = (span.group_labels || span.groups || []).join('+');
  else if (view === 'group') who = span.teacher || '';
  else who = `${(span.group_labels || span.groups || []).join('+')} ${span.teacher || ''}`.trim();
  const room = view === 'room' ? '' : (span.room_name || span.room || '');
  return [code, who, room].filter(Boolean);
}

export function exportCsv(rows) {
  return toCsv(rows || [], OUTPUT_FIELDS);
}

function loadLogoBuffer(pdfCfg) {
  if (pdfCfg.showLogo === false) return null;
  if (pdfCfg.logoDataUrl && /^data:image\/(png|jpeg);base64,/.test(pdfCfg.logoDataUrl)) {
    return Buffer.from(pdfCfg.logoDataUrl.split(',')[1], 'base64');
  }
  const fp = path.join(ASSET_DIR, 'logo.png');
  if (fs.existsSync(fp)) return fs.readFileSync(fp);
  return null;
}

export async function exportPdf(rows, ctx, { view = 'group', id = null } = {}) {
  const info = docInfo(ctx);
  const pCfg = pdfConfig(ctx);
  const semText = `${info.semester}/${info.year}`;
  const targets = resolveEntities(ctx, view, id);
  const logoBuf = loadLogoBuffer(pCfg);

  const regularFont = path.join(FONT_DIR, 'Sarabun-Regular.ttf');
  const boldFont = path.join(FONT_DIR, 'Sarabun-Bold.ttf');

  const margin = pCfg.margin === 'narrow' ? 16 : pCfg.margin === 'wide' ? 32 : 24;
  const scale = pCfg.fontScale === 'compact' ? 0.9 : pCfg.fontScale === 'large' ? 1.1 : 1;

  const isColor = pCfg.colorMode === 'theme' || pCfg.colorMode === 'custom';
  const borderColor = isColor ? (pCfg.borderColor || '#22161a') : '#000000';
  const headerFill = isColor ? (pCfg.headerBg || '#800020') : null;
  const headerTxt = isColor ? (pCfg.headerText || '#ffffff') : '#000000';
  const dayFill = isColor ? (pCfg.dayBg || '#fcf4f5') : null;
  const breakFill = isColor ? (pCfg.breakBg || '#f3ecee') : '#f2f2f2';

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin, autoFirstPage: false });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  if (fs.existsSync(regularFont)) doc.registerFont('th', regularFont);
  if (fs.existsSync(boldFont)) doc.registerFont('th-bold', boldFont);
  const fReg = fs.existsSync(regularFont) ? 'th' : 'Helvetica';
  const fBold = fs.existsSync(boldFont) ? 'th-bold' : 'Helvetica-Bold';

  if (targets.length === 0) {
    doc.addPage();
    doc.font(fBold).fontSize(16).text('ไม่พบข้อมูลตาราง', margin, margin + 40, { align: 'center' });
    doc.end();
    return await new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  }

  for (const { view: v, entity } of targets) {
    doc.addPage({ size: 'A4', layout: 'landscape', margin });
    doc.page.margins.bottom = 0;

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const W = pageW - margin * 2;
    const x0 = margin;
    const y0 = margin;

    const grid = buildGrid(v, entity.id, rows, ctx);
    const summary = subjectSummary(v, entity.id, rows, ctx);
    const subList = summary.list;

    const per = Math.max(8, Math.ceil(subList.length / 2));
    const rowH = Math.min(15, 150 / per);
    const topH = 18 + per * rowH + 16;
    const leftW = 240;

    doc.lineWidth(0.7).strokeColor(borderColor).fillColor('#000000');

    // Watermark if set
    if (pCfg.watermark) {
      doc.save();
      doc.fillColor('#000000').fillOpacity(0.06).font(fBold).fontSize(54);
      doc.rotate(-25, { origin: [pageW / 2, pageH / 2] });
      doc.text(pCfg.watermark, pageW / 2 - 260, pageH / 2 - 30, { width: 520, align: 'center' });
      doc.restore();
      doc.fillColor('#000000').fillOpacity(1);
    }

    // Left Header Box
    doc.rect(x0, y0, leftW, topH).stroke();
    const infoLines = [['ภาคเรียน', semText], ...entity.info];
    let curY = y0 + 6;
    if (logoBuf) {
      const ls = pCfg.logoSize === 'sm' ? 32 : pCfg.logoSize === 'lg' ? 48 : 40;
      doc.image(logoBuf, x0 + (leftW - ls) / 2, curY, { width: ls, height: ls });
      curY += ls + 4;
      doc.font(fBold).fontSize(11 * scale);
      doc.text(clipText(doc, info.college, leftW - 14), x0 + 7, curY, { width: leftW - 14, align: 'center', lineBreak: false });
      curY += 15;
      doc.font(fBold).fontSize(11 * scale);
      doc.text(entity.heading, x0 + 7, curY, { width: leftW - 14, align: 'center', lineBreak: false });
      curY += 18;
      for (const [lbl, val] of infoLines) {
        doc.font(fBold).fontSize(9.5 * scale).text(lbl, x0 + 10, curY, { width: 64, lineBreak: false });
        doc.font(fReg).fontSize(9.5 * scale).text(String(val || '-'), x0 + 76, curY, { width: leftW - 84, lineGap: -2, height: 26 });
        curY += 17;
      }
    } else {
      curY += 8;
      doc.font(fBold).fontSize(12 * scale);
      doc.text(clipText(doc, info.college, leftW - 14), x0 + 7, curY, { width: leftW - 14, align: 'center', lineBreak: false });
      curY += 18;
      doc.font(fBold).fontSize(11.5 * scale);
      doc.text(entity.heading, x0 + 7, curY, { width: leftW - 14, align: 'center', lineBreak: false });
      curY += 22;
      for (const [lbl, val] of infoLines) {
        doc.font(fBold).fontSize(10 * scale).text(lbl, x0 + 10, curY, { width: 64, lineBreak: false });
        doc.font(fReg).fontSize(10 * scale).text(String(val || '-'), x0 + 76, curY, { width: leftW - 84, lineGap: -2, height: 28 });
        curY += 19;
      }
    }

    // Right Subject Table (2 halves)
    if (pCfg.showSubjectTable !== false) {
      const halfW = (W - leftW) / 2;
      const codeW = 58;
      const numW = 18;
      const nameW = halfW - codeW - numW * 4;

      for (let h = 0; h < 2; h++) {
        const hx = x0 + leftW + h * halfW;
        // Header row
        if (headerFill) {
          doc.rect(hx, y0, halfW, 18).fillAndStroke(headerFill, borderColor);
        } else {
          doc.rect(hx, y0, halfW, 18).stroke();
        }
        doc.fillColor(headerTxt).font(fBold).fontSize(8 * scale);
        const cols = [
          [hx, codeW, 'รหัสวิชา'],
          [hx + codeW, nameW, 'ชื่อรายวิชา'],
          [hx + codeW + nameW, numW, 'น.'],
          [hx + codeW + nameW + numW, numW, 'บ.'],
          [hx + codeW + nameW + numW * 2, numW, 'ป.'],
          [hx + codeW + nameW + numW * 3, numW, 'ศ.'],
        ];
        for (const [cx, cw, lbl] of cols) {
          doc.rect(cx, y0, cw, 18).stroke();
          doc.text(lbl, cx + 1, y0 + 4, { width: cw - 2, align: 'center', lineBreak: false });
        }
        doc.fillColor('#000000');

        // Rows
        for (let r = 0; r < per; r++) {
          const ry = y0 + 18 + r * rowH;
          const item = subList[h * per + r];
          const vals = item
            ? [item.subject_id, item.name, String(item.n), String(item.t), String(item.p), String(item.s)]
            : ['', '', '', '', '', ''];
          doc.font(fReg).fontSize(7.5 * scale);
          cols.forEach(([cx, cw], ci) => {
            doc.rect(cx, ry, cw, rowH).stroke();
            if (vals[ci]) {
              const txt = clipText(doc, vals[ci], cw - 5);
              doc.text(txt, cx + (ci === 1 ? 3 : 1), ry + (rowH - 9) / 2, {
                width: cw - (ci === 1 ? 5 : 2),
                align: ci === 1 ? 'left' : 'center',
                lineBreak: false,
              });
            }
          });
        }

        // Total row
        const ty = y0 + 18 + per * rowH;
        doc.font(fBold).fontSize(8 * scale);
        if (h === 0) {
          doc.rect(hx, ty, codeW + nameW, 16).stroke();
          doc.text('รวม', hx, ty + 3, { width: codeW + nameW - 4, align: 'right', lineBreak: false });
          const sums = [summary.total.n, summary.total.t, summary.total.p, summary.total.s];
          sums.forEach((sv, si) => {
            const cx = hx + codeW + nameW + numW * si;
            doc.rect(cx, ty, numW, 16).stroke();
            doc.text(String(sv), cx, ty + 3, { width: numW, align: 'center', lineBreak: false });
          });
        } else {
          doc.rect(hx, ty, halfW, 16).stroke();
          doc.text(totalPeriodsLabel(grid), hx, ty + 3, { width: halfW, align: 'center', lineBreak: false });
        }
      }
    }

    // Day Grid
    const gridTop = y0 + topH + 8;
    const dayColW = 58;
    const periodW = (W - dayColW) / Math.max(1, grid.periods.length);
    const hdrH = 16;

    // Row 1: time, Row 2: period number
    if (headerFill) {
      doc.rect(x0, gridTop, W, hdrH * 2).fillAndStroke(headerFill, borderColor);
    }
    doc.fillColor(headerTxt);
    doc.rect(x0, gridTop, dayColW, hdrH).stroke();
    doc.font(fBold).fontSize(8 * scale).text('เวลา', x0, gridTop + 3, { width: dayColW, align: 'center', lineBreak: false });
    doc.rect(x0, gridTop + hdrH, dayColW, hdrH).stroke();
    doc.font(fBold).fontSize(8.5 * scale).text('วัน/คาบ', x0, gridTop + hdrH + 3, { width: dayColW, align: 'center', lineBreak: false });

    grid.periods.forEach((pm, pi) => {
      const px = x0 + dayColW + pi * periodW;
      doc.rect(px, gridTop, periodW, hdrH).stroke();
      doc.font(fReg).fontSize(7.2 * scale).text(`${pm.start}-${pm.end}`, px + 1, gridTop + 4, { width: periodW - 2, align: 'center', lineBreak: false });
      doc.rect(px, gridTop + hdrH, periodW, hdrH).stroke();
      doc.font(fBold).fontSize(9 * scale).text(String(pm.period), px + 1, gridTop + hdrH + 3, { width: periodW - 2, align: 'center', lineBreak: false });
    });
    doc.fillColor('#000000');

    const sigSpace = pCfg.showSignatures !== false ? 58 : 16;
    const availH = pageH - margin - sigSpace - 14 - (gridTop + hdrH * 2);
    const dayRowH = Math.min(68, Math.max(36, availH / Math.max(1, grid.days.length)));

    grid.days.forEach((d, di) => {
      const ry = gridTop + hdrH * 2 + di * dayRowH;
      if (dayFill) doc.rect(x0, ry, dayColW, dayRowH).fillAndStroke(dayFill, borderColor);
      else doc.rect(x0, ry, dayColW, dayRowH).stroke();
      doc.fillColor('#000000').font(fBold).fontSize(10.5 * scale);
      doc.text(d.label, x0, ry + (dayRowH - 13) / 2, { width: dayColW, align: 'center', lineBreak: false });

      const spanByStart = new Map();
      const covered = new Set();
      for (const sp of grid.cells[di] || []) {
        spanByStart.set(sp.start, sp);
        for (let k = 0; k < sp.span; k++) covered.add(sp.start + k);
      }

      grid.periods.forEach((pm, pi) => {
        const px = x0 + dayColW + pi * periodW;
        if (pm.isBreak) {
          doc.rect(px, ry, periodW, dayRowH).fillAndStroke(breakFill, borderColor);
          doc.fillColor('#000000').font(fBold).fontSize(10.5 * scale);
          doc.text('พัก', px, ry + (dayRowH - 13) / 2, { width: periodW, align: 'center', lineBreak: false });
          return;
        }
        const sp = spanByStart.get(pm.period);
        if (sp) {
          const sw = periodW * sp.span;
          doc.rect(px, ry, sw, dayRowH).stroke();
          const lines = cellLines(v, sp);
          const lineStep = 10.5 * scale;
          const totalTextH = lines.length * lineStep;
          let ly = ry + (dayRowH - totalTextH) / 2;
          lines.forEach((line, li) => {
            doc.font(li === 0 ? fBold : fReg).fontSize((li === 0 ? 8.5 : 7.2) * scale);
            doc.text(clipText(doc, line, sw - 6), px + 3, ly, { width: sw - 6, align: 'center', lineBreak: false });
            ly += lineStep;
          });
        } else if (!covered.has(pm.period)) {
          doc.rect(px, ry, periodW, dayRowH).stroke();
        }
      });
    });

    // Signatures
    if (pCfg.showSignatures !== false) {
      const sigY = gridTop + hdrH * 2 + grid.days.length * dayRowH + 14;
      const sigs = [
        { name: entity.signerName, role: entity.signer },
        { name: info.curriculumHeadName, role: 'หัวหน้างานพัฒนาหลักสูตร' },
        { name: info.deputyName, role: 'รองคณบดีฝ่ายวิชาการ' },
        { name: info.directorName, role: `คณบดี${info.college.startsWith('คณะ') ? info.college : ''}` },
      ];
      const colW = W / 4;
      doc.font(fReg).fontSize(9.5 * scale).fillColor('#000000');
      sigs.forEach((sg, si) => {
        const sx = x0 + si * colW;
        doc.text('ลงชื่อ ...........................................', sx, sigY, { width: colW, align: 'center', lineBreak: false });
        const nm = sg.name ? `( ${sg.name} )` : '( ........................................... )';
        doc.text(clipText(doc, nm, colW - 8), sx + 4, sigY + 14, { width: colW - 8, align: 'center', lineBreak: false });
        doc.text(clipText(doc, sg.role, colW - 8), sx + 4, sigY + 28, { width: colW - 8, align: 'center', lineBreak: false });
      });
    }

    // Footer
    const footY = pageH - margin - 10;
    doc.font(fReg).fontSize(7).fillColor('#444444');
    if (pCfg.footerNote) {
      doc.text(pCfg.footerNote, x0, footY, { width: W / 2, align: 'left', lineBreak: false });
    }
    if (pCfg.showPrintDate !== false) {
      const nowStr = new Intl.DateTimeFormat('th-TH', {
        timeZone: 'Asia/Bangkok',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date());
      doc.text(`พิมพ์เมื่อ ${nowStr}`, x0, footY, { width: W, align: 'right', lineBreak: false });
    }
  }

  doc.end();
  return await new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
}

export async function exportXlsx(rows, ctx, { view = 'all', id = null } = {}) {
  const wb = new ExcelJS.Workbook();
  const info = docInfo(ctx);
  const semText = `${info.semester}/${info.year}`;
  const targets = resolveEntities(ctx, view, id);
  const usedNames = new Set();

  const safeSheetName = (prefix, eid) => {
    let base = `${prefix} ${eid}`.replace(/[\\/*?:[\]]/g, '-').slice(0, 31);
    let n = base;
    let i = 2;
    while (usedNames.has(n)) {
      n = `${base.slice(0, 28)}-${i++}`;
    }
    usedNames.add(n);
    return n;
  };

  const prefixMap = { group: 'กลุ่ม', teacher: 'ครู', room: 'ห้อง' };
  const thin = { style: 'thin', color: { argb: 'FF000000' } };
  const borderAll = { top: thin, left: thin, bottom: thin, right: thin };

  for (const { view: v, entity } of targets) {
    const ws = wb.addWorksheet(safeSheetName(prefixMap[v] || v, entity.id), {
      views: [{ showGridLines: false }],
      pageSetup: {
        paperSize: 9,
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
        horizontalCentered: true,
        margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
      },
    });

    const grid = buildGrid(v, entity.id, rows, ctx);
    const summary = subjectSummary(v, entity.id, rows, ctx);
    const k = Math.max(3, Math.ceil(36 / Math.max(1, grid.periods.length)));
    const cols = 2 + k * grid.periods.length;
    const per = Math.max(8, Math.ceil(summary.list.length / 2));

    for (let c = 1; c <= cols; c++) {
      ws.getColumn(c).width = c <= 2 ? 6 : 4.6;
    }

    // Header Left Box
    const leftU = Math.max(8, cols - 26);
    ws.mergeCells(1, 1, 2, leftU);
    ws.getCell(1, 1).value = info.college;
    ws.getCell(1, 1).font = { name: 'TH SarabunPSK', size: 16, bold: true };
    ws.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };

    ws.mergeCells(3, 1, 3, leftU);
    ws.getCell(3, 1).value = entity.heading;
    ws.getCell(3, 1).font = { name: 'TH SarabunPSK', size: 15, bold: true };
    ws.getCell(3, 1).alignment = { horizontal: 'center', vertical: 'middle' };

    const infoLines = [['ภาคเรียน', semText], ...entity.info];
    infoLines.forEach(([lbl, val], idx) => {
      const r = 5 + idx;
      ws.mergeCells(r, 1, r, leftU);
      ws.getCell(r, 1).value = {
        richText: [
          { text: `${lbl}: `, font: { name: 'TH SarabunPSK', size: 13, bold: true } },
          { text: String(val || '-'), font: { name: 'TH SarabunPSK', size: 13 } },
        ],
      };
      ws.getCell(r, 1).alignment = { horizontal: 'left', vertical: 'middle', shrinkToFit: true };
    });

    // Header Right Subject Table (2 halves x 13 units)
    const rightStart = leftU + 1;
    for (let h = 0; h < 2; h++) {
      const baseC = rightStart + h * 13;
      const segs = [
        [0, 2, 'รหัสวิชา'],
        [3, 8, 'ชื่อรายวิชา'],
        [9, 9, 'น.'],
        [10, 10, 'บ.'],
        [11, 11, 'ป.'],
        [12, 12, 'ศ.'],
      ];
      for (const [s, e, lbl] of segs) {
        if (s < e) ws.mergeCells(1, baseC + s, 1, baseC + e);
        const cell = ws.getCell(1, baseC + s);
        cell.value = lbl;
        cell.font = { name: 'TH SarabunPSK', size: 12, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        for (let cc = baseC + s; cc <= baseC + e; cc++) ws.getCell(1, cc).border = borderAll;
      }

      for (let r = 0; r < per; r++) {
        const rowNum = 2 + r;
        const item = summary.list[h * per + r];
        const vals = item ? [item.subject_id, item.name, item.n, item.t, item.p, item.s] : ['', '', '', '', '', ''];
        segs.forEach(([s, e], si) => {
          if (s < e) ws.mergeCells(rowNum, baseC + s, rowNum, baseC + e);
          const cell = ws.getCell(rowNum, baseC + s);
          cell.value = vals[si];
          cell.font = { name: 'TH SarabunPSK', size: 11 };
          cell.alignment = { horizontal: si === 1 ? 'left' : 'center', vertical: 'middle', shrinkToFit: true };
          for (let cc = baseC + s; cc <= baseC + e; cc++) ws.getCell(rowNum, cc).border = borderAll;
        });
      }

      const totRow = 2 + per;
      if (h === 0) {
        ws.mergeCells(totRow, baseC, totRow, baseC + 8);
        ws.getCell(totRow, baseC).value = 'รวม';
        ws.getCell(totRow, baseC).font = { name: 'TH SarabunPSK', size: 12, bold: true };
        ws.getCell(totRow, baseC).alignment = { horizontal: 'right', vertical: 'middle' };
        [summary.total.n, summary.total.t, summary.total.p, summary.total.s].forEach((sv, si) => {
          const cell = ws.getCell(totRow, baseC + 9 + si);
          cell.value = sv;
          cell.font = { name: 'TH SarabunPSK', size: 12, bold: true };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
      } else {
        ws.mergeCells(totRow, baseC, totRow, baseC + 12);
        ws.getCell(totRow, baseC).value = totalPeriodsLabel(grid);
        ws.getCell(totRow, baseC).font = { name: 'TH SarabunPSK', size: 12, bold: true };
        ws.getCell(totRow, baseC).alignment = { horizontal: 'center', vertical: 'middle' };
      }
      for (let cc = baseC; cc <= baseC + 12; cc++) ws.getCell(totRow, cc).border = borderAll;
    }

    // Grid
    const gStart = per + 4;
    ws.getRow(gStart).height = 20;
    ws.getRow(gStart + 1).height = 20;
    ws.mergeCells(gStart, 1, gStart, 2);
    ws.getCell(gStart, 1).value = 'เวลา';
    ws.getCell(gStart, 1).font = { name: 'TH SarabunPSK', size: 12, bold: true };
    ws.getCell(gStart, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.mergeCells(gStart + 1, 1, gStart + 1, 2);
    ws.getCell(gStart + 1, 1).value = 'วัน/คาบ';
    ws.getCell(gStart + 1, 1).font = { name: 'TH SarabunPSK', size: 12, bold: true };
    ws.getCell(gStart + 1, 1).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(gStart, 1).border = borderAll;
    ws.getCell(gStart, 2).border = borderAll;
    ws.getCell(gStart + 1, 1).border = borderAll;
    ws.getCell(gStart + 1, 2).border = borderAll;

    grid.periods.forEach((pm, pi) => {
      const c1 = 3 + pi * k;
      const c2 = c1 + k - 1;
      ws.mergeCells(gStart, c1, gStart, c2);
      ws.getCell(gStart, c1).value = `${pm.start}-${pm.end}`;
      ws.getCell(gStart, c1).font = { name: 'TH SarabunPSK', size: 11 };
      ws.getCell(gStart, c1).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.mergeCells(gStart + 1, c1, gStart + 1, c2);
      ws.getCell(gStart + 1, c1).value = pm.period;
      ws.getCell(gStart + 1, c1).font = { name: 'TH SarabunPSK', size: 12, bold: true };
      ws.getCell(gStart + 1, c1).alignment = { horizontal: 'center', vertical: 'middle' };
      for (let cc = c1; cc <= c2; cc++) {
        ws.getCell(gStart, cc).border = borderAll;
        ws.getCell(gStart + 1, cc).border = borderAll;
      }
    });

    grid.days.forEach((d, di) => {
      const rNum = gStart + 2 + di;
      ws.getRow(rNum).height = 64;
      ws.mergeCells(rNum, 1, rNum, 2);
      ws.getCell(rNum, 1).value = d.label;
      ws.getCell(rNum, 1).font = { name: 'TH SarabunPSK', size: 13, bold: true };
      ws.getCell(rNum, 1).alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getCell(rNum, 1).border = borderAll;
      ws.getCell(rNum, 2).border = borderAll;

      const spanByStart = new Map();
      const covered = new Set();
      for (const sp of grid.cells[di] || []) {
        spanByStart.set(sp.start, sp);
        for (let j = 0; j < sp.span; j++) covered.add(sp.start + j);
      }

      grid.periods.forEach((pm, pi) => {
        const c1 = 3 + pi * k;
        const c2 = c1 + k - 1;
        if (pm.isBreak) {
          ws.mergeCells(rNum, c1, rNum, c2);
          const cell = ws.getCell(rNum, c1);
          cell.value = 'พัก';
          cell.font = { name: 'TH SarabunPSK', size: 13, bold: true };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          for (let cc = c1; cc <= c2; cc++) ws.getCell(rNum, cc).border = borderAll;
          return;
        }
        const sp = spanByStart.get(pm.period);
        if (sp) {
          const endC = c1 + sp.span * k - 1;
          ws.mergeCells(rNum, c1, rNum, endC);
          const lines = cellLines(v, sp);
          const cell = ws.getCell(rNum, c1);
          cell.value = {
            richText: lines.map((ln, li) => ({
              text: (li > 0 ? '\n' : '') + ln,
              font: { name: 'TH SarabunPSK', size: li === 0 ? 12 : 11, bold: li === 0 },
            })),
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          for (let cc = c1; cc <= endC; cc++) ws.getCell(rNum, cc).border = borderAll;
        } else if (!covered.has(pm.period)) {
          ws.mergeCells(rNum, c1, rNum, c2);
          for (let cc = c1; cc <= c2; cc++) ws.getCell(rNum, cc).border = borderAll;
        }
      });
    });

    // Signatures
    const sigRow = gStart + 2 + grid.days.length + 2;
    const grpW = Math.floor(cols / 4);
    const sigs = [
      { name: entity.signerName, role: entity.signer },
      { name: info.curriculumHeadName, role: 'หัวหน้างานพัฒนาหลักสูตร' },
      { name: info.deputyName, role: 'รองคณบดีฝ่ายวิชาการ' },
      { name: info.directorName, role: 'คณบดี' },
    ];
    sigs.forEach((sg, si) => {
      const c1 = 1 + si * grpW;
      const c2 = si === 3 ? cols : c1 + grpW - 1;
      ws.mergeCells(sigRow, c1, sigRow, c2);
      ws.getCell(sigRow, c1).value = `ลงชื่อ ...................................\n( ${sg.name || '...................................'} )\n${sg.role}`;
      ws.getCell(sigRow, c1).font = { name: 'TH SarabunPSK', size: 12 };
      ws.getCell(sigRow, c1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    ws.getRow(sigRow).height = 54;
    ws.pageSetup.printArea = `A1:${ws.getColumn(cols).letter}${sigRow}`;
  }

  // Raw output sheet
  const rawWs = wb.addWorksheet('output');
  rawWs.addRow(OUTPUT_FIELDS);
  rawWs.getRow(1).font = { name: 'TH SarabunPSK', size: 12, bold: true };
  for (const r of rows || []) {
    rawWs.addRow(OUTPUT_FIELDS.map((f) => r[f] || ''));
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function exportQrPdf(items, ctx) {
  const info = docInfo(ctx);
  const regularFont = path.join(FONT_DIR, 'Sarabun-Regular.ttf');
  const boldFont = path.join(FONT_DIR, 'Sarabun-Bold.ttf');
  const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 24, autoFirstPage: false });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));

  if (fs.existsSync(regularFont)) doc.registerFont('th', regularFont);
  if (fs.existsSync(boldFont)) doc.registerFont('th-bold', boldFont);
  const fReg = fs.existsSync(regularFont) ? 'th' : 'Helvetica';
  const fBold = fs.existsSync(boldFont) ? 'th-bold' : 'Helvetica-Bold';

  const perPage = 6;
  const cardW = (595.28 - 48 - 16) / 2;
  const cardH = (841.89 - 48 - 32) / 3;

  for (let i = 0; i < items.length; i++) {
    const slot = i % perPage;
    if (slot === 0) doc.addPage();
    const col = slot % 2;
    const row = Math.floor(slot / 2);
    const x = 24 + col * (cardW + 16);
    const y = 24 + row * (cardH + 16);

    doc.save();
    doc.dash(4, { space: 3 }).strokeColor('#999999').lineWidth(0.8);
    doc.rect(x, y, cardW, cardH).stroke();
    doc.restore();

    doc.fillColor('#000000').font(fBold).fontSize(10);
    doc.text(clipText(doc, info.college, cardW - 16), x + 8, y + 10, { width: cardW - 16, align: 'center', lineBreak: false });
    doc.font(fBold).fontSize(12);
    doc.text(clipText(doc, items[i].title, cardW - 16), x + 8, y + 26, { width: cardW - 16, align: 'center', lineBreak: false });

    const qrBuf = await QRCode.toBuffer(items[i].url, { width: 140, margin: 1 });
    doc.image(qrBuf, x + (cardW - 130) / 2, y + 48, { width: 130, height: 130 });

    doc.font(fReg).fontSize(9.5).fillColor('#000000');
    doc.text('สแกนเพื่อดูตารางเรียนล่าสุด', x + 8, y + 186, { width: cardW - 16, align: 'center', lineBreak: false });
    doc.font(fReg).fontSize(7.5).fillColor('#666666');
    doc.text(clipText(doc, items[i].url, cardW - 16), x + 8, y + 204, { width: cardW - 16, align: 'center', lineBreak: false });
  }

  if (items.length === 0) {
    doc.addPage();
    doc.font(fBold).fontSize(14).text('ไม่พบรายการสำหรับสร้าง QR Code', 24, 100, { align: 'center' });
  }

  doc.end();
  return await new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
}
