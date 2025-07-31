import { Context, Schema, Logger, h, Session } from 'koishi'
import { FileManager } from './FileManager'
import { ProfileManager } from './ProfileManager'
import { DataManager } from './DataManager'
import { ReviewManager } from './ReviewManager'
import * as utils from './Utils'

export const name = 'best-cave'
export const inject = ['database']

// 插件使用说明
export const usage = `
<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">📌 插件说明</h2>
  <p>📖 <strong>使用文档</strong>：请点击左上角的 <strong>插件主页</strong> 查看插件使用文档</p>
  <p>🔍 <strong>更多插件</strong>：可访问 <a href="https://github.com/YisRime" style="color:#4a6ee0;text-decoration:none;">苡淞的 GitHub</a> 查看本人的所有插件</p>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #e0574a;">❤️ 支持与反馈</h2>
  <p>🌟 喜欢这个插件？请在 <a href="https://github.com/YisRime" style="color:#e0574a;text-decoration:none;">GitHub</a> 上给我一个 Star！</p>
  <p>🐛 遇到问题？请通过 <strong>Issues</strong> 提交反馈，或加入 QQ 群 <a href="https://qm.qq.com/q/PdLMx9Jowq" style="color:#e0574a;text-decoration:none;"><strong>855571375</strong></a> 进行交流</p>
</div>
`
const logger = new Logger('best-cave');

// --- 数据类型定义 ---
export interface StoredElement {
  type: 'text' | 'img' | 'video' | 'audio' | 'file';
  content?: string;
  file?: string;
}

export interface CaveObject {
  id: number
  elements: StoredElement[]
  channelId: string
  userId: string
  userName: string
  time: Date
  status: 'active' | 'delete' | 'pending'
}

declare module 'koishi' {
  interface Tables {
    cave: CaveObject
  }
}

// --- 插件配置 ---
export interface Config {
  cooldown: number
  perChannel: boolean
  adminUsers: string[]
  enableProfile: boolean
  enableDataIO: boolean
  enableReview: boolean
  enableS3: boolean
  endpoint?: string
  region?: string
  accessKeyId?: string
  secretAccessKey?: string
  bucket?: string
  publicUrl?: string
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    cooldown: Schema.number().default(10).description("冷却时间（秒）"),
    perChannel: Schema.boolean().default(false).description("启用分群模式"),
    enableProfile: Schema.boolean().default(false).description("启用自定义昵称"),
    enableDataIO: Schema.boolean().default(false).description("启用导入导出"),
    adminUsers: Schema.array(Schema.string()).default([]).description("管理员 ID 列表"),
  }).description("基础配置"),
  Schema.object({
    enableReview: Schema.boolean().default(false).description("启用审核"),
  }).description('审核配置'),
  Schema.object({
    enableS3: Schema.boolean().default(false).description("启用 S3 存储"),
    endpoint: Schema.string().required().description('端点 (Endpoint)'),
    bucket: Schema.string().required().description('存储桶 (Bucket)'),
    region: Schema.string().default('auto').description('区域 (Region)'),
    publicUrl: Schema.string().description('公共访问 URL').role('link'),
    accessKeyId: Schema.string().required().description('Access Key ID').role('secret'),
    secretAccessKey: Schema.string().required().description('Secret Access Key').role('secret'),
  }).description("存储配置"),
]);

// --- 插件主逻辑 ---
export function apply(ctx: Context, config: Config) {

  ctx.model.extend('cave', {
    id: 'unsigned',
    channelId: 'string',
    elements: 'json',
    userId: 'string',
    userName: 'string',
    time: 'timestamp',
    status: 'string',
  }, {
    primary: 'id',
  })

  // --- 初始化管理器 ---

  const fileManager = new FileManager(ctx.baseDir, config, logger)
  const lastUsed = new Map<string, number>()

  let profileManager: ProfileManager;
  let dataManager: DataManager;
  let reviewManager: ReviewManager;

  // --- 指令定义 ---

  const cave = ctx.command('cave', '回声洞')
    .option('add', '-a <content:text> 添加回声洞')
    .option('view', '-g <id:posint> 查看指定回声洞')
    .option('delete', '-r <id:posint> 删除指定回声洞')
    .option('list', '-l 查询投稿统计')
    .usage('随机抽取一条已添加的回声洞。')
    .action(async ({ session, options }) => {
      if (options.add) return session.execute(`cave.add ${options.add}`);
      if (options.view) return session.execute(`cave.view ${options.view}`);
      if (options.delete) return session.execute(`cave.del ${options.delete}`);
      if (options.list) return session.execute('cave.list');

      const cdMessage = utils.checkCooldown(session, config, lastUsed);
      if (cdMessage) return cdMessage;

      try {
        const query = utils.getScopeQuery(session, config);
        const candidates = await ctx.database.get('cave', query, { fields: ['id'] });
        if (candidates.length === 0) return `当前${config.perChannel ? '本群' : ''}还没有回声洞`;

        const randomId = candidates[Math.floor(Math.random() * candidates.length)].id;
        const [randomCave] = await ctx.database.get('cave', { ...query, id: randomId });

        utils.updateCooldownTimestamp(session, config, lastUsed);
        return utils.buildCaveMessage(randomCave, config, fileManager, logger);
      } catch (error) {
        logger.error('随机获取回声洞失败:', error);
        return '随机获取回声洞失败';
      }
    });

  cave.subcommand('.add [content:text]', '添加回声洞')
    .usage('添加一条回声洞。可以直接发送内容，也可以回复或引用一条消息。')
    .action(async ({ session }, content) => {
      utils.cleanupPendingDeletions(ctx, fileManager, logger);

      const savedFileIdentifiers: string[] = [];
      try {
        let sourceElements: h[];
        if (session.quote?.elements) {
          sourceElements = session.quote.elements;
        } else if (content?.trim()) {
          sourceElements = h.parse(content);
        } else {
          await session.send("请在一分钟内发送你要添加的回声洞内容");
          const reply = await session.prompt(60000);
          if (!reply) return "操作超时，已取消添加";
          sourceElements = h.parse(reply);
        }

        const newId = await utils.getNextCaveId(ctx, utils.getScopeQuery(session, config));
        const finalElementsForDb: StoredElement[] = [];
        let mediaIndex = 0;

        async function traverseAndProcess(elements: h[]) {
          for (const el of elements) {
            const elementType = (el.type === 'image' ? 'img' : el.type) as StoredElement['type'];

            if (['img', 'video', 'audio', 'file'].includes(elementType) && el.attrs.src) {
              let fileIdentifier = el.attrs.src;
              if (fileIdentifier.startsWith('http')) {
                mediaIndex++;
                const originalName = el.attrs.file as string;
                const savedId = await utils.downloadMedia(ctx, fileManager, fileIdentifier, originalName, elementType, newId, mediaIndex, session.channelId, session.userId);
                savedFileIdentifiers.push(savedId);
                fileIdentifier = savedId;
              }
              finalElementsForDb.push({ type: elementType, file: fileIdentifier });
            } else if (elementType === 'text' && el.attrs.content?.trim()) {
              finalElementsForDb.push({ type: 'text', content: el.attrs.content.trim() });
            }

            if (el.children) await traverseAndProcess(el.children);
          }
        }
        await traverseAndProcess(sourceElements);

        if (finalElementsForDb.length === 0) return "内容为空，已取消添加";

        let userName = session.username;
        if (config.enableProfile) {
          userName = (await profileManager.getNickname(session.userId)) || userName;
        }

        const newCave: CaveObject = {
          id: newId,
          channelId: session.channelId || 'private',
          elements: finalElementsForDb,
          userId: session.userId,
          userName: userName,
          time: new Date(),
          status: config.enableReview ? 'pending' : 'active',
        };
        await ctx.database.create('cave', newCave);

        if (newCave.status === 'pending') {
          reviewManager.sendForReview(newCave);
          return `提交成功，序号为（${newCave.id}）`;
        }

        return `添加成功，序号为（${newId}）`;
      } catch (error) {
        logger.error('添加回声洞失败:', error);
        if (savedFileIdentifiers.length > 0) {
          logger.info(`添加失败，删除已创建的 ${savedFileIdentifiers.length} 个文件...`);
          await Promise.all(savedFileIdentifiers.map(fileId => fileManager.deleteFile(fileId)));
        }
        return '添加失败，请稍后再试';
      }
    });

  cave.subcommand('.view <id:posint>', '查看指定回声洞')
    .usage('通过序号查看对应的回声洞。')
    .action(async ({ session }, id) => {
      if (!id) return '请输入要查看的回声洞序号';

      const cdMessage = utils.checkCooldown(session, config, lastUsed);
      if (cdMessage) return cdMessage;

      try {
        const query = { ...utils.getScopeQuery(session, config), id };
        const [cave] = await ctx.database.get('cave', query);
        if (!cave) return `回声洞（${id}）不存在`;

        utils.updateCooldownTimestamp(session, config, lastUsed);
        return utils.buildCaveMessage(cave, config, fileManager, logger);
      } catch (error) {
        logger.error(`查看回声洞（${id}）失败:`, error);
        return '查看失败，请稍后再试';
      }
    });

  cave.subcommand('.del <id:posint>', '删除指定回声洞')
    .usage('通过序号删除对应的回声洞，仅限创建者或管理员。')
    .action(async ({ session }, id) => {
      if (!id) return '请输入要删除的回声洞序号';

      try {
        const [targetCave] = await ctx.database.get('cave', { id, status: 'active' });
        if (!targetCave) return `回声洞（${id}）不存在`;

        const isOwner = targetCave.userId === session.userId;
        const isAdmin = config.adminUsers.includes(session.userId);
        if (!isOwner && !isAdmin) {
          return '抱歉，你不能删除他人的回声洞';
        }

        const caveMessage = await utils.buildCaveMessage(targetCave, config, fileManager, logger);
        await ctx.database.upsert('cave', [{ id: id, status: 'delete' }]);
        utils.cleanupPendingDeletions(ctx, fileManager, logger);

        return [
          h('p', {}, `以下内容已删除`),
          ...caveMessage,
        ];
      } catch (error) {
        logger.error(`标记回声洞（${id}）失败:`, error);
        return '删除失败，请稍后再试';
      }
    });

  cave.subcommand('.list', '查询我的投稿')
    .usage('查询并列出你所有投稿的回声洞序号。')
    .action(async ({ session }) => {
      try {
        const query = { ...utils.getScopeQuery(session, config), userId: session.userId, status: 'active' as const };
        const userCaves = await ctx.database.get('cave', query);
        if (userCaves.length === 0) return '你还没有投稿过回声洞';

        const caveIds = userCaves.map(c => c.id).sort((a, b) => a - b).join('|');
        return `你已投稿 ${userCaves.length} 条回声洞，序号为：\n${caveIds}`;
      } catch (error) {
        logger.error('查询投稿列表失败:', error);
        return '查询失败，请稍后再试';
      }
    });

  if (config.enableProfile) {
    profileManager = new ProfileManager(ctx);
    profileManager.registerCommands(cave);
  }

  if (config.enableDataIO) {
    dataManager = new DataManager(ctx, config, fileManager, logger);
    dataManager.registerCommands(cave);
  }

  if (config.enableReview) {
    reviewManager = new ReviewManager(ctx, config, fileManager, logger);
    reviewManager.registerCommands(cave);
  }

}
