import { Context } from 'koishi'
import { logger } from './index'
import { join } from 'path'
import { File } from './utils'

/**
 * 命令选项接口
 * @interface CommandOption
 */
export interface CommandOption {
  name: string;
  description: string;
  syntax: string
}

/**
 * 命令数据接口
 * @interface CommandData
 */
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
 * @class Extract
 */
export class Extract {
  private file: File
  private cmdDir: string

  /**
   * 创建命令提取器实例
   * @param {Context} ctx Koishi上下文
   * @param {string} locale 区域设置
   */
  constructor(private ctx: Context, private locale: string = 'zh-CN') {
    const dataDir = join(ctx.baseDir, 'data/test')
    this.file = new File(dataDir)
    this.cmdDir = join(dataDir, 'commands')
  }

  /**
   * 获取命令数据文件路径
   * @param {string} locale 区域设置
   * @returns {string} 文件路径
   */
  private getCommandsPath(locale?: string): string {
    return join(this.cmdDir, `commands_${locale || this.locale}.json`)
  }

  /**
   * 保存命令数据
   * @param {CommandData[]} cmds 命令数据
   * @param {string} locale 区域设置
   * @returns {Promise<boolean>} 是否成功
   */
  public async saveCommandsData(cmds: CommandData[], locale?: string): Promise<boolean> {
    if (!cmds?.length) {
      logger.warn(`保存的命令数据为空: ${locale || this.locale}`)
      return false
    }

    const path = this.getCommandsPath(locale)
    await this.file.ensureDir(path)
    return this.file.writeFile(path, JSON.stringify(cmds, null, 2))
  }

  /**
   * 加载命令数据
   * @param {string} locale 区域设置
   * @returns {Promise<CommandData[]|null>} 命令数据或null
   */
  public async loadCommandsData(locale?: string): Promise<CommandData[]|null> {
    const path = this.getCommandsPath(locale)
    const data = await this.file.readFile(path)
    if (!data) return null

    try {
      return JSON.parse(data)
    } catch (err) {
      logger.error(`解析命令数据失败: ${path}`, err)
      return null
    }
  }

  /**
   * 获取用户区域设置
   * @param {any} session 会话对象
   * @returns {string} 区域设置
   */
  public getUserLocale(session: any): string {
    const locales = Array.isArray(session)
      ? session
      : (session?.user?.locales || session?.locales || []);
    const available = this.ctx.i18n.fallback(locales);
    return available[0];
  }

  /**
   * 创建模拟会话用于提取国际化文本
   * @param {string} locale 区域设置
   * @returns {any} 会话对象
   */
  private createSession(locale: string): any {
    const session: any = {
      app: this.ctx.app,
      user: { authority: 4 },
      isDirect: true,
      locales: [locale],
      text: (path, params) => this.ctx.i18n.render(
        [locale],
        Array.isArray(path) ? path : [path],
        params
      ),
    }
    session.resolve = (val) => typeof val === 'function' ? val(session) : val
    return session
  }

  /**
   * 将复杂描述结构简化为纯文本
   * @param {any[]|string} text 文本或文本数组
   * @returns {string} 简化后的文本
   */
  private simplifyText(text: any[] | string): string {
    if (typeof text === 'string') return text
    if (!Array.isArray(text)) return ''
    return text
      .map(item => typeof item === 'string' ? item : (item?.attrs?.content))
      .filter(Boolean).join(' ').trim()
  }

  /**
   * 获取处理后的命令数据
   * @param {string} locale 区域设置
   * @returns {Promise<CommandData[]>} 命令数据数组
   */
  public async getProcessedCommands(locale: string): Promise<CommandData[]> {
    const session = this.createSession(locale)
    const rootCmds = this.ctx.$commander._commandList.filter((cmd: any) => !cmd.parent)
    const cmds = (await Promise.all(rootCmds.map(cmd => this.extractCmdInfo(cmd, session))))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name))

    // 简化文本
    const processed = JSON.parse(JSON.stringify(cmds))
    const simplify = (cmd: any): void => {
      if (Array.isArray(cmd.description)) cmd.description = this.simplifyText(cmd.description)
      if (Array.isArray(cmd.usage)) cmd.usage = this.simplifyText(cmd.usage)
      cmd.options?.forEach(opt => {
        if (Array.isArray(opt.description)) opt.description = this.simplifyText(opt.description)
      })
      cmd.subCommands?.forEach(simplify)
    }
    processed.forEach(simplify)
    return processed
  }

  /**
   * 提取单个命令的详细信息
   * @param {any} cmd 命令对象
   * @param {any} session 会话对象
   * @returns {Promise<CommandData|null>} 命令数据或null
   */
  public async extractCmdInfo(cmd: any, session?: any): Promise<CommandData|null> {
    if (!session) session = this.createSession(this.locale)
    try {
      // 文本获取工具函数
      const getText = (key: string, def = "") => {
        return session.text([`commands.${cmd.name}.${key}`, def], cmd.params || {})
      }

      // 基本信息
      const desc = getText('description')
      const usage = cmd._usage
        ? (typeof cmd._usage === "string" ? cmd._usage : await cmd._usage(session))
        : getText('usage')

      // 提取选项
      const opts: CommandOption[] = []
      if (cmd._options) {
        Object.values(cmd._options).forEach((opt: any) => {
          if (!opt || typeof opt !== 'object') return
          const addOpt = (o: any, name: string) => {
            if (!o) return
            const desc = session.text(
              o.descPath ?? [`commands.${cmd.name}.options.${name}`, ""],
              o.params || {}
            )
            if (desc || o.syntax) opts.push({name, description: desc, syntax: o.syntax})
          }
          if (!('value' in opt)) addOpt(opt, opt.name)
          if (opt.variants) {
            for (const val in opt.variants) {
              addOpt(opt.variants[val], `${opt.name}.${val}`)
            }
          }
        })
      }

      // 提取示例
      let examples: string[] = []
      if (Array.isArray(cmd._examples) && cmd._examples.length) {
        examples = [...cmd._examples]
      } else {
        const text = getText('examples')
        if (text && typeof text === "string") {
          examples = text.split("\n").filter(line => line.trim() !== "")
        }
      }

      // 处理子命令
      let subCommands
      if (cmd.children?.length > 0) {
        subCommands = (await Promise.all(cmd.children.map(sub =>
          this.extractCmdInfo(sub, session)
        ))).filter(Boolean)
        if (subCommands.length === 0) subCommands = undefined
      }

      return {
        name: cmd.name,
        description: desc,
        usage,
        options: opts,
        examples,
        subCommands
      }
    } catch (error) {
      logger.error(`提取命令 ${cmd?.name || '未知'} 失败:`, error)
      return null
    }
  }

  /**
   * 获取指定命令的数据
   * @param {string} name 命令名称
   * @param {string} locale 区域设置
   * @returns {Promise<CommandData|null>} 命令数据或null
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