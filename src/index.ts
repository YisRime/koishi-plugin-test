import { Context, Schema, Logger, h } from 'koishi'
import { Extract } from './extract'
import { Renderer, RenderConfig } from './render'

export const name = 'test'
export const inject = ['puppeteer']
export const logger = new Logger('test')

export interface Config {
  autoExtract: boolean
  render: RenderConfig
}

export const Config: Schema<Config> = Schema.object({
  autoExtract: Schema.boolean().default(false).description('初始化时自动提取命令'),
  render: Schema.object({
    header: Schema.object({
      show: Schema.boolean().default(true).description('是否显示页眉'),
      title: Schema.string().description('标题'),
      logo: Schema.string().description('Logo图片路径')
    }).description('页眉配置'),
    footer: Schema.object({
      show: Schema.boolean().default(true).description('是否显示页脚'),
      text: Schema.string().description('页脚文本')
    }).description('页脚配置'),
    layout: Schema.object({
      rows: Schema.number().default(3).description('网格行数'),
      cols: Schema.number().default(2).description('网格列数'),
      gap: Schema.number().default(10).description('网格间隙'),
      items: Schema.array(Schema.object({
        row: Schema.number().required().description('起始行'),
        col: Schema.number().required().description('起始列'),
        rowSpan: Schema.number().default(1).description('跨行数'),
        colSpan: Schema.number().default(1).description('跨列数'),
        type: Schema.union([
          Schema.const('text').description('文本内容'),
          Schema.const('image').description('图片内容'),
          Schema.const('custom').description('自定义内容')
        ]).required().description('内容类型'),
        content: Schema.string().required().description('内容或路径'),
        style: Schema.dict(Schema.any()).description('自定义样式')
      })).default([]).description('网格内容项')
    }).description('布局配置'),
    style: Schema.object({
      width: Schema.number().default(800).description('总宽度'),
      background: Schema.string().default('#ffffff').description('背景')
    }).description('样式配置')
  }).description('渲染配置')
})

export function apply(ctx: Context, config: Config) {
  const extractor = new Extract(ctx)

  // 创建渲染器实例 - 简化版
  const renderer = new Renderer(ctx, config.render)

  // 注册简化版render命令
  ctx.command('test.render', '渲染帮助图片')
    .action(async ({ session }) => {
      try {
        // 渲染图片
        logger.info('渲染帮助图片')
        const image = await renderer.render()

        // 直接返回图片，不显示额外提示
        return h.image(image, 'image/png')
      } catch (err) {
        logger.error('渲染帮助图片失败', err)
        return `渲染失败：${err.message}`
      }
    })

  if (config.autoExtract) {
    ctx.on('ready', async () => {
      try {
        // 获取当前默认语言
        const targetLocale = extractor.getUserLocale(null)
        if (!targetLocale) return
        extractor.locale = targetLocale
        // 尝试从缓存加载
        const cached = await extractor.loadCommandsData()
        if (cached) return
        // 提取命令数据
        const commands = await extractor.getProcessedCommands(targetLocale)
        const success = await extractor.saveCommandsData(commands)
        if (success) logger.info(`自动提取(${targetLocale})命令数据完成，共${commands.length}个`)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        logger.error(`自动提取命令数据失败: ${message}`, err)
      }
    })
  }
}