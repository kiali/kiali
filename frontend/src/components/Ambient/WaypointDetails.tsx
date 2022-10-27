import * as React from 'react';
import { connect } from 'react-redux';
import { KialiAppState } from 'store/Store';
import { namespaceItemsSelector } from 'store/Selectors';
import { ISortBy } from '@patternfly/react-table';
import Namespace from 'types/Namespace';
import { RenderComponentScroll } from 'components/Nav/Page';
import {TimeInMilliseconds} from "../../types/Common";
import {Workload} from "../../types/Workload";

// Enables the search box for the ACEeditor
require('ace-builds/src-noconflict/ext-searchbox');



export type ResourceSorts = { [resource: string]: ISortBy };

type ReduxProps = {
  kiosk: string;
  namespaces: Namespace[];
};

type WaypointDetailsProps = ReduxProps & {
  lastRefreshAt: TimeInMilliseconds;
  namespace: string;
  workload: Workload;
};

class WaypointDetails extends React.Component<WaypointDetailsProps> {
  

  render() {

    return (
      <RenderComponentScroll onResize={height => this.setState({ tabHeight: height })}>
      </RenderComponentScroll>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  kiosk: state.globalState.kiosk,
  namespaces: namespaceItemsSelector(state)!
});

const WaypointDetailsContainer = connect(mapStateToProps)(WaypointDetails);

export default WaypointDetailsContainer;
