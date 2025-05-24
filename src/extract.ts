import { Context } from 'koishi'
import { logger } from './index'
import { join } from 'path'
import { File } from './utils'

/**
 * 命令选项接口
 */
export interface CommandOption {
  name: string;
  description: string;
  syntax: string
}

/**
 * 命令数据接口
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
 * 命令提取器类，用于提取、处理和保存命令数据
 */
export class Extract {
  private file: File
  private cmdDir: string

  /**
   * 创建命令提取器实例
   * @param ctx - Koishi 上下文
   */
  constructor(private ctx: Context) {
    const dataDir = join(ctx.baseDir, 'data/test')
    this.file = new File(dataDir)
    this.cmdDir = join(dataDir, 'commands')
  }

  /**
   * 获取命令数据文件的路径
   * @param locale - 可选的语言代码
   * @returns 命令数据文件的完整路径
   */
  private getCommandsPath(locale?: string): string {
    return join(this.cmdDir, locale ? `commands_${locale}.json` : 'commands.json')
  }

  /**
   * 保存命令数据到文件
   * @param cmds - 要保存的命令数据数组
   * @param locale - 可选的语言代码
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
   * @param locale - 可选的语言代码
   * @returns 命令数据数组，如果加载失败则返回 null
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
   * 获取用户的语言设置
   * @param session - 用户会话对象
   * @returns 用户的语言代码
   */
  public getUserLocale(session: any): string {
    if (!session) return ''
    const locales = [
      ...(session.locales || []), ...(session.channel?.locales || []),
      ...(session.guild?.locales || []), ...(session.user?.locales || [])
    ]
    return locales.length ? (this.ctx.i18n.fallback(locales)[0] || '') : ''
  }

  /**
   * 获取处理过的命令列表
   * @param locale - 语言代码
   * @returns 处理后的命令数据数组
   */
  public async getProcessedCommands(locale: string): Promise<CommandData[]> {
    const locales = locale ? [locale] : []
    const session = this.createSession(locales)
    const cmds = await Promise.all(
      this.ctx.$commander._commandList
        .filter((cmd: any) => !cmd.parent)
        .map(cmd => this.extractCmdInfo(cmd, session))
    )
    return JSON.parse(JSON.stringify(cmds.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))));
  }

  /**
   * 创建一个用于国际化文本处理的会话对象
   * @param locales - 语言代码数组
   * @returns 会话对象
   * @private
   */
  private createSession(locales: string[] = []) {
    return {
      app: this.ctx.app, user: { authority: 4 }, isDirect: true, locales,
      text: (path, params) => this.ctx.i18n.render(locales, Array.isArray(path) ? path : [path], params),
      resolve: (val) => typeof val === 'function' ? val(this) : val
    }
  }

  /**
   * 提取命令的详细信息
   * @param cmd - 命令对象
   * @param session - 可选的会话对象，用于文本国际化
   * @returns 处理后的命令数据，失败则返回 null
   */
  public async extractCmdInfo(cmd: any, session?: any): Promise<CommandData|null> {
    if (!cmd) return null
    session = session || this.createSession()
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
      let examples = Array.isArray(cmd._examples) && cmd._examples.length
        ? [...cmd._examples]
        : (getText('examples') || "").split("\n").filter(line => line.trim() !== "")
      // 提取子命令
      const subCommands = cmd.children?.length
        ? (await Promise.all(cmd.children.map((sub: any) => this.extractCmdInfo(sub, session))))
            .filter(Boolean)
        : []
      const result = {
        name: cmd.name, description: this.simplifyText(getText('description')),
        usage: this.simplifyText(cmd._usage
          ? (typeof cmd._usage === "string" ? cmd._usage : await cmd._usage(session))
          : getText('usage')),
        options: opts, examples, subCommands: subCommands.length ? subCommands : undefined
      }
      // 简化选项描述
      result.options.forEach(opt => { if (Array.isArray(opt.description)) opt.description = this.simplifyText(opt.description) })
      return result
    } catch (error) {
      logger.error(`提取命令 ${cmd?.name || '未知'} 失败:`, error)
      return null
    }
  }

  /**
   * 简化文本数据，处理富文本数组和嵌套对象
   * @param data - 要简化的文本数据
   * @returns 简化后的文本
   * @private
   */
  private simplifyText(data: any): any {
    if (typeof data === 'string') return data;
    if (Array.isArray(data)) {
      // 检查是否为富文本数组
      if (data.some(item => item?.attrs?.content)) {
        return data
          .map(item => item?.attrs?.content || (typeof item === 'string' ? item : ''))
          .filter(Boolean).join(' ').trim();
      }
      // 处理普通数组
      data.forEach(item => { if (item && typeof item === 'object') this.simplifyText(item); });
    } else if (data && typeof data === 'object') {
      // 处理特定字段
      ['description', 'usage'].forEach(field => {
        if (field in data && Array.isArray(data[field])) data[field] = this.simplifyText(data[field]);
      });
      // 处理子命令
      if (data.subCommands?.length) data.subCommands.forEach(cmd => this.simplifyText(cmd));
    }
    return data;
  }
}