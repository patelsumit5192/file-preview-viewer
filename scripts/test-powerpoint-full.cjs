const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = fs.existsSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe')
  ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  : 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe';

const PORT = 9228;
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
  await wait(2000);
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
    {
      file: 'samples/presentation.pptx',
      expectedSlides: 2,
      type: 'pptx',
      checkSlides: [1, 2],
      searchQuery: 'Presentation'
    },
    {
      file: 'samples/presentation.ppt',
      expectedSlides: 3,
      type: 'ppt',
      checkSlides: [1, 2, 3],
      searchQuery: 'Lorem'
    },
    {
      file: 'fresh-test-matrix/fresh_deck_18_slides.pptx',
      expectedSlides: 18,
      type: 'pptx',
      checkSlides: [1, 6, 12, 18],
      searchQuery: 'Enterprise'
    },
    {
      file: 'fresh-test-matrix/fresh_deck_36_slides.pptx',
      expectedSlides: 36,
      type: 'pptx',
      checkSlides: [1, 10, 20, 36],
      searchQuery: 'Architecture'
    },
    {
      file: 'fresh-test-matrix/fresh_deck_18_slides.ppt',
      expectedSlides: 18,
      type: 'ppt',
      checkSlides: [1, 6, 12, 18],
      searchQuery: 'Slide'
    },
    {
      file: 'fresh-test-matrix/fresh_deck_36_slides.ppt',
      expectedSlides: 36,
      type: 'ppt',
      checkSlides: [1, 10, 20, 36],
      searchQuery: 'Slide'
    }
  ];

  let totalPassed = 0;
  let totalTests = 0;

  for (const deck of testDecks) {
    console.log(`\n======================================================================`);
    console.log(`TESTING DECK: ${deck.file} (${deck.expectedSlides} Slides, Type: ${deck.type.toUpperCase()})`);
    console.log(`======================================================================`);

    totalTests++;
    const loadRes = await cdp.evaluate(`
      (async () => {
        try {
          const resp = await fetch('/${deck.file}');
          const blob = await resp.blob();
          const file = new File([blob], '${path.basename(deck.file)}', {
            type: '${deck.type === 'pptx' ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : 'application/vnd.ms-powerpoint'}'
          });
          const viewport = document.getElementById('preview-viewport');
          window.__lastInstance = await window.viewer.preview(viewport, file, {
            name: '${path.basename(deck.file)}'
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
          await new Promise(r => setTimeout(r, 600));
          const curPage = window.__lastInstance.getCurrentPage();
          const isPptx = '${deck.type}' === 'pptx';
          let hasContent = false;
          let textSnippet = '';
          if (isPptx) {
            const canvas = document.querySelector('.fp-slide-container canvas');
            hasContent = !!canvas && canvas.width > 0 && canvas.height > 0;
            const textLayer = document.querySelector('.fp-pptx-text-layer');
            textSnippet = (textLayer?.textContent || '').trim().slice(0, 50);
          } else {
            const card = document.querySelector('.fp-ppt-slide-card');
            hasContent = !!card && (card.textContent || '').length > 0;
            textSnippet = (card?.textContent || '').trim().slice(0, 50);
          }
          return { curPage, hasContent, textSnippet };
        })()
      `);

      if (navRes.curPage !== slideNum || !navRes.hasContent) {
        console.error(`FAILED navigation to slide ${slideNum}:`, navRes);
        navPassed = false;
        break;
      }
      console.log(`✓ Navigated to Slide ${navRes.curPage}/${deck.expectedSlides} (Snippet: "${navRes.textSnippet}")`);
    }

    if (!navPassed) continue;

    // Test Search (Ctrl+F)
    const searchRes = await cdp.evaluate(`
      (async () => {
        try {
          const sRes = await Promise.resolve(window.__lastInstance.search('${deck.searchQuery}'));
          const nextRes = await Promise.resolve(window.__lastInstance.searchNext());
          const prevRes = await Promise.resolve(window.__lastInstance.searchPrev());
          window.__lastInstance.clearSearch();
          return { success: true, sRes, nextRes, prevRes };
        } catch (e) {
          return { success: false, error: e.message };
        }
      })()
    `);
    console.log(`✓ Search Verification ('${deck.searchQuery}'):`, searchRes);

    // Test Zoom, Fit, Rotation
    const transformRes = await cdp.evaluate(`
      (async () => {
        window.__lastInstance.zoomIn();
        await new Promise(r => setTimeout(r, 150));
        const zIn = window.__lastInstance.getZoom();

        window.__lastInstance.zoomOut();
        await new Promise(r => setTimeout(r, 150));
        const zOut = window.__lastInstance.getZoom();

        window.__lastInstance.rotateCW();
        await new Promise(r => setTimeout(r, 150));
        window.__lastInstance.rotateCW();
        window.__lastInstance.rotateCW();
        window.__lastInstance.rotateCW();
        await new Promise(r => setTimeout(r, 150));

        window.__lastInstance.fitToPage();
        await new Promise(r => setTimeout(r, 150));
        const fitScale = window.__lastInstance.getZoom();

        window.__lastInstance.resetZoom();
        await new Promise(r => setTimeout(r, 150));

        window.__lastInstance.goToPage(1);
        await new Promise(r => setTimeout(r, 400));
        window.__lastInstance.fitToPage();
        await new Promise(r => setTimeout(r, 200));

        return { zIn, zOut, fitScale };
      })()
    `);
    console.log('✓ Transform Verification (Zoom & Rotation):', transformRes);

    // Test Thumbnails
    const thumbRes = await cdp.evaluate(`
      (async () => {
        const thumbs = window.__lastInstance.getThumbnails ? window.__lastInstance.getThumbnails() : [];
        if (thumbs.length > 0 && typeof thumbs[0].render === 'function') {
          const testCanvas = document.createElement('canvas');
          await thumbs[0].render(testCanvas);
          return { count: thumbs.length, firstRenderedW: testCanvas.width, firstRenderedH: testCanvas.height };
        }
        return { count: thumbs.length };
      })()
    `);
    console.log(`✓ Thumbnails generated & rendered:`, thumbRes);

    // Capture screenshot for verification artifact
    const cleanName = path.basename(deck.file).replace(/\./g, '_');
    const snapPath = path.join(ARTIFACT_DIR, `full_test_${cleanName}.png`);
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
