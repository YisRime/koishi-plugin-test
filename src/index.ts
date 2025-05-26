import { Context, Schema, Logger, h } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import { CommandExtractor } from './extract'
import { FileManager, DataService } from './utils'
import { ThemeRenderer, LayoutConfig } from './renderer'
import { ContentManager } from './content'

export const name = 'test'
export const inject = ['puppeteer']
export const logger = new Logger('test')

/**
 * 插件配置接口
 * 定义所有可配置的插件选项
 */
export interface Config {
  /** 命令数据源类型 */
  cmdSource: 'file' | 'inline'
  /** 布局数据源类型 */
  layoutSource: 'file' | 'inline'
  /** 内边距(px) */
  innerPadding: number
  /** 圆角大小(px) */
  borderRadius: number
  /** 背景图片 */
  backgroundImage?: string
  /** 字体链接 */
  fontUrl?: string
  /** 字体大小(px) */
  fontSize: number
  /** 标题字体倍数 */
  titleFontScale: number
  /** 页头 HTML 内容 */
  headerHtml?: string
  /** 页脚 HTML 内容 */
  footerHtml: string
  /** 主色调 */
  primaryColor: string
  /** 副色调 */
  secondaryColor: string
  /** 背景色 */
  backgroundColor: string
  /** 文本色 */
  textColor: string
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    cmdSource: Schema.union([
      Schema.const('file').description('本地配置'),
      Schema.const('inline').description('内存读取'),
    ]).default('file').description('命令数据源'),
    layoutSource: Schema.union([
      Schema.const('file').description('本地配置'),
      Schema.const('inline').description('内存读取'),
    ]).default('file').description('布局数据源'),
  }).description('数据源配置'),

  Schema.object({
    innerPadding: Schema.number().description('内边距(px)').min(8).max(32).default(16),
    borderRadius: Schema.number().description('圆角大小(px)').min(0).max(24).default(12),
  }).description('布局配置'),

  Schema.object({
    backgroundImage: Schema.string().description('背景图片(文件名或URL)'),
  }).description('视觉效果'),

  Schema.object({
    fontUrl: Schema.string().description('字体链接(URL)'),
    fontSize: Schema.number().description('字体大小(px)').min(10).max(20).default(14),
    titleFontScale: Schema.number().description('标题字体倍数').min(1).max(3).step(0.1).default(1.4),
  }).description('字体配置'),

  Schema.object({
    headerHtml: Schema.string().role('textarea').description('页头 HTML 内容'),
    footerHtml: Schema.string().role('textarea').description('页脚 HTML 内容').default('Powered by <strong>Koishi</strong>'),
  }).description('页面内容'),

  Schema.object({
    primaryColor: Schema.string().description('主色调').role('color').default('#8b5cf6'),
    secondaryColor: Schema.string().description('副色调').role('color').default('#38bdf8'),
    backgroundColor: Schema.string().description('背景色').role('color').default('#fefefe'),
    textColor: Schema.string().description('文本色').role('color').default('#64748b'),
  }).description('颜色配置')
])

/**
 * 插件主函数
 * 初始化命令菜单插件并注册相关服务
 * @param ctx - Koishi上下文对象
 * @param config - 插件配置对象
 */
export function apply(ctx: Context, config: Config) {
  const fileManager = new FileManager(ctx.baseDir)
  const renderer = new ThemeRenderer()
  const contentManager = new ContentManager()
  const extractor = new CommandExtractor(ctx)
  const dataService = new DataService(fileManager, extractor, contentManager)

  /**
   * 将HTML内容渲染为图像
   * @param html - 要渲染的HTML字符串
   * @returns Promise<Buffer> 渲染后的图像缓冲区
   */
  const renderMenuToImage = async (html: string): Promise<Buffer> => {
    const page = await ctx.puppeteer.page()
    await page.setContent(html)
    const element = await page.$('.container')
    return await element.screenshot({ type: 'png', omitBackground: true }) as Buffer
  }

  // 注册menu命令
  ctx.command('menu [commandName:string]', '显示指令帮助')
    .action(async ({ session }, commandName) => {
      try {
        const locale = extractor.getUserLocale(session)
        // 并行加载主题配置和命令数据
        const [themeConfig, commandsData] = await Promise.all([
          contentManager.getThemeConfig(config),
          config.cmdSource === 'inline'
            ? (commandName ? extractor.extractRelatedCommands(session, commandName, locale) : extractor.extractInlineCommands(session, locale))
            : dataService.loadCommands(commandName, session, locale)
        ])
        // 获取布局配置
        const layoutConfig = config.layoutSource === 'inline'
          ? await contentManager.generateLayout(commandName, commandsData)
          : await dataService.loadLayout(commandName, commandsData)
        if (!layoutConfig) return commandName ? `找不到命令 ${commandName}` : '无可用命令'
        // 生成HTML并渲染为图像
        const html = renderer.generateHtml(themeConfig, layoutConfig as LayoutConfig)
        const buffer = await renderMenuToImage(html)
        return h.image(buffer, 'image/png')
      } catch (error) {
        logger.error('渲染失败:', error)
        return '渲染菜单时发生错误'
      }
    })
}