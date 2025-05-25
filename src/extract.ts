import { Context } from 'koishi'

export interface CmdOption {
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
 * 命令提取
 */
export class CommandExtractor {
  constructor(private readonly ctx: Context) {}

  /**
   * 获取用户语言环境
   * @param session 会话对象
   */
  getUserLocale(session: any): string {
    const availableLocales = [
      ...(session?.locales || []), ...(session?.channel?.locales || []),
      ...(session?.guild?.locales || []), ...(session?.user?.locales || []),
    ]
    return this.ctx.i18n?.fallback(availableLocales)?.[0] || ''
  }

  /**
   * 提取所有内联命令
   * @param session 会话对象
   * @param userLocale 用户语言环境
   */
  async extractInlineCommands(session: any, userLocale = ''): Promise<CommandData[]> {
    if (userLocale) session.locales = [userLocale, ...(session.locales || [])]
    const rootCommands = this.ctx.$commander._commandList.filter(cmd => !cmd.parent && cmd.ctx.filter(session))
    const extractedCommands = await Promise.all(rootCommands.map(cmd => this.extractCommandData(cmd, session)))
    return extractedCommands.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * 按需提取单个命令信息
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
   * 获取相关命令列表
   * @param session 会话对象
   * @param commandName 命令名称
   * @param userLocale 用户语言环境
   */
  async extractRelatedCommands(session: any, commandName: string, userLocale = ''): Promise<CommandData[]> {
    const targetCommand = await this.extractSingleCommand(session, commandName, userLocale)
    if (!targetCommand) return []
    const relatedCommands: CommandData[] = [targetCommand]
    if (commandName.includes('.')) {
      const parentName = commandName.split('.')[0]
      const parentCommand = await this.extractSingleCommand(session, parentName, userLocale)
      if (parentCommand && !relatedCommands.some(cmd => cmd.name === parentCommand.name)) relatedCommands.unshift(parentCommand)
    }
    return relatedCommands
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
    const data = this.ctx.i18n?.find?.('commands.(name).shortcuts.(variant)', target)
      ?.map(item => ({ ...item, command: $.resolve(item.data.name, session) }))
      ?.filter(item => item.command?.match(session)) || []
    const perfect = data.filter(item => item.similarity === 1)
    return perfect.length ? perfect[0].command : (data.length ? data : null)
  }

  /**
   * 提取命令数据
   * @param command 命令对象
   * @param session 会话对象
   */
  private async extractCommandData(command: any, session: any): Promise<CommandData | null> {
    const getText = (path: string | string[], params = {}) => session?.text?.(path, params) || ''
    const cleanText = (textData: any): string => {
      if (typeof textData === 'string') return textData
      if (Array.isArray(textData)) {
        return textData
          .map(item => typeof item === 'string' ? item : item?.attrs?.content || '')
          .filter(Boolean).join(' ').trim()
      }
      return ''
    }
    const commandDescription = getText([`commands.${command.name}.description`, ''], command.config?.params || {})
    const commandUsage = command._usage
      ? (typeof command._usage === 'string' ? command._usage : await command._usage(session))
      : getText([`commands.${command.name}.usage`, ''], command.config?.params || {})
    // 提取选项
    const optionsList: CmdOption[] = []
    Object.values(command._options || {}).forEach((optionConfig: any) => {
      const addOption = (option: any, optionName: string) => {
        if (option && !(session.resolve && session.resolve(option.hidden))) {
          const description = getText(option.descPath ?? [`commands.${command.name}.options.${optionName}`, ''], option.params || {})
          if (description || option.syntax) {
            optionsList.push({ name: optionName, description, syntax: option.syntax || '' })
          }
        }
      }
      if (!('value' in optionConfig)) addOption(optionConfig, optionConfig.name)
      if (optionConfig.variants) {
        Object.keys(optionConfig.variants).forEach(variantKey =>
          addOption(optionConfig.variants[variantKey], `${optionConfig.name}.${variantKey}`)
        )
      }
    })
    const commandExamples = command._examples?.length
      ? [...command._examples]
      : getText([`commands.${command.name}.examples`, ''], command.config?.params || {})
          .split('\n').filter(line => line.trim())
    // 提取子命令
    const subCommandsData = command.children?.length
      ? (await Promise.all(
          command.children
            .filter((subCommand: any) => subCommand.ctx.filter(session))
            .map((subCommand: any) => this.extractCommandData(subCommand, session))
        )).filter(Boolean)
      : []
    return {
      name: command.name, description: cleanText(commandDescription), usage: cleanText(commandUsage),
      options: optionsList, examples: commandExamples, subCommands: subCommandsData.length ? subCommandsData : undefined,
    }
  }
}