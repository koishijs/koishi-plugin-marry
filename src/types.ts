namespace marry {
  export interface Config {
    keyword: string[]
    excludedUsers: {
      platform: string
      id: string
      note: string
    }[],
    includedUsers: {
      platform: string
      id: string
      note: string
    }[]
  }    
}