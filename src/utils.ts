import { promises as fs, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { logger } from './index'

/**
 * 文件操作工具类
 * @class File
 */
export class File {
  public basePath: string

  /**
   * 创建文件操作工具实例
   * @param {string} baseDir 基础目录路径
   */
  constructor(baseDir: string) {
    this.basePath = resolve(baseDir)
  }

  /**
   * 确保目录存在
   * @param {string} path 路径
   * @returns {Promise<boolean>} 是否成功
   */
  public async ensureDir(path: string): Promise<boolean> {
    try {
      const dir = dirname(path)
      if (!existsSync(dir)) await fs.mkdir(dir, { recursive: true })
      return true
    } catch (err) {
      logger.error('创建目录失败', err)
      return false
    }
  }

  /**
   * 写入文件
   * @param {string} path 文件路径
   * @param {string} data 文件内容
   * @returns {Promise<boolean>} 是否成功
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

  /**
   * 读取文件
   * @param {string} path 文件路径
   * @returns {Promise<string|null>} 文件内容或null
   */
  public async readFile(path: string): Promise<string|null> {
    if (!existsSync(path)) return null
    try {
      return await fs.readFile(path, 'utf8')
    } catch (err) {
      logger.error(`读取文件失败: ${path}`, err)
      return null
    }
  }
}