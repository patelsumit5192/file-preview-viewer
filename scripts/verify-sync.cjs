#!/usr/bin/env node

/**
 * scripts/verify-sync.cjs
 * Validates that build output, versions, and source files are strictly in sync.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const PKG_JSON_PATH = path.join(ROOT_DIR, 'packages', 'preview-file', 'package.json');
const DEMO_HTML_PATH = path.join(ROOT_DIR, 'apps', 'demo', 'index.html');
const DIST_INDEX_PATH = path.join(ROOT_DIR, 'packages', 'preview-file', 'dist', 'index.js');
const DIST_CSS_PATH = path.join(ROOT_DIR, 'packages', 'preview-file', 'dist', 'styles.css');

function verifySync() {
  console.log('[verify-sync] Checking repository and package synchronization...');

  // 1. Check package.json version
  if (!fs.existsSync(PKG_JSON_PATH)) {
    throw new Error(`Missing ${PKG_JSON_PATH}`);
  }
  const pkg = JSON.parse(fs.readFileSync(PKG_JSON_PATH, 'utf8'));
  const version = pkg.version;
  console.log(`[verify-sync] Package: ${pkg.name}@${version}`);

  // 2. Check demo index.html version badge
  if (fs.existsSync(DEMO_HTML_PATH)) {
    const html = fs.readFileSync(DEMO_HTML_PATH, 'utf8');
    const badgeMatch = html.match(/<span class="badge">v([0-9.]+)<\/span>/);
    if (!badgeMatch) {
      console.warn('[verify-sync] Warning: Could not find version badge in demo index.html');
    } else if (badgeMatch[1] !== version) {
      throw new Error(`Version mismatch! package.json has ${version} but demo index.html has v${badgeMatch[1]}`);
    } else {
      console.log(`[verify-sync] Demo badge matches: v${version}`);
    }
  }

  // 3. Check dist output exists
  if (!fs.existsSync(DIST_INDEX_PATH) || !fs.existsSync(DIST_CSS_PATH)) {
    throw new Error(`Build artifacts missing in ${path.dirname(DIST_INDEX_PATH)}. Run build first!`);
  }
  const distStat = fs.statSync(DIST_INDEX_PATH);
  console.log(`[verify-sync] preview-file dist/index.js size: ${(distStat.size / 1024).toFixed(1)} KB (mtime: ${distStat.mtime.toISOString()})`);

  // 4. Check for any source file newer than dist/index.js
  const sourceDirs = [
    path.join(ROOT_DIR, 'packages', 'core', 'src'),
    path.join(ROOT_DIR, 'packages', 'preview-file', 'src')
  ];
  const pluginsDir = path.join(ROOT_DIR, 'packages', 'plugins');
  if (fs.existsSync(pluginsDir)) {
    for (const plugin of fs.readdirSync(pluginsDir)) {
      const srcDir = path.join(pluginsDir, plugin, 'src');
      if (fs.existsSync(srcDir)) sourceDirs.push(srcDir);
    }
  }

  function getLatestMtime(dir) {
    let latest = 0;
    let latestFile = '';
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        const sub = getLatestMtime(full);
        if (sub.latest > latest) {
          latest = sub.latest;
          latestFile = sub.latestFile;
        }
      } else if (ent.isFile() && /\.(ts|tsx|css|js)$/.test(ent.name)) {
        const stat = fs.statSync(full);
        if (stat.mtimeMs > latest) {
          latest = stat.mtimeMs;
          latestFile = full;
        }
      }
    }
    return { latest, latestFile };
  }

  let newestSrcTime = 0;
  let newestSrcFile = '';
  for (const srcDir of sourceDirs) {
    const { latest, latestFile } = getLatestMtime(srcDir);
    if (latest > newestSrcTime) {
      newestSrcTime = latest;
      newestSrcFile = latestFile;
    }
  }

  // Allow 2000ms leeway for filesystem clock variations
  if (newestSrcTime > distStat.mtimeMs + 2000) {
    const relFile = path.relative(ROOT_DIR, newestSrcFile);
    throw new Error(
      `Source code is newer than build output! File "${relFile}" was modified after dist/index.js. You MUST rebuild before publishing.`
    );
  }

  console.log('[verify-sync] Build output is up-to-date with all source code.');
  console.log('[verify-sync] PASS: All synchronization checks verified successfully.');
}

if (require.main === module) {
  try {
    verifySync();
  } catch (err) {
    console.error(`[verify-sync] ERROR: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { verifySync };
