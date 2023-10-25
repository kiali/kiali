import * as React from 'react';
import { Tabs } from '@patternfly/react-core';

// SimpleTabs is just a Tabs wrapper than encapsulates the activeTab state handling such
// that parent components of Tabs don't have to re-render on a tab change.

type SimpleTabsProps = {
  children: React.ReactNode;
  defaultTab: number;
  id: string;
  isFilled?: boolean;
  mountOnEnter?: boolean;
  style?: React.CSSProperties;
  unmountOnExit?: boolean;
};

export const SimpleTabs: React.FC<SimpleTabsProps> = (props: SimpleTabsProps) => {
  const [activeTab, setActiveTab] = React.useState<string | number>(props.defaultTab);

  const handleTabSelect = (_event: React.MouseEvent, index: string | number): void => {
    setActiveTab(index);
  };

  return (
    <Tabs
      id={props.id}
      style={props.style ? props.style : {}}
      isFilled={props.isFilled ? props.isFilled : true}
      activeKey={activeTab}
      onSelect={handleTabSelect}
      mountOnEnter={props.mountOnEnter === undefined ? true : props.mountOnEnter}
      unmountOnExit={props.unmountOnExit === undefined ? true : props.unmountOnExit}
    >
      {!Array.isArray(props.children) ? <>{props.children}</> : props.children.map(child => child)}
    </Tabs>
  );
};
