import { Context, Schema, Session } from 'koishi'
import { MessageSender } from './send'
import { ProtobufEncoder } from './protobuf'
import {} from 'koishi-plugin-adapter-onebot'

export const name = 'onebot-button'

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

export interface Config {}
export const Config: Schema<Config> = Schema.object({});

/**
 * JSON替换器，处理特殊类型数据
 * @param key - 对象键名
 * @param value - 对象值
 * @returns 处理后的值
 */
function jsonReplacer(key: string, value: any): any {
  if (typeof value === 'bigint') {
    return Number(value) >= Number.MAX_SAFE_INTEGER ? value.toString() : Number(value)
  } else if (Buffer.isBuffer(value)) {
    return `hex->${value.toString('hex')}`
  } else if (value?.type === 'Buffer' && Array.isArray(value.data)) {
    return `hex->${Buffer.from(value.data).toString('hex')}`
  }
  return value
}

/**
 * 获取消息数据
 * @param session - 会话对象
 * @param messageId - 消息ID或序列号
 * @param encoder - Protobuf编码器
 * @param isSeq - 是否为序列号模式
 * @returns 消息数据或null
 */
async function getMessage(session: Session, messageId: string, encoder: ProtobufEncoder, isSeq: boolean = false): Promise<any> {
  let seq: number
  if (isSeq) {
    seq = parseInt(messageId)
  } else {
    const msgInfo = await session.onebot._request('get_msg', { message_id: messageId })
    const seqValue = msgInfo?.data?.real_seq || msgInfo?.data?.seq
    if (!seqValue) throw new Error('无法获取 Seq')
    seq = typeof seqValue === 'string' ? parseInt(seqValue) : seqValue
  }
  const isGroup = !!session.guildId
  const packet = {
    "1": {
      "1": parseInt(isGroup ? session.guildId : session.userId || '0'),
      "2": seq,
      "3": seq
    },
    "2": true
  }
  const cmd = isGroup
    ? 'trpc.msg.register_proxy.RegisterProxy.SsoGetGroupMsg'
    : 'trpc.msg.register_proxy.RegisterProxy.SsoGetC2CMsg'
  const encodedData = encoder.encode(packet)
  const hexString = Buffer.from(encodedData).toString('hex')
  const resp = await session.onebot._request('send_packet', { cmd, data: hexString })
  return resp?.data ? encoder.decode(resp.data) : null
}

/**
 * 插件主入口函数
 * @param ctx - Koishi上下文对象
 */
export function apply(ctx: Context) {
  const encoder = new ProtobufEncoder()
  const messageSender = new MessageSender(encoder)

  const packet = ctx.command('packet', '发送数据包', { authority: 2 })

  const pb = packet.subcommand('pb <elements:text>', '发送 PB 元素')
    .usage('发送 pb(elem) 数据')
    .action(async ({ session }, elements) => {
      if (session.bot.platform !== 'onebot') return;
      if (!elements?.trim()) return '请提供数据'
      const result = JSON.parse(elements)
      if (!Array.isArray(result)) return '非数组数据'
      await messageSender.sendProtobufElements(session, result)
    })

  pb.subcommand('.raw <cmd:text> <content:text>', '发送 PB 数据')
    .usage('发送 pb 数据')
    .action(async ({ session }, cmd, content) => {
      if (session.bot.platform !== 'onebot') return;
      if (!cmd?.trim() || !content?.trim()) return '请提供数据'
      const result = JSON.parse(content)
      const response = await messageSender.sendRawPacket(session, cmd.trim(), result)
      return JSON.stringify(response, jsonReplacer, 2)
    })
  pb.subcommand('.get [messageId:text]', '获取 PB 数据')
    .option('seq', '-s 使用 seq 而非 messageId')
    .usage('获取消息的 protobuf 数据\n不提供 messageId 时自动使用引用消息')
    .action(async ({ session, options }, messageId) => {
      if (session.bot.platform !== 'onebot') return;
      const replyData = session.event._data?.message?.find(msg => msg.type === 'reply')
      if (replyData?.data?.id) {
        const quotedMsgInfo = await session.onebot._request('get_msg', { message_id: replyData.data.id })
        const realSeq = quotedMsgInfo?.data?.real_seq
        if (realSeq) {
          const seq = typeof realSeq === 'string' ? parseInt(realSeq) : realSeq
          const data = await getMessage(session, seq.toString(), encoder, true)
          return data ? JSON.stringify(data, jsonReplacer, 2) : '获取消息失败'
        }
      }
      if (!messageId?.trim()) return '请提供 ID'
      const data = await getMessage(session, messageId, encoder, options.seq)
      return data ? JSON.stringify(data, jsonReplacer, 2) : '获取消息失败'
    })

  const long = packet.subcommand('long <content:text>', '发送长消息')
    .usage('输入 [JSON] 发送长消息内容')
    .action(async ({ session }, content) => {
      if (session.bot.platform !== 'onebot') return;
      if (!content?.trim()) return '请提供数据'
      const result = JSON.parse(content)
      await messageSender.sendLongElement(session, result)
    })
  long.subcommand('.id <content:text>', '生成长消息 ResID')
    .usage('输入 [JSON] 生成长消息 ResID')
    .action(async ({ session }, content) => {
      if (session.bot.platform !== 'onebot') return;
      if (!content?.trim()) return '请提供数据'
      const result = JSON.parse(content)
      const resid = await messageSender.sendLong(session, result)
      if (!resid) return '生成长消息失败'
      const packet = {
        "37": {
          "6": 1,
          "7": resid,
          "17": 0,
          "19": { "15": 0, "31": 0, "41": 0 }
        }
      }
      return JSON.stringify(packet, jsonReplacer, 2)
    })
  long.subcommand('.get <resid:text>', '获取长消息 PB')
    .usage('通过 ResID 获取长消息 PB 数据')
    .action(async ({ session }, resid) => {
      if (session.bot.platform !== 'onebot') return;
      if (!resid?.trim()) return '请提供 ID'
      const data = await messageSender.receiveLong(session, resid.trim())
      if (!data) return '获取长消息失败'
      return JSON.stringify(data, jsonReplacer, 2)
    })
}
