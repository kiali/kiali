import * as React from 'react';
import {
  CardHeader,
  CardTitle,
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  MenuToggleElement
} from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { FormattedTraceInfo, fullIDStyle } from './FormattedTraceInfo';
import { history } from 'app/History';
import { KialiAppState } from '../../../store/Store';
import { connect } from 'react-redux';
import { isParentKiosk, kioskContextMenuAction } from '../../Kiosk/KioskActions';
import { KialiIcon } from 'config/KialiIcon';
import { kebabToggleStyle } from 'styles/DropdownStyles';

type ReduxProps = {
  kiosk: string;
};

type Props = ReduxProps & {
  comparisonURL?: string;
  externalURL?: string;
  formattedTrace: FormattedTraceInfo;
  graphURL: string;
};

const TracingTraceTitleComponent: React.FC<Props> = (props: Props) => {
  const [isKebabOpen, setIsKebabOpen] = React.useState(false);

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

  return (
    <CardHeader
      actions={{
        actions: (
          <>
            <span>
              {`${props.formattedTrace.relativeDate()} | ${props.formattedTrace.absTime()} (${props.formattedTrace.fromNow()})`}
            </span>
            <Dropdown
              toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                <MenuToggle
                  data-test="trace-details-kebab"
                  ref={toggleRef}
                  className={kebabToggleStyle}
                  aria-label="Actions"
                  variant="plain"
                  onClick={() => setIsKebabOpen(!isKebabOpen)}
                  isExpanded={isKebabOpen}
                >
                  <KialiIcon.KebabToggle />
                </MenuToggle>
              )}
              isOpen={isKebabOpen}
              data-test="trace-details-dropdown"
              onOpenChange={(isOpen: boolean) => setIsKebabOpen(isOpen)}
              popperProps={{ position: 'right' }}
            >
              <DropdownList>{links}</DropdownList>
            </Dropdown>
          </>
        ),
        hasNoOffset: false,
        className: undefined
      }}
    >
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

export const TracingTraceTitle = connect(mapStateToProps)(TracingTraceTitleComponent);
