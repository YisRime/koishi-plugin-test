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
  /** 主题预设 */
  themePreset: 'light' | 'dark' | 'custom'
  /** 外边距(px) */
  outerPadding: number
  /** 内边距(px) */
  innerPadding: number
  /** 项目内边距(px) */
  itemPadding: number
  /** 项目间距(px) */
  itemSpacing: number
  /** 容器内边距(px) */
  containerPadding: number
  /** 背景图片 */
  backgroundImage?: string
  /** 圆角大小(px) */
  roundness: number
  /** 阴影模糊(px) */
  shadowBlur: number
  /** 阴影扩散(px) */
  shadowSpread: number
  /** 背景模糊(px) */
  backdropBlur: number
  /** 启用毛玻璃效果 */
  enableGlassEffect: boolean
  /** 字体族名称 */
  fontFamily?: string
  /** 字体文件URL */
  fontUrl?: string
  /** 字体大小(px) */
  fontSize: number
  /** 标题倍数 */
  titleSize: number
  /** 标题字重 */
  titleWeight: string
  /** 行高倍数 */
  lineHeight: number
  /** 页头内容 */
  headerText?: string
  /** 页脚内容 */
  footerText: string
  /** 主色调 */
  primaryColor?: string
  /** 背景色 */
  backgroundColor?: string
  /** 文字色 */
  textColor?: string
  /** 次要色 */
  secondaryColor?: string
  /** 强调色 */
  accentColor?: string
  /** 表面色 */
  surfaceColor?: string
  /** 次要文字色 */
  textSecondaryColor?: string
  /** 边框色 */
  borderColor?: string
  /** 阴影色 */
  shadowColor?: string
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
    themePreset: Schema.union([
      Schema.const('light').description('浅色'),
      Schema.const('dark').description('深色'),
      Schema.const('custom').description('自定义'),
    ]).default('light').description('主题预设'),
  }).description('主题预设'),

  Schema.object({
    outerPadding: Schema.number().description('外边距(px)').min(0).max(100).default(12),
    innerPadding: Schema.number().description('内边距(px)').min(0).max(50).default(8),
    itemPadding: Schema.number().description('项目内边距(px)').min(8).max(32).default(12),
    itemSpacing: Schema.number().description('项目间距(px)').min(4).max(24).default(8),
    containerPadding: Schema.number().description('容器内边距(px)').min(12).max(40).default(16),
  }).description('间距配置'),

  Schema.object({
    backgroundImage: Schema.string().description('背景图片(assets目录下文件名或URL)'),
    roundness: Schema.number().description('圆角大小(px)').min(0).max(50).default(8),
    shadowBlur: Schema.number().description('阴影模糊(px)').min(0).max(50).default(8),
    shadowSpread: Schema.number().description('阴影扩散(px)').min(0).max(20).default(2),
    backdropBlur: Schema.number().description('背景模糊(px)').min(0).max(50).default(16),
    enableGlassEffect: Schema.boolean().description('启用毛玻璃效果').default(false),
  }).description('视觉效果'),

  Schema.object({
    fontFamily: Schema.string().description('字体族名称').default("'Inter', 'Noto Sans SC', system-ui, sans-serif"),
    fontUrl: Schema.string().description('字体文件(assets目录下文件名或URL)'),
    fontSize: Schema.number().description('字体大小(px)').min(10).max(24).default(13),
    titleSize: Schema.number().description('标题倍数').min(1).max(3).step(0.1).default(1.1),
    titleWeight: Schema.string().description('标题字重').default('600'),
    lineHeight: Schema.number().description('行高倍数').min(1).max(3).step(0.1).default(1.4),
  }).description('字体配置'),

  Schema.object({
    headerText: Schema.string().description('页头内容'),
    footerText: Schema.string().description('页脚内容').default('Powered by Koishi'),
  }).description('页面内容'),

  Schema.object({
    primaryColor: Schema.string().description('主色调').role('color'),
    backgroundColor: Schema.string().description('背景色').role('color'),
    textColor: Schema.string().description('文字色').role('color'),
    secondaryColor: Schema.string().description('次要色').role('color'),
    accentColor: Schema.string().description('强调色').role('color'),
    surfaceColor: Schema.string().description('表面色').role('color'),
    textSecondaryColor: Schema.string().description('次要文字色').role('color'),
    borderColor: Schema.string().description('边框色').role('color'),
    shadowColor: Schema.string().description('阴影色').role('color'),
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
          contentManager.getThemeConfig(config, fileManager),
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