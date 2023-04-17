namespace marry {
  export interface Config {
    keyword: string[]
    excludedUsers: {
      platform: string
      id: string
      note: string
    }[]
    roles: boolean
  }    
}