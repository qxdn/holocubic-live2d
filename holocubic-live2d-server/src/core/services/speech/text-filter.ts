/** 标签及其内部内容都不参与朗读；新增隐藏标签时在此扩展。 */
const HIDDEN_TAGS: readonly string[] = [
  'think',
  'motion',
  'script',
  'style',
]

/** 增量过滤标签：跨分块保留未闭合标签，隐藏内心独白、动作和脚本内容。 */
export class SpeechTextFilter {
  private pending = ''
  private hidden: string[] = []

  push(text: string): string {
    this.pending += text
    let output = ''
    while (this.pending) {
      const start = this.pending.indexOf('<')
      if (start === -1) {
        output += this.readText(this.pending.length)
        break
      }
      output += this.readText(start)
      // 数学比较符号不是标签；单独的 < 留待下个分块确认。
      if (this.pending.length === 1) break
      if (!/^<[/!a-z]/i.test(this.pending)) {
        output += this.readText(1)
        continue
      }
      const end = this.pending.indexOf('>')
      if (end === -1) break
      const tag = this.pending.slice(0, end + 1)
      this.pending = this.pending.slice(end + 1)
      output += this.processTag(tag)
    }
    return output
  }

  /** 消费普通文字，隐藏状态下只移除缓存，不输出。 */
  private readText(length: number): string {
    const text = this.pending.slice(0, length)
    this.pending = this.pending.slice(length)
    return this.hidden.length ? '' : text
  }

  /** 完整标签更新隐藏栈；非隐藏状态下的 br 转为换行。 */
  private processTag(tag: string): string {
    const match = /^<\s*(\/?)\s*([\w-]+)/.exec(tag)
    if (!match) return ''
    const name = match[2].toLowerCase()
    if (!HIDDEN_TAGS.includes(name)) {
      return name === 'br' && !this.hidden.length ? '\n' : ''
    }
    if (match[1]) {
      if (this.hidden.at(-1) === name) this.hidden.pop()
    } else if (!tag.endsWith('/>')) this.hidden.push(name)
    return ''
  }

  /** 结束时丢弃未闭合标签及隐藏内容，避免把半个标签读出来。 */
  finish(): void {
    this.pending = ''
    this.hidden = []
  }
}
