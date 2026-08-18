/** dsh-elf 构建脚本 — esbuild 打包 Client half 为官方 client.js 格式 */

import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const entry = resolve(ROOT, 'src/client.js');
const outDir = resolve(ROOT, 'dist');
const outRaw = resolve(outDir, '_bundle.js');
const outFinal = resolve(outDir, 'client.js');

mkdirSync(outDir, { recursive: true });

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  jsxImportSource: 'react',
  external: [
    'react',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    '@deepseek-ai/*',
    'clsx',
  ],
  outfile: outRaw,
  sourcemap: 'inline',
});

const bundle = readFileSync(outRaw, 'utf8');

// 运行时约束（与 dsh-prompt-optimizer 同源）：bundle 的 load id 必须等于安装包名 dsh-elf，
// 否则 arrive() 抛出 "bundle loaded without registering <id>"。从 package.json 派生 id，
// 一旦包名（或这段逻辑）漂移就在构建期立刻失败，而不是等运行时才爆。
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
const id = String(pkg.name || '').trim();
if (!/^[a-z0-9][a-z0-9-]*$/i.test(id)) {
  throw new Error(`bundle load id must be a valid package name, got: ${JSON.stringify(pkg.name)}`);
}
const wrapped = `window.__ModuleLoader__.load({
  id: "${id}",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
${bundle}
    return module.exports;
  }
});
`;

writeFileSync(outFinal, wrapped, 'utf8');
rmSync(outRaw, { force: true });

console.log(`✓ Built: ${outFinal} (${(wrapped.length / 1024).toFixed(1)} KB)`);