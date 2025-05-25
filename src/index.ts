import { Context, Schema, Logger, h } from 'koishi'
import { CommandExtractor, CommandData } from './extract'
import { ContentGenerator, LayoutConfig } from './content'
import { FileManager, MenuRender } from './utils'
import { ThemeManager } from './theme'

export const name = 'test'
export const inject = ['puppeteer']
export const logger = new Logger('test')

export interface Config {
  theme: string
  cmdSource: 'file' | 'inline'
  layoutSource: 'file' | 'inline'
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    theme: Schema.string().description('主题名称（light/dark/glass/custom）').default('light').required(),
    cmdSource: Schema.union([
      Schema.const('file').description('文件'),
      Schema.const('inline').description('内存'),
    ]).default('inline').description('命令数据源'),
    layoutSource: Schema.union([
      Schema.const('file').description('文件'),
      Schema.const('inline').description('内存'),
    ]).default('file').description('布局数据源'),
  }).description('渲染配置')
])

/**
 * 插件主函数
 * @param ctx Koishi上下下文
 * @param config 配置对象
 */
export function apply(ctx: Context, config: Config) {

  const fileManager = new FileManager(ctx.baseDir)
  const themeManager = new ThemeManager(ctx.baseDir)
  const commandExtractor = new CommandExtractor(ctx)
  const contentGenerator = new ContentGenerator()

  /**
   * 菜单命令
   */
  ctx.command('menu [commandName:string]', '显示指令帮助')
    .action(async ({ session }, commandName) => {
      try {
        const userLocale = commandExtractor.getUserLocale(session)
        const [activeTheme, commandsData] = await Promise.all([
          themeManager.loadTheme(config.theme),
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
        const menuRender = new MenuRender(ctx, themeManager, activeTheme)
        const imageBuffer = await menuRender.renderToImage(layoutConfig)
        return h.image(imageBuffer, 'image/png')
      } catch (err) {
        return `生成失败: ${err.message}`
      }
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
      if (allCommands) commandData = allCommands.find(cmd => cmd.name === commandName) || allCommands.flatMap(cmd => cmd.subCommands || []).find(sub => sub.name === commandName)
      if (!commandData) {
        commandData = await commandExtractor.extractSingleCommand(session, commandName, userLocale)
        if (commandData) await fileManager.save('command', commandData.name, commandData, userLocale)
      }
    }
    return commandData ? [commandData] : []
  }
}