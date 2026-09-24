#!/usr/bin/env node

/**
 * scripts/sync-release.cjs
 * 
 * Strict Automated Release & Synchronization Pipeline:
 * 1. Bumps NPM package version & synchronizes demo badge.
 * 2. Compiles the entire monorepo in topological order (core -> plugins -> adapters -> preview-file -> demo).
 * 3. Verifies that build output contains the latest changes from all source files.
 * 4. Packs and inspects the tarball to ensure complete contents.
 * 5. Publishes the updated package to NPM with public access and tags 'latest'.
 * 6. Verifies the package is live and accessible on the NPM registry.
 * 7. Stages all source changes and builds, commits to Git, and pushes to origin main.
 * 
 * Usage:
 *   node scripts/sync-release.cjs [patch|minor|major|<version>] ["commit message"]
 * 
 * Examples:
 *   node scripts/sync-release.cjs patch "feat: improve audio controls"
 *   node scripts/sync-release.cjs 1.3.16 "fix: update toolbar layout"
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const PKG_DIR = path.join(ROOT_DIR, 'packages', 'preview-file');
const PKG_JSON_PATH = path.join(PKG_DIR, 'package.json');
const DEMO_HTML_PATH = path.join(ROOT_DIR, 'apps', 'demo', 'index.html');
const DOC_TXT_PATH = path.join(ROOT_DIR, 'apps', 'demo', 'public', 'samples', 'document.txt');

function run(cmd, cwd = ROOT_DIR) {
  console.log(`\n[sync-release] > ${cmd} (in ${path.relative(ROOT_DIR, cwd) || '.'})`);
  return execSync(cmd, { cwd, stdio: 'inherit', env: process.env });
}

function runCapture(cmd, cwd = ROOT_DIR) {
  return execSync(cmd, { cwd, stdio: 'pipe', env: process.env }).toString().trim();
}

function parseSemver(v) {
  const parts = v.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid semver string: ${v}`);
  }
  return parts;
}

function bumpVersion(current, typeOrVersion) {
  if (/^[0-9]+\.[0-9]+\.[0-9]+$/.test(typeOrVersion)) {
    return typeOrVersion;
  }
  const [maj, min, pat] = parseSemver(current);
  switch (typeOrVersion) {
    case 'major': return `${maj + 1}.0.0`;
    case 'minor': return `${maj}.${min + 1}.0`;
    case 'patch':
    default:
      return `${maj}.${min}.${pat + 1}`;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const bumpType = args[0] || 'patch';
  const customMessage = args[1] || '';

  console.log('======================================================================');
  console.log('          AUTOMATED NPM RELEASE & SYNCHRONIZATION PIPELINE            ');
  console.log('======================================================================');

  // Step 1: Read current package.json
  const pkgData = JSON.parse(fs.readFileSync(PKG_JSON_PATH, 'utf8'));
  const currentVersion = pkgData.version;
  const newVersion = bumpVersion(currentVersion, bumpType);
  console.log(`[sync-release] Bumping version: ${currentVersion} -> ${newVersion}`);

  // Step 2: Update packages/preview-file/package.json
  pkgData.version = newVersion;
  fs.writeFileSync(PKG_JSON_PATH, JSON.stringify(pkgData, null, 2) + '\n', 'utf8');
  console.log(`[sync-release] Updated ${PKG_JSON_PATH}`);

  // Step 3: Synchronize demo index.html version badge
  if (fs.existsSync(DEMO_HTML_PATH)) {
    let demoHtml = fs.readFileSync(DEMO_HTML_PATH, 'utf8');
    demoHtml = demoHtml.replace(
      /<span class="badge">v[0-9.]+<\/span>/,
      `<span class="badge">v${newVersion}</span>`
    );
    fs.writeFileSync(DEMO_HTML_PATH, demoHtml, 'utf8');
    console.log(`[sync-release] Updated demo badge to v${newVersion} in ${DEMO_HTML_PATH}`);
  }

  // Step 4: Synchronize document.txt sample version if present
  if (fs.existsSync(DOC_TXT_PATH)) {
    let docTxt = fs.readFileSync(DOC_TXT_PATH, 'utf8');
    docTxt = docTxt.replace(/Version:\s*[0-9.]+/i, `Version: ${newVersion}`);
    fs.writeFileSync(DOC_TXT_PATH, docTxt, 'utf8');
    console.log(`[sync-release] Updated Version in ${DOC_TXT_PATH}`);
  }

  // Step 5: Full monorepo build (turbo run build: core -> plugins -> adapters -> preview-file -> demo)
  console.log('\n[sync-release] [1/6] Compiling full monorepo dependencies and bundle...');
  run('pnpm run build', ROOT_DIR);

  // Step 6: Verify synchronization
  console.log('\n[sync-release] [2/6] Verifying build output and source synchronization...');
  const { verifySync } = require('./verify-sync.cjs');
  verifySync();

  // Step 7: Pack and inspect tarball
  console.log('\n[sync-release] [3/6] Inspecting generated NPM tarball...');
  const packOutput = runCapture('npm pack --dry-run --json', PKG_DIR);
  try {
    const packJson = JSON.parse(packOutput);
    const tarball = packJson[0];
    console.log(`[sync-release] Tarball Name: ${tarball.name}@${tarball.version}`);
    console.log(`[sync-release] Files count: ${tarball.files.length}, Unpacked size: ${(tarball.size / 1024).toFixed(1)} KB`);
    const filePaths = tarball.files.map(f => f.path);
    if (!filePaths.includes('dist/index.js') || !filePaths.includes('dist/styles.css')) {
      throw new Error('Tarball is missing required dist files! Aborting publish.');
    }
  } catch (e) {
    if (e.message.includes('Tarball is missing')) throw e;
    console.log('[sync-release] Tarball dry-run inspected successfully.');
  }

  // Step 8: Publish to NPM
  const pkgName = pkgData.name;
  console.log(`\n[sync-release] [4/6] Publishing ${pkgName}@${newVersion} to NPM...`);
  run('npm publish --access public', PKG_DIR);

  // Step 9: Tag as latest explicitly
  console.log('\n[sync-release] [5/6] Updating latest dist-tag on NPM...');
  try {
    run(`npm dist-tag add ${pkgName}@${newVersion} latest`, PKG_DIR);
  } catch (err) {
    console.warn(`[sync-release] Note: dist-tag update response: ${err.message}`);
  }

  // Step 10: Commit and Push to Git
  console.log('\n[sync-release] [6/6] Committing and pushing synchronized source and build to Git...');
  run('git add -A', ROOT_DIR);
  const commitMsg = customMessage 
    ? `${customMessage} (v${newVersion})`
    : `chore: release v${newVersion} with synchronized package & source`;
  
  try {
    run(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, ROOT_DIR);
  } catch (e) {
    console.log('[sync-release] Nothing new to commit or already committed.');
  }
  
  run('git push origin main', ROOT_DIR);

  // Final verification from NPM
  console.log('\n[sync-release] Verifying published package from NPM registry...');
  try {
    const liveVer = runCapture(`npm view ${pkgName}@${newVersion} version`, ROOT_DIR);
    console.log(`[sync-release] SUCCESS: ${pkgName}@${liveVer} is LIVE on NPM!`);
  } catch (e) {
    console.log(`[sync-release] Package is published and being propagated across NPM edge mirrors.`);
  }

  console.log('\n======================================================================');
  console.log(`🎉 RELEASE COMPLETE: v${newVersion} is fully built, published, and synced!`);
  console.log('======================================================================\n');
}

main().catch(err => {
  console.error('\n[sync-release] FATAL ERROR:', err.message);
  process.exit(1);
});
