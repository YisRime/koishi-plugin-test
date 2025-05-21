import { Context, Schema, Logger, h } from 'koishi'
import { Extract } from './extract'
import { Renderer, RenderConfig } from './render'
import { CommandConverter } from './converter'

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
      gap: Schema.number().default(16).description('网格间隙'),
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
        icon: Schema.string().description('图标名称或URL'),
        iconType: Schema.union([
          Schema.const('url').description('图片URL'),
          Schema.const('material').description('Material图标')
        ]).description('图标类型'),
        style: Schema.dict(Schema.any()).description('自定义样式')
      })).default([]).description('网格内容项')
    }).description('布局配置'),
    style: Schema.object({
      width: Schema.number().default(800).description('总宽度'),
      background: Schema.string().default('#ffffff').description('背景'),
      darkMode: Schema.boolean().default(false).description('暗色模式'),
      accentColor: Schema.string().default('#6750a4').description('强调色')
    }).description('样式配置')
  }).description('渲染配置')
})

export function apply(ctx: Context, config: Config) {
  const extractor = new Extract(ctx)
  const converter = new CommandConverter(ctx.baseDir, config.render)
  const renderer = new Renderer(ctx)

  // 初始化函数：加载命令数据并创建渲染器
  const initializeConfig = async (): Promise<void> => {
    try {
      // 获取默认语言设置
      const locale = extractor.getUserLocale(null)

      // 尝试加载已有的命令数据
      let commands = await extractor.loadCommandsData(locale)

      // 如果配置了自动提取，且没有找到缓存的命令数据，则立即提取
      if (config.autoExtract && (!commands || commands.length === 0)) {
        commands = await extractor.getProcessedCommands(locale)
        if (commands && commands.length > 0) {
          await extractor.saveCommandsData(commands, locale)
          logger.info(`初始化时已提取 ${commands.length} 个命令数据`)
        }
      }

      // 如果有命令数据，使用它生成默认配置并保存
      if (commands && commands.length > 0) {
        const configFromCommands = converter.convertToRenderConfig(commands)
        await converter.saveConfig(configFromCommands)
        logger.info('已保存基于命令数据的默认配置')
      }
    } catch (err) {
      logger.error('初始化命令渲染器失败', err)
    }
  }

  // 添加提取命令
  ctx.command('extract', '提取并保存命令数据')
    .action(async ({ session }) => {
      try {
        const locale = extractor.getUserLocale(session)
        const commands = await extractor.getProcessedCommands(locale)

        if (!commands || commands.length === 0) {
          return '未找到可用的命令'
        }

        // 保存命令数据
        const success = await extractor.saveCommandsData(commands, locale)
        if (!success) return '提取命令数据成功，但保存失败'

        // 使用转换后的配置作为新的默认配置
        const newConfig = converter.convertToRenderConfig(commands)
        await converter.saveConfig(newConfig)
        return `已成功提取 ${commands.length} 个命令数据，并设置为默认渲染配置。`
      } catch (err) {
        logger.error('提取命令数据失败', err)
        return `提取失败：${err.message}`
      }
    })

  // 注册命令渲染命令，使用贪婪文本匹配参数
  ctx.command('render [...command:text]', '渲染帮助图片')
    .option('sub', '-s 查看子命令列表')
    .option('index', '-i <index:number> 指定子命令索引', { fallback: 0 })
    .action(async ({ session, options }, ...args) => {
      try {
        // 将参数合并为完整的命令名称
        const commandName = args.join(' ').trim();
        const locale = extractor.getUserLocale(session)

        // 如果提供了命令名称，渲染单个命令的详细信息
        if (commandName) {
          const commandData = await extractor.getCommandData(commandName, locale)

          if (!commandData) {
            return `找不到命令: ${commandName}`
          }

          // 检查是否需要查看子命令
          if (options.sub && commandData.subCommands && commandData.subCommands.length > 0) {
            // 显示子命令列表
            const subCommands = commandData.subCommands;
            const subCommandsList = subCommands.map((cmd, idx) =>
              `${idx + 1}. ${cmd.name}${cmd.description ? ` - ${cmd.description}` : ''}`
            ).join('\n');

            return `命令 ${commandName} 的子命令列表：\n${subCommandsList}\n\n使用 -i <序号> 参数查看详细信息`;
          } else if (options.index > 0 && commandData.subCommands && commandData.subCommands.length >= options.index) {
            // 显示特定子命令详情
            const subCommand = commandData.subCommands[options.index - 1];
            const detailConfig = converter.commandToDetailConfig(subCommand);
            const image = await renderer.render(detailConfig);
            return h.image(image, 'image/png');
          } else {
            // 显示命令自身详情
            const detailConfig = converter.commandToDetailConfig(commandData);
            const image = await renderer.render(detailConfig);
            return h.image(image, 'image/png');
          }
        }

        // 加载所有命令数据
        let commands = await extractor.loadCommandsData(locale)

        if (!commands || commands.length === 0) {
          // 尝试实时提取
          logger.info(`未找到缓存的命令数据，尝试实时提取(${locale})`)
          commands = await extractor.getProcessedCommands(locale)

          // 保存以便后续使用
          if (commands.length > 0) {
            await extractor.saveCommandsData(commands, locale)
          } else {
            return '未找到可用的命令数据，请先使用 test.extract 提取命令'
          }
        }

        // 生成完整的命令列表配置并渲染
        const listConfig = converter.convertToRenderConfig(commands)
        const image = await renderer.render(listConfig)
        return h.image(image, 'image/png')
      } catch (err) {
        logger.error('渲染帮助图片失败', err)
        return `渲染失败：${err.message}`
      }
    })

  // 添加主题设置命令
  ctx.command('theme', '设置帮助页面主题')
    .option('dark', '-d 启用暗色模式')
    .option('light', '-l 启用亮色模式')
    .option('color', '-c <color:string> 设置强调色')
    .option('compact', '--compact 启用紧凑模式')
    .option('animation', '--animation <bool:boolean> 启用或禁用动画效果')
    .action(async ({ options }) => {
      try {
        // 加载当前配置
        const currentConfig = await converter.loadConfig()
        const styleChanges = {}

        // 应用主题变更
        if (options.dark) styleChanges['darkMode'] = true
        if (options.light) styleChanges['darkMode'] = false
        if (options.color) styleChanges['accentColor'] = options.color
        if ('compact' in options) styleChanges['compact'] = true
        if ('animation' in options) styleChanges['animation'] = options.animation

        // 如果没有任何变更，返回当前主题信息
        if (Object.keys(styleChanges).length === 0) {
          return `当前主题:\n暗色模式: ${currentConfig.style.darkMode ? '开启' : '关闭'}\n` +
                 `强调色: ${currentConfig.style.accentColor}\n` +
                 `紧凑模式: ${currentConfig.style.compact ? '开启' : '关闭'}\n` +
                 `动画效果: ${currentConfig.style.animation !== false ? '开启' : '关闭'}`
        }

        // 创建新配置
        const newConfig = {
          ...currentConfig,
          style: {
            ...currentConfig.style,
            ...styleChanges
          }
        }

        // 保存新配置
        await converter.saveConfig(newConfig)

        return '主题设置已更新'
      } catch (err) {
        logger.error('设置主题失败', err)
        return `设置失败：${err.message}`
      }
    })

  // 确保配置初始化
  initializeConfig().catch(err => logger.error('配置初始化失败', err))
}