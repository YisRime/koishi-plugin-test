import { CommandData } from './extract'
import { GridItem, ContentConfig } from './render'
import { logger } from './index'
import { join } from 'path'
import { File } from './utils'

/**
 * 布局项接口 - 使用嵌套结构
 */
export interface LayoutItem {
  name: string;
  row: number;
  col: number;
  rowSpan?: number;
  colSpan?: number;
  subItems?: LayoutItem[]; // 子命令项
  options?: LayoutItem[]; // 选项项
}

/**
 * 布局配置接口
 */
export interface LayoutConfig {
  items: LayoutItem[];
  layout: {
    rows: number;
    cols: number;
  };
}

/**
 * 命令转换器类 - 处理配置转换和管理
 */
export class Converter {
  private fileManager: File;
  private layoutPath: string;

  constructor(baseDir: string) {
    const dataDir = join(baseDir, 'data/test');
    this.fileManager = new File(dataDir);
    this.layoutPath = join(this.fileManager.basePath, 'menu_layout.json');
  }

  /**
   * 保存布局数据
   */
  public async saveLayoutData(layoutConfig: LayoutConfig): Promise<boolean> {
    await this.fileManager.ensureDir(this.layoutPath);
    return await this.fileManager.writeFile(
      this.layoutPath,
      JSON.stringify(layoutConfig, null, 2)
    );
  }

  /**
   * 加载布局数据
   */
  public async loadLayoutData(): Promise<LayoutConfig|null> {
    const content = await this.fileManager.readFile(this.layoutPath);
    if (!content) return null;

    try {
      return JSON.parse(content);
    } catch (e) {
      logger.warn(`读取布局配置失败: ${this.layoutPath}`);
      return null;
    }
  }

  /**
   * 从命令数据生成布局配置
   */
  public async createAndSaveLayoutData(commands: CommandData[]): Promise<LayoutConfig> {
    if (!commands?.length) throw new Error('未找到可用的命令数据');

    // 按根命令分组
    const rootGroups = this.groupCommandsByRoot(commands);
    const layoutItems: LayoutItem[] = [];

    // 添加标题项
    layoutItems.push({
      name: 'menu-title',
      row: 0,
      col: 1,
      colSpan: 2
    });

    // 为每个根命令创建布局项
    Object.entries(rootGroups).forEach(([root, cmds], index) => {
      const row = Math.floor(index / 2) + 1;
      const col = (index % 2) + 1;

      // 创建根命令项
      const rootItem: LayoutItem = {
        name: root,
        row,
        col,
        subItems: [],
        options: []
      };

      // 处理子命令和选项
      this.processCommandsForLayout(cmds, root, rootItem);
      layoutItems.push(rootItem);
    });

    // 创建布局配置
    const layoutConfig: LayoutConfig = {
      items: layoutItems,
      layout: {
        rows: Math.ceil(Object.keys(rootGroups).length / 2) + 1,
        cols: 2
      }
    };

    // 保存配置
    await this.saveLayoutData(layoutConfig);
    return layoutConfig;
  }

  /**
   * 处理命令布局数据
   */
  private processCommandsForLayout(cmds: CommandData[], rootName: string, rootItem: LayoutItem): void {
    cmds.forEach(cmd => {
      // 处理非根命令(子命令)
      if (cmd.name !== rootName && cmd.name.startsWith(`${rootName}.`)) {
        const subItem: LayoutItem = {
          name: cmd.name,
          row: 0,  // 相对位置
          col: 0
        };

        // 处理子命令的选项
        if (cmd.options?.length) {
          subItem.options = cmd.options.map(opt => ({
            name: `${cmd.name}.option.${opt.name}`,
            row: 0,
            col: 0
          }));
        }

        rootItem.subItems.push(subItem);
      }
      // 处理根命令的选项
      else if (cmd.name === rootName && cmd.options?.length) {
        rootItem.options = cmd.options.map(opt => ({
          name: `${cmd.name}.option.${opt.name}`,
          row: 0,
          col: 0
        }));
      }
    });
  }

  /**
   * 根据布局和命令数据生成内容配置
   */
  public async createContentConfig(
    command: string = null,
    commandsData: CommandData[],
    layoutData: LayoutConfig,
    headerLogo?: string
  ): Promise<ContentConfig> {
    try {
      if (!commandsData?.length || !layoutData) return null;

      // 根据命令参数返回不同配置
      if (!command) {
        return this.createMainMenuContent(commandsData, layoutData, headerLogo);
      } else {
        const cmdData = this.findCommandByName(command, commandsData);
        return cmdData ? this.createCommandDetailContent(cmdData, headerLogo) : null;
      }
    } catch (err) {
      logger.error(`生成内容配置失败: ${command || '主菜单'}`, err);
      return null;
    }
  }

  /**
   * 创建主菜单内容配置
   */
  private createMainMenuContent(
    commands: CommandData[],
    layoutData: LayoutConfig,
    headerLogo?: string
  ): ContentConfig {
    // 根据命令根名称分组
    const rootGroups = this.groupCommandsByRoot(commands);
    const gridItems: GridItem[] = [];

    // 添加标题项
    const titleItem = layoutData.items.find(item => item.name === 'menu-title');
    if (titleItem) {
      gridItems.push({
        row: titleItem.row + 1,
        col: titleItem.col,
        colSpan: titleItem.colSpan,
        type: 'text',
        title: '命令菜单',
        content: '点击命令查看详细信息',
        icon: 'menu_book',
        iconType: 'material',
        id: 'menu-title',
        itemType: 'title'
      });
    }

    // 为每个根命令创建网格项
    Object.entries(rootGroups).forEach(([root, cmds]) => {
      const layoutItem = layoutData.items.find(item => item.name === root);
      if (!layoutItem) return;

      // 计算子命令和选项数量
      const subCmdCount = cmds.reduce((sum, cmd) => sum + (cmd.subCommands?.length || 0), 0);
      const optionsCount = cmds.reduce((sum, cmd) => sum + (cmd.options?.length || 0), 0);

      // 构建命令内容
      const content = cmds.map(cmd =>
        `${cmd.name}${cmd.description ? ` - ${cmd.description}` : ''}`
      ).join('\n');

      // 添加网格项
      gridItems.push(this.createGridItem({
        row: layoutItem.row + 1,
        col: layoutItem.col,
        rowSpan: layoutItem.rowSpan,
        colSpan: layoutItem.colSpan,
        title: root,
        content,
        badge: this.formatBadge(cmds.length, subCmdCount, optionsCount),
        icon: 'terminal',
        id: `cmd-${root}`,
        itemType: 'command'
      }));
    });

    // 返回内容配置
    return {
      header: {
        show: true,
        title: '命令菜单',
        logo: headerLogo
      },
      footer: {
        show: true,
        text: `共 ${commands.length} 个命令`
      },
      layout: {
        rows: layoutData.layout.rows,
        cols: 2,
        items: gridItems
      }
    };
  }

  /**
   * 创建命令详情内容配置
   */
  private createCommandDetailContent(
    command: CommandData,
    headerLogo?: string
  ): ContentConfig {
    const gridItems: GridItem[] = [];
    let currentRow = 1;

    // 判断命令类型
    const rootName = command.name.split('.')[0];
    const isRoot = command.name === rootName;
    const itemType = isRoot ? 'command' : 'subCommand';

    // 添加标题
    gridItems.push(this.createGridItem({
      row: currentRow++,
      col: 1,
      title: command.name,
      content: command.description || '无描述',
      icon: 'code',
      id: 'cmd-title',
      itemType
    }));

    // 添加用法
    if (command.usage) {
      gridItems.push(this.createGridItem({
        row: currentRow++,
        col: 1,
        title: '用法',
        content: command.usage,
        icon: 'description',
        id: 'cmd-usage',
        itemType
      }));
    }

    // 添加选项
    if (command.options?.length > 0) {
      const optionsContent = command.options.map(opt =>
        `${opt.name}${opt.syntax ? ' ' + opt.syntax : ''}${opt.description ? '\n  ' + opt.description : ''}`
      ).join('\n\n');

      gridItems.push(this.createGridItem({
        row: currentRow++,
        col: 1,
        title: '选项参数',
        content: optionsContent,
        icon: 'tune',
        badge: command.options.length,
        id: 'cmd-options',
        itemType: 'option'
      }));
    }

    // 添加示例
    if (command.examples?.length > 0) {
      gridItems.push(this.createGridItem({
        row: currentRow++,
        col: 1,
        title: '示例',
        content: command.examples.join('\n'),
        icon: 'integration_instructions',
        id: 'cmd-examples',
        itemType
      }));
    }

    // 添加子命令
    if (command.subCommands?.length > 0) {
      const subContent = command.subCommands.map(sub =>
        `${sub.name}${sub.description ? ` - ${sub.description}` : ''}`
      ).join('\n');

      gridItems.push(this.createGridItem({
        row: currentRow++,
        col: 1,
        title: '子命令',
        content: subContent,
        icon: 'account_tree',
        badge: command.subCommands.length,
        id: 'cmd-subcommands',
        itemType: 'subCommand'
      }));
    }

    // 返回内容配置
    return {
      header: {
        show: true,
        title: `命令: ${command.name}`,
        logo: headerLogo
      },
      footer: {
        show: true,
        text: 'Powered by Koishi'
      },
      layout: {
        rows: currentRow - 1,
        cols: 1,
        items: gridItems
      }
    };
  }

  /**
   * 创建网格项 - 辅助函数
   */
  private createGridItem(options: {
    row: number;
    col: number;
    rowSpan?: number;
    colSpan?: number;
    title?: string;
    content: string;
    icon?: string;
    badge?: string | number;
    id?: string;
    itemType?: "title" | "command" | "subCommand" | "option" | "header";
  }): GridItem {
    return {
      row: options.row,
      col: options.col,
      rowSpan: options.rowSpan,
      colSpan: options.colSpan,
      type: 'text',
      title: options.title,
      content: options.content,
      icon: options.icon,
      iconType: options.icon ? 'material' : undefined,
      badge: options.badge,
      id: options.id,
      itemType: options.itemType
    };
  }

  /**
   * 格式化徽章显示
   */
  private formatBadge(cmdCount: number, subCmdCount: number, optionsCount: number): string {
    if (subCmdCount > 0 && optionsCount > 0) {
      return `${cmdCount}+${subCmdCount}+${optionsCount}`;
    } else if (subCmdCount > 0) {
      return `${cmdCount}+${subCmdCount}`;
    } else if (optionsCount > 0) {
      return `${cmdCount}+${optionsCount}`;
    }
    return String(cmdCount);
  }

  /**
   * 按根命令名分组
   */
  private groupCommandsByRoot(commands: CommandData[]): Record<string, CommandData[]> {
    return commands.reduce((groups, cmd) => {
      const root = cmd.name.split('.')[0];
      if (!groups[root]) groups[root] = [];
      groups[root].push(cmd);
      return groups;
    }, {} as Record<string, CommandData[]>);
  }

  /**
   * 在命令数组中查找指定命令
   */
  private findCommandByName(name: string, commands: CommandData[]): CommandData | null {
    // 直接查找
    const found = commands.find(cmd => cmd.name === name);
    if (found) return found;

    // 递归查找子命令
    for (const cmd of commands) {
      if (cmd.subCommands?.length) {
        const subFound = this.findCommandByName(name, cmd.subCommands);
        if (subFound) return subFound;
      }
    }

    return null;
  }
}