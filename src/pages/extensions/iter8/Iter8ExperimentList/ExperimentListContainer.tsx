import * as React from 'react';
import {
  Badge,
  Dropdown,
  DropdownItem,
  DropdownPosition,
  DropdownToggle,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Title,
  Toolbar,
  ToolbarSection,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { style } from 'typestyle';
import {
  sortable,
  Table,
  TableBody,
  TableHeader,
  ISortBy,
  IRow,
  SortByDirection,
  cellWidth
} from '@patternfly/react-table';
import * as API from '../../../../services/Api';
import * as AlertUtils from '../../../../utils/AlertUtils';
import history from '../../../../app/History';
import { Iter8Info, Iter8Experiment } from '../../../../types/Iter8';
import { Link } from 'react-router-dom';
import * as FilterComponent from '../../../../components/FilterList/FilterComponent';

import { KialiAppState } from '../../../../store/Store';
import { activeNamespacesSelector } from '../../../../store/Selectors';
import { connect } from 'react-redux';
import Namespace from '../../../../types/Namespace';
import { PromisesRegistry } from '../../../../utils/CancelablePromises';
import { namespaceEquals } from '../../../../utils/Common';
import RefreshContainer from 'components/Refresh/Refresh';

// Style constants
const rightToolbar = style({ marginLeft: 'auto' });
const containerPadding = style({ padding: '20px 20px 20px 20px' });

interface Props extends FilterComponent.Props<Iter8Experiment> {
  activeNamespaces: Namespace[];
}

// State of the component/page
// It stores the visual state of the components and the experiments fetched from the backend.
interface State extends FilterComponent.State<Iter8Experiment> {
  iter8Info: Iter8Info;
  experimentLists: Iter8Experiment[];
  sortBy: ISortBy; // ?? not used yet
  dropdownOpen: boolean;
}

const columns = [
  {
    title: 'Name',
    transforms: [sortable]
  },
  {
    title: 'Namespace',
    transforms: [sortable]
  },
  {
    title: 'Phase',
    transforms: [sortable, cellWidth(15) as any]
  },
  {
    title: 'Status',
    transforms: [sortable]
  },
  {
    title: 'Baseline',
    transforms: [sortable]
  },
  {
    title: 'Candidate',
    transforms: [sortable]
  }
];

class ExperimentListPage extends React.Component<Props, State> {
  private promises = new PromisesRegistry();

  constructor(props: Props) {
    super(props);
    this.state = {
      iter8Info: {
        enabled: false
      },
      experimentLists: [],
      sortBy: {},
      dropdownOpen: false,
      listItems: [],
      currentSortField: this.props.currentSortField,
      isSortAscending: this.props.isSortAscending
    };
  }

  fetchExperiments = (namespaces: string[]) => {
    API.getIter8Info()
      .then(result => {
        const iter8Info = result.data;
        if (iter8Info.enabled) {
          API.getExperiments(namespaces)
            .then(result => {
              this.setState(prevState => {
                return {
                  iter8Info: iter8Info,
                  experimentLists: result.data,
                  sortBy: prevState.sortBy
                };
              });
            })
            .catch(error => {
              AlertUtils.addError('Could not fetch Iter8 Experiments.', error);
            });
        } else {
          AlertUtils.addError('Kiali has Iter8 extension enabled but it is not detected in the cluster');
        }
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch Iter8 Info.', error);
      });
  };

  // It invokes backend when component is mounted
  componentDidMount() {
    this.updateListItems();
  }

  componentDidUpdate(prevProps: Props, _prevState: State, _snapshot: any) {
    const [paramsSynced] = this.paramsAreSynced(prevProps);
    if (!paramsSynced) {
      this.setState({
        currentSortField: this.props.currentSortField,
        isSortAscending: this.props.isSortAscending
      });

      this.updateListItems();
    }
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  paramsAreSynced = (prevProps: Props): [boolean, boolean] => {
    const activeNamespacesCompare = namespaceEquals(prevProps.activeNamespaces, this.props.activeNamespaces);
    const paramsSynced =
      activeNamespacesCompare &&
      prevProps.isSortAscending === this.props.isSortAscending &&
      prevProps.currentSortField.title === this.props.currentSortField.title;
    return [paramsSynced, activeNamespacesCompare];
  };

  // Helper used for Table to sort handlers based on index column == field
  onSort = (_event, index, direction) => {
    const experimentList = this.state.experimentLists.sort((a, b) => {
      switch (index) {
        case 0:
          return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
        case 1:
          return a.namespace < b.namespace ? -1 : a.namespace > b.namespace ? 1 : 0;
        case 2:
          return a.phase < b.phase ? -1 : a.phase > b.phase ? 1 : 0;
        case 3:
          return a.status < b.status ? -1 : a.status > b.status ? 1 : 0;
        case 4:
          return a.baseline < b.baseline ? -1 : a.baseline > b.baseline ? 1 : 0;
        case 5:
          return a.candidate < b.candidate ? -1 : a.candidate > b.candidate ? 1 : 0;
      }
      return 0;
    });
    this.setState({
      experimentLists: direction === SortByDirection.asc ? experimentList : experimentList.reverse(),
      sortBy: {
        index,
        direction
      }
    });
  };

  updateListItems = () => {
    this.promises.cancelAll();
    const namespacesSelected = this.props.activeNamespaces.map(item => item.name);
    if (namespacesSelected.length === 0) {
      this.promises
        .register('namespaces', API.getNamespaces())
        .then(namespacesResponse => {
          const namespaces: Namespace[] = namespacesResponse.data;
          this.fetchExperiments(namespaces.map(namespace => namespace.name));
        })
        .catch(namespacesError => {
          if (!namespacesError.isCanceled) {
            AlertUtils.addError('Could not fetch namespace list.', namespacesError);
          }
        });
    } else {
      this.fetchExperiments(namespacesSelected);
    }
  };

  // Invoke the history object to update and URL and start a routing
  goNewExperimentPage = () => {
    history.push('/extensions/iter8/new');
  };

  // This is a simplified actions toolbar.
  // It contains a create new handler action.
  actionsToolbar = () => {
    return (
      <Dropdown
        id="actions"
        title="Actions"
        toggle={<DropdownToggle onToggle={toggle => this.setState({ dropdownOpen: toggle })}>Actions</DropdownToggle>}
        onSelect={() => this.setState({ dropdownOpen: !this.state.dropdownOpen })}
        position={DropdownPosition.right}
        isOpen={this.state.dropdownOpen}
        dropdownItems={[
          <DropdownItem
            key="createExperiment"
            isDisabled={!this.state.iter8Info.enabled}
            onClick={() => this.goNewExperimentPage()}
          >
            Create New Experiment
          </DropdownItem>
        ]}
      />
    );
  };

  // This is a simplified toolbar for refresh and actions.
  // Kiali has a shared component toolbar for more complex scenarios like filtering
  // It renders actions only if user has permissions
  toolbar = () => {
    return (
      <Toolbar className="pf-l-toolbar pf-u-justify-content-space-between pf-u-mx-xl pf-u-my-md">
        <ToolbarSection aria-label="ToolbarSection">
          <Toolbar className={rightToolbar}>
            <RefreshContainer
              id="time_range_refresh"
              key="Refresh"
              disabled={false}
              hideLabel={true}
              handleRefresh={this.updateListItems}
              manageURL={true}
            />
            {this.actionsToolbar()}
          </Toolbar>
        </ToolbarSection>
      </Toolbar>
    );
  };

  // Helper used to build the table content.
  rows = (): IRow[] => {
    return this.state.experimentLists.map(h => {
      return {
        cells: [
          <>
            <Tooltip
              key={'TooltipExtensionIter8Name_' + h.name}
              position={TooltipPosition.top}
              content={<>Iter8 Experiment</>}
            >
              <Badge className={'virtualitem_badge_definition'}>IT8</Badge>
            </Tooltip>
            <Link
              to={`/extensions/namespaces/${h.namespace}/iter8/${h.name}`}
              key={'Experiment_' + h.namespace + '_' + h.namespace}
            >
              {h.name}
            </Link>
          </>,
          <>
            <Tooltip
              key={'TooltipExtensionNamespace_' + h.namespace}
              position={TooltipPosition.top}
              content={<>Namespace</>}
            >
              <Badge className={'virtualitem_badge_definition'}>NS</Badge>
            </Tooltip>
            {h.namespace}
          </>,
          <>{h.phase}</>,
          <>{h.status}</>,
          <>
            {h.baseline} <br /> {h.baselinePercentage}%
          </>,
          <>
            {h.candidate}
            <br /> {h.candidatePercentage}%
          </>
        ]
      };
    });
  };

  render() {
    return (
      <div className={containerPadding}>
        {this.toolbar()}
        <Table
          aria-label="Sortable Table"
          sortBy={this.state.sortBy}
          cells={columns}
          rows={this.rows()}
          onSort={this.onSort}
        >
          <TableHeader />
          {this.state.experimentLists.length > 0 ? (
            <TableBody />
          ) : (
            <tr>
              <td colSpan={columns.length}>
                <EmptyState variant={EmptyStateVariant.full}>
                  <Title headingLevel="h5" size="lg">
                    No Iter8 Experiments found
                  </Title>
                  <EmptyStateBody>
                    No Iter8 Experiments in namespace
                    {this.props.activeNamespaces.length === 1
                      ? ` ${this.props.activeNamespaces[0].name}`
                      : `s: ${this.props.activeNamespaces.map(ns => ns.name).join(', ')}`}
                  </EmptyStateBody>
                </EmptyState>
              </td>
            </tr>
          )}
        </Table>
      </div>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state)
});

const ExperimentListPageContainer = connect(
  mapStateToProps,
  null
)(ExperimentListPage);

export default ExperimentListPageContainer;
