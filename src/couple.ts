import { Context, Universal, Session, Random } from "koishi"

const guildMemberLists = new Map<string, Universal.GuildMember[]>()

interface MarryData {
  key: string
  value: string
}

interface Relationship {
  marryageId: number
  userFId: string
  targetFId: string
  cid: string
  favorability: number
}

declare module 'koishi' {
  interface Channel {
    marriages: Record<string, string>
  }
  interface Tables {
    marry_data_v2: MarryData
  }
}

function complement<T = any>(a: T[], b: T[]): T[] {
  const bSet = new Set(b)
  return a.filter(x => !bSet.has(x))
}

export default class couple {
  protected ctx: Context

  constructor(ctx: Context) {
    this.ctx = ctx

    ctx.model.extend('channel', {
      marriages: 'json',
    })

    // because koishi have no place to store global data, so I create a table to store these data.
    ctx.model.extend('marry_data_v2', {
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
        await ctx.database.set('marry_data_v2', { key: { $eq: 'latestCleanUpTime' }}, { value: Date.now().toString() })
      }

      const getNextCleanUpTime = () => new Date(new Date().toLocaleDateString()).getTime() + 86400000 - Date.now()
      const cleanUp = async () => {
        await cleanUpMarriages()
        ctx.setTimeout(cleanUp, getNextCleanUpTime())
      }

      let latestCleanUpTime = Number((await ctx.database.get('marry_data_v2', { key: { $eq: 'latestCleanUpTime' }}))[0]?.value)
      if (!latestCleanUpTime) {
        await ctx.database.create('marry_data_v2', { key: 'latestCleanUpTime', value: Date.now().toString() })
        latestCleanUpTime = 0
      }

      if (Date.now() - latestCleanUpTime > 86400000) await cleanUpMarriages()

      ctx.setTimeout(cleanUp, getNextCleanUpTime())
    })()
  }

  protected async setMemberList(session: Session): Promise<Universal.GuildMember[]> {
    let guildMemberList = await session.bot.getGuildMemberList(session.guildId)

    // exclude bot itself
    guildMemberList.splice(guildMemberList.findIndex(user => user.userId === session.bot.userId), 1)

    // exclude married user
    const marriedUsersId = Object.entries((await this.ctx.database.getChannel(session.platform, session.channelId, ['marriages'])).marriages).flat()
    guildMemberList = complement(guildMemberList, marriedUsersId.map(userId => guildMemberList.find(member => member.userId === userId)))

    // save list to map
    guildMemberLists.set(session.gid, guildMemberList)
    return guildMemberList
  }

  protected async getMemberList(session: Session): Promise<Universal.GuildMember[]> {
    const guildMemberList = Array.from(guildMemberLists.has(session.gid) ? guildMemberLists.get(session.gid) : await this.setMemberList(session))
    // exclude user self
    guildMemberList.splice(guildMemberList.findIndex(user => user.userId === session.userId), 1)
    return guildMemberList
  }

  protected async pickCouple(session: Session): Promise<Universal.GuildMember> {
    const couple = Random.pick(await this.getMemberList(session))
    const guildMemberList = guildMemberLists.get(session.gid)
    guildMemberList.splice(guildMemberList.findIndex(member => member === couple), 1)
    return couple
  }

  protected async onMemberUpdate(session: Session) {
    if (guildMemberLists.has(session.gid)) this.setMemberList(session)
  }
  
  public async getCouple(session: Session): Promise<Universal.User> {
    const guildMemberList = await this.getMemberList(session)

    let couple: Universal.GuildMember
    const marriages = (await this.ctx.database.getChannel(session.platform, session.channelId, ['marriages'])).marriages

    // will implement top-bottom system
    for (const [top, bottom] of Object.entries(marriages)) {
      if (top === session.userId) {
        couple = guildMemberList.find(user => user.userId === bottom)
        break
      }
      else if (bottom === session.userId) {
        couple = guildMemberList.find(user => user.userId === top)
        break
      }
    }

    if (!couple) {
      // pick user
      couple = await this.pickCouple(session)
      
      marriages[session?.userId] = couple?.userId
      await this.ctx.database.setChannel(session.platform, session.channelId, { marriages: marriages })
    }

    return couple
  }
}