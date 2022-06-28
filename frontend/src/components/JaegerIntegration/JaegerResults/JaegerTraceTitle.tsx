import * as React from 'react';
import {
  CardActions,
  CardHeader,
  CardTitle,
  Dropdown,
  DropdownItem,
  KebabToggle,
} from '@patternfly/react-core';
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
      <CardActions>
        <span>
          {`${props.formattedTrace.relativeDate()} | ${props.formattedTrace.absTime()} (${props.formattedTrace.fromNow()})`}
        </span>
        <Dropdown
          toggle={<KebabToggle onToggle={() => setToggled(!toggled)} />}
          data-test="trace-details-kebab"
          dropdownItems={links}
          isPlain={true}
          isOpen={toggled}
          position={'right'}
          style={{ top: 3 }}
        />
      </CardActions>
      <CardTitle>
        <span>{`${props.formattedTrace.name()} `}</span>
        <span className={fullIDStyle}>{props.formattedTrace.fullID()}</span>
      </CardTitle>
    </CardHeader>
  );
};
