import { Context, Logger } from 'koishi';
import { FileManager } from './FileManager';
import { CaveObject } from './index';

// 定义一个没有 'id' 的 Cave 类型，用于导入/导出
type PortableCaveObject = Omit<CaveObject, 'id'>;

/**
 * DataManager 类负责处理数据的导入和导出。
 */
export class DataManager {

  constructor(
    private ctx: Context,
    private fileManager: FileManager,
    private logger: Logger,
    private getNextCaveId: () => Promise<number>
  ) { }

  /**
   * 将全局所有数据导出到 cave_export.json，不包含 id。
   * @returns 导出的文件名
   */
  public async exportData(): Promise<string> {
    const fileName = 'cave_export.json'; // 固定导出文件名
    try {
      const cavesToExport = await this.ctx.database.get('best_cave', {});

      // 在序列化之前，移除每个对象的 id 字段
      const portableCaves: PortableCaveObject[] = cavesToExport.map(({ id, ...rest }) => rest);

      const data = JSON.stringify(portableCaves, null, 2); // 格式化 JSON 输出
      // saveFile 会自动覆写已存在的文件
      await this.fileManager.saveFile(fileName, Buffer.from(data));
      return;
    } catch (error) {
      this.logger.error('数据导出失败:', error);
      throw error;
    }
  }

  /**
   * 从 cave_import.json 文件全局导入数据到数据库。
   * @returns 包含导入数量和文件名的对象
   */
  public async importData(): Promise<{ count: number }> {
    const fileName = 'cave_import.json'; // 固定导入文件名
    let importedCaves: PortableCaveObject[];
    try {
      const fileContent = await this.fileManager.readFile(fileName);
      importedCaves = JSON.parse(fileContent.toString('utf-8'));
      if (!Array.isArray(importedCaves)) {
        throw new Error('文件格式无效');
      }
    } catch (error) {
      this.logger.error(`解析导入文件 '${fileName}' 失败:`, error);
      throw error;
    }

    let mergedCount = 0;
    for (const cave of importedCaves) {
      // 获取下一个可用的全局 ID
      const newId = await this.getNextCaveId();
      const newCave: CaveObject = {
        ...cave,
        id: newId,
        channelId: cave.channelId || null,
      };
      await this.ctx.database.create('best_cave', newCave);
      mergedCount++;
    }
    return;
  }
}
