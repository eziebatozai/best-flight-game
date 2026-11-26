// Merpati Run — make.fun entry hand-in script (Node 22+, standard library only).
// Copies the static 3D flight game (game/) and browser-rendered screenshots (screenshots/)
// into the competition output directory (/output or MAKEFUN_OUTPUT_DIR) and generates
// dossier.json using the unchanged kit library in vendor/makefun-game.ts.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const DOSSIER_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const MAX_DOSSIER_BYTES = 1572864; // 1.5 MiB competition gate cap

function copyCleanDirectory(srcDir: string, dstDir: string): void {
  if (existsSync(dstDir)) {
    rmSync(dstDir, { recursive: true, force: true });
  }
  mkdirSync(dstDir, { recursive: true });
  cpSync(srcDir, dstDir, {
    recursive: true,
    filter: (src) => !src.split(/[\\/]/).some((seg) => seg.startsWith('.')),
  });
}

function assertValidBundleInputs(gameSrc: string, shotsSrc: string): void {
  const indexHtml = join(gameSrc, 'index.html');
  if (!existsSync(indexHtml) || !statSync(indexHtml).isFile()) {
    throw new Error(`Missing required game entrypoint: ${indexHtml}`);
  }
  if (!existsSync(shotsSrc)) {
    throw new Error(`Missing required screenshots directory: ${shotsSrc}`);
  }
  const shots = readdirSync(shotsSrc)
    .filter((name) => !name.startsWith('.'))
    .sort();
  if (shots.length < 3 || shots.length > 4) {
    throw new Error(`Expected 3 to 4 screenshots in ${shotsSrc}, found ${shots.length}`);
  }
  for (const name of shots) {
    const filePath = join(shotsSrc, name);
    const st = statSync(filePath);
    if (!st.isFile() || st.size === 0 || st.size > DOSSIER_LIMITS.screenshots.max_bytes) {
      throw new Error(`Invalid screenshot ${name}: size=${st.size} bytes`);
    }
  }
}

function main(): void {
  const repoRoot = dirname(fileURLToPath(import.meta.url));
  const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

  const gameSrc = join(repoRoot, 'game');
  const shotsSrc = join(repoRoot, 'screenshots');
  assertValidBundleInputs(gameSrc, shotsSrc);

  mkdirSync(outputDir, { recursive: true });
  copyCleanDirectory(gameSrc, join(outputDir, 'game'));
  copyCleanDirectory(shotsSrc, join(outputDir, 'screenshots'));

  const dossierJson = buildDossier(outputDir, DOSSIER_LIMITS);
  const dossierBytes = Buffer.byteLength(dossierJson, 'utf8');
  if (dossierBytes > MAX_DOSSIER_BYTES) {
    throw new Error(`Generated dossier.json exceeds 1.5 MiB cap (${dossierBytes} bytes)`);
  }
  writeFileSync(join(outputDir, 'dossier.json'), dossierJson);
}

main();
