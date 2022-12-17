import { Schema, Context } from 'koishi'

export const name = 'marry'

export interface Config {}

export const Config: Schema<Config> = Schema.object({})

export function apply(ctx: Context) {
  ctx.command('marry')
  .action(({ options, session }, input) => {})
}
