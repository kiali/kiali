import * as React from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import FlexView from 'react-flexview';
import { kialiStyle } from 'styles/StyleUtils';
import { IntervalInMilliseconds, TimeInMilliseconds, TimeInSeconds } from '../../types/Common';
import { Layout } from '../../types/Graph';
import * as AlertUtils from '../../utils/AlertUtils';
import { ErrorBoundary } from '../../components/ErrorBoundary/ErrorBoundary';
import { meshFindValueSelector, meshHideValueSelector, refreshIntervalSelector } from '../../store/Selectors';
import { KialiAppState } from '../../store/Store';
import { PFColors } from 'components/Pf/PfColors';
import { TourActions } from 'actions/TourActions';
import { isKioskMode, getFocusSelector } from 'utils/SearchParamUtils';
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
import { FocusNode, Mesh } from './Mesh';
import { MeshActions } from 'actions/MeshActions';
import { MeshLegend } from './MeshLegend';
import { MeshToolbarActions } from 'actions/MeshToolbarActions';
import { MeshToolbar } from './toolbar/MeshToolbar';
import { TargetPanel } from './target/TargetPanel';
import { MeshTour } from './MeshHelpTour';
import { MeshThunkActions } from 'actions/MeshThunkActions';

type ReduxProps = {
  activeTour?: TourInfo;
  endTour: () => void;
  findValue: string;
  hideValue: string;
  istioAPIEnabled: boolean;
  isPageVisible: boolean;
  kiosk: string;
  layout: Layout;
  mtlsEnabled: boolean;
  onReady: (controller: Controller) => void;
  refreshInterval: IntervalInMilliseconds;
  setDefinition: (meshDefinition: MeshDefinition) => void;
  setLayout: (layout: Layout) => void;
  setTarget: (target: MeshTarget) => void;
  setUpdateTime: (val: TimeInMilliseconds) => void;
  showLegend: boolean;
  showOutOfMesh: boolean;
  startTour: ({ info, stop }) => void;
  target: MeshTarget | null;
  toggleLegend: () => void;
};

export type MeshPageProps = ReduxProps & {
  lastRefreshAt: TimeInMilliseconds; // redux by way of ConnectRefresh
};

export type MeshData = {
  elements: DecoratedMeshElements;
  elementsChanged: boolean; // true if current elements differ from previous fetch, can be used as an optimization.
  errorMessage?: string;
  fetchParams: MeshFetchParams;
  isLoading: boolean;
  isError?: boolean;
  timestamp: TimeInMilliseconds;
};

type MeshPageState = {
  meshData: MeshData;
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

const meshLegendStyle = kialiStyle({
  right: '0',
  bottom: '10px',
  position: 'absolute',
  overflow: 'hidden'
});

const MeshErrorBoundaryFallback = () => {
  return (
    <div className={meshContainerStyle}>
      <EmptyMeshLayout isError={true} isMiniMesh={false} />
    </div>
  );
};

class MeshPageComponent extends React.Component<MeshPageProps, MeshPageState> {
  private controller?: Controller;
  private readonly errorBoundaryRef: any;
  private focusNode?: FocusNode;
  private meshDataSource: MeshDataSource;

  constructor(props: MeshPageProps) {
    super(props);
    this.controller = undefined;
    this.errorBoundaryRef = React.createRef();
    const focusNodeId = getFocusSelector();
    this.focusNode = focusNodeId ? { id: focusNodeId, isSelected: true } : undefined;
    this.meshDataSource = new MeshDataSource();

    this.state = {
      meshData: {
        elements: { edges: [], nodes: [] },
        elementsChanged: false,
        fetchParams: this.meshDataSource.fetchParameters,
        isLoading: true,
        timestamp: 0
      }
    };
  }

  componentDidMount() {
    // Connect to mesh data source updates
    this.meshDataSource.on('loadStart', this.handleMeshDataSourceStart);
    this.meshDataSource.on('fetchError', this.handleMeshDataSourceError);
    this.meshDataSource.on('fetchSuccess', this.handleMeshDataSourceSuccess);
  }

  componentDidUpdate(prev: MeshPageProps) {
    const curr = this.props;

    // Ensure we initialize the mesh. We wait for the first update so that
    // the toolbar can render and ensure all redux props are updated with URL
    // settings. That in turn ensures the initial fetchParams are correct.
    const isInitialLoad = !this.state.meshData.timestamp;
    console.log(`mesh isInitialLoad=${isInitialLoad}`);

    if (curr.target?.type === 'mesh') {
      this.controller = curr.target.elem as Controller;
    }

    if (
      isInitialLoad ||
      (prev.findValue !== curr.findValue && curr.findValue.includes('label:')) ||
      (prev.hideValue !== curr.hideValue && curr.hideValue.includes('label:')) ||
      prev.lastRefreshAt !== curr.lastRefreshAt
    ) {
      console.log(
        `componentDidUpdate: ${isInitialLoad} ${this.state.meshData.timestamp} ${prev.lastRefreshAt} ${curr.lastRefreshAt}`
      );
      this.loadMeshFromBackend();
    }

    if (prev.layout.name !== curr.layout.name) {
      this.errorBoundaryRef.current.cleanError();
    }

    if (curr.showLegend && this.props.activeTour) {
      this.props.endTour();
    }
  }

  componentWillUnmount() {
    // Disconnect from mesh data source updates
    this.meshDataSource.removeListener('loadStart', this.handleMeshDataSourceStart);
    this.meshDataSource.removeListener('fetchError', this.handleMeshDataSourceError);
    this.meshDataSource.removeListener('fetchSuccess', this.handleMeshDataSourceSuccess);
  }

  render() {
    const conStyle = isKioskMode() ? kioskContainerStyle : containerStyle;
    const isEmpty = !(this.state.meshData.elements.nodes && Object.keys(this.state.meshData.elements.nodes).length > 0);
    const isReady = !(isEmpty || this.state.meshData.isError);

    return (
      <>
        <FlexView className={conStyle} column={true}>
          <div>
            <MeshToolbar
              controller={this.controller!}
              disabled={this.state.meshData.isLoading}
              elementsChanged={this.state.meshData.elementsChanged}
              onToggleHelp={this.toggleHelp}
            />
          </div>
          <FlexView grow={true} className={`${meshWrapperDivStyle}`}>
            <ErrorBoundary
              ref={this.errorBoundaryRef}
              onError={this.notifyError}
              fallBackComponent={<MeshErrorBoundaryFallback />}
            >
              {this.props.showLegend && (
                <MeshLegend className={meshLegendStyle} closeLegend={this.props.toggleLegend} />
              )}
              {isReady && (
                <Chip className={`${meshChip} ${meshBackground}`} isReadOnly={true}>
                  {`TODO: ${'Mesh Name Here'}`}
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
                  <Mesh focusNode={this.focusNode} meshData={this.state.meshData} isMiniMesh={false} {...this.props} />
                </EmptyMeshLayout>
              </div>
            </ErrorBoundary>
            {this.props.target && (
              <TargetPanel
                isPageVisible={this.props.isPageVisible}
                istioAPIEnabled={this.props.istioAPIEnabled}
                onFocus={this.onFocus}
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

  // TODO Focus...
  private onFocus = (focusNode: FocusNode) => {
    console.debug(`onFocus(${focusNode})`);
  };

  private handleEmptyMeshAction = () => {
    this.loadMeshFromBackend();
  };

  private handleMeshDataSourceSuccess = (
    meshTimestamp: TimeInSeconds,
    elements: DecoratedMeshElements,
    fetchParams: MeshFetchParams
  ) => {
    const prevElements = this.state.meshData.elements;
    this.setState({
      meshData: {
        elements: elements,
        elementsChanged: this.elementsChanged(prevElements, elements),
        fetchParams: fetchParams,
        isLoading: false,
        timestamp: meshTimestamp * 1000
      }
    });
    this.props.setDefinition(this.meshDataSource.meshDefinition);
  };

  private handleMeshDataSourceError = (errorMessage: string | null, fetchParams: MeshFetchParams) => {
    const prevElements = this.state.meshData.elements;
    this.setState({
      meshData: {
        elements: EMPTY_MESH_DATA,
        elementsChanged: this.elementsChanged(prevElements, EMPTY_MESH_DATA),
        errorMessage: !!errorMessage ? errorMessage : undefined,
        isError: true,
        isLoading: false,
        fetchParams: fetchParams,
        timestamp: Date.now()
      }
    });
  };

  private handleMeshDataSourceStart = (isPreviousDataInvalid: boolean, fetchParams: MeshFetchParams) => {
    this.setState({
      meshData: {
        elements: isPreviousDataInvalid ? EMPTY_MESH_DATA : this.state.meshData.elements,
        elementsChanged: false,
        fetchParams: fetchParams,
        isLoading: true,
        timestamp: isPreviousDataInvalid ? Date.now() : this.state.meshData.timestamp
      }
    });
  };

  private toggleHelp = () => {
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

  private loadMeshFromBackend = () => {
    this.meshDataSource.fetchMeshData({
      includeHealth: true,
      includeLabels: this.props.findValue.includes('label:') || this.props.hideValue.includes('label:')
    });
  };

  private notifyError = (error: Error, _componentStack: string) => {
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

    return !(
      this.nodeOrEdgeArrayHasSameIds(nextElements.nodes, prevElements.nodes) &&
      this.nodeOrEdgeArrayHasSameIds(nextElements.edges, prevElements.edges)
    );
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
}

const mapStateToProps = (state: KialiAppState) => ({
  activeTour: state.tourState.activeTour,
  findValue: meshFindValueSelector(state),
  hideValue: meshHideValueSelector(state),
  istioAPIEnabled: state.statusState.istioEnvironment.istioAPIEnabled,
  isPageVisible: state.globalState.isPageVisible,
  kiosk: state.globalState.kiosk,
  layout: state.mesh.layout,
  refreshInterval: refreshIntervalSelector(state),
  showLegend: state.mesh.toolbarState.showLegend,
  target: state.mesh.target
});

const mapDispatchToProps = (dispatch: KialiDispatch) => ({
  endTour: bindActionCreators(TourActions.endTour, dispatch),
  onReady: (controller: any) => dispatch(MeshThunkActions.meshReady(controller)),
  setDefinition: bindActionCreators(MeshActions.setDefinition, dispatch),
  setLayout: bindActionCreators(MeshActions.setLayout, dispatch),
  setTarget: bindActionCreators(MeshActions.setTarget, dispatch),
  setUpdateTime: bindActionCreators(MeshActions.setUpdateTime, dispatch),
  startTour: bindActionCreators(TourActions.startTour, dispatch),
  toggleMeshLegend: bindActionCreators(MeshToolbarActions.toggleLegend, dispatch)
});

export const MeshPage = connectRefresh(connect(mapStateToProps, mapDispatchToProps)(MeshPageComponent));
