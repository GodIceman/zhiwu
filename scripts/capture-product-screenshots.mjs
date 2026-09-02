import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const baseUrl = process.env.ZHIWU_SCREENSHOT_URL || 'http://127.0.0.1:4173'
const outputDir = path.resolve('docs/images')

await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 1,
  colorScheme: 'light',
  locale: 'zh-CN',
})
const page = await context.newPage()

async function screenshot(name) {
  await page.screenshot({
    path: path.join(outputDir, name),
    animations: 'disabled',
    fullPage: false,
  })
}

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase('zhiwu-db')
      request.onsuccess = () => resolve(undefined)
      request.onerror = () => resolve(undefined)
      request.onblocked = () => resolve(undefined)
    })
  })
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('navigation', { name: '主导航' }).waitFor()

  await screenshot('overview-items.png')

  await page.getByRole('tab', { name: /服务/ }).click()
  await page.waitForTimeout(500)
  await screenshot('overview-services.png')

  await page.getByRole('tab', { name: /物品/ }).click()
  await page.waitForTimeout(350)
  await page.getByTitle('新增物品').click()
  await page.getByRole('dialog', { name: '新增物品' }).waitFor()
  await screenshot('add-item.png')

  await page.getByRole('button', { name: '切换为服务' }).click()
  await page.getByRole('dialog', { name: '新增服务' }).waitFor()
  await screenshot('add-service.png')

  await page.getByTitle('关闭').click()
  await page.waitForTimeout(350)
  await page.getByRole('tab', { name: /服务/ }).click()
  await page.getByRole('button', { name: /AI 助手/ }).first().click()
  await page.getByRole('dialog', { name: '服务详情' }).waitFor()
  await screenshot('service-detail.png')

  await page.getByTitle('关闭').click()
  await page.getByRole('button', { name: '设置' }).click()
  await page.getByRole('button', { name: /深色/ }).click()
  await page.getByRole('button', { name: '总览' }).click()
  await page.waitForTimeout(350)
  await screenshot('dark-mode.png')
} finally {
  await browser.close()
}
