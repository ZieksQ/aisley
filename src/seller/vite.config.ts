import { defineConfig, type Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

function bindPrismLanguageComponents(): Plugin {
  return {
    name: 'bind-prism-language-components',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?', 1)[0]

      if (!/[\\/]prismjs[\\/]components[\\/]prism-[^\\/]+\.js$/.test(cleanId)) {
        return null
      }

      return {
        // Lexical imports these files only for side effects, but each file expects
        // Prism to already exist as a browser global. Bind the module explicitly so
        // Rolldown preserves initialization order in production bundles.
        code: `import Prism from 'prismjs'\n${code}`,
        map: null,
      }
    },
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk' && /(^|[^\w$.])Prism\.languages\b/.test(output.code)) {
          this.error(`Generated chunk ${output.fileName} contains an unbound Prism language registration.`)
        }
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [bindPrismLanguageComponents(), react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/sanctum': 'http://127.0.0.1:8000',
    },
  },
})
