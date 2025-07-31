import { Context, Schema, Logger, h, Session } from 'koishi'
import * as path from 'path'
import { FileManager } from './FileManager'
import { ProfileManager } from './ProfileManager'
import { DataManager } from './DataManager'

export const name = 'best-cave'
export const inject = ['database']

// 插件的介绍和使用说明
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

/** 存储在数据库中的自定义 Element 格式 */
export interface StoredElement {
  type: 'text' | 'img' | 'video' | 'audio' | 'file';
  content?: string; // 用于 'text' 类型
  file?: string;    // 用于媒体类型，现在统一存储文件名
}

export interface CaveObject {
  id: number
  elements: StoredElement[]
  channelId: string
  userId: string
  userName: string
  time: Date
}

declare module 'koishi' {
  interface Tables {
    best_cave: CaveObject
  }
}

// --- 插件配置项 ---
export interface Config {
  cooldown: number;
  perChannel: boolean;
  adminUsers: string[];
  enableProfile: boolean;
  enableDataIO: boolean;
  enableS3: boolean; // 是否启用S3
  s3?: {             // S3具体配置
    endpoint: string;
    region?: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    publicUrl?: string; // 可选的公共访问URL前缀
  };
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    cooldown: Schema.number().default(10).description("冷却时间（秒）"),
    perChannel: Schema.boolean().default(false).description("分群模式"),
    enableProfile: Schema.boolean().default(false).description("启用自定义昵称"),
    enableDataIO: Schema.boolean().default(false).description("启用导入导出"),
    enableS3: Schema.boolean().default(false).description('启用 S3 存储'),
    adminUsers: Schema.array(Schema.string()).default([]).description("管理员 ID"),
  }),
  Schema.union([
    Schema.object({
      enableS3: Schema.const(true).required(),
      s3: Schema.object({
        endpoint: Schema.string().required().description('端点').role('link'),
        region: Schema.string().description('区域'),
        bucket: Schema.string().required().description('名称'),
        accessKeyId: Schema.string().required().description('Access Key ID').role('secret'),
        secretAccessKey: Schema.string().required().description(' Access Key Secret').role('secret'),
        publicUrl: Schema.string().description('公共 URL（可选）').role('link'),
      }).description('S3 配置'),
    })
  ]),
]);

// --- 插件主逻辑 ---
export function apply(ctx: Context, config: Config) {
  ctx.model.extend('best_cave', {
    id: 'unsigned',
    channelId: 'string',
    elements: 'json',
    userId: 'string',
    userName: 'string',
    time: 'timestamp',
  }, {
    primary: 'id',
  })

  const fileManager = new FileManager(ctx.baseDir, logger, config)
  const lastUsed = new Map<string, number>()

  let profileManager: ProfileManager;
  if (config.enableProfile) {
    profileManager = new ProfileManager(ctx);
  }

  let dataIOManager: DataManager;
  if (config.enableDataIO) {
    dataIOManager = new DataManager(ctx, fileManager, logger, () => getNextCaveId({}));
  }

  /** 将自定义的对象数组转换回 h 元素数组 */
  const storedFormatToHElements = (elements: StoredElement[]): h[] => {
    return elements.map(el => {
      if (el.type === 'text') {
        return h.text(el.content);
      }
      // 对于媒体类型，直接使用 file 字段作为 src
      if (el.type === 'img') {
        return h('image', { src: el.file });
      }
      if (['video', 'audio', 'file'].includes(el.type)) {
        return h(el.type, { src: el.file });
      }
      return null;
    }).filter(Boolean); // 过滤掉无效元素
  };

  /** 获取当前会话的作用域查询对象 */
  const getScopeQuery = (session: Session): object => {
    if (config.perChannel && session.channelId) {
      return { channelId: session.channelId };
    }
    return {};
  };


  /** 获取下一个可用的回声洞 ID */
  async function getNextCaveId(query: object = {}): Promise<number> {
    const allCaves = await ctx.database.get('best_cave', query, { fields: ['id'] });
    const existingIds = allCaves.map(c => c.id).sort((a, b) => a - b);
    let newId = 1;
    for (const id of existingIds) {
      if (id === newId) newId++;
      else break;
    }
    return newId;
  }

  /**
   * 将本地媒体文件转换为 Base64 编码的 h 元素 (仅在本地存储模式下使用)
   */
  const localMediaElementToBase64 = async (element: h): Promise<h> => {
    const localFile = element.attrs.src;
    try {
      const data = await fileManager.readFile(localFile);
      const mimeTypeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg' };
      const ext = path.extname(localFile).toLowerCase();
      const mimeType = mimeTypeMap[ext] || 'application/octet-stream';
      return h(element.type, { ...element.attrs, src: `data:${mimeType};base64,${data.toString('base64')}` });
    } catch (error) {
      logger.error(`无法加载本地媒体 ${localFile}:`, error);
      return h('p', {}, `[无法加载媒体: ${element.type}]`);
    }
  };

  /**
   * 从 URL 下载媒体文件并通过 FileManager 保存（本地或S3）。
   * @returns 保存后的文件标识符 (本地文件名或 S3 Key)
   */
  const downloadMedia = async (url: string, originalName: string, type: string, caveId: number, index: number, channelId: string, userId: string): Promise<string> => {
    // 优先从 originalName 中获取扩展名
    const ext = originalName ? path.extname(originalName) : '';

    // 如果没有，则根据类型使用默认扩展名
    const defaultExtMap = { 'img': '.jpg', 'image': '.jpg', 'video': '.mp4', 'audio': '.mp3', 'file': '.dat' };
    const finalExt = ext || defaultExtMap[type] || '.dat';

    // 生成一个唯一的文件名，这将作为本地文件名或 S3 的 Key
    const fileName = `${caveId}_${channelId}_${userId}_${index}${finalExt}`;
    const response = await ctx.http.get(url, { responseType: 'arraybuffer', timeout: 30000 });
    // 调用 fileManager 保存文件，它会根据配置自动处理存储并返回文件名
    return fileManager.saveFile(fileName, Buffer.from(response));
  };

  /** 构建回声洞消息，根据配置动态生成媒体 SRC */
  const buildCaveMessage = async (cave: CaveObject): Promise<h[]> => {
    const caveHElements = storedFormatToHElements(cave.elements);

    const processedElements = await Promise.all(caveHElements.map(element => {
      // 从数据库中读取的 src 现在统一为文件名
      const fileName = element.attrs.src;
      const elementType = element.type;
      const isMedia = ['image', 'img', 'video', 'audio', 'file'].includes(elementType);

      // 如果不是媒体元素或没有文件名，直接返回
      if (!isMedia || !fileName) {
        return Promise.resolve(element);
      }

      // 根据当前配置动态决定如何处理文件名
      if (config.enableS3 && config.s3) {
        // S3 模式：拼接完整的公共 URL
        const publicUrl = config.s3.publicUrl || `https://${config.s3.endpoint}`;
        const fullUrl = `${publicUrl}/${config.s3.bucket}/${fileName}`;
        // 返回一个新的 h 元素，更新其 src 属性为完整的 URL
        return Promise.resolve(h(elementType, { ...element.attrs, src: fullUrl }));
      } else {
        // 本地模式：读取文件并转换为 Base64
        return localMediaElementToBase64(element);
      }
    }));

    // 使用 <p> 标签确保页眉和页脚独立成行，内容部分则自然排列
    return [
      h('p', {}, `回声洞 —— （${cave.id}）`),
      ...processedElements,
      h('p', {}, `—— ${cave.userName}`),
    ];
  };

  /**
   * 检查命令是否在冷却中。
   * @param session 当前会话
   * @returns 如果在冷却中，返回提示信息字符串；否则返回 null。
   */
  function checkCooldown(session: Session): string | null {
    // 管理员无视冷却
    if (config.adminUsers.includes(session.userId)) return null;
    if (config.cooldown <= 0) return null;
    if (!session.channelId) return null;

    const now = Date.now();
    const lastTime = lastUsed.get(session.channelId) || 0;
    if (now - lastTime < config.cooldown * 1000) {
      const waitTime = Math.ceil((config.cooldown * 1000 - (now - lastTime)) / 1000);
      return `冷却中，请在 ${waitTime} 秒后重试`;
    }
    return null;
  }

  /**
   * 更新当前频道的冷却时间戳。
   * @param session 当前会话
   */
  function updateCooldownTimestamp(session: Session) {
    if (config.cooldown > 0 && session.channelId) {
      lastUsed.set(session.channelId, Date.now());
    }
  }

  const cave = ctx.command('cave', '回声洞')
    .option('add', '-a <content:text> 添加回声洞')
    .option('view', '-g <id:posint> 查看指定回声洞')
    .option('delete', '-r <id:posint> 删除指定回声洞')
    .option('list', '-l 查询投稿统计')
    .usage('随机抽取一条已添加的回声洞。')
    .action(async ({ session, options }) => {
      // 检查是否有选项被触发，并执行对应的子命令
      if (options.add) {
        return session.execute(`cave.add ${options.add}`);
      }
      if (options.view) {
        return session.execute(`cave.view ${options.view}`);
      }
      if (options.delete) {
        return session.execute(`cave.del ${options.delete}`);
      }
      if (options.list) {
        return session.execute('cave.list');
      }

      // --- 如果没有触发任何选项，则执行默认的随机抽取功能 ---
      const cdMessage = checkCooldown(session);
      if (cdMessage) return cdMessage;

      try {
        const query = getScopeQuery(session);
        const candidates = await ctx.database.get('best_cave', query, { fields: ['id'] });
        if (candidates.length === 0) return `当前无回声洞`;

        const randomId = candidates[Math.floor(Math.random() * candidates.length)].id;
        const [randomCave] = await ctx.database.get('best_cave', { ...query, id: randomId });

        updateCooldownTimestamp(session);
        return await buildCaveMessage(randomCave);
      } catch (error) {
        logger.error('获取回声洞失败:', error);
        return '获取回声洞失败';
      }
    });

  cave.subcommand('.add [content:text]', '添加回声洞')
    .usage('添加一条回声洞，可通过回复及引用消息添加。')
    .action(async ({ session }, content) => {
      const savedFileIdentifiers: string[] = [];
      try {
        let sourceElements: h[];
        if (session.quote?.elements) {
          sourceElements = session.quote.elements;
        } else if (content?.trim()) {
          sourceElements = h.parse(content);
        } else {
          await session.send("请在一分钟内发送内容");
          const replyContent = await session.prompt(60000);
          if (!replyContent) return "已取消添加";
          sourceElements = h.parse(replyContent);
        }

        const newId = await getNextCaveId();
        const finalElementsForDb: StoredElement[] = [];
        let mediaIndex = 1; // 用于为下载的媒体生成唯一文件名

        // 定义一个递归函数来处理 h 元素、下载媒体并构建最终要存储的数组
        async function traverseAndProcess(els: h[]) {
          for (const el of els) {
            let finalElement: StoredElement = null;
            const elementType = (el.type === 'image' ? 'img' : el.type) as StoredElement['type'];

            if (['img', 'video', 'audio', 'file'].includes(elementType)) {
              let fileIdentifier = el.attrs.src;
              // 如果是网络 URL，则下载它
              if (fileIdentifier && fileIdentifier.startsWith('http')) {
                // 在此处使用 originalName 获取扩展名，然后丢弃
                const originalName = el.attrs.file;
                const savedId = await downloadMedia(fileIdentifier, originalName, elementType, newId, mediaIndex, session.channelId, session.userId);
                savedFileIdentifiers.push(savedId); // 记录以便失败时回滚
                fileIdentifier = savedId;
                mediaIndex++;
              }
              // 这里的 fileIdentifier 已经是文件名了
              finalElement = { type: elementType, file: fileIdentifier };

            } else if (elementType === 'text') {
              const content = el.attrs.content?.trim();
              if (content) { // 过滤掉空文本和纯空白文本
                finalElement = { type: 'text', content };
              }
            }

            if (finalElement) {
              finalElementsForDb.push(finalElement);
            }

            // 递归遍历子元素
            if (el.children) {
              await traverseAndProcess(el.children);
            }
          }
        }

        await traverseAndProcess(sourceElements);

        // 在处理后，检查是否真的有内容要保存
        if (finalElementsForDb.length === 0) return "已取消添加";

        let userName = session.username;
        if (config.enableProfile) {
          const customName = await profileManager.getNickname(session.userId);
          if (customName) userName = customName;
        }

        await ctx.database.create('best_cave', {
          id: newId,
          channelId: session.channelId,
          elements: finalElementsForDb,
          userId: session.userId,
          userName: userName,
          time: new Date(),
        });

        return `添加成功，序号为（${newId}）`;
      } catch (error) {
        logger.error('添加回声洞失败:', error);
        // 如果添加过程中出错，尝试删除已上传的文件
        if (savedFileIdentifiers.length > 0) {
          await Promise.all(savedFileIdentifiers.map(file => fileManager.deleteFile(file)));
        }
        return '添加回声洞失败';
      }
    });

  cave.subcommand('.view <id:posint>', '查看指定回声洞')
    .usage('输入序号查看对应回声洞。')
    .action(async ({ session }, id) => {
      const cdMessage = checkCooldown(session);
      if (cdMessage) return cdMessage;

      if (!id) return '请输入序号';
      try {
        const query = getScopeQuery(session);
        query['id'] = id;
        const [cave] = await ctx.database.get('best_cave', query);
        if (!cave) return `回声洞（${id}）不存在`;

        updateCooldownTimestamp(session);
        return await buildCaveMessage(cave);
      } catch (error) {
        logger.error(`查看回声洞（${id}）失败:`, error);
        return '查看回声洞失败';
      }
    });

  cave.subcommand('.del <id:posint>', '删除指定回声洞')
    .usage('输入序号删除对应回声洞。')
    .action(async ({ session }, id) => {
      if (!id) return '请输入序号';
      try {
        const [targetCave] = await ctx.database.get('best_cave', { id });
        if (!targetCave) return `回声洞（${id}）不存在`;

        const isOwner = targetCave.userId === session.userId;
        const isAdmin = config.adminUsers.includes(session.userId);
        // 只有所有者或管理员才能删除
        if (!isOwner && !isAdmin) {
          return '只能删除自己的回声洞';
        }

        // 删除关联的媒体文件（本地或S3）
        const deletePromises = targetCave.elements
          .filter(el => el.file) // 筛选出所有包含文件的元素
          .map(el => fileManager.deleteFile(el.file)); // el.file 现在是文件名
        await Promise.all(deletePromises);

        // 从数据库中移除记录
        await ctx.database.remove('best_cave', { id });

        // 获取被删除内容用于展示
        const caveContent = await buildCaveMessage(targetCave);
        const responseMessage = [
          h('p', {}, `已删除回声洞 —— （${id}）`),
          ...caveContent,
        ];

        return responseMessage;
      } catch (error) {
        logger.error(`删除回声洞（${id}）失败:`, error);
        return '删除回声洞失败';
      }
    });

  cave.subcommand('.list', '查询投稿统计')
    .usage('查询你所投稿的回声洞。')
    .action(async ({ session }) => {
      try {
        const query = getScopeQuery(session);
        query['userId'] = session.userId;
        const userCaves = await ctx.database.get('best_cave', query);
        if (userCaves.length === 0) return `您还没有投稿过回声洞`;
        const caveIds = userCaves.map(c => c.id).sort((a, b) => a - b).join('|');
        return `总计投稿回声洞 ${userCaves.length} 项：\n${caveIds}`;
      } catch (error) {
        logger.error('查询投稿失败:', error);
        return '查询投稿失败';
      }
    });

  if (config.enableProfile) {
    cave.subcommand('.profile [nickname:text]', '设置显示昵称')
      .usage('设置或清除你的昵称，不提供则清除当前昵称。')
      .action(async ({ session }, nickname) => {
        const trimmedNickname = nickname?.trim();
        if (!trimmedNickname) {
          // 如果没有提供昵称，则清除它
          await profileManager.clearNickname(session.userId);
          return '昵称已清除';
        }
        // 如果提供了昵称，则设置/更新它
        await profileManager.setNickname(session.userId, trimmedNickname);
        return `昵称已更新：${trimmedNickname}`;
      });
  }

  // --- 导入/导出命令 ---
  if (config.enableDataIO) {
    cave.subcommand('.export', '导出回声洞数据')
      .usage('将所有回声洞数据导出到 cave_export.json 中。')
      .action(async ({ session }) => {
        if (!config.adminUsers.includes(session.userId)) return;

        try {
          await session.send('正在导出数据...');
          await dataIOManager.exportData();
          return '导出数据成功';
        } catch (error) {
          logger.error('导出数据失败:', error);
          return '导出数据失败';
        }
      });

    cave.subcommand('.import', '导入回声洞数据')
      .usage('从 cave_import.json 中导入回声洞数据。')
      .action(async ({ session }) => {
        if (!config.adminUsers.includes(session.userId)) return;

        try {
          await session.send(`正在导入数据...`);
          await dataIOManager.importData();
          return '导入数据成功';
        } catch (error) {
          logger.error('导入数据失败:', error);
          return '导入数据失败';
        }
      });
  }
}
