import { Context, Logger } from 'koishi';
import { FileManager } from './FileManager';
import { CaveObject, Config } from './index';
import { getNextCaveId } from './Utils';

/**
 * 用于导入导出的可移植回声洞对象（不含数据库自增 id）。
 */
type PortableCaveObject = Omit<CaveObject, 'id'>;

/**
 * 负责数据的导入和导出功能。
 * 仅当配置中启用时才会被实例化。
 */
export class DataManager {
  /**
   * @param ctx - Koishi 上下文
   * @param config - 插件配置
   * @param fileManager - 文件管理器实例
   * @param logger - 日志记录器实例
   */
  constructor(
    private ctx: Context,
    private config: Config,
    private fileManager: FileManager,
    private logger: Logger,
  ) {}

  /**
   * 注册与数据导入导出相关的命令
   */
  public registerCommands(cave) {
    cave.subcommand('.export', '导出回声洞数据')
      .usage('将所有回声洞数据导出到 cave_export.json。')
      .action(async ({ session }) => {
        if (!this.config.adminUsers.includes(session.userId)) return '抱歉，你没有权限导出数据';
        try {
          await session.send('正在导出数据，请稍候...');
          const resultMessage = await this.exportData();
          return resultMessage;
        } catch (error) {
          this.logger.error('导出数据时发生错误:', error);
          return `导出失败: ${error.message}`;
        }
      });

    cave.subcommand('.import', '导入回声洞数据')
      .usage('从 cave_import.json 中导入回声洞数据。')
      .action(async ({ session }) => {
        if (!this.config.adminUsers.includes(session.userId)) return '抱歉，你没有权限导入数据';
        try {
          await session.send('正在导入数据，请稍候...');
          const resultMessage = await this.importData();
          return resultMessage;
        } catch (error) {
          this.logger.error('导入数据时发生错误:', error);
          return `导入失败: ${error.message}`;
        }
      });
  }

  /**
   * 导出所有状态为 'active' 的回声洞数据到 `cave_export.json` 文件。
   */
  public async exportData(): Promise<string> {
    const fileName = 'cave_export.json';
    const cavesToExport = await this.ctx.database.get('cave', { status: 'active' });

    const portableCaves: PortableCaveObject[] = cavesToExport.map(({ id, ...rest }) => rest);

    const data = JSON.stringify(portableCaves, null, 2);
    await this.fileManager.saveFile(fileName, Buffer.from(data));

    return `成功导出 ${portableCaves.length} 条数据`;
  }

  /**
   * 从 `cave_import.json` 文件导入数据。
   */
  public async importData(): Promise<string> {
    const fileName = 'cave_import.json';
    let importedCaves: PortableCaveObject[];

    try {
      const fileContent = await this.fileManager.readFile(fileName);
      importedCaves = JSON.parse(fileContent.toString('utf-8'));
      if (!Array.isArray(importedCaves)) {
        throw new Error('导入文件格式无效');
      }
    } catch (error) {
      this.logger.error(`读取导入文件失败:`, error);
      return `读取导入文件失败: ${error.message || '未知错误'}`;
    }

    let successCount = 0;
    for (const cave of importedCaves) {
      const newId = await getNextCaveId(this.ctx, {}); // 直接调用导入的函数
      const newCave: CaveObject = {
        ...cave,
        id: newId,
        channelId: cave.channelId || null,
        status: 'active',
      };
      await this.ctx.database.create('cave', newCave);
      successCount++;
    }

    return `成功导入 ${successCount} 条回声洞数据`;
  }
}
