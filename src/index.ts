import { Context, Schema, Logger, h } from 'koishi'
import { CommandExtractor } from './extract'
import { FileManager, renderMenuToImage } from './utils'
import { ThemeRenderer, LayoutConfig } from './renderer'
import { ContentManager } from './content'

export const name = 'test'
export const inject = ['puppeteer']
export const logger = new Logger('test')

/**
 * 插件配置接口
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
    outerPadding: Schema.number().description('外边距(px)').min(0).max(100).default(20),
    innerPadding: Schema.number().description('内边距(px)').min(0).max(50).default(12),
    itemPadding: Schema.number().description('项目内边距(px)').min(8).max(32).default(16),
    itemSpacing: Schema.number().description('项目间距(px)').min(4).max(24).default(12),
    containerPadding: Schema.number().description('容器内边距(px)').min(12).max(40).default(20),
  }).description('间距配置'),

  Schema.object({
    backgroundImage: Schema.string().description('背景图片(assets目录下文件名或URL)'),
    roundness: Schema.number().description('圆角大小(px)').min(0).max(50).default(12),
    shadowBlur: Schema.number().description('阴影模糊(px)').min(0).max(50).default(8),
    shadowSpread: Schema.number().description('阴影扩散(px)').min(0).max(20).default(2),
    backdropBlur: Schema.number().description('背景模糊(px)').min(0).max(50).default(20),
    enableGlassEffect: Schema.boolean().description('启用毛玻璃效果').default(false),
  }).description('视觉效果'),

  Schema.object({
    fontFamily: Schema.string().description('字体族名称'),
    fontUrl: Schema.string().description('字体文件(assets目录下文件名或URL)'),
    fontSize: Schema.number().description('字体大小(px)').min(10).max(24).default(16),
    titleSize: Schema.number().description('标题倍数').min(1).max(3).step(0.1).default(1.2),
    titleWeight: Schema.string().description('标题字重').default('600'),
    lineHeight: Schema.number().description('行高倍数').min(1).max(3).step(0.1).default(1.5),
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
 * 插件主函数 - 初始化命令菜单插件
 * @param ctx Koishi上下文对象
 * @param config 插件配置对象
 */
export function apply(ctx: Context, config: Config) {
  const fileManager = new FileManager(ctx.baseDir)
  const renderer = new ThemeRenderer()
  const contentManager = new ContentManager()
  const extractor = new CommandExtractor(ctx)

  /**
   * 数据加载服务 - 封装命令和布局数据的加载逻辑
   */
  const dataService = {
    /**
     * 加载命令数据
     * @param commandName 命令名称，为null时加载所有命令
     * @param session 会话对象
     * @param locale 语言环境
     * @returns 命令数据数组
     */
    async loadCommands(commandName: string, session: any, locale: string) {
      const key = commandName || 'commands'
      let data = await fileManager.load<any>('command', key, locale)

      if (!data) {
        if (commandName) {
          const all = await fileManager.load<any[]>('command', 'commands', locale)
          data = all?.find(c => c.name === commandName) || all?.flatMap(c => c.subCommands || []).find(s => s.name === commandName) || await extractor.extractSingleCommand(session, commandName, locale)
          if (data) await fileManager.save('command', commandName, data, locale)
        } else {
          data = await extractor.extractInlineCommands(session, locale)
          await fileManager.save('command', 'commands', data, locale)
        }
      }
      return Array.isArray(data) ? data : data ? [data] : []
    },

    /**
     * 加载布局数据
     * @param commandName 命令名称，为null时加载主布局
     * @param commandsData 命令数据数组
     * @returns 布局配置对象
     */
    async loadLayout(commandName: string, commandsData: any[]) {
      const key = commandName || 'main'
      let layout = await fileManager.load('layout', key)
      if (!layout) {
        layout = await contentManager.generateLayout(commandName, commandsData)
        if (layout) await fileManager.save('layout', key, layout)
      }
      return layout
    }
  }

  /**
   * 渲染服务 - 处理完整的渲染流程
   */
  const renderService = {
    /**
     * 渲染菜单图像
     * @param commandName 命令名称（可选）
     * @param session 会话对象
     * @returns 渲染结果或错误信息
     */
    async renderMenu(commandName: string, session: any) {
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

        if (!layoutConfig) {
          return commandName ? `找不到命令 ${commandName}` : '无可用命令'
        }

        // 生成HTML并渲染为图像
        const html = renderer.generateHtml(themeConfig, layoutConfig as LayoutConfig)
        const buffer = await renderMenuToImage(ctx, html)
        return h.image(buffer, 'image/png')
      } catch (error) {
        logger.error('渲染失败:', error)
        return '渲染菜单时发生错误'
      }
    }
  }

  // 注册menu命令
  ctx.command('menu [commandName:string]', '显示指令帮助')
    .action(async ({ session }, commandName) => {
      return await renderService.renderMenu(commandName, session)
    })
}