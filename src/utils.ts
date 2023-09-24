import { Random } from "koishi"

export async function fromAsync<T = any>(iter: AsyncIterable<T>): Promise<T[]> {
  const arr: T[] = []
  for await (const i of iter) {
    arr.push(i)
  }
  return arr
}

export function weightedPick<T = any>(map: Map<T, number>): T
export function weightedPick(map: Record<string, number>): string
export function weightedPick<T = any>(
  map: Map<T, number> | Record<string, number>
): T | string {
  let sum = 0
  let arr: [T | string, number][] = []

  const entries = (() => {
    if (map instanceof Map) return map.entries()
    else return Object.entries(map)
  })()

  for (const [i, w] of entries) {
    sum += w
    arr.push([i, sum])
  }

  const r = Random.int(sum)
  let i = 0
  let j = arr.length
  while (i < j) {
    const h = (i + j) >> 1
    if (arr[h][1] < r) {
      i = h + 1
    } else {
      j = h
    }
  }

  return arr[i]?.[0]
}
