import { Context } from 'koishi'

/**
 * 命令选项接口
 * 定义命令选项的基本结构
 */
interface CmdOption {
  /** 选项名称 */
  name: string
  /** 选项描述 */
  description: string
  /** 选项语法 */
  syntax: string
}

/**
 * 命令数据接口
 * 定义完整命令信息的数据结构
 */
export interface CommandData {
  /** 命令名称 */
  name: string
  /** 命令描述 */
  description: string
  /** 使用方法 */
  usage: string
  /** 命令选项数组 */
  options: CmdOption[]
  /** 使用示例数组 */
  examples: string[]
  /** 子命令数组 (可选) */
  subCommands?: CommandData[]
}

/**
 * 命令提取器类
 * 负责从Koishi上下文中提取和处理命令信息
 */
export class CommandExtractor {
  /**
   * 创建命令提取器实例
   * @param ctx - Koishi上下文对象
   */
  constructor(private readonly ctx: Context) {}

  /**
   * 获取用户的语言环境偏好
   * @param session - 会话对象
   * @returns string 用户语言环境标识符
   */
  getUserLocale(session: any): string {
    const locales = [...(session?.locales || []), ...(session?.channel?.locales || []), ...(session?.guild?.locales || []), ...(session?.user?.locales || [])]
    return this.ctx.i18n?.fallback(locales)?.[0] || ''
  }

  /**
   * 提取所有可用的内联命令
   * @param session - 会话对象
   * @param userLocale - 用户语言环境 (可选)
   * @returns Promise<CommandData[]> 命令数据数组
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
   * 按需提取单个命令的详细信息
   * @param session - 会话对象
   * @param commandName - 目标命令名称
   * @param userLocale - 用户语言环境 (可选)
   * @returns Promise<CommandData | null> 命令数据对象或null
   */
  async extractSingleCommand(session: any, commandName: string, userLocale = ''): Promise<CommandData | null> {
    if (userLocale) session.locales = [userLocale, ...(session.locales || [])]
    const command = this.findCommand(commandName, session)
    return command && !Array.isArray(command) ? await this.extractCommandData(command, session) : null
  }

  /**
   * 获取与指定命令相关的命令列表
   * @param session - 会话对象
   * @param commandName - 目标命令名称
   * @param userLocale - 用户语言环境 (可选)
   * @returns Promise<CommandData[]> 相关命令数据数组
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
   * 在命令系统中查找指定的命令
   * @param target - 目标命令名称
   * @param session - 会话对象
   * @returns 找到的命令对象或命令数组，未找到则返回null
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
   * 提取单个命令的完整数据信息
   * @param command - Koishi命令对象
   * @param session - 会话对象
   * @returns Promise<CommandData | null> 提取的命令数据或null
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
      name: command.name, description: clean(description), usage: clean(usage), options,
      examples, subCommands: subCommands.length ? subCommands : undefined
    }
  }
}