import { Context } from 'koishi'

export interface UserProfile {
  userId: string;
  nickname: string;
}

// 扩展 Tables 接口以包含新的表
declare module 'koishi' {
  interface Tables {
    best_cave_user_profile: UserProfile;
  }
}

/**
 * ProfileManager 类负责管理用户的自定义昵称。
 */
export class ProfileManager {

  // 在构造函数中接收 Context 实例并初始化数据库表
  constructor(private ctx: Context) {
    this.ctx.model.extend('best_cave_user_profile', {
      userId: 'string',
      nickname: 'string',
    }, {
      primary: 'userId', // 使用 userId作为主键
    });
  }

  /**
   * 为指定用户设置或更新昵称。
   * @param userId 用户 ID
   * @param nickname 要设置的新昵称
   */
  public async setNickname(userId: string, nickname: string): Promise<void> {
    // 使用 upsert 方法，如果用户记录已存在则更新，否则插入新记录
    await this.ctx.database.upsert('best_cave_user_profile', [{
      userId,
      nickname,
    }]);
  }

  /**
   * 获取指定用户的昵称。
   * @param userId 用户 ID
   * @returns 如果找到则返回用户的昵称，否则返回 null
   */
  public async getNickname(userId: string): Promise<string | null> {
    const profile = await this.ctx.database.get('best_cave_user_profile', { userId });
    // get 返回的是数组，如果数组不为空，则取第一个元素的 nickname
    if (profile.length > 0) {
      return profile[0].nickname;
    }
    return null;
  }

  /**
   * 清除指定用户的昵称。
   * @param userId 用户 ID
   */
  public async clearNickname(userId: string): Promise<void> {
    // 通过用户 ID 从数据库中删除对应的条目
    await this.ctx.database.remove('best_cave_user_profile', { userId });
  }
}
