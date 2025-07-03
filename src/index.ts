import { Context, Schema, Logger } from 'koishi'
import { Moderator, Item } from './modules/moderator'
import { DupChecker } from './modules/dupChecker'
import { IdGenerator } from './modules/idGenerator'
import { FileManager } from './modules/fileManager'
import { ContentManager } from './modules/contentManager'

export const name = 'test'
export const logger = new Logger('test')

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

export interface Config {
  dupEnabled: boolean
  dupThreshold: number
  modEnabled: boolean
  modAuto: boolean
}

export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    dupEnabled: Schema.boolean().default(true).description('是否启用查重功能'),
    dupThreshold: Schema.number().min(0).max(1).default(0.8).description('查重相似度阈值（0-1）')
  }),
  Schema.object({
    modEnabled: Schema.boolean().default(true).description('是否启用审核功能'),
    modAuto: Schema.boolean().default(false).description('是否自动通过审核')
  })
])

export function apply(ctx: Context, config: Config) {
  // 初始化各个模块
  const moderator = new Moderator(ctx, config)
  const dupChecker = new DupChecker(config)
  const idGenerator = new IdGenerator({
    prefix: 'EC',
    padding: 6
  })

  const fileManager = new FileManager(ctx)
  const contentManager = new ContentManager(ctx, moderator, dupChecker, idGenerator)

  // 内容存储
  const items: Map<string, Item> = new Map()

  // 加载数据
  async function loadData() {
    const data = await fileManager.load()
    if (data.items) {
      items.clear()
      for (const [id, item] of data.items) {
        items.set(id, item)
      }
    }
    if (data.counter) {
      idGenerator.set(data.counter)
    }
  }

  // 保存数据
  async function saveData() {
    const data = {
      items: Array.from(items.entries()),
      counter: idGenerator.count()
    }
    await fileManager.save(data)
  }

  // 初始化加载数据
  loadData()

  const cave = ctx.command('cave', '回声洞功能')

  cave.subcommand('.add <content:text>', '向回声洞添加内容')
    .action(async ({ session }, content) => {
      if (!content) {
        return '请提供要添加的内容'
      }

      const result = await contentManager.addContent(content, session.userId, items, saveData)
      return result.msg
    })

  cave.subcommand('.delete <id:string>', '删除指定ID的内容')
    .action(async ({ session }, id) => {
      if (!id) {
        return '请提供要删除的内容ID'
      }

      const result = await contentManager.deleteContent(id, session.userId, items, saveData)
      return result.msg
    })

  // 如果启用了审核功能，注册审核相关命令
  if (config.modEnabled) {
    moderator.registerCommands(ctx, items, saveData)
  }
}
