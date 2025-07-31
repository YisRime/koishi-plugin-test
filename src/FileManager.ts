import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import * as fs from 'fs/promises'
import * as path from 'path'
import { Logger } from 'koishi'
import { Config } from './index'

/**
 * FileManager 类负责管理插件的本地或远程（S3）资源文件，
 * 包括文件的读、写、删除，并内置了防止本地文件并发冲突的文件锁机制。
 */
export class FileManager {
  private resourceDir: string
  // 使用 Map 来为本地文件操作加锁，防止对同一文件的并发读写冲突
  private locks = new Map<string, Promise<any>>()
  private logger: Logger

  // S3 相关属性
  private s3Client?: S3Client
  private s3Bucket?: string
  private s3PublicUrl?: string

  /**
   * 在构造函数中接收 logger 实例和插件配置。
   * @param baseDir Koishi 的基础目录
   * @param logger 日志记录器
   * @param config 插件的完整配置对象
   */
  constructor(baseDir: string, logger: Logger, config: Config) {
    this.logger = logger
    // 确保资源文件存放在 Koishi 数据目录下的特定子目录中，便于管理
    this.resourceDir = path.join(baseDir, 'data', 'cave')

    // 如果启用了 S3 并提供了必要的配置，则初始化 S3 客户端
    if (config.enableS3 && config.s3?.endpoint && config.s3?.bucket && config.s3?.accessKeyId && config.s3?.secretAccessKey) {
      this.s3Client = new S3Client({
        endpoint: config.s3.endpoint,
        region: config.s3.region || 'auto',
        credentials: {
          accessKeyId: config.s3.accessKeyId,
          secretAccessKey: config.s3.secretAccessKey,
        },
      })
      this.s3Bucket = config.s3.bucket
      // 优先使用用户自定义的公共URL，否则根据endpoint和bucket自动生成
      this.s3PublicUrl = config.s3.publicUrl || `https://${config.s3.endpoint}`
    }
  }

  /**
   * 确保本地资源目录存在，如果不存在则以递归方式创建它。
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
   * 根据文件名获取其在本地资源目录中的完整绝对路径。
   * @param fileName 文件名
   * @returns 文件的绝对路径
   * @private
   */
  private getFullPath(fileName: string): string {
    return path.join(this.resourceDir, fileName)
  }

  /**
   * 本地文件操作锁的包装函数，确保同一时间只有一个操作在访问同一个文件。
   * @param fileName 要锁定的文件名
   * @param operation 要执行的异步操作函数
   * @returns operation 函数的返回结果
   * @private
   */
  private async withLock<T>(fileName: string, operation: () => Promise<T>): Promise<T> {
    const fullPath = this.getFullPath(fileName)
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
   * 保存文件。如果S3启用，则上传到S3；否则保存到本地。统一返回文件名。
   * @param fileName 文件名（作为 S3 的 Key 或本地文件名）
   * @param data 要写入的 Buffer 数据
   * @returns 文件名
   */
  public async saveFile(fileName: string, data: Buffer): Promise<string> {
    // 如果 S3 客户端已初始化，则上传到 S3
    if (this.s3Client) {
      const command = new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: fileName,
        Body: data,
        ACL: 'public-read', // 默认设为公开可读
      })
      try {
        await this.s3Client.send(command)
        // 上传成功后，只返回文件名（即 S3 Key）
        return fileName
      } catch (error) {
        this.logger.error(`上传文件失败 ${fileName}:`, error)
        throw error
      }
    } else {
      // 否则，使用原有的本地文件保存逻辑
      await this.ensureDirectory()
      const filePath = this.getFullPath(fileName)
      await this.withLock(fileName, () => fs.writeFile(filePath, data))
      return fileName // 返回文件名作为本地标识
    }
  }

  /**
   * 从本地资源目录读取文件。此方法在启用 S3 时不应被调用。
   * @param fileName 文件名（不含路径）
   * @returns 文件的 Buffer 数据
   */
  public async readFile(fileName: string): Promise<Buffer> {
    // 此方法仅适用于本地文件系统。S3 模式下，文件应通过 URL 直接访问。
    if (this.s3Client) {
      // 在新逻辑下，readFile 不应在 S3 模式下被外部逻辑（除了导入导出）调用
      this.logger.warn(`readFile 在 S3 模式下被调用，文件名: ${fileName}`);
      return Buffer.from('')
    }
    const filePath = this.getFullPath(fileName)
    return this.withLock(fileName, () => fs.readFile(filePath))
  }

  /**
   * 删除文件。自动判断是从 S3 删除还是从本地删除。
   * @param fileIdentifier 文件标识符（文件名）
   */
  public async deleteFile(fileIdentifier: string): Promise<void> {
    // 如果 S3 客户端已初始化，则将标识符视为 S3 Key 并从 S3 删除
    if (this.s3Client) {
      try {
        // fileIdentifier 现在就是 S3 的 Key（即文件名），直接使用
        const command = new DeleteObjectCommand({
          Bucket: this.s3Bucket,
          Key: fileIdentifier,
        })
        await this.s3Client.send(command)
      } catch (error) {
        this.logger.warn(`从 S3 删除文件失败 ${fileIdentifier}:`, error)
      }
    } else {
      // 否则，标识符就是本地文件名，从本地文件系统删除
      const filePath = this.getFullPath(fileIdentifier)
      await this.withLock(fileIdentifier, async () => {
        try {
          await fs.unlink(filePath)
        } catch (error) {
          // 如果文件不存在，则忽略错误，增强鲁棒性
          if (error.code !== 'ENOENT') {
            this.logger.warn(`删除本地文件失败 ${filePath}:`, error)
          }
        }
      })
    }
  }
}
