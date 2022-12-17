import { Context, Schema } from 'koishi'

export const name = 'marry'

export interface Config {}

export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {
  
}
