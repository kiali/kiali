import * as React from 'react';
import { Select, SelectOptionObject, SelectProps } from '@patternfly/react-core';

type Props = Omit<Omit<Omit<SelectProps, 'isOpen'>, 'onSelect'>, 'onToggle'> & {
  onSelect?: (selection: string | SelectOptionObject) => void;
  onToggle?: (isOpen: boolean) => void;
};

const SimplerSelect = (props: Props) => {
  const [isOpen, setExpanded] = React.useState(false);
  return (
    <Select
      {...props}
      onToggle={isOpen => {
        if (props.onToggle) {
          props.onToggle(isOpen);
        }
        setExpanded(isOpen);
      }}
      onSelect={(_, selection, isPlaceholder) => {
        setExpanded(false);
        if (!isPlaceholder && props.onSelect) {
          props.onSelect(selection);
        }
      }}
      isOpen={isOpen}
    >
      {props.children}
    </Select>
  );
};

export default SimplerSelect;
