import { Context, Schema, Logger, h, Session } from 'koishi'
import * as path from 'path'
import { FileManager } from './FileManager'
import { ProfileManager } from './ProfileManager'
import { DataManager } from './DataManager'

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

/** 数据库中存储的 h.Element 的可序列化格式 */
export interface StoredElement {
  type: 'text' | 'img' | 'video' | 'audio' | 'file';
  content?: string; // 文本内容
  file?: string;    // 媒体文件名
}

/** 数据库中存储的回声洞对象结构 */
export interface CaveObject {
  id: number
  elements: StoredElement[]
  channelId: string
  userId: string
  userName: string
  time: Date
  status: 'active' | 'delete'
}

// 扩展 Koishi Tables 接口以获得 'cave' 表的类型提示
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
    cooldown: Schema.number().default(10).description("指令冷却时间（秒）"),
    perChannel: Schema.boolean().default(false).description("启用分群模式"),
    enableProfile: Schema.boolean().default(false).description("启用自定义昵称"),
    enableDataIO: Schema.boolean().default(false).description("启用导入导出"),
    enableS3: Schema.boolean().default(false).description('启用 S3 存储'),
    adminUsers: Schema.array(Schema.string()).default([]).description("管理员 ID 列表"),
  }).description("基础配置"),
  Schema.union([
    Schema.object({
      enableS3: Schema.const(false).default(false),
    }),
    Schema.object({
      enableS3: Schema.const(true).required(),
      endpoint: Schema.string().required().description('端点 (Endpoint)'),
      bucket: Schema.string().required().description('存储桶 (Bucket)'),
      region: Schema.string().default('auto').description('区域 (Region)'),
      publicUrl: Schema.string().description('公共访问 URL').role('link'),
      accessKeyId: Schema.string().required().description('Access Key ID').role('secret'),
      secretAccessKey: Schema.string().required().description('Secret Access Key').role('secret'),
    }),
  ]).description("存储配置"),
]);

// --- 插件主逻辑 ---
export function apply(ctx: Context, config: Config) {
  // 定义 'cave' 数据库表模型
  ctx.model.extend('cave', {
    id: 'unsigned',       // 自增主键
    channelId: 'string',  // 频道/群组 ID
    elements: 'json',     // 存储的消息元素
    userId: 'string',     // 创建者 ID
    userName: 'string',   // 创建者昵称
    time: 'timestamp',    // 创建时间
    status: 'string',     // 状态: 'active' 或 'delete'
  }, {
    primary: 'id',
  })

  // --- 初始化管理器 ---
  const fileManager = new FileManager(ctx.baseDir, logger, config)
  const lastUsed = new Map<string, number>()

  let profileManager: ProfileManager;
  if (config.enableProfile) {
    profileManager = new ProfileManager(ctx);
  }

  let dataManager: DataManager;
  if (config.enableDataIO) {
    dataManager = new DataManager(ctx, fileManager, logger, () => getNextCaveId({}));
  }

  /**
   * 清理被标记为 'delete' 的回声洞。
   * 此函数会物理删除关联的文件和数据库记录。
   * 由 .add 和 .del 命令在执行前异步触发，无需等待其完成。
   */
  async function cleanupPendingDeletions() {
    try {
      const cavesToDelete = await ctx.database.get('cave', { status: 'delete' });
      if (cavesToDelete.length === 0) return; // 无需清理，静默返回

      for (const cave of cavesToDelete) {
        // 并行删除所有关联的文件
        const deletePromises = cave.elements
          .filter(el => el.file)
          .map(el => fileManager.deleteFile(el.file));
        await Promise.all(deletePromises);
        // 从数据库中移除记录
        await ctx.database.remove('cave', { id: cave.id });
      }
    } catch (error) {
      logger.error('清理回声洞失败:', error);
    }
  }

  /**
   * 将数据库存储的 StoredElement[] 格式转换为 Koishi 的 h[] 元素数组。
   * @param elements - 数据库中存储的元素数组
   * @returns Koishi h 元素数组
   */
  const storedFormatToHElements = (elements: StoredElement[]): h[] => {
    return elements.map(el => {
      switch (el.type) {
        case 'text': return h.text(el.content);
        case 'img': return h('image', { src: el.file });
        case 'video':
        case 'audio':
        case 'file': return h(el.type, { src: el.file });
        default: return null;
      }
    }).filter(Boolean); // 过滤掉 null 结果
  };

  /**
   * 根据插件配置和当前会话，生成数据库查询所需的范围。
   * @param session - Koishi 会话对象
   * @returns 数据库查询条件对象
   */
  const getScopeQuery = (session: Session): object => {
    const baseQuery = { status: 'active' as const };
    // 如果是分群模式，则限定在当前频道
    if (config.perChannel && session.channelId) {
      return { ...baseQuery, channelId: session.channelId };
    }
    return baseQuery;
  };

  /**
   * 获取下一个可用的回声洞 ID。
   * 通过查找现有 ID 序列中的第一个空缺来保证 ID 尽可能连续。
   * @param query - 限制查询范围的条件
   * @returns 一个新的、唯一的、连续的 ID
   */
  async function getNextCaveId(query: object = {}): Promise<number> {
    const allCaves = await ctx.database.get('cave', query, { fields: ['id'] });
    const existingIds = new Set(allCaves.map(c => c.id));
    let newId = 1;
    while (existingIds.has(newId)) {
      newId++;
    }
    return newId;
  }

  /**
   * 将本地媒体文件元素转换为 Base64 格式，以便直接在消息中发送。
   * @param element - 包含 src 的媒体 h 元素
   * @returns 转换后的 h 元素，如果失败则返回一个提示文本
   */
  const mediaElementToBase64 = async (element: h): Promise<h> => {
    const fileName = element.attrs.src as string;
    try {
      const data = await fileManager.readFile(fileName);
      const mimeTypeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg' };
      const ext = path.extname(fileName).toLowerCase();
      const mimeType = mimeTypeMap[ext] || 'application/octet-stream';
      return h(element.type, { ...element.attrs, src: `data:${mimeType};base64,${data.toString('base64')}` });
    } catch (error) {
      logger.warn(`转换本地文件 ${fileName} 失败:`, error);
      // 优雅降级，避免消息发送失败
      return h('p', {}, `[${element.type}]`);
    }
  };

  /**
   * 下载网络媒体资源并保存到文件存储中。
   * @returns 文件名
   */
  const downloadMedia = async (url: string, originalName: string, type: string, caveId: number, index: number, channelId: string, userId: string): Promise<string> => {
    const ext = originalName ? path.extname(originalName) : '';
    const defaultExtMap = { 'img': '.jpg', 'image': '.jpg', 'video': '.mp4', 'audio': '.mp3', 'file': '.dat' };
    const finalExt = ext || defaultExtMap[type] || '.dat';
    // 生成一个结构化的、有意义的文件名
    const fileName = `${caveId}_${index}_${userId}_${channelId}${finalExt}`;
    const response = await ctx.http.get(url, { responseType: 'arraybuffer', timeout: 30000 });
    return fileManager.saveFile(fileName, Buffer.from(response));
  };

  /**
   * 构建一条用于发送的回声洞消息。
   * @param cave - 回声洞数据对象
   * @returns 可被 Koishi 直接发送的 h 元素数组
   */
  const buildCaveMessage = async (cave: CaveObject): Promise<(string | h)[]> => {
    const caveHElements = storedFormatToHElements(cave.elements);

    const processedElements = await Promise.all(caveHElements.map(element => {
      const fileName = element.attrs.src as string;
      const isMedia = ['image', 'video', 'audio', 'file'].includes(element.type);

      // 如果不是媒体或文件名为空，直接返回
      if (!isMedia || !fileName) return Promise.resolve(element);

      // 如果启用了 S3 公共 URL，直接构造可访问的 URL
      if (config.enableS3 && config.publicUrl) {
        const fullUrl = config.publicUrl.endsWith('/')
          ? `${config.publicUrl}${fileName}`
          : `${config.publicUrl}/${fileName}`;
        return Promise.resolve(h(element.type, { ...element.attrs, src: fullUrl }));
      }

      // 对于本地存储，将文件内容转为 Base64 发送
      return mediaElementToBase64(element);
    }));

    return [
      h('p', {}, `回声洞 ——（${cave.id}）`),
      ...processedElements,
      h('p', {}, `—— ${cave.userName}`),
    ];
  };

  /**
   * 检查用户是否处于冷却状态。
   * @param session - Koishi 会话对象
   * @returns 如果在冷却中，返回提示信息；否则返回 null
   */
  function checkCooldown(session: Session): string | null {
    // 管理员、无冷却配置或私聊时不受影响
    if (config.cooldown <= 0 || !session.channelId || config.adminUsers.includes(session.userId)) {
      return null;
    }
    const now = Date.now();
    const lastTime = lastUsed.get(session.channelId) || 0;
    if (now - lastTime < config.cooldown * 1000) {
      const waitTime = Math.ceil((config.cooldown * 1000 - (now - lastTime)) / 1000);
      return `指令冷却中，请在 ${waitTime} 秒后重试`;
    }
    return null;
  }

  /**
   * 更新用户的冷却时间戳。
   * @param session - Koishi 会话对象
   */
  function updateCooldownTimestamp(session: Session) {
    if (config.cooldown > 0 && session.channelId) {
      lastUsed.set(session.channelId, Date.now());
    }
  }

  // --- 指令定义 ---

  const cave = ctx.command('cave', '回声洞')
    .option('add', '-a <content:text> 添加回声洞')
    .option('view', '-g <id:posint> 查看指定回声洞')
    .option('delete', '-r <id:posint> 删除指定回声洞')
    .option('list', '-l 查询投稿统计')
    .usage('随机抽取一条已添加的回声洞。')
    .action(async ({ session, options }) => {
      // 快捷方式
      if (options.add) return session.execute(`cave.add ${options.add}`);
      if (options.view) return session.execute(`cave.view ${options.view}`);
      if (options.delete) return session.execute(`cave.del ${options.delete}`);
      if (options.list) return session.execute('cave.list');

      const cdMessage = checkCooldown(session);
      if (cdMessage) return cdMessage;

      try {
        const query = getScopeQuery(session);
        // 先只查询 id，提高效率
        const candidates = await ctx.database.get('cave', query, { fields: ['id'] });
        if (candidates.length === 0) return `当前${config.perChannel ? '本群' : ''}还没有回声洞`;

        const randomId = candidates[Math.floor(Math.random() * candidates.length)].id;
        const [randomCave] = await ctx.database.get('cave', { ...query, id: randomId });

        updateCooldownTimestamp(session);
        return buildCaveMessage(randomCave);
      } catch (error) {
        logger.error('随机获取回声洞失败:', error);
        return '随机获取回声洞失败';
      }
    });

  cave.subcommand('.add [content:text]', '添加回声洞')
    .usage('添加一条回声洞。可以直接发送内容，也可以回复或引用一条消息。')
    .action(async ({ session }, content) => {
      // 添加前触发一次清理，此操作是异步的，无需等待
      cleanupPendingDeletions();

      const savedFileIdentifiers: string[] = [];
      try {
        let sourceElements: h[];
        // 优先使用引用消息
        if (session.quote?.elements) {
          sourceElements = session.quote.elements;
        // 其次使用指令后的文本
        } else if (content?.trim()) {
          sourceElements = h.parse(content);
        // 最后提示用户发送
        } else {
          await session.send("请在一分钟内发送你要添加的回声洞内容");
          const reply = await session.prompt(60000); // 60秒超时
          if (!reply) return "操作超时，已取消添加";
          sourceElements = h.parse(reply);
        }

        const newId = await getNextCaveId(getScopeQuery(session));
        const finalElementsForDb: StoredElement[] = [];
        let mediaIndex = 0; // 用于为媒体文件生成唯一索引

        // 递归遍历并处理所有消息元素
        async function traverseAndProcess(elements: h[]) {
          for (const el of elements) {
            const elementType = (el.type === 'image' ? 'img' : el.type) as StoredElement['type'];

            // 处理媒体元素
            if (['img', 'video', 'audio', 'file'].includes(elementType) && el.attrs.src) {
              let fileIdentifier = el.attrs.src;
              // 如果是网络链接，则下载
              if (fileIdentifier.startsWith('http')) {
                mediaIndex++;
                const originalName = el.attrs.file as string; // 原始文件名
                const savedId = await downloadMedia(fileIdentifier, originalName, elementType, newId, mediaIndex, session.channelId, session.userId);
                savedFileIdentifiers.push(savedId);
                fileIdentifier = savedId;
              }
              finalElementsForDb.push({ type: elementType, file: fileIdentifier });
            // 处理文本元素
            } else if (elementType === 'text' && el.attrs.content?.trim()) {
              finalElementsForDb.push({ type: 'text', content: el.attrs.content.trim() });
            }

            // 递归处理子元素
            if (el.children) await traverseAndProcess(el.children);
          }
        }
        await traverseAndProcess(sourceElements);

        if (finalElementsForDb.length === 0) return "内容为空，已取消添加";

        // 获取用户昵称
        let userName = session.username;
        if (config.enableProfile) {
          const customName = await profileManager.getNickname(session.userId);
          if (customName) userName = customName;
        }

        // 创建数据库记录
        await ctx.database.create('cave', {
          id: newId,
          channelId: session.channelId || 'private',
          elements: finalElementsForDb,
          userId: session.userId,
          userName: userName,
          time: new Date(),
          status: 'active',
        });

        return `添加成功，序号为（${newId}）`;
      } catch (error) {
        logger.error('添加回声洞失败:', error);
        // 如果过程中发生错误，清理已保存的临时文件
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

      const cdMessage = checkCooldown(session);
      if (cdMessage) return cdMessage;

      try {
        const query = { ...getScopeQuery(session), id };
        const [cave] = await ctx.database.get('cave', query);
        if (!cave) return `回声洞（${id}）不存在`;

        updateCooldownTimestamp(session);
        return buildCaveMessage(cave);
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

        // 权限检查
        const isOwner = targetCave.userId === session.userId;
        const isAdmin = config.adminUsers.includes(session.userId);
        if (!isOwner && !isAdmin) {
          return '抱歉，你不能删除他人的回声洞';
        }

        // 软删除：仅更新状态为待删除，由后台任务进行清理
        await ctx.database.upsert('cave', [{ id: id, status: 'delete' }]);

        // 触发一次清理，无需等待
        cleanupPendingDeletions();

        return `已将回声洞（${id}）标记为删除，后台将自动清理`;
      } catch (error) {
        logger.error(`标记回声洞（${id}）失败:`, error);
        return '删除失败，请稍后再试';
      }
    });

  cave.subcommand('.list', '查询我的投稿')
    .usage('查询并列出你所有投稿的回声洞序号。')
    .action(async ({ session }) => {
      try {
        const query = { ...getScopeQuery(session), userId: session.userId, status: 'active' as const };
        const userCaves = await ctx.database.get('cave', query);
        if (userCaves.length === 0) return '你还没有投稿过回声洞';

        const caveIds = userCaves.map(c => c.id).sort((a, b) => a - b).join('|');
        return `你已投稿 ${userCaves.length} 条回声洞，序号为：\n${caveIds}`;
      } catch (error) {
        logger.error('查询投稿列表失败:', error);
        return '查询失败，请稍后再试';
      }
    });

  // --- 条件性注册的指令 ---

  if (config.enableProfile) {
    cave.subcommand('.profile [nickname:text]', '设置显示昵称')
      .usage('设置你在回声洞中显示的昵称。不提供昵称则清除记录。')
      .action(async ({ session }, nickname) => {
        const trimmedNickname = nickname?.trim();
        if (!trimmedNickname) {
          await profileManager.clearNickname(session.userId);
          return '昵称已清除';
        }
        await profileManager.setNickname(session.userId, trimmedNickname);
        return `昵称已更新为：${trimmedNickname}`;
      });
  }

  if (config.enableDataIO) {
    cave.subcommand('.export', '导出回声洞数据')
      .usage('将所有回声洞数据导出到 cave_export.json。')
      .action(async ({ session }) => {
        if (!config.adminUsers.includes(session.userId)) return '抱歉，你没有权限导出数据';
        try {
          await session.send('正在导出数据，请稍候...');
          const resultMessage = await dataManager.exportData();
          return resultMessage;
        } catch (error) {
          logger.error('导出数据时发生错误:', error);
          return `导出失败: ${error.message}`;
        }
      });

    cave.subcommand('.import', '导入回声洞数据')
      .usage('从 cave_import.json 中导入回声洞数据。')
      .action(async ({ session }) => {
        if (!config.adminUsers.includes(session.userId)) return '抱歉，你没有权限导入数据';
        try {
          await session.send('正在导入数据，请稍候...');
          const resultMessage = await dataManager.importData();
          return resultMessage;
        } catch (error) {
          logger.error('导入数据时发生错误:', error);
          return `导入失败: ${error.message}`;
        }
      });
  }
}
