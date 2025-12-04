import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, 'baselines', 'legacy-v0');
const targetDir = path.join(projectRoot, 'public', 'legacy');

async function ensureSourceExists() {
  await stat(sourceDir);
}

async function syncLegacyAssets() {
  await ensureSourceExists();
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });
  await cp(sourceDir, targetDir, { recursive: true });
  console.log(`[sync-legacy-assets] Copied ${sourceDir} -> ${targetDir}`);
}

syncLegacyAssets().catch((error) => {
  console.error('[sync-legacy-assets] Failed to sync legacy assets');
  console.error(error);
  process.exit(1);
});

