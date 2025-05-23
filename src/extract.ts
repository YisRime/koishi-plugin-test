import { Context } from 'koishi'
import { logger } from './index'

// 接口定义
export interface CommandOption {
  name: string;
  description: string;
  syntax: string
}

export interface CommandData {
  name: string;
  description: string;
  usage: string;
  options: CommandOption[];
  examples: string[];
  subCommands?: CommandData[];
}

/**
 * 命令提取和存储类
 */
export class Extract {
  private ctx: Context
  private locale: string

  constructor(ctx: Context, locale?: string) {
    this.ctx = ctx
    this.locale = locale
  }

  /**
   * 获取用户语言
   */
  public getUserLocale(session: any): string {
    const locales = Array.isArray(session)
      ? session
      : (session?.user?.locales || session?.locales || []);
    const availableLocales = this.ctx.i18n.fallback(locales);
    return availableLocales[0];
  }


  /**
   * 创建模拟会话用于提取国际化文本
   */
  private createSession(locale: string): any {
    const session: any = {
      app: this.ctx.app, user: { authority: 4 }, isDirect: true, locales: [locale],
      text: (path, params) => this.ctx.i18n.render([locale], Array.isArray(path) ? path : [path], params),
    }
    session.resolve = (val) => typeof val === 'function' ? val(session) : val
    return session
  }

  /**
   * 将复杂描述结构简化为纯文本
   */
  private simplifyText(textArray: any[] | string): string {
    if (typeof textArray === 'string') return textArray
    if (!Array.isArray(textArray)) return ''
    return textArray
      .map(item => typeof item === 'string' ? item : (item?.attrs?.content))
      .filter(Boolean).join(' ').trim()
  }

  /**
   * 获取处理后的命令数据
   */
  public async getProcessedCommands(locale: string): Promise<CommandData[]> {
    const session = this.createSession(locale)
    const rootCommands = this.ctx.$commander._commandList.filter((cmd: any) => !cmd.parent)
    const commands = (await Promise.all(rootCommands.map(cmd => this.extractCmdInfo(cmd, session))))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name))
    // 创建深拷贝
    const simplifiedData = JSON.parse(JSON.stringify(commands))
    const processCmd = (cmd: any): void => {
      if (Array.isArray(cmd.description)) cmd.description = this.simplifyText(cmd.description)
      if (Array.isArray(cmd.usage)) cmd.usage = this.simplifyText(cmd.usage)
      // 处理选项描述
      cmd.options?.forEach(opt => { if (Array.isArray(opt.description)) opt.description = this.simplifyText(opt.description) })
      // 递归处理子命令
      cmd.subCommands?.forEach(processCmd)
    }
    // 处理所有命令
    simplifiedData.forEach(processCmd)
    return simplifiedData
  }

  /**
   * 提取单个命令的详细信息
   */
  public async extractCmdInfo(command: any, session?: any): Promise<CommandData|null> {
    if (!session) session = this.createSession(this.locale)
    try {
      // 提取命令信息
      const getText = (key: string, defaultValue = "") => { return session.text([`commands.${command.name}.${key}`, defaultValue], command.params || {}) }
      // 基本信息
      const description = getText('description')
      const rawUsage = command._usage
      const usage = rawUsage
        ? (typeof rawUsage === "string" ? rawUsage : await rawUsage(session))
        : getText('usage')
      // 提取选项
      const options: CommandOption[] = []
      if (command._options) {
        Object.values(command._options).forEach((option: any) => {
          if (!option || typeof option !== 'object') return
          const addOption = (opt: any, name: string) => {
            if (!opt) return
            const desc = session.text(opt.descPath ?? [`commands.${command.name}.options.${name}`, ""], opt.params || {})
            if (desc || opt.syntax) options.push({name, description: desc, syntax: opt.syntax})
          }
          if (!('value' in option)) addOption(option, option.name)
          if (option.variants) for (const val in option.variants) addOption(option.variants[val], `${option.name}.${val}`)
        })
      }
      // 提取示例
      let examples: string[] = []
      if (Array.isArray(command._examples) && command._examples.length) {
        examples = [...command._examples]
      } else {
        const text = getText('examples')
        if (text && typeof text === "string") examples = text.split("\n").filter(line => line.trim() !== "")
      }
      // 处理子命令
      let subCommands
      if (command.children?.length > 0) {
        subCommands = (await Promise.all(command.children.map(sub => this.extractCmdInfo(sub, session))))
          .filter(Boolean)
        if (subCommands.length === 0) subCommands = undefined
      }
      return { name: command.name, description: description, usage: usage, options, examples, subCommands }
    } catch (error) {
      logger.error(`提取命令 ${command?.name || '未知'} 失败:`, error)
      return null
    }
  }

  /**
   * 获取指定命令的数据
   */
  public async getCommandData(name: string, locale: string): Promise<CommandData|null> {
    try {
      let current = this.ctx.$commander.get(name)
      if (name.includes('.')) {
        const parts = name.split('.')
        current = this.ctx.$commander.get(parts[0])
        for (let i = 1; i < parts.length && current; i++) {
          const target = parts.slice(0, i+1).join('.')
          current = current.children?.find(child => child.name === target)
        }
      }
      return current ? await this.extractCmdInfo(current, this.createSession(locale)) : null
    } catch {
      return null
    }
  }
}