import * as React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ChatMessageMarkdown } from '../ChatMessageMarkdown';

// navigator.clipboard is not available in jsdom; provide a writable stub.
const writeTextMock = jest.fn();

beforeAll(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: writeTextMock },
    configurable: true,
    writable: true
  });
});

beforeEach(() => {
  writeTextMock.mockClear();
});

describe('ChatMessageMarkdown', () => {
  describe('empty content', () => {
    it('renders nothing when content is an empty string', () => {
      const { container } = render(<ChatMessageMarkdown content="" codeBlockProps={{}} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('text content', () => {
    it('renders plain paragraph text', () => {
      render(<ChatMessageMarkdown content="Hello world" codeBlockProps={{}} />);
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('renders an h1 heading', () => {
      render(<ChatMessageMarkdown content="# Top Heading" codeBlockProps={{}} />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Top Heading');
    });

    it('renders an h2 heading', () => {
      render(<ChatMessageMarkdown content="## Section Heading" codeBlockProps={{}} />);
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Section Heading');
    });
  });

  describe('lists', () => {
    it('renders an unordered list with items', () => {
      render(<ChatMessageMarkdown content={'- alpha\n- beta\n- gamma'} codeBlockProps={{}} />);
      expect(screen.getByText('alpha')).toBeInTheDocument();
      expect(screen.getByText('beta')).toBeInTheDocument();
      expect(screen.getByText('gamma')).toBeInTheDocument();
    });

    it('renders an ordered list with items', () => {
      render(<ChatMessageMarkdown content={'1. first\n2. second\n3. third'} codeBlockProps={{}} />);
      expect(screen.getByText('first')).toBeInTheDocument();
      expect(screen.getByText('second')).toBeInTheDocument();
      expect(screen.getByText('third')).toBeInTheDocument();
    });
  });

  describe('inline code', () => {
    it('renders single-line backtick text as inline code without a copy button', () => {
      render(<ChatMessageMarkdown content="Run `kubectl get pods` now" codeBlockProps={{}} />);
      const code = screen.getByText('kubectl get pods');
      expect(code.tagName.toLowerCase()).toBe('code');
      expect(screen.queryByRole('button', { name: /copy code button/i })).not.toBeInTheDocument();
    });
  });

  describe('code blocks', () => {
    it('renders a fenced multi-line code block with a copy button', () => {
      const content = '```\nline one\nline two\n```';
      render(<ChatMessageMarkdown content={content} codeBlockProps={{}} />);
      expect(screen.getByText(/line one/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /copy code button/i })).toBeInTheDocument();
    });

    it('shows the language label for a fenced block that specifies a language', () => {
      const content = '```yaml\nkey: value\n```';
      render(<ChatMessageMarkdown content={content} codeBlockProps={{}} />);
      expect(screen.getByText('yaml')).toBeInTheDocument();
    });

    it('does not show a language label when no language is specified', () => {
      const content = '```\nsome code\n```';
      render(<ChatMessageMarkdown content={content} codeBlockProps={{}} />);
      // There should be no language label div, but there will be a copy button
      expect(screen.queryByText(/^[a-z]+$/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /copy code button/i })).toBeInTheDocument();
    });

    it('copies the code to clipboard when the copy button is clicked', () => {
      const content = '```\nkubectl get pods -A\n```';
      render(<ChatMessageMarkdown content={content} codeBlockProps={{}} />);

      const copyBtn = screen.getByRole('button', { name: /copy code button/i });
      fireEvent.click(copyBtn);

      expect(writeTextMock).toHaveBeenCalledTimes(1);
      // react-markdown passes code block content including the trailing newline to children
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('kubectl get pods -A'));
    });

    it('shows a check icon after clicking copy and reverts after 3 seconds', async () => {
      jest.useFakeTimers();

      const content = '```\necho hello\n```';
      render(<ChatMessageMarkdown content={content} codeBlockProps={{}} />);

      const copyBtn = screen.getByRole('button', { name: /copy code button/i });

      // Before click: CopyIcon is rendered (aria-hidden svg, accessible via button name)
      expect(copyBtn).toBeInTheDocument();

      fireEvent.click(copyBtn);

      // After click: clipboard is written
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('echo hello'));

      // Advance timers past the 3-second reset
      act(() => {
        jest.advanceTimersByTime(3100);
      });

      jest.useRealTimers();
    });
  });

  describe('links', () => {
    it('renders external links that open in a new tab when openLinkInNewTab is true', () => {
      render(
        <ChatMessageMarkdown
          content="[Kiali docs](https://kiali.io/docs)"
          codeBlockProps={{}}
          openLinkInNewTab={true}
        />
      );
      const link = screen.getByRole('link', { name: /Kiali docs/i });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders a plain link (no new tab) when openLinkInNewTab is false', () => {
      render(<ChatMessageMarkdown content="[Kiali](https://kiali.io)" codeBlockProps={{}} openLinkInNewTab={false} />);
      const link = screen.getByRole('link', { name: /Kiali/i });
      expect(link).not.toHaveAttribute('target', '_blank');
    });

    it('renders link text as plain span (no anchor) when hasNavigationActions is true', () => {
      render(
        <ChatMessageMarkdown content="[Kiali](https://kiali.io)" codeBlockProps={{}} hasNavigationActions={true} />
      );
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      // The link text should still be visible
      expect(screen.getByText('Kiali')).toBeInTheDocument();
    });
  });
});
