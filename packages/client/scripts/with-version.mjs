// Angular equivalent of client-legacy's vite-plugin-version: stamps a fresh
// build hash before `ng build`/`ng serve`, writes public/version.json (polled
// at runtime by VersionCheckService), and injects __BUILD_HASH__ via ng's
// --define flag. Tests use the "dev" fallback baked into angular.json.
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const [subcommand, ...forwardedArgs] = process.argv.slice(2);
if (!subcommand) {
  console.error('Usage: node scripts/with-version.mjs <ng-subcommand> [args...]');
  process.exit(2);
}

const buildHash = Date.now().toString(36);

const versionJsonPath = fileURLToPath(new URL('../public/version.json', import.meta.url));
writeFileSync(versionJsonPath, JSON.stringify({ buildHash }));

const child = spawn(
  'ng',
  [subcommand, ...forwardedArgs, `--define=__BUILD_HASH__="${buildHash}"`],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);
child.on('exit', (code) => process.exit(code ?? 1));
