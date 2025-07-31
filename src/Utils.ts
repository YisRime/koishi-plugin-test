import { Context, h, Logger, Session } from 'koishi';
import * as path from 'path';
import { CaveObject, Config, StoredElement } from './index';
import { FileManager } from './FileManager';

/**
 * 将数据库存储的 StoredElement[] 格式转换为 Koishi 的 h[] 元素数组。
 */
export function storedFormatToHElements(elements: StoredElement[]): h[] {
  return elements.map(el => {
    switch (el.type) {
      case 'text': return h.text(el.content);
      case 'img': return h('image', { src: el.file });
      case 'video':
      case 'audio':
      case 'file': return h(el.type, { src: el.file });
      default: return null;
    }
  }).filter(Boolean);
}

/**
 * 将本地媒体文件元素转换为 Base64 格式，以便直接在消息中发送。
 */
export async function mediaElementToBase64(element: h, fileManager: FileManager, logger: Logger): Promise<h> {
  const fileName = element.attrs.src as string;
  try {
    const data = await fileManager.readFile(fileName);
    const mimeTypeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.mp4': 'video/mp4', '.mp3': 'audio/mpeg' };
    const ext = path.extname(fileName).toLowerCase();
    const mimeType = mimeTypeMap[ext] || 'application/octet-stream';
    return h(element.type, { ...element.attrs, src: `data:${mimeType};base64,${data.toString('base64')}` });
  } catch (error) {
    logger.warn(`转换本地文件 ${fileName} 失败:`, error);
    return h('p', {}, `[${element.type}]`);
  }
}

/**
 * 构建一条用于发送的回声洞消息。
 */
export async function buildCaveMessage(cave: CaveObject, config: Config, fileManager: FileManager, logger: Logger): Promise<(string | h)[]> {
  const caveHElements = storedFormatToHElements(cave.elements);

  const processedElements = await Promise.all(caveHElements.map(element => {
    const fileName = element.attrs.src as string;
    const isMedia = ['image', 'video', 'audio', 'file'].includes(element.type);

    if (!isMedia || !fileName) return Promise.resolve(element);

    if (config.enableS3 && config.publicUrl) {
      const fullUrl = config.publicUrl.endsWith('/')
        ? `${config.publicUrl}${fileName}`
        : `${config.publicUrl}/${fileName}`;
      return Promise.resolve(h(element.type, { ...element.attrs, src: fullUrl }));
    }

    return mediaElementToBase64(element, fileManager, logger);
  }));

  return [
    h('p', {}, `回声洞 ——（${cave.id}）`),
    ...processedElements,
    h('p', {}, `—— ${cave.userName}`),
  ];
}

/**
 * 清理被标记为 'delete' 的回声洞。
 */
export async function cleanupPendingDeletions(ctx: Context, fileManager: FileManager, logger: Logger): Promise<void> {
  try {
    const cavesToDelete = await ctx.database.get('cave', { status: 'delete' });
    if (cavesToDelete.length === 0) return;

    for (const cave of cavesToDelete) {
      const deletePromises = cave.elements
        .filter(el => el.file)
        .map(el => fileManager.deleteFile(el.file));
      await Promise.all(deletePromises);
      await ctx.database.remove('cave', { id: cave.id });
    }
  } catch (error) {
    logger.error('清理回声洞失败:', error);
  }
}

/**
 * 根据插件配置和当前会话，生成数据库查询所需的范围。
 */
export function getScopeQuery(session: Session, config: Config): object {
  const baseQuery = { status: 'active' };
  if (config.perChannel && session.channelId) {
    return { ...baseQuery, channelId: session.channelId };
  }
  return baseQuery;
}

/**
 * 获取下一个可用的回声洞 ID。
 */
export async function getNextCaveId(ctx: Context, query: object = {}): Promise<number> {
  const allCaves = await ctx.database.get('cave', query, { fields: ['id'] });
  const existingIds = new Set(allCaves.map(c => c.id));
  let newId = 1;
  while (existingIds.has(newId)) {
    newId++;
  }
  return newId;
}

/**
 * 下载网络媒体资源并保存到文件存储中。
 */
export async function downloadMedia(ctx: Context, fileManager: FileManager, url: string, originalName: string, type: string, caveId: number, index: number, channelId: string, userId: string): Promise<string> {
  const ext = originalName ? path.extname(originalName) : '';
  const defaultExtMap = { 'img': '.jpg', 'image': '.jpg', 'video': '.mp4', 'audio': '.mp3', 'file': '.dat' };
  const finalExt = ext || defaultExtMap[type] || '.dat';
  const fileName = `${caveId}_${index}_${userId}_${channelId}${finalExt}`;
  const response = await ctx.http.get(url, { responseType: 'arraybuffer', timeout: 30000 });
  return fileManager.saveFile(fileName, Buffer.from(response));
}

/**
 * 检查用户是否处于冷却状态。
 */
export function checkCooldown(session: Session, config: Config, lastUsed: Map<string, number>): string | null {
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
 */
export function updateCooldownTimestamp(session: Session, config: Config, lastUsed: Map<string, number>) {
  if (config.cooldown > 0 && session.channelId) {
    lastUsed.set(session.channelId, Date.now());
  }
}
