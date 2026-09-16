import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

await build({
  entryPoints: ['tests/plugin.test.ts'],
  outfile: '.test-build/plugin.test.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  alias: { obsidian: resolve('tests/obsidian.mock.mjs') },
});
const result = spawnSync(process.execPath, ['--test', '.test-build/plugin.test.cjs'], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
