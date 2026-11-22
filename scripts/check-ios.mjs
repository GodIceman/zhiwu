import assert from 'node:assert/strict'
import { readFile, readdir, access } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import plist from 'plist'
import { DOMParser } from '@xmldom/xmldom'

const root = resolve(import.meta.dirname, '..')
const read = (path) => readFile(resolve(root, path), 'utf8')
const app = JSON.parse(await read('package.json'))
const project = await read('ios/App/App.xcodeproj/project.pbxproj')
const info = plist.parse(await read('ios/App/App/Info.plist'))
const privacy = plist.parse(await read('ios/App/App/PrivacyInfo.xcprivacy'))
const config = JSON.parse(await read('ios/App/App/capacitor.config.json'))
const android = await read('android/app/build.gradle')
const build = android.match(/versionCode\s+(\d+)/)?.[1]
assert(build, 'Android build number is missing')
for (const [, value] of project.matchAll(/MARKETING_VERSION = ([^;]+);/g)) assert.equal(value, app.version)
for (const [, value] of project.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)) assert.equal(value, build)
for (const [, value] of project.matchAll(/IPHONEOS_DEPLOYMENT_TARGET = ([^;]+);/g)) assert.equal(value, '16.4')
assert(project.includes('MARKETING_VERSION = '), 'Xcode version is missing')
assert.equal(info.CFBundleDisplayName, '知物')
assert.equal(info.UIViewControllerBasedStatusBarAppearance, true)
assert.equal(privacy.NSPrivacyTracking, false)
assert.deepEqual(privacy.NSPrivacyCollectedDataTypes, [])
assert.equal(config.appId, 'app.zhiwu.mobile')
assert.equal(config.server.hostname, 'zhiwu.app')
assert.equal(config.server.iosScheme, 'capacitor')
assert(!config.server.url, 'Do not package a development server URL')
assert.equal(config.ios.contentInset, 'never')
assert.equal(config.plugins.Keyboard.resize, 'native')

for (const [name, section] of [
  ['ZhiwuViewController.swift', 'Sources'],
  ['ZhiwuNativePlugin.swift', 'Sources'],
  ['PrivacyInfo.xcprivacy', 'Resources'],
]) {
  await access(resolve(root, 'ios/App/App', name))
  const buildPhase = project.match(new RegExp(`/\\* Begin PBX${section}BuildPhase section \\*/([\\s\\S]*?)/\\* End PBX${section}BuildPhase section \\*/`))?.[1]
  assert(buildPhase?.includes(`${name} in ${section}`), `${name} is not in the app target`)
}

for (const name of ['Main', 'LaunchScreen']) {
  const xml = await read(`ios/App/App/Base.lproj/${name}.storyboard`)
  const errors = []
  const document = new DOMParser({ onError: (level, message) => errors.push(`${level}: ${message}`) }).parseFromString(xml, 'text/xml')
  assert.equal(errors.length, 0, `${name} storyboard XML: ${errors.join('; ')}`)
  if (name === 'Main') {
    const controller = document.getElementsByTagName('viewController')[0]
    assert.equal(controller.getAttribute('customClass'), 'ZhiwuViewController')
    assert.equal(controller.getAttribute('customModule'), 'App')
  }
}

const swiftPath = resolve(root, 'ios/App/CapApp-SPM/Package.swift')
const swift = await readFile(swiftPath, 'utf8')
const iosVersion = JSON.parse(await read('node_modules/@capacitor/ios/package.json')).version
assert(swift.includes(`exact: "${iosVersion}"`), 'Swift dependency does not match the installed Capacitor version')
for (const [, path] of swift.matchAll(/path: "([^"]+)"/g)) {
  assert(!path.includes('\\'), 'Windows separators must be normalized before opening in Xcode')
  await access(resolve(dirname(swiftPath), path, 'Package.swift'))
}

const catalog = resolve(root, 'ios/App/App/Assets.xcassets')
for (const dir of await readdir(catalog, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue
  const manifest = JSON.parse(await readFile(join(catalog, dir.name, 'Contents.json'), 'utf8'))
  for (const entry of manifest.images ?? []) {
    if (entry.filename) await access(join(catalog, dir.name, entry.filename))
  }
}
const icon = await readFile(join(catalog, 'AppIcon.appiconset/AppIcon-512@2x.png'))
assert.equal(icon.readUInt32BE(16), 1024)
assert.equal(icon.readUInt32BE(20), 1024)
assert.equal(icon[25], 2, 'App Store icon must be RGB without an alpha channel')

let webFiles = 0
async function compareWebFiles(directory = '') {
  for (const entry of await readdir(resolve(root, 'dist', directory), { withFileTypes: true })) {
    const relative = join(directory, entry.name)
    if (entry.isDirectory()) await compareWebFiles(relative)
    else {
      const built = await readFile(resolve(root, 'dist', relative))
      const packaged = await readFile(resolve(root, 'ios/App/App/public', relative))
      assert(built.equals(packaged), `Stale iOS web asset: ${relative}`)
      webFiles++
    }
  }
}
await compareWebFiles()
console.log(`iOS project preflight passed: version ${app.version} (${build}), ${webFiles} web files verified`)
console.log('Static preflight only. Xcode compilation and iPhone/iPad runtime testing are still required.')
