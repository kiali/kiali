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
import { KialiAppState } from '../../../store/Store';
import { connect } from 'react-redux';
import { isParentKiosk, kioskContextMenuAction } from '../../Kiosk/KioskActions';
import { KialiIcon } from 'config/KialiIcon';
import { kebabToggleStyle } from 'styles/DropdownStyles';
import { useKialiTranslation } from 'utils/I18nUtils';
import { useNavigate } from 'react-router-dom-v5-compat';

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

  const { t } = useKialiTranslation();
  const navigate = useNavigate();

  const links = [
    <DropdownItem
      key="view_on_graph"
      onClick={() => {
        if (isParentKiosk(props.kiosk)) {
          kioskContextMenuAction(props.graphURL);
        } else {
          navigate(props.graphURL);
        }
      }}
    >
      {t('View on Graph')}
    </DropdownItem>
  ];

  if (props.externalURL) {
    links.push(
      <DropdownItem key="view_in_tracing" onClick={() => window.open(props.externalURL, '_blank')}>
        {t('View in Tracing')} <ExternalLinkAltIcon />
      </DropdownItem>
    );
  }

  if (props.comparisonURL) {
    links.push(
      <DropdownItem key="compare_with_similar_traces" onClick={() => window.open(props.comparisonURL, '_blank')}>
        {t('Compare with similar traces')} <ExternalLinkAltIcon />
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
                  aria-label={t('Actions')}
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

const mapStateToProps = (state: KialiAppState): ReduxProps => {
  return {
    kiosk: state.globalState.kiosk
  };
};

export const TracingTraceTitle = connect(mapStateToProps)(TracingTraceTitleComponent);
