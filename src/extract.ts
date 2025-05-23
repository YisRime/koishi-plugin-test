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
   */
  constructor(private ctx: Context, private locale: string = 'zh-CN') {
    const dataDir = join(ctx.baseDir, 'data/test')
    this.file = new File(dataDir)
    this.cmdDir = join(dataDir, 'commands')
  }

  /**
   * 获取命令数据文件路径
   */
  private getCommandsPath(locale?: string): string {
    return join(this.cmdDir, `commands_${locale || this.locale}.json`)
  }

  /**
   * 保存命令数据
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
   */
  public async loadCommandsData(locale?: string): Promise<CommandData[]|null> {
    const path = this.getCommandsPath(locale)
    try {
      const data = await this.file.readFile(path)
      return data ? JSON.parse(data) : null
    } catch (err) {
      logger.error(`读取命令数据失败: ${path}`, err)
      return null
    }
  }

  /**
   * 获取用户区域设置
   */
  public getUserLocale(session: any): string {
    logger.info('获取用户语言设置, session:', session ? '存在' : '不存在');

    if (!session) {
      logger.info(`未提供会话，使用默认语言: ${this.locale}`);
      return this.locale;
    }

    // 检查各种可能的语言来源
    let locales: string[] = [];

    // 使用i18n的fallback机制获取最终语言
    const finalLocale = locales.length > 0
      ? (this.ctx.i18n.fallback(locales)[0] || this.locale)
      : this.locale;

    logger.info(`最终确定的用户语言: ${finalLocale}`);
    return finalLocale;
  }

  /**
   * 获取处理后的命令数据
   */
  public async getProcessedCommands(locale: string): Promise<CommandData[]> {
    const session = this.createMockSession(locale)
    const rootCmds = this.ctx.$commander._commandList.filter((cmd: any) => !cmd.parent)

    // 提取命令信息
    const cmds = await Promise.all(rootCmds.map(cmd => this.extractCmdInfo(cmd, session)))
    const validCmds = cmds.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))

    // 简化文本
    return this.simplifyCommandTexts(JSON.parse(JSON.stringify(validCmds)))
  }

  /**
   * 简化命令文本
   */
  private simplifyCommandTexts(cmds: CommandData[]): CommandData[] {
    const simplify = (cmd: CommandData): void => {
      // 简化描述和用法
      if (Array.isArray(cmd.description)) cmd.description = this.simplifyText(cmd.description)
      if (Array.isArray(cmd.usage)) cmd.usage = this.simplifyText(cmd.usage)

      // 简化选项描述
      cmd.options?.forEach(opt => {
        if (Array.isArray(opt.description)) opt.description = this.simplifyText(opt.description)
      })

      // 递归处理子命令
      cmd.subCommands?.forEach(simplify)
    }

    cmds.forEach(simplify)
    return cmds
  }

  /**
   * 创建用于国际化的模拟会话
   */
  private createMockSession(locale: string): any {
    return {
      app: this.ctx.app,
      user: { authority: 4 },
      isDirect: true,
      locales: [locale],
      text: (path, params) => this.ctx.i18n.render(
        [locale],
        Array.isArray(path) ? path : [path],
        params
      ),
      resolve: (val) => typeof val === 'function' ? val(this) : val
    }
  }

  /**
   * 提取命令信息
   */
  public async extractCmdInfo(cmd: any, session?: any): Promise<CommandData|null> {
    if (!cmd) return null
    if (!session) session = this.createMockSession(this.locale)

    try {
      // 获取文本的辅助函数
      const getText = (key: string, def = "") =>
        session.text([`commands.${cmd.name}.${key}`, def], cmd.params || {})

      // 基本信息
      const desc = getText('description')
      const usage = cmd._usage
        ? (typeof cmd._usage === "string" ? cmd._usage : await cmd._usage(session))
        : getText('usage')

      // 内联extractOptions - 提取选项
      const opts: CommandOption[] = []
      if (cmd._options) {
        Object.values(cmd._options).forEach((opt: any) => {
          if (!opt || typeof opt !== 'object') return

          // 添加选项
          const addOption = (o: any, name: string) => {
            if (!o) return
            const desc = session.text(
              o.descPath ?? [`commands.${cmd.name}.options.${name}`, ""],
              o.params || {}
            )
            if (desc || o.syntax) opts.push({name, description: desc, syntax: o.syntax})
          }

          // 处理主选项
          if (!('value' in opt)) addOption(opt, opt.name)

          // 处理变体选项
          if (opt.variants) {
            for (const val in opt.variants) {
              addOption(opt.variants[val], `${opt.name}.${val}`)
            }
          }
        })
      }

      // 内联extractExamples - 提取示例
      let examples: string[] = []
      if (Array.isArray(cmd._examples) && cmd._examples.length) {
        examples = [...cmd._examples]
      } else {
        const text = getText('examples')
        if (text && typeof text === "string") {
          examples = text.split("\n").filter(line => line.trim() !== "")
        }
      }

      // 内联extractSubCommands - 提取子命令
      let subCommands: CommandData[] = []
      if (cmd.children?.length) {
        const subCmds = await Promise.all(
          cmd.children.map((sub: any) => this.extractCmdInfo(sub, session))
        )
        subCommands = subCmds.filter(Boolean)
      }

      return {
        name: cmd.name,
        description: desc,
        usage,
        options: opts,
        examples,
        subCommands: subCommands?.length ? subCommands : undefined
      }
    } catch (error) {
      logger.error(`提取命令 ${cmd?.name || '未知'} 失败:`, error)
      return null
    }
  }

  /**
   * 简化文本
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