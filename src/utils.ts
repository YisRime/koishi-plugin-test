import { promises as fs, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { logger } from './index'

/**
 * 文件操作类
 */
export class File {
  private basePath: string

  constructor(baseDir: string) {
    this.basePath = resolve(baseDir)
  }

  /**
   * 确保目录存在
   */
  public async ensureDir(path: string): Promise<boolean> {
    try {
      const dir = dirname(path)
      if (!existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true })
      }
      return true
    } catch (err) {
      logger.error('创建目录失败', err)
      return false
    }
  }

  /**
   * 文件操作: 写入/读取/删除
   */
  public async writeFile(path: string, data: string): Promise<boolean> {
    try {
      await this.ensureDir(path)
      await fs.writeFile(path, data, 'utf8')
      return true
    } catch (err) {
      logger.error(`写入文件失败: ${path}`, err)
      return false
    }
  }

  public async readFile(path: string): Promise<string|null> {
    if (!existsSync(path)) return null
    try {
      return await fs.readFile(path, 'utf8')
    } catch (err) {
      logger.error(`读取文件失败: ${path}`, err)
      return null
    }
  }

  public async deleteFile(path: string): Promise<boolean> {
    if (!existsSync(path)) return true
    try {
      await fs.unlink(path)
      return true
    } catch (err) {
      logger.error(`删除文件失败: ${path}`, err)
      return false
    }
  }

  /**
   * 检查文件是否存在
   */
  public fileExists(path: string): boolean {
    return existsSync(path)
  }

  /**
   * 列出目录中的所有文件
   */
  public async listFiles(dirPath: string): Promise<string[]> {
    try {
      const dir = resolve(this.basePath, dirPath)
      if (!existsSync(dir)) return []
      const files = await fs.readdir(dir)
      return files
    } catch (err) {
      logger.error(`读取目录失败: ${dirPath}`, err)
      return []
    }
  }

  /**
   * 复制文件
   */
  public async copyFile(source: string, target: string): Promise<boolean> {
    try {
      await this.ensureDir(target)
      await fs.copyFile(source, target)
      return true
    } catch (err) {
      logger.error(`复制文件失败: ${source} -> ${target}`, err)
      return false
    }
  }
}