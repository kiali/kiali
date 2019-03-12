import * as React from 'react';
import { ToolbarRightContent, Button, Icon } from 'patternfly-react';

interface RightToolbarProps {
  disabled: boolean;
  onSubmit: () => void;
}

const RightToolbar = (props: RightToolbarProps) => (
  <ToolbarRightContent>
    <Button
      bsStyle={'primary'}
      bsSize={'lg'}
      style={{ fontSize: '15px' }}
      title={'Search'}
      onClick={() => props.onSubmit()}
      disabled={props.disabled}
    >
      <Icon type="pf" name="search" /> Search
    </Button>
  </ToolbarRightContent>
);
export default RightToolbar;
