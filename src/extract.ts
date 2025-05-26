import { Context } from 'koishi'

interface CmdOption {
  name: string
  description: string
  syntax: string
}

export interface CommandData {
  name: string
  description: string
  usage: string
  options: CmdOption[]
  examples: string[]
  subCommands?: CommandData[]
}

/**
 * 命令提取器 - 负责从Koishi上下文中提取命令信息
 */
export class CommandExtractor {
  constructor(private readonly ctx: Context) {}

  /**
   * 获取用户语言环境
   * @param session 会话对象
   */
  getUserLocale(session: any): string {
    const locales = [...(session?.locales || []), ...(session?.channel?.locales || []), ...(session?.guild?.locales || []), ...(session?.user?.locales || [])]
    return this.ctx.i18n?.fallback(locales)?.[0] || ''
  }

  /**
   * 提取所有内联命令 - 批量命令提取流程
   * @param session 会话对象
   * @param userLocale 用户语言环境
   */
  async extractInlineCommands(session: any, userLocale = ''): Promise<CommandData[]> {
    if (userLocale) session.locales = [userLocale, ...(session.locales || [])]
    const commands = await Promise.all(
      this.ctx.$commander._commandList
        .filter(cmd => !cmd.parent && cmd.ctx.filter(session))
        .map(cmd => this.extractCommandData(cmd, session))
    )
    return commands.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * 按需提取单个命令信息 - 单命令提取流程
   * @param session 会话对象
   * @param commandName 命令名称
   * @param userLocale 用户语言环境
   */
  async extractSingleCommand(session: any, commandName: string, userLocale = ''): Promise<CommandData | null> {
    if (userLocale) session.locales = [userLocale, ...(session.locales || [])]
    const command = this.findCommand(commandName, session)
    return command && !Array.isArray(command) ? await this.extractCommandData(command, session) : null
  }

  /**
   * 获取相关命令列表 - 关联命令提取流程
   * @param session 会话对象
   * @param commandName 命令名称
   * @param userLocale 用户语言环境
   */
  async extractRelatedCommands(session: any, commandName: string, userLocale = ''): Promise<CommandData[]> {
    const target = await this.extractSingleCommand(session, commandName, userLocale)
    if (!target) return []
    const commands = [target]
    if (commandName.includes('.')) {
      const parent = await this.extractSingleCommand(session, commandName.split('.')[0], userLocale)
      if (parent && !commands.some(cmd => cmd.name === parent.name)) commands.unshift(parent)
    }
    return commands
  }

  /**
   * 查找命令
   * @param target 目标命令名
   * @param session 会话对象
   */
  private findCommand(target: string, session: any) {
    const $ = this.ctx.$commander
    const command = $.resolve(target, session)
    if (command?.ctx.filter(session)) return command
    const data = this.ctx.i18n?.find?.('commands.(name).shortcuts.(variant)', target)?.map(item => ({ ...item, command: $.resolve(item.data.name, session) }))?.filter(item => item.command?.match(session)) || []
    const perfect = data.filter(item => item.similarity === 1)
    return perfect.length ? perfect[0].command : (data.length ? data : null)
  }

  /**
   * 提取命令数据 - 单个命令详细信息提取流程
   * @param command 命令对象
   * @param session 会话对象
   */
  private async extractCommandData(command: any, session: any): Promise<CommandData | null> {
    const getText = (path: string | string[], params = {}) => session?.text?.(path, params) || ''
    const clean = (data: any): string => {
      if (typeof data === 'string') return data
      if (Array.isArray(data)) return data.map(item => typeof item === 'string' ? item : item?.attrs?.content || '').filter(Boolean).join(' ').trim()
      return ''
    }

    const description = getText([`commands.${command.name}.description`, ''], command.config?.params || {})
    const usage = command._usage ? (typeof command._usage === 'string' ? command._usage : await command._usage(session)) : getText([`commands.${command.name}.usage`, ''], command.config?.params || {})

    const options: CmdOption[] = []
    Object.values(command._options || {}).forEach((opt: any) => {
      const add = (option: any, name: string) => {
        if (option && !(session.resolve?.(option.hidden))) {
          const desc = getText(option.descPath ?? [`commands.${command.name}.options.${name}`, ''], option.params || {})
          if (desc || option.syntax) options.push({ name, description: desc, syntax: option.syntax || '' })
        }
      }
      if (!('value' in opt)) add(opt, opt.name)
      if (opt.variants) Object.keys(opt.variants).forEach(key => add(opt.variants[key], `${opt.name}.${key}`))
    })

    const examples = command._examples?.length ? [...command._examples] : getText([`commands.${command.name}.examples`, ''], command.config?.params || {}).split('\n').filter(line => line.trim())
    const subCommands = command.children?.length ? (await Promise.all(command.children.filter((sub: any) => sub.ctx.filter(session)).map((sub: any) => this.extractCommandData(sub, session)))).filter(Boolean) : []

    return {
      name: command.name,
      description: clean(description),
      usage: clean(usage),
      options,
      examples,
      subCommands: subCommands.length ? subCommands : undefined
    }
  }
}