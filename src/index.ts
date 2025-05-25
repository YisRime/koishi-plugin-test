import { Context, Schema, Logger, h } from 'koishi'
import { CommandExtractor, CommandData } from './extract'
import { ContentGenerator, LayoutConfig } from './content'
import { FileManager, MenuRender } from './utils'
import { ThemeManager } from './theme'

export const name = 'test'
export const inject = ['puppeteer']
export const logger = new Logger('test')

export interface Config {
  // 数据源配置
  cmdSource: 'file' | 'inline'
  layoutSource: 'file' | 'inline'
  templateSource: 'file' | 'inline'
  // 主题配置
  themePreset: 'light' | 'dark' | 'glass' | 'custom'
  width?: number
  backgroundImage?: string
  roundness?: number
  // 显示配置
  headerText?: string
  footerText?: string
  // 颜色配置
  primaryColor?: string
  backgroundColor?: string
  textColor?: string
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
    templateSource: Schema.union([
      Schema.const('file').description('本地配置'),
      Schema.const('inline').description('内存读取'),
    ]).default('file').description('模板数据源'),
  }).description('数据源配置'),
  Schema.object({
    themePreset: Schema.union([
      Schema.const('light').description('浅色'),
      Schema.const('dark').description('深色'),
      Schema.const('glass').description('毛玻璃'),
      Schema.const('custom').description('自定义'),
    ]).default('light').description('主题预设'),
    width: Schema.number().description('渲染宽度'),
    backgroundImage: Schema.string().description('背景图片URL').role('link'),
    roundness: Schema.number().description('圆角大小(px)').min(0).max(50),
    headerText: Schema.string().description('页头内容'),
    footerText: Schema.string().description('页脚内容').default('Powered by Koishi'),
    primaryColor: Schema.string().description('主色调').role('color'),
    backgroundColor: Schema.string().description('背景色').role('color'),
    textColor: Schema.string().description('文字色').role('color'),
  }).description('主题配置')
])

/**
 * 插件主函数
 * @param ctx Koishi上下下文
 * @param config 配置对象
 */
export function apply(ctx: Context, config: Config) {

  const fileManager = new FileManager(ctx.baseDir)
  const themeManager = new ThemeManager()
  const commandExtractor = new CommandExtractor(ctx)
  const contentGenerator = new ContentGenerator()

  /**
   * 菜单命令
   */
  ctx.command('menu [commandName:string]', '显示指令帮助')
    .action(async ({ session }, commandName) => {
      const userLocale = commandExtractor.getUserLocale(session)
      const [computedTheme, commandsData] = await Promise.all([
        themeManager.getComputedTheme(config),
        commandName ? getCommandData(commandName, session, userLocale) : getMainMenuData(session, userLocale)
      ])
      const layoutKey = commandName || 'main'
      let layoutConfig = config.layoutSource === 'file'
        ? await fileManager.load<LayoutConfig>('layout', layoutKey)
        : null
      if (!layoutConfig) {
        layoutConfig = await contentGenerator.generateLayout(commandName, commandsData)
        if (layoutConfig && config.layoutSource === 'file') await fileManager.save('layout', layoutKey, layoutConfig)
      }
      if (!layoutConfig) return `找不到命令 ${commandName}`
      const menuRender = new MenuRender(ctx, themeManager, computedTheme, fileManager, config.templateSource)
      const imageBuffer = await menuRender.renderToImage(layoutConfig)
      return h.image(imageBuffer, 'image/png')
    })

  /**
   * 获取主菜单数据
   * @param session 会话对象
   * @param userLocale 用户语言环境
   */
  async function getMainMenuData(session: any, userLocale: string): Promise<CommandData[]> {
    if (config.cmdSource === 'inline') return await commandExtractor.extractInlineCommands(session, userLocale)
    let commandsData = await fileManager.load<CommandData[]>('command', 'commands', userLocale)
    if (!commandsData) {
      commandsData = await commandExtractor.extractInlineCommands(session, userLocale)
      await fileManager.save('command', 'commands', commandsData, userLocale)
    }
    return commandsData
  }

  /**
   * 获取单个命令数据
   * @param commandName 命令名称
   * @param session 会话对象
   * @param userLocale 用户语言环境
   */
  async function getCommandData(commandName: string, session: any, userLocale: string): Promise<CommandData[]> {
    if (config.cmdSource === 'inline') return await commandExtractor.extractRelatedCommands(session, commandName, userLocale)
    let commandData = await fileManager.load<CommandData>('command', commandName, userLocale)
    if (!commandData) {
      const allCommands = await fileManager.load<CommandData[]>('command', 'commands', userLocale)
      commandData = allCommands?.find(cmd => cmd.name === commandName) ||
                  allCommands?.flatMap(cmd => cmd.subCommands || []).find(sub => sub.name === commandName)
      if (!commandData) {
        commandData = await commandExtractor.extractSingleCommand(session, commandName, userLocale)
        if (commandData) await fileManager.save('command', commandData.name, commandData, userLocale)
      }
    }
    return commandData ? [commandData] : []
  }
}