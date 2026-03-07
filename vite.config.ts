import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { URL, fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'

// Shim: the dropbox SDK uses require('crypto'), require('util'), require('node-fetch')
// inside its bundled ESM code. Inject a global `require` so those calls work at runtime.
const requireShim = `import { createRequire as __createRequire__ } from 'module';const require = globalThis.require || __createRequire__(import.meta.url);`

const config = defineConfig({
  server: {
    hmr: {
      overlay: false,
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    devtools(),
    nitro({
      rollupConfig: {
        external: [/^@sentry\//, 'uuid', 'msgpackr', 'bullmq'],
        output: { banner: requireShim },
      },
    }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
