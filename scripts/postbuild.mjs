/**
 * Postbuild script: copies externalized npm packages into .output/server/node_modules/
 * so that Node.js can resolve them at runtime when they are excluded from the Nitro bundle.
 *
 * pnpm isolates transitive dependencies, so we must resolve each dep from its parent's
 * real directory (not the project root) using a scoped createRequire.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const target = join(root, '.output', 'server', 'node_modules')

// Packages that are externalized in vite.config.ts → nitro rollupConfig.external
const EXTERNAL_PACKAGES = ['bullmq', 'dropbox', 'msgpackr']

/**
 * Resolve a package from a given base directory. In pnpm, transitive deps
 * are only resolvable from the parent package's real (dereferenced) path.
 *
 * Some packages (e.g. msgpackr) have an `exports` map that blocks
 * `require.resolve('pkg/package.json')`.  Fall back to resolving the main
 * entry and walking up to the directory that contains package.json.
 */
function resolvePkg(name, fromDir) {
  const r = createRequire(join(fromDir, '_'))

  // Strategy 1: resolve package.json directly
  try {
    const pkgJson = r.resolve(`${name}/package.json`)
    return dirname(realpathSync(pkgJson))
  } catch {}

  // Strategy 2: resolve main entry, then walk up to find package root
  try {
    const mainEntry = realpathSync(r.resolve(name))
    let dir = dirname(mainEntry)
    while (dir !== dirname(dir)) {
      if (existsSync(join(dir, 'package.json'))) {
        const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
        if (pkg.name === name) return dir
      }
      dir = dirname(dir)
    }
  } catch {}

  return null
}

function copyPkg(name, fromDir, visited = new Set()) {
  if (visited.has(name)) return
  visited.add(name)

  const src = resolvePkg(name, fromDir)
  if (!src) {
    // Skip silently — could be an optional/bundled dep
    return
  }

  const dest = join(target, name)
  if (!existsSync(dest)) {
    console.log(`  ✓ ${name}`)
    mkdirSync(dirname(dest), { recursive: true })
    cpSync(src, dest, { recursive: true, dereference: true })
  }

  // Recurse into this package's own dependencies, resolving from *its* directory
  try {
    const pkg = JSON.parse(readFileSync(join(src, 'package.json'), 'utf8'))
    for (const dep of Object.keys(pkg.dependencies || {})) {
      copyPkg(dep, src, visited)
    }
  } catch {}
}

console.log(
  'Postbuild: copying externalized packages to .output/server/node_modules/',
)
mkdirSync(target, { recursive: true })

const visited = new Set()
for (const pkg of EXTERNAL_PACKAGES) {
  copyPkg(pkg, root, visited)
}

console.log('Postbuild: done')
