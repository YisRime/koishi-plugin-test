import { dirname, join } from 'path'
import { promises } from 'fs'
import { createLayout } from './extract'

/**
 * 文件管理器类
 */
export class FileStore {
  private readonly baseDir: string

  /**
   * 创建文件管理器实例
   */
  constructor(rootDir: string) {
    this.baseDir = join(rootDir, 'data/test')
  }

  /**
   * 获取文件路径
   */
  private buildPath(type: string, id: string, locale?: string): string {
    const name = locale ? `${id}_${locale}` : id
    const folder = { asset: 'assets', command: 'commands', layout: 'layouts' }[type]
    const ext = type === 'asset' ? '' : '.json'
    return join(this.baseDir, folder, `${name.replace(/\./g, '_')}${ext}`)
  }

  /**
   * 检查文件存在
   */
  async has(type: string, id: string, locale?: string): Promise<boolean> {
    try {
      await promises.access(this.buildPath(type, id, locale))
      return true
    } catch {
      return false
    }
  }

  /**
   * 保存数据
   */
  async write<T>(type: string, id: string, data: T, locale?: string): Promise<void> {
    const path = this.buildPath(type, id, locale)
    await promises.mkdir(dirname(path), { recursive: true })
    await promises.writeFile(path, type === 'asset' ? String(data) : JSON.stringify(data, null, 2), 'utf8')
  }

  /**
   * 读取数据
   */
  async read<T>(type: string, id: string, locale?: string): Promise<T | null> {
    try {
      const content = await promises.readFile(this.buildPath(type, id, locale), 'utf8')
      return type === 'asset' ? content as T : JSON.parse(content) as T
    } catch {
      return null
    }
  }
}

/**
 * 数据服务类
 */
export class DataStore {
  constructor(
    private readonly files: FileStore,
    private readonly extract: any
  ) {}

  /**
   * 获取命令数据
   */
  async getCommands(cmdName: string, session: any, locale: string) {
    const key = cmdName ? cmdName : 'commands'
    let data = await this.files.read<any>('command', key, locale)
    if (!data) {
      if (cmdName) {
        const all = await this.files.read<any[]>('command', 'commands', locale)
        data = all?.find(c => c.name === cmdName) || all?.flatMap(c => c.subCommands || []).find(s => s.name === cmdName) || await this.extract.getSingle(session, cmdName, locale)
        if (data) await this.files.write('command', cmdName, data, locale)
      } else {
        data = await this.extract.getAll(session, locale)
        await this.files.write('command', 'commands', data, locale)
      }
    }
    return Array.isArray(data) ? data : data ? [data] : []
  }

  /**
   * 获取布局数据
   */
  async getLayout(cmdName: string, commands: any[]) {
    const key = cmdName ? cmdName : 'main'
    let layout = await this.files.read('layout', key)
    if (!layout) {
      layout = await createLayout(cmdName, commands)
      if (layout) await this.files.write('layout', key, layout)
    }
    return layout
  }
}