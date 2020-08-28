export class AutoComplete {
  private rootOptions: string[];

  constructor(private options: string[]) {
    this.rootOptions = options;
  }

  setRoot(root: string) {
    this.rootOptions = !root ? this.options : this.options.filter(o => o.startsWith(root) && o !== root);
  }

  next(): string | undefined {
    if (!this.rootOptions) {
      return undefined;
    }
    const next = this.rootOptions.shift();
    this.rootOptions.push(next!);
    return next;
  }
}
