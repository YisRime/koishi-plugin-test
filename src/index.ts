import { Context, Schema, Logger } from 'koishi'
import { Extract } from './extract'

export const name = 'test'
export const logger = new Logger('test')

export interface Config {}
export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {
  const extractor = new Extract(ctx)

  // 删除初始化数据目录的代码

  // 命令：手动提取指定语言的命令数据
  ctx.command('extract [locale]', '提取命令数据')
    .action(async ({ session }, locale) => {
      if (!session) return '无法获取会话信息'

      try {
        const targetLocale = locale || extractor.getUserLocale(session)
        if (!targetLocale) throw new Error('无法确定目标语言')
        extractor.locale = targetLocale

        // 尝试从缓存加载
        const cached = await extractor.loadCommandsData()
        if (cached) {
          logger.info(`已加载${targetLocale}语言命令缓存，共${cached.length}个命令`)
          return `命令数据提取完成(${targetLocale})`
        }

        // 提取命令数据
        const commands = await extractor.getProcessedCommands(targetLocale)
        const success = await extractor.saveCommandsData(commands)

        if (!success) throw new Error(`保存${targetLocale}命令数据失败`)

        logger.info(`命令数据提取完成(${targetLocale})，共${commands.length}个命令`)
        return `命令数据提取完成(${targetLocale})`
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error(`命令执行失败: ${message}`, err)
        return `命令执行出错，详情请查看日志`
      }
    })
}