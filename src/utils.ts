import { Context } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import { dirname, join } from 'path'
import { promises } from 'fs'
import { ThemeManager, ComputedTheme } from './theme'
import { LayoutConfig, ContentProcessor } from './content'

/**
 * 文件管理器
 */
export class FileManager {
  private readonly dataDirectory: string
  private readonly commandsDirectory: string
  private readonly templatesDirectory: string
  private readonly assetsDirectory: string

  constructor(baseDir: string) {
    this.dataDirectory = join(baseDir, 'data/test')
    this.commandsDirectory = join(this.dataDirectory, 'commands')
    this.templatesDirectory = join(this.dataDirectory, 'templates')
    this.assetsDirectory = join(this.dataDirectory, 'assets')
  }

  /**
   * 获取文件路径
   * @param type 文件类型
   * @param identifier 标识符
   * @param locale 语言环境
   */
  private getFilePath(type: 'command' | 'layout' | 'template' | 'asset', identifier: string, locale?: string): string {
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
      case 'template':
        const extension = identifier.includes('css') ? '.css' : '.html'
        return join(this.templatesDirectory, `${identifier}${extension}`)
      case 'asset':
        return join(this.assetsDirectory, identifier)
    }
  }

  /**
   * 通用保存方法
   * @param type 文件类型
   * @param identifier 标识符
   * @param data 数据
   * @param locale 语言环境
   */
  async save<T>(type: 'command' | 'layout' | 'template' | 'asset', identifier: string, data: T, locale?: string): Promise<boolean> {
    const filePath = this.getFilePath(type, identifier, locale)
    await promises.mkdir(dirname(filePath), { recursive: true })
    const content = (type === 'template' || type === 'asset') ? String(data) : JSON.stringify(data, null, 2)
    await promises.writeFile(filePath, content, 'utf8')
    return true
  }

  /**
   * 通用加载方法
   * @param type 文件类型
   * @param identifier 标识符
   * @param locale 语言环境
   */
  async load<T>(type: 'command' | 'layout' | 'template' | 'asset', identifier: string, locale?: string): Promise<T | null> {
    const filePath = this.getFilePath(type, identifier, locale)
    try {
      const content = await promises.readFile(filePath, 'utf8')
      return (type === 'template' || type === 'asset') ? content as T : JSON.parse(content) as T
    } catch {
      return null
    }
  }

  /**
   * 加载模板文件，不存在时创建默认内容
   * @param templateType 模板类型
   * @param defaultContent 默认内容
   */
  async loadTemplate(templateType: 'css' | 'html', defaultContent: string): Promise<string> {
    const content = await this.load<string>('template', templateType)
    if (content !== null) return content
    await this.save('template', templateType, defaultContent)
    return defaultContent
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
    private readonly computedTheme: ComputedTheme,
    private readonly fileManager: FileManager,
    private readonly templateSource: 'file' | 'inline'
  ) {}

  /**
   * 渲染布局为图片
   * @param layoutConfig 布局配置
   */
  async renderToImage(layoutConfig: LayoutConfig): Promise<Buffer> {
    const htmlContent = await this.generateHtmlContent(layoutConfig)
    const page = await this.ctx.puppeteer.page()
    await page.setContent(htmlContent)
    const containerElement = await page.$('.container')
    return await containerElement.screenshot({ type: 'png', omitBackground: true }) as Buffer
  }

  /**
   * 生成HTML内容
   * @param layoutConfig 布局配置
   */
  private async generateHtmlContent(layoutConfig: LayoutConfig): Promise<string> {
    const [cssContent, htmlTemplate] = await Promise.all([
      this.getTemplate('css'),
      this.getTemplate('html')
    ])
    // 生成头部和底部HTML
    const headerHtml = this.computedTheme.header.show
      ? `<div class="header">${this.contentProcessor.escapeHtml(this.computedTheme.header.text)}</div>`
      : ''
    const footerHtml = this.computedTheme.footer.show
      ? `<div class="footer">${this.contentProcessor.escapeHtml(this.computedTheme.footer.text)}</div>`
      : ''
    // 生成网格项HTML
    const gridHtml = layoutConfig.items.map(item => {
      const gridStyle = `grid-row:${item.row}/span ${item.rowSpan || 1};grid-column:${item.col}/span ${item.colSpan || 1}`
      const itemClass = item.itemType ? ` ${item.itemType}` : ''
      const itemId = item.id ? `id="${item.id}"` : ''
      const iconHtml = item.icon && item.iconType === 'material' ? `<span class="grid-item-icon">${item.icon}</span>` : ''
      const badgeHtml = item.badge ? `<span class="grid-item-badge">${item.badge}</span>` : ''
      const titleHtml = item.title ? `<h3 class="grid-item-title">${this.contentProcessor.escapeHtml(item.title)}</h3>` : ''
      const mainContent = item.type === 'image'
        ? `<img src="${item.content}" style="max-width:100%;border-radius:${this.computedTheme.borderRadius};" />`
        : `<div class="grid-item-content">${this.contentProcessor.escapeHtml(item.content)}</div>`
      return `<div class="grid-item${itemClass}" ${itemId} style="${gridStyle}">
        <div class="grid-item-header">${iconHtml}${badgeHtml}</div>${titleHtml}${mainContent}
      </div>`
    }).join('')
    return htmlTemplate
      .replace('{{CSS_CONTENT}}', cssContent)
      .replace('{{GRID_ROWS}}', layoutConfig.rows.toString())
      .replace('{{GRID_COLS}}', layoutConfig.cols.toString())
      .replace('{{HEADER_CONTENT}}', headerHtml)
      .replace('{{GRID_CONTENT}}', gridHtml)
      .replace('{{FOOTER_CONTENT}}', footerHtml)
  }

  /**
   * 获取模板内容
   * @param templateType 模板类型
   */
  private async getTemplate(templateType: 'css' | 'html'): Promise<string> {
    if (this.templateSource === 'inline') {
      return templateType === 'css'
        ? this.themeManager.generateDefaultCssTemplate(this.computedTheme)
        : this.themeManager.generateDefaultHtmlTemplate()
    }
    const defaultContent = templateType === 'css'
      ? this.themeManager.generateDefaultCssTemplate(this.computedTheme)
      : this.themeManager.generateDefaultHtmlTemplate()
    return await this.fileManager.loadTemplate(templateType, defaultContent)
  }
}