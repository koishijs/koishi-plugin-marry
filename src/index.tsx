import { Schema, Context, Universal, $, h } from 'koishi'
import { fromAsync, weightedPick } from './utils'
import { } from 'koishi-plugin-messages'
import { } from 'koishi-plugin-cron'

export const name = 'marry'
export const using = ['database', '__cron__'] as const
export const usage = `### 配置说明
- excludedUsers: 排除的用户，可以排除诸如Q群管家或者其他机器人账号
  - platform: 平台名称（QQ平台名为onebot）
  - id: 用户ID，在QQ平台即为QQ号
  - note: 备注，仅用于标识作用，可不填

### 问题反馈

小伙伴如果遇到问题或者有新的想法，欢迎到[这里](https://github.com/koishijs/koishi-plugin-marry/issues/new/choose)反馈哦~`

interface Config {
  excludedUsers: {
    platform: string
    id: string
    note: string
  }[]
}

export const Config: Schema<Config> = Schema.object({
  excludedUsers: Schema.array(Schema.object({
    platform: Schema.string().description('平台名（QQ平台名为onebot）').required(),
    id: Schema.string().description('用户ID').required(),
    note: Schema.string().description('备注（可不填此项）'),
  })).description('排除的用户').default([
    { platform: 'onebot', id: '2854196310', note: 'Q群管家' }
  ]),
})

let marriages: Record<string, string> = {}

export async function apply(ctx: Context, config: Config) {
  ctx.i18n.define('zh', require('./locales/zh-CN'))
  ctx.cron('0 0 * * *', () => marriages = {})

  ctx.command('marry')
    .action(async ({ session }) => {
      if (!session.guildId) return

      const excludes = [
        session.userId,
        session.selfId,
        ...config.excludedUsers.map(u => u.platform === session.platform ? u.id : undefined).filter(Boolean)
      ]
      let couple: Universal.GuildMember

      if (marriages[session.fid]) {
        const userId = marriages[session.fid].split(':')[2]
        couple = await session.bot.getGuildMember(session.guildId, userId)
      } else {
        const count = await ctx.database
          .select('chat.message')
          .where(row => $.and($.eq(row.platform, session.platform), $.eq(row.guildId, session.guildId)))
          .groupBy(['userId'], {
            activity: row => $.count(row.userId)
          })
          .execute()

        const members = await fromAsync(session.bot.getGuildMemberIter(session.guildId))
        const map = new Map(members.filter(m => !excludes.includes(m.user.id)).map(m => {
          const { activity = 0 } = count.find(({ userId }) => userId === m.user.id) ?? {}
          return [m, activity + 1]
        }))

        couple = weightedPick(map)
        if (!couple) return <i18n path=".members-too-few" />
        const coupleFid = `${session.platform}:${session.guildId}:${couple.user.id}`
        marriages[session.fid] = coupleFid
        marriages[coupleFid] = session.fid
      }
      return session.text('.marriages', {
        quote: h('quote', { id: session.messageId }),
        name: couple.nickname ?? couple.user.name,
        avatar: h.image(couple.user.avatar, { cache: false })
      })
    })
}
