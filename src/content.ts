import { CommandData } from './extract'

export interface GridItem {
  row: number
  col: number
  rowSpan: number
  colSpan: number
  type: 'text' | 'image'
  content: string
  title: string
  icon: string
  iconType: 'material'
  badge?: string | number
  id: string
  itemType: 'command' | 'subCommand' | 'option' | 'title' | 'header'
}

export interface LayoutConfig {
  rows: number
  cols: number
  items: GridItem[]
}

/**
 * 内容处理器 - 处理HTML转义
 */
export class ContentProcessor {
  /**
   * HTML内容转义
   * @param value 需要转义的值
   */
  escapeHtml(value: any): string {
    if (value === null || value === undefined) return ''
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }
}

/**
 * 内容生成器 - 生成布局配置
 */
export class ContentGenerator {
  /**
   * 生成布局配置
   * @param commandName 命令名称
   * @param commandsData 命令数据
   */
  async generateLayout(commandName: string = null, commandsData: CommandData[]): Promise<LayoutConfig> {
    if (!commandsData.length) return null
    return commandName ? this.createDetailLayout(commandName, commandsData) : this.createMenuLayout(commandsData)
  }

  /**
   * 创建详细布局（单个命令）
   */
  private createDetailLayout(commandName: string, commandsData: CommandData[]): LayoutConfig {
    const commandData = commandsData.find(cmd => cmd.name === commandName) ||
                       commandsData.flatMap(cmd => cmd.subCommands || []).find(sub => sub.name === commandName)
    if (!commandData) return null

    const items: GridItem[] = []
    let row = 1

    // 基本信息
    items.push({
      row: row++, col: 1, rowSpan: 1, colSpan: 1, type: 'text',
      content: commandData.description || '无描述', title: commandData.name,
      icon: 'code', iconType: 'material', id: `sec-${commandData.name}`, itemType: 'command'
    })

    // 添加各个部分
    if (commandData.usage) {
      items.push({
        row: row++, col: 1, rowSpan: 1, colSpan: 1, type: 'text',
        content: commandData.usage, title: '用法',
        icon: 'description', iconType: 'material', id: 'sec-usage', itemType: 'command'
      })
    }

    if (commandData.options.length) {
      items.push({
        row: row++, col: 1, rowSpan: 1, colSpan: 1, type: 'text',
        content: commandData.options.map(opt =>
          `${opt.name}${opt.syntax ? ' ' + opt.syntax : ''}${opt.description ? '\n  ' + opt.description : ''}`
        ).join('\n\n'),
        title: '选项', icon: 'tune', iconType: 'material', badge: commandData.options.length,
        id: 'sec-options', itemType: 'option'
      })
    }

    if (commandData.examples.length) {
      items.push({
        row: row++, col: 1, rowSpan: 1, colSpan: 1, type: 'text',
        content: commandData.examples.join('\n'), title: '示例',
        icon: 'integration_instructions', iconType: 'material', id: 'sec-examples', itemType: 'command'
      })
    }

    if (commandData.subCommands?.length) {
      items.push({
        row: row++, col: 1, rowSpan: 1, colSpan: 1, type: 'text',
        content: commandData.subCommands.map(sub => `${sub.name}${sub.description ? ` - ${sub.description}` : ''}`).join('\n'),
        title: '子命令', icon: 'account_tree', iconType: 'material', badge: commandData.subCommands.length,
        id: 'sec-subcommands', itemType: 'subCommand'
      })
    }

    return { rows: row - 1, cols: 1, items }
  }

  /**
   * 创建菜单布局（命令列表）
   */
  private createMenuLayout(commandsData: CommandData[]): LayoutConfig {
    const commandGroups = commandsData.reduce((groups, command) => {
      const rootName = command.name.split('.')[0]
      groups[rootName] = groups[rootName] || []
      groups[rootName].push(command)
      return groups
    }, {} as Record<string, CommandData[]>)

    const items: GridItem[] = [{
      row: 1, col: 1, rowSpan: 1, colSpan: 2, type: 'text',
      content: '点击查看详情', title: '命令菜单',
      icon: 'menu', iconType: 'material', id: 'sec-title', itemType: 'title'
    }]

    Object.entries(commandGroups).forEach(([rootName, groupCommands], index) => {
      const counts = [
        groupCommands.length,
        groupCommands.reduce((sum, cmd) => sum + (cmd.subCommands?.length || 0), 0),
        groupCommands.reduce((sum, cmd) => sum + cmd.options.length, 0)
      ].filter(count => count > 0)

      items.push({
        row: Math.floor(index / 2) + 2, col: (index % 2) + 1,
        rowSpan: 1, colSpan: 1, type: 'text',
        content: groupCommands.map(cmd => `${cmd.name}${cmd.description ? ` - ${cmd.description}` : ''}`).join('\n'),
        title: rootName, icon: 'code', iconType: 'material', badge: counts.join('+'),
        id: `cmd-${rootName}`, itemType: 'command'
      })
    })

    return {
      rows: Math.ceil(Object.keys(commandGroups).length / 2) + 1,
      cols: 2,
      items
    }
  }
}