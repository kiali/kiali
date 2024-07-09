import * as React from 'react';
import { TabProps, Tabs } from '@patternfly/react-core';
import { location, router } from '../../app/History';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from 'components/Pf/PfColors';
import { classes } from 'typestyle';

type TabsProps = {
  activeTab: string;
  className?: string;
  defaultTab: string;
  id: string;
  mountOnEnter?: boolean;
  onSelect: (tabName: string) => void;
  postHandler?: (tabName: string) => void;
  tabMap: { [key: string]: number };
  tabName?: string;
  unmountOnExit?: boolean;
};

export const activeTab = (tabName: string, defaultTab: string): string => {
  return new URLSearchParams(location.getSearch()).get(tabName) || defaultTab;
};

const tabStyle = kialiStyle({
  backgroundColor: PFColors.BackgroundColor100
});

type TabElement = React.ReactElement<TabProps, React.JSXElementConstructor<TabProps>>;

type TabMap = { [key: number]: string };

export class ParameterizedTabs extends React.Component<TabsProps> {
  private indexMap: TabMap;
  private tabLinks: TabMap;

  constructor(props: TabsProps) {
    super(props);
    this.indexMap = this.buildIndexMap();
    this.tabLinks = this.buildTabLinks();
  }

  componentDidUpdate(): void {
    this.indexMap = this.buildIndexMap();
    this.tabLinks = this.buildTabLinks();
  }

  buildIndexMap(): TabMap {
    return Object.keys(this.props.tabMap).reduce((result: { [i: number]: string }, name: string) => {
      result[this.tabIndexOf(name)] = name;
      return result;
    }, {});
  }

  buildTabLinks(): TabMap {
    const tabLinks: TabMap = {};

    React.Children.forEach(this.props.children, child => {
      const childComp = child as React.ReactElement<TabProps>;

      if (childComp.props.href) {
        tabLinks[childComp.props.eventKey] = childComp.props.href;
      }
    });

    return tabLinks;
  }

  tabIndexOf(tabName: string): number {
    return this.props.tabMap[tabName];
  }

  tabNameOf(index: number): string {
    return this.indexMap[index];
  }

  activeIndex = (): number => {
    return this.tabIndexOf(this.props.activeTab);
  };

  isLinkTab = (index: number): boolean => {
    return this.tabLinks[index] != null;
  };

  tabSelectHandler = (tabKey: string): void => {
    const urlParams = new URLSearchParams(location.getSearch());

    if (!!this.props.tabName) {
      urlParams.set(this.props.tabName, tabKey);
      router.navigate(`${location.getPathname()}?${urlParams.toString()}`);
    }

    if (this.props.postHandler) {
      this.props.postHandler(tabKey);
    }

    this.setState({
      currentTab: tabKey
    });
  };

  tabTransitionHandler = (tabKey: number): void => {
    const tabName = this.tabNameOf(tabKey);
    this.tabSelectHandler(tabName);
    this.props.onSelect(tabName);
  };

  render(): React.ReactNode {
    return (
      <Tabs
        id={this.props.id}
        className={classes(this.props.className, tabStyle)}
        activeKey={this.activeIndex()}
        onSelect={(_, ek) => {
          if (!this.isLinkTab(ek as number)) {
            this.tabTransitionHandler(ek as number);
          }
        }}
        mountOnEnter={this.props.mountOnEnter === undefined ? true : this.props.mountOnEnter}
        unmountOnExit={this.props.unmountOnExit === undefined ? true : this.props.unmountOnExit}
      >
        {!Array.isArray(this.props.children)
          ? (this.props.children as TabElement)
          : this.props.children.map(child => child)}
      </Tabs>
    );
  }
}
