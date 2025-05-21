import { Context, Schema, Logger } from 'koishi'
import { Extract } from './extract'
import { join } from 'path'

export const name = 'test'
export const logger = new Logger('test')
export interface Config {}
export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {
  const extractor = new Extract(ctx)
  const localeCache = new Map<string, Promise<boolean>>()

  // 初始化数据目录 - 内联 initialize 方法
  ctx.on('ready', () => {
    const dirPath = join(ctx.baseDir, 'data/test')
    return extractor.file.initializeDir(dirPath)
      .catch(err => logger.error('初始化数据目录失败:', err))
      .then(() => {})
  })

  // 命令：手动提取指定语言的命令数据
  ctx.command('test.extract [locale]', '提取命令数据')
    .option('clear', '-c 清除已有的缓存')
    .action(async ({ session, options }, locale) => {
      if (!session) return '无法获取会话信息'

      try {
        const targetLocale = locale || extractor.getUserLocale(session)

        // 内联 updateLocale 方法
        if (targetLocale) extractor.locale = targetLocale

        // 清除缓存
        if (options.clear) {
          await extractor.clearCache()
          localeCache.delete(targetLocale)
          await session.send(`已清除${targetLocale}语言的命令数据缓存`)
        }

        await session.send(`开始提取${targetLocale}语言的命令数据...`)

        const extractPromise = (async () => {
          try {
            // 非强制模式先尝试从缓存加载
            const cached = !options.clear && await extractor.loadCommandsData()
            if (cached) {
              logger.info(`已加载${targetLocale}语言命令缓存，共${cached.length}个命令`)
              return true
            }

            // 提取命令数据
            logger.info(`提取${targetLocale}语言命令数据...`)
            const commands = await extractor.getProcessedCommands(targetLocale)
            const success = await extractor.saveCommandsData(commands)

            if (success) {
              logger.info(`命令数据提取完成(${targetLocale})，共${commands.length}个命令`)
              return true
            } else {
              logger.error(`保存${targetLocale}命令数据失败`)
              return false
            }
          } catch (err) {
            logger.error(`提取${targetLocale}命令数据出错:`, err)
            return false
          }
        })()

        localeCache.set(targetLocale, extractPromise)
        const result = await extractPromise
        if (!result) localeCache.delete(targetLocale)

        return result
          ? `命令数据提取完成(${targetLocale})`
          : `命令数据提取失败(${targetLocale})，详情请查看日志`
      } catch (err) {
        logger.error('命令执行失败:', err)
        return '命令执行出错，详情请查看日志'
      }
    })
}