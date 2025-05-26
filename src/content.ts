import { Theme, Layout, Item } from './renderer'
import { Command } from './extract'

/**
 * 内容管理器
 */
export class Content {
  async getTheme(config: any): Promise<Theme> {
    const toRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 0, g: 0, b: 0 };
    };

    const primary = toRgb(config.primary);
    const text = toRgb(config.textColor);

    const textSecondary = `rgba(${text.r}, ${text.g}, ${text.b}, 0.5)`;
    const border = `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.15)`;

    return {
      colors: {
        primary: config.primary,
        secondary: config.secondary,
        background: config.bgColor,
        surface: config.surfaceColor,
        text: config.textColor,
        textSecondary: textSecondary,
        border: border
      },
      font: {
        family: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        size: config.fontSize,
        titleScale: config.titleSize
      },
      space: {
        padding: config.padding,
        gap: Math.max(config.padding * 0.75, 10)
      },
      effects: {
        glass: false
      },
      bgImage: config.bgImg,
      radius: `${config.radius}px`,
      fontUrl: config.fontUrl,
      header: {
        show: !!config.header?.trim(),
        content: config.header?.trim()
      },
      footer: {
        show: !!config.footer?.trim(),
        content: config.footer?.trim()
      }
    }
  }

  async createLayout(cmdName: string = null, commands: Command[]): Promise<Layout | null> {
    if (!commands.length) return null
    return cmdName ? this.buildDetail(cmdName, commands) : this.buildMenu(commands)
  }

  /**
   * 创建详情布局
   */
  private buildDetail(cmdName: string, data: Command[]): Layout | null {
    const cmd = data.find(c => c.name === cmdName) ||
                data.flatMap(c => c.subs || []).find(s => s.name === cmdName)
    if (!cmd) return null

    const items: Item[] = []
    let row = 1

    // 标题
    items.push({
      row: row++, col: 1, rowSpan: 1, colSpan: 1,
      type: 'text', content: cmd.desc || '无描述',
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
        content: cmd.options.map(o => `${o.name} ${o.syntax || ''}\n  ${o.desc || ''}`).join('\n\n'),
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
    if (cmd.subs?.length) {
      items.push({
        row: row++, col: 1, rowSpan: 1, colSpan: 1,
        type: 'text',
        content: cmd.subs.map(s => `${s.name} - ${s.desc || ''}`).join('\n'),
        title: `子命令 (${cmd.subs.length})`,
        id: 'subs', itemType: 'subCommand'
      })
    }

    return { rows: row - 1, cols: 1, items }
  }

  /**
   * 创建菜单布局
   */
  private buildMenu(data: Command[]): Layout {
    const items: Item[] = []

    // 标题
    items.push({
      row: 1, col: 1, rowSpan: 1, colSpan: 2,
      type: 'text', content: '选择命令查看详细信息',
      title: '命令菜单', id: 'title', itemType: 'title'
    })

    // 分组
    const groups = data.reduce((acc, cmd) => {
      const group = cmd.name.split('.')[0]
      if (!acc[group]) acc[group] = []
      acc[group].push(cmd)
      return acc
    }, {} as Record<string, Command[]>)

    Object.entries(groups).forEach(([name, cmds], i) => {
      items.push({
        row: Math.floor(i / 2) + 2,
        col: (i % 2) + 1,
        rowSpan: 1, colSpan: 1, type: 'text',
        content: cmds.map(c => `${c.name}${c.desc ? ` - ${c.desc}` : ''}`).join('\n'),
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
