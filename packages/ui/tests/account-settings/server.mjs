// Start from the repository root; no live backend, external service or dependency install.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const root = process.cwd();
const require = createRequire(resolve(root, 'src/seller/package.json'));
const { createServer } = await import(require.resolve('vite'));
const { default: react } = await import(require.resolve('@vitejs/plugin-react'));
const { default: tailwind } = await import(require.resolve('@tailwindcss/vite'));
const harness = resolve(root, 'packages/ui/tests/account-settings');
const fixture = resolve(harness, 'fixtures.ts');
const uiExports = JSON.parse(readFileSync(resolve(root, 'packages/ui/package.json'), 'utf8')).exports;

const server = await createServer({
  configFile: false,
  root: harness,
  plugins: [
    {
      name: 'account-fixtures',
      enforce: 'pre',
      async resolveId(source, importer) {
        if (source === '@aisley/ui' || source.startsWith('@aisley/ui/')) {
          const key = source === '@aisley/ui' ? '.' : './' + source.slice(11);
          return resolve(root, 'packages/ui', uiExports[key]);
        }
        if (source === './api' && importer?.includes('/src/')) return fixture;
        if (source.endsWith('/auth/useAuth') || [
          '@/components/auth/auth-provider', '@/lib/account/client', '@/lib/api',
        ].includes(source) || /^(\.\.\/)+lib\/(api|password-change)$/.test(source)) return fixture;
        if (source === 'next/navigation') return resolve(harness, 'navigation.ts');
        if (source.startsWith('@/')) {
          return this.resolve(resolve(root, 'src/webapp/src', source.slice(2)), undefined, { skipSelf: true });
        }
      },
    },
    react(),
    tailwind(),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '/src': resolve(root, 'src'),
      react: resolve(root, 'src/seller/node_modules/react'),
      'react-dom': resolve(root, 'src/seller/node_modules/react-dom'),
      'react-router-dom': resolve(root, 'src/seller/node_modules/react-router-dom'),
      'react-icons': resolve(root, 'src/seller/node_modules/react-icons'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: Number(process.env.ACCOUNT_SETTINGS_PORT ?? 15220),
    strictPort: true,
    fs: { allow: [root] },
  },
});
await server.listen();
console.log('Account settings fixture ready');
