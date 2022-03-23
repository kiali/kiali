import * as React from 'react';
import { CardHeader, Dropdown, DropdownItem, KebabToggle, Text, TextVariants } from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';

import { FormattedTraceInfo, fullIDStyle } from './FormattedTraceInfo';
import history from 'app/History';

interface Props {
  formattedTrace: FormattedTraceInfo;
  externalURL?: string;
  graphURL: string;
  comparisonURL?: string;
}

export const JaegerTraceTitle = (props: Props) => {
  const links = [<DropdownItem onClick={() => history.push(props.graphURL)}>View on Graph</DropdownItem>];
  if (props.externalURL) {
    links.push(
      <DropdownItem onClick={() => window.open(props.externalURL, '_blank')}>
        View in Tracing <ExternalLinkAltIcon />
      </DropdownItem>
    );
  }
  if (props.comparisonURL) {
    links.push(
      <DropdownItem onClick={() => window.open(props.comparisonURL, '_blank')}>
        Compare with similar traces <ExternalLinkAltIcon />
      </DropdownItem>
    );
  }
  const [toggled, setToggled] = React.useState(false);
  return (
    <CardHeader>
      <Text component={TextVariants.h3} style={{ margin: 0, position: 'relative' }}>
        {props.formattedTrace.name()}
        <span className={fullIDStyle}>{props.formattedTrace.fullID()}</span>
        <span style={{ float: 'right', position: 'relative', top: -9 }}>
          {props.formattedTrace.relativeDate()}
          <span style={{ padding: '0 10px 0 10px' }}>|</span>
          {props.formattedTrace.absTime()} ({props.formattedTrace.fromNow()})
          <Dropdown
            toggle={<KebabToggle onToggle={() => setToggled(!toggled)} />}
            dropdownItems={links}
            isPlain={true}
            isOpen={toggled}
            position={'right'}
            style={{ top: 3 }}
          />
        </span>
      </Text>
    </CardHeader>
  );
};
