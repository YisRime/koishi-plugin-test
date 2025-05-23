import { CommandData } from './extract'
import { GridItem, ContentConfig } from './render'
import { logger } from './index'
import { Config } from './index'

/**
 * 命令转换器类
 * @class Converter
 */
export class Converter {
  /**
   * 创建转换器实例
   * @param {string} baseDir 基础目录
   * @param {Config} config 配置
   */
  constructor(private baseDir: string, private config: Config) {}

  /**
   * 根据命令数据生成内容配置
   */
  public async createContentConfig(cmd: string = null, cmds: CommandData[]): Promise<ContentConfig> {
    try {
      if (!cmds?.length) return null;

      if (!cmd) {
        return this.createMainMenuContent(cmds);
      } else {
        // 内联findCommand方法
        let foundCmd: CommandData = null;

        // 直接查找
        foundCmd = cmds.find(c => c.name === cmd);
        if (!foundCmd) {
          // 递归查找子命令
          for (const c of cmds) {
            if (c.subCommands?.length) {
              const sub = c.subCommands.find(sc => sc.name === cmd);
              if (sub) {
                foundCmd = sub;
                break;
              }
            }
          }
        }

        return this.createCommandDetailContent(foundCmd);
      }
    } catch (err) {
      logger.error(`生成内容配置失败: ${cmd || '主菜单'}`, err);
      return null;
    }
  }

  /**
   * 创建主菜单内容配置
   */
  private createMainMenuContent(cmds: CommandData[]): ContentConfig {
    // 内联groupCommands方法 - 按根命令分组
    const rootGroups = cmds.reduce((groups, cmd) => {
      const root = cmd.name.split('.')[0];
      if (!groups[root]) groups[root] = [];
      groups[root].push(cmd);
      return groups;
    }, {} as Record<string, CommandData[]>);

    const items: GridItem[] = [];
    const cols = 2;

    // 添加标题 - 移除 menu_book 图标
    items.push({
      row: 1, col: 1, colSpan: 2,
      type: 'text',
      title: '命令菜单',
      content: '点击命令查看详细信息',
      // 删除 icon: 'menu_book'
      id: 'menu-title',
      itemType: 'title'
    });

    // 添加命令项
    let index = 0;
    Object.entries(rootGroups).forEach(([root, groupCmds]) => {
      const row = Math.floor(index / 2) + 2;
      const col = (index % 2) + 1;

      // 计算统计数据
      const subCount = groupCmds.reduce((sum, cmd) => sum + (cmd.subCommands?.length || 0), 0);
      const optCount = groupCmds.reduce((sum, cmd) => sum + (cmd.options?.length || 0), 0);

      // 内联formatStats方法
      let badge: string;
      if (subCount && optCount) badge = `${groupCmds.length}+${subCount}+${optCount}`;
      else if (subCount) badge = `${groupCmds.length}+${subCount}`;
      else if (optCount) badge = `${groupCmds.length}+${optCount}`;
      else badge = String(groupCmds.length);

      items.push({
        row, col,
        type: 'text',
        title: root,
        content: groupCmds.map(cmd =>
          `${cmd.name}${cmd.description ? ` - ${cmd.description}` : ''}`
        ).join('\n'),
        // 删除 icon: 'terminal'
        badge,
        id: `cmd-${root}`,
        itemType: 'command'
      });

      index++;
    });

    // 返回完整配置
    return {
      header: {
        show: this.config.header?.show ?? true,
        title: this.config.header?.title || '命令菜单',
        logo: this.config.header?.logo
      },
      footer: {
        show: this.config.footer?.show ?? true,
        text: this.config.footer?.text || `共 ${cmds.length} 个命令`
      },
      layout: {
        rows: Math.ceil(Object.keys(rootGroups).length / 2) + 1,
        cols,
        items
      }
    };
  }

  /**
   * 创建命令详情内容配置
   */
  private createCommandDetailContent(cmd: CommandData): ContentConfig {
    if (!cmd) return null;
    const items: GridItem[] = [];
    let row = 1;

    // 命令类型
    const type = cmd.name.includes('.') ? 'subCommand' : 'command';

    // 内联addSection方法并直接构建各部分内容
    // 命令名和描述
    items.push({
      row: row++, col: 1,
      type: 'text',
      title: cmd.name,
      content: cmd.description || '无描述',
      icon: 'code',
      iconType: 'material',
      id: `section-${cmd.name.toLowerCase().replace(/\s+/g, '-')}`,
      itemType: type as any
    });

    // 用法
    if (cmd.usage) {
      items.push({
        row: row++, col: 1,
        type: 'text',
        title: '用法',
        content: cmd.usage,
        icon: 'description',
        iconType: 'material',
        id: 'section-usage',
        itemType: type as any
      });
    }

    // 选项参数
    if (cmd.options?.length > 0) {
      items.push({
        row: row++, col: 1,
        type: 'text',
        title: '选项参数',
        content: cmd.options.map(opt =>
          `${opt.name}${opt.syntax ? ' ' + opt.syntax : ''}${opt.description ? '\n  ' + opt.description : ''}`
        ).join('\n\n'),
        icon: 'tune',
        iconType: 'material',
        badge: cmd.options.length,
        id: 'section-options',
        itemType: 'option' as any
      });
    }

    // 示例
    if (cmd.examples?.length > 0) {
      items.push({
        row: row++, col: 1,
        type: 'text',
        title: '示例',
        content: cmd.examples.join('\n'),
        icon: 'integration_instructions',
        iconType: 'material',
        id: 'section-examples',
        itemType: type as any
      });
    }

    // 子命令
    if (cmd.subCommands?.length > 0) {
      items.push({
        row: row++, col: 1,
        type: 'text',
        title: '子命令',
        content: cmd.subCommands.map(sub =>
          `${sub.name}${sub.description ? ` - ${sub.description}` : ''}`
        ).join('\n'),
        icon: 'account_tree',
        iconType: 'material',
        badge: cmd.subCommands.length,
        id: 'section-subcommands',
        itemType: 'subCommand' as any
      });
    }

    // 返回配置
    return {
      header: {
        show: this.config.header?.show ?? true,
        title: `命令: ${cmd.name}`,
        logo: this.config.header?.logo
      },
      footer: {
        show: this.config.footer?.show ?? true,
        text: this.config.footer?.text || 'Powered by Koishi'
      },
      layout: {
        rows: row - 1,
        cols: 1,
        items
      }
    };
  }
}