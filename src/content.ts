import { ThemeConfig, LayoutConfig, GridItem } from './renderer'
import { CommandData } from './extract'

/**
 * 简洁内容管理器
 */
export class ContentManager {
  async getThemeConfig(config: any): Promise<ThemeConfig> {
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 0, g: 0, b: 0 };
    };

    const primary = hexToRgb(config.primaryColor);
    const text = hexToRgb(config.textColor);

    // 自动计算次要文本色（文本色的50%透明度效果）
    const textSecondary = `rgba(${text.r}, ${text.g}, ${text.b}, 0.5)`;

    // 自动计算边框色（主色调的15%透明度）
    const border = `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.15)`;

    return {
      colors: {
        primary: config.primaryColor,
        secondary: config.secondaryColor,
        background: config.backgroundColor,
        surface: config.surfaceColor,
        text: config.textColor,
        textSecondary: textSecondary,
        border: border
      },
      typography: {
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        fontSize: config.fontSize,
        titleFontScale: config.titleFontScale
      },
      spacing: {
        padding: config.innerPadding,
        gap: Math.max(config.innerPadding * 0.75, 10)
      },
      effects: {
        enableGlass: false
      },
      backgroundImage: config.backgroundImage,
      borderRadius: `${config.borderRadius}px`,
      fontUrl: config.fontUrl,
      header: {
        show: !!config.headerHtml?.trim(),
        content: config.headerHtml?.trim()
      },
      footer: {
        show: !!config.footerHtml?.trim(),
        content: config.footerHtml?.trim()
      }
    }
  }

  async generateLayout(commandName: string = null, commandsData: CommandData[]): Promise<LayoutConfig | null> {
    if (!commandsData.length) return null
    return commandName ? this.createDetailLayout(commandName, commandsData) : this.createMenuLayout(commandsData)
  }

  /**
   * 创建命令详情布局
   */
  private createDetailLayout(commandName: string, data: CommandData[]): LayoutConfig | null {
    const cmd = data.find(c => c.name === commandName) ||
                data.flatMap(c => c.subCommands || []).find(s => s.name === commandName)
    if (!cmd) return null

    const items: GridItem[] = []
    let row = 1

    // 命令标题
    items.push({
      row: row++, col: 1, rowSpan: 1, colSpan: 1,
      type: 'text', content: cmd.description || '无描述',
      title: cmd.name, id: 'header', itemType: 'header'
    })

    // 用法
    if (cmd.usage) {
      items.push({
        row: row++, col: 1, rowSpan: 1, colSpan: 1,
        type: 'text', content: cmd.usage,
        title: '使用方法', id: 'usage', itemType: 'command'
      })
    }

    // 选项
    if (cmd.options?.length) {
      items.push({
        row: row++, col: 1, rowSpan: 1, colSpan: 1,
        type: 'text',
        content: cmd.options.map(o => `${o.name} ${o.syntax || ''}\n  ${o.description || ''}`).join('\n\n'),
        title: `选项参数 (${cmd.options.length})`,
        id: 'options', itemType: 'option'
      })
    }

    // 示例
    if (cmd.examples?.length) {
      items.push({
        row: row++, col: 1, rowSpan: 1, colSpan: 1,
        type: 'text', content: cmd.examples.join('\n'),
        title: '使用示例', id: 'examples', itemType: 'command'
      })
    }

    // 子命令
    if (cmd.subCommands?.length) {
      items.push({
        row: row++, col: 1, rowSpan: 1, colSpan: 1,
        type: 'text',
        content: cmd.subCommands.map(s => `${s.name} - ${s.description || ''}`).join('\n'),
        title: `子命令 (${cmd.subCommands.length})`,
        id: 'subcommands', itemType: 'subCommand'
      })
    }

    return { rows: row - 1, cols: 1, items }
  }

  /**
   * 创建命令菜单布局
   */
  private createMenuLayout(data: CommandData[]): LayoutConfig {
    const items: GridItem[] = []

    // 标题
    items.push({
      row: 1, col: 1, rowSpan: 1, colSpan: 2,
      type: 'text', content: '选择命令查看详细信息',
      title: '命令菜单', id: 'title', itemType: 'title'
    })

    // 命令分组
    const groups = data.reduce((acc, cmd) => {
      const group = cmd.name.split('.')[0]
      if (!acc[group]) acc[group] = []
      acc[group].push(cmd)
      return acc
    }, {} as Record<string, CommandData[]>)

    Object.entries(groups).forEach(([name, cmds], i) => {
      items.push({
        row: Math.floor(i / 2) + 2,
        col: (i % 2) + 1,
        rowSpan: 1, colSpan: 1, type: 'text',
        content: cmds.map(c => `${c.name}${c.description ? ` - ${c.description}` : ''}`).join('\n'),
        title: `${name} (${cmds.length})`,
        id: `group-${name}`, itemType: 'command'
      })
    })

    return {
      rows: Math.ceil(Object.keys(groups).length / 2) + 1,
      cols: 2,
      items
    }
  }
}
