import { Context, h, Logger } from 'koishi';
import { CaveObject, Config } from './index';
import { FileManager } from './FileManager';
import { buildCaveMessage } from './Utils';

/**
 * 管理回声洞的审核流程。
 */
export class ReviewManager {
  /**
   * @param ctx Koishi 上下文
   * @param config 插件配置
   * @param fileManager 文件管理器实例
   * @param logger 日志记录器实例
   */
  constructor(
    private ctx: Context,
    private config: Config,
    private fileManager: FileManager,
    private logger: Logger,
  ) {}

  /**
   * 注册与审核相关的命令
   */
  public registerCommands(cave) {
    cave.subcommand('.review [id:posint] [action:string]', '审核回声洞')
      .usage('查看或审核回声洞，使用 <Y/N> 进行审核。')
      .action(async ({ session }, id, action) => {
        if (!this.config.adminUsers.includes(session.userId)) {
          return '抱歉，你没有权限审核回声洞';
        }

        // Case 1: 无参数，列出所有待审核的回声洞
        if (!id) {
          const pendingCaves = await this.ctx.database.get('cave', { status: 'pending' });
          if (pendingCaves.length === 0) {
            return '当前没有需要审核的回声洞';
          }
          const pendingIds = pendingCaves.map(c => c.id).join('|');
          return `当前共有 ${pendingIds.length} 条待审核回声洞，序号为：\n${pendingIds}`;
        }

        const [targetCave] = await this.ctx.database.get('cave', { id });
        if (!targetCave) {
          return `回声洞（${id}）不存在`;
        }
        if (targetCave.status !== 'pending') {
          return `回声洞（${id}）无需审核`;
        }

        // Case 2: 只有 ID，没有操作，则显示该待审回声洞的详细内容
        if (id && !action) {
          return this.buildReviewMessage(targetCave);
        }

        // Case 3: 有 ID 和操作，处理审核
        const normalizedAction = action.toLowerCase();
        let reviewAction: 'approve' | 'reject';

        if (normalizedAction === 'y') {
          reviewAction = 'approve';
        } else if (normalizedAction === 'n') {
          reviewAction = 'reject';
        } else {
          return `无效操作: ${action}。请使用 "Y" (通过) 或 "N" (拒绝)`;
        }

        return this.processReview(reviewAction, id, session.userId);
      });
  }

  /**
   * 将一条新的回声洞提交给管理员审核。
   */
  public async sendForReview(cave: CaveObject): Promise<void> {
    if (!this.config.adminUsers?.length) {
      await this.ctx.database.upsert('cave', [{ id: cave.id, status: 'active' }]);
      return;
    }

    const reviewMessage = await this.buildReviewMessage(cave);
    try {
      await this.ctx.broadcast(this.config.adminUsers, reviewMessage);
    } catch (error) {
      this.logger.error(`广播回声洞（${cave.id}）审核请求失败:`, error);
    }
  }

  /**
   * 构建发送给管理员的审核消息。
   */
  private async buildReviewMessage(cave: CaveObject): Promise<(string | h)[]> {
    // 直接调用导入的函数
    const caveContent = await buildCaveMessage(cave, this.config, this.fileManager, this.logger);

    return [
      h('p', `以下回声洞待审核`),
      ...caveContent,
    ];
  }

  /**
   * 处理管理员的审核决定。
   */
  public async processReview(action: string, caveId: number, adminUserId: string): Promise<string | (string | h)[]> {
    const [cave] = await this.ctx.database.get('cave', { id: caveId });

    if (!cave) return `回声洞（${caveId}）不存在`;
    if (cave.status !== 'pending') return `回声洞（${caveId}）无需审核`;

    let resultMessage: string;
    let broadcastMessage: string | (string | h)[];

    if (action === 'approve') {
      await this.ctx.database.upsert('cave', [{ id: caveId, status: 'active' }]);
      resultMessage = `回声洞（${caveId}）已通过`;
      broadcastMessage = `回声洞（${caveId}）已由 ${adminUserId} 通过`;
    } else { // 'reject'
      await this.ctx.database.upsert('cave', [{ id: caveId, status: 'delete' }]);
      resultMessage = `回声洞（${caveId}）已拒绝`;

      const caveContent = await buildCaveMessage(cave, this.config, this.fileManager, this.logger);
      broadcastMessage = [
        h('p', `回声洞（${caveId}）已由 ${adminUserId} 拒绝`),
        ...caveContent
      ];
    }

    if (broadcastMessage && this.config.adminUsers?.length) {
      await this.ctx.broadcast(this.config.adminUsers, broadcastMessage).catch(err => {
        this.logger.error(`广播回声洞（${cave.id}）审核结果失败:`, err);
      });
    }

    return resultMessage;
  }
}
