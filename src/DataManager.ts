import { Context, Logger } from 'koishi';
import { FileManager } from './FileManager';
import { CaveObject } from './index';

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
   * @param fileManager - 文件管理器实例
   * @param logger - 日志记录器
   * @param getNextCaveId - 用于获取新 ID 的函数
   */
  constructor(
    private ctx: Context,
    private fileManager: FileManager,
    private logger: Logger,
    private getNextCaveId: () => Promise<number>
  ) { }

  /**
   * 导出所有回声洞数据到 `cave_export.json` 文件。
   * 导出的数据不包含 id，以方便迁移。
   */
  public async exportData(): Promise<string> {
    const fileName = 'cave_export.json'; // 定义标准导出文件名
    const cavesToExport = await this.ctx.database.get('cave', {});

    // 移除 id 字段，使其可移植
    const portableCaves: PortableCaveObject[] = cavesToExport.map(({ id, ...rest }) => rest);

    // 格式化 JSON 以提高可读性
    const data = JSON.stringify(portableCaves, null, 2);
    await this.fileManager.saveFile(fileName, Buffer.from(data));

    return `成功导出 ${portableCaves.length} 条数据`;
  }

  /**
   * 从 `cave_import.json` 文件导入数据。
   * 会为每条导入的数据分配一个新的、连续的 ID。
   */
  public async importData(): Promise<string> {
    const fileName = 'cave_import.json'; // 定义标准导入文件名
    let importedCaves: PortableCaveObject[];

    try {
      const fileContent = await this.fileManager.readFile(fileName);
      importedCaves = JSON.parse(fileContent.toString('utf-8'));
      if (!Array.isArray(importedCaves)) {
        throw new Error('导入文件格式无效');
      }
    } catch (error) {
      this.logger.error(`读取导入文件失败:`, error);
    }

    let successCount = 0;
    for (const cave of importedCaves) {
      // 为导入的每条数据分配新的唯一 ID
      const newId = await this.getNextCaveId();
      const newCave: CaveObject = {
        ...cave,
        id: newId,
        channelId: cave.channelId || null, // 确保 channelId 不为 undefined
      };
      await this.ctx.database.create('cave', newCave);
      successCount++;
    }

    return `成功导入 ${successCount} 条回声洞数据`;
  }
}
