import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, '../apps/demo/public/samples');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function downloadFile(url, destPath) {
  console.log(`Downloading ${url} -> ${destPath}...`);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  console.log(`Saved ${destPath} (${buffer.length} bytes)`);
}

async function generateExcel(destPath) {
  console.log(`Generating Excel file -> ${destPath}...`);
  const ExcelJSModule = await import('../packages/plugins/excel/node_modules/exceljs/dist/exceljs.min.js');
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'preview-file';
  workbook.created = new Date();

  const sheet1 = workbook.addWorksheet('Financial Summary');
  sheet1.columns = [
    { header: 'Month', key: 'month', width: 15 },
    { header: 'Revenue ($)', key: 'revenue', width: 18 },
    { header: 'Expenses ($)', key: 'expenses', width: 18 },
    { header: 'Net Profit ($)', key: 'profit', width: 18 },
    { header: 'Growth Rate', key: 'growth', width: 15 },
    { header: 'Status', key: 'status', width: 15 }
  ];

  sheet1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet1.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' }
  };

  const rows = [
    ['January', 125000, 78000, 47000, '12.5%', 'Exceeded'],
    ['February', 138000, 82000, 56000, '10.4%', 'Exceeded'],
    ['March', 142000, 85000, 57000, '2.9%', 'On Target'],
    ['April', 155000, 89000, 66000, '9.1%', 'Exceeded'],
    ['May', 162000, 91000, 71000, '4.5%', 'On Target'],
    ['June', 178000, 95000, 83000, '9.8%', 'Exceeded']
  ];

  rows.forEach(r => sheet1.addRow(r));

  const sheet2 = workbook.addWorksheet('Department Budgets');
  sheet2.columns = [
    { header: 'Department', key: 'dept', width: 22 },
    { header: 'Headcount', key: 'headcount', width: 14 },
    { header: 'Q1 Allocation', key: 'q1', width: 18 },
    { header: 'Q2 Allocation', key: 'q2', width: 18 },
    { header: 'Manager', key: 'manager', width: 20 }
  ];

  sheet2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet2.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF065F46' }
  };

  const deptRows = [
    ['Engineering', 42, '$420,000', '$450,000', 'Sarah Jenkins'],
    ['Product & Design', 16, '$180,000', '$195,000', 'Alex Rivera'],
    ['Marketing & Sales', 28, '$310,000', '$340,000', 'David Kim'],
    ['Operations & HR', 12, '$120,000', '$125,000', 'Elena Rostova'],
    ['Customer Success', 20, '$190,000', '$205,000', 'Marcus Vance']
  ];

  deptRows.forEach(r => sheet2.addRow(r));

  const buffer = await workbook.xlsx.writeBuffer();
  fs.writeFileSync(destPath, Buffer.from(buffer));
  console.log(`Saved ${destPath} (${buffer.byteLength} bytes)`);
}

async function generateZip(destPath) {
  console.log(`Generating ZIP file -> ${destPath}...`);
  const fflate = await import('../packages/plugins/archive/node_modules/fflate/esm/browser.js');
  
  const files = {
    'README.md': fflate.strToU8('# Project Preview Archive\n\nThis archive contains sample project files demonstrating file-preview-viewer.\n\n## Contents\n- `index.html`: Web interface\n- `styles.css`: Visual themes\n- `package.json`: Dependency manifests\n- `src/app.js`: Application logic\n'),
    'package.json': fflate.strToU8(JSON.stringify({
      name: 'preview-sample-project',
      version: '1.0.0',
      description: 'Sample bundle packaged inside ZIP preview',
      main: 'src/app.js',
      license: 'MIT'
    }, null, 2)),
    'src/app.js': fflate.strToU8('console.log("Welcome to client-side ZIP preview!");\nexport const VERSION = "1.1.6";\n'),
    'src/styles.css': fflate.strToU8(':root { --brand: #3b82f6; }\nbody { font-family: sans-serif; background: #f8fafc; }\n'),
    'config/settings.json': fflate.strToU8(JSON.stringify({
      theme: 'dark',
      features: {
        zoom: true,
        rotate: true,
        thumbnails: true
      }
    }, null, 2))
  };

  const zipped = fflate.zipSync(files);
  fs.writeFileSync(destPath, Buffer.from(zipped));
  console.log(`Saved ${destPath} (${zipped.length} bytes)`);
}

async function main() {
  try {
    // 1. PDF
    await downloadFile(
      'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf',
      path.join(outputDir, 'sample.pdf')
    );

    // 2. DOCX
    await downloadFile(
      'https://calibre-ebook.com/downloads/demos/demo.docx',
      path.join(outputDir, 'document.docx')
    );

    // 3. PPTX
    await downloadFile(
      'https://raw.githubusercontent.com/scanny/python-pptx/master/tests/test_files/test.pptx',
      path.join(outputDir, 'presentation.pptx')
    );

    // 4. XLSX
    await generateExcel(path.join(outputDir, 'financial-report.xlsx'));

    // 5. ZIP
    await generateZip(path.join(outputDir, 'project-files.zip'));

    // 6. Photo JPG
    await downloadFile(
      'https://picsum.photos/800/600',
      path.join(outputDir, 'photo.jpg')
    );

    // 7. Audio MP3
    await downloadFile(
      'https://raw.githubusercontent.com/mdn/webaudio-examples/master/audio-analyser/viper.mp3',
      path.join(outputDir, 'audio.mp3')
    );

    console.log('All sample files successfully generated and saved!');
  } catch (err) {
    console.error('Error generating samples:', err);
    process.exit(1);
  }
}

main();
