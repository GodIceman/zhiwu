import { readFile, writeFile, access } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const packagePath = resolve(root, 'ios/App/CapApp-SPM/Package.swift')
const generated = await readFile(packagePath, 'utf8')
// Capacitor's Windows generator uses filesystem separators inside Swift string
// literals. Normalize local package paths so this checkout also opens on macOS.
const portable = generated.replace(/path: "([^"]+)"/g, (_, value) => `path: "${value.replaceAll('\\', '/')}"`)
for (const [, path] of portable.matchAll(/path: "([^"]+)"/g)) {
  await access(resolve(dirname(packagePath), path, 'Package.swift'))
}
if (portable !== generated) await writeFile(packagePath, portable)
console.log('iOS Swift package paths verified')
