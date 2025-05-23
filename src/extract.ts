import { Context } from 'koishi'
import { logger } from './index'
import { join } from 'path'
import { File } from './utils'

/**
 * 表示命令选项的接口
 * @interface CommandOption
 */
export interface CommandOption {
  /** 选项名称 */
  name: string;
  /** 选项描述 */
  description: string;
  /** 选项语法 */
  syntax: string
}

/**
 * 表示命令数据的接口
 * @interface CommandData
 */
export interface CommandData {
  /** 命令名称 */
  name: string;
  /** 命令描述 */
  description: string;
  /** 命令用法 */
  usage: string;
  /** 命令选项列表 */
  options: CommandOption[];
  /** 命令示例列表 */
  examples: string[];
  /** 子命令列表 */
  subCommands?: CommandData[];
}

/**
 * 命令提取器类，用于提取、处理和保存命令数据
 */
export class Extract {
  private file: File
  private cmdDir: string

  /**
   * 创建一个Extract实例
   * @param ctx Koishi上下文
   */
  constructor(private ctx: Context) {
    const dataDir = join(ctx.baseDir, 'data/test')
    this.file = new File(dataDir)
    this.cmdDir = join(dataDir, 'commands')
  }

  /**
   * 获取命令数据文件的路径
   * @param locale 可选的语言区域
   * @returns 命令数据文件的完整路径
   */
  private getCommandsPath(locale?: string): string {
    return join(this.cmdDir, locale ? `commands_${locale}.json` : 'commands.json')
  }

  /**
   * 保存命令数据到文件
   * @param cmds 要保存的命令数据数组
   * @param locale 可选的语言区域
   * @returns 保存是否成功
   */
  public async saveCommandsData(cmds: CommandData[], locale?: string): Promise<boolean> {
    if (!cmds.length) return false
    const path = this.getCommandsPath(locale)
    await this.file.ensureDir(path)
    return this.file.writeFile(path, JSON.stringify(cmds, null, 2))
  }

  /**
   * 从文件加载命令数据
   * @param locale 可选的语言区域
   * @returns 命令数据数组或null（如果加载失败）
   */
  public async loadCommandsData(locale?: string): Promise<CommandData[]|null> {
    try {
      const data = await this.file.readFile(this.getCommandsPath(locale))
      return data ? JSON.parse(data) : null
    } catch (err) {
      logger.error(`读取命令数据失败: ${this.getCommandsPath(locale)}`, err)
      return null
    }
  }

  /**
   * 获取用户会话的语言区域
   * @param session 用户会话对象
   * @returns 语言区域代码
   */
  public getUserLocale(session: any): string {
    if (!session) return ''
    const locales = [
      ...(session.locales || []),
      ...(session.channel?.locales || []),
      ...(session.guild?.locales || []),
      ...(session.user?.locales || [])
    ]
    return locales.length ? (this.ctx.i18n.fallback(locales)[0] || '') : ''
  }

  /**
   * 获取处理过的命令数据
   * @param locale 语言区域
   * @returns 处理后的命令数据数组
   */
  public async getProcessedCommands(locale: string): Promise<CommandData[]> {
    const session = this.createMockSession(locale)
    const cmds = await Promise.all(
      this.ctx.$commander._commandList
        .filter((cmd: any) => !cmd.parent)
        .map(cmd => this.extractCmdInfo(cmd, session))
    )
    return this.simplifyCommandTexts(
      JSON.parse(JSON.stringify(cmds.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))))
    )
  }

  /**
   * 简化命令文本内容
   * @param cmds 命令数据数组
   * @returns 简化后的命令数据数组
   */
  private simplifyCommandTexts(cmds: CommandData[]): CommandData[] {
    const simplify = (cmd: CommandData) => {
      if (Array.isArray(cmd.description)) cmd.description = this.simplifyText(cmd.description)
      if (Array.isArray(cmd.usage)) cmd.usage = this.simplifyText(cmd.usage)
      cmd.options?.forEach(opt => {
        if (Array.isArray(opt.description)) opt.description = this.simplifyText(opt.description)
      })
      cmd.subCommands?.forEach(simplify)
    }
    cmds.forEach(simplify)
    return cmds
  }

  /**
   * 创建模拟会话对象
   * @param locale 语言区域
   * @returns 模拟会话对象
   */
  private createMockSession(locale: string): any {
    const locales = locale ? [locale] : []
    return {
      app: this.ctx.app, user: { authority: 4 }, isDirect: true, locales,
      text: (path, params) => this.ctx.i18n.render(locales, Array.isArray(path) ? path : [path], params),
      resolve: (val) => typeof val === 'function' ? val(this) : val
    }
  }

  /**
   * 提取命令信息
   * @param cmd 命令对象
   * @param session 可选的会话对象
   * @returns 提取的命令数据或null（如果提取失败）
   */
  public async extractCmdInfo(cmd: any, session?: any): Promise<CommandData|null> {
    if (!cmd) return null
    session = session || this.createMockSession('')
    try {
      const getText = (key: string, def = "") =>
        session.text([`commands.${cmd.name}.${key}`, def], cmd.params || {})
      // 提取选项
      const opts: CommandOption[] = []
      if (cmd._options) {
        Object.values(cmd._options).forEach((opt: any) => {
          if (!opt || typeof opt !== 'object') return
          const addOption = (o: any, name: string) => {
            if (!o) return
            const desc = session.text(
              o.descPath ?? [`commands.${cmd.name}.options.${name}`, ""],
              o.params || {}
            )
            if (desc || o.syntax) opts.push({name, description: desc, syntax: o.syntax})
          }
          if (!('value' in opt)) addOption(opt, opt.name)
          if (opt.variants) for (const val in opt.variants) addOption(opt.variants[val], `${opt.name}.${val}`)
        })
      }
      // 提取示例
      let examples: string[] = []
      if (Array.isArray(cmd._examples) && cmd._examples.length) {
        examples = [...cmd._examples]
      } else {
        const text = getText('examples')
        if (text && typeof text === "string") examples = text.split("\n").filter(line => line.trim() !== "")
      }
      // 提取子命令
      const subCommands = cmd.children?.length
        ? (await Promise.all(cmd.children.map((sub: any) => this.extractCmdInfo(sub, session))))
            .filter(Boolean)
        : []
      return {
        name: cmd.name, description: getText('description'),
        usage: cmd._usage
          ? (typeof cmd._usage === "string" ? cmd._usage : await cmd._usage(session))
          : getText('usage'),
        options: opts, examples, subCommands: subCommands.length ? subCommands : undefined
      }
    } catch (error) {
      logger.error(`提取命令 ${cmd?.name || '未知'} 失败:`, error)
      return null
    }
  }

  /**
   * 简化文本内容
   * @param text 要简化的文本数组或字符串
   * @returns 简化后的字符串
   */
  private simplifyText(text: any[] | string): string {
    if (typeof text === 'string') return text
    if (!Array.isArray(text)) return ''
    return text
      .map(item => typeof item === 'string' ? item : (item?.attrs?.content))
      .filter(Boolean)
      .join(' ')
      .trim()
  }
}