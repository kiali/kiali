export class AutoComplete {
  private endings: string[];
  private start: string;

  constructor(private options: string[]) {
    this.endings = [...options];
    this.start = '';
  }

  setInput(input: string, delims?: string[]) {
    delims = !delims ? [' '] : delims;
    let lastDelim = -1;
    for (const d of delims) {
      const i = input.lastIndexOf(d);
      lastDelim = i > lastDelim ? i : lastDelim;
    }

    this.start = lastDelim < 0 ? '' : input.slice(0, lastDelim + 1);
    const end = lastDelim < 0 ? input : input.slice(lastDelim + 1);

    this.endings = !end ? [...this.options] : this.options.filter(o => o.startsWith(end) && o !== end);

    if (!this.endings.length) {
      this.start = input;
    }
  }

  next(): string {
    if (!this.endings.length) {
      return this.start;
    }
    const nextEnding = this.endings.shift();
    this.endings.push(nextEnding!);
    return `${this.start}${nextEnding}`;
  }
}
