import * as React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import FlexView from 'react-flexview';
import { kialiStyle } from 'styles/StyleUtils';
import { DurationInSeconds, IntervalInMilliseconds, TimeInMilliseconds, TimeInSeconds } from '../../types/Common';
import { UNKNOWN } from '../../types/Graph';
import * as AlertUtils from '../../utils/AlertUtils';
import { ErrorBoundary } from '../../components/ErrorBoundary/ErrorBoundary';
import {
  durationSelector,
  meshFindValueSelector,
  meshHideValueSelector,
  meshWideMTLSEnabledSelector,
  refreshIntervalSelector
} from '../../store/Selectors';
import { KialiAppState } from '../../store/Store';
import { PFColors } from 'components/Pf/PfColors';
import { TourActions } from 'actions/TourActions';
import { isKioskMode } from 'utils/SearchParamUtils';
import { Chip } from '@patternfly/react-core';
import { EMPTY_MESH_DATA, MeshDataSource, MeshFetchParams } from '../../services/MeshDataSource';
import { KialiDispatch } from 'types/Redux';
import { getNextTourStop, TourInfo } from 'components/Tour/TourStop';
import { connectRefresh } from '../../components/Refresh/connectRefresh';
import { Controller } from '@patternfly/react-topology';
import { EmptyMeshLayout } from './EmptyMeshLayout';
import {
  DecoratedMeshEdgeWrapper,
  DecoratedMeshElements,
  DecoratedMeshNodeWrapper,
  MeshDefinition,
  MeshTarget
} from 'types/Mesh';
import { Mesh } from './Mesh';
import { MeshActions } from 'actions/MeshActions';
import { MeshLegend } from './MeshLegend';
import { MeshToolbarActions } from 'actions/MeshToolbarActions';
import { MeshToolbar } from './toolbar/MeshToolbar';
import { TargetPanel } from './target/TargetPanel';
import { MeshTour } from './MeshHelpTour';
import { MeshThunkActions } from 'actions/MeshThunkActions';
import { toRangeString } from 'components/Time/Utils';
import { HistoryManager, URLParam } from 'app/History';
import { getValidMeshLayout, MeshLayout } from './layouts/layoutFactory';

type ReduxStateProps = {
  activeTour?: TourInfo;
  duration: DurationInSeconds;
  findValue: string;
  hideValue: string;
  isPageVisible: boolean;
  istioAPIEnabled: boolean;
  kiosk: string;
  layout: MeshLayout;
  mtlsEnabled: boolean;
  refreshInterval: IntervalInMilliseconds;
  showGateways: boolean;
  showLegend: boolean;
  showWaypoints: boolean;
  target: MeshTarget | null;
};

type ReduxDispatchProps = {
  endTour: () => void;
  onReady: (controller: Controller) => void;
  setDefinition: (meshDefinition: MeshDefinition) => void;
  setLayout: (layout: MeshLayout) => void;
  setTarget: (target: MeshTarget) => void;
  setUpdateTime: (val: TimeInMilliseconds) => void;
  startTour: ({ info, stop }) => void;
  toggleLegend: () => void;
};

type MeshPageProps = ReduxStateProps &
  ReduxDispatchProps & {
    lastRefreshAt: TimeInMilliseconds; // redux by way of ConnectRefresh
  };

export type MeshData = {
  elements: DecoratedMeshElements;
  elementsChanged: boolean; // true if current elements differ from previous fetch, can be used as an optimization.
  errorMessage?: string;
  fetchParams: MeshFetchParams;
  isError?: boolean;
  isLoading: boolean;
  name: string;
  timestamp: TimeInMilliseconds;
};

// MeshRefs are passed back from the graph when it is ready, to allow for
// other components, or test code, to manipulate the graph programatically.
export type MeshRefs = {
  getController: () => Controller;
  setSelectedIds: (values: string[]) => void;
};

type MeshPageState = {
  isReady: boolean;
  meshData: MeshData;
  meshRefs?: MeshRefs;
};

const containerStyle = kialiStyle({
  minHeight: '350px',
  // TODO: try flexbox to remove this calc
  height: 'calc(100vh - 113px)' // View height minus top bar height minus secondary masthead
});

const kioskContainerStyle = kialiStyle({
  minHeight: '350px',
  height: 'calc(100vh - 10px)' // View height minus top bar height
});

const meshChip = kialiStyle({
  position: 'absolute',
  top: '10px',
  left: '10px',
  width: 'auto',
  zIndex: 2
});

const meshContainerStyle = kialiStyle({ flex: '1', minWidth: '350px', zIndex: 0, paddingRight: '5px' });
const meshWrapperDivStyle = kialiStyle({ position: 'relative', backgroundColor: PFColors.BackgroundColor200 });

const meshBackground = kialiStyle({
  backgroundColor: PFColors.BackgroundColor100
});

const MeshErrorBoundaryFallback = (): JSX.Element => {
  return (
    <div className={meshContainerStyle}>
      <EmptyMeshLayout isError={true} isMiniMesh={false} />
    </div>
  );
};

class MeshPageComponent extends React.Component<MeshPageProps, MeshPageState> {
  private readonly errorBoundaryRef: any;
  private meshDataSource: MeshDataSource;

  constructor(props: MeshPageProps) {
    super(props);
    this.errorBoundaryRef = React.createRef();
    this.meshDataSource = new MeshDataSource();

    this.state = {
      isReady: false,
      meshData: {
        elements: { edges: [], nodes: [] },
        elementsChanged: false,
        fetchParams: this.meshDataSource.fetchParameters,
        isLoading: true,
        name: UNKNOWN,
        timestamp: 0
      }
    };
  }

  componentDidMount(): void {
    // Let URL override current redux state at mount time. Update URL with unset params.
    const urlLayout = HistoryManager.getParam(URLParam.MESH_LAYOUT);

    if (urlLayout) {
      const validLayout = getValidMeshLayout(urlLayout);
      if (validLayout !== this.props.layout) {
        this.props.setLayout(validLayout);
        HistoryManager.setParam(URLParam.MESH_LAYOUT, validLayout);
      }
    } else {
      HistoryManager.setParam(URLParam.MESH_LAYOUT, this.props.layout);
    }

    // Connect to mesh data source updates
    this.meshDataSource.on('loadStart', this.handleMeshDataSourceStart);
    this.meshDataSource.on('fetchError', this.handleMeshDataSourceError);
    this.meshDataSource.on('fetchSuccess', this.handleMeshDataSourceSuccess);

    // Ensure we initialize the mesh. We wait for the toolbar to render
    // and ensure all redux props are updated with URL settings.
    // That in turn ensures the initial fetchParams are correct.
    setTimeout(() => this.loadMeshFromBackend(), 0);
  }

  componentDidUpdate(prev: MeshPageProps): void {
    const curr = this.props;

    if (
      prev.duration !== curr.duration ||
      (prev.findValue !== curr.findValue && curr.findValue.includes('label:')) ||
      (prev.hideValue !== curr.hideValue && curr.hideValue.includes('label:')) ||
      prev.lastRefreshAt !== curr.lastRefreshAt ||
      prev.showGateways !== curr.showGateways ||
      prev.showWaypoints !== curr.showWaypoints
    ) {
      this.loadMeshFromBackend();
    }

    if (prev.layout !== curr.layout) {
      this.errorBoundaryRef.current.cleanError();
    }

    if (curr.showLegend && this.props.activeTour) {
      this.props.endTour();
    }
  }

  componentWillUnmount(): void {
    // Disconnect from mesh data source updates
    this.meshDataSource.removeListener('loadStart', this.handleMeshDataSourceStart);
    this.meshDataSource.removeListener('fetchError', this.handleMeshDataSourceError);
    this.meshDataSource.removeListener('fetchSuccess', this.handleMeshDataSourceSuccess);
  }

  render(): React.ReactNode {
    const conStyle = isKioskMode() ? kioskContainerStyle : containerStyle;
    const isEmpty = !(this.state.meshData.elements.nodes && Object.keys(this.state.meshData.elements.nodes).length > 0);
    const isReady = !(isEmpty || this.state.meshData.isError);

    return (
      <>
        <FlexView className={conStyle} column={true}>
          <MeshToolbar
            controller={this.state.meshRefs?.getController()}
            disabled={this.state.meshData.isLoading}
            elementsChanged={this.state.meshData.elementsChanged}
            onToggleHelp={this.toggleHelp}
          />
          <FlexView grow={true} className={`${meshWrapperDivStyle}`}>
            <ErrorBoundary
              ref={this.errorBoundaryRef}
              onError={this.notifyError}
              fallBackComponent={<MeshErrorBoundaryFallback />}
            >
              {this.props.showLegend && <MeshLegend closeLegend={this.props.toggleLegend} />}

              {isReady && (
                <Chip className={`${meshChip} ${meshBackground}`} isReadOnly={true}>
                  {this.displayTimeRange()}
                </Chip>
              )}

              <div id="mesh-container" className={meshContainerStyle}>
                <EmptyMeshLayout
                  action={this.handleEmptyMeshAction}
                  elements={this.state.meshData.elements}
                  error={this.state.meshData.errorMessage}
                  isError={!!this.state.meshData.isError}
                  isLoading={this.state.meshData.isLoading}
                  isMiniMesh={false}
                >
                  <Mesh {...this.props} isMiniMesh={false} meshData={this.state.meshData} onReady={this.handleReady} />
                </EmptyMeshLayout>
              </div>
            </ErrorBoundary>

            {this.props.target && (
              <TargetPanel
                duration={this.props.duration}
                isPageVisible={this.props.isPageVisible}
                istioAPIEnabled={this.props.istioAPIEnabled}
                refreshInterval={this.props.refreshInterval}
                target={this.props.target}
                updateTime={this.state.meshData.timestamp / 1000}
              />
            )}
          </FlexView>
        </FlexView>
      </>
    );
  }

  private handleReady = (refs: MeshRefs): void => {
    this.setState({ isReady: true, meshRefs: refs });
  };

  private handleEmptyMeshAction = (): void => {
    this.loadMeshFromBackend();
  };

  private handleMeshDataSourceSuccess = (
    meshName: string,
    meshTimestamp: TimeInSeconds,
    elements: DecoratedMeshElements,
    fetchParams: MeshFetchParams
  ): void => {
    const prevElements = this.state.meshData.elements;
    const elementsChanged = this.elementsChanged(prevElements, elements);
    this.setState({
      meshData: {
        elements: elements,
        elementsChanged: elementsChanged,
        fetchParams: fetchParams,
        isLoading: false,
        name: meshName,
        timestamp: meshTimestamp * 1000
      }
    });

    this.props.setDefinition(this.meshDataSource.meshDefinition);
  };

  private handleMeshDataSourceError = (errorMessage: string | null, fetchParams: MeshFetchParams): void => {
    const prevElements = this.state.meshData.elements;

    this.setState({
      meshData: {
        elements: EMPTY_MESH_DATA,
        elementsChanged: this.elementsChanged(prevElements, EMPTY_MESH_DATA),
        errorMessage: !!errorMessage ? errorMessage : undefined,
        isError: true,
        isLoading: false,
        fetchParams: fetchParams,
        name: UNKNOWN,
        timestamp: Date.now()
      }
    });
  };

  private handleMeshDataSourceStart = (isPreviousDataInvalid: boolean, fetchParams: MeshFetchParams): void => {
    this.setState({
      meshData: {
        elements: isPreviousDataInvalid ? EMPTY_MESH_DATA : this.state.meshData.elements,
        elementsChanged: false,
        fetchParams: fetchParams,
        isLoading: true,
        name: isPreviousDataInvalid ? UNKNOWN : this.state.meshData.name,
        timestamp: isPreviousDataInvalid ? Date.now() : this.state.meshData.timestamp
      }
    });
  };

  private toggleHelp = (): void => {
    if (this.props.showLegend) {
      this.props.toggleLegend();
    }

    if (this.props.activeTour) {
      this.props.endTour();
    } else {
      const firstStop = getNextTourStop(MeshTour, -1, 'forward');
      this.props.startTour({ info: MeshTour, stop: firstStop });
    }
  };

  private loadMeshFromBackend = (): void => {
    if (!this.meshDataSource.isLoading) {
      this.meshDataSource.fetchMeshData({
        includeLabels: this.props.findValue.includes('label:') || this.props.hideValue.includes('label:'),
        showGateways: this.props.showGateways,
        showWaypoints: this.props.showWaypoints
      });
    }
  };

  private notifyError = (error: Error, _componentStack: string): void => {
    AlertUtils.add(`There was an error when rendering the mesh: ${error.message}, please try a different layout`);
  };

  // It is common that when updating the mesh that the element topology (nodes, edges) remain the same,
  // When the topology remains the same we may be able to optimize
  // some behavior.  This returns true if the topology changes, false otherwise.
  // 1) Quickly compare the number of nodes and edges, if different return true.
  // 2) Compare the ids
  private elementsChanged = (prevElements: DecoratedMeshElements, nextElements: DecoratedMeshElements): boolean => {
    if (prevElements === nextElements) {
      return false;
    }

    if (
      !prevElements ||
      !nextElements ||
      !prevElements.nodes ||
      !prevElements.edges ||
      !nextElements.nodes ||
      !nextElements.edges ||
      prevElements.nodes.length !== nextElements.nodes.length ||
      prevElements.edges.length !== nextElements.edges.length
    ) {
      return true;
    }

    const sameIds =
      this.nodeOrEdgeArrayHasSameIds(nextElements.nodes, prevElements.nodes) &&
      this.nodeOrEdgeArrayHasSameIds(nextElements.edges, prevElements.edges);

    return !sameIds;
  };

  private nodeOrEdgeArrayHasSameIds = <T extends DecoratedMeshNodeWrapper | DecoratedMeshEdgeWrapper>(
    a: Array<T>,
    b: Array<T>
  ): boolean => {
    const aIds = a.map(e => e.data.id).sort();
    return b
      .map(e => e.data.id)
      .sort()
      .every((eId, index) => eId === aIds[index]);
  };

  private displayTimeRange = (): string => {
    const rangeEnd: TimeInMilliseconds = this.state.meshData.timestamp;
    const rangeStart: TimeInMilliseconds = rangeEnd - this.props.duration * 1000;

    return toRangeString(rangeStart, rangeEnd, { second: '2-digit' }, { second: '2-digit' });
  };
}

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  activeTour: state.tourState.activeTour,
  duration: durationSelector(state),
  findValue: meshFindValueSelector(state),
  hideValue: meshHideValueSelector(state),
  istioAPIEnabled: state.statusState.istioEnvironment.istioAPIEnabled,
  isPageVisible: state.globalState.isPageVisible,
  kiosk: state.globalState.kiosk,
  layout: state.mesh.layout,
  mtlsEnabled: meshWideMTLSEnabledSelector(state),
  refreshInterval: refreshIntervalSelector(state),
  showGateways: state.mesh.toolbarState.showGateways,
  showLegend: state.mesh.toolbarState.showLegend,
  showWaypoints: state.mesh.toolbarState.showWaypoints,
  target: state.mesh.target
});

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => ({
  endTour: bindActionCreators(TourActions.endTour, dispatch),
  onReady: (controller: Controller) => dispatch(MeshThunkActions.meshReady(controller)),
  setDefinition: bindActionCreators(MeshActions.setDefinition, dispatch),
  setLayout: bindActionCreators(MeshActions.setLayout, dispatch),
  setTarget: bindActionCreators(MeshActions.setTarget, dispatch),
  setUpdateTime: bindActionCreators(MeshActions.setUpdateTime, dispatch),
  startTour: bindActionCreators(TourActions.startTour, dispatch),
  toggleLegend: bindActionCreators(MeshToolbarActions.toggleLegend, dispatch)
});

export const MeshPage = connectRefresh(connect(mapStateToProps, mapDispatchToProps)(MeshPageComponent));
