import { Session } from 'koishi'
import { ProtobufEncoder } from './protobuf'
import { promisify } from 'util'
import { gzip as _gzip, gunzip as _gunzip } from 'zlib'

const gzip = promisify(_gzip)
const gunzip = promisify(_gunzip)

/**
 * 消息发送器类
 */
export class MessageSender {
  constructor(private encoder: ProtobufEncoder) {}

  /**
   * 检查字符串是否为有效的十六进制字符串
   * @param s - 待检查的字符串
   * @returns 是否为有效的十六进制字符串
   */
  private isHexString(s: string): boolean {
    return s.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(s)
  }

  /**
   * 处理 JSON 数据并将十六进制字符串转换为缓冲区
   * @param data - 待处理的数据
   * @param path - 当前路径
   * @returns 处理后的数据
   */
  private processJson(data: any, path: string[] = []): any {
    if (typeof data === 'string') {
      if (path.length >= 2 && path.slice(-2).join(',') === '5,2' && this.isHexString(data))
        return Buffer.from(data, 'hex')
      if (data.startsWith('hex->') && this.isHexString(data.slice(5)))
        return Buffer.from(data.slice(5), 'hex')
      return data
    }
    if (Array.isArray(data)) return data.map((item, i) => this.processJson(item, [...path, (i + 1).toString()]))
    if (typeof data === 'object' && data !== null) {
      const result: any = {}
      for (const [key, value] of Object.entries(data)) result[parseInt(key)] = this.processJson(value, [...path, key])
      return result
    }
    return data
  }

  /**
   * 发送数据包
   * @param session - 会话对象
   * @param cmd - 命令名称
   * @param packet - 数据包内容
   * @returns 响应结果
   */
  private async sendPacket(session: Session, cmd: string, packet: any): Promise<any> {
    const encodedData = this.encoder.encode(this.processJson(packet))
    const hexString = Buffer.from(encodedData).toString('hex')
    const resp = await session.onebot._request('send_packet', { cmd, data: hexString })
    return resp
  }

  /**
   * 直接发送 protobuf 元素数据
   * @param session - 会话对象
   * @param elementsData - 元素数据数组
   */
  async sendProtobufElements(session: Session, elementsData: any[]): Promise<void> {
    const packet = {
      1: { [session.guildId ? '2' : '1']: { 1: parseInt(session.guildId || session.userId || '0') } },
      2: { 1: 1, 2: 0, 3: 0 },
      3: { 1: { 2: elementsData } },
      4: Math.floor(Math.random() * 0xFFFFFFFF),
      5: Math.floor(Math.random() * 0xFFFFFFFF)
    }
    await this.sendPacket(session, 'MessageSvc.PbSendMsg', packet)
  }

  /**
   * 发送长消息并返回resid
   * @param session - 会话对象
   * @param content - 消息内容
   * @returns 长消息ID
   */
  async sendLong(session: Session, content: any): Promise<string> {
    const data = {
      "2": {
        "1": "MultiMsg",
        "2": { "1": [{ "3": { "1": { "2": typeof content === 'object' ? content : JSON.parse(content) } } }] }
      }
    }
    const encodedData = this.encoder.encode(this.processJson(data))
    const compressedData = await gzip(encodedData)
    const target = BigInt(session.guildId || session.userId)
    const packet = {
      "2": {
        "1": session.guildId ? 3 : 1,
        "2": { "2": target },
        "3": target.toString(),
        "4": compressedData
      },
      "15": { "1": 4, "2": 2, "3": 9, "4": 0 }
    }
    const resp = await this.sendPacket(session, 'trpc.group.long_msg_interface.MsgService.SsoSendLongMsg', packet)
    return resp?.["2"]?.["3"] || ''
  }

  /**
   * 发送长消息元素
   * @param session - 会话对象
   * @param content - 消息内容
   */
  async sendLongElement(session: Session, content: any): Promise<void> {
    const resid = await this.sendLong(session, content)
    if (resid) {
      const elem = {
        "37": {
          "6": 1,
          "7": resid,
          "17": 0,
          "19": { "15": 0, "31": 0, "41": 0 }
        }
      }
      await this.sendProtobufElements(session, [elem])
    }
  }

  /**
   * 接收长消息
   * @param session - 会话对象
   * @param resid - 长消息ID
   * @returns 消息数据或null
   */
  async receiveLong(session: Session, resid: string): Promise<any> {
    const packet = {
      "1": { "2": resid, "3": true },
      "15": { "1": 2, "2": 0, "3": 0, "4": 0 }
    }
    const resp = await this.sendPacket(session, 'trpc.group.long_msg_interface.MsgService.SsoRecvLongMsg', packet)
    if (resp?.data) {
      const decodedResp = this.encoder.decode(resp.data)
      const compressedData = decodedResp?.["1"]?.["4"]
      if (compressedData) {
        const decompressedData = await gunzip(compressedData)
        return this.encoder.decode(decompressedData)
      }
    }
    return null
  }

  /**
   * 发送原始包
   * @param session - 会话对象
   * @param cmd - 命令名称
   * @param content - 数据内容
   * @returns 解码后的响应数据或null
   */
  async sendRawPacket(session: Session, cmd: string, content: any): Promise<any> {
    const encodedData = this.encoder.encode(typeof content === 'object' ? this.processJson(content) : this.processJson(JSON.parse(content)))
    const hexString = Buffer.from(encodedData).toString('hex')
    const resp = await session.onebot._request('send_packet', { cmd, data: hexString })
    return resp?.data ? this.encoder.decode(resp.data) : null
  }
}
