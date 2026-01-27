import React from 'react';
import Markdown from 'react-markdown';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/default-highlight';
import { obsidian } from 'react-syntax-highlighter/dist/cjs/styles/hljs';
import {
  Button,
  CodeBlock,
  CodeBlockAction,
  CodeBlockCode,
  Content,
  ContentVariants,
  List,
  ListComponent,
  ListItem,
  OrderType,
  Tooltip
} from '@patternfly/react-core';
import { CheckIcon } from '@patternfly/react-icons/dist/esm/icons/check-icon';
import { CopyIcon } from '@patternfly/react-icons/dist/esm/icons/copy-icon';
import { ExternalLinkSquareAltIcon } from '@patternfly/react-icons';
import { MessageProps } from '@patternfly/chatbot';

type ChatMessageMarkdownProps = {
  codeBlockProps?: MessageProps['codeBlockProps'];
  content: string;
  openLinkInNewTab?: boolean;
};

type TextMessageProps = {
  children?: React.ReactNode;
  component: ContentVariants;
} & Record<string, unknown>;

const TextMessage: React.FC<TextMessageProps> = ({ component, children, ...props }) => (
  <span className="pf-chatbot__message-text">
    <Content component={component} {...(props as Record<string, unknown>)}>
      {children}
    </Content>
  </span>
);

const UnorderedListMessage: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <div className="pf-chatbot__message-unordered-list">
    <List>{children}</List>
  </div>
);

const OrderedListMessage: React.FC<{ children?: React.ReactNode; start?: number }> = ({ children, start }) => (
  <div className="pf-chatbot__message-ordered-list">
    <List component={ListComponent.ol} type={OrderType.number} start={start}>
      {children}
    </List>
  </div>
);

const ListItemMessage: React.FC<{ children?: React.ReactNode }> = ({ children }) => <ListItem>{children}</ListItem>;

const CodeBlockMessage: React.FC<
  React.ComponentProps<'code'> & {
    'aria-label'?: string;
    inline?: boolean;
  }
> = ({ children, className, 'aria-label': ariaLabel, inline: _inline, ...props }) => {
  const [copied, setCopied] = React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const tooltipIdRef = React.useRef(`chatbot-copy-${Math.random().toString(16).slice(2)}`);
  const language = /language-(\w+)/.exec(className || '')?.[1];
  const content = String(children ?? '');

  const handleCopy = React.useCallback((_event: React.MouseEvent, text: string): void => {
    navigator.clipboard.writeText(text);
    setCopied(true);
  }, []);

  React.useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 3000);
    return () => clearTimeout(timer);
  }, [copied]);

  if (!content.includes('\n')) {
    return (
      <code {...props} className="pf-chatbot__message-inline-code">
        {children}
      </code>
    );
  }

  const actions = (
    <CodeBlockAction>
      {language && <div className="pf-chatbot__message-code-block-language">{language}</div>}
      <Button
        ref={buttonRef}
        aria-label={ariaLabel ?? 'Copy code button'}
        variant="plain"
        className="pf-chatbot__button--copy"
        onClick={event => handleCopy(event, content)}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </Button>
      <Tooltip id={tooltipIdRef.current} content="Copy" position="top" triggerRef={buttonRef} />
    </CodeBlockAction>
  );

  return (
    <div className="pf-chatbot__message-code-block">
      <CodeBlock actions={actions}>
        <CodeBlockCode>
          {language ? (
            <SyntaxHighlighter {...props} language={language} style={obsidian} PreTag="div" CodeTag="div" wrapLongLines>
              {content.replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            children
          )}
        </CodeBlockCode>
      </CodeBlock>
    </div>
  );
};

const LinkMessage: React.FC<
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    openLinkInNewTab: boolean;
  }
> = ({ children, openLinkInNewTab, ...props }) => {
  const { type: _type, ...anchorProps } = props;
  if (openLinkInNewTab) {
    return (
      <Button
        component="a"
        variant="link"
        icon={<ExternalLinkSquareAltIcon />}
        iconPosition="end"
        isInline
        target="_blank"
        rel="noopener noreferrer"
        {...(anchorProps as Record<string, unknown>)}
      >
        {children}
      </Button>
    );
  }

  return (
    <Button component="a" isInline variant="link" {...(anchorProps as Record<string, unknown>)}>
      {children}
    </Button>
  );
};

export const ChatMessageMarkdown: React.FC<ChatMessageMarkdownProps> = ({
  content,
  codeBlockProps,
  openLinkInNewTab = true
}) => {
  if (!content) {
    return null;
  }

  const components: Record<string, unknown> = {
    p: (props: any) => <TextMessage component={ContentVariants.p} {...props} />,
    code: ({ children, ...props }: any) => (
      <CodeBlockMessage {...props} {...codeBlockProps}>
        {children}
      </CodeBlockMessage>
    ),
    h1: (props: any) => <TextMessage component={ContentVariants.h1} {...props} />,
    h2: (props: any) => <TextMessage component={ContentVariants.h2} {...props} />,
    h3: (props: any) => <TextMessage component={ContentVariants.h3} {...props} />,
    h4: (props: any) => <TextMessage component={ContentVariants.h4} {...props} />,
    h5: (props: any) => <TextMessage component={ContentVariants.h5} {...props} />,
    h6: (props: any) => <TextMessage component={ContentVariants.h6} {...props} />,
    blockquote: (props: any) => <TextMessage component={ContentVariants.blockquote} {...props} />,
    ul: (props: any) => <UnorderedListMessage {...props} />,
    ol: (props: any) => <OrderedListMessage {...props} />,
    li: (props: any) => <ListItemMessage {...props} />,
    a: (props: any) => <LinkMessage openLinkInNewTab={openLinkInNewTab} {...props} />
  };

  return <Markdown components={components}>{content}</Markdown>;
};
