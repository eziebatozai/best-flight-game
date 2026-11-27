// Merpati Run: Storm Interceptor — make.fun Round 2 hand-in entrypoint (Node 22+, stdlib only).
// Validates the offline 3D combat flight game (game/) and browser-rendered JPEG screenshots
// (screenshots/), copies them cleanly into /output (or MAKEFUN_OUTPUT_DIR), and writes a
// deterministic dossier.json via the unchanged vendored library in vendor/makefun-game.ts.

import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const COMPETITION_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const DOSSIER_BYTE_CEILING = 1572864;
const ALLOWED_SHOT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}\.(jpg|jpeg|png)$/i;

function isHiddenSegment(fullPath: string): boolean {
  return fullPath.split(/[\\/]/).some((segment) => segment.startsWith('.'));
}

function mirrorDirectoryCleanly(sourceDir: string, destinationDir: string): void {
  if (existsSync(destinationDir)) {
    rmSync(destinationDir, { recursive: true, force: true });
  }
  mkdirSync(destinationDir, { recursive: true });
  cpSync(sourceDir, destinationDir, {
    recursive: true,
    filter: (candidatePath) => !isHiddenSegment(candidatePath),
  });
}

function verifyGameTree(gameRoot: string): { entries: number; bytes: number } {
  const entrypoint = join(gameRoot, 'index.html');
  if (!existsSync(entrypoint) || !statSync(entrypoint).isFile()) {
    throw new Error(`Missing game entrypoint file: ${entrypoint}`);
  }

  let entries = 0;
  let bytes = 0;

  function walk(dirPath: string): void {
    const names = readdirSync(dirPath).sort();
    for (const name of names) {
      if (name.startsWith('.')) continue;
      const fullPath = join(dirPath, name);
      const info = lstatSync(fullPath);
      if (info.isSymbolicLink()) {
        throw new Error(`Symlinks are forbidden inside game/: ${fullPath}`);
      }
      const relPath = fullPath.slice(gameRoot.length + 1);
      if (Buffer.byteLength(relPath, 'utf8') > COMPETITION_LIMITS.game_path_max_bytes) {
        throw new Error(`Relative path exceeds ${COMPETITION_LIMITS.game_path_max_bytes} UTF-8 bytes: ${relPath}`);
      }
      entries += 1;
      if (info.isDirectory()) {
        walk(fullPath);
      } else if (info.isFile()) {
        if (relPath === 'index.html' && info.size > 1048576) {
          throw new Error(`game/index.html exceeds 1 MiB cap (${info.size} bytes)`);
        }
        bytes += info.size;
      }
    }
  }

  walk(gameRoot);
  if (entries > COMPETITION_LIMITS.game_max_files) {
    throw new Error(`game/ exceeds entry cap (${entries} > ${COMPETITION_LIMITS.game_max_files})`);
  }
  if (bytes > COMPETITION_LIMITS.game_max_bytes) {
    throw new Error(`game/ exceeds byte cap (${bytes} > ${COMPETITION_LIMITS.game_max_bytes})`);
  }
  return { entries, bytes };
}

function verifyScreenshots(shotsDir: string): string[] {
  if (!existsSync(shotsDir)) {
    throw new Error(`Missing screenshots directory: ${shotsDir}`);
  }
  const files = readdirSync(shotsDir)
    .filter((name) => !name.startsWith('.'))
    .sort();

  if (files.length < 3 || files.length > COMPETITION_LIMITS.screenshots.max) {
    throw new Error(`Expected 3 to 4 screenshots in ${shotsDir}, found ${files.length}`);
  }

  for (const fileName of files) {
    if (!ALLOWED_SHOT_NAME.test(fileName)) {
      throw new Error(`Disallowed screenshot filename: ${fileName}`);
    }
    const shotPath = join(shotsDir, fileName);
    const info = statSync(shotPath);
    if (!info.isFile() || info.size === 0 || info.size > COMPETITION_LIMITS.screenshots.max_bytes) {
      throw new Error(`Screenshot ${fileName} violates size bounds (${info.size} bytes)`);
    }
  }
  return files;
}

function runHandIn(): void {
  const repoDir = dirname(fileURLToPath(import.meta.url));
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  const gameDir = join(repoDir, 'game');
  const shotsDir = join(repoDir, 'screenshots');

  verifyGameTree(gameDir);
  verifyScreenshots(shotsDir);

  mkdirSync(outDir, { recursive: true });
  mirrorDirectoryCleanly(gameDir, join(outDir, 'game'));
  mirrorDirectoryCleanly(shotsDir, join(outDir, 'screenshots'));

  const dossierPayload = buildDossier(outDir, COMPETITION_LIMITS);
  const payloadBytes = Buffer.byteLength(dossierPayload, 'utf8');
  if (payloadBytes > DOSSIER_BYTE_CEILING) {
    throw new Error(`dossier.json exceeds 1.5 MiB competition ceiling (${payloadBytes} bytes)`);
  }

  writeFileSync(join(outDir, 'dossier.json'), dossierPayload);
}

runHandIn();
