import { CommandData } from './extract'
import { GridItem, ContentConfig } from './render'
import { logger } from './index'
import { join } from 'path'
import { File } from './utils'
import { Config } from './index'

/**
 * 布局项接口
 * @interface LayoutItem
 */
export interface LayoutItem {
  name: string;
  row: number;
  col: number;
  rowSpan?: number;
  colSpan?: number;
  subItems?: LayoutItem[];
  options?: LayoutItem[];
}

/**
 * 布局配置接口
 * @interface LayoutConfig
 */
export interface LayoutConfig {
  items: LayoutItem[];
  layout: {
    rows: number;
    cols: number;
  };
}

/**
 * 命令转换器类
 * @class Converter
 */
export class Converter {
  private file: File;
  private layoutPath: string;

  /**
   * 创建转换器实例
   * @param {string} baseDir 基础目录
   * @param {Config} config 配置
   */
  constructor(baseDir: string, private config: Config) {
    const dataDir = join(baseDir, 'data/test');
    this.file = new File(dataDir);
    this.layoutPath = join(this.file.basePath, 'menu_layout.json');
  }

  /**
   * 保存布局数据
   * @param {LayoutConfig} layout 布局配置
   * @returns {Promise<boolean>} 是否成功
   */
  public async saveLayoutData(layout: LayoutConfig): Promise<boolean> {
    await this.file.ensureDir(this.layoutPath);
    return await this.file.writeFile(this.layoutPath, JSON.stringify(layout, null, 2));
  }

  /**
   * 加载布局数据
   * @returns {Promise<LayoutConfig|null>} 布局配置或null
   */
  public async loadLayoutData(): Promise<LayoutConfig|null> {
    const content = await this.file.readFile(this.layoutPath);
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
   * @param {CommandData[]} cmds 命令数据
   * @returns {Promise<LayoutConfig>} 布局配置
   */
  public async createAndSaveLayoutData(cmds: CommandData[]): Promise<LayoutConfig> {
    if (!cmds?.length) throw new Error('未找到可用的命令数据');

    // 按根命令分组
    const rootGroups = this.groupByRoot(cmds);
    const items: LayoutItem[] = [];

    // 添加标题项
    items.push({ name: 'menu-title', row: 0, col: 1, colSpan: 2 });

    // 为每个根命令创建布局项
    Object.entries(rootGroups).forEach(([root, cmds], i) => {
      const row = Math.floor(i / 2) + 1;
      const col = (i % 2) + 1;
      const rootItem: LayoutItem = { name: root, row, col, subItems: [], options: [] };
      this.processForLayout(cmds, root, rootItem);
      items.push(rootItem);
    });

    // 创建并保存布局配置
    const layout: LayoutConfig = {
      items,
      layout: {
        rows: Math.ceil(Object.keys(rootGroups).length / 2) + 1,
        cols: 2
      }
    };
    await this.saveLayoutData(layout);
    return layout;
  }

  /**
   * 处理命令布局数据
   * @param {CommandData[]} cmds 命令数据
   * @param {string} root 根命令名称
   * @param {LayoutItem} item 布局项
   */
  private processForLayout(cmds: CommandData[], root: string, item: LayoutItem): void {
    cmds.forEach(cmd => {
      // 子命令处理
      if (cmd.name !== root && cmd.name.startsWith(`${root}.`)) {
        const subItem: LayoutItem = { name: cmd.name, row: 0, col: 0 };

        // 处理选项
        if (cmd.options?.length) {
          subItem.options = cmd.options.map(opt => ({
            name: `${cmd.name}.option.${opt.name}`,
            row: 0, col: 0
          }));
        }
        item.subItems.push(subItem);
      }
      // 根命令选项处理
      else if (cmd.name === root && cmd.options?.length) {
        item.options = cmd.options.map(opt => ({
          name: `${cmd.name}.option.${opt.name}`,
          row: 0, col: 0
        }));
      }
    });
  }

  /**
   * 根据布局和命令数据生成内容配置
   * @param {string} cmd 命令名称
   * @param {CommandData[]} cmds 命令数据
   * @param {LayoutConfig} layout 布局配置
   * @returns {Promise<ContentConfig>} 内容配置
   */
  public async createContentConfig(
    cmd: string = null,
    cmds: CommandData[],
    layout: LayoutConfig,
  ): Promise<ContentConfig> {
    try {
      if (!cmds?.length || !layout) return null;
      return !cmd
        ? this.createMainMenuContent(cmds, layout)
        : this.createCommandDetailContent(this.findCommand(cmd, cmds));
    } catch (err) {
      logger.error(`生成内容配置失败: ${cmd || '主菜单'}`, err);
      return null;
    }
  }

  /**
   * 创建主菜单内容配置
   * @param {CommandData[]} cmds 命令数据
   * @param {LayoutConfig} layout 布局配置
   * @returns {ContentConfig} 内容配置
   */
  private createMainMenuContent(cmds: CommandData[], layout: LayoutConfig): ContentConfig {
    const rootGroups = this.groupByRoot(cmds);
    const items: GridItem[] = [];

    // 添加标题项
    const title = layout.items.find(item => item.name === 'menu-title');
    if (title) {
      items.push(this.createGridItem({
        row: title.row + 1,
        col: title.col,
        colSpan: title.colSpan,
        title: '命令菜单',
        content: '点击命令查看详细信息',
        icon: 'menu_book',
        id: 'menu-title',
        itemType: 'title'
      }));
    }

    // 为每个根命令创建网格项
    Object.entries(rootGroups).forEach(([root, cmds]) => {
      const layoutItem = layout.items.find(item => item.name === root);
      if (!layoutItem) return;

      // 计算子命令和选项数量
      const subCount = cmds.reduce((sum, cmd) => sum + (cmd.subCommands?.length || 0), 0);
      const optCount = cmds.reduce((sum, cmd) => sum + (cmd.options?.length || 0), 0);

      // 构建命令内容
      const content = cmds.map(cmd =>
        `${cmd.name}${cmd.description ? ` - ${cmd.description}` : ''}`
      ).join('\n');

      // 添加网格项
      items.push(this.createGridItem({
        row: layoutItem.row + 1,
        col: layoutItem.col,
        rowSpan: layoutItem.rowSpan,
        colSpan: layoutItem.colSpan,
        title: root,
        content,
        badge: this.formatBadge(cmds.length, subCount, optCount),
        icon: 'terminal',
        id: `cmd-${root}`,
        itemType: 'command'
      }));
    });

    // 返回内容配置
    return {
      header: {
        show: this.config.showHeader ?? true,
        title: this.config.headerTitle || '命令菜单',
        logo: this.config.headerLogo
      },
      footer: {
        show: this.config.showFooter ?? true,
        text: this.config.footerText || `共 ${cmds.length} 个命令`
      },
      layout: {
        rows: layout.layout.rows,
        cols: 2,
        items
      }
    };
  }

  /**
   * 创建命令详情内容配置
   * @param {CommandData} cmd 命令数据
   * @returns {ContentConfig} 内容配置
   */
  private createCommandDetailContent(cmd: CommandData): ContentConfig {
    if (!cmd) return null;
    const items: GridItem[] = [];
    let row = 1;

    // 判断命令类型
    const root = cmd.name.split('.')[0];
    const isRoot = cmd.name === root;
    const type = isRoot ? 'command' : 'subCommand';

    // 添加标题
    items.push(this.createGridItem({
      row: row++,
      col: 1,
      title: cmd.name,
      content: cmd.description || '无描述',
      icon: 'code',
      id: 'cmd-title',
      itemType: type
    }));

    // 添加用法
    if (cmd.usage) {
      items.push(this.createGridItem({
        row: row++,
        col: 1,
        title: '用法',
        content: cmd.usage,
        icon: 'description',
        id: 'cmd-usage',
        itemType: type
      }));
    }

    // 添加选项
    if (cmd.options?.length > 0) {
      const content = cmd.options.map(opt =>
        `${opt.name}${opt.syntax ? ' ' + opt.syntax : ''}${opt.description ? '\n  ' + opt.description : ''}`
      ).join('\n\n');

      items.push(this.createGridItem({
        row: row++,
        col: 1,
        title: '选项参数',
        content,
        icon: 'tune',
        badge: cmd.options.length,
        id: 'cmd-options',
        itemType: 'option'
      }));
    }

    // 添加示例
    if (cmd.examples?.length > 0) {
      items.push(this.createGridItem({
        row: row++,
        col: 1,
        title: '示例',
        content: cmd.examples.join('\n'),
        icon: 'integration_instructions',
        id: 'cmd-examples',
        itemType: type
      }));
    }

    // 添加子命令
    if (cmd.subCommands?.length > 0) {
      const content = cmd.subCommands.map(sub =>
        `${sub.name}${sub.description ? ` - ${sub.description}` : ''}`
      ).join('\n');

      items.push(this.createGridItem({
        row: row++,
        col: 1,
        title: '子命令',
        content,
        icon: 'account_tree',
        badge: cmd.subCommands.length,
        id: 'cmd-subcommands',
        itemType: 'subCommand'
      }));
    }

    // 返回内容配置
    return {
      header: {
        show: this.config.showHeader ?? true,
        title: `命令: ${cmd.name}`,
        logo: this.config.headerLogo
      },
      footer: {
        show: this.config.showFooter ?? true,
        text: this.config.footerText || 'Powered by Koishi'
      },
      layout: {
        rows: row - 1,
        cols: 1,
        items
      }
    };
  }

  /**
   * 创建网格项
   * @param {Object} opts 网格项选项
   * @returns {GridItem} 网格项
   */
  private createGridItem(opts: {
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
      row: opts.row,
      col: opts.col,
      rowSpan: opts.rowSpan,
      colSpan: opts.colSpan,
      type: 'text',
      title: opts.title,
      content: opts.content,
      icon: opts.icon,
      iconType: opts.icon ? 'material' : undefined,
      badge: opts.badge,
      id: opts.id,
      itemType: opts.itemType
    };
  }

  /**
   * 格式化徽章显示
   * @param {number} cmdCount 命令数量
   * @param {number} subCount 子命令数量
   * @param {number} optCount 选项数量
   * @returns {string} 徽章文本
   */
  private formatBadge(cmdCount: number, subCount: number, optCount: number): string {
    if (subCount > 0 && optCount > 0) return `${cmdCount}+${subCount}+${optCount}`;
    if (subCount > 0) return `${cmdCount}+${subCount}`;
    if (optCount > 0) return `${cmdCount}+${optCount}`;
    return String(cmdCount);
  }

  /**
   * 按根命令名分组
   * @param {CommandData[]} cmds 命令数据
   * @returns {Record<string, CommandData[]>} 分组结果
   */
  private groupByRoot(cmds: CommandData[]): Record<string, CommandData[]> {
    return cmds.reduce((groups, cmd) => {
      const root = cmd.name.split('.')[0];
      if (!groups[root]) groups[root] = [];
      groups[root].push(cmd);
      return groups;
    }, {} as Record<string, CommandData[]>);
  }

  /**
   * 在命令数组中查找指定命令
   * @param {string} name 命令名称
   * @param {CommandData[]} cmds 命令数据
   * @returns {CommandData|null} 命令数据或null
   */
  private findCommand(name: string, cmds: CommandData[]): CommandData|null {
    // 直接查找
    const found = cmds.find(cmd => cmd.name === name);
    if (found) return found;

    // 递归查找子命令
    for (const cmd of cmds) {
      if (cmd.subCommands?.length) {
        const sub = this.findCommand(name, cmd.subCommands);
        if (sub) return sub;
      }
    }
    return null;
  }
}