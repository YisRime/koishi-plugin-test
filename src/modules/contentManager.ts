import { Context } from 'koishi'
import { Moderator, Item } from './moderator'
import { DupChecker } from './dupChecker'
import { IdGenerator } from './idGenerator'

export interface ContentResult {
  ok: boolean
  id?: string
  msg: string
}

export class ContentManager {
  constructor(
    private ctx: Context,
    private moderator: Moderator,
    private dupChecker: DupChecker,
    private idGenerator: IdGenerator
  ) {}

  async addContent(
    content: string,
    author: string,
    items: Map<string, Item>,
    saveData: () => Promise<void>
  ): Promise<ContentResult> {
    // 检查重复
    const dupCheck = await this.dupChecker.check(content, items)
    if (dupCheck.isDup) {
      return {
        ok: false,
        msg: `内容重复度过高（${Math.round(dupCheck.score * 100)}%），与 ${dupCheck.existId} 相似`
      }
    }

    // 审核检查
    const modResult = await this.moderator.check(content)
    const id = this.idGenerator.gen()

    const item: Item = {
      id,
      content,
      author,
      time: Date.now(),
      status: modResult.ok ? 'approved' : 'pending',
      score: dupCheck.score
    }

    if (modResult.ok) {
      // 自动通过审核
      items.set(id, item)
      await saveData()
      return { ok: true, id, msg: `内容已添加到回声洞，ID: ${id}` }
    } else {
      // 需要审核
      await this.moderator.submitForReview(item)
      return { ok: true, id, msg: `内容已提交审核，ID: ${id}。${modResult.reason || ''}` }
    }
  }

  async deleteContent(
    id: string,
    author: string,
    items: Map<string, Item>,
    saveData: () => Promise<void>,
    isAdmin: boolean = false
  ): Promise<ContentResult> {
    const item = items.get(id)
    if (!item) {
      return { ok: false, msg: '未找到指定ID的内容' }
    }

    if (item.status !== 'approved') {
      return { ok: false, msg: '该内容尚未通过审核，无法删除' }
    }

    // 权限检查：只有内容作者或管理员可以删除
    if (!isAdmin && item.author !== author) {
      return { ok: false, msg: '只能删除自己的内容' }
    }

    items.delete(id)
    await saveData()
    return { ok: true, msg: `内容 ${id} 已删除` }
  }
}
