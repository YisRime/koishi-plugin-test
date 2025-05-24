import { CommandData } from './extract'
import { logger, Config } from './index'
import { join } from 'path'
import { File } from './utils'

/**
 * 网格项类型
 */
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

/**
 * 布局配置
 */
export interface LayoutConfig {
  rows: number
  cols: number
  items: GridItem[]
}

/**
 * 命令转换器类
 */
export class Converter {
  private configDir: string
  private file: File

  constructor(private baseDir: string, private config: Config) {
    this.configDir = join(baseDir, 'data/test')
    this.file = new File(this.configDir)
  }

  private getConfigPath(cmdKey: string): string {
    return join(this.configDir,
      cmdKey ? `layout_${cmdKey.replace(/\./g, '_')}.json` : 'layout_main.json')
  }

  public async saveLayoutConfig(cmdKey: string, layout: LayoutConfig): Promise<boolean> {
    if (!layout) return false
    try {
      const path = this.getConfigPath(cmdKey)
      await this.file.ensureDir(path)
      return await this.file.writeFile(path, JSON.stringify(layout, null, 2))
    } catch (err) {
      logger.error(`保存布局配置失败: ${cmdKey}`, err)
      return false
    }
  }

  public async loadLayoutConfig(cmdKey: string): Promise<LayoutConfig|null> {
    try {
      const path = this.getConfigPath(cmdKey)
      const data = await this.file.readFile(path)
      return data ? JSON.parse(data) : null
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.debug(`加载布局配置失败: ${cmdKey}`, err)
      }
      return null
    }
  }

  public async generateLayout(cmd: string = null, cmds: CommandData[]): Promise<LayoutConfig> {
    if (!cmds?.length) return null

    const cmdKey = cmd || 'main'
    logger.debug(`生成布局配置: ${cmdKey}`)

    // 根据是否有命令参数选择生成主菜单或命令详情
    return !cmd
      ? this.createMainMenuContent(cmds)
      : this.createCommandDetailContent(this.findCommand(cmds, cmd))
  }

  // 查找命令 - 简化为单一表达式
  private findCommand(cmds: CommandData[], cmdName: string): CommandData | null {
    return cmds.find(c => c.name === cmdName) ||
           cmds.flatMap(c => c.subCommands || []).find(sc => sc.name === cmdName) ||
           null
  }

  private createMainMenuContent(cmds: CommandData[]): LayoutConfig {
    // 按根命令分组
    const rootGroups = cmds.reduce((groups, cmd) => {
      const root = cmd.name.split('.')[0]
      if (!groups[root]) groups[root] = []
      groups[root].push(cmd)
      return groups
    }, {} as Record<string, CommandData[]>)

    const items: GridItem[] = []
    const cols = 2

    // 添加标题项
    this.addGridItem(items, {
      row: 1, col: 1, colSpan: 2,
      title: '命令菜单',
      content: '点击命令查看详细信息',
      id: 'menu-title',
      itemType: 'title'
    })

    // 添加命令项
    Object.entries(rootGroups).forEach(([root, groupCmds], index) => {
      // 简化统计和计算
      const counts = {
        cmd: groupCmds.length,
        sub: groupCmds.reduce((sum, cmd) => sum + (cmd.subCommands?.length || 0), 0),
        opt: groupCmds.reduce((sum, cmd) => sum + (cmd.options?.length || 0), 0)
      }

      // 简化徽章生成
      const badge = Object.entries(counts)
        .filter(([_, count]) => count > 0)
        .map(([_, count]) => count)
        .join('+')

      this.addGridItem(items, {
        row: Math.floor(index / cols) + 2,
        col: (index % cols) + 1,
        title: root,
        content: groupCmds.map(cmd =>
          `${cmd.name}${cmd.description ? ` - ${cmd.description}` : ''}`
        ).join('\n'),
        badge,
        id: `cmd-${root}`,
        itemType: 'command'
      })
    })

    return {
      rows: Math.ceil(Object.keys(rootGroups).length / cols) + 1,
      cols,
      items
    }
  }

  // 创建网格项的通用方法
  private addGridItem(items: GridItem[], options: Partial<GridItem>): void {
    items.push({
      row: 1,
      col: 1,
      type: 'text',
      content: '',
      ...options
    })
  }

  private createCommandDetailContent(cmd: CommandData): LayoutConfig {
    if (!cmd) return null

    const items: GridItem[] = []
    let row = 1
    const type = cmd.name.includes('.') ? 'subCommand' : 'command'

    // 命令名和描述
    this.addSection(items, row++, {
      title: cmd.name,
      content: cmd.description || '无描述',
      icon: 'code',
      itemType: type
    })

    // 用法
    if (cmd.usage) {
      this.addSection(items, row++, {
        title: '用法',
        content: cmd.usage,
        icon: 'description'
      })
    }

    // 选项参数
    if (cmd.options?.length > 0) {
      this.addSection(items, row++, {
        title: '选项参数',
        content: cmd.options.map(opt =>
          `${opt.name}${opt.syntax ? ' ' + opt.syntax : ''}${opt.description ? '\n  ' + opt.description : ''}`
        ).join('\n\n'),
        icon: 'tune',
        itemType: 'option',
        badge: cmd.options.length
      })
    }

    // 示例
    if (cmd.examples?.length > 0) {
      this.addSection(items, row++, {
        title: '示例',
        content: cmd.examples.join('\n'),
        icon: 'integration_instructions'
      })
    }

    // 子命令
    if (cmd.subCommands?.length > 0) {
      this.addSection(items, row++, {
        title: '子命令',
        content: cmd.subCommands.map(sub =>
          `${sub.name}${sub.description ? ` - ${sub.description}` : ''}`
        ).join('\n'),
        icon: 'account_tree',
        itemType: 'subCommand',
        badge: cmd.subCommands.length
      })
    }

    return { rows: row - 1, cols: 1, items }
  }

  // 添加内容段落的辅助方法
  private addSection(items: GridItem[], row: number, options: {
    title: string,
    content: string,
    icon: string,
    itemType?: string,
    badge?: number
  }): void {
    const { title, content, icon, itemType = 'command', badge } = options

    this.addGridItem(items, {
      row,
      col: 1,
      title,
      content,
      icon,
      iconType: 'material',
      id: `section-${title.toLowerCase().replace(/\s+/g, '-')}`,
      itemType: itemType as any,
      ...(badge ? { badge } : {})
    })
  }
}