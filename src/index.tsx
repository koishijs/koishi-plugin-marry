import { Schema, Context, Universal, Session, Random } from 'koishi'

export const name = 'marry'

export interface Config {
  keyword: string[],
}

export const Config: Schema<Config> = Schema.object({
  keyword: Schema.union([
    Schema.array(String),
    Schema.transform(String, (prefix) => [prefix]),
  ] as const).description('触发娶群友的关键词').default(['今日群友']),
})

const guildMemberLists = new Map<string, Universal.GuildMember[]>()

export function apply(ctx: Context, config: Config) {
  ctx.i18n.define('zh', require('./locales/zh-CN'))

  ctx.middleware((session, next) => {
    for (const i of config.keyword) {
      if (session.content == i) {
        session.execute('marry')
      }
    }
    return next()
  })

  const setSessionGuildMemberList = async (session: Session): Promise<Universal.GuildMember[]> => {
    const guildMemberList = await session.bot.getGuildMemberList(session.guildId)
    // exclude bot itself
    guildMemberList.splice(guildMemberList.findIndex((user)=> user.userId === session.bot.userId), 1)
    guildMemberLists.set(session.gid, guildMemberList)
    return guildMemberList
  }

  const getSessionGuildMemberList = async (session: Session): Promise<Universal.GuildMember[]> => {
    let guildMemberList: Universal.GuildMember[]
    if (guildMemberLists.has(session.gid)) guildMemberList = Array.from(guildMemberLists.get(session.gid))
    else guildMemberList = Array.from(await setSessionGuildMemberList(session))
    guildMemberList.splice(guildMemberList.findIndex((user)=> user.userId === session.userId), 1)
    return guildMemberList
  }

  ctx.on('guild-member-added', async (session) => {
    if (guildMemberLists.has(session.gid)) setSessionGuildMemberList(session)
  })

  ctx.command('marry')
  .action(async ({ session }) => {
    if (session.subtype === 'private') return
    const guildMemberList = await getSessionGuildMemberList(session)
    
    const marriedUser = Random.pick(guildMemberList)

    return <>
      <quote id={session.messageId}/>
      你今日的群友是：{marriedUser.username}
      <image url={marriedUser.avatar}/>
    </>
  })
}
