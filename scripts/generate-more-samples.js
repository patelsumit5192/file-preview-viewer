import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const outputDir = path.resolve(__dirname, '../apps/demo/public/samples');

const fflatePath = require.resolve('fflate', { paths: [path.resolve(__dirname, '../packages/plugins/archive')] });
const { zipSync, strToU8 } = require(fflatePath);

const xlsxPath = require.resolve('xlsx', { paths: [path.resolve(__dirname, '../packages/plugins/excel')] });
const XLSX = require(xlsxPath);

// 1. RTF Sample
const rtfContent = `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0\\fnil\\fcharset0 Calibri;}{\\f1\\fnil\\fcharset0 Georgia;}}
{\\colortbl ;\\red30\\green58\\blue138;\\red100\\green116\\blue139;\\red16\\green185\\blue129;}
\\viewkind4\\uc1\\pard\\cf1\\b\\f0\\fs40 Universal File Preview - RTF Document\\cf0\\b0\\fs22\\par
\\cf2\\i Rich Text Format (.rtf) Preview Demo\\cf0\\i0\\par
\\par
\\pard\\sa200\\sl276\\slmult1\\b Key Features Supported in RTF:\\b0\\par
\\pard{\\pntext\\f0\\'B7\\tab}{\\*\\pn\\pnlvlblt\\pnf0\\pnindent0{\\pntxtb\\'B7}}\\fi-360\\li720 Full font family and multi-color palette rendering\\par
{\\pntext\\f0\\'B7\\tab}Bold, italic, underline, strikethrough styling\\par
{\\pntext\\f0\\'B7\\tab}Multiple paragraph alignment options\\par
{\\pntext\\f0\\'B7\\tab}Embedded vector graphics (WMF / EMF)\\par
{\\pntext\\f0\\'B7\\tab}Table structures and borders\\par
\\pard\\par
\\cf3\\b\\fs26 Instant In-Browser Rendering - Zero Plugins Required\\cf0\\b0\\fs22\\par
This document is parsed and rendered entirely on the client side using pure JavaScript and standard Web APIs.
\\par
}`;
fs.writeFileSync(path.join(outputDir, 'document.rtf'), rtfContent, 'utf-8');
console.log('Created document.rtf');

// 2. HTML Sample
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>HTML Preview Demo</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; background: #fafafa; color: #1e293b; }
    .card { background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); max-width: 700px; margin: 0 auto; }
    h1 { color: #2563eb; margin-top: 0; }
    .badge { display: inline-block; background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #e2e8f0; padding: 10px 14px; text-align: left; }
    th { background: #f8fafc; font-weight: 600; }
    .footer { font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">SANDBOXED HTML PREVIEW</span>
    <h1>Interactive HTML Document</h1>
    <p>This is a live rendered HTML document previewed inside a secure, sandboxed container with DOMPurify sanitization.</p>
    
    <table>
      <thead>
        <tr><th>Format</th><th>Status</th><th>Engine</th></tr>
      </thead>
      <tbody>
        <tr><td>HTML / HTM</td><td>Active</td><td>Sandboxed srcdoc</td></tr>
        <tr><td>DOCX / DOCM</td><td>Active</td><td>docx-preview</td></tr>
        <tr><td>XLSX / ODS</td><td>Active</td><td>SheetJS</td></tr>
        <tr><td>PPTX / PPT</td><td>Active</td><td>pptx-browser / CFBF</td></tr>
      </tbody>
    </table>
    
    <div class="footer">
      Rendered safely in-browser with zero external script access.
    </div>
  </div>
</body>
</html>`;
fs.writeFileSync(path.join(outputDir, 'webpage.html'), htmlContent, 'utf-8');
console.log('Created webpage.html');

// 3. OpenDocument Text (.odt) Sample using fflate
const odtManifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;

const odtContentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  office:version="1.2">
  <office:automatic-styles>
    <style:style style:name="Title" style:family="paragraph">
      <style:text-properties fo:font-size="24pt" fo:font-weight="bold" fo:color="#1e3a8a"/>
    </style:style>
    <style:style style:name="SubTitle" style:family="paragraph">
      <style:text-properties fo:font-size="14pt" fo:font-style="italic" fo:color="#64748b"/>
    </style:style>
    <style:style style:name="Highlight" style:family="text">
      <style:text-properties fo:font-weight="bold" fo:color="#2563eb"/>
    </style:style>
  </office:automatic-styles>
  <office:body>
    <office:text>
      <text:h text:style-name="Title" text:outline-level="1">OpenDocument Text (.odt) Preview</text:h>
      <text:p text:style-name="SubTitle">Client-side OASIS OpenDocument renderer</text:p>
      <text:p>This document demonstrates <text:span text:style-name="Highlight">native OpenDocument parsing</text:span> built directly into @files-preview-app/preview-file without any external cloud service.</text:p>
      <text:p>OpenDocument features supported:</text:p>
      <text:list>
        <text:list-item><text:p>Text styles and hierarchy (H1-H6, paragraphs)</text:p></text:list-item>
        <text:list-item><text:p>Bold, italic, and colored spans</text:p></text:list-item>
        <text:list-item><text:p>Unordered and ordered lists</text:p></text:list-item>
        <text:list-item><text:p>Embedded images and tables</text:p></text:list-item>
      </text:list>
      <table:table table:name="SampleTable">
        <table:table-row>
          <table:table-cell><text:p>Standard</text:p></table:table-cell>
          <table:table-cell><text:p>ISO/IEC 26300 (OASIS ODF)</text:p></table:table-cell>
        </table:table-row>
        <table:table-row>
          <table:table-cell><text:p>Compatibility</text:p></table:table-cell>
          <table:table-cell><text:p>LibreOffice, OpenOffice, Google Docs</text:p></table:table-cell>
        </table:table-row>
      </table:table>
    </office:text>
  </office:body>
</office:document-content>`;

const odtZip = zipSync({
  'mimetype': strToU8('application/vnd.oasis.opendocument.text'),
  'META-INF/manifest.xml': strToU8(odtManifest),
  'content.xml': strToU8(odtContentXml)
});
fs.writeFileSync(path.join(outputDir, 'document.odt'), Buffer.from(odtZip));
console.log('Created document.odt');

// 4. OpenDocument Spreadsheet (.ods) using SheetJS
const odsWb = XLSX.utils.book_new();
const odsWsData = [
  ['Category', 'Item', 'Quantity', 'Unit Price ($)', 'Total ($)'],
  ['Hardware', 'High-Res Monitor 4K', 12, 450, 5400],
  ['Hardware', 'Mechanical Keyboard', 25, 120, 3000],
  ['Software', 'IDE Pro Licenses', 50, 200, 10000],
  ['Services', 'Cloud Hosting Annual', 1, 15000, 15000],
  ['Total', '', 88, '', 33400]
];
const odsWs = XLSX.utils.aoa_to_sheet(odsWsData);
XLSX.utils.book_append_sheet(odsWb, odsWs, 'Quarterly Equipment');
const odsBuffer = XLSX.write(odsWb, { bookType: 'ods', type: 'buffer' });
fs.writeFileSync(path.join(outputDir, 'spreadsheet.ods'), odsBuffer);
console.log('Created spreadsheet.ods');
