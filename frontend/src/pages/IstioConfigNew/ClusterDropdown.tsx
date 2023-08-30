import * as React from 'react';
import { connect } from 'react-redux';
import { style } from 'typestyle';
import { Button, TextInput, Tooltip, Divider, Badge } from '@patternfly/react-core';
import { Dropdown, DropdownToggle, DropdownToggleCheckbox } from '@patternfly/react-core/deprecated';
import { activeClustersSelector, clusterFilterSelector } from '../../store/Selectors';
import { ClusterActions } from '../../actions/ClusterAction';
import { MeshCluster } from '../../types/Mesh';
import {
  BoundingClientAwareComponent,
  PropertyType
} from '../../components/BoundingClientAwareComponent/BoundingClientAwareComponent';
import { KialiIcon } from 'config/KialiIcon';
import { KialiAppState } from '../../store/Store';
import { KialiDispatch } from '../../types/Redux';
import { serverConfig } from '../../config';

type ReduxProps = {
  activeClusters: MeshCluster[];
  clusters: MeshCluster[];
  filter: string;
  setActiveClusters: (clusters: MeshCluster[]) => void;
  setFilter: (filter: string) => void;
};

type ClusterDropdownProps = ReduxProps & {
  clearAll: () => void;
};

type ClusterDropdownState = {
  isBulkSelectorOpen: boolean;
  isOpen: boolean;
  selectedClusters: MeshCluster[];
};

const checkboxBulkStyle = style({
  marginLeft: '0.5em',
  position: 'relative',
  top: 8
});

const checkboxStyle = style({ marginLeft: '1.0em' });

const checkboxLabelStyle = style({ marginLeft: '0.5em' });

const headerStyle = style({
  margin: '0 0.5em 10px 0.5em',
  width: 300
});

const marginBottom = 20;

const clusterContainerStyle = style({
  overflow: 'auto'
});

export class ClusterDropdownComponent extends React.PureComponent<ClusterDropdownProps, ClusterDropdownState> {
  constructor(props: ClusterDropdownProps) {
    super(props);
    this.state = {
      isBulkSelectorOpen: false,
      isOpen: false,
      selectedClusters: [...this.props.activeClusters]
    };
  }

  private clusterButtonText() {
    if (this.state.selectedClusters.length === 0) {
      return <span>Select Clusters</span>;
    }

    return (
      <>
        <span style={{ paddingRight: '0.75em' }}>Cluster:</span>
        {this.state.selectedClusters.length === 1 ? (
          <span>{this.state.selectedClusters[0].name}</span>
        ) : (
          <Badge>{this.state.selectedClusters.length}</Badge>
        )}
      </>
    );
  }

  private getBulkSelector() {
    const selectedClusters = this.filteredSelected();
    const numSelected = selectedClusters.length;
    const allSelected = numSelected === this.props.clusters.length;
    const anySelected = numSelected > 0;
    const someChecked = anySelected ? null : false;
    const isChecked = allSelected ? true : someChecked;

    return (
      <div className={checkboxBulkStyle}>
        <DropdownToggleCheckbox
          id="bulk-select-id"
          key="bulk-select-key"
          aria-label="Select all"
          isChecked={isChecked}
          onClick={() => {
            anySelected ? this.onBulkNone() : this.onBulkAll();
          }}
        ></DropdownToggleCheckbox>
        <span className={checkboxLabelStyle}>Select all</span>
      </div>
    );
  }

  private getHeader() {
    const hasFilter = !!this.props.filter;
    return (
      <div className={headerStyle}>
        <span style={{ width: '100%' }}>
          <TextInput
            style={{ width: hasFilter ? 'calc(100% - 44px)' : '100%' }}
            aria-label="filter-cluster"
            type="text"
            name="cluster-filter"
            placeholder="Filter by Name..."
            value={this.props.filter}
            onChange={(_event, value: string) => this.onFilterChange(value)}
          />
          {hasFilter && (
            <Tooltip key="ot_clear_cluster_filter" position="top" content="Clear Filter by Name">
              <Button onClick={this.clearFilter} isInline>
                <KialiIcon.Close />
              </Button>
            </Tooltip>
          )}
        </span>
        {this.getBulkSelector()}
        <Divider style={{ paddingTop: '5px' }} />
      </div>
    );
  }

  private getBody() {
    if (this.props.clusters.length > 0) {
      const selectedMap = this.state.selectedClusters.reduce((map, cluster) => {
        map[cluster.name] = cluster.name;
        return map;
      }, {});
      const clusters = this.filtered().map((cluster: MeshCluster) => (
        <div
          className={checkboxStyle}
          id={`cluster-list-item[${cluster.name}]`}
          key={`cluster-list-item[${cluster.name}]`}
        >
          <input
            type="checkbox"
            value={cluster.name}
            checked={!!selectedMap[cluster.name]}
            onChange={this.onClusterToggled}
          />
          <span className={checkboxLabelStyle}>{cluster.name}</span>
        </div>
      ));

      return (
        <>
          <BoundingClientAwareComponent
            className={clusterContainerStyle}
            maxHeight={{ type: PropertyType.VIEWPORT_HEIGHT_MINUS_TOP, margin: marginBottom }}
          >
            {clusters}
          </BoundingClientAwareComponent>
        </>
      );
    }
    return <div>No clusters found</div>;
  }

  render() {
    if (this.props.clusters.length > 1) {
      return (
        <Dropdown
          toggle={
            <DropdownToggle
              data-test="cluster-dropdown"
              id="cluster-selector"
              onToggle={(_event, isOpen) => this.onToggle(isOpen)}
            >
              {this.clusterButtonText()}
            </DropdownToggle>
          }
          isOpen={this.state.isOpen}
        >
          {this.getHeader()}
          {this.getBody()}
        </Dropdown>
      );
    } else {
      return null;
    }
  }

  private onToggle = isOpen => {
    if (!isOpen) {
      this.props.setActiveClusters(this.state.selectedClusters);
      this.clearFilter();
    }
    this.setState({
      isOpen
    });
  };

  private onBulkAll = () => {
    const union = Array.from(new Set([...this.state.selectedClusters, ...this.filtered()]));
    this.setState({ selectedClusters: union });
  };

  private onBulkNone = () => {
    const filtered = this.filtered();
    const remaining = this.state.selectedClusters.filter(s => filtered.findIndex(f => f.name === s.name) < 0);
    this.setState({ selectedClusters: remaining });
  };

  onClusterToggled = event => {
    const cluster = event.target.value;
    const selectedClusters = !!this.state.selectedClusters.find(cl => cl.name === cluster)
      ? this.state.selectedClusters.filter(cl => cl.name !== cluster)
      : this.state.selectedClusters.concat(serverConfig.clusters[event.target.value]);
    this.setState({ selectedClusters: selectedClusters });
  };

  private onFilterChange = (value: string) => {
    this.props.setFilter(value);
  };

  private clearFilter = () => {
    this.props.setFilter('');
  };

  private filtered = (): MeshCluster[] => {
    return this.props.clusters.filter(cl => cl.name.includes(this.props.filter));
  };

  private filteredSelected = (): MeshCluster[] => {
    const filtered = this.filtered();
    return this.state.selectedClusters.filter(s => filtered.findIndex(f => f.name === s.name) >= 0);
  };
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    clusters: Object.values(serverConfig.clusters),
    activeClusters: activeClustersSelector(state),
    filter: clusterFilterSelector(state)
  };
};

const mapDispatchToProps = (dispatch: KialiDispatch) => {
  return {
    clearAll: () => {
      dispatch(ClusterActions.setActiveClusters([]));
    },
    setActiveClusters: (clusters: MeshCluster[]) => {
      dispatch(ClusterActions.setActiveClusters(clusters));
    },
    setFilter: (filter: string) => {
      dispatch(ClusterActions.setFilter(filter));
    }
  };
};

export const ClusterDropdown = connect(mapStateToProps, mapDispatchToProps)(ClusterDropdownComponent);
