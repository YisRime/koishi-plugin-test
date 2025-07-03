import { Context } from 'koishi'
import { FileManager } from './fileManager'

export interface ModResult {
  ok: boolean
  reason?: string
}

export interface ModConfig {
  modEnabled: boolean
  modAuto: boolean
}

export interface Item {
  id: string
  content: string
  author: string
  time: number
  status: 'pending' | 'approved' | 'rejected'
  score?: number
}

export class Moderator {
  private words: string[]
  private pendingItems: Map<string, Item> = new Map()
  private file: FileManager

  constructor(private ctx: Context, private config: ModConfig) {
    this.words = [
      '广告', '色情', '赌博', '暴力', '政治'
    ]
    this.file = new FileManager(ctx, { name: 'pending_items.json' })
    this.loadPending()
  }

  async check(text: string): Promise<ModResult> {
    if (!this.config.modEnabled) {
      return { ok: true }
    }

    const lower = text.toLowerCase()
    for (const word of this.words) {
      if (lower.includes(word)) {
        return { ok: false, reason: `包含禁词: ${word}` }
      }
    }
    return { ok: this.config.modAuto }
  }

  async submitForReview(item: Item): Promise<void> {
    this.pendingItems.set(item.id, item)
    await this.savePending()
  }

  approve(id: string): boolean {
    const item = this.pendingItems.get(id)
    if (item && item.status === 'pending') {
      item.status = 'approved'
      this.pendingItems.delete(id)
      this.savePending()
      return true
    }
    return false
  }

  reject(id: string): boolean {
    const item = this.pendingItems.get(id)
    if (item && item.status === 'pending') {
      item.status = 'rejected'
      this.pendingItems.delete(id)
      this.savePending()
      return true
    }
    return false
  }

  getPendingItems(): Item[] {
    return Array.from(this.pendingItems.values())
  }

  getPendingItem(id: string): Item | undefined {
    return this.pendingItems.get(id)
  }

  private async savePending(): Promise<void> {
    const data = {
      items: Array.from(this.pendingItems.entries())
    }
    await this.file.save(data)
  }

  private async loadPending(): Promise<void> {
    const data = await this.file.load()
    if (data.items) {
      this.pendingItems = new Map(data.items)
    }
  }

  add(word: string): void {
    if (!this.words.includes(word)) {
      this.words.push(word)
    }
  }

  remove(word: string): void {
    const index = this.words.indexOf(word)
    if (index > -1) {
      this.words.splice(index, 1)
    }
  }

  list(): string[] {
    return [...this.words]
  }

  registerCommands(ctx: Context, items: Map<string, Item>, saveData: () => Promise<void>): void {
    const cave = ctx.command('cave')

    cave.subcommand('.list', '查看回声洞内容列表')
      .action(async () => {
        const approvedItems = Array.from(items.values()).filter(item => item.status === 'approved')
        if (approvedItems.length === 0) {
          return '回声洞中暂无内容'
        }

        const list = approvedItems
          .sort((a, b) => b.time - a.time)
          .slice(0, 10)
          .map(item => `${item.id}: ${item.content.slice(0, 50)}${item.content.length > 50 ? '...' : ''}`)
          .join('\n')

        return `回声洞最新内容：\n${list}`
      })

    cave.subcommand('.get <id:string>', '获取指定ID的内容')
      .action(async (_, id) => {
        if (!id) {
          return '请提供内容ID'
        }

        const item = items.get(id)
        if (!item) {
          return '未找到指定ID的内容'
        }

        if (item.status !== 'approved') {
          return '该内容尚未通过审核'
        }

        return `${item.id}: ${item.content}\n时间: ${new Date(item.time).toLocaleString()}`
      })

    cave.subcommand('.approve <id:string>', '通过审核指定内容', { authority: 3 })
      .action(async (_, id) => {
        if (!id) {
          return '请提供内容ID'
        }

        const pendingItem = this.getPendingItem(id)
        if (!pendingItem) {
          return '未找到待审核的内容'
        }

        const success = this.approve(id)
        if (success) {
          pendingItem.status = 'approved'
          items.set(id, pendingItem)
          await saveData()
          return `内容 ${id} 已通过审核`
        }

        return '操作失败，请检查ID是否正确或内容状态'
      })

    cave.subcommand('.reject <id:string>', '拒绝审核指定内容', { authority: 3 })
      .action(async (_, id) => {
        if (!id) {
          return '请提供内容ID'
        }

        const success = this.reject(id)
        return success ? `内容 ${id} 已被拒绝` : '操作失败，请检查ID是否正确或内容状态'
      })

    cave.subcommand('.pending', '查看待审核内容列表', { authority: 3 })
      .action(async () => {
        const pendingItems = this.getPendingItems()
        if (pendingItems.length === 0) {
          return '暂无待审核内容'
        }

        const list = pendingItems
          .sort((a, b) => b.time - a.time)
          .map(item => `${item.id}: ${item.content.slice(0, 50)}${item.content.length > 50 ? '...' : ''}`)
          .join('\n')

        return `待审核内容：\n${list}`
      })
  }
}
