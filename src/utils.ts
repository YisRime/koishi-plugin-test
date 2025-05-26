import { Context } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import { dirname, join } from 'path'
import { promises } from 'fs'

export class FileManager {
  private readonly dataDir: string

  constructor(baseDir: string) {
    this.dataDir = join(baseDir, 'data/test')
  }

  private getPath(type: string, id: string, locale?: string): string {
    const name = locale ? `${id}_${locale}` : id
    const subDir = { asset: 'assets', command: 'commands', layout: 'layouts' }[type] || ''
    const ext = type === 'asset' ? '' : '.json'
    return join(this.dataDir, subDir, `${name.replace(/\./g, '_')}${ext}`)
  }

  getFilePath(type: string, id: string, locale?: string): string {
    return this.getPath(type, id, locale)
  }

  async exists(type: string, id: string, locale?: string): Promise<boolean> {
    try {
      await promises.access(this.getPath(type, id, locale))
      return true
    } catch {
      return false
    }
  }

  async save<T>(type: string, id: string, data: T, locale?: string): Promise<void> {
    const path = this.getPath(type, id, locale)
    await promises.mkdir(dirname(path), { recursive: true })
    await promises.writeFile(path, type === 'asset' ? String(data) : JSON.stringify(data, null, 2), 'utf8')
  }

  async load<T>(type: string, id: string, locale?: string): Promise<T | null> {
    try {
      const content = await promises.readFile(this.getPath(type, id, locale), 'utf8')
      return type === 'asset' ? content as T : JSON.parse(content) as T
    } catch {
      return null
    }
  }
}

export async function renderMenuToImage(ctx: Context, html: string): Promise<Buffer> {
  const page = await ctx.puppeteer.page()
  await page.setContent(html)
  const element = await page.$('.container')
  return await element.screenshot({ type: 'png', omitBackground: true }) as Buffer
}