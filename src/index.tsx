import { Schema, Context, Universal } from 'koishi'
import Couple from './couple'
import './types'

export const name = 'marry'
export const using = ['database'] as const
export const usage = `### 配置说明

- keyword: 触发娶群友的关键词列表
  - 默认值为 "今日老婆"
- excludedUsers: 排除的用户，可以排除诸如Q群管家或者其他机器人账号
  - platform: 平台名称（QQ平台名为onebot）
  - id: 用户ID，在QQ平台即为QQ号
  - note: 备注，仅用于标识作用，可不填
- roles: 区分角色
  - 开启后将会使你的爱情双向奔赴

### 问题反馈

小伙伴如果遇到问题或者有新的想法，欢迎到[这里](https://github.com/koishijs/koishi-plugin-marry/issues/new/choose)反馈哦~`

export const Config : Schema<marry.Config> = Schema.object({
  keyword: Schema.union([
    Schema.array(String),
    Schema.transform(String, keyword => [keyword]),
  ] as const).description('触发娶群友的关键词').default(['今日老婆']),
  excludedUsers: Schema.array(Schema.object({
    platform: Schema.string().description('平台名（QQ平台名为onebot）').required(),
    id: Schema.string().description('用户ID').required(),
    note: Schema.string().description('备注（可不填此项）'),
  })).description('排除的用户').default([
    { platform: 'onebot', id: '2854196310', note: 'Q群管家' }
  ]),
  roles: Schema.boolean().default(false).description('是否区分角色')
})

export async function apply(ctx: Context, config: marry.Config) {
  ctx.i18n.define('zh', require('./locales/zh-CN'))

  const couple = new Couple(ctx, config)

  ctx.middleware((session, next) => {
    for (const i of config.keyword) {
      if (session.content === i) session.execute('marry')
    }
    return next()
  })

  ctx.command('marry')
    .action(async ({ session }) => {
      if (session.subtype === 'private') return

      const marriedUser:Universal.GuildMember = await couple.getCouple(session)
      
      // if there are no user to pick, return with "members-too-few"
      if (!marriedUser) return <i18n path=".members-too-few" />
      let couple_path :string ='.today-couple'
      if(marriedUser['roles'].indexOf('husband')>-1 && config.roles){
        couple_path=".today-husband"
      }
      return <>
        <quote id={session.messageId} />
        <i18n path={couple_path} />{marriedUser.nickname ? marriedUser.nickname : marriedUser.username}
        <image url={marriedUser.avatar} />
      </>
    })
}
