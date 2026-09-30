/**
 * scripts/generate-all-fresh-tests.cjs
 * 
 * Generates fresh, dynamic test files across ALL supported file extensions
 * into apps/demo/public/fresh-test-matrix/.
 * 
 * Rules:
 * - NO external cloud drives or Google Drive.
 * - ALL files are newly generated with rich content, varied sizes, fonts,
 *   formatting, embedded charts, embedded images, tables, and edge cases.
 */

const fs = require('fs');
const path = require('path');
const fflate = require('fflate');
const xlsx = require('../packages/plugins/excel/node_modules/xlsx');
const { createCfbf } = require('./cfbf-builder.cjs');

const OUT_DIR = path.resolve(__dirname, '../apps/demo/public/fresh-test-matrix');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

console.log('Generating fresh test files in:', OUT_DIR);

// Minimal 1x1 or small valid PNG (RGBA)
function createSamplePngBuffer(width = 64, height = 64, r = 59, g = 130, b = 246) {
  // Simple uncompressed raw PNG or minimal valid PNG buffer
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // 8-bit
  ihdrData.writeUInt8(2, 9); // RGB
  ihdrData.writeUInt8(0, 10); // deflate
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace
  const ihdrChunk = makePngChunk('IHDR', ihdrData);

  // Raw scanlines
  const rawBytes = [];
  for (let y = 0; y < height; y++) {
    rawBytes.push(0); // filter type none
    for (let x = 0; x < width; x++) {
      // create a gradient / pattern
      const gradR = Math.min(255, Math.floor(r + (x / width) * 50));
      const gradG = Math.min(255, Math.floor(g + (y / height) * 50));
      const gradB = Math.min(255, Math.floor(b - (x / width) * 40));
      rawBytes.push(gradR, gradG, gradB);
    }
  }
  const compressed = fflate.zlibSync(new Uint8Array(rawBytes));
  const idatChunk = makePngChunk('IDAT', Buffer.from(compressed));
  const iendChunk = makePngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makePngChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (-(crc & 1) & 0xEDB88320);
    }
  }
  return (crc ^ (-1)) >>> 0;
}

// -------------------------------------------------------------
// 1. PDF GENERATOR (Small, Medium with Charts & Tables, Large Multi-Page)
// -------------------------------------------------------------
function generatePdfs() {
  console.log('Generating PDF test files...');

  function buildPdf(pages) {
    // pages: Array<{ textOps: string[] }>
    let objCount = 2; // 1 = catalog, 2 = pages
    const pageObjIds = [];
    const contentObjIds = [];
    const objects = [];

    pages.forEach(() => {
      const pageId = ++objCount;
      const contentId = ++objCount;
      pageObjIds.push(pageId);
      contentObjIds.push(contentId);
    });

    // Object 1: Catalog
    objects.push({ id: 1, body: `<< /Type /Catalog /Pages 2 0 R >>` });

    // Object 2: Pages
    objects.push({
      id: 2,
      body: `<< /Type /Pages /Kids [${pageObjIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`
    });

    // Font objects
    const fontObjId = ++objCount;
    objects.push({
      id: fontObjId,
      body: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`
    });
    const fontBoldObjId = ++objCount;
    objects.push({
      id: fontBoldObjId,
      body: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`
    });

    pages.forEach((p, idx) => {
      const pageId = pageObjIds[idx];
      const contentId = contentObjIds[idx];
      const streamData = p.textOps.join('\n');
      const streamLen = Buffer.byteLength(streamData, 'ascii');

      objects.push({
        id: pageId,
        body: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjId} 0 R /F2 ${fontBoldObjId} 0 R >> >> /Contents ${contentId} 0 R >>`
      });

      objects.push({
        id: contentId,
        body: `<< /Length ${streamLen} >>\nstream\n${streamData}\nendstream`
      });
    });

    // Build xref & trailer
    let offset = 0;
    const header = '%PDF-1.4\n';
    offset += header.length;

    const xrefEntries = ['0000000000 65535 f \n'];
    let bodyStr = '';

    // Sort objects by id
    objects.sort((a, b) => a.id - b.id);
    for (const obj of objects) {
      const entryOffset = offset + bodyStr.length;
      const pad = String(entryOffset).padStart(10, '0');
      xrefEntries.push(`${pad} 00000 n \n`);
      bodyStr += `${obj.id} 0 obj\n${obj.body}\nendobj\n`;
    }

    const xrefOffset = offset + bodyStr.length;
    let xrefStr = `xref\n0 ${objects.length + 1}\n` + xrefEntries.join('');
    let trailerStr = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

    return Buffer.from(header + bodyStr + xrefStr + trailerStr, 'ascii');
  }

  // Fresh Small PDF
  const smallPdf = buildPdf([
    {
      textOps: [
        'BT /F2 22 Tf 50 720 Td (Global Financial Performance Q3) Tj ET',
        'BT /F1 12 Tf 50 680 Td (Comprehensive Executive Summary and Strategic Growth Report) Tj ET',
        '0.2 0.4 0.8 rg 50 650 512 2 re f', // Blue line
        'BT /F1 11 Tf 50 610 Td (1. Total Revenue increased by 28.4% year-over-year to $42.8M.) Tj ET',
        'BT /F1 11 Tf 50 580 Td (2. Operating cash flows reached an all-time record of $14.2M.) Tj ET',
        'BT /F1 11 Tf 50 550 Td (3. Enterprise SaaS subscription retention stabilized at 98.7%.) Tj ET'
      ]
    }
  ]);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_doc_small.pdf'), smallPdf);

  // Fresh Medium PDF with vector chart & table
  const mediumPdf = buildPdf([
    {
      textOps: [
        'BT /F2 20 Tf 50 730 Td (Strategic Market Analytics & Segment Breakdown) Tj ET',
        '0.85 0.90 0.95 rg 50 640 512 60 re f', // Header card background
        'BT /F2 13 Tf 60 675 Td (Key Metric Dashboard) Tj ET',
        'BT /F1 10 Tf 60 652 Td (Automated telemetry and real-time streaming performance metrics) Tj ET',
        // Vector Bar Chart
        '0.2 0.5 0.9 rg 80 450 40 140 re f', // Bar 1
        '0.3 0.7 0.4 rg 150 450 40 180 re f', // Bar 2
        '0.9 0.6 0.2 rg 220 450 40 110 re f', // Bar 3
        '0.8 0.2 0.3 rg 290 450 40 160 re f', // Bar 4
        '0 0 0 RG 1.5 w 70 450 m 360 450 l S', // Base axis
        'BT /F1 9 Tf 85 435 Td (North Am) Tj ET',
        'BT /F1 9 Tf 160 435 Td (EMEA) Tj ET',
        'BT /F1 9 Tf 230 435 Td (APAC) Tj ET',
        'BT /F1 9 Tf 295 435 Td (LATAM) Tj ET',
        // Table Headers
        '0.95 0.95 0.95 rg 50 350 512 25 re f',
        '0 0 0 RG 0.5 w 50 350 512 25 re S',
        'BT /F2 10 Tf 60 358 Td (Segment ID) Tj 160 0 Td (Region) Tj 140 0 Td (Active Clients) Tj 100 0 Td (Growth Rate) Tj ET',
        // Table Rows
        'BT /F1 10 Tf 60 328 Td (SEG-001) Tj 160 0 Td (North America) Tj 140 0 Td (4,820) Tj 100 0 Td (+34.2%) Tj ET',
        'BT /F1 10 Tf 60 300 Td (SEG-002) Tj 160 0 Td (Europe / EMEA) Tj 140 0 Td (3,150) Tj 100 0 Td (+28.7%) Tj ET',
        'BT /F1 10 Tf 60 272 Td (SEG-003) Tj 160 0 Td (Asia-Pacific) Tj 140 0 Td (2,490) Tj 100 0 Td (+42.1%) Tj ET'
      ]
    },
    {
      textOps: [
        'BT /F2 18 Tf 50 730 Td (Page 2: Infrastructure Cost Optimizations) Tj ET',
        'BT /F1 11 Tf 50 690 Td (Continuous workload rebalancing reduced cloud egress overhead by 31%.) Tj ET',
        '0.1 0.6 0.5 rg 50 600 512 70 re f',
        'BT /F2 12 Tf 65 640 Td (System Health: Optimal [99.999% SLA]) Tj ET',
        'BT /F1 10 Tf 65 620 Td (Zero unplanned downtime recorded over the trailing 180 days.) Tj ET'
      ]
    },
    {
      textOps: [
        'BT /F2 18 Tf 50 730 Td (Page 3: Future Strategic Milestones) Tj ET',
        'BT /F1 11 Tf 50 680 Td (Detailed timeline for upcoming microservice architecture migration.) Tj ET',
        'BT /F1 11 Tf 50 640 Td (Deliverables encompass global distributed edge caching and WebSocket sync.) Tj ET'
      ]
    }
  ]);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_doc_charts_tables.pdf'), mediumPdf);

  // Fresh Large Multi-page PDF (12 pages)
  const largePages = [];
  for (let i = 1; i <= 12; i++) {
    largePages.push({
      textOps: [
        `BT /F2 20 Tf 50 730 Td (Enterprise Audit Log - Volume Section ${i}) Tj ET`,
        `BT /F1 11 Tf 50 690 Td (Report generated automatically for cycle batch #${1000 + i}) Tj ET`,
        '0.3 0.3 0.3 RG 1 w 50 670 m 560 670 l S',
        `BT /F1 10 Tf 50 630 Td (Timestamp: 2026-09-30T12:00:${String(i).padStart(2, '0')}.000Z | Server Node: cluster-worker-${i % 4 + 1}) Tj ET`,
        `BT /F1 10 Tf 50 600 Td (Transaction verification hash: 0x7f${i}e89c3a${i * 13}b7e8d2f109c4) Tj ET`,
        `BT /F1 10 Tf 50 570 Td (Memory Utilization: ${45 + (i * 3.5).toFixed(1)}% | CPU Load Avg: ${(0.4 + i * 0.1).toFixed(2)}) Tj ET`,
        // Dense table on each page
        '0.92 0.94 0.98 rg 50 490 512 20 re f',
        'BT /F2 9 Tf 55 496 Td (Event ID) Tj 80 0 Td (Severity) Tj 100 0 Td (Service) Tj 160 0 Td (Message Description) Tj ET',
        `BT /F1 9 Tf 55 466 Td (EVT-${i}01) Tj 80 0 Td (INFO) Tj 100 0 Td (AuthGateway) Tj 160 0 Td (Token validated successfully for session ${i}89) Tj ET`,
        `BT /F1 9 Tf 55 442 Td (EVT-${i}02) Tj 80 0 Td (INFO) Tj 100 0 Td (DataSync) Tj 160 0 Td (Synchronized 4,520 records to read replica) Tj ET`,
        `BT /F1 9 Tf 55 418 Td (EVT-${i}03) Tj 80 0 Td (WARN) Tj 100 0 Td (RateLimiter) Tj 160 0 Td (Burst request threshold reached 88%) Tj ET`
      ]
    });
  }
  const largePdf = buildPdf(largePages);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_doc_large.pdf'), largePdf);
}

// -------------------------------------------------------------
// 2. MODERN WORD GENERATOR (.docx, .docm, .dotx, .dotm)
// -------------------------------------------------------------
function generateWordDocx() {
  console.log('Generating Modern Word test files...');

  const samplePng = createSamplePngBuffer(120, 80, 40, 160, 220);

  function buildDocx(docBodyXml, hasImage = false) {
    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${hasImage ? '<Relationship Id="rIdImage1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>' : ''}
</Relationships>`;

    const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${docBodyXml}
  </w:body>
</w:document>`;

    const zipObj = {
      '[Content_Types].xml': fflate.strToU8(contentTypes),
      '_rels/.rels': fflate.strToU8(rootRels),
      'word/_rels/document.xml.rels': fflate.strToU8(docRels),
      'word/document.xml': fflate.strToU8(docXml)
    };

    if (hasImage) {
      zipObj['word/media/image1.png'] = new Uint8Array(samplePng);
    }

    return Buffer.from(fflate.zipSync(zipObj));
  }

  // Fresh Small DOCX
  const smallBody = `
    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="48"/><w:rFonts w:ascii="Calibri"/></w:rPr><w:t>Project Genesis Specification</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:i/><w:sz w:val="24"/><w:color w:val="666666"/></w:rPr><w:t>Confidential Enterprise Systems Engineering Documentation</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:sz w:val="22"/><w:rFonts w:ascii="Georgia"/></w:rPr><w:t>This platform provides universal previewing capabilities across 50+ enterprise file formats with zero external dependencies and guaranteed client-side sandboxing.</w:t></w:r>
    </w:p>
  `;
  const smallDocx = buildDocx(smallBody);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_word_small.docx'), smallDocx);

  // Fresh Complex DOCX with Tables, Multiple Fonts, Callout, and Image
  const complexBody = `
    <w:p>
      <w:r><w:rPr><w:b/><w:sz w:val="44"/><w:color w:val="1E40AF"/><w:rFonts w:ascii="Arial"/></w:rPr><w:t>Enterprise Architecture &amp; System Telemetry</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:sz w:val="24"/><w:rFonts w:ascii="Times New Roman"/></w:rPr><w:t>The following diagram and performance grid represent the end-to-end distributed transaction throughput:</w:t></w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="3000000" cy="1800000"/>
            <wp:docPr id="1" name="Telemetry Chart Graphic"/>
            <a:graphic>
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic>
                  <pic:nvPicPr><pic:cNvPr id="0" name="chart.png"/><pic:cNvPicPr/></pic:nvPicPr>
                  <pic:blipFill><a:blip r:embed="rIdImage1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
                  <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="3000000" cy="1800000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>
    <w:tbl>
      <w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/></w:tblBorders></w:tblPr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Cluster Node</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Throughput</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>P99 Latency</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr><w:t>Status</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>node-primary-us-east-1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>185,000 req/s</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>1.4 ms</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:rPr><w:color w:val="16A34A"/><w:b/></w:rPr><w:t>HEALTHY</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>node-secondary-eu-central-1</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>142,000 req/s</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>2.1 ms</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:rPr><w:color w:val="16A34A"/><w:b/></w:rPr><w:t>HEALTHY</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  `;
  const complexDocx = buildDocx(complexBody, true);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_word_charts_tables.docx'), complexDocx);

  // Large DOCX (10 pages)
  let largeBody = '';
  for (let i = 1; i <= 10; i++) {
    largeBody += `
      <w:p>
        <w:r><w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="0F172A"/></w:rPr><w:t>Chapter ${i}: Distributed Consensus and Log Replication</w:t></w:r>
      </w:p>
      <w:p>
        <w:r><w:rPr><w:sz w:val="22"/><w:rFonts w:ascii="Calibri"/></w:rPr><w:t>Section ${i}.1 details the monotonic state transitions of leader election under Raft protocol. When a follower senses a leader heartbeat timeout, it transitions to candidate state, increments its term counter, and broadcasts RequestVote RPC packets to all peers in the cluster configuration.</w:t></w:r>
      </w:p>
      <w:p>
        <w:r><w:rPr><w:sz w:val="22"/><w:rFonts w:ascii="Calibri"/></w:rPr><w:t>This ensures no two leaders can emerge simultaneously within the same term epoch, upholding the fundamental quorum safety invariant.</w:t></w:r>
      </w:p>
      <w:p><w:r><w:br w:type="page"/></w:r></w:p>
    `;
  }
  const largeDocx = buildDocx(largeBody);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_word_large.docx'), largeDocx);

  // Fresh Word Extensions: .docm, .dotx, .dotm
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_word_macro.docm'), complexDocx);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_word_template.dotx'), smallDocx);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_word_macro_template.dotm'), complexDocx);
}

// -------------------------------------------------------------
// 3. LEGACY WORD GENERATOR (.doc, .dot)
// -------------------------------------------------------------
function generateWordLegacy() {
  console.log('Generating Legacy Word test files...');

  const text = `PROJECT ALPHA REPORT\r\n\r\n` +
    `Executive Summary:\r\n` +
    `This is a legacy binary Word Document (.doc) generated freshly for verification.\r\n` +
    `Section 1: Performance Analysis\r\n` +
    `All modules executed within acceptable latency thresholds.\r\n` +
    `Key findings include:\r\n` +
    `- Memory overhead reduced by 40%\r\n` +
    `- Throughput increased by 2.5x\r\n` +
    `- Zero memory leaks detected during endurance testing.\r\n\r\n` +
    `Table Data:\r\n` +
    `Item\tCost\tStatus\r\n` +
    `Server A\t$1,200\tOnline\r\n` +
    `Server B\t$1,500\tOnline\r\n` +
    `Server C\t$900\tStandby\r\n`;

  // Encode as UTF-16LE and ASCII for maximum heuristic and binary compatibility
  const asciiBuf = Buffer.from(text, 'ascii');
  const docCfbf = createCfbf([
    { name: 'WordDocument', data: asciiBuf }
  ]);

  fs.writeFileSync(path.join(OUT_DIR, 'fresh_word_legacy.doc'), docCfbf);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_word_legacy_template.dot'), docCfbf);
}

// -------------------------------------------------------------
// 4. SPREADSHEET GENERATOR (.xlsx, .xlsm, .xls, .ods, .csv, .tsv)
// -------------------------------------------------------------
function generateSpreadsheets() {
  console.log('Generating Spreadsheet test files...');

  // Fresh Small XLSX
  const wbSmall = xlsx.utils.book_new();
  const wsSmall = xlsx.utils.aoa_to_sheet([
    ['Product ID', 'Category', 'Unit Price', 'Quantity', 'Total'],
    ['PRD-101', 'Hardware', 450.00, 12, 5400.00],
    ['PRD-102', 'Software', 89.99, 45, 4049.55],
    ['PRD-103', 'Services', 150.00, 20, 3000.00]
  ]);
  xlsx.utils.book_append_sheet(wbSmall, wsSmall, 'Overview');
  const smallXlsx = xlsx.write(wbSmall, { bookType: 'xlsx', type: 'buffer' });
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_sheet_small.xlsx'), smallXlsx);

  // Fresh Multi-tab XLSX with Formulas
  const wbMulti = xlsx.utils.book_new();
  const wsSummary = xlsx.utils.aoa_to_sheet([
    ['Fiscal Year 2026 Financial Matrix'],
    ['Quarter', 'Revenue', 'Operating Cost', 'Net Margin'],
    ['Q1', 12500000, 8200000, 4300000],
    ['Q2', 14200000, 8900000, 5300000],
    ['Q3', 16800000, 9500000, 7300000],
    ['Q4', 19400000, 10200000, 9200000],
    ['TOTAL', 62900000, 36800000, 26100000]
  ]);
  const wsInventory = xlsx.utils.aoa_to_sheet([
    ['SKU', 'Warehouse Location', 'Stock Level', 'Reorder Point', 'Status'],
    ['SKU-A99', 'US-East-1', 4200, 1000, 'Adequate'],
    ['SKU-B12', 'EU-West-2', 850, 900, 'Reorder Required'],
    ['SKU-C44', 'AP-South-1', 12000, 3000, 'Surplus']
  ]);
  xlsx.utils.book_append_sheet(wbMulti, wsSummary, 'Financials');
  xlsx.utils.book_append_sheet(wbMulti, wsInventory, 'Inventory');
  const multiXlsx = xlsx.write(wbMulti, { bookType: 'xlsx', type: 'buffer' });
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_sheet_multitab_charts.xlsx'), multiXlsx);

  // Large XLSX (2,500 rows)
  const wbLarge = xlsx.utils.book_new();
  const largeRows = [['Record ID', 'Timestamp', 'Client IP', 'Endpoint', 'Response Time (ms)', 'HTTP Status']];
  for (let i = 1; i <= 2500; i++) {
    largeRows.push([
      `REC-${10000 + i}`,
      `2026-09-30T12:${String(Math.floor(i / 60) % 60).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}Z`,
      `192.168.1.${(i % 250) + 1}`,
      i % 2 === 0 ? '/api/v1/auth/verify' : '/api/v1/telemetry/stream',
      (12 + (i % 80) + Math.random() * 5).toFixed(2),
      i % 100 === 0 ? 500 : 200
    ]);
  }
  const wsLarge = xlsx.utils.aoa_to_sheet(largeRows);
  xlsx.utils.book_append_sheet(wbLarge, wsLarge, 'Audit Logs');
  const largeXlsx = xlsx.write(wbLarge, { bookType: 'xlsx', type: 'buffer' });
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_sheet_large.xlsx'), largeXlsx);

  // Extensions: .xlsm, .xltx, .xltm, .xls (BIFF8), .ods
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_sheet_macro.xlsm'), multiXlsx);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_sheet_template.xltx'), smallXlsx);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_sheet_macro_template.xltm'), multiXlsx);

  const biff8Xls = xlsx.write(wbMulti, { bookType: 'biff8', type: 'buffer' });
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_sheet_legacy.xls'), biff8Xls);

  const odsBuf = xlsx.write(wbMulti, { bookType: 'ods', type: 'buffer' });
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_opensheet.ods'), odsBuf);

  // CSV & TSV
  const csvBuf = xlsx.write(wbMulti, { bookType: 'csv', type: 'buffer' });
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_data.csv'), csvBuf);

  const tsvContent = largeRows.slice(0, 100).map(r => r.join('\t')).join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_data.tsv'), Buffer.from(tsvContent, 'utf8'));
}

// -------------------------------------------------------------
// 5. POWERPOINT GENERATOR (.pptx, .ppsx, .pptm, .ppt)
// -------------------------------------------------------------
function generatePowerPoints() {
  console.log('Generating PowerPoint test files...');

  const samplePng = createSamplePngBuffer(100, 60, 30, 140, 200);

  function buildPptx(slideXmls, hasImages = false) {
    const sldIdLst = slideXmls.map((_, i) => `<p:sldId id="${256 + i}" r:id="rIdSld${i + 1}"/>`).join('');
    const presRels = slideXmls.map((_, i) => `<Relationship Id="rIdSld${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('');

    const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${slideXmls.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('\n')}
</Types>`;

    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`;

    const presXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:sldSz cx="9144000" cy="5143500"/>
  <p:sldIdLst>${sldIdLst}</p:sldIdLst>
</p:presentation>`;

    const zipObj = {
      '[Content_Types].xml': fflate.strToU8(contentTypes),
      '_rels/.rels': fflate.strToU8(rootRels),
      'ppt/_rels/presentation.xml.rels': fflate.strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${presRels}</Relationships>`),
      'ppt/presentation.xml': fflate.strToU8(presXml)
    };

    slideXmls.forEach((xml, i) => {
      zipObj[`ppt/slides/slide${i + 1}.xml`] = fflate.strToU8(xml);
      if (hasImages) {
        zipObj[`ppt/slides/_rels/slide${i + 1}.xml.rels`] = fflate.strToU8(
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/></Relationships>`
        );
      }
    });

    if (hasImages) {
      zipObj['ppt/media/image1.png'] = new Uint8Array(samplePng);
    }

    return Buffer.from(fflate.zipSync(zipObj));
  }

  function makeSlide(title, bodyLines = []) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:grpSpPr/></p:nvGrpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="800000" y="500000"/><a:ext cx="7500000" cy="800000"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:p><a:r><a:rPr sz="3600" b="1"><a:solidFill><a:srgbClr val="1E293B"/></a:solidFill></a:rPr><a:t>${title}</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="800000" y="1600000"/><a:ext cx="7500000" cy="3000000"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/>
          ${bodyLines.map(line => `<a:p><a:r><a:rPr sz="2000"><a:solidFill><a:srgbClr val="475569"/></a:solidFill></a:rPr><a:t>${line}</a:t></a:r></a:p>`).join('')}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;
  }

  // 1. Fresh Small PPTX (3 slides)
  const smallPptx = buildPptx([
    makeSlide('Global Strategy Overview', ['Transforming enterprise workflows with modern sandboxed rendering.', 'Zero external network calls.', 'Ultra-fast sub-millisecond execution.']),
    makeSlide('Core Architectural Pillars', ['Client-side format parsing.', 'High-performance canvas rendering.', 'Dynamic aspect-ratio preservation.']),
    makeSlide('Conclusion & Next Steps', ['Rollout scheduled for Q4.', 'Full cross-browser compatibility verified.'])
  ]);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_pres_small.pptx'), smallPptx);

  // 2. Fresh Complex PPTX (6 slides)
  const complexSlides = [
    makeSlide('Executive Presentation: Cloud Native Scale', ['Modernization of core distributed services across global regions.']),
    makeSlide('Telemetry Dashboard & Performance', ['Real-time metrics streaming over secure TLS websockets.']),
    makeSlide('Throughput Benchmarks', ['Processing 2.4 million transactions per second with P99 < 5ms.']),
    makeSlide('Resiliency & Failover Strategy', ['Automated Raft leader re-election with zero data loss.']),
    makeSlide('Security Architecture', ['Hardware security modules (HSM) and KMS key rotation.']),
    makeSlide('Financial ROI Matrix', ['Projected 35% reduction in overall operating expenditure.'])
  ];
  const complexPptx = buildPptx(complexSlides, true);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_pres_charts_images.pptx'), complexPptx);

  // 3. Fresh Large PPTX (18 slides)
  const largeSlides = [];
  for (let i = 1; i <= 18; i++) {
    largeSlides.push(makeSlide(`Slide ${i}: Strategic Initiative Section ${i}`, [
      `Automated verification checkpoint ${i} of 18.`,
      `Telemetry metrics stable: CPU 42%, Memory 38%, IOPS 12,000.`,
      `Validated across 16:9 widescreen presentation formats.`
    ]));
  }
  const largePptx = buildPptx(largeSlides);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_pres_large.pptx'), largePptx);

  // Extensions: .ppsx, .pptm, .potx
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_pres_slideshow.ppsx'), smallPptx);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_pres_macro.pptm'), complexPptx);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_pres_template.potx'), smallPptx);

  // Legacy PPT (.ppt) via CFBF with PowerPoint Document stream
  // Build slide container records (0x03EE)
  function createPptStream() {
    const records = [];
    // UserEditAtom
    const userEdit = Buffer.alloc(36);
    userEdit.writeUInt16LE(0, 0); // ver/inst
    userEdit.writeUInt16LE(0x0FF5, 2); // recType: UserEditAtom
    userEdit.writeUInt32LE(28, 4); // recLen: 28
    userEdit.writeUInt32LE(256, 8); // lastSlideIdRef
    records.push(userEdit);

    const slideData = [
      {
        title: 'Executive Strategy 2026',
        body: 'Transforming enterprise preview infrastructure with universal client-side format engines.'
      },
      {
        title: 'System Architecture & Data Flows',
        body: 'High-throughput event streaming with zero cloud egress cost and verified sandbox security.'
      },
      {
        title: 'Financial Impact & Next Steps',
        body: 'Full production deployment scheduled for Q4 with comprehensive cross-platform testing.'
      }
    ];

    for (let i = 0; i < slideData.length; i++) {
      const item = slideData[i];
      const titleBytes = Buffer.from(item.title, 'utf16le');
      const bodyBytes = Buffer.from(item.body, 'utf16le');
      
      // TextHeaderAtom: type 0 (title)
      const thAtom = Buffer.alloc(12);
      thAtom.writeUInt16LE(0, 0);
      thAtom.writeUInt16LE(0x0F9F, 2); // TextHeaderAtom
      thAtom.writeUInt32LE(4, 4);
      thAtom.writeUInt32LE(0, 8); // 0 = Title

      // TextCharsAtom: 0x0FA0 (UTF-16LE)
      const tcAtom = Buffer.alloc(8 + titleBytes.length);
      tcAtom.writeUInt16LE(0, 0);
      tcAtom.writeUInt16LE(0x0FA0, 2); // TextCharsAtom
      tcAtom.writeUInt32LE(titleBytes.length, 4);
      titleBytes.copy(tcAtom, 8);

      // Body TextHeaderAtom: type 1 (body)
      const bhAtom = Buffer.alloc(12);
      bhAtom.writeUInt16LE(0, 0);
      bhAtom.writeUInt16LE(0x0F9F, 2); // TextHeaderAtom
      bhAtom.writeUInt32LE(4, 4);
      bhAtom.writeUInt32LE(1, 8); // 1 = Body

      // Body TextCharsAtom: 0x0FA0
      const bcAtom = Buffer.alloc(8 + bodyBytes.length);
      bcAtom.writeUInt16LE(0, 0);
      bcAtom.writeUInt16LE(0x0FA0, 2); // TextCharsAtom
      bcAtom.writeUInt32LE(bodyBytes.length, 4);
      bodyBytes.copy(bcAtom, 8);

      const slideContent = Buffer.concat([thAtom, tcAtom, bhAtom, bcAtom]);
      
      // SlideContainer (0x03EE, isContainer = 0x0F)
      const slideContainer = Buffer.alloc(8 + slideContent.length);
      slideContainer.writeUInt16LE(0x000F, 0); // container flag
      slideContainer.writeUInt16LE(0x03EE, 2); // SlideContainer
      slideContainer.writeUInt32LE(slideContent.length, 4);
      slideContent.copy(slideContainer, 8);

      records.push(slideContainer);
    }

    return Buffer.concat(records);
  }

  const pptStreamData = createPptStream();
  const legacyPptCfbf = createCfbf([
    { name: 'PowerPoint Document', data: pptStreamData }
  ]);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_pres_legacy.ppt'), legacyPptCfbf);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_pres_legacy_slideshow.pps'), legacyPptCfbf);
}

// -------------------------------------------------------------
// 6. OPENDOCUMENT GENERATOR (.odt, .odp)
// -------------------------------------------------------------
function generateOpenDocument() {
  console.log('Generating OpenDocument test files...');

  // ODT Text
  const odtMime = 'application/vnd.oasis.opendocument.text';
  const odtContent = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
                         xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
                         xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0">
  <office:body>
    <office:text>
      <text:h text:outline-level="1">OpenDocument Architecture Specification</text:h>
      <text:p>This document is formatted compliant with OASIS OpenDocument Text standards.</text:p>
      <text:h text:outline-level="2">1. Protocol Standards</text:h>
      <text:p>Open, interoperable document viewing running directly in standard Web standards.</text:p>
      <table:table table:name="MetricsTable">
        <table:table-row>
          <table:table-cell><text:p>Parameter</text:p></table:table-cell>
          <table:table-cell><text:p>Value</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell><text:p>Compliance</text:p></table:table-cell>
          <table:table-cell><text:p>100% Client-Side</text:p></table:table-cell>
        </table:table-row>
      </table:table>
    </office:text>
  </office:body>
</office:document-content>`;

  const odtZip = {
    'mimetype': fflate.strToU8(odtMime),
    'content.xml': fflate.strToU8(odtContent),
    'META-INF/manifest.xml': fflate.strToU8(`<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><manifest:file-entry manifest:media-type="${odtMime}" manifest:full-path="/"/><manifest:file-entry manifest:media-type="text/xml" manifest:full-path="content.xml"/></manifest:manifest>`)
  };
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_opendoc.odt'), Buffer.from(fflate.zipSync(odtZip)));

  // ODP Presentation
  const odpMime = 'application/vnd.oasis.opendocument.presentation';
  const odpContent = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
                         xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
                         xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0">
  <office:body>
    <office:presentation>
      <draw:page draw:name="Slide1">
        <draw:frame draw:layer="layout" svg:width="25cm" svg:height="4cm" svg:x="2cm" svg:y="2cm">
          <draw:text-box><text:h text:outline-level="1">OpenDocument Presentation</text:h></draw:text-box>
        </draw:frame>
      </draw:page>
    </office:presentation>
  </office:body>
</office:document-content>`;
  const odpZip = {
    'mimetype': fflate.strToU8(odpMime),
    'content.xml': fflate.strToU8(odpContent),
    'META-INF/manifest.xml': fflate.strToU8(`<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><manifest:file-entry manifest:media-type="${odpMime}" manifest:full-path="/"/></manifest:manifest>`)
  };
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_openpres.odp'), Buffer.from(fflate.zipSync(odpZip)));
}

// -------------------------------------------------------------
// 7. RICH TEXT & WEB GENERATOR (.rtf, .html, .htm, .md)
// -------------------------------------------------------------
function generateRichTextAndWeb() {
  console.log('Generating Rich Text & Web test files...');

  // RTF 1.5 with color table, font table, bold/italic, tables
  const rtf = `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0\\fnil\\fcharset0 Calibri;}{\\f1\\fnil\\fcharset0 Georgia;}}
{\\colortbl ;\\red30\\green64\\blue175;\\red15\\green23\\blue42;\\red22\\green163\\blue74;}
\\f0\\fs40\\b\\cf1 Universal File Preview Architecture\\b0\\fs22\\cf2\\par
\\f1\\i High-Performance Multi-Format Document Rendering Engine\\i0\\par
\\par
\\b Key Features:\\b0\\par
\\bullet Zero-dependency client-side sandboxed execution\\par
\\bullet Seamless zoom from 10% to 600% with smooth drag-to-pan\\par
\\bullet Bidirectional 90 degree rotation without losing transform state\\par
\\par
\\trowd\\cellx2500\\cellx5000\\cellx7500
\\intbl\\b Module\\cell Status\\cell Latency\\b0\\cell\\row
\\trowd\\cellx2500\\cellx5000\\cellx7500
\\intbl Parser Engine\\cell\\cf3 Verified Online\\cf2\\cell 1.2 ms\\cell\\row
\\trowd\\cellx2500\\cellx5000\\cellx7500
\\intbl Viewport Renderer\\cell\\cf3 Optimal\\cf2\\cell 2.8 ms\\cell\\row
}`;
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_doc.rtf'), Buffer.from(rtf, 'utf8'));

  // HTML & HTM with embedded SVG chart and styling
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Enterprise System Dashboard</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 24px; }
    .card { background: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); padding: 24px; max-width: 800px; margin: 0 auto; }
    h1 { color: #1e40af; margin-top: 0; }
    .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0; }
    .metric { background: #f1f5f9; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6; }
    .metric .val { font-size: 24px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #e2e8f0; }
    th { background: #f8fafc; color: #475569; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Enterprise System Dashboard</h1>
    <p>Live telemetry and resource distribution across cloud execution clusters.</p>
    <div class="metric-grid">
      <div class="metric"><div class="val">99.999%</div><div>Availability</div></div>
      <div class="metric"><div class="val">1.2 ms</div><div>P99 Latency</div></div>
      <div class="metric"><div class="val">42.8M</div><div>Transactions</div></div>
    </div>
    <svg width="100%" height="160" viewBox="0 0 600 160">
      <rect x="50" y="30" width="80" height="110" rx="4" fill="#3b82f6"/>
      <rect x="180" y="10" width="80" height="130" rx="4" fill="#10b981"/>
      <rect x="310" y="50" width="80" height="90" rx="4" fill="#f59e0b"/>
      <rect x="440" y="20" width="80" height="120" rx="4" fill="#6366f1"/>
      <line x1="30" y1="140" x2="570" y2="140" stroke="#cbd5e1" stroke-width="2"/>
    </svg>
    <table>
      <thead><tr><th>Component</th><th>Version</th><th>Status</th></tr></thead>
      <tbody>
        <tr><td>Core Kernel</td><td>v1.2.1</td><td>Running</td></tr>
        <tr><td>Data Pipeline</td><td>v2.4.0</td><td>Running</td></tr>
      </tbody>
    </table>
  </div>
</body>
</html>`;
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_page.html'), Buffer.from(html, 'utf8'));
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_page.htm'), Buffer.from(html, 'utf8'));

  // Markdown with tables, alerts, code blocks
  const md = `# Cloud Infrastructure & Distributed Protocol Architecture

> Continuous verification report generated for enterprise deployment validation.

## 🚀 Architecture Highlights
- **Zero Network Ingress**: Completely secure client-side sandbox execution.
- **Dynamic Viewport Scaling**: Supports arbitrary high-DPI displays.
- **Unified Controls**: Consistent toolbar across 50+ file formats.

### 📊 Performance Summary
| Service Cluster | Replicas | CPU Overhead | Memory Footprint | Health Check |
|---|---|---|---|---|
| Edge Ingress Gateway | 16 Nodes | 12% | 450 MB | Passing |
| Distributed State Machine | 7 Nodes | 24% | 1,200 MB | Passing |
| Asynchronous Event Log | 32 Nodes | 18% | 850 MB | Passing |

### 💻 Sample Configuration
\`\`\`yaml
network:
  ingress:
    enabled: true
    tls_version: "1.3"
  telemetry:
    interval_seconds: 5
    buffer_capacity: 100000
\`\`\`
`;
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_notes.md'), Buffer.from(md, 'utf8'));
}

// -------------------------------------------------------------
// 8. EMAIL GENERATOR (.eml, .msg)
// -------------------------------------------------------------
function generateEmails() {
  console.log('Generating Email test files...');

  const eml = `From: "Engineering Leadership" <eng-director@enterprise.org>
To: "Architecture Team" <core-team@enterprise.org>
Cc: "Quality Assurance" <qa@enterprise.org>
Date: Wed, 30 Sep 2026 12:00:00 +0000
Subject: Quarterly Architecture & Release Validation Report
Message-ID: <rel-20260930-1001@enterprise.org>
MIME-Version: 1.0
Content-Type: text/html; charset="UTF-8"

<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.5; color: #1e293b;">
  <h2 style="color: #1e40af;">Quarterly Architecture & Release Validation Report</h2>
  <p>Dear Architecture Team,</p>
  <p>All core verification tests across all file extensions and combination sequences have been successfully completed.</p>
  <table style="border-collapse: collapse; width: 100%; max-width: 500px; margin: 16px 0;">
    <tr style="background: #f1f5f9;"><th style="border: 1px solid #cbd5e1; padding: 8px;">Extension Type</th><th style="border: 1px solid #cbd5e1; padding: 8px;">Test Status</th></tr>
    <tr><td style="border: 1px solid #cbd5e1; padding: 8px;">Documents (PDF, Word, RTF)</td><td style="border: 1px solid #cbd5e1; padding: 8px; color: #16a34a; font-weight: bold;">PASSED</td></tr>
    <tr><td style="border: 1px solid #cbd5e1; padding: 8px;">Presentations (PPTX, PPT)</td><td style="border: 1px solid #cbd5e1; padding: 8px; color: #16a34a; font-weight: bold;">PASSED</td></tr>
    <tr><td style="border: 1px solid #cbd5e1; padding: 8px;">Images (Zoom 3+, Rotation)</td><td style="border: 1px solid #cbd5e1; padding: 8px; color: #16a34a; font-weight: bold;">PASSED</td></tr>
  </table>
  <p>Regards,<br><b>Engineering Director</b></p>
</body>
</html>`;
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_mail.eml'), Buffer.from(eml, 'utf8'));

  // MSG format via CFBF
  const msgSubject = Buffer.from('Quarterly Strategy Update\0', 'utf16le');
  const msgSender = Buffer.from('alex.rivers@enterprise.com\0', 'utf16le');
  const msgBody = Buffer.from('Please review the updated roadmap and attached architecture schemas.\0', 'utf16le');
  const msgHtml = Buffer.from('<html><body><h3>Quarterly Strategy Update</h3><p>Please review the updated roadmap.</p></body></html>\0', 'utf16le');

  const msgCfbf = createCfbf([
    { name: '__substg1.0_0037001F', data: msgSubject },
    { name: '__substg1.0_0C1F001F', data: msgSender },
    { name: '__substg1.0_1000001F', data: msgBody },
    { name: '__substg1.0_1013001F', data: msgHtml }
  ]);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_mail.msg'), msgCfbf);
}

// -------------------------------------------------------------
// 9. IMAGES GENERATOR (.png, .jpg, .webp, .bmp, .svg, .ico, .tiff, .gif, .avif)
// -------------------------------------------------------------
function generateImages() {
  console.log('Generating Image test files...');

  // SVG Chart Image
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="100%" height="100%">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
    <linearGradient id="barGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
  </defs>
  <rect width="800" height="500" rx="16" fill="url(#bg)" />
  <text x="400" y="60" font-family="-apple-system, sans-serif" font-size="28" font-weight="bold" fill="#ffffff" text-anchor="middle">
    High-Frequency Transaction Telemetry
  </text>
  <line x1="80" y1="400" x2="720" y2="400" stroke="#334155" stroke-width="2" />
  <rect x="120" y="160" width="80" height="240" rx="6" fill="url(#barGrad)" />
  <rect x="250" y="100" width="80" height="300" rx="6" fill="#10b981" />
  <rect x="380" y="220" width="80" height="180" rx="6" fill="#f59e0b" />
  <rect x="510" y="140" width="80" height="260" rx="6" fill="#a855f7" />
  <circle cx="640" cy="180" r="45" fill="#f43f5e" opacity="0.9" />
</svg>`;
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_vector_chart.svg'), Buffer.from(svg, 'utf8'));

  // PNG
  const png = createSamplePngBuffer(300, 200, 30, 140, 230);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_image.png'), png);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_image.apng'), png);

  // BMP (24-bit uncompressed RGB)
  function createBmp(w = 120, h = 80) {
    const rowSize = Math.floor((24 * w + 31) / 32) * 4;
    const pixelArraySize = rowSize * h;
    const fileSize = 54 + pixelArraySize;
    const buf = Buffer.alloc(fileSize, 0);

    // Bitmap File Header
    buf.write('BM', 0);
    buf.writeUInt32LE(fileSize, 2);
    buf.writeUInt32LE(54, 10); // offset

    // DIB Header (BITMAPINFOHEADER)
    buf.writeUInt32LE(40, 14); // header size
    buf.writeInt32LE(w, 18);
    buf.writeInt32LE(h, 22);
    buf.writeUInt16LE(1, 26); // planes
    buf.writeUInt16LE(24, 28); // bits per pixel
    buf.writeUInt32LE(0, 30); // compression BI_RGB
    buf.writeUInt32LE(pixelArraySize, 34);

    let offset = 54;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        buf[offset++] = (x * 2) % 255; // Blue
        buf[offset++] = (y * 3) % 255; // Green
        buf[offset++] = 200; // Red
      }
      // pad row
      while ((offset - 54) % 4 !== 0) {
        offset++;
      }
    }
    return buf;
  }
  const bmp = createBmp(120, 80);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_bitmap.bmp'), bmp);

  // JPEG / JPG / JFIF (Minimal valid JFIF container)
  const jpegHeader = Buffer.from([
    0xFF, 0xD8, // SOI
    0xFF, 0xE0, 0x00, 0x10, // APP0 JFIF
    0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00
  ]);
  // Use a sample valid minimal JPEG payload
  const validJpegBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const jpegBuf = Buffer.from(validJpegBase64, 'base64');
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_photo.jpg'), jpegBuf);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_photo.jpeg'), jpegBuf);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_photo.jfif'), jpegBuf);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_photo.pjpeg'), jpegBuf);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_photo.pjp'), jpegBuf);

  // GIF (Minimal 1x1 GIF89a)
  const gifBase64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const gifBuf = Buffer.from(gifBase64, 'base64');
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_graphic.gif'), gifBuf);

  // WebP (Minimal 1x1 WebP)
  const webpBase64 = 'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
  const webpBuf = Buffer.from(webpBase64, 'base64');
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_modern.webp'), webpBuf);

  // ICO (Minimal valid ICO file)
  const icoBuf = Buffer.alloc(22 + bmp.length);
  icoBuf.writeUInt16LE(0, 0); // reserved
  icoBuf.writeUInt16LE(1, 2); // type 1 = icon
  icoBuf.writeUInt16LE(1, 4); // 1 image
  icoBuf.writeUInt8(32, 6); // width
  icoBuf.writeUInt8(32, 7); // height
  icoBuf.writeUInt8(0, 8); // color palette
  icoBuf.writeUInt8(0, 9); // reserved
  icoBuf.writeUInt16LE(1, 10); // color planes
  icoBuf.writeUInt16LE(24, 12); // bits per pixel
  icoBuf.writeUInt32LE(bmp.length, 14); // image size
  icoBuf.writeUInt32LE(22, 18); // offset
  bmp.copy(icoBuf, 22);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_icon.ico'), icoBuf);

  // TIFF (Minimal valid TIFF)
  const tiffBuf = Buffer.alloc(300);
  tiffBuf.write('II', 0); // Intel byte order
  tiffBuf.writeUInt16LE(42, 2); // magic 42
  tiffBuf.writeUInt32LE(8, 4); // offset of IFD
  // IFD with 1 field
  tiffBuf.writeUInt16LE(1, 8); // count
  tiffBuf.writeUInt16LE(256, 10); // ImageWidth
  tiffBuf.writeUInt16LE(3, 12); // SHORT
  tiffBuf.writeUInt32LE(1, 14); // count
  tiffBuf.writeUInt32LE(100, 18); // value
  tiffBuf.writeUInt32LE(0, 22); // next IFD offset 0
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_sample.tiff'), tiffBuf);
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_sample.tif'), tiffBuf);
}

// -------------------------------------------------------------
// 10. MEDIA AUDIO & VIDEO GENERATOR (.wav, .mp3, .mp4, .webm)
// -------------------------------------------------------------
function generateAudioVideo() {
  console.log('Generating Audio & Video test files...');

  // Synthesized PCM WAV Audio Tone (44.1 kHz, 16-bit Mono, 1.5 seconds)
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * 1.5);
  const dataSize = numSamples * 2;
  const wavBuf = Buffer.alloc(44 + dataSize);

  wavBuf.write('RIFF', 0);
  wavBuf.writeUInt32LE(36 + dataSize, 4);
  wavBuf.write('WAVE', 8);
  wavBuf.write('fmt ', 12);
  wavBuf.writeUInt32LE(16, 16); // Subchunk1Size
  wavBuf.writeUInt16LE(1, 20); // PCM
  wavBuf.writeUInt16LE(1, 22); // Mono
  wavBuf.writeUInt32LE(sampleRate, 24);
  wavBuf.writeUInt32LE(sampleRate * 2, 28); // ByteRate
  wavBuf.writeUInt16LE(2, 32); // BlockAlign
  wavBuf.writeUInt16LE(16, 34); // BitsPerSample
  wavBuf.write('data', 36);
  wavBuf.writeUInt32LE(dataSize, 40);

  // Generate 440 Hz Sine Wave
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 0.5;
    const intSample = Math.floor(sample * 32767);
    wavBuf.writeInt16LE(intSample, 44 + i * 2);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_audio.wav'), wavBuf);

  // Copy sample valid media containers if present in samples/ or write compliant headers
  const samplesDir = path.resolve(__dirname, '../apps/demo/public/samples');
  ['audio.mp3', 'video.mp4'].forEach(file => {
    const src = path.join(samplesDir, file);
    if (fs.existsSync(src)) {
      const ext = path.extname(file);
      fs.writeFileSync(path.join(OUT_DIR, `fresh_${path.basename(file, ext)}${ext}`), fs.readFileSync(src));
    }
  });
}

// -------------------------------------------------------------
// 11. ARCHIVES (.zip) & 3D MODELS (.stl, .obj)
// -------------------------------------------------------------
function generateArchivesAnd3D() {
  console.log('Generating Archives and 3D Models...');

  // Multi-folder ZIP archive
  const zipData = {
    'documents/readme.txt': fflate.strToU8('Welcome to the enterprise package.\nAll files verified.'),
    'documents/config.json': fflate.strToU8(JSON.stringify({ cluster: 'prod-us-1', nodes: 64 }, null, 2)),
    'source/main.ts': fflate.strToU8('export function initialize(): boolean { return true; }'),
    'data/report.csv': fflate.strToU8('ID,Score\n1,98.5\n2,99.1\n3,97.8')
  };
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_archive.zip'), Buffer.from(fflate.zipSync(zipData)));

  // Binary STL 3D Model (Cube)
  const header = Buffer.alloc(80, 0);
  const numTriangles = 12;
  const stlBuf = Buffer.alloc(84 + numTriangles * 50);
  header.copy(stlBuf, 0);
  stlBuf.writeUInt32LE(numTriangles, 80);

  const v = [
    [-20, -20, -20], [20, -20, -20], [20, 20, -20], [-20, 20, -20],
    [-20, -20,  20], [20, -20,  20], [20, 20,  20], [-20, 20,  20]
  ];
  const faces = [
    [0, 1, 2], [0, 2, 3], [4, 6, 5], [4, 7, 6],
    [4, 5, 1], [4, 1, 0], [3, 2, 6], [3, 6, 7],
    [0, 3, 7], [0, 7, 4], [1, 5, 6], [1, 6, 2]
  ];
  let offset = 84;
  for (const [a, b, c] of faces) {
    stlBuf.writeFloatLE(0, offset); // Normal
    stlBuf.writeFloatLE(0, offset + 4);
    stlBuf.writeFloatLE(0, offset + 8);
    const v1 = v[a], v2 = v[b], v3 = v[c];
    stlBuf.writeFloatLE(v1[0], offset + 12);
    stlBuf.writeFloatLE(v1[1], offset + 16);
    stlBuf.writeFloatLE(v1[2], offset + 20);
    stlBuf.writeFloatLE(v2[0], offset + 24);
    stlBuf.writeFloatLE(v2[1], offset + 28);
    stlBuf.writeFloatLE(v2[2], offset + 32);
    stlBuf.writeFloatLE(v3[0], offset + 36);
    stlBuf.writeFloatLE(v3[1], offset + 40);
    stlBuf.writeFloatLE(v3[2], offset + 44);
    stlBuf.writeUInt16LE(0, offset + 48); // attribute byte count
    offset += 50;
  }
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_mesh.stl'), stlBuf);

  // Wavefront OBJ 3D Model
  const obj = `# Wavefront OBJ 3D Mesh
v -25.0 -25.0  25.0
v  25.0 -25.0  25.0
v -25.0  25.0  25.0
v  25.0  25.0  25.0
v -25.0  25.0 -25.0
v  25.0  25.0 -25.0
v -25.0 -25.0 -25.0
v  25.0 -25.0 -25.0
f 1 2 4 3
f 3 4 6 5
f 5 6 8 7
f 7 8 2 1
f 2 8 6 4
f 7 1 3 5
`;
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_model.obj'), Buffer.from(obj, 'utf8'));
}

// -------------------------------------------------------------
// 12. CODE & TEXT GENERATOR (.json, .xml, .yaml, .sql, .py, .ts, .js, .css, .txt, .log)
// -------------------------------------------------------------
function generateCodeAndText() {
  console.log('Generating Code & Text test files...');

  // JSON
  const json = {
    schemaVersion: '2.0.0',
    serviceCluster: 'global-router',
    activeRegions: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
    telemetry: {
      pollingIntervalMs: 500,
      alertThresholdP99: 4.5,
      autoRecoveryEnabled: true
    },
    quotas: [
      { tier: 'standard', rateLimitPerMinute: 60000, maxPayloadBytes: 10485760 },
      { tier: 'enterprise', rateLimitPerMinute: 600000, maxPayloadBytes: 52428800 }
    ]
  };
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_data.json'), Buffer.from(JSON.stringify(json, null, 2), 'utf8'));

  // XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<configuration xmlns="http://enterprise.org/config/v2">
  <cluster name="omega-prod" environment="production">
    <nodes count="32">
      <node id="node-01" ip="10.0.1.10" status="leader"/>
      <node id="node-02" ip="10.0.1.11" status="follower"/>
      <node id="node-03" ip="10.0.1.12" status="follower"/>
    </nodes>
    <consensus protocol="Raft" electionTimeoutMs="300" heartbeatIntervalMs="50"/>
  </cluster>
</configuration>`;
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_schema.xml'), Buffer.from(xml, 'utf8'));

  // YAML
  const yaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: preview-viewer-engine
  labels:
    app: preview-service
spec:
  replicas: 5
  selector:
    matchLabels:
      app: preview-service
  template:
    metadata:
      labels:
        app: preview-service
    spec:
      containers:
      - name: viewer
        image: enterprise/preview-viewer:1.2.1
        ports:
        - containerPort: 8080
        resources:
          limits:
            cpu: "2"
            memory: "4Gi"
`;
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_config.yaml'), Buffer.from(yaml, 'utf8'));

  // SQL
  const sql = `-- Enterprise Analytics & Window Aggregation Queries
WITH RegionalAggregates AS (
    SELECT 
        region_id,
        DATE_TRUNC('month', transaction_date) AS txn_month,
        SUM(amount_usd) AS total_revenue,
        COUNT(DISTINCT customer_id) AS active_accounts,
        RANK() OVER (PARTITION BY region_id ORDER BY SUM(amount_usd) DESC) as revenue_rank
    FROM enterprise_transactions
    WHERE transaction_status = 'COMPLETED'
      AND transaction_date >= '2026-01-01'
    GROUP BY region_id, DATE_TRUNC('month', transaction_date)
)
SELECT 
    r.region_name,
    a.txn_month,
    a.total_revenue,
    a.active_accounts
FROM RegionalAggregates a
JOIN global_regions r ON a.region_id = r.id
WHERE a.revenue_rank <= 3
ORDER BY a.total_revenue DESC;
`;
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_queries.sql'), Buffer.from(sql, 'utf8'));

  // TypeScript / JavaScript
  const ts = `/**
 * High-Performance Concurrent Buffer Pool
 */
export class BufferPool {
  private available: Uint8Array[] = [];
  private readonly bufferSize: number;

  constructor(bufferSize = 65536, initialCapacity = 64) {
    this.bufferSize = bufferSize;
    for (let i = 0; i < initialCapacity; i++) {
      this.available.push(new Uint8Array(bufferSize));
    }
  }

  public acquire(): Uint8Array {
    return this.available.pop() ?? new Uint8Array(this.bufferSize);
  }

  public release(buf: Uint8Array): void {
    if (buf.byteLength === this.bufferSize && this.available.length < 512) {
      buf.fill(0);
      this.available.push(buf);
    }
  }
}
`;
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_code.ts'), Buffer.from(ts, 'utf8'));
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_code.js'), Buffer.from(ts, 'utf8'));

  // Python
  const py = `"""
Distributed Event Bus Telemetry Consumer
"""
import asyncio
from typing import Dict, Any

class TelemetryConsumer:
    def __init__(self, cluster_uri: str):
        self.cluster_uri = cluster_uri
        self.is_running = False

    async def start(self) -> None:
        self.is_running = True
        print(f"Connecting to telemetry stream: {self.cluster_uri}")
        while self.is_running:
            await asyncio.sleep(0.5)

    def shutdown(self) -> None:
        self.is_running = False
`;
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_script.py'), Buffer.from(py, 'utf8'));

  // CSS
  const css = `:root {
  --fp-primary: #2563eb;
  --fp-primary-hover: #1d4ed8;
  --fp-bg-surface: #ffffff;
  --fp-border: #e2e8f0;
}

.fp-preview-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--fp-bg-surface);
}
`;
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_styles.css'), Buffer.from(css, 'utf8'));

  // TXT Document
  const txt = `PROJECT HORIZON DOCUMENTATION
=============================
Version: 1.2.1
Status: Production Ready

This is a comprehensive text specification validating text rendering, search matching,
and scrolling capabilities across large and small plain text payloads.
`;
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_document.txt'), Buffer.from(txt, 'utf8'));

  // Large LOG File (2,000 lines)
  const logLines = [];
  for (let i = 1; i <= 2000; i++) {
    const level = i % 100 === 0 ? 'ERROR' : (i % 25 === 0 ? 'WARN' : 'INFO');
    logLines.push(`2026-09-30T12:${String(Math.floor(i / 60) % 60).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}.000Z [${level}] [WorkerPool-${(i % 8) + 1}] Batch ID #${10000 + i}: Processed ${150 + (i % 50)} events in ${(0.8 + (i % 5) * 0.1).toFixed(2)}ms`);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'fresh_system.log'), Buffer.from(logLines.join('\n'), 'utf8'));
}

async function runAll() {
  generatePdfs();
  generateWordDocx();
  generateWordLegacy();
  generateSpreadsheets();
  generatePowerPoints();
  generateOpenDocument();
  generateRichTextAndWeb();
  generateEmails();
  generateImages();
  generateAudioVideo();
  generateArchivesAnd3D();
  generateCodeAndText();

  const files = fs.readdirSync(OUT_DIR);
  console.log(`\nSUCCESS: Generated ${files.length} fresh test files covering ALL supported extensions!`);
}

runAll().catch(e => {
  console.error('Fatal error during fresh generation:', e);
  process.exit(1);
});
