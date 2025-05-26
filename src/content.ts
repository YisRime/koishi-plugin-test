import { ThemeConfig, LayoutConfig, GridItem } from './renderer'
import { CommandData } from './extract'
import { FileManager } from './utils'

/**
 * 内容管理器类
 * 负责主题配置生成和布局创建的核心逻辑
 */
export class ContentManager {
  /** 预定义主题色彩方案 */
  private readonly presets = {
    light: {
      primary: '#3b82f6',
      secondary: '#6366f1',
      accent: '#06b6d4',
      background: '#f8fafc',
      surface: '#ffffff',
      text: '#1e293b',
      textSecondary: '#64748b',
      border: 'rgba(148,163,184,0.25)',
      shadow: 'rgba(15,23,42,0.08)'
    },
    dark: {
      primary: '#60a5fa',
      secondary: '#a78bfa',
      accent: '#34d399',
      background: '#0f172a',
      surface: '#1e293b',
      text: '#f1f5f9',
      textSecondary: '#94a3b8',
      border: 'rgba(148,163,184,0.2)',
      shadow: 'rgba(0,0,0,0.5)'
    }
  }

  /**
   * 获取完整的主题配置
   * @param config - 插件配置对象
   * @param fileManager - 文件管理器实例 (可选)
   * @returns Promise<ThemeConfig> 完整的主题配置对象
   */
  async getThemeConfig(config: any, fileManager?: FileManager): Promise<ThemeConfig> {
    const preset = this.presets[config.themePreset] || this.presets.light
    const colors = {
      ...preset,
      ...Object.fromEntries([
        'primary', 'background', 'text', 'secondary', 'accent',
        'surface', 'textSecondary', 'border', 'shadow'
      ].filter(key => config[`${key}Color`]).map(key => [key, config[`${key}Color`]]))
    }

    const [bg, font] = await Promise.all([
      this.resolveAsset(config.backgroundImage, fileManager),
      this.resolveAsset(config.fontUrl, fileManager)
    ])

    // 优化字体配置
    const fontFamily = config.fontFamily || "'Inter', 'Noto Sans SC', system-ui, -apple-system, sans-serif"

    // 增强阴影效果
    const shadowLayers = [
      `0 ${config.shadowSpread}px ${config.shadowBlur}px ${colors.shadow}`,
      `0 ${config.shadowSpread * 2}px ${config.shadowBlur * 2}px ${colors.shadow}40`,
      `0 1px 3px ${colors.shadow}60`
    ].join(',')

    return {
      colors,
      typography: {
        fontFamily,
        fontSize: config.fontSize,
        titleSize: config.titleSize,
        titleWeight: config.titleWeight,
        lineHeight: config.lineHeight
      },
      spacing: {
        itemPadding: `${config.itemPadding}px`,
        itemSpacing: config.itemSpacing,
        containerPadding: `${config.containerPadding}px`
      },
      effects: {
        shadow: shadowLayers,
        backdropBlur: config.backdropBlur,
        enableGlass: config.enableGlassEffect
      },
      outerPadding: config.outerPadding,
      innerPadding: config.innerPadding,
      backgroundImage: bg.url,
      borderRadius: `${config.roundness}px`,
      fontUrl: font.url,
      header: { show: !!config.headerText?.trim(), text: config.headerText?.trim() || '' },
      footer: { show: !!config.footerText?.trim(), text: config.footerText?.trim() || '' }
    }
  }

  /**
   * 生成布局配置
   * @param commandName - 目标命令名称 (null时生成菜单布局)
   * @param commandsData - 命令数据数组
   * @returns Promise<LayoutConfig | null> 布局配置对象或null
   */
  async generateLayout(commandName: string = null, commandsData: CommandData[]): Promise<LayoutConfig | null> {
    if (!commandsData.length) return null
    return commandName ? this.createDetail(commandName, commandsData) : this.createMenu(commandsData)
  }

  /**
   * 解析资源路径 (本地文件或远程URL)
   * @param asset - 资源路径 (本地文件名或URL)
   * @param fileManager - 文件管理器实例 (可选)
   * @returns Promise<{url: string}> 解析后的资源对象
   */
  private async resolveAsset(asset: string, fileManager?: FileManager): Promise<{ url: string }> {
    if (!asset) return { url: '' }
    if (asset.startsWith('http')) return { url: asset }

    if (fileManager && await fileManager.exists('asset', asset)) {
      // 直接构造文件路径，不使用已删除的getFilePath方法
      const path = `${fileManager['dataDir']}/assets/${asset.replace(/\./g, '_')}`
      return { url: `file://${path}` }
    }

    return { url: '' }
  }

  /**
   * 创建命令详情布局
   * @param commandName - 命令名称
   * @param data - 命令数据数组
   * @returns LayoutConfig | null 详情布局配置或null
   */
  private createDetail(commandName: string, data: CommandData[]): LayoutConfig | null {
    const cmd = data.find(c => c.name === commandName) || data.flatMap(c => c.subCommands || []).find(s => s.name === commandName)
    if (!cmd) return null

    const items: GridItem[] = []
    let row = 1

    // 命令标题
    items.push(this.createGridItem(cmd.name, cmd.description || '无描述信息', 'terminal', 'header', row++, `sec-${cmd.name}`))

    // 用法说明
    if (cmd.usage) {
      items.push(this.createGridItem('使用方法', cmd.usage, 'description', 'command', row++, 'sec-usage'))
    }

    // 选项参数
    if (cmd.options.length) {
      const optionsText = cmd.options.map(o => {
        const parts = [o.name]
        if (o.syntax) parts.push(o.syntax)
        if (o.description) parts.push(`\n  ${o.description}`)
        return parts.join(' ')
      }).join('\n\n')
      items.push(this.createGridItem('可用选项', optionsText, 'tune', 'option', row++, 'sec-options', cmd.options.length))
    }

    // 使用示例
    if (cmd.examples.length) {
      items.push(this.createGridItem('使用示例', cmd.examples.join('\n'), 'code', 'command', row++, 'sec-examples'))
    }

    // 子命令
    if (cmd.subCommands?.length) {
      const subCommandsText = cmd.subCommands.map(s =>
        `${s.name}${s.description ? ` - ${s.description}` : ''}`
      ).join('\n')
      items.push(this.createGridItem('子命令', subCommandsText, 'account_tree', 'subCommand', row++, 'sec-subcommands', cmd.subCommands.length))
    }

    return { rows: row - 1, cols: 1, items }
  }

  /**
   * 创建命令菜单布局
   * @param data - 命令数据数组
   * @returns LayoutConfig 菜单布局配置
   */
  private createMenu(data: CommandData[]): LayoutConfig {
    const groups = data.reduce((g, c) => {
      const root = c.name.split('.')[0]
      if (!g[root]) g[root] = []
      g[root].push(c)
      return g
    }, {} as Record<string, CommandData[]>)

    const items: GridItem[] = [
      {
        row: 1, col: 1, rowSpan: 1, colSpan: 2, type: 'text',
        content: '选择命令查看详细信息和使用方法',
        title: '📋 命令菜单',
        icon: 'menu_book',
        iconType: 'material',
        id: 'sec-title',
        itemType: 'title'
      }
    ]

    Object.entries(groups).forEach(([name, cmds], i) => {
      const commandsText = cmds.map(c =>
        `${c.name}${c.description ? ` - ${c.description}` : ''}`
      ).join('\n')

      items.push({
        row: Math.floor(i / 2) + 2,
        col: (i % 2) + 1,
        rowSpan: 1,
        colSpan: 1,
        type: 'text',
        content: commandsText,
        title: name,
        icon: 'code',
        iconType: 'material',
        badge: cmds.length.toString(),
        id: `cmd-${name}`,
        itemType: 'command'
      })
    })

    return { rows: Math.ceil(Object.keys(groups).length / 2) + 1, cols: 2, items }
  }

  /**
   * 创建网格项目
   * @param title - 项目标题
   * @param content - 项目内容
   * @param icon - 图标名称
   * @param itemType - 项目类型
   * @param row - 行位置
   * @param id - 项目ID
   * @param badge - 徽章数字 (可选)
   * @returns GridItem 网格项目对象
   */
  private createGridItem(title: string, content: string, icon: string, itemType: string, row: number, id: string, badge?: number): GridItem {
    return { row, col: 1, rowSpan: 1, colSpan: 1, type: 'text', content, title, icon, iconType: 'material', id, itemType, ...(badge && { badge }) } as GridItem
  }
}
