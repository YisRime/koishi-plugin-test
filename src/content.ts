import { ThemeConfig, LayoutConfig, GridItem } from './renderer'
import { CommandData } from './extract'
import { FileManager } from './utils'

/**
 * 内容管理器 - 负责主题配置和布局生成
 */
export class ContentManager {
  /** 预定义主题色彩方案 */
  private readonly presets = {
    light: { primary: '#2563eb', secondary: '#64748b', accent: '#0ea5e9', background: '#ffffff', surface: '#f8fafc', text: '#1e293b', textSecondary: '#64748b', border: 'rgba(148,163,184,0.2)', shadow: 'rgba(0,0,0,0.08)' },
    dark: { primary: '#ffffff', secondary: '#666666', accent: '#888888', background: '#000000', surface: '#111111', text: '#ffffff', textSecondary: '#888888', border: 'rgba(255,255,255,0.1)', shadow: 'rgba(0,0,0,0.8)' }
  }

  /**
   * 获取主题配置
   * @param config 插件配置对象
   * @param fileManager 文件管理器实例
   * @returns 完整的主题配置
   */
  async getThemeConfig(config: any, fileManager?: FileManager): Promise<ThemeConfig> {
    const preset = this.presets[config.themePreset] || this.presets.light
    const colors = { ...preset, ...Object.fromEntries(['primary', 'background', 'text', 'secondary', 'accent', 'surface', 'textSecondary', 'border', 'shadow'].filter(key => config[`${key}Color`]).map(key => [key, config[`${key}Color`]])) }

    const [bg, font] = await Promise.all([
      this.resolveAsset(config.backgroundImage, fileManager),
      this.resolveAsset(config.fontUrl, fileManager)
    ])

    return {
      colors,
      typography: { fontFamily: config.fontFamily, fontSize: config.fontSize, titleSize: config.titleSize, titleWeight: config.titleWeight, lineHeight: config.lineHeight },
      spacing: { itemPadding: `${config.itemPadding}px`, itemSpacing: config.itemSpacing, containerPadding: `${config.containerPadding}px` },
      effects: { shadow: `0 ${config.shadowSpread * 2}px ${config.shadowBlur}px ${colors.shadow},0 ${config.shadowSpread}px ${config.shadowBlur / 2}px ${colors.shadow}`, backdropBlur: config.backdropBlur, enableGlass: config.enableGlassEffect },
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
   * @param commandName 目标命令名称，为null时生成菜单布局
   * @param commandsData 命令数据数组
   * @returns 布局配置对象或null
   */
  async generateLayout(commandName: string = null, commandsData: CommandData[]): Promise<LayoutConfig | null> {
    if (!commandsData.length) return null
    return commandName ? this.createDetail(commandName, commandsData) : this.createMenu(commandsData)
  }

  /**
   * 解析资源路径
   * @param asset 资源路径（本地文件名或URL）
   * @param fileManager 文件管理器实例
   * @returns 解析后的资源对象
   */
  private async resolveAsset(asset: string, fileManager?: FileManager): Promise<{ url: string }> {
    if (!asset) return { url: '' }
    if (asset.startsWith('http')) return { url: asset }
    return fileManager && await fileManager.exists('asset', asset) ? { url: `file://${fileManager.getFilePath('asset', asset)}` } : { url: '' }
  }

  /**
   * 创建命令详情布局
   * @param commandName 命令名称
   * @param data 命令数据数组
   * @returns 详情布局配置或null
   */
  private createDetail(commandName: string, data: CommandData[]): LayoutConfig | null {
    const cmd = data.find(c => c.name === commandName) || data.flatMap(c => c.subCommands || []).find(s => s.name === commandName)
    if (!cmd) return null

    const items: GridItem[] = []
    let row = 1

    items.push(this.createGridItem(cmd.name, cmd.description || '无描述', 'code', 'command', row++, `sec-${cmd.name}`))
    if (cmd.usage) items.push(this.createGridItem('用法', cmd.usage, 'description', 'command', row++, 'sec-usage'))
    if (cmd.options.length) items.push(this.createGridItem('选项', cmd.options.map(o => `${o.name}${o.syntax ? ' ' + o.syntax : ''}${o.description ? '\n  ' + o.description : ''}`).join('\n\n'), 'tune', 'option', row++, 'sec-options', cmd.options.length))
    if (cmd.examples.length) items.push(this.createGridItem('示例', cmd.examples.join('\n'), 'integration_instructions', 'command', row++, 'sec-examples'))
    if (cmd.subCommands?.length) items.push(this.createGridItem('子命令', cmd.subCommands.map(s => `${s.name}${s.description ? ` - ${s.description}` : ''}`).join('\n'), 'account_tree', 'subCommand', row++, 'sec-subcommands', cmd.subCommands.length))

    return { rows: row - 1, cols: 1, items }
  }

  /**
   * 创建命令菜单布局
   * @param data 命令数据数组
   * @returns 菜单布局配置
   */
  private createMenu(data: CommandData[]): LayoutConfig {
    const groups = data.reduce((g, c) => {
      const root = c.name.split('.')[0]
      g[root] = g[root] || []
      g[root].push(c)
      return g
    }, {} as Record<string, CommandData[]>)

    const items: GridItem[] = [
      { row: 1, col: 1, rowSpan: 1, colSpan: 2, type: 'text', content: '点击查看详情', title: '命令菜单', icon: 'menu', iconType: 'material', id: 'sec-title', itemType: 'title' }
    ]

    Object.entries(groups).forEach(([name, cmds], i) => {
      const counts = [cmds.length, cmds.reduce((s, c) => s + (c.subCommands?.length || 0), 0), cmds.reduce((s, c) => s + c.options.length, 0)].filter(c => c > 0)
      items.push({
        row: Math.floor(i / 2) + 2, col: (i % 2) + 1, rowSpan: 1, colSpan: 1, type: 'text',
        content: cmds.map(c => `${c.name}${c.description ? ` - ${c.description}` : ''}`).join('\n'),
        title: name, icon: 'code', iconType: 'material', badge: counts.join('+'), id: `cmd-${name}`, itemType: 'command'
      })
    })

    return { rows: Math.ceil(Object.keys(groups).length / 2) + 1, cols: 2, items }
  }

  /**
   * 创建网格项目
   * @param title 项目标题
   * @param content 项目内容
   * @param icon 图标名称
   * @param itemType 项目类型
   * @param row 行位置
   * @param id 项目ID
   * @param badge 徽章数字（可选）
   * @returns 网格项目对象
   */
  private createGridItem(title: string, content: string, icon: string, itemType: string, row: number, id: string, badge?: number): GridItem {
    return { row, col: 1, rowSpan: 1, colSpan: 1, type: 'text', content, title, icon, iconType: 'material', id, itemType, ...(badge && { badge }) } as GridItem
  }
}
