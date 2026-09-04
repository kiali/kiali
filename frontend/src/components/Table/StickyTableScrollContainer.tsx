import * as React from 'react';
import { InnerScrollContainer } from '@patternfly/react-table';
import { classes } from 'typestyle';

// DOM class toggled while a sticky table scroll container is scrolled.
export const TABLE_SCROLLED = 'table-scrolled';

type StickyTableScrollContainerProps = {
  children: React.ReactNode;
  className?: string;
  // Bumps when table body content changes (e.g. row count) to re-sync the scroll class.
  contentVersion?: number | string;
};

export const StickyTableScrollContainer: React.FC<StickyTableScrollContainerProps> = ({
  children,
  className,
  contentVersion
}) => {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [tableScrolled, setTableScrolled] = React.useState(false);

  const syncTableScrollState = React.useCallback(() => {
    const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
    const scrolled = scrollTop > 0;

    setTableScrolled(prev => (prev === scrolled ? prev : scrolled));
  }, []);

  const onTableScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const scrolled = event.currentTarget.scrollTop > 0;

    setTableScrolled(prev => (prev === scrolled ? prev : scrolled));
  }, []);

  React.useLayoutEffect(() => {
    syncTableScrollState();
  }, [contentVersion, syncTableScrollState]);

  return (
    <InnerScrollContainer
      ref={scrollContainerRef}
      className={classes(className, tableScrolled && TABLE_SCROLLED)}
      onScroll={onTableScroll}
    >
      {children}
    </InnerScrollContainer>
  );
};
