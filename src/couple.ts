import { Context, Universal, Session, Random } from "koishi"

const guildMemberLists = new Map<string, Universal.GuildMember[]>()

interface MarryData {
  key: string
  value: string
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
      key: 'string',
      value: 'string',
    }, {
      primary: 'key'
    })

    // update member list on guild member change
    ctx.on('guild-member-added', this.onMemberUpdate)
    ctx.on('guild-member-deleted', this.onMemberUpdate)

    // schedule clean up
    ;(async () => {
      await ctx.database.set('channel', {}, { marriages: {aaa: 'aa'} })

      const cleanUpMarriages = async () => {
        ctx.database.set('channel', {}, { marriages: {} })
        await ctx.database.set('marry_data', { key: { $eq: 'latestCleanUpTime' }}, { value: Date.now().toString() })
      }

      const getNextCleanUpTime = () => new Date(new Date().toLocaleDateString()).getTime() + 86400000 - Date.now()
      const cleanUp = async () => {
        await cleanUpMarriages()
        ctx.setTimeout(cleanUp, getNextCleanUpTime())
      }

      let latestCleanUpTime = Number((await ctx.database.get('marry_data', { key: { $eq: 'latestCleanUpTime' }}))[0]?.value)
      if (!latestCleanUpTime) {
        await ctx.database.create('marry_data', { key: 'latestCleanUpTime', value: Date.now().toString() })
        latestCleanUpTime = 0
      }

      if (Date.now() - latestCleanUpTime > 86400000) await cleanUpMarriages()

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