import { CommandData } from './extract'
import { logger } from './index'

export interface GridItem {
  row: number
  col: number
  rowSpan?: number
  colSpan?: number
  type: 'text' | 'image'
  content: string
  title?: string
  icon?: string
  iconType?: 'material'
  badge?: string | number
  id?: string
  itemType?: 'command' | 'subCommand' | 'option' | 'title' | 'header'
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
    if (!commandsData?.length) return null

    logger.debug(`生成布局: ${commandName || 'main'}`)

    return commandName ? this.createDetailLayout(commandName, commandsData) : this.createMenuLayout(commandsData)
  }

  /**
   * 创建详细布局（单个命令）
   * @param commandName 命令名称
   * @param commandsData 命令数据
   */
  private createDetailLayout(commandName: string, commandsData: CommandData[]): LayoutConfig {
    const commandData = commandsData.find(cmd => cmd.name === commandName) ||
                       commandsData.flatMap(cmd => cmd.subCommands || []).find(sub => sub.name === commandName)

    if (!commandData) return null

    const gridItems: GridItem[] = []
    let currentRow = 1
    const itemType = commandData.name.includes('.') ? 'subCommand' : 'command'

    const addItem = (content: string, title: string, icon: string, type = 'command', badge?: any) => {
      gridItems.push({
        row: currentRow++, col: 1, type: 'text', content, title, icon, iconType: 'material',
        id: `sec-${title.toLowerCase().replace(/\s+/g, '-')}`, itemType: type as any, badge
      })
    }

    // 基本信息
    addItem(commandData.description || '无描述', commandData.name, 'code', itemType)

    // 用法
    if (commandData.usage) {
      addItem(commandData.usage, '用法', 'description')
    }

    // 选项
    if (commandData.options?.length > 0) {
      const optionsContent = commandData.options.map(opt =>
        `${opt.name}${opt.syntax ? ' ' + opt.syntax : ''}${opt.description ? '\n  ' + opt.description : ''}`
      ).join('\n\n')
      addItem(optionsContent, '选项', 'tune', 'option', commandData.options.length)
    }

    // 示例
    if (commandData.examples?.length > 0) {
      addItem(commandData.examples.join('\n'), '示例', 'integration_instructions')
    }

    // 子命令
    if (commandData.subCommands?.length > 0) {
      const subCommandsContent = commandData.subCommands.map(sub =>
        `${sub.name}${sub.description ? ` - ${sub.description}` : ''}`
      ).join('\n')
      addItem(subCommandsContent, '子命令', 'account_tree', 'subCommand', commandData.subCommands.length)
    }

    return { rows: currentRow - 1, cols: 1, items: gridItems }
  }

  /**
   * 创建菜单布局（命令列表）
   * @param commandsData 命令数据
   */
  private createMenuLayout(commandsData: CommandData[]): LayoutConfig {
    const commandGroups = commandsData.reduce((groups, command) => {
      const rootName = command.name.split('.')[0]
      if (!groups[rootName]) groups[rootName] = []
      groups[rootName].push(command)
      return groups
    }, {} as Record<string, CommandData[]>)

    const gridItems: GridItem[] = [{
      row: 1, col: 1, type: 'text', content: '点击查看详情',
      colSpan: 2, title: '命令菜单', id: 'menu-title', itemType: 'title'
    }]

    const gridColumns = 2

    Object.entries(commandGroups).forEach(([rootName, groupCommands], index) => {
      const counts = {
        cmd: groupCommands.length,
        sub: groupCommands.reduce((sum, cmd) => sum + (cmd.subCommands?.length || 0), 0),
        opt: groupCommands.reduce((sum, cmd) => sum + (cmd.options?.length || 0), 0)
      }

      gridItems.push({
        row: Math.floor(index / gridColumns) + 2,
        col: (index % gridColumns) + 1,
        type: 'text',
        content: groupCommands.map(cmd =>
          `${cmd.name}${cmd.description ? ` - ${cmd.description}` : ''}`
        ).join('\n'),
        title: rootName,
        badge: Object.values(counts).filter(count => count > 0).join('+'),
        id: `cmd-${rootName}`,
        itemType: 'command'
      })
    })

    return {
      rows: Math.ceil(Object.keys(commandGroups).length / gridColumns) + 1,
      cols: gridColumns,
      items: gridItems
    }
  }
}