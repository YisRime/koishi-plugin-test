import * as fs from 'fs/promises'
import * as path from 'path'
import { Logger } from 'koishi'

/**
 * FileManager 类负责管理插件的本地资源文件，
 * 包括文件的读、写、删除，并内置了防止并发冲突的文件锁机制。
 */
export class FileManager {
  private resourceDir: string
  // 使用 Map 来为文件操作加锁，防止对同一文件的并发读写冲突
  private locks = new Map<string, Promise<any>>()

  // 在构造函数中接收 logger 实例
  constructor(baseDir: string, private logger: Logger) {
    // 确保资源文件存放在 Koishi 数据目录下的特定子目录中，便于管理
    this.resourceDir = path.join(baseDir, 'data', 'cave')
  }

  /**
   * 确保资源目录存在，如果不存在则以递归方式创建它。
   * 此方法是幂等的，即多次调用效果和一次相同。
   * @private
   */
  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.resourceDir, { recursive: true })
    } catch (error) {
      // 如果错误不是 "目录已存在" (EEXIST)，则记录并向上抛出错误
      if (error.code !== 'EEXIST') {
        this.logger.error(`创建资源目录失败 ${this.resourceDir}:`, error)
        throw error
      }
      // 如果是 EEXIST，表示目录已存在，这是正常情况，无需额外操作。
    }
  }

  /**
   * 根据文件名获取其在资源目录中的完整绝对路径。
   * @param fileName 文件名
   * @returns 文件的绝对路径
   * @private
   */
  private getFullPath(fileName: string): string {
    return path.join(this.resourceDir, fileName);
  }

  /**
   * 文件操作锁的包装函数，确保同一时间只有一个操作在访问同一个文件。
   * @param fileName 要锁定的文件名
   * @param operation 要执行的异步操作函数
   * @returns operation 函数的返回结果
   * @private
   */
  private async withLock<T>(fileName: string, operation: () => Promise<T>): Promise<T> {
    const fullPath = this.getFullPath(fileName);
    // 如果当前文件已被锁定，则等待上一个操作完成
    while (this.locks.has(fullPath)) {
      await this.locks.get(fullPath)
    }
    // 执行操作，并将 promise 存入锁中
    const promise = operation().finally(() => {
      // 无论操作成功或失败，最后都必须释放锁
      this.locks.delete(fullPath)
    })
    this.locks.set(fullPath, promise)
    return promise
  }

  /**
   * 保存文件到资源目录。
   * @param fileName 文件名（不含路径）
   * @param data 要写入的 Buffer 数据
   */
  public async saveFile(fileName: string, data: Buffer): Promise<void> {
    // 在尝试写入文件之前，首先确保目标目录存在。
    await this.ensureDirectory();
    const filePath = this.getFullPath(fileName);
    await this.withLock(fileName, () => fs.writeFile(filePath, data));
  }

  /**
   * 从资源目录读取文件。
   * @param fileName 文件名（不含路径）
   * @returns 文件的 Buffer 数据
   */
  public async readFile(fileName: string): Promise<Buffer> {
    const filePath = this.getFullPath(fileName);
    // 读取操作不需要 ensureDirectory，因为如果文件存在，目录必然也存在。
    return this.withLock(fileName, () => fs.readFile(filePath));
  }

  /**
   * 从资源目录删除文件。
   * @param fileName 文件名（不含路径）
   */
  public async deleteFile(fileName: string): Promise<void> {
    const filePath = this.getFullPath(fileName);
    await this.withLock(fileName, async () => {
      try {
        await fs.unlink(filePath)
      } catch (error) {
        // 如果文件不存在等原因导致删除失败，仅记录警告而不抛出异常，增强程序鲁棒性。
        this.logger.warn(`删除文件失败 ${filePath}:`, error)
      }
    })
  }
}
