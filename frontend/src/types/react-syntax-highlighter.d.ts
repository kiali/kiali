/* eslint-disable import/no-default-export */
declare module 'react-syntax-highlighter/dist/cjs/default-highlight' {
  import { ComponentType } from 'react';
  const SyntaxHighlighter: ComponentType<any>;
  export default SyntaxHighlighter;
}

declare module 'react-syntax-highlighter/dist/cjs/styles/hljs' {
  export const obsidian: Record<string, any>;
}
