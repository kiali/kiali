import * as React from 'react';
import { CardActions, CardHeader, CardTitle, Dropdown, DropdownItem, KebabToggle } from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { FormattedTraceInfo, fullIDStyle } from './FormattedTraceInfo';
import history from 'app/History';
import { KialiAppState } from '../../../store/Store';
import { connect } from 'react-redux';
import { isParentKiosk, kioskContextMenuAction } from '../../Kiosk/KioskActions';

type ReduxProps = {
  kiosk: string;
};

type Props = ReduxProps & {
  formattedTrace: FormattedTraceInfo;
  externalURL?: string;
  graphURL: string;
  comparisonURL?: string;
};

const JaegerTraceTitle = (props: Props) => {
  const links = [
    <DropdownItem
      key="view_on_graph"
      onClick={() => {
        if (isParentKiosk(props.kiosk)) {
          kioskContextMenuAction(props.graphURL);
        } else {
          history.push(props.graphURL);
        }
      }}
    >
      View on Graph
    </DropdownItem>
  ];
  if (props.externalURL) {
    links.push(
      <DropdownItem key="view_in_tracing" onClick={() => window.open(props.externalURL, '_blank')}>
        View in Tracing <ExternalLinkAltIcon />
      </DropdownItem>
    );
  }
  if (props.comparisonURL) {
    links.push(
      <DropdownItem key="compare_with_similar_traces" onClick={() => window.open(props.comparisonURL, '_blank')}>
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

const mapStateToProps = (state: KialiAppState) => {
  return {
    kiosk: state.globalState.kiosk
  };
};

const JaegerTraceTitleContainer = connect(mapStateToProps)(JaegerTraceTitle);
export default JaegerTraceTitleContainer;
