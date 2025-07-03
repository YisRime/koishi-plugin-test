export interface DupResult {
  isDup: boolean
  score: number
  existId?: string
}

export interface DupConfig {
  dupThreshold: number
}

export class DupChecker {
  constructor(private config: DupConfig) {}

  async check(
    text: string,
    existing: Map<string, { content: string; status: string }>
  ): Promise<DupResult> {
    const norm = this.norm(text)

    for (const [id, item] of existing) {
      if (item.status === 'approved') {
        const existNorm = this.norm(item.content)
        const score = this.calc(norm, existNorm)

        if (score >= this.config.dupThreshold) {
          return { isDup: true, score, existId: id }
        }
      }
    }

    return { isDup: false, score: 0 }
  }

  private norm(text: string): string {
    return text.toLowerCase().replace(/\s+/g, ' ').trim()
  }

  private calc(str1: string, str2: string): number {
    if (str1 === str2) return 1
    if (str1.length === 0 || str2.length === 0) return 0

    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,
          matrix[j][i - 1] + 1,
          matrix[j - 1][i - 1] + cost
        )
      }
    }

    const maxLen = Math.max(str1.length, str2.length)
    return 1 - matrix[str2.length][str1.length] / maxLen
  }

  update(threshold: number): void {
    this.config.dupThreshold = threshold
  }

  get(): number {
    return this.config.dupThreshold
  }
}
