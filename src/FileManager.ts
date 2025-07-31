import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import * as fs from 'fs/promises'
import * as path from 'path'
import { Logger } from 'koishi'
import { Config } from './index'

/**
 * 管理本地或 S3 上的资源文件。
 * 封装了文件的读、写、删除操作，并内置了本地文件锁以防止并发冲突。
 */
export class FileManager {
  private resourceDir: string
  private locks = new Map<string, Promise<any>>() // 本地文件锁，防止并发写入冲突
  private logger: Logger
  private s3Client?: S3Client
  private s3Bucket?: string

  /**
   * @param baseDir Koishi 的基础数据目录
   * @param logger 日志记录器
   * @param config 插件的完整配置对象
   */
  constructor(baseDir: string, logger: Logger, config: Config) {
    this.logger = logger
    // 资源文件统一存储在 Koishi data 目录的 cave 子目录下
    this.resourceDir = path.join(baseDir, 'data', 'cave')

    // 如果启用了 S3，则初始化 S3 客户端
    if (config.enableS3 && config.endpoint && config.bucket && config.accessKeyId && config.secretAccessKey) {
      this.s3Client = new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      })
      this.s3Bucket = config.bucket
    }
  }

  /**
   * 确保本地资源目录存在。
   * 这是一个幂等操作，如果目录已存在则什么也不做。
   * @private
   */
  private async ensureDirectory(): Promise<void> {
    try {
      // 递归创建目录，如果目录已存在则不会报错
      await fs.mkdir(this.resourceDir, { recursive: true })
    } catch (error) {
      this.logger.error(`创建资源目录失败 ${this.resourceDir}:`, error)
      throw error // 抛出错误以中断后续操作
    }
  }

  /**
   * 获取文件的本地绝对路径。
   * @param fileName - 文件名
   * @returns 文件的绝对路径
   * @private
   */
  private getFullPath(fileName: string): string {
    return path.join(this.resourceDir, fileName)
  }

  /**
   * 使用文件锁执行一个异步操作，以防止对同一文件的并发访问。
   * @param fileName - 要锁定的文件名
   * @param operation - 要执行的异步操作
   * @returns 操作的返回结果
   * @private
   */
  private async withLock<T>(fileName: string, operation: () => Promise<T>): Promise<T> {
    const fullPath = this.getFullPath(fileName)
    // 等待该文件的上一个操作完成
    while (this.locks.has(fullPath)) {
      await this.locks.get(fullPath)
    }

    // 添加新锁并执行操作，操作完成后自动释放锁
    const promise = operation().finally(() => {
      this.locks.delete(fullPath)
    })
    this.locks.set(fullPath, promise)
    return promise
  }

  /**
   * 保存文件（自动选择 S3 或本地存储）。
   * @param fileName - 文件名（作为 S3 Key 或本地文件名）
   * @param data - 要写入的 Buffer 数据
   * @returns 文件名
   */
  public async saveFile(fileName: string, data: Buffer): Promise<string> {
    if (this.s3Client) {
      // S3 模式：上传文件
      const command = new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: fileName,
        Body: data,
        ACL: 'public-read', // 默认设为公开可读
      })
      await this.s3Client.send(command)
      return fileName // 返回文件名作为 S3 Key
    } else {
      // 本地模式：保存文件
      await this.ensureDirectory()
      const filePath = this.getFullPath(fileName)
      await this.withLock(fileName, () => fs.writeFile(filePath, data))
      return fileName // 返回文件名作为本地标识符
    }
  }

  /**
   * 读取文件（自动从 S3 或本地读取）。
   * @param fileName - 文件名
   * @returns 文件的 Buffer 数据
   */
  public async readFile(fileName: string): Promise<Buffer> {
    if (this.s3Client) {
      // S3 模式：下载文件
      const command = new GetObjectCommand({
        Bucket: this.s3Bucket,
        Key: fileName,
      })
      const response = await this.s3Client.send(command)
      // 将 S3 返回的 Stream 转换为 Buffer
      const byteArray = await response.Body.transformToByteArray()
      return Buffer.from(byteArray)
    } else {
      // 本地模式：读取文件
      const filePath = this.getFullPath(fileName)
      return this.withLock(fileName, () => fs.readFile(filePath))
    }
  }

  /**
   * 删除文件（自动从 S3 或本地删除）。
   * @param fileIdentifier - 文件标识符（文件名）
   */
  public async deleteFile(fileIdentifier: string): Promise<void> {
    if (this.s3Client) {
      // S3 模式：删除对象
      const command = new DeleteObjectCommand({
        Bucket: this.s3Bucket,
        Key: fileIdentifier,
      })
      // S3 删除失败通常可以接受，只记录警告
      await this.s3Client.send(command).catch(err => {
        this.logger.warn(`删除文件 ${fileIdentifier} 失败:`, err)
      })
    } else {
      // 本地模式：删除文件
      const filePath = this.getFullPath(fileIdentifier)
      await this.withLock(fileIdentifier, async () => {
        try {
          await fs.unlink(filePath)
        } catch (error) {
          // 如果文件本身就不存在 (ENOENT)，则忽略错误，保证操作的幂等性
          if (error.code !== 'ENOENT') {
            this.logger.warn(`删除文件 ${filePath} 失败:`, error)
          }
        }
      })
    }
  }
}
