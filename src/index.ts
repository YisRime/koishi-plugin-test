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
  file?: string;    // 用于媒体类型
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
}
export const Config: Schema<Config> = Schema.object({
  cooldown: Schema.number().default(60).description("冷却时间（秒）"),
  perChannel: Schema.boolean().default(false).description("分群模式"),
  enableProfile: Schema.boolean().default(false).description("启用自定义昵称"),
  enableDataIO: Schema.boolean().default(false).description("启用导入导出"),
  adminUsers: Schema.array(Schema.string()).default([]).description("管理员 ID").role('table')
})

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

  const fileManager = new FileManager(ctx.baseDir, logger)
  const lastUsed = new Map<string, number>()

  let profileManager: ProfileManager;
  if (config.enableProfile) {
    profileManager = new ProfileManager(ctx);
  }

  let dataIOManager: DataManager;
  if (config.enableDataIO) {
    dataIOManager = new DataManager(ctx, fileManager, logger, () => getNextCaveId({}));
  }

  /** 将 h 元素数组递归转换为自定义的可序列化对象数组 */
  const elementsToStoredFormat = (elements: h[]): StoredElement[] => {
    const results: StoredElement[] = [];

    function traverse(els: h[]) {
      for (const el of els) {
        const mediaSrc = el.attrs.src || el.attrs.file;
        if (el.type === 'img' || el.type === 'image') {
          results.push({ type: 'img', file: mediaSrc });
        } else if (['video', 'audio', 'file'].includes(el.type)) {
          results.push({ type: el.type as any, file: mediaSrc });
        } else if (el.type === 'text') {
          const content = el.attrs.content?.trim();
          if (content) { // 过滤掉空文本和纯空白文本
            results.push({ type: 'text', content });
          }
        }
        // 递归遍历子元素
        if (el.children) {
          traverse(el.children);
        }
      }
    }
    traverse(elements);
    return results;
  };

  /** 将自定义的对象数组转换回 h 元素数组 */
  const storedFormatToHElements = (elements: StoredElement[]): h[] => {
    return elements.map(el => {
      if (el.type === 'text') {
        return h.text(el.content);
      }
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

  /** 将本地媒体文件转换为 Base64 编码的 h 元素 */
  const localMediaElementToBase64 = async (element: h): Promise<h> => {
    const localFile = element.attrs.src;
    try {
      const data = await fileManager.readFile(localFile);
      const mimeTypeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg' };
      const ext = path.extname(localFile).toLowerCase();
      const mimeType = mimeTypeMap[ext] || 'application/octet-stream';
      return h(element.type, { ...element.attrs, src: `data:${mimeType};base64,${data.toString('base64')}` });
    } catch (error) {
      logger.error(`无法加载媒体 ${localFile}:`, error);
      return h('p', {}, `[无法加载媒体: ${element.type}]`);
    }
  };

  /** 从 URL 下载媒体文件并保存到本地 */
  const downloadMedia = async (url: string, caveId: number, index: number, channelId: string, userId: string): Promise<string> => {
    const defaultExtMap = { image: '.png', video: '.mp4', audio: '.mp3', file: '.dat' };
    const urlPath = new URL(url).pathname;
    const ext = path.extname(urlPath);
    const type = Object.keys(defaultExtMap).find(t => urlPath.includes(t)) || 'file';
    const finalExt = ext || defaultExtMap[type];
    const fileName = `${caveId}_${channelId}_${userId}_${index}${finalExt}`;
    const response = await ctx.http.get(url, { responseType: 'arraybuffer', timeout: 30000 });
    await fileManager.saveFile(fileName, Buffer.from(response));
    return fileName;
  };

  /** 构建回声洞消息，优化排版并并行处理媒体文件 */
  const buildCaveMessage = async (cave: CaveObject): Promise<h[]> => {
    const mediaTypes = ['image', 'video', 'audio'];
    const caveHElements = storedFormatToHElements(cave.elements);

    // 使用 Promise.all 并行处理所有需要转换的媒体文件
    const processedElements = await Promise.all(caveHElements.map(element => {
      const isLocalMedia = mediaTypes.includes(element.type) && element.attrs.src &&
                           !element.attrs.src.startsWith('http') && !element.attrs.src.startsWith('data:');
      if (isLocalMedia) {
        return localMediaElementToBase64(element);
      }
      return Promise.resolve(element);
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
    .usage('随机抽取一条已添加的回声洞。')
    .action(async ({ session }) => {
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
      const downloadedFiles: string[] = [];
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

        const storedElements = elementsToStoredFormat(sourceElements);
        if (storedElements.length === 0) return "已取消添加";

        const newId = await getNextCaveId();

        await Promise.all(storedElements.map(async (element, index) => {
          if (element.file && element.file.startsWith('http')) {
            const localFileName = await downloadMedia(element.file, newId, index, session.channelId, session.userId);
            downloadedFiles.push(localFileName);
            element.file = localFileName;
          }
        }));

        let userName = session.username;
        if (config.enableProfile) {
            const customName = await profileManager.getNickname(session.userId);
            if (customName) userName = customName;
        }

        await ctx.database.create('best_cave', {
          id: newId,
          channelId: session.channelId,
          elements: storedElements,
          userId: session.userId,
          userName: userName,
          time: new Date(),
        });

        return `添加成功，序号为（${newId}）`;
      } catch (error) {
        logger.error('添加回声洞失败:', error);
        if (downloadedFiles.length > 0) {
          await Promise.all(downloadedFiles.map(file => fileManager.deleteFile(file)));
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
        if (!isOwner && !isAdmin) {
          return '只能删除自己的回声洞';
        }

        const caveContent = await buildCaveMessage(targetCave);

        const deletePromises = targetCave.elements
          .filter(el => el.file && !el.file.startsWith('http'))
          .map(el => fileManager.deleteFile(el.file));
        await Promise.all(deletePromises);

        await ctx.database.remove('best_cave', { id });

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
