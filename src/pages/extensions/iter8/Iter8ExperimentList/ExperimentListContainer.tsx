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
  PopoverPosition,
  Text,
  TextContent,
  Title,
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
import { activeNamespacesSelector, durationSelector } from '../../../../store/Selectors';
import { connect } from 'react-redux';
import Namespace from '../../../../types/Namespace';
import { PromisesRegistry } from '../../../../utils/CancelablePromises';
import { namespaceEquals } from '../../../../utils/Common';

import { KialiIcon } from '../../../../config/KialiIcon';
import { OkIcon } from '@patternfly/react-icons';
import * as Iter8ExperimentListFilters from './FiltersAndSorts';
import { FilterSelected, StatefulFilters } from '../../../../components/Filters/StatefulFilters';
import { PfColors } from 'components/Pf/PfColors';
import TimeControlsContainer from '../../../../components/Time/TimeControls';

// Style constants
const containerPadding = style({ padding: '20px 20px 20px 20px' });
const greenIconStyle = style({
  fontSize: '1.0em',
  color: 'green'
});
const redIconStyle = style({
  fontSize: '1.0em',
  color: 'red'
});
const statusIconStyle = style({
  fontSize: '1.0em'
});

interface Props extends FilterComponent.Props<Iter8Experiment> {
  activeNamespaces: Namespace[];
}

// State of the component/page
// It stores the visual state of the components and the experiments fetched from the backend.
interface State extends FilterComponent.State<Iter8Experiment> {
  iter8Info: Iter8Info;
  experimentLists: Iter8Experiment[];
  sortBy: ISortBy;
  dropdownOpen: boolean;
  onFilterChange: boolean;
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
    title: 'Service',
    transforms: [sortable]
  },
  {
    title: 'Phase',
    transforms: [sortable, cellWidth(15) as any]
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
      isSortAscending: this.props.isSortAscending,
      onFilterChange: false
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
                  experimentLists: Iter8ExperimentListFilters.filterBy(result.data, FilterSelected.getSelected()),
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

  serviceLink(namespace: string, workload: string) {
    let slink = '/namespaces/' + namespace + '/services/' + workload;
    return <Link to={slink}>{workload}</Link>;
  }

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

  onFilterChange = () => {
    // Resetting pagination when filters change
    this.updateListItems();
  };

  toolbar = () => {
    return (
      <StatefulFilters
        initialFilters={Iter8ExperimentListFilters.availableFilters}
        onFilterChange={this.onFilterChange}
        rightToolbar={[
          <TimeControlsContainer
            key={'DurationDropdown'}
            id="exp-list-duration-dropdown"
            handleRefresh={this.updateListItems}
            disabled={false}
          />,
          <>{this.actionsToolbar()}</>
        ]}
      />
    );
  };

  getStatusString = (phase: string, status: string) => {
    let statusValue = 'Status: In Progress';
    let retStatus = status;
    if (status.length > 0) {
      const values = status.split(':');
      if (values.length > 1) {
        retStatus = values.slice(1)[0];
      }
      if (status.includes('Failed')) {
        statusValue = 'Status: Failed';
      } else if (status.includes('Succeeded')) {
        statusValue = 'Status: Succeeded';
      }
    }
    return (
      <TextContent style={{ color: PfColors.White }}>
        <Text>
          <h2>Phase: </h2> {phase}
        </Text>
        <Text>
          <h2>{statusValue}</h2> {retStatus}
        </Text>
      </TextContent>
    );
  };

  experimentStatusIcon = (key: string, phase: string, candidate: number, status: string) => {
    let className = greenIconStyle;

    let statusString = this.getStatusString(phase, status);
    if (candidate === 0) {
      className = redIconStyle;
    }
    switch (phase) {
      case 'Initializing':
        return (
          <Tooltip
            key={'Initializing_' + key}
            aria-label={'Status Indicatorr'}
            position={PopoverPosition.auto}
            className={'health_indicator'}
            content={<>{statusString}</>}
          >
            <KialiIcon.InProgressIcon className={statusIconStyle} />
          </Tooltip>
        );
      case 'Progressing':
        return (
          <Tooltip
            key={'Progressing_' + key}
            aria-label={'Status Indicatorr'}
            position={PopoverPosition.auto}
            className={'health_indicator'}
            content={<>{statusString}</>}
          >
            <KialiIcon.OnRunningIcon className={statusIconStyle} />
          </Tooltip>
        );
      case 'Pause':
        return (
          <Tooltip
            key={'Pause_' + key}
            aria-label={'Status Indicatorr'}
            position={PopoverPosition.auto}
            className={'health_indicator'}
            content={<>{statusString}</>}
          >
            <KialiIcon.PauseCircle className={statusIconStyle} />
          </Tooltip>
        );
      case 'Completed':
        return (
          <Tooltip
            key={'Completed_' + key}
            aria-label={'Status Indicatorr'}
            position={PopoverPosition.auto}
            className={'health_indicator'}
            content={<>{statusString}</>}
          >
            <OkIcon className={className} />
          </Tooltip>
        );
      default:
        return (
          <Tooltip
            key={'default_' + key}
            aria-label={'Status Indicatorr'}
            position={PopoverPosition.auto}
            className={'health_indicator'}
            content={<>{statusString}</>}
          >
            <KialiIcon.OnRunningIcon className={statusIconStyle} />
          </Tooltip>
        );
    }
  };

  workloadLink(namespace: string, workload: string) {
    return '/namespaces/' + namespace + '/workloads/' + workload;
  }

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
              to={`/extensions/namespaces/${h.namespace}/iter8/${h.name}?target=${h.targetService}&startTime=${
                h.startedAt
              }&endTime=${h.endedAt}&baseline=${h.baseline}&candidate=${h.candidate}`}
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
          <>
            <Tooltip
              key={'TooltipTargetService_' + h.targetService}
              position={TooltipPosition.top}
              content={<>Experiment TargetService</>}
            >
              <Badge className={'virtualitem_badge_definition'}>S</Badge>
            </Tooltip>
            {h.targetService ? this.serviceLink(h.namespace, h.targetService) : ''}
          </>,
          <>{this.experimentStatusIcon(h.name + '_' + h.namespace, h.phase, h.candidatePercentage, h.status)}</>,

          <>
            <Link to={this.workloadLink(h.namespace, h.baseline)}>{h.baseline}</Link>
            <br /> {h.baselinePercentage}%
          </>,
          <>
            <Link to={this.workloadLink(h.namespace, h.candidate)}>{h.candidate}</Link>
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
  activeNamespaces: activeNamespacesSelector(state),
  duration: durationSelector(state)
});

const ExperimentListPageContainer = connect(
  mapStateToProps,
  null
)(ExperimentListPage);

export default ExperimentListPageContainer;
