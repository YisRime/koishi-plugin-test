import { CommandData } from './extract'
import { GridItem, ContentConfig, MenuCommandData, MenuConfig } from './render'
import { logger } from './index'
import { join } from 'path'
import { File } from './utils'
import { Extract } from './extract'

/**
 * 命令转换器类 - 处理配置转换和管理
 */
export class Converter {
  private configDir: string;
  private fileManager: File;

  constructor(baseDir: string) {
    const dataDir = join(baseDir, 'data/test');
    this.configDir = join(dataDir, 'config');
    this.fileManager = new File(dataDir);

    // 确保目录存在
    this.fileManager.ensureDir(this.configDir).catch(err => {
      logger.error('创建配置目录失败', err);
    });
  }

  /**
   * 获取菜单配置文件路径
   */
  private getConfigPath(locale: string): string {
    return join(this.configDir, `menu_${locale}.json`);
  }

  /**
   * 获取菜单内容配置
   */
  public async getMenuContent(
    command: string = null,
    locale: string,
    extractor: Extract,
    headerLogo?: string
  ): Promise<ContentConfig> {
    try {
      // 获取或创建菜单数据
      const menuData = await this.getOrCreateMenuData(locale, extractor);
      if (!menuData) return null;

      // 根据命令参数返回不同配置
      if (!command) {
        return this.createMainMenuContent(menuData, headerLogo);
      } else {
        const cmdData = this.findCommandByName(command, menuData.commands);
        return cmdData ? this.createCommandDetailContent(cmdData, headerLogo) : null;
      }
    } catch (err) {
      logger.error(`获取菜单配置失败: ${command || '主菜单'}`, err);
      return null;
    }
  }

  /**
   * 获取或创建菜单数据
   */
  private async getOrCreateMenuData(locale: string, extractor: Extract): Promise<MenuConfig> {
    const configPath = this.getConfigPath(locale);

    // 尝试读取现有配置
    try {
      const content = await this.fileManager.readFile(configPath);
      if (content) return JSON.parse(content);
    } catch (e) {
      logger.warn(`读取菜单配置失败: ${configPath}`);
    }

    // 创建新配置
    return this.extractAndSaveMenuData(locale, extractor);
  }

  /**
   * 提取并保存菜单数据
   */
  public async extractAndSaveMenuData(
    locale: string,
    extractor: Extract
  ): Promise<MenuConfig> {
    // 提取命令数据
    const commands = await extractor.getProcessedCommands(locale);
    if (!commands?.length) throw new Error('未找到可用的命令');

    // 处理命令数据
    const menuCommands = this.processCommands(commands);

    // 创建配置
    const menuConfig: MenuConfig = {
      commands: menuCommands,
      layout: {
        rows: Math.ceil(this.getUniqueRootCommands(menuCommands).length / 2) + 1,
        cols: 2
      }
    };

    // 保存配置
    await this.saveMenuData(menuConfig, locale);
    return menuConfig;
  }

  /**
   * 处理命令数据，添加布局信息
   */
  private processCommands(commands: CommandData[]): MenuCommandData[] {
    // 按根命令名分组
    const rootGroups = this.groupByRoot(commands);
    const result: MenuCommandData[] = [];

    // 为每组命令添加位置信息
    Object.entries(rootGroups).forEach(([root, cmds], index) => {
      const row = Math.floor(index / 2) + 1;
      const col = (index % 2) + 1;

      // 处理组内每个命令
      cmds.forEach(cmd => {
        // 转换为菜单命令数据
        result.push({
          ...cmd,
          row,
          col,
          subCommands: cmd.subCommands?.map(sub => ({
            ...sub,
            row,
            col
          })) as MenuCommandData[]
        });
      });
    });

    return result;
  }

  /**
   * 按根命令名分组
   */
  private groupByRoot(commands: CommandData[]): Record<string, CommandData[]> {
    const groups: Record<string, CommandData[]> = {};

    commands.forEach(cmd => {
      const root = cmd.name.split('.')[0];
      if (!groups[root]) groups[root] = [];
      groups[root].push(cmd);
    });

    return groups;
  }

  /**
   * 获取唯一的根命令
   */
  private getUniqueRootCommands(commands: MenuCommandData[]): string[] {
    return Array.from(new Set(commands.map(cmd => cmd.name.split('.')[0])));
  }

  /**
   * 保存菜单数据
   */
  private async saveMenuData(data: MenuConfig, locale: string): Promise<void> {
    const configPath = this.getConfigPath(locale);
    await this.fileManager.ensureDir(configPath);
    await this.fileManager.writeFile(configPath, JSON.stringify(data, null, 2));
    logger.info(`已保存菜单配置: ${locale}`);
  }

  /**
   * 创建主菜单内容配置
   */
  private createMainMenuContent(menuData: MenuConfig, headerLogo?: string): ContentConfig {
    // 根据命令根名称分组
    const rootGroups = this.groupByRoot(menuData.commands);

    // 创建网格项，首先是标题项
    const gridItems: GridItem[] = [{
      row: 1,
      col: 1,
      colSpan: 2,
      type: 'text',
      title: '命令菜单',
      content: '点击命令查看详细信息',
      icon: 'menu_book',
      iconType: 'material',
      id: 'menu-title'
    }];

    // 为每个根命令创建一个网格项
    Object.entries(rootGroups).forEach(([root, cmds], index) => {
      const row = Math.floor(index / 2) + 2; // 从第2行开始
      const col = (index % 2) + 1;           // 1或2列

      // 格式化命令列表
      const content = cmds.map(cmd =>
        `${cmd.name}${cmd.description ? ` - ${cmd.description}` : ''}`
      ).join('\n');

      // 计算子命令数
      const subCmdCount = cmds.reduce((sum, cmd) =>
        sum + (cmd.subCommands?.length || 0), 0);

      // 添加网格项 - 移除contentStyle
      gridItems.push({
        row,
        col,
        type: 'text',
        title: root,
        content,
        badge: subCmdCount > 0 ? `${cmds.length}+${subCmdCount}` : `${cmds.length}`,
        icon: 'terminal',
        iconType: 'material',
        id: `cmd-${root}`
      });
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
        text: `共 ${menuData.commands.length} 个命令`
      },
      layout: {
        rows: menuData.layout.rows,
        cols: 2,
        gap: 16,
        items: gridItems
      }
    };
  }

  /**
   * 创建命令详情内容配置
   */
  private createCommandDetailContent(command: MenuCommandData, headerLogo?: string): ContentConfig {
    // 预计算需要的行数
    const hasOptions = command.options?.length > 0;
    const hasExamples = command.examples?.length > 0;
    const hasSubCommands = command.subCommands?.length > 0;
    const rows = 1 + (command.usage ? 1 : 0) + (hasOptions ? 1 : 0) +
                 (hasExamples ? 1 : 0) + (hasSubCommands ? 1 : 0);

    // 创建网格项列表 - 移除所有contentStyle
    const gridItems: GridItem[] = [];
    let currentRow = 1;

    // 添加标题
    gridItems.push({
      row: currentRow++,
      col: 1,
      type: 'text',
      title: command.name,
      content: command.description || '无描述',
      icon: 'code',
      iconType: 'material',
      id: 'cmd-title'
    });

    // 添加用法
    if (command.usage) {
      gridItems.push({
        row: currentRow++,
        col: 1,
        type: 'text',
        title: '用法',
        content: command.usage,
        icon: 'description',
        iconType: 'material',
        id: 'cmd-usage'
      });
    }

    // 添加选项
    if (hasOptions) {
      gridItems.push({
        row: currentRow++,
        col: 1,
        type: 'text',
        title: '选项参数',
        content: command.options.map(opt =>
          `${opt.name}${opt.syntax ? ' ' + opt.syntax : ''}${opt.description ? '\n  ' + opt.description : ''}`
        ).join('\n\n'),
        icon: 'tune',
        iconType: 'material',
        badge: command.options.length,
        id: 'cmd-options'
      });
    }

    // 添加示例
    if (hasExamples) {
      gridItems.push({
        row: currentRow++,
        col: 1,
        type: 'text',
        title: '示例',
        content: command.examples.join('\n'),
        icon: 'integration_instructions',
        iconType: 'material',
        id: 'cmd-examples'
      });
    }

    // 添加子命令
    if (hasSubCommands) {
      gridItems.push({
        row: currentRow++,
        col: 1,
        type: 'text',
        title: '子命令',
        content: command.subCommands.map(sub =>
          `${sub.name}${sub.description ? ` - ${sub.description}` : ''}`
        ).join('\n'),
        icon: 'account_tree',
        iconType: 'material',
        badge: command.subCommands.length,
        id: 'cmd-subcommands'
      });
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
        rows,
        cols: 1,
        gap: 16,
        items: gridItems
      }
    };
  }

  /**
   * 在命令数组中查找指定命令
   */
  private findCommandByName(name: string, commands: MenuCommandData[]): MenuCommandData | null {
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