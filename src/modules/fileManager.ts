import { Context } from 'koishi'
import { promises as fs } from 'fs'
import { join } from 'path'

export interface FileConfig {
  path?: string
  name?: string
}

export class FileManager {
  private path: string

  constructor(private ctx: Context, config: FileConfig = {}) {
    this.path = join(ctx.baseDir, 'data', config.name || 'cave.json')
  }

  async save(data: any): Promise<void> {
    try {
      await fs.mkdir(join(this.ctx.baseDir, 'data'), { recursive: true })
      await fs.writeFile(this.path, JSON.stringify(data, null, 2))
    } catch (error) {
      this.ctx.logger.error('保存失败:', error)
    }
  }

  async load(): Promise<any> {
    try {
      const data = await fs.readFile(this.path, 'utf8')
      return JSON.parse(data)
    } catch (error) {
      return {}
    }
  }

  async exists(): Promise<boolean> {
    try {
      await fs.access(this.path)
      return true
    } catch {
      return false
    }
  }
}
