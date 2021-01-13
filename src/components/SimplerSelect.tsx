import * as React from 'react';
import { Select, SelectOptionObject, SelectProps } from '@patternfly/react-core';

type Props = Omit<Omit<Omit<SelectProps, 'isExpanded'>, 'onSelect'>, 'onToggle'> & {
  onSelect?: (selection: string | SelectOptionObject) => void;
  onToggle?: (isExpanded: boolean) => void;
};

const SimplerSelect = (props: Props) => {
  const [isExpanded, setExpanded] = React.useState(false);
  return (
    <Select
      {...props}
      onToggle={isExpanded => {
        if (props.onToggle) {
          props.onToggle(isExpanded);
        }
        setExpanded(isExpanded);
      }}
      onSelect={(_, selection, isPlaceholder) => {
        setExpanded(false);
        if (!isPlaceholder && props.onSelect) {
          props.onSelect(selection);
        }
      }}
      isExpanded={isExpanded}
    >
      {props.children}
    </Select>
  );
};

export default SimplerSelect;
