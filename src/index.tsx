import { Schema, Context } from 'koishi'
import Couple from './couple'

export const name = 'marry'
export const using = ['database'] as const

export interface Config {
  keyword: string[]
}

export const Config: Schema<Config> = Schema.object({
  keyword: Schema.union([
    Schema.array(String),
    Schema.transform(String, (prefix) => [prefix]),
  ] as const).description('触发娶群友的关键词').default(['今日老婆']),
})

export async function apply(ctx: Context, config: Config) {
  ctx.i18n.define('zh', require('./locales/zh-CN'))

  const couple = new Couple(ctx)

  ctx.middleware((session, next) => {
    for (const i of config.keyword) {
      if (session.content === i) session.execute('marry')
    }
    return next()
  })

  ctx.command('marry')
  .action(async ({ session }) => {
    if (session.subtype === 'private') return
    const marriedUser = await couple.getCouple(session)

    // if there are no user to pick, return with "members-too-few"
    if (!marriedUser) return <i18n path=".members-too-few" />
    return <>
      <quote id={session.messageId} />
      <i18n path=".today-couple" />{marriedUser.nickname ? marriedUser.nickname : marriedUser.username}
      <image url={marriedUser.avatar} />
    </>
  })
}
