import { promises as fs, existsSync } from 'fs'
import { dirname, join } from 'path'
import { Context } from 'koishi'
import { logger } from './index'
import {} from 'koishi-plugin-puppeteer'
import { ThemeConfig, ThemeManager } from './theme'
import { LayoutConfig, ContentProcessor } from './content'

/**
 * 文件管理器
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
    const filePath = this.getFilePath(type, identifier, locale)
    try {
      const dir = dirname(filePath)
      if (!existsSync(dir)) await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
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
   * 确保主题文件存在，如果不存在则创建样本
   * @param themeName 主题名称
   */
  async ensureThemeExists(themeName: string): Promise<boolean> {
    const filePath = this.getFilePath('theme', themeName)
    if (existsSync(filePath)) return true
    const sampleTheme = {
      width: 480,
      style: 'light' as const,
      roundness: 'medium' as const,
      backgroundImage: '',
      backgroundOverlay: 'rgba(0, 0, 0, 0.1)',
      headerShow: true,
      headerLogo: '',
      footerShow: true,
      footerText: 'Custom Theme',
      customColors: {
        primary: '#2563eb',
        background: '#ffffff',
        text: '#1e293b'
      }
    }
    const success = await this.save('theme', themeName, sampleTheme)
    return success
  }
}

/**
 * 菜单渲染器 - 生成HTML并渲染为图片
 */
export class MenuRender {
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
    if (!this.ctx.puppeteer) throw new Error('puppeteer 未启用')
    const htmlContent = this.generateHtmlContent(layoutConfig)
    const page = await this.ctx.puppeteer.page()
    await page.setContent(htmlContent)
    const containerElement = await page.$('.container')
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