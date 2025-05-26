import { Context, Schema, Logger, h } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import { Extract } from './extract'
import { FileStore, DataStore } from './utils'
import { Render, Layout } from './renderer'
import { Content } from './content'

export const name = 'test'
export const inject = ['puppeteer']
export const logger = new Logger('test')

/**
 * 插件配置接口
 * 定义所有可配置的插件选项
 */
export interface Config {
  /** 命令数据源类型 */
  cmdSrc: 'file' | 'inline'
  /** 布局数据源类型 */
  layoutSrc: 'file' | 'inline'
  /** 内边距(px) */
  padding: number
  /** 圆角大小(px) */
  radius: number
  /** 背景图片 */
  background?: string
  /** 字体链接 */
  fontUrl?: string
  /** 字体大小(px) */
  fontSize: number
  /** 标题字体倍数 */
  titleSize: number
  /** 页头 HTML 内容 */
  header?: string
  /** 页脚 HTML 内容 */
  footer: string
  /** 主色调 */
  primary: string
  /** 副色调 */
  secondary: string
  /** 背景色 */
  bgColor: string
  /** 文本色 */
  textColor: string
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    cmdSrc: Schema.union([
      Schema.const('file').description('本地配置'),
      Schema.const('inline').description('内存读取'),
    ]).default('file').description('命令数据源'),
    layoutSrc: Schema.union([
      Schema.const('file').description('本地配置'),
      Schema.const('inline').description('内存读取'),
    ]).default('file').description('布局数据源'),
  }).description('数据源配置'),

  Schema.object({
    padding: Schema.number().description('边距(px)').min(8).max(32).default(16),
    radius: Schema.number().description('圆角(px)').min(0).max(24).default(12),
  }).description('布局配置'),

  Schema.object({
    background: Schema.string().description('背景图片(文件名或URL)'),
  }).description('视觉效果'),

  Schema.object({
    fontUrl: Schema.string().description('字体链接(URL)'),
    fontSize: Schema.number().description('字体大小(px)').min(10).max(20).default(14),
    titleSize: Schema.number().description('标题字体倍数').min(1).max(3).step(0.1).default(1.4),
  }).description('字体配置'),

  Schema.object({
    header: Schema.string().role('textarea').description('页头 HTML 内容'),
    footer: Schema.string().role('textarea').description('页脚 HTML 内容').default('Powered by <strong>Koishi</strong>'),
  }).description('页面内容'),

  Schema.object({
    primary: Schema.string().description('主色调').role('color').default('#8b5cf6'),
    secondary: Schema.string().description('副色调').role('color').default('#38bdf8'),
    bgColor: Schema.string().description('背景色').role('color').default('#fefefe'),
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
  const files = new FileStore(ctx.baseDir)
  const render = new Render()
  const content = new Content()
  const extract = new Extract(ctx)
  const data = new DataStore(files, extract, content)

  /**
   * 渲染HTML为图像
   * @param html - 要渲染的HTML字符串
   * @returns Promise<Buffer> 渲染后的图像缓冲区
   */
  const toImage = async (html: string): Promise<Buffer> => {
    const page = await ctx.puppeteer.page()
    await page.setContent(html)
    const element = await page.$('.container')
    return await element.screenshot({ type: 'png', omitBackground: true }) as Buffer
  }

  // 注册menu命令
  ctx.command('menu [cmdName:string]', '显示指令帮助')
    .action(async ({ session }, cmdName) => {
      try {
        const locale = extract.getLocale(session)
        // 并行加载配置和数据
        const [theme, commands] = await Promise.all([
          content.getTheme(config),
          config.cmdSrc === 'inline'
            ? (cmdName ? extract.getRelated(session, cmdName, locale) : extract.getAll(session, locale))
            : data.getCommands(cmdName, session, locale)
        ])
        // 获取布局
        const layout = config.layoutSrc === 'inline'
          ? await content.createLayout(cmdName, commands)
          : await data.getLayout(cmdName, commands)
        if (!layout) return cmdName ? `找不到命令 ${cmdName}` : '无可用命令'
        // 渲染
        const html = render.buildHtml(theme, layout as Layout)
        const buffer = await toImage(html)
        return h.image(buffer, 'image/png')
      } catch (error) {
        logger.error('渲染失败:', error)
        return '渲染菜单时发生错误'
      }
    })
}