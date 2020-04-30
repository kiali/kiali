import * as React from 'react';
import { RenderContent } from '../../../../components/Nav/Page';
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  Dropdown,
  DropdownItem,
  DropdownPosition,
  DropdownToggle,
  Title,
  Toolbar,
  ToolbarSection,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { style } from 'typestyle';
import { PfColors } from '../../../../components/Pf/PfColors';
import { sortable, SortByDirection, Table, TableBody, TableHeader, ISortBy, IRow } from '@patternfly/react-table';
import RefreshButtonContainer from '../../../../components/Refresh/RefreshButton';
import * as API from '../../../../services/Api';
import * as AlertUtils from '../../../../utils/AlertUtils';
import { ThreeScaleHandler, ThreeScaleInfo } from '../../../../types/ThreeScale';
import { Link } from 'react-router-dom';
import history from '../../../../app/History';

// Extensions header style
// Extensions may not reuse other components in App/Workload/Services pages due exceptions
// i.e. no namespaces controllers, then some styles need to be adjusted manually
const extensionHeader = style({
  padding: '0px 20px 18px 20px',
  backgroundColor: PfColors.White
});
const breadcrumbPadding = style({
  padding: '22px 0 5px 0'
});
const containerPadding = style({ padding: '20px 20px 20px 20px' });
const rightToolbar = style({ marginLeft: 'auto' });

// Page title on 3scale extension doesn't have a namespace
// 3scale entities are always located under the control plane namespace, but that's implicit in the domain
const pageTitle = (
  <div className={extensionHeader}>
    <Breadcrumb className={breadcrumbPadding}>
      <BreadcrumbItem isActive={true}>
        <Link to={'/extensions/threescale'}>3scale Handlers</Link>
      </BreadcrumbItem>
    </Breadcrumb>
    <Title headingLevel="h1" size="3xl" style={{ margin: '20px 0 0' }}>
      3scale Handlers
    </Title>
  </div>
);

// Empty properties, but using a type just for code consistency
interface Props {}

// State of the component/page
// It stores the visual state of the components and the handlers fetched from the backend.
interface State {
  threeScaleInfo: ThreeScaleInfo;
  handlers: ThreeScaleHandler[];
  sortBy: ISortBy;
  dropdownOpen: boolean;
}

// Column headers used for the handlers table.
// It addes the sortable capability.
const columns = [
  {
    title: 'Handler Name',
    transforms: [sortable]
  },
  {
    title: 'Service Id',
    transforms: [sortable]
  },
  {
    title: 'System Url',
    transforms: [sortable]
  }
];

class ThreeScaleHandlerListPage extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      threeScaleInfo: {
        enabled: false,
        permissions: {
          create: false,
          update: false,
          delete: false
        }
      },
      handlers: [],
      sortBy: {},
      dropdownOpen: false
    };
  }

  // It fetches the information about Threescale adapter (adapter detected at runtime, permissions).
  // It fetches the list of 3scale handlers.
  fetchHandlers = () => {
    API.getThreeScaleInfo()
      .then(result => {
        const threeScaleInfo = result.data;
        if (threeScaleInfo.enabled) {
          API.getThreeScaleHandlers()
            .then(results => {
              this.setState(prevState => {
                return {
                  threeScaleInfo: threeScaleInfo,
                  handlers: results.data,
                  sortBy: prevState.sortBy
                };
              });
            })
            .catch(error => {
              AlertUtils.addError('Could not fetch ThreeScaleHandlers.', error);
            });
        } else {
          AlertUtils.addError('Kiali has 3scale extension enabled but 3scale adapter is not detected in the cluster');
        }
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch ThreeScaleInfo.', error);
      });
  };

  // It invokes backend when component is mounted
  componentDidMount() {
    this.fetchHandlers();
  }

  // Invoke the history object to update and URL and start a routing
  goNewHandlerPage = () => {
    history.push('/extensions/threescale/new');
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
            key="createIstioConfig"
            isDisabled={!(this.state.threeScaleInfo.enabled && this.state.threeScaleInfo.permissions.create)}
            onClick={() => this.goNewHandlerPage()}
          >
            Create New 3scale Handler
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
            <RefreshButtonContainer key={'Refresh'} handleRefresh={() => this.fetchHandlers()} />
            {this.actionsToolbar()}
          </Toolbar>
        </ToolbarSection>
      </Toolbar>
    );
  };

  // Helper used for Table to sort handlers based on index column == field
  onSort = (_event, index, direction) => {
    const sortedHandlers = this.state.handlers.sort((a, b) => {
      switch (index) {
        case 0:
          return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
        case 1:
          return a.serviceId < b.serviceId ? -1 : a.serviceId > b.serviceId ? 1 : 0;
        case 2:
          return a.systemUrl < b.systemUrl ? -1 : a.systemUrl > b.systemUrl ? 1 : 0;
      }
      return 0;
    });
    this.setState({
      handlers: direction === SortByDirection.asc ? sortedHandlers : sortedHandlers.reverse(),
      sortBy: {
        index,
        direction
      }
    });
  };

  // Helper used to build the table content.
  // Note that maps the handlers to the internal types required for PF4 Table component.
  rows = (): IRow[] => {
    return this.state.handlers.map(h => {
      return {
        cells: [
          <>
            <Tooltip
              key={'TooltipExtensionThreescaleHandlerName_' + h.name}
              position={TooltipPosition.top}
              content={<>3scale Istio Handler</>}
            >
              <Badge className={'virtualitem_badge_definition'}>3S</Badge>
            </Tooltip>
            <Link to={`/extensions/threescale/${h.name}`} key={'ExtensionThreescaleHandler_' + h.name}>
              {h.name}
            </Link>
          </>,
          <>
            <Tooltip
              key={'TooltipExtensionThreescaleHandlerServiceId_' + h.name}
              position={TooltipPosition.top}
              content={<>3scale Service Id</>}
            >
              <Badge className={'virtualitem_badge_definition'}>ID</Badge>
            </Tooltip>
            {h.serviceId}
          </>,
          <>
            <Tooltip
              key={'TooltipExtensionThreescaleHandlerSystemUrl_' + h.name}
              position={TooltipPosition.top}
              content={<>3scale System Url</>}
            >
              <Badge className={'virtualitem_badge_definition'}>URL</Badge>
            </Tooltip>
            {h.systemUrl}
          </>
        ]
      };
    });
  };

  render() {
    return (
      <>
        {pageTitle}
        <RenderContent>
          <div className={containerPadding}>
            {this.toolbar()}
            <Table
              aria-label="Sortable Table"
              sortBy={this.state.sortBy}
              onSort={this.onSort}
              cells={columns}
              rows={this.rows()}
            >
              <TableHeader />
              <TableBody />
            </Table>
          </div>
        </RenderContent>
      </>
    );
  }
}

export default ThreeScaleHandlerListPage;
