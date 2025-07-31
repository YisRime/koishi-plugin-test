import { Context } from 'koishi'

/**
 * 数据库中存储的用户昵称信息结构。
 */
export interface UserProfile {
  userId: string;
  nickname: string;
}

// 扩展 Koishi 的 Tables 接口，以获得类型提示
declare module 'koishi' {
  interface Tables {
    cave_user: UserProfile;
  }
}

/**
 * 管理用户在回声洞插件中的自定义昵称。
 * 提供了设置、获取和清除昵称的功能。
 */
export class ProfileManager {

  /**
   * @param ctx Koishi 上下文，用于初始化数据库模型
   */
  constructor(private ctx: Context) {
    // 扩展数据库模型，定义表结构
    this.ctx.model.extend('cave_user', {
      userId: 'string', // 用户 ID
      nickname: 'string', // 用户自定义昵称
    }, {
      primary: 'userId', // 使用 userId 作为主键，确保唯一性
    });
  }

  /**
   * 设置或更新用户的昵称。
   * @param userId - 目标用户的 ID
   * @param nickname - 要设置的新昵称
   */
  public async setNickname(userId: string, nickname: string): Promise<void> {
    // 使用 upsert (update or insert) 实现创建或更新操作
    await this.ctx.database.upsert('cave_user', [{
      userId,
      nickname,
    }]);
  }

  /**
   * 获取用户的昵称。
   * @param userId - 目标用户的 ID
   * @returns 返回用户的昵称字符串，如果未设置则返回 null
   */
  public async getNickname(userId: string): Promise<string | null> {
    // .get() 方法返回一个数组
    const profiles = await this.ctx.database.get('cave_user', { userId });
    return profiles[0]?.nickname || null;
  }

  /**
   * 清除用户的昵称设置。
   * @param userId - 目标用户的 ID
   */
  public async clearNickname(userId: string): Promise<void> {
    // 从数据库中删除对应的记录
    await this.ctx.database.remove('cave_user', { userId });
  }
}
