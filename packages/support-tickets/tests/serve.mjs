import { createRequire } from 'node:module'
import { resolve } from 'node:path'
const require = createRequire(resolve('src/logistics/package.json'))
const { createServer } = await import(require.resolve('vite'))
const { default: react } = await import(require.resolve('@vitejs/plugin-react'))
const { default: tailwind } = await import(require.resolve('@tailwindcss/vite'))
const server = await createServer({ configFile: false, root: process.cwd(), plugins: [react(), tailwind(), { name: 'ticket-fixture', configureServer(fixtureServer) { fixtureServer.middlewares.use('/support-fixture', async (_request, response) => { response.setHeader('Content-Type', 'text/html'); response.end(await fixtureServer.transformIndexHtml('/support-fixture', '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/packages/support-tickets/tests/fixture.tsx"></script></body></html>')) }) } }], resolve: { alias: { react: resolve('src/logistics/node_modules/react'), 'react-dom': resolve('src/logistics/node_modules/react-dom'), 'react-router-dom': resolve('src/logistics/node_modules/react-router-dom'), 'react-icons': resolve('src/logistics/node_modules/react-icons') } }, server: { watch: { ignored: ['**/dist/**'] }, host: '127.0.0.1', port: 15188, strictPort: true } })

await server.listen()
console.log('Ticket fixture: http://127.0.0.1:15188/support-fixture')
