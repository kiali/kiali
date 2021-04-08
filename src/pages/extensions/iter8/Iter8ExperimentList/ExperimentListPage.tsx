import * as React from 'react';
import * as FilterHelper from '../../../../components/FilterList/FilterHelper';
import { RenderContent } from '../../../../components/Nav/Page';
import * as ExpListFilters from './FiltersAndSorts';
import { style } from 'typestyle';
import * as FilterComponent from '../../../../components/FilterList/FilterComponent';
import { Iter8Experiment, Iter8Info, Winner } from '../../../../types/Iter8';
import Namespace from '../../../../types/Namespace';
import {
  cellWidth,
  IRow,
  ISortBy,
  sortable,
  SortByDirection,
  Table,
  TableBody,
  TableHeader
} from '@patternfly/react-table';
import { PromisesRegistry } from '../../../../utils/CancelablePromises';
import * as API from '../../../../services/Api';
import * as AlertUtils from '../../../../utils/AlertUtils';
import * as Iter8ExperimentListFilters from './FiltersAndSorts';
import { FilterSelected, StatefulFilters } from '../../../../components/Filters/StatefulFilters';
import { namespaceEquals } from '../../../../utils/Common';
import history from '../../../../app/History';
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
  TextVariants,
  Title,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { PFColors } from '../../../../components/Pf/PfColors';
import { KialiIcon } from '../../../../config/KialiIcon';
import { OkIcon, PowerOffIcon } from '@patternfly/react-icons';
import { Link } from 'react-router-dom';
import { KialiAppState } from '../../../../store/Store';
import { activeNamespacesSelector, durationSelector } from '../../../../store/Selectors';
import { connect } from 'react-redux';
import DefaultSecondaryMasthead from '../../../../components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import RefreshContainer from '../../../../components/Refresh/Refresh';

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
    transforms: [sortable, cellWidth(5) as any]
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

class ExperimentListPageComponent extends React.Component<Props, State> {
  private promises = new PromisesRegistry();

  constructor(props: Props) {
    super(props);
    const prevCurrentSortField = FilterHelper.currentSortField(ExpListFilters.sortFields);
    const prevIsSortAscending = FilterHelper.isCurrentSortAscending();
    this.state = {
      iter8Info: {
        enabled: false,
        supportedVersion: false,
        controllerImageVersion: '',
        analyticsImageVersion: ''
      },
      experimentLists: [],
      sortBy: {},
      dropdownOpen: false,
      listItems: [],
      currentSortField: prevCurrentSortField,
      isSortAscending: prevIsSortAscending,
      onFilterChange: false
    };
  }

  fetchExperiments = (namespaces: string[]) => {
    API.getIter8Info()
      .then(result => {
        const iter8Info = result.data;
        if (iter8Info.enabled) {
          if (!iter8Info.supportedVersion) {
            AlertUtils.addError(
              'You are running an unsupported Iter8 vresion, please upgrade to supported version  (v0.2+) to take advantage of the full features of Iter8 .'
            );
          }
          if (namespaces.length > 0) {
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
          }
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
    const paramsSynced = activeNamespacesCompare;
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
    if (namespacesSelected.length !== 0) {
      this.fetchExperiments(namespacesSelected);
    } else {
      this.setState({ experimentLists: [] });
    }
  };

  // Invoke the history object to update and URL and start a routing
  goNewExperimentPage = () => {
    history.push('/extensions/iter8/new');
  };

  goNewExperimentFromFile = () => {
    history.push('/extensions/iter8/newfromfile');
  };

  // It contains a create new experiment action.
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
          </DropdownItem>,
          <DropdownItem
            key="createExperimentFromFile"
            isDisabled={!this.state.iter8Info.enabled}
            onClick={() => this.goNewExperimentFromFile()}
          >
            Create New Experiment from YAML
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
      />
    );
  };

  getStatusTooltip = (
    phase: string,
    status: string,
    winnerFound: boolean,
    winnerName: string,
    baselineName: string
  ) => {
    let statusValue = 'Status: In Progress';
    let retStatus = status;
    if (status.length > 0) {
      const values = status.split(':');
      if (values.length > 1) {
        retStatus = values.slice(1)[0];
      }
      if (status.includes('Failed')) {
        statusValue = 'Status: Failed';
      } else if (status.includes('Completed')) {
        statusValue = 'Status: Completed';
        if (winnerName === baselineName) {
          retStatus = 'Traffic to Baseline';
        }
      }
    }
    return (
      <TextContent style={{ color: PFColors.White }}>
        <Text>
          <h2>Phase: </h2> {phase}
        </Text>
        <Text>
          <h2>{statusValue}</h2> {retStatus}
        </Text>
        <Text>
          <h2>Winner Found: {winnerFound ? winnerName : 'False'}</h2>
          <Text component={TextVariants.p}>(Winning version as identified by iter8 analytics)</Text>
        </Text>
      </TextContent>
    );
  };

  experimentStatusIcon = (key: string, phase: string, winnerStatus: Winner, status: string, baselineName: string) => {
    let className = greenIconStyle;
    let toBaseline = false;
    let statusString = this.getStatusTooltip(
      phase,
      status,
      winnerStatus.winning_version_found,
      winnerStatus.name,
      baselineName
    );
    if (status.includes('Abort')) {
      className = greenIconStyle;
    } else if (!winnerStatus.winning_version_found) {
      className = redIconStyle;
    }

    if (winnerStatus.name === baselineName) {
      toBaseline = true;
      className = redIconStyle;
    }
    switch (phase) {
      case 'Initializing':
        return (
          <Tooltip
            key={'Initializing_' + key}
            aria-label={'Status indicator'}
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
            aria-label={'Status indicator'}
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
            aria-label={'Status indicator'}
            position={PopoverPosition.auto}
            className={'health_indicator'}
            content={<>{statusString}</>}
          >
            <KialiIcon.PauseCircle className={statusIconStyle} />
          </Tooltip>
        );
      case 'Completed':
        if (status.includes('Abort')) {
          return (
            <Tooltip
              key={'Completed_' + key}
              aria-label={'Status indicator'}
              position={PopoverPosition.auto}
              className={'health_indicator'}
              content={<>{statusString}</>}
            >
              <PowerOffIcon className={className} />
            </Tooltip>
          );
        } else if (toBaseline) {
          return (
            <Tooltip
              key={'Completed_' + key}
              aria-label={'Status indicator'}
              position={PopoverPosition.auto}
              className={'health_indicator'}
              content={<>{statusString}</>}
            >
              <OkIcon className={className} />
            </Tooltip>
          );
        }
        return (
          <Tooltip
            key={'Completed_' + key}
            aria-label={'Status indicator'}
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
            aria-label={'Status indicator'}
            position={PopoverPosition.auto}
            className={'health_indicator'}
            content={<>{statusString}</>}
          >
            <KialiIcon.OnRunningIcon className={statusIconStyle} />
          </Tooltip>
        );
    }
  };

  redirectLink(namespace: string, name: string, kind: string) {
    if (kind === 'Deployment') {
      let linkTo = '/namespaces/' + namespace + '/workloads/' + name;
      return (
        <>
          <Badge className={'virtualitem_badge_definition'}>W</Badge>
          <Link to={linkTo}>{name}</Link>
        </>
      );
    } else {
      if (name !== '') {
        let linkTo = '/namespaces/' + namespace + '/services/' + name;
        return (
          <>
            <Badge className={'virtualitem_badge_definition'}>S</Badge>
            <Link to={linkTo}>{name}</Link>
          </>
        );
      } else {
        return 'N/A';
      }
    }
  }

  // Helper used to build the table content.
  rows = (): IRow[] => {
    return this.state.experimentLists.map(h => {
      let candidates: string[] = [];
      for (const c of h.candidates) {
        candidates.push(c.name);
      }

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
            <Badge className={'virtualitem_badge_definition'}>{h.experimentKind}</Badge>
            <Link
              to={`/extensions/namespaces/${h.namespace}/iter8/${h.name}?target=${h.targetService}&startTime=${h.startTime}&endTime=${h.endTime}&baseline=${h.baseline.name}&candidates=${candidates}`}
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
            {h.kind === 'Deployment'
              ? this.redirectLink(h.namespace, h.targetService, 'Service')
              : this.redirectLink(h.namespace, '', h.kind)}
          </>,
          <>{this.experimentStatusIcon(h.name + '_' + h.namespace, h.phase, h.winner, h.status, h.baseline.name)}</>,

          <>
            {this.redirectLink(h.namespace, h.baseline.name, h.kind)}
            <br /> {h.baseline.weight}%
          </>,
          <>
            {h.candidates.map(can => {
              return (
                <>
                  {this.redirectLink(h.namespace, can.name, h.kind)}
                  &nbsp;{can.weight}% <br />
                </>
              );
            })}
          </>
        ]
      };
    });
  };

  render() {
    return (
      <>
        <div style={{ backgroundColor: '#fff' }}>
          <DefaultSecondaryMasthead
            rightToolbar={
              <RefreshContainer
                id="exp_list_refresh"
                disabled={false}
                hideLabel={true}
                handleRefresh={this.updateListItems}
                manageURL={true}
              />
            }
            actionsToolbar={this.actionsToolbar()}
          />
        </div>
        <RenderContent>
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
                    {this.props.activeNamespaces.length > 0 ? (
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
                    ) : (
                      <EmptyState variant={EmptyStateVariant.full}>
                        <Title headingLevel="h5" size="lg">
                          No namespace is selected
                        </Title>
                        <EmptyStateBody>
                          There is currently no namespace selected, please select one using the Namespace selector.
                        </EmptyStateBody>
                      </EmptyState>
                    )}
                  </td>
                </tr>
              )}
            </Table>
          </div>
        </RenderContent>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  activeNamespaces: activeNamespacesSelector(state),
  duration: durationSelector(state)
});

const ExperimentListPage = connect(mapStateToProps)(ExperimentListPageComponent);
export default ExperimentListPage;
