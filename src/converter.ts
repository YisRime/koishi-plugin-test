import { CommandData } from './extract'
import { GridItem, RenderConfig } from './render'
import { logger } from './index'
import { join } from 'path'
import { File } from './utils'

/**
 * 命令转换器类 - 处理配置转换和管理
 */
export class CommandConverter {
  private configPath: string;
  private fileManager: File;
  private defaultConfig: RenderConfig;

  /**
   * 构造函数，初始化配置管理
   */
  constructor(baseDir: string, initialConfig?: RenderConfig) {
    const dataDir = join(baseDir, 'data/test');
    this.configPath = join(dataDir, 'default.json');
    this.fileManager = new File(dataDir);
    this.defaultConfig = initialConfig || this.createDefaultConfig();
  }

  /**
   * 创建默认配置
   */
  private createDefaultConfig(): RenderConfig {
    return {
      header: {
        show: true,
        title: '命令帮助',
        logo: 'https://koishi.chat/logo.png'
      },
      footer: {
        show: true,
        text: 'Powered by Koishi'
      },
      layout: {
        rows: 2,
        cols: 1,
        gap: 16,
        items: [
          {
            row: 1,
            col: 1,
            type: 'text',
            title: '提示',
            content: '请先使用 test.extract 命令提取可用命令',
            icon: 'info',
            iconType: 'material'
          }
        ]
      },
      style: {
        width: 800,
        background: '#ffffff',
        darkMode: false,
        accentColor: '#6750a4',
        fontSize: 16,
        containerRadius: 28,
        itemRadius: 16
      }
    };
  }

  /**
   * 加载渲染配置
   */
  public async loadConfig(): Promise<RenderConfig> {
    try {
      const content = await this.fileManager.readFile(this.configPath);
      // 如果配置文件存在则使用它，否则返回默认配置
      return content ? JSON.parse(content) : this.defaultConfig;
    } catch {
      logger.warn('加载配置失败，使用默认配置');
      return this.defaultConfig;
    }
  }

  /**
   * 保存当前配置为默认配置
   */
  public async saveConfig(config: RenderConfig): Promise<boolean> {
    if (!config) return false;

    try {
      await this.fileManager.ensureDir(this.configPath);
      const success = await this.fileManager.writeFile(
        this.configPath,
        JSON.stringify(config, null, 2)
      );
      if (success) {
        // 更新内存中的默认配置
        this.defaultConfig = config;
        logger.info('已保存新的默认渲染配置');
      }
      return success;
    } catch (err) {
      logger.error('保存配置失败', err);
      return false;
    }
  }

  /**
   * 合并配置
   */
  public mergeConfig(config: Partial<RenderConfig>, baseConfig: RenderConfig): RenderConfig {
    // 确保有基础配置
    const base = baseConfig || this.defaultConfig;

    return {
      header: {
        ...base.header,
        ...config.header,
        style: { ...base.header?.style, ...config.header?.style }
      },
      footer: {
        ...base.footer,
        ...config.footer,
        style: { ...base.footer?.style, ...config.footer?.style }
      },
      layout: {
        rows: config.layout?.rows ?? base.layout.rows,
        cols: config.layout?.cols ?? base.layout.cols,
        gap: config.layout?.gap ?? base.layout.gap,
        padding: config.layout?.padding ?? base.layout.padding,
        items: config.layout?.items ?? base.layout.items
      },
      style: {
        ...base.style,
        ...config.style
      },
      meta: {
        ...base.meta,
        ...config.meta
      }
    };
  }

  /**
   * 将命令数据转换为渲染配置
   */
  public convertToRenderConfig(commands: CommandData[], title: string = '命令帮助中心'): RenderConfig {
    if (!commands || !commands.length) {
      return this.defaultConfig;
    }

    try {
      // 对命令进行分组
      const groupedCommands = this.groupCommands(commands);

      // 创建布局项
      const gridItems = this.createLayoutItems(groupedCommands);

      // 计算行数和列数
      const cols = 2;
      const rows = Math.ceil(Object.keys(groupedCommands).length / 2) + 1;

      return {
        header: {
          show: true,
          title: title,
          logo: 'https://koishi.chat/logo.png'
        },
        footer: {
          show: true,
          text: `共 ${commands.length} 个命令 · Powered by Koishi`
        },
        layout: {
          rows,
          cols,
          gap: 16,
          padding: '8px',
          items: [
            // 标题项
            {
              row: 1,
              col: 1,
              colSpan: 2,
              type: 'text',
              title: title,
              content: '点击查看详细命令说明',
              icon: 'menu_book',
              iconType: 'material',
              style: {
                'padding': '16px',
                'text-align': 'center'
              },
              contentStyle: {
                'text-align': 'center',
                'opacity': '0.7',
                'margin-top': '8px'
              }
            },
            // 命令组项
            ...gridItems
          ]
        },
        style: {
          width: 800,
          background: '#ffffff',
          darkMode: false,
          accentColor: '#6750a4',
          fontSize: 16,
          containerRadius: 28,
          itemRadius: 16
        },
        meta: {
          version: '1.0.0',
          description: '由命令数据自动生成的帮助页面'
        }
      };
    } catch (err) {
      logger.error('转换命令数据为渲染配置失败', err);
      return this.defaultConfig;
    }
  }

  /**
   * 对命令进行分组
   * 根据命令名称的第一部分进行分组
   */
  private groupCommands(commands: CommandData[]): Record<string, CommandData[]> {
    const groups: Record<string, CommandData[]> = {}

    commands.forEach(cmd => {
      const groupName = cmd.name.split('.')[0]
      if (!groups[groupName]) {
        groups[groupName] = []
      }
      groups[groupName].push(cmd)
    })

    return groups
  }

  /**
   * 创建网格布局项
   */
  private createLayoutItems(groupedCommands: Record<string, CommandData[]>): GridItem[] {
    const gridItems: GridItem[] = []
    const groups = Object.entries(groupedCommands)

    // 为每个分组创建一个网格项
    groups.forEach(([groupName, cmds], index) => {
      // 计算位置：从第二行开始，左右两列
      const row = Math.floor(index / 2) + 2 // 2 是因为标题行占据第一行
      const col = (index % 2) + 1 // 1 或 2

      // 格式化命令列表 - 避免使用HTML转义
      const commandList = cmds.map(cmd => {
        const description = cmd.description
          ? ` - ${cmd.description}`
          : ''
        return `${cmd.name}${description}`
      }).join('\n')

      // 计算子命令数量
      const subCommandsCount = cmds.reduce((total, cmd) =>
        total + (cmd.subCommands?.length || 0), 0);

      // 添加徽章显示子命令数量
      const badge = subCommandsCount > 0 ? `${cmds.length}+${subCommandsCount}` : `${cmds.length}`;

      // 创建带有格式化文本的网格项
      gridItems.push({
        row,
        col,
        type: 'text',
        title: groupName, // 使用标题属性
        content: commandList,
        badge: badge,     // 添加徽章显示命令数量
        icon: 'terminal',
        iconType: 'material',
        style: {},
        contentStyle: {
          'white-space': 'pre-line', // 保留换行符
          'max-height': '300px',
          'overflow-y': 'auto',
          'font-family': 'monospace'
        }
      })
    })

    return gridItems
  }

  /**
   * 为单个命令生成详细渲染配置
   */
  public commandToDetailConfig(command: CommandData, title: string = '命令详情'): RenderConfig {
    if (!command) {
      return this.defaultConfig;
    }

    try {
      // 计算行数
      const hasSubCommands = command.subCommands && command.subCommands.length > 0;
      const rows = hasSubCommands ? 3 : 2;

      // 基本信息项
      const items: GridItem[] = [
        // 命令信息头
        {
          row: 1,
          col: 1,
          type: 'text',
          title: command.name,
          content: command.description || '无描述',
          icon: 'code',
          iconType: 'material',
          style: {}
        },
        // 命令详细信息
        this.createCommandDetailItem(command, 2, 1)
      ];

      // 添加子命令区块
      if (hasSubCommands) {
        const subItem = this.createSubCommandsItem(command.subCommands, 3, 1);
        if (subItem) items.push(subItem);
      }

      return {
        header: {
          show: true,
          title: `命令: ${command.name}`,
          logo: 'https://koishi.chat/logo.png'
        },
        footer: {
          show: true,
          text: 'Powered by Koishi'
        },
        layout: {
          rows,
          cols: 1,
          gap: 16,
          items: items
        },
        style: {
          width: 800,
          background: '#ffffff',
          darkMode: false,
          accentColor: '#6750a4',
          fontSize: 16,
          containerRadius: 28,
          itemRadius: 16
        }
      };
    } catch (err) {
      logger.error('转换命令详情为渲染配置失败', err);
      return this.defaultConfig;
    }
  }

  /**
   * 创建命令详细信息项
   */
  private createCommandDetailItem(command: CommandData, row: number, col: number): GridItem {
    let contentSections: string[] = [];

    // 用法区块
    if (command.usage) {
      contentSections.push(`【用法】\n${command.usage}`);
    }

    // 选项区块
    if (command.options && command.options.length > 0) {
      const optionsText = command.options.map(opt =>
        `${opt.name}${opt.syntax ? ' ' + opt.syntax : ''}\n  ${opt.description || '-'}`
      ).join('\n\n');
      contentSections.push(`【选项参数】\n${optionsText}`);
    }

    // 示例区块
    if (command.examples && command.examples.length > 0) {
      const examplesText = command.examples.join('\n');
      contentSections.push(`【示例】\n${examplesText}`);
    }

    // 如果没有内容
    if (contentSections.length === 0) {
      contentSections.push('此命令没有更多详细信息');
    }

    // 合并内容
    const content = contentSections.join('\n\n');

    return {
      row,
      col,
      type: 'text',
      title: '详细信息',
      content: content,
      icon: 'info',
      iconType: 'material',
      style: { 'padding': '16px' },
      contentStyle: {
        'white-space': 'pre-wrap',
        'font-family': 'monospace'
      }
    };
  }

  /**
   * 创建子命令展示项
   */
  private createSubCommandsItem(subCommands: CommandData[], row: number, col: number): GridItem {
    if (!subCommands || subCommands.length === 0) {
      return null;
    }

    // 格式化子命令列表
    const subCommandsList = subCommands.map(cmd => {
      const description = cmd.description ? ` - ${cmd.description}` : '';
      return `${cmd.name}${description}`;
    }).join('\n');

    return {
      row,
      col,
      type: 'text',
      title: '子命令',
      content: subCommandsList,
      icon: 'account_tree',
      iconType: 'material',
      badge: `${subCommands.length}`,
      style: {},
      contentStyle: {
        'white-space': 'pre-line',
        'font-family': 'monospace'
      }
    };
  }

  /**
   * 为子命令创建配置列表
   * 返回多个子命令的详细配置
   */
  public createSubCommandConfigs(command: CommandData): RenderConfig[] {
    if (!command || !command.subCommands || command.subCommands.length === 0) {
      return [];
    }

    // 为每个子命令创建详细配置
    return command.subCommands.map(subCmd =>
      this.commandToDetailConfig(subCmd, `子命令: ${subCmd.name}`)
    );
  }

  /**
   * 将配置对象扩展到一个完整的渲染配置
   * 用于快速创建或修改配置
   */
  public extendConfig(partial: Partial<RenderConfig>, baseConfig?: RenderConfig): RenderConfig {
    const base = baseConfig;

    return {
      header: { ...base.header, ...partial.header },
      footer: { ...base.footer, ...partial.footer },
      layout: {
        rows: partial.layout?.rows ?? base.layout.rows,
        cols: partial.layout?.cols ?? base.layout.cols,
        gap: partial.layout?.gap ?? base.layout.gap,
        items: partial.layout?.items ?? base.layout.items
      },
      style: {
        width: partial.style?.width ?? base.style.width,
        background: partial.style?.background ?? base.style.background,
        darkMode: partial.style?.darkMode ?? base.style.darkMode,
        accentColor: partial.style?.accentColor ?? base.style.accentColor
      }
    };
  }

  /**
   * 基于命令数据更新现有配置
   * 保留自定义样式设置，但更新命令内容
   */
  public updateConfigWithCommands(
    commands: CommandData[],
    currentConfig: RenderConfig
  ): RenderConfig {
    if (!commands || commands.length === 0) {
      return currentConfig;
    }

    // 获取新的命令布局配置
    const newConfig = this.convertToRenderConfig(commands);

    // 合并配置，保留当前样式和页眉页脚设置
    return {
      // 保留当前的页眉设置，但使用新的命令数量
      header: {
        ...currentConfig.header,
        title: currentConfig.header.title || newConfig.header.title
      },
      // 更新命令数量
      footer: {
        ...currentConfig.footer,
        text: `共 ${commands.length} 个命令 · Powered by Koishi`
      },
      // 使用新的布局
      layout: newConfig.layout,
      // 保留当前样式设置
      style: { ...currentConfig.style }
    };
  }
}
