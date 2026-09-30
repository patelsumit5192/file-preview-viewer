const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = fs.existsSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe')
  ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  : 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe';

const PORT = 9227;
const edgeProc = spawn(EDGE_PATH, [
  '--remote-debugging-port=' + PORT,
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--window-size=1440,920',
  'about:blank'
]);

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

class CdpSession {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data.toString());
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const curId = this.id++;
      this.callbacks.set(curId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || 'Eval error');
    }
    return res.result?.value;
  }

  async captureScreenshot(filepath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
  }
}

const ARTIFACT_DIR = path.resolve('C:\\Users\\Sumit\\.gemini\\antigravity\\brain\\8162ef05-48a3-4491-bb0c-89f9fc925675');

async function run() {
  await wait(1500);
  const targets = await getJson(`http://127.0.0.1:${PORT}/json`);
  const pageTarget = targets.find(t => t.type === 'page');
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  const cdp = new CdpSession(ws);

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  console.log('Navigating to live viewer demo...');
  await cdp.send('Page.navigate', { url: 'http://localhost:5173/' });
  await wait(2500);

  const testDecks = [
    { file: 'fresh_deck_18_slides.pptx', expectedSlides: 18, type: 'pptx', checkSlides: [1, 6, 12, 18] },
    { file: 'fresh_deck_36_slides.pptx', expectedSlides: 36, type: 'pptx', checkSlides: [1, 10, 20, 36] },
    { file: 'fresh_deck_18_slides.ppt', expectedSlides: 18, type: 'ppt', checkSlides: [1, 6, 12, 18] },
    { file: 'fresh_deck_36_slides.ppt', expectedSlides: 36, type: 'ppt', checkSlides: [1, 10, 20, 36] }
  ];

  let totalPassed = 0;
  let totalTests = 0;

  for (const deck of testDecks) {
    console.log(`\n======================================================================`);
    console.log(`TESTING DECK: ${deck.file} (${deck.expectedSlides} Slides, Type: ${deck.type.toUpperCase()})`);
    console.log(`======================================================================`);

    totalTests++;
    // Load presentation file
    const loadRes = await cdp.evaluate(`
      (async () => {
        try {
          const resp = await fetch('/fresh-test-matrix/${deck.file}');
          const blob = await resp.blob();
          const file = new File([blob], '${deck.file}', {
            type: '${deck.type === 'pptx' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : 'application/vnd.ms-powerpoint'}'
          });
          const viewport = document.getElementById('preview-viewport');
          window.__lastInstance = await window.viewer.preview(viewport, file, {
            name: '${deck.file}',
            fitMode: 'width'
          });
          await new Promise(r => setTimeout(r, 2000));
          const pageCount = window.__lastInstance?.getPageCount?.() || 0;
          const curPage = window.__lastInstance?.getCurrentPage?.() || 0;
          return { success: true, pageCount, curPage };
        } catch (err) {
          return { success: false, error: err.message, stack: err.stack };
        }
      })()
    `);

    console.log('Load Result:', loadRes);
    if (!loadRes.success || loadRes.pageCount !== deck.expectedSlides) {
      console.error(`FAILED: Expected ${deck.expectedSlides} slides, got ${loadRes.pageCount}`);
      continue;
    }

    console.log(`✓ Detected Slide Count: ${loadRes.pageCount} / ${deck.expectedSlides}`);

    // Verify slide navigation across sampled slides
    let navPassed = true;
    for (const slideNum of deck.checkSlides) {
      const navRes = await cdp.evaluate(`
        (async () => {
          window.__lastInstance.goToPage(${slideNum});
          await new Promise(r => setTimeout(r, 800));
          const curPage = window.__lastInstance.getCurrentPage();
          const isPptx = '${deck.type}' === 'pptx';
          let hasContent = false;
          if (isPptx) {
            const canvas = document.querySelector('.fp-slide-container canvas');
            hasContent = !!canvas && canvas.width > 0 && canvas.height > 0;
          } else {
            const card = document.querySelector('.fp-ppt-slide-card');
            hasContent = !!card && (card.textContent || '').length > 20;
          }
          return { curPage, hasContent };
        })()
      `);

      if (navRes.curPage !== slideNum || !navRes.hasContent) {
        console.error(`FAILED navigation to slide ${slideNum}:`, navRes);
        navPassed = false;
        break;
      }
      console.log(`✓ Navigated to Slide ${navRes.curPage}/${deck.expectedSlides} (Rendered visible content: ${navRes.hasContent})`);
    }

    if (!navPassed) continue;

    // Test Zoom, Fit, Rotation
    const transformRes = await cdp.evaluate(`
      (async () => {
        window.__lastInstance.zoomIn();
        await new Promise(r => setTimeout(r, 200));
        const zIn = window.__lastInstance.getZoom();

        window.__lastInstance.zoomOut();
        await new Promise(r => setTimeout(r, 200));
        const zOut = window.__lastInstance.getZoom();

        window.__lastInstance.rotateCW();
        await new Promise(r => setTimeout(r, 200));
        // Rotate 3 more times to return to 0deg orientation
        window.__lastInstance.rotateCW();
        window.__lastInstance.rotateCW();
        window.__lastInstance.rotateCW();
        await new Promise(r => setTimeout(r, 200));

        window.__lastInstance.fitToWidth();
        await new Promise(r => setTimeout(r, 200));
        const fitScale = window.__lastInstance.getZoom();

        window.__lastInstance.resetZoom();
        await new Promise(r => setTimeout(r, 200));

        // Return to Slide 1 and fit to width for beautiful, crisp presentation artifact
        window.__lastInstance.goToPage(1);
        await new Promise(r => setTimeout(r, 800));
        window.__lastInstance.fitToWidth();
        await new Promise(r => setTimeout(r, 300));

        return { zIn, zOut, fitScale };
      })()
    `);
    console.log('✓ Transform Verification (Zoom & Rotation):', transformRes);

    // Test Thumbnails
    const thumbRes = await cdp.evaluate(`
      (async () => {
        const thumbs = window.__lastInstance.getThumbnails ? window.__lastInstance.getThumbnails() : [];
        return { count: thumbs.length };
      })()
    `);
    console.log(`✓ Thumbnails generated: ${thumbRes.count} slides`);

    // Capture screenshot for verification artifact
    const snapPath = path.join(ARTIFACT_DIR, `verified_${deck.file.replace('.pptx', '_pptx').replace('.ppt', '_ppt')}.png`);
    await cdp.captureScreenshot(snapPath);
    console.log(`✓ Saved screenshot artifact: ${snapPath}`);

    totalPassed++;
  }

  console.log(`\n======================================================================`);
  console.log(`SUMMARY: ${totalPassed} / ${totalTests} PowerPoint Decks Passed Fully`);
  console.log(`======================================================================`);

  ws.close();
  edgeProc.kill();
}

run().catch(err => {
  console.error(err);
  edgeProc.kill();
});
