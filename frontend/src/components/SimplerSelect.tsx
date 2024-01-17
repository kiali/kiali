import * as React from 'react';
import { MenuToggle, MenuToggleElement, Select, SelectProps } from '@patternfly/react-core';

type SimplerSelectProps = Omit<Omit<Omit<Omit<SelectProps, 'isOpen'>, 'onSelect'>, 'onOpenChange'>, 'toggle'> & {
  onOpenChange?: (isOpen: boolean) => void;
  onSelect?: (value?: string | number) => void;
};

export const SimplerSelect: React.FC<SimplerSelectProps> = (props: SimplerSelectProps) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle ref={toggleRef} onClick={() => setIsOpen(!isOpen)} isExpanded={isOpen}>
      {props.selected}
    </MenuToggle>
  );

  return (
    <Select
      {...props}
      toggle={toggle}
      onOpenChange={isOpen => {
        setIsOpen(isOpen);

        if (props.onOpenChange) {
          props.onOpenChange(isOpen);
        }
      }}
      onSelect={(_event?: React.MouseEvent<Element, MouseEvent>, value?: string | number) => {
        setIsOpen(false);
        if (props.onSelect) {
          props.onSelect(value);
        }
      }}
      isOpen={isOpen}
    >
      {props.children}
    </Select>
  );
};
