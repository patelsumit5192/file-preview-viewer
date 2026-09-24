import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const fflatePath = require.resolve('fflate', { paths: [path.resolve(__dirname, '../packages/plugins/archive')] });
const { zipSync, strToU8 } = require(fflatePath);

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;

const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const coreProps = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Universal File Preview - Project Specification</dc:title>
  <dc:creator>Sumit Patel</dc:creator>
  <cp:lastModifiedBy>Sumit Patel</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-09-17T12:00:00Z</dcterms:created>
</cp:coreProperties>`;

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        <w:sz w:val="24"/>
        <w:color w:val="1E293B"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="56"/>
      <w:color w:val="1E3A8A"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="36"/>
      <w:color w:val="1E40AF"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:rPr>
      <w:b/>
      <w:sz w:val="28"/>
      <w:color w:val="2563EB"/>
    </w:rPr>
  </w:style>
</w:styles>`;

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Title"/></w:pPr>
      <w:r><w:t>Universal Document Preview Specification</w:t></w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr><w:i/><w:color w:val="64748B"/></w:rPr>
        <w:t>Architecture, Format Support, and Implementation Guide · Version 1.2.1</w:t>
      </w:r>
    </w:p>
    <w:p><w:r><w:t></w:t></w:r></w:p>
    
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>1. Executive Overview</w:t></w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>The file-preview-viewer library provides comprehensive, high-fidelity in-browser document previews for over 50 office, presentation, spreadsheet, and media extensions. All processing executes 100% on the client side with zero external server or cloud conversions.</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>2. Key Features</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:b/><w:color w:val="2563EB"/></w:rPr><w:t>• Zero Cloud Dependency: </w:t></w:r>
      <w:r><w:t>Confidential documents never leave the user's browser, satisfying strict enterprise privacy and GDPR requirements.</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:b/><w:color w:val="2563EB"/></w:rPr><w:t>• 50+ Formats Supported: </w:t></w:r>
      <w:r><w:t>Full support for Word (DOCX, DOC, RTF), Excel (XLSX, XLS, ODS), PowerPoint (PPTX, PPT), OpenDocument (ODT, ODP), PDF, Images, Audio, and Video.</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:b/><w:color w:val="2563EB"/></w:rPr><w:t>• Modern Framework Adapters: </w:t></w:r>
      <w:r><w:t>Native turnkey integration components for React 18/19, Angular 17-19, Vue 3, and Vanilla JavaScript.</w:t></w:r>
    </w:p>

    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>3. Supported Format Matrix</w:t></w:r>
    </w:p>

    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="5000" w:type="pct"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="8" w:space="0" w:color="CBD5E1"/>
          <w:left w:val="single" w:sz="8" w:space="0" w:color="CBD5E1"/>
          <w:bottom w:val="single" w:sz="8" w:space="0" w:color="CBD5E1"/>
          <w:right w:val="single" w:sz="8" w:space="0" w:color="CBD5E1"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Category</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Supported Extensions</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Engine / License</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Word Processing</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>.docx, .docm, .dotx, .dotm, .doc, .dot, .rtf</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>docx-preview / CfbfReader (MIT)</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Spreadsheets</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>.xlsx, .xls, .xlsm, .xlsb, .xltx, .xltm, .ods, .csv, .tsv</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>SheetJS (Apache-2.0)</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Presentations</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>.pptx, .ppsx, .pptm, .ppsm, .potx, .potm, .ppt, .pps, .pot</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>pptx-browser / CfbfReader (MIT)</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>OpenDocument</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>.odt, .odp, .ods, .odg, .odf</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>fflate + DOMParser (MIT)</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Media &amp; Video</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>.mp4, .webm, .mov, .avi, .mkv, .mp3, .wav, .jpg, .png</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>HTML5 Native (Permissive)</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>

    <w:p><w:r><w:t></w:t></w:r></w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>4. Conclusion</w:t></w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>This file demonstrates full compatibility with Microsoft Word 2007-2024 (.docx), LibreOffice Writer, Google Docs, and the open-source file-preview-viewer renderer.</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

const docxZip = zipSync({
  '[Content_Types].xml': strToU8(contentTypes),
  '_rels/.rels': strToU8(rels),
  'docProps/core.xml': strToU8(coreProps),
  'word/_rels/document.xml.rels': strToU8(docRels),
  'word/styles.xml': strToU8(styles),
  'word/document.xml': strToU8(documentXml)
});

const outputPath = path.resolve(__dirname, '../apps/demo/public/samples/document.docx');
fs.writeFileSync(outputPath, Buffer.from(docxZip));
console.log(`Generated clean standard document.docx (${docxZip.length} bytes)`);
