// Assisted-by: OpenAI Codex
import * as React from 'react';
import type { TabProps } from '@patternfly/react-core';
import { UserSettingsActions } from 'actions/UserSettingsActions';
import { location, router, URLParam } from 'app/History';
import { useKialiDispatch } from 'hooks/redux';
import type { BoundsInMilliseconds } from 'types/Common';

type CustomTimeTab = {
  name: string;
  title: React.ReactNode;
};

type CustomTimeTabs = {
  onSelect: (name: string, range: Required<BoundsInMilliseconds>) => void;
  tabs: CustomTimeTab[];
};

export const CustomTimeTabsContext = React.createContext<CustomTimeTabs>({ onSelect: () => {}, tabs: [] });

type CustomTimeTabsProviderProps = {
  children: React.ReactElement;
  names: string[];
  onSelect: (name: string) => void;
  tabMap: Record<string, number>;
  tabName: string;
  tabs: React.ReactNode;
};

export const CustomTimeTabsProvider: React.FC<CustomTimeTabsProviderProps> = props => {
  const dispatch = useKialiDispatch();
  const tabs: CustomTimeTab[] = [];

  // A tab map can contain entries for tabs that are not rendered for this resource.
  const renderedTabs = Array.isArray(props.tabs) ? props.tabs : [props.tabs];
  renderedTabs.forEach(child => {
    if (
      !React.isValidElement<TabProps>(child) ||
      child.props.href ||
      child.props.isDisabled ||
      child.props.isAriaDisabled ||
      child.props.isHidden
    ) {
      return;
    }
    const name = props.names.find(name => props.tabMap[name] === child.props.eventKey);
    if (name) {
      tabs.push({ name, title: child.props.title });
    }
  });

  const handleSelect = (name: string, range: Required<BoundsInMilliseconds>): void => {
    if (!tabs.some(tab => tab.name === name)) {
      return;
    }
    const params = new URLSearchParams(location.getSearch());
    params.set(props.tabName, name);
    params.set(URLParam.FROM, String(range.from));
    params.set(URLParam.TO, String(range.to));
    params.delete(URLParam.RANGE_DURATION);

    // Mount the destination against the new URL and shared range, rather than stale toolbar state.
    router.navigate(`${location.getPathname()}?${params.toString()}`);
    dispatch(UserSettingsActions.setTimeRange(range));
    props.onSelect(name);
  };

  return (
    <CustomTimeTabsContext.Provider value={{ onSelect: handleSelect, tabs }}>
      {props.children}
    </CustomTimeTabsContext.Provider>
  );
};
