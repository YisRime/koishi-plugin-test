import { Context, Schema, Logger, h } from 'koishi'
import { Extract } from './extract'
import { Renderer, StyleConfig } from './render'
import { Converter } from './converter'

export const name = 'test'
export const inject = ['puppeteer']
export const logger = new Logger('test')

// 扁平化配置接口
export interface Config {
  // 基础样式配置
  width?: number;
  height?: number;
  background?: string;
  accentColor?: string;
  fontFamily?: string;
  fontSize?: number;
  containerRadius?: number;

  // 网格项样式配置
  itemRadius?: number;
  itemBackground?: string;
  itemPadding?: string;
  itemBorder?: string;
  itemBorderColor?: string;
  itemBorderWidth?: number;
  itemShadow?: string;
  itemSpacing?: number;
  textColor?: string;

  // 内容样式配置
  titleSize?: number;
  titleWeight?: string;
  titleColor?: string;
  contentSize?: number;
  contentLineHeight?: number;
  contentWhiteSpace?: string;
  contentMaxHeight?: string;
  contentOverflow?: string;

  // 装饰样式配置
  iconSize?: number;
  iconColor?: string;
  badgeBackground?: string;
  badgeColor?: string;
  badgeSize?: number;
  badgePadding?: string;

  // 布局样式配置
  headerBackground?: string;
  headerColor?: string;
  footerBackground?: string;
  footerColor?: string;
  headerPadding?: string;
  footerPadding?: string;

  // 页眉配置
  showHeader?: boolean;
  headerTitle?: string;
  headerLogo?: string;
  headerHeight?: number;
  headerStyle?: Record<string, any>;

  // 页脚配置
  showFooter?: boolean;
  footerText?: string;
  footerStyle?: Record<string, any>;

  // 子命令和选项样式
  subCommandBackground?: string;
  subCommandBorderColor?: string;
  subCommandIconColor?: string;

  optionBackground?: string;
  optionBorderColor?: string;
  optionIconColor?: string;
}

export const Config: Schema<Config> = Schema.intersect([
  // 基础样式
  Schema.object({
    width: Schema.number().default(800).description('总宽度'),
    height: Schema.number().description('总高度(自动计算)'),
    background: Schema.string().default('#ffffff').description('背景'),
    accentColor: Schema.string().default('#6750a4').description('强调色'),
    fontFamily: Schema.string().default("'Roboto', 'Noto Sans SC', sans-serif").description('字体'),
    fontSize: Schema.number().default(14).description('字体大小'),
    containerRadius: Schema.number().default(16).description('容器圆角'),
    textColor: Schema.string().default('#1c1b1f').description('文字颜色'),
  }).description('基础样式'),

  // 网格项样式
  Schema.object({
    itemRadius: Schema.number().default(12).description('项目圆角'),
    itemBackground: Schema.string().default('#ffffff').description('项目背景色'),
    itemPadding: Schema.string().default('12px').description('项目内边距'),
    itemBorder: Schema.string().description('项目边框'),
    itemBorderColor: Schema.string().default('rgba(0,0,0,0.08)').description('项目边框颜色'),
    itemBorderWidth: Schema.number().description('项目边框宽度'),
    itemShadow: Schema.string().default('0 1px 4px rgba(0,0,0,0.05)').description('阴影效果'),
    itemSpacing: Schema.number().default(10).description('项目间距'),
  }).description('网格项样式'),

  // 内容样式
  Schema.object({
    titleSize: Schema.number().default(1.1).description('标题字体大小'),
    titleWeight: Schema.string().default('600').description('标题字重'),
    titleColor: Schema.string().default('inherit').description('标题颜色'),
    contentSize: Schema.number().default(14).description('内容字体大小'),
    contentLineHeight: Schema.number().default(1.5).description('内容行高'),
    contentWhiteSpace: Schema.string().default('pre-wrap').description('文本换行处理方式'),
    contentMaxHeight: Schema.string().default('none').description('内容最大高度'),
    contentOverflow: Schema.string().default('auto').description('溢出处理'),
  }).description('内容样式'),

  // 装饰样式
  Schema.object({
    iconSize: Schema.number().default(20).description('图标大小'),
    iconColor: Schema.string().default('#6750a4').description('图标颜色'),
    badgeBackground: Schema.string().default('#6750a4').description('徽章背景色'),
    badgeColor: Schema.string().default('white').description('徽章文字颜色'),
    badgeSize: Schema.number().default(0.75).description('徽章字体大小'),
    badgePadding: Schema.string().default('2px 6px').description('徽章内边距'),
  }).description('装饰样式'),

  // 布局样式
  Schema.object({
    headerBackground: Schema.string().default('#ede7f6').description('页眉背景色'),
    headerColor: Schema.string().default('#311b92').description('页眉文字颜色'),
    footerBackground: Schema.string().default('#e0e0e0').description('页脚背景色'),
    footerColor: Schema.string().default('#616161').description('页脚文字颜色'),
    headerPadding: Schema.string().default('12px').description('页眉内边距'),
    footerPadding: Schema.string().default('10px').description('页脚内边距'),
  }).description('布局样式'),

  // 页眉配置
  Schema.object({
    showHeader: Schema.boolean().default(true).description('是否显示页眉'),
    headerTitle: Schema.string().default('命令帮助').description('页眉标题'),
    headerLogo: Schema.string().description('页眉Logo图片路径'),
    headerHeight: Schema.number().description('页眉高度'),
    headerStyle: Schema.dict(Schema.any()).description('页眉自定义样式'),
  }).description('页眉配置'),

  // 页脚配置
  Schema.object({
    showFooter: Schema.boolean().default(true).description('是否显示页脚'),
    footerText: Schema.string().default('Powered by Koishi').description('页脚文本'),
    footerStyle: Schema.dict(Schema.any()).description('页脚自定义样式'),
  }).description('页脚配置'),

  // 子命令样式
  Schema.object({
    subCommandBackground: Schema.string().default('#f8f0fc').description('子命令背景色'),
    subCommandBorderColor: Schema.string().default('#d0bfff').description('子命令边框颜色'),
    subCommandIconColor: Schema.string().default('#9c27b0').description('子命令图标颜色')
  }).description('子命令样式'),

  // 选项样式
  Schema.object({
    optionBackground: Schema.string().default('#f1f5fe').description('选项背景色'),
    optionBorderColor: Schema.string().default('#bbdefb').description('选项边框颜色'),
    optionIconColor: Schema.string().default('#1565c0').description('选项图标颜色')
  }).description('选项样式'),
])

export function apply(ctx: Context, config: Config) {
  // 初始化主要组件
  const extractor = new Extract(ctx)
  const converter = new Converter(ctx.baseDir)
  const renderer = new Renderer(ctx)

  // 菜单命令 - 简化，无选项
  ctx.command('menu [command:string]', '显示命令菜单')
    .action(async ({ session }, command) => {
      try {
        // 获取用户语言
        const locale = extractor.getUserLocale(session)
        logger.info(`处理菜单请求: ${command || '主菜单'} (${locale})`)

        // 1. 加载命令内容数据
        let commands = await extractor.loadCommandsData(locale)
        if (!commands) {
          commands = await extractor.getProcessedCommands(locale)
          await extractor.saveCommandsData(commands, locale)
        }

        // 2. 加载布局数据
        let layoutData = await converter.loadLayoutData()
        if (!layoutData) {
          layoutData = await converter.createAndSaveLayoutData(commands)
        }

        // 3. 生成内容配置
        const contentConfig = await converter.createContentConfig(
          command,
          commands,
          layoutData,
          config.headerLogo
        )

        if (!contentConfig) {
          return `找不到命令: ${command || '主菜单'}`
        }

        // 4. 从扁平配置中提取样式配置
        const styleConfig: StyleConfig = {
          // 基础样式
          width: config.width,
          background: config.background,
          accentColor: config.accentColor,
          fontFamily: config.fontFamily,
          fontSize: config.fontSize,
          containerRadius: config.containerRadius,
          textColor: config.textColor,

          // 网格项样式
          itemRadius: config.itemRadius,
          itemBackground: config.itemBackground,
          itemPadding: config.itemPadding,
          itemBorder: config.itemBorder,
          itemBorderColor: config.itemBorderColor,
          itemShadow: config.itemShadow,
          itemSpacing: config.itemSpacing,

          // 内容样式
          titleSize: config.titleSize,
          titleWeight: config.titleWeight,
          titleColor: config.titleColor,
          contentSize: config.contentSize,
          contentLineHeight: config.contentLineHeight,
          contentWhiteSpace: config.contentWhiteSpace,
          contentMaxHeight: config.contentMaxHeight,
          contentOverflow: config.contentOverflow,

          // 装饰样式
          iconSize: config.iconSize,
          iconColor: config.iconColor,
          badgeBackground: config.badgeBackground,
          badgeColor: config.badgeColor,
          badgeSize: config.badgeSize,
          badgePadding: config.badgePadding,

          // 布局样式
          headerBackground: config.headerBackground,
          headerColor: config.headerColor,
          footerBackground: config.footerBackground,
          footerColor: config.footerColor,
          headerPadding: config.headerPadding,
          footerPadding: config.footerPadding,

          // 添加子命令和选项样式
          subCommandBackground: config.subCommandBackground,
          subCommandBorderColor: config.subCommandBorderColor,
          subCommandIconColor: config.subCommandIconColor,

          optionBackground: config.optionBackground,
          optionBorderColor: config.optionBorderColor,
          optionIconColor: config.optionIconColor,
        }

        // 应用页眉页脚配置
        contentConfig.header.show = config.showHeader ?? true
        contentConfig.header.title = config.headerTitle || contentConfig.header.title
        contentConfig.header.logo = config.headerLogo || contentConfig.header.logo

        contentConfig.footer.show = config.showFooter ?? true
        contentConfig.footer.text = config.footerText || contentConfig.footer.text

        // 渲染并返回图片
        const imageBuffer = await renderer.render(contentConfig, styleConfig)
        return h.image(imageBuffer, 'image/png')
      } catch (err) {
        logger.error('菜单渲染失败', err)
        return `菜单生成失败: ${err.message}`
      }
    })

  // 管理命令
  ctx.command('menu.manage', '管理命令菜单配置')
    .option('extract', '-e 提取并更新命令菜单', { fallback: false })
    .action(async ({ session, options }) => {
      // 获取用户语言
      const locale = extractor.getUserLocale(session)

      // 提取并更新菜单
      if (options.extract) {
        try {
          // 1. 提取命令数据
          const commands = await extractor.getProcessedCommands(locale)
          await extractor.saveCommandsData(commands, locale)

          // 2. 生成并保存布局数据
          await converter.createAndSaveLayoutData(commands)

          return '✅ 已更新菜单配置'
        } catch (err) {
          logger.error('更新菜单失败', err)
          return `❌ 更新菜单失败: ${err.message}`
        }
      }

      return '请使用 -e 选项提取并更新菜单'
    })
}
