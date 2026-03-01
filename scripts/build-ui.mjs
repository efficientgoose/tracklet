import { copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { build } from 'esbuild';

const rootDir = process.cwd();
const srcDir = path.join(rootDir, 'src', 'ui');
const outDir = path.join(rootDir, 'src', 'ui-dist');
const execFileAsync = promisify(execFile);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

await copyFile(path.join(srcDir, 'index.html'), path.join(outDir, 'index.html'));
await copyFile(path.join(srcDir, 'styles.css'), path.join(outDir, 'styles.css'));

await build({
  entryPoints: [path.join(srcDir, 'main.tsx')],
  outfile: path.join(outDir, 'main.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['es2022'],
  minify: true,
  treeShaking: true,
  define: {
    'process.env.NODE_ENV': '"production"'
  }
});

for (const file of ['main.js']) {
  await execFileAsync(process.execPath, ['--check', path.join(outDir, file)]);
}
