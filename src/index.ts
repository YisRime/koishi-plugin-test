import { Context, Schema, Logger } from 'koishi'

export const name = 'test'
export const logger = new Logger('test')

export interface Config {
}

export const Config: Schema<Config> = Schema.intersect([
])

export function apply(ctx: Context, config: Config) {
}
