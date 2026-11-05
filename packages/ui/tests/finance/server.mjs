import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
const root = process.cwd();
const require = createRequire(resolve(root, 'src/seller/package.json'));
const { createServer } = await import(require.resolve('vite'));
const { default: react } = await import(require.resolve('@vitejs/plugin-react'));
const { default: tailwind } = await import(require.resolve('@tailwindcss/vite'));
const harness = resolve(root, 'packages/ui/tests/finance');
const exports = JSON.parse(readFileSync(resolve(root, 'packages/ui/package.json'), 'utf8')).exports;
const server = await createServer({
  configFile: false, root: harness,
  plugins: [{ name: 'finance-fixtures', enforce: 'pre', resolveId(source, importer) {
    if (source === '@aisley/ui' || source.startsWith('@aisley/ui/')) return resolve(root, 'packages/ui', exports[source === '@aisley/ui' ? '.' : './' + source.slice(11)]);
    if (source === '@aisley/finance-ui') return resolve(root, 'packages/finance-ui/src/index.ts');
    if ((source === './api' && importer?.includes('/src/admin/src/lib/')) || source.endsWith('/auth/useAuth') || (/^(\.\.\/)+lib\/api$/.test(source) && importer?.includes('/src/'))) return resolve(harness, 'fixtures.ts');
  } }, react(), tailwind()],
  resolve: { dedupe: ['react', 'react-dom'], alias: { react: resolve(root, 'src/seller/node_modules/react'), 'react-dom': resolve(root, 'src/seller/node_modules/react-dom'), 'react-router-dom': resolve(root, 'src/seller/node_modules/react-router-dom'), 'react-icons': resolve(root, 'src/seller/node_modules/react-icons'), flatpickr: resolve(root, 'src/logistics/node_modules/flatpickr') } },
  server: { host: '127.0.0.1', port: 15224, strictPort: true, fs: { allow: [root] } },
});
await server.listen();
console.log('Finance fixture ready');
