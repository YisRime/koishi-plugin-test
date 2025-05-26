import { dirname, join } from 'path'
import { promises } from 'fs'

/**
 * 文件管理器类
 * 负责处理插件相关文件的存储和读取操作
 */
export class FileManager {
  private readonly dataDir: string

  /**
   * 创建文件管理器实例
   * @param baseDir - 基础目录路径
   */
  constructor(baseDir: string) {
    this.dataDir = join(baseDir, 'data/test')
  }

  /**
   * 获取文件的完整路径
   * @param type - 文件类型 (asset/command/layout)
   * @param id - 文件标识符
   * @param locale - 语言环境标识符 (可选)
   * @returns 完整的文件路径
   */
  private getPath(type: string, id: string, locale?: string): string {
    const name = locale ? `${id}_${locale}` : id
    const subDir = { asset: 'assets', command: 'commands', layout: 'layouts' }[type]
    const ext = type === 'asset' ? '' : '.json'
    return join(this.dataDir, subDir, `${name.replace(/\./g, '_')}${ext}`)
  }

  /**
   * 检查文件是否存在
   * @param type - 文件类型
   * @param id - 文件标识符
   * @param locale - 语言环境标识符 (可选)
   * @returns Promise<boolean> 文件是否存在
   */
  async exists(type: string, id: string, locale?: string): Promise<boolean> {
    try {
      await promises.access(this.getPath(type, id, locale))
      return true
    } catch {
      return false
    }
  }

  /**
   * 保存数据到文件
   * @param type - 文件类型
   * @param id - 文件标识符
   * @param data - 要保存的数据
   * @param locale - 语言环境标识符 (可选)
   * @returns Promise<void>
   */
  async save<T>(type: string, id: string, data: T, locale?: string): Promise<void> {
    const path = this.getPath(type, id, locale)
    await promises.mkdir(dirname(path), { recursive: true })
    await promises.writeFile(path, type === 'asset' ? String(data) : JSON.stringify(data, null, 2), 'utf8')
  }

  /**
   * 从文件加载数据
   * @param type - 文件类型
   * @param id - 文件标识符
   * @param locale - 语言环境标识符 (可选)
   * @returns Promise<T | null> 加载的数据或null
   */
  async load<T>(type: string, id: string, locale?: string): Promise<T | null> {
    try {
      const content = await promises.readFile(this.getPath(type, id, locale), 'utf8')
      return type === 'asset' ? content as T : JSON.parse(content) as T
    } catch {
      return null
    }
  }
}

/**
 * 数据服务类
 * 负责封装命令和布局数据的加载逻辑
 */
export class DataService {
  constructor(
    private readonly fileManager: FileManager,
    private readonly extractor: any,
    private readonly contentManager: any
  ) {}

  /**
   * 加载命令数据
   * @param commandName - 命令名称 (null时加载所有命令)
   * @param session - 会话对象
   * @param locale - 语言环境
   * @returns Promise<any[]> 命令数据数组
   */
  async loadCommands(commandName: string, session: any, locale: string) {
    const key = commandName ? commandName : 'commands'
    let data = await this.fileManager.load<any>('command', key, locale)
    if (!data) {
      if (commandName) {
        const all = await this.fileManager.load<any[]>('command', 'commands', locale)
        data = all?.find(c => c.name === commandName) || all?.flatMap(c => c.subCommands || []).find(s => s.name === commandName) || await this.extractor.extractSingleCommand(session, commandName, locale)
        if (data) await this.fileManager.save('command', commandName, data, locale)
      } else {
        data = await this.extractor.extractInlineCommands(session, locale)
        await this.fileManager.save('command', 'commands', data, locale)
      }
    }
    return Array.isArray(data) ? data : data ? [data] : []
  }

  /**
   * 加载布局数据
   * @param commandName - 命令名称 (null时加载主布局)
   * @param commandsData - 命令数据数组
   * @returns Promise<any> 布局配置对象
   */
  async loadLayout(commandName: string, commandsData: any[]) {
    const key = commandName ? commandName : 'main'
    let layout = await this.fileManager.load('layout', key)
    if (!layout) {
      layout = await this.contentManager.generateLayout(commandName, commandsData)
      if (layout) await this.fileManager.save('layout', key, layout)
    }
    return layout
  }
}