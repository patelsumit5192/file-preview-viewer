const fs = require('fs');
const path = require('path');
const { zipSync } = require('fflate');
const { createCfbf } = require('./cfbf-builder.cjs');

const OUT_DIR = path.resolve(__dirname, '../apps/demo/public/fresh-test-matrix');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// Minimal valid PNG buffer
function createSamplePngBuffer(width = 120, height = 80, r = 37, g = 99, b = 235) {
  const zlib = require('zlib');
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth
  ihdrData.writeUInt8(2, 9); // color type (RGB)
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);

  const ihdrCrc = crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData]));
  const ihdrChunk = Buffer.alloc(4 + 4 + 13 + 4);
  ihdrChunk.writeUInt32BE(13, 0);
  ihdrChunk.write('IHDR', 4);
  ihdrData.copy(ihdrChunk, 8);
  ihdrChunk.writeUInt32BE(ihdrCrc, 21);

  const rawScanlines = [];
  for (let y = 0; y < height; y++) {
    rawScanlines.push(0); // filter: None
    for (let x = 0; x < width; x++) {
      rawScanlines.push(r, g, b);
    }
  }
  const idatCompressed = zlib.deflateSync(Buffer.from(rawScanlines));
  const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), idatCompressed]));
  const idatChunk = Buffer.alloc(4 + 4 + idatCompressed.length + 4);
  idatChunk.writeUInt32BE(idatCompressed.length, 0);
  idatChunk.write('IDAT', 4);
  idatCompressed.copy(idatChunk, 8);
  idatChunk.writeUInt32BE(idatCrc, 8 + idatCompressed.length);

  const iendCrc = crc32(Buffer.from('IEND'));
  const iendChunk = Buffer.alloc(4 + 4 + 4);
  iendChunk.writeUInt32BE(0, 0);
  iendChunk.write('IEND', 4);
  iendChunk.writeUInt32BE(iendCrc, 8);

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function xmlEscape(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// -------------------------------------------------------------
// PPTX BUILDER (Arbitrary slide count, widescreen 16:9, shapes, images, tables)
// -------------------------------------------------------------
function buildPptxDeck(slideDefinitions, filename) {
  const samplePng = createSamplePngBuffer(240, 160, 40, 120, 220);
  const slideCount = slideDefinitions.length;

  const sldIdLst = slideDefinitions.map((_, i) => `<p:sldId id="${256 + i}" r:id="rIdSld${i + 1}"/>`).join('');
  const presRels = slideDefinitions.map((_, i) => `<Relationship Id="rIdSld${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`).join('');

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${slideDefinitions.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('\n  ')}
</Types>`;

  const presentationRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${presRels}
</Relationships>`;

  const presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:sldSz cx="9144000" cy="5143500"/>
  <p:sldIdLst>
    ${sldIdLst}
  </p:sldIdLst>
</p:presentation>`;

  const files = {
    '[Content_Types].xml': Buffer.from(contentTypes, 'utf-8'),
    '_rels/.rels': Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`, 'utf-8'),
    'ppt/presentation.xml': Buffer.from(presentationXml, 'utf-8'),
    'ppt/_rels/presentation.xml.rels': Buffer.from(presentationRels, 'utf-8'),
    'ppt/media/image1.png': samplePng
  };

  slideDefinitions.forEach((sDef, i) => {
    const sIdx = i + 1;
    let slideXml = '';
    const hasImage = sDef.hasImage;

    // Slide relationship mapping
    const slideRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${hasImage ? `<Relationship Id="rIdImg1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.png"/>` : ''}
</Relationships>`;
    files[`ppt/slides/_rels/slide${sIdx}.xml.rels`] = Buffer.from(slideRels, 'utf-8');

    if (sDef.isTable) {
      // Table slide
      slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <!-- Title -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="685800" y="365760"/><a:ext cx="7772400" cy="731520"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/><a:lstStyle/>
          <a:p>
            <a:pPr algn="l"/>
            <a:r><a:rPr sz="2800" b="1"/><a:t>${xmlEscape(sDef.title)}</a:t></a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <!-- Table graphicFrame -->
      <p:graphicFrame>
        <p:nvGraphicFramePr><p:cNvPr id="3" name="Table Grid"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>
        <p:xfrm><a:off x="685800" y="1371600"/><a:ext cx="7772400" cy="2743200"/></p:xfrm>
        <a:graphic>
          <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">
            <a:tbl>
              <a:tblGrid>
                <a:gridCol w="2590800"/>
                <a:gridCol w="2590800"/>
                <a:gridCol w="2590800"/>
              </a:tblGrid>
              <a:tr h="685800">
                <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr b="1"/><a:t>Metric</a:t></a:r></a:p></a:txBody></a:tc>
                <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr b="1"/><a:t>Baseline</a:t></a:r></a:p></a:txBody></a:tc>
                <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:rPr b="1"/><a:t>Target 2026</a:t></a:r></a:p></a:txBody></a:tc>
              </a:tr>
              <a:tr h="685800">
                <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>${xmlEscape(sDef.tableData?.[0] || 'Client Latency')}</a:t></a:r></a:p></a:txBody></a:tc>
                <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>${xmlEscape(sDef.tableData?.[1] || '240 ms')}</a:t></a:r></a:p></a:txBody></a:tc>
                <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>${xmlEscape(sDef.tableData?.[2] || '4.2 ms')}</a:t></a:r></a:p></a:txBody></a:tc>
              </a:tr>
              <a:tr h="685800">
                <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>Cloud Egress</a:t></a:r></a:p></a:txBody></a:tc>
                <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>$128,000 / mo</a:t></a:r></a:p></a:txBody></a:tc>
                <a:tc><a:txBody><a:bodyPr/><a:p><a:r><a:t>$0.00 (Zero)</a:t></a:r></a:p></a:txBody></a:tc>
              </a:tr>
            </a:tbl>
          </a:graphicData>
        </a:graphic>
      </p:graphicFrame>
    </p:spTree>
  </p:cSld>
</p:sld>`;
    } else if (hasImage) {
      // Split Layout: Text on Left, Picture on Right
      slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <!-- Title -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="685800" y="365760"/><a:ext cx="7772400" cy="731520"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/><a:lstStyle/>
          <a:p>
            <a:pPr algn="l"/>
            <a:r><a:rPr sz="2800" b="1"/><a:t>${xmlEscape(sDef.title)}</a:t></a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <!-- Text Description -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Description"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="685800" y="1371600"/><a:ext cx="4343400" cy="3200400"/></a:xfrm>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/><a:lstStyle/>
          <a:p>
            <a:pPr algn="l"/>
            <a:r><a:rPr sz="1800"/><a:t>${xmlEscape(sDef.body)}</a:t></a:r>
          </a:p>
          <a:p>
            <a:pPr algn="l"/>
            <a:r><a:rPr sz="1600" b="1"/><a:t>• Architecture: Zero-copy in-memory rendering</a:t></a:r>
          </a:p>
          <a:p>
            <a:pPr algn="l"/>
            <a:r><a:rPr sz="1600"/><a:t>• Security: Sandboxed client-side processing</a:t></a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <!-- Picture -->
      <p:pic>
        <p:nvPicPr><p:cNvPr id="4" name="Visual Image"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
        <p:blipFill>
          <a:blip r:embed="rIdImg1"/>
          <a:stretch><a:fillRect/></a:stretch>
        </p:blipFill>
        <p:spPr>
          <a:xfrm><a:off x="5257800" y="1371600"/><a:ext cx="3200400" cy="2743200"/></a:xfrm>
        </p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
</p:sld>`;
    } else {
      // Standard Slide: Title, Subtitle, and Content Cards
      slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <!-- Header Banner Shape -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Banner"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="685800" y="365760"/><a:ext cx="7772400" cy="822960"/></a:xfrm>
          <a:solidFill><a:srgbClr val="${sDef.bannerColor || '1e293b'}"/></a:solidFill>
          <a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/><a:lstStyle/>
          <a:p>
            <a:pPr algn="l"/>
            <a:r><a:rPr sz="2400" b="1"><a:solidFill><a:srgbClr val="ffffff"/></a:solidFill></a:rPr><a:t>${xmlEscape(sDef.title)}</a:t></a:r>
          </a:p>
          <a:p>
            <a:pPr algn="l"/>
            <a:r><a:rPr sz="1400"><a:solidFill><a:srgbClr val="94a3b8"/></a:solidFill></a:rPr><a:t>Slide ${sIdx} of ${slideCount} · Enterprise Systems Architecture</a:t></a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <!-- Content Card 1 -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Card 1"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="685800" y="1463040"/><a:ext cx="3703320" cy="3108960"/></a:xfrm>
          <a:solidFill><a:srgbClr val="f8fafc"/></a:solidFill>
          <a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
          <a:ln w="12700"><a:solidFill><a:srgbClr val="e2e8f0"/></a:solidFill></a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/><a:lstStyle/>
          <a:p>
            <a:pPr algn="l"/>
            <a:r><a:rPr sz="1800" b="1"><a:solidFill><a:srgbClr val="0f172a"/></a:solidFill></a:rPr><a:t>Key Capabilities</a:t></a:r>
          </a:p>
          <a:p>
            <a:pPr algn="l"/>
            <a:r><a:rPr sz="1500"><a:solidFill><a:srgbClr val="334155"/></a:solidFill></a:rPr><a:t>${xmlEscape(sDef.body)}</a:t></a:r>
          </a:p>
          <a:p>
            <a:pPr algn="l"/>
            <a:r><a:rPr sz="1400"><a:solidFill><a:srgbClr val="2563eb"/></a:solidFill></a:rPr><a:t>✓ Verification Passed: 100% Client-side</a:t></a:r>
          </a:p>
        </p:txBody>
      </p:sp>
      <!-- Content Card 2 -->
      <p:sp>
        <p:nvSpPr><p:cNvPr id="4" name="Card 2"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="4754880" y="1463040"/><a:ext cx="3703320" cy="3108960"/></a:xfrm>
          <a:solidFill><a:srgbClr val="f8fafc"/></a:solidFill>
          <a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
          <a:ln w="12700"><a:solidFill><a:srgbClr val="e2e8f0"/></a:solidFill></a:ln>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/><a:lstStyle/>
          <a:p>
            <a:pPr algn="l"/>
            <a:r><a:rPr sz="1800" b="1"><a:solidFill><a:srgbClr val="0f172a"/></a:solidFill></a:rPr><a:t>Operational Metrics</a:t></a:r>
          </a:p>
          <a:p>
            <a:pPr algn="l"/>
            <a:r><a:rPr sz="1500"><a:solidFill><a:srgbClr val="334155"/></a:solidFill></a:rPr><a:t>${xmlEscape(sDef.metrics || 'High availability failover with sub-millisecond p99 latency guarantees.')}</a:t></a:r>
          </a:p>
          <a:p>
            <a:pPr algn="l"/>
            <a:r><a:rPr sz="1400"><a:solidFill><a:srgbClr val="16a34a"/></a:solidFill></a:rPr><a:t>✓ Status: Operational & Stable</a:t></a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;
    }

    files[`ppt/slides/slide${sIdx}.xml`] = Buffer.from(slideXml, 'utf-8');
  });

  const zipData = zipSync(files);
  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, Buffer.from(zipData));
  console.log(`Generated PPTX: ${filename} with ${slideCount} slides (${(zipData.length / 1024).toFixed(1)} KB)`);
}

// -------------------------------------------------------------
// PPT BUILDER (Binary CFBF OLE2, RT_Slide 0x03EE, Arbitrary slide count)
// -------------------------------------------------------------
function buildPptDeck(slideDefinitions, filename) {
  const records = [];

  // UserEditAtom
  const userEdit = Buffer.alloc(36);
  userEdit.writeUInt16LE(0, 0); // ver/inst
  userEdit.writeUInt16LE(0x0FF5, 2); // recType: UserEditAtom
  userEdit.writeUInt32LE(28, 4); // recLen: 28
  userEdit.writeUInt32LE(256, 8); // lastSlideIdRef
  records.push(userEdit);

  slideDefinitions.forEach((sDef, i) => {
    const sIdx = i + 1;
    const titleBytes = Buffer.from(sDef.title, 'utf-16le');
    const bodyBytes = Buffer.from(sDef.body, 'utf-16le');

    // Title TextHeaderAtom + TextCharsAtom
    const tHeader = Buffer.alloc(12);
    tHeader.writeUInt16LE(0, 0);
    tHeader.writeUInt16LE(0x0F9F, 2);
    tHeader.writeUInt32LE(4, 4);
    tHeader.writeUInt32LE(0, 8); // Type 0: Title

    const tChars = Buffer.alloc(8 + titleBytes.length);
    tChars.writeUInt16LE(0, 0);
    tChars.writeUInt16LE(0x0FA0, 2);
    tChars.writeUInt32LE(titleBytes.length, 4);
    titleBytes.copy(tChars, 8);

    // Body TextHeaderAtom + TextCharsAtom
    const bHeader = Buffer.alloc(12);
    bHeader.writeUInt16LE(0, 0);
    bHeader.writeUInt16LE(0x0F9F, 2);
    bHeader.writeUInt32LE(4, 4);
    bHeader.writeUInt32LE(1, 8); // Type 1: Body

    const bChars = Buffer.alloc(8 + bodyBytes.length);
    bChars.writeUInt16LE(0, 0);
    bChars.writeUInt16LE(0x0FA0, 2);
    bChars.writeUInt32LE(bodyBytes.length, 4);
    bodyBytes.copy(bChars, 8);

    const slideContent = Buffer.concat([tHeader, tChars, bHeader, bChars]);

    // SlideContainer (0x03EE)
    const slideContainer = Buffer.alloc(8 + slideContent.length);
    slideContainer.writeUInt16LE(0x000F, 0); // ver=15 (Container)
    slideContainer.writeUInt16LE(0x03EE, 2); // recType: SlideContainer
    slideContainer.writeUInt32LE(slideContent.length, 4);
    slideContent.copy(slideContainer, 8);

    records.push(slideContainer);
  });

  const pptStreamData = Buffer.concat(records);
  const cfbfData = createCfbf([
    { name: 'PowerPoint Document', data: pptStreamData }
  ]);

  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, cfbfData);
  console.log(`Generated Legacy PPT: ${filename} with ${slideDefinitions.length} slides (${(cfbfData.length / 1024).toFixed(1)} KB)`);
}

// -------------------------------------------------------------
// GENERATE THE TEST DECKS (18 and 36 slides each!)
// -------------------------------------------------------------
const topics = [
  'Enterprise Architecture & Scalability',
  'Universal Client-Side File Rendering',
  'Low-Latency Binary Stream Parsing',
  'Zero-Cloud Egress Security Paradigm',
  'Decentralized Consensus Protocol',
  'Distributed Event Streaming Topology',
  'Fault-Tolerant High-Availability Clusters',
  'High-Throughput IO Virtualization',
  'Vector Math & Graphic Acceleration',
  'Real-Time Telemetry & Monitoring Matrix',
  'Cryptographic Integrity & SHA-256 Assurance',
  'Cross-Platform Web Worker Orchestration',
  'Multi-Tenant Memory Isolation Bounds',
  'Microsecond P99 SLA Enforcement',
  'Dynamic Resource Allocation & Caching',
  'Immutable Ledger Audit Sequences',
  'Adaptive Content Layout & Responsive Zoom',
  'Next-Gen Product Roadmap & Milestone Horizon'
];

// Generate 18-slide definitions
const deck18 = topics.map((t, idx) => ({
  title: `${idx + 1}. ${t}`,
  body: `Comprehensive engineering validation of ${t.toLowerCase()} under enterprise load conditions.`,
  isTable: idx === 5 || idx === 11,
  hasImage: idx === 2 || idx === 8 || idx === 14,
  bannerColor: idx % 3 === 0 ? '1e293b' : (idx % 3 === 1 ? '1e40af' : '0f766e')
}));

// Generate 36-slide definitions
const deck36 = [];
for (let i = 0; i < 36; i++) {
  const topicBase = topics[i % topics.length];
  const part = i < 18 ? 'Part I - Strategic Foundation' : 'Part II - Execution & Telemetry';
  deck36.push({
    title: `Slide ${i + 1}: ${topicBase}`,
    body: `${part}: Verified client-side rendering with zero dependency on cloud conversion servers.`,
    isTable: i % 7 === 0,
    hasImage: i % 5 === 0,
    bannerColor: i % 4 === 0 ? '1e293b' : (i % 4 === 1 ? '1e40af' : (i % 4 === 2 ? '0f766e' : '701a75'))
  });
}

console.log('Generating PowerPoint Test Matrix...');
buildPptxDeck(deck18, 'fresh_deck_18_slides.pptx');
buildPptxDeck(deck36, 'fresh_deck_36_slides.pptx');
buildPptDeck(deck18, 'fresh_deck_18_slides.ppt');
buildPptDeck(deck36, 'fresh_deck_36_slides.ppt');
console.log('Finished generating PowerPoint test matrix!');
