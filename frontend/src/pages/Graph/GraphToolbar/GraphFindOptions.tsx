import * as React from 'react';
import { serverConfig } from 'config';
import { kialiStyle } from 'styles/StyleUtils';
import { Dropdown, DropdownItem, DropdownList, MenuToggle, MenuToggleElement } from '@patternfly/react-core';

type FindKind = 'find' | 'hide';

type GraphFindOptionsProps = {
  kind: FindKind;
  onSelect: (expression: string) => void;
};

const menuToggleStyle = kialiStyle({
  paddingRight: 0,
  $nest: {
    '& .pf-v5-c-menu-toggle__controls': {
      paddingLeft: 0
    }
  }
});

export const GraphFindOptions: React.FC<GraphFindOptionsProps> = (props: GraphFindOptionsProps) => {
  const [isOpen, setIsOpen] = React.useState<boolean>(false);
  const [options, setOptions] = React.useState<React.ReactNode[]>([]);

  React.useEffect(() => {
    setOptions(getOptionItems(props.kind));
  }, [props.kind]);

  const getOptionItems = (kind: FindKind): React.ReactFragment[] => {
    const options =
      kind === 'find'
        ? serverConfig.kialiFeatureFlags.uiDefaults.graph.findOptions
        : serverConfig.kialiFeatureFlags.uiDefaults.graph.hideOptions;
    return options.map(o => {
      return (
        <DropdownItem key={o.description} onClick={() => props.onSelect(o.expression)}>
          {o.description}
        </DropdownItem>
      );
    });
  };

  const onToggle = (isOpen: boolean) => {
    setIsOpen(isOpen);
  };

  return (
    <Dropdown
      key={`graph-${props.kind}-presets`}
      id={`graph-${props.kind}-presets`}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          className={menuToggleStyle}
          data-test={`${props.kind}-options-dropdown`}
          onClick={() => onToggle(!isOpen)}
          isExpanded={isOpen}
        />
      )}
      isOpen={isOpen}
      onOpenChange={(isOpen: boolean) => onToggle(isOpen)}
      popperProps={{ position: 'right' }}
    >
      <DropdownList>{options}</DropdownList>
    </Dropdown>
  );
};
