export interface IdConfig {
  prefix?: string
  padding?: number
  start?: number
}

export class IdGenerator {
  private counter: number
  private prefix: string
  private padding: number

  constructor(config: IdConfig = {}) {
    this.counter = config.start || 1
    this.prefix = config.prefix || 'EC'
    this.padding = config.padding || 6
  }

  gen(): string {
    return `${this.prefix}${String(this.counter++).padStart(this.padding, '0')}`
  }

  count(): number {
    return this.counter
  }

  set(value: number): void {
    this.counter = value
  }

  reset(): void {
    this.counter = 1
  }
}
