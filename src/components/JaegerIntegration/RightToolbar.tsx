import * as React from 'react';
import { Button } from '@patternfly/react-core';
import { SearchIcon } from '@patternfly/react-icons';

interface RightToolbarProps {
  disabled: boolean;
  onSubmit: () => void;
}

const RightToolbar = (props: RightToolbarProps) => (
  <Button variant="primary" aria-label="SearchTraces" onClick={() => props.onSubmit()} isDisabled={props.disabled}>
    <SearchIcon /> Search Traces
  </Button>
);
export default RightToolbar;
