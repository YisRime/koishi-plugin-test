import { Context } from 'koishi'

/**
 * 命令选项接口
 */
interface Option {
  name: string
  desc: string
  syntax: string
}

/**
 * 命令数据接口
 */
export interface Command {
  name: string
  desc: string
  usage: string
  options: Option[]
  examples: string[]
  subs?: Command[]
}

/**
 * 命令提取器
 */
export class Extract {
  constructor(private readonly ctx: Context) {}

  /**
   * 获取用户语言
   */
  getLocale(session: any): string {
    const locales = [...(session?.locales || []), ...(session?.channel?.locales || []), ...(session?.guild?.locales || []), ...(session?.user?.locales || [])]
    return this.ctx.i18n?.fallback(locales)?.[0] || ''
  }

  /**
   * 获取所有命令
   */
  async getAll(session: any, locale = ''): Promise<Command[]> {
    if (locale) session.locales = [locale, ...(session.locales || [])]
    const commands = await Promise.all(
      this.ctx.$commander._commandList
        .filter(cmd => !cmd.parent && cmd.ctx.filter(session))
        .map(cmd => this.buildData(cmd, session))
    )
    return commands.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * 获取单个命令
   */
  async getSingle(session: any, cmdName: string, locale = ''): Promise<Command | null> {
    if (locale) session.locales = [locale, ...(session.locales || [])]
    const command = this.findCmd(cmdName, session)
    return command && !Array.isArray(command) ? await this.buildData(command, session) : null
  }

  /**
   * 获取相关命令
   */
  async getRelated(session: any, cmdName: string, locale = ''): Promise<Command[]> {
    const target = await this.getSingle(session, cmdName, locale)
    if (!target) return []
    const commands = [target]
    if (cmdName.includes('.')) {
      const parent = await this.getSingle(session, cmdName.split('.')[0], locale)
      if (parent && !commands.some(cmd => cmd.name === parent.name)) commands.unshift(parent)
    }
    return commands
  }

  /**
   * 查找命令
   */
  private findCmd(target: string, session: any) {
    const $ = this.ctx.$commander
    const command = $.resolve(target, session)
    if (command?.ctx.filter(session)) return command
    const data = this.ctx.i18n?.find?.('commands.(name).shortcuts.(variant)', target)?.map(item => ({ ...item, command: $.resolve(item.data.name, session) }))?.filter(item => item.command?.match(session)) || []
    const perfect = data.filter(item => item.similarity === 1)
    return perfect.length ? perfect[0].command : (data.length ? data : null)
  }

  /**
   * 构建命令数据
   */
  private async buildData(command: any, session: any): Promise<Command | null> {
    const getText = (path: string | string[], params = {}) => session?.text?.(path, params) || ''
    const clean = (data: any): string => {
      if (typeof data === 'string') return data
      if (Array.isArray(data)) return data.map(item => typeof item === 'string' ? item : item?.attrs?.content || '').filter(Boolean).join(' ').trim()
      return ''
    }
    const desc = getText([`commands.${command.name}.description`, ''], command.config?.params || {})
    const usage = command._usage ? (typeof command._usage === 'string' ? command._usage : await command._usage(session)) : getText([`commands.${command.name}.usage`, ''], command.config?.params || {})
    const options: Option[] = []
    Object.values(command._options || {}).forEach((opt: any) => {
      const add = (option: any, name: string) => {
        if (option && !(session.resolve?.(option.hidden))) {
          const desc = getText(option.descPath ?? [`commands.${command.name}.options.${name}`, ''], option.params || {})
          if (desc || option.syntax) options.push({ name, desc: desc, syntax: option.syntax || '' })
        }
      }
      if (!('value' in opt)) add(opt, opt.name)
      if (opt.variants) Object.keys(opt.variants).forEach(key => add(opt.variants[key], `${opt.name}.${key}`))
    })
    const examples = command._examples?.length ? [...command._examples] : getText([`commands.${command.name}.examples`, ''], command.config?.params || {}).split('\n').filter(line => line.trim())
    const subs = command.children?.length ? (await Promise.all(command.children.filter((sub: any) => sub.ctx.filter(session)).map((sub: any) => this.buildData(sub, session)))).filter(Boolean) : []
    return {
      name: command.name, desc: clean(desc), usage: clean(usage), options,
      examples, subs: subs.length ? subs : undefined
    }
  }
}