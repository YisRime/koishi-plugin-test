import { promises as fs, existsSync } from 'fs'
import { dirname, join } from 'path'
import { logger } from './index'
import { Context } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import { ThemeConfig, ThemeManager } from './theme'
import { LayoutConfig, ContentProcessor } from './content'

/**
 * 文件管理器 - 统一处理文件操作
 */
export class FileManager {
  private readonly dataDirectory: string
  private readonly commandsDirectory: string
  private readonly themesDirectory: string

  constructor(baseDir: string) {
    this.dataDirectory = join(baseDir, 'data/test')
    this.commandsDirectory = join(this.dataDirectory, 'commands')
    this.themesDirectory = join(this.dataDirectory, 'themes')
  }

  /**
   * 获取文件路径
   * @param type 文件类型
   * @param identifier 标识符
   * @param locale 语言环境
   */
  private getFilePath(type: 'command' | 'layout' | 'theme', identifier: string, locale?: string): string {
    switch (type) {
      case 'command':
        if (identifier === 'commands') {
          const fileName = locale ? `commands_${locale}.json` : 'commands.json'
          return join(this.commandsDirectory, fileName)
        }
        const fileName = locale ? `command_${identifier}_${locale}.json` : `command_${identifier}.json`
        return join(this.commandsDirectory, fileName.replace(/\./g, '_'))

      case 'layout':
        const layoutFileName = identifier ? `layout_${identifier.replace(/\./g, '_')}.json` : 'layout_main.json'
        return join(this.dataDirectory, layoutFileName)

      case 'theme':
        return join(this.themesDirectory, `${identifier}.json`)
    }
  }

  /**
   * 通用保存方法
   * @param type 文件类型
   * @param identifier 标识符
   * @param data 数据
   * @param locale 语言环境
   */
  async save<T>(type: 'command' | 'layout' | 'theme', identifier: string, data: T, locale?: string): Promise<boolean> {
    if (!data) return false

    const filePath = this.getFilePath(type, identifier, locale)
    try {
      const dir = dirname(filePath)
      if (!existsSync(dir)) await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
      logger.debug(`保存${type}: ${identifier}${locale ? ` (${locale})` : ''}`)
      return true
    } catch (err) {
      logger.error(`保存失败: ${filePath}`, err)
      return false
    }
  }

  /**
   * 通用加载方法
   * @param type 文件类型
   * @param identifier 标识符
   * @param locale 语言环境
   */
  async load<T>(type: 'command' | 'layout' | 'theme', identifier: string, locale?: string): Promise<T | null> {
    const filePath = this.getFilePath(type, identifier, locale)
    try {
      if (!existsSync(filePath)) return null
      const jsonData = await fs.readFile(filePath, 'utf8')
      return jsonData ? JSON.parse(jsonData) as T : null
    } catch (err) {
      if (err.code !== 'ENOENT') logger.error(`读取失败: ${filePath}`, err)
      return null
    }
  }

  /**
   * 检查文件是否存在
   * @param type 文件类型
   * @param identifier 标识符
   * @param locale 语言环境
   */
  exists(type: 'command' | 'layout' | 'theme', identifier: string, locale?: string): boolean {
    return existsSync(this.getFilePath(type, identifier, locale))
  }
}

/**
 * 菜单渲染器 - 生成HTML并渲染为图片
 */
export class MenuRenderer {
  private readonly contentProcessor = new ContentProcessor()

  constructor(
    private readonly ctx: Context,
    private readonly themeManager: ThemeManager,
    private readonly themeConfig: ThemeConfig
  ) {}

  /**
   * 渲染布局为图片
   * @param layoutConfig 布局配置
   */
  async renderToImage(layoutConfig: LayoutConfig): Promise<Buffer> {
    if (!layoutConfig) throw new Error('布局为空')
    if (!this.ctx.puppeteer) throw new Error('puppeteer 未启用')

    const htmlContent = this.generateHtmlContent(layoutConfig)
    const page = await this.ctx.puppeteer.page()
    await page.setContent(htmlContent)
    const containerElement = await page.$('.container')
    if (!containerElement) throw new Error('容器元素未找到')

    return await containerElement.screenshot({ type: 'png', omitBackground: true }) as Buffer
  }

  /**
   * 生成HTML内容
   * @param layoutConfig 布局配置
   */
  private generateHtmlContent(layoutConfig: LayoutConfig): string {
    const computedTheme = this.themeManager.getComputedTheme(this.themeConfig)
    const cssStyles = this.themeManager.generateCssStyles(computedTheme, layoutConfig)

    const headerHtml = computedTheme.headerShow ? `
      <div class="header">
        ${computedTheme.headerLogo ? `<img src="${computedTheme.headerLogo}" class="header-logo" />` : ''}
      </div>` : ''

    const gridHtml = layoutConfig.items.map(item => {
      const gridStyle = `grid-row:${item.row}/span ${item.rowSpan || 1};grid-column:${item.col}/span ${item.colSpan || 1}`
      const itemClass = item.itemType ? ` ${item.itemType}` : ''
      const itemId = item.id ? `id="${item.id}"` : ''

      const iconHtml = item.icon && item.iconType === 'material' ? `<span class="grid-item-icon">${item.icon}</span>` : ''
      const badgeHtml = item.badge ? `<span class="grid-item-badge">${item.badge}</span>` : ''
      const titleHtml = item.title ? `<h3 class="grid-item-title">${this.contentProcessor.escapeHtml(item.title)}</h3>` : ''

      const mainContent = item.type === 'image'
        ? `<img src="${item.content}" style="max-width:100%;border-radius:${computedTheme.borderRadius};" />`
        : `<div class="grid-item-content">${this.contentProcessor.escapeHtml(item.content)}</div>`

      return `<div class="grid-item${itemClass}" ${itemId} style="${gridStyle}">
        <div class="grid-item-header">${iconHtml}${badgeHtml}</div>${titleHtml}${mainContent}
      </div>`
    }).join('')

    const footerHtml = computedTheme.footerShow ?
      `<div class="footer">${this.contentProcessor.escapeHtml(computedTheme.footerText || '')}</div>` : ''

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${cssStyles}</style></head><body>
      <div class="container">${headerHtml}<div class="grid-container">${gridHtml}</div>${footerHtml}</div>
    </body></html>`
  }
}