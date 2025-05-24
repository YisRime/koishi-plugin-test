import { Context, Schema, Logger, h } from 'koishi'
import { Extract } from './extract'
import { Renderer } from './render'
import { Converter } from './converter'

export const name = 'test'
export const inject = ['puppeteer']
export const logger = new Logger('test')

/**
 * 插件配置接口
 * @interface Config
 */
export interface Config {
  // 基础样式
  width?: number
  background?: string
  accentColor?: string
  fontFamily?: string
  fontSize?: number
  textColor?: string
  // 网格项样式
  itemStyle?: {
    radius?: number
    background?: string
    padding?: string
    borderColor?: string
    shadow?: string
    spacing?: number
  }
  // 内容样式
  textStyle?: {
    titleSize?: number
    titleWeight?: string
    titleColor?: string
    contentSize?: number
    lineHeight?: number
    whiteSpace?: string
  }
  // 图标和徽章
  iconStyle?: {
    size?: number
    color?: string
    badgeColor?: string
    badgeSize?: number
  }
  // 页眉和页脚
  header?: {
    show?: boolean
    title?: string
    logo?: string
    background?: string
    color?: string
  }
  footer?: {
    show?: boolean
    text?: string
    background?: string
    color?: string
  }
  // 特殊项样式
  specialStyles?: {
    subCommand?: {
      background?: string
      borderColor?: string
      iconColor?: string
    }
    option?: {
      background?: string
      borderColor?: string
      iconColor?: string
    }
  }
}

/**
 * 配置模式定义
 */
export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    width: Schema.number().default(600).description('总宽度'),
    background: Schema.string().default('#ffffff').description('背景颜色'),
    accentColor: Schema.string().default('#6750a4').description('主题色'),
    fontFamily: Schema.string().default("'Roboto', 'Noto Sans SC', sans-serif").description('字体'),
    fontSize: Schema.number().default(14).description('基础字体大小'),
    textColor: Schema.string().default('#1c1b1f').description('文字颜色'),
  }).description('基础设置'),
  Schema.object({
    itemStyle: Schema.object({
      radius: Schema.number().default(12).description('圆角'),
      background: Schema.string().default('#ffffff').description('背景色'),
      padding: Schema.string().default('12px').description('内边距'),
      borderColor: Schema.string().default('rgba(0,0,0,0.08)').description('边框颜色'),
      shadow: Schema.string().default('0 1px 4px rgba(0,0,0,0.05)').description('阴影'),
      spacing: Schema.number().default(10).description('间距'),
    }).description('项目样式设置'),
  }).description('布局样式'),
  Schema.object({
    textStyle: Schema.object({
      titleSize: Schema.number().default(1.1).description('标题大小'),
      titleWeight: Schema.string().default('600').description('标题字重'),
      titleColor: Schema.string().default('inherit').description('标题颜色'),
      contentSize: Schema.number().default(14).description('内容字号'),
      lineHeight: Schema.number().default(1.5).description('行高'),
      whiteSpace: Schema.string().default('pre-wrap').description('文本换行方式'),
    }).description('文本样式设置'),
  }).description('文本样式'),
  Schema.object({
    iconStyle: Schema.object({
      size: Schema.number().default(20).description('图标大小'),
      color: Schema.string().default('#6750a4').description('图标颜色'),
      badgeColor: Schema.string().default('white').description('徽章文字颜色'),
      badgeSize: Schema.number().default(0.75).description('徽章字号'),
    }).description('图标样式设置'),
  }).description('图标样式'),
  Schema.object({
    header: Schema.object({
      show: Schema.boolean().default(true).description('是否显示'),
      title: Schema.string().default('命令帮助').description('标题'),
      logo: Schema.string().description('Logo图片URL'),
      background: Schema.string().default('#ede7f6').description('背景色'),
      color: Schema.string().default('#311b92').description('文字颜色'),
    }).description('页眉设置'),
  }).description('页眉设置'),
  Schema.object({
    footer: Schema.object({
      show: Schema.boolean().default(true).description('是否显示'),
      text: Schema.string().default('Powered by Koishi').description('文本'),
      background: Schema.string().default('#e0e0e0').description('背景色'),
      color: Schema.string().default('#616161').description('文字颜色'),
    }).description('页脚设置'),
  }).description('页脚设置'),
  Schema.object({
    specialStyles: Schema.object({
      subCommand: Schema.object({
        background: Schema.string().default('#f8f0fc').description('背景色'),
        borderColor: Schema.string().default('#d0bfff').description('边框颜色'),
        iconColor: Schema.string().default('#9c27b0').description('图标颜色'),
      }).description('子命令样式'),
      option: Schema.object({
        background: Schema.string().default('#f1f5fe').description('背景色'),
        borderColor: Schema.string().default('#bbdefb').description('边框颜色'),
        iconColor: Schema.string().default('#1565c0').description('图标颜色'),
      }).description('选项样式'),
    }).description('特殊项样式'),
  }).description('特殊项样式'),
])

/**
 * 插件主函数
 * @param {Context} ctx Koishi上下文
 * @param {Config} config 插件配置
 */
export function apply(ctx: Context, config: Config) {
  const extractor = new Extract(ctx)
  const converter = new Converter(ctx.baseDir, config)
  const renderer = new Renderer(ctx, config)

  ctx.command('menu [command:string]', '显示命令菜单')
    .action(async ({ session }, command) => {
      try {
        const locale = extractor.getUserLocale(session)

        // 获取命令数据
        let commands = await extractor.loadCommandsData(locale)
        if (!commands) {
          commands = await extractor.getProcessedCommands(locale)
          await extractor.saveCommandsData(commands, locale)
        }

        // 命令键名
        const cmdKey = command || 'main'

        // 获取布局数据
        let layout = await converter.loadLayoutConfig(cmdKey)
        if (!layout) {
          layout = await converter.generateLayout(command, commands)
          await converter.saveLayoutConfig(cmdKey, layout)
        }

        if (!layout) return `找不到命令: ${command || '主菜单'}`

        // 渲染图片
        const image = await renderer.render(layout)
        return h.image(image, 'image/png')
      } catch (err) {
        logger.error('菜单渲染失败', err)
        return `菜单生成失败: ${err.message}`
      }
    })
}