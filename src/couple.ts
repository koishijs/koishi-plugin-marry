import { Context, Universal, Session, Random } from "koishi"

const guildMemberLists = new Map<string, Universal.GuildMember[]>()

interface MarryData {
  id: number
  latestCleanUpTime: Date
}

declare module 'koishi' {
  interface Channel {
    marriages: Record<string, string>
  }
  interface Tables {
    marry_data: MarryData
  }
}

export default class couple {
  protected ctx: Context

  constructor(ctx: Context) {
    this.ctx = ctx

    ctx.model.extend('channel', {
      marriages: 'json',
    })

    // because koishi have no place to store global data, so I create a table to store these data.
    ctx.model.extend('marry_data', {
      id: 'unsigned',
      latestCleanUpTime: 'timestamp',
    })

    // update member list on guild member change
    ctx.on('guild-member-added', this.onMemberUpdate)
    ctx.on('guild-member-deleted', this.onMemberUpdate)

    // schedule clean up
    ;(async () => {
      const cleanUpMarriages = () => ctx.database.set('channel', {}, { marriages: {} })
      const getNextCleanUpTime = () => new Date(new Date().toLocaleDateString()).getTime() + 86400000 - Date.now()
      const cleanUp = () => {
        cleanUpMarriages()
        ctx.setTimeout(cleanUp, getNextCleanUpTime())
      }

      let latestCleanUpTime = (await ctx.database.get('marry_data', {}))[0]?.latestCleanUpTime?.getTime()
      if (!latestCleanUpTime) {
        await ctx.database.create('marry_data', { id: 0, latestCleanUpTime: new Date() })
        latestCleanUpTime = 0
      }

      if (Date.now() - latestCleanUpTime > 86400000) {
        cleanUpMarriages()
        await ctx.database.set('marry_data', {}, { latestCleanUpTime: new Date() })
      }

      ctx.setTimeout(cleanUp, getNextCleanUpTime())
    })()
  }

  protected async setSessionGuildMemberList(session: Session): Promise<Universal.GuildMember[]> {
    const guildMemberList = await session.bot.getGuildMemberList(session.guildId)
    // exclude bot itself
    guildMemberList.splice(guildMemberList.findIndex(user => user.userId === session.bot.userId), 1)
    guildMemberLists.set(session.gid, guildMemberList)
    return guildMemberList
  }

  protected async getSessionGuildMemberList(session: Session): Promise<Universal.GuildMember[]> {
    const guildMemberList = Array.from(guildMemberLists.has(session.gid) ? guildMemberLists.get(session.gid) : await this.setSessionGuildMemberList(session))
    // exclude user self
    guildMemberList.splice(guildMemberList.findIndex(user => user.userId === session.userId), 1)
    return guildMemberList
  }

  protected async onMemberUpdate(session: Session) {
    if (guildMemberLists.has(session.gid)) this.setSessionGuildMemberList(session)
  }
  
  public async getCouple(session: Session): Promise<Universal.User> {
    const guildMemberList = await this.getSessionGuildMemberList(session)

    let marriedUser: Universal.GuildMember
    const marriages = (await this.ctx.database.getChannel(session.platform, session.channelId, ['marriages'])).marriages

    // will implement top-bottom system
    for (const [top, bottom] of Object.entries(marriages)) {
      if (top === session.userId) marriedUser = guildMemberList.find(user => user.userId === bottom)
      else if (bottom === session.userId) marriedUser = guildMemberList.find(user => user.userId === top)
    }

    if (!marriedUser) {
      // pick user
      marriedUser = Random.pick(guildMemberList)
      
      marriages[session?.userId] = marriedUser?.userId
      await this.ctx.database.setChannel(session.platform, session.channelId, { marriages: marriages })
    }

    return marriedUser
  }
}