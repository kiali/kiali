import * as React from 'react';
import { connect } from 'react-redux';
import {
  Button,
  TextInput,
  Tooltip,
  Divider,
  Badge,
  Checkbox,
  Dropdown,
  MenuToggleElement,
  MenuToggle,
  DropdownList
} from '@patternfly/react-core';
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
import { kialiStyle } from 'styles/StyleUtils';

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

const optionBulkStyle = kialiStyle({
  marginLeft: '0.5rem',
  position: 'relative',
  top: '0.5rem'
});

const optionStyle = kialiStyle({ marginLeft: '1.0rem' });

const optionLabelStyle = kialiStyle({ marginLeft: '0.5rem' });

const headerStyle = kialiStyle({
  margin: '0.5rem',
  marginTop: 0,
  width: '300px'
});

const marginBottom = 20;

const clusterContainerStyle = kialiStyle({
  overflow: 'auto'
});

const dividerStyle = kialiStyle({
  paddingTop: '0.625rem'
});

const closeButtonStyle = kialiStyle({
  borderTopLeftRadius: 0,
  borderBottomLeftRadius: 0
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
        <span style={{ paddingRight: '0.75rem' }}>Cluster:</span>
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
      <div className={optionBulkStyle}>
        <Checkbox
          id="bulk-select-id"
          key="bulk-select-key"
          aria-label="Select all"
          isChecked={isChecked}
          onChange={() => {
            anySelected ? this.onBulkNone() : this.onBulkAll();
          }}
        ></Checkbox>
        <span className={optionLabelStyle}>Select all</span>
      </div>
    );
  }

  private getHeader() {
    const hasFilter = !!this.props.filter;

    return (
      <div className={headerStyle}>
        <span style={{ display: 'flex' }}>
          <TextInput
            aria-label="filter-cluster"
            type="text"
            name="cluster-filter"
            placeholder="Filter by Name..."
            value={this.props.filter}
            onChange={(_event, value: string) => this.onFilterChange(value)}
          />
          {hasFilter && (
            <Tooltip key="ot_clear_cluster_filter" position="top" content="Clear Filter by Name">
              <Button className={closeButtonStyle} onClick={this.clearFilter} isInline>
                <KialiIcon.Close />
              </Button>
            </Tooltip>
          )}
        </span>
        {this.getBulkSelector()}
        <Divider className={dividerStyle} />
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
          className={optionStyle}
          id={`cluster-list-item[${cluster.name}]`}
          key={`cluster-list-item[${cluster.name}]`}
        >
          <input
            type="checkbox"
            value={cluster.name}
            checked={!!selectedMap[cluster.name]}
            onChange={this.onClusterToggled}
          />
          <span className={optionLabelStyle}>{cluster.name}</span>
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

    return <div className={optionStyle}>No clusters found</div>;
  }

  render() {
    if (this.props.clusters.length > 1) {
      return (
        <Dropdown
          toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
            <MenuToggle
              ref={toggleRef}
              data-test="cluster-dropdown"
              id="cluster-selector"
              onClick={() => this.onToggle(!this.state.isOpen)}
              isExpanded={this.state.isOpen}
            >
              {this.clusterButtonText()}
            </MenuToggle>
          )}
          isOpen={this.state.isOpen}
          onOpenChange={(isOpen: boolean) => this.onToggle(isOpen)}
        >
          <DropdownList>
            {this.getHeader()}
            {this.getBody()}
          </DropdownList>
        </Dropdown>
      );
    } else {
      return null;
    }
  }

  private onToggle = (isOpen: boolean) => {
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
    return this.props.clusters.filter(cl => cl.name.toLowerCase().includes(this.props.filter.toLowerCase()));
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
