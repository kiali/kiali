import * as React from 'react';
import ReactResizeDetector from 'react-resize-detector';
import { Tab, Popover, PopoverPosition } from '@patternfly/react-core';
import { ThProps, IRow } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { SimpleTabs } from 'components/Tab/SimpleTabs';
import { PFColors } from 'components/Pf/PfColors';
import { SimpleTable } from 'components/SimpleTable';

export interface GraphHelpFindProps {
  children: React.ReactNode;
  className?: string;
  onClose: () => void;
}

const width = '600px';
const maxWidth = '604px';
const contentWidth = '540px';

const tabFont: React.CSSProperties = {
  fontSize: 'var(--kiali-global--font-size)'
};

const popoverStyle = kialiStyle({
  width: width,
  maxWidth: maxWidth,
  height: '550px',
  overflow: 'hidden',
  overflowX: 'auto',
  overflowY: 'auto'
});

const prefaceStyle = kialiStyle({
  fontSize: '0.75rem',
  color: PFColors.ColorLight100,
  backgroundColor: PFColors.Blue600,
  width: contentWidth,
  height: '80px',
  padding: '0.25rem',
  resize: 'none',
  overflowY: 'hidden'
});

export const GraphHelpFind: React.FC<GraphHelpFindProps> = (props: GraphHelpFindProps) => {
  // Incrementing mock counter to force a re-render in React hooks
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  const onResize = () => {
    forceUpdate();
  };

  const preface =
    'You can use the Find and Hide fields to highlight or hide graph edges and nodes. Each field accepts ' +
    'expressions using the language described below. Preset expressions are available via the dropdown. ' +
    'Hide takes precedence when using Find and Hide together. ';

  const edgeColumns: ThProps[] = [{ title: 'Expression' }, { title: 'Notes' }];

  const edgeRows: IRow[] = [
    { cells: ['destprincipal <op> <principal>'] },
    { cells: ['grpc <op> <number>', 'unit: requests per second'] },
    { cells: ['%grpcerr <op> <number>', 'range: [0..100]'] },
    { cells: ['%grpctraffic <op> <number>', 'range: [0..100]'] },
    { cells: ['http <op> <number>', 'unit: requests per second'] },
    { cells: ['%httperr <op> <number>', 'range: [0..100]'] },
    { cells: ['%httptraffic <op> <number>', 'range: [0..100]'] },
    { cells: ['mtls', `will auto-enable 'security' display option`] },
    { cells: ['protocol <op> <protocol>', 'grpc, http, tcp, etc..'] },
    { cells: ['responsetime <op> <number>', `unit: millis, will auto-enable 'P95 response time' edge labels`] },
    { cells: ['sourceprincipal <op> <principal>'] },
    { cells: ['tcp <op> <number>', 'unit: bytes per second'] },
    {
      cells: ['throughput <op> <number>', `unit: bytes per second, will auto-enable 'request throughput' edge labels`]
    },
    { cells: ['traffic', 'any traffic for any protocol'] }
  ];

  const exampleColumns: ThProps[] = [{ title: 'Expression' }, { title: 'Description' }];

  const exampleRows: IRow[] = [
    {
      cells: [
        'label:region',
        `nodes with the 'region' label. This tests for label existence, the label value is ignored.`
      ]
    },
    {
      cells: [
        '!label:region',
        `nodes without the 'region' label. This tests for label existence, the label value is ignored.`
      ]
    },
    { cells: ['label:region = east', `nodes with 'region' label equal to 'east'`] },
    {
      cells: [
        'label:region != east',
        `nodes with 'region' label not equal to 'east'.  Note, "!label:region = east" is invalid, leading negation is valid only for label existence.`
      ]
    },
    { cells: ['name = reviews', `nodes with app or service name or workload name equal to 'reviews'`] },
    { cells: ['name not contains rev', `"nodes with app, service name and workload name not containing 'rev'`] },
    { cells: ['app startswith product', `nodes with app starting with 'product'`] },
    {
      cells: ['app != details and version=v1', `nodes with app not equal to 'details' and with version equal to 'v1'`]
    },
    { cells: ['!outofmesh', `nodes out of mesh (With no sidecar and no Istio Ambient components)`] },
    { cells: ['httpin > 0.5', `nodes with inbound http rate > 0.5 rps`] },
    { cells: ['tcpout >= 1000', `nodes with outbound tcp rates >= 1000 bps`] },
    { cells: ['!traffic', 'edges with no traffic'] },
    { cells: ['http > 0.5', `edges with http rate > 0.5 rps`] },
    { cells: ['rt > 500', `edges with response time > 500ms. (requires response time edge labels)`] },
    { cells: ['%httptraffic >= 50.0', `edges with >= 50% of the outbound http request traffic of the parent`] },
    {
      cells: [
        'node = svc and svc startswith det or !traffic',
        'service node starting with "det" or edges with no traffic'
      ]
    },
    { cells: ['rank <= 2', 'nodes with a top 2 ranking'] }
  ];

  const nodeColumns: ThProps[] = [{ title: 'Expression' }, { title: 'Notes' }];

  const nodeRows: IRow[] = [
    { cells: ['app <op> <appName>', 'tests against canonical service'] },
    { cells: ['cluster <op> <clusterName>'] },
    { cells: ['grpcin <op> <number>', 'unit: requests per second'] },
    { cells: ['grpcout <op> <number>', 'unit: requests per second'] },
    { cells: ['httpin <op> <number>', 'unit: requests per second'] },
    { cells: ['httpout <op> <number>', 'unit: requests per second'] },
    { cells: ['label:<label> <op> <value>', '<label> is a k8s label on the service, workload, etc'] },
    { cells: ['name <op> <string>', 'tests against canonical service, operation, service and workload names'] },
    { cells: ['namespace <op> <namespaceName>'] },
    { cells: ['node <op> <nodeType>', 'nodeType: app | operation | service | workload | unknown'] },
    { cells: ['operation <op> <operationName>'] },
    { cells: ['rank <op> <number>', 'unit: 1..100'] },
    { cells: ['service <op> <serviceName>'] },
    { cells: ['version <op> <string>', 'tests against canonical revision'] },
    { cells: ['tcpin <op> <number>', 'unit: bytes per second'] },
    { cells: ['tcpout <op> <number>', 'unit: bytes per second'] },
    { cells: ['workload <op> <workloadName>'] },
    { cells: ['circuitbreaker'] },
    { cells: ['faultinjection'] },
    { cells: ['healthy', 'is not degraded or failing.'] },
    { cells: ['idle', `will auto-enable 'idle nodes' display option`] },
    { cells: ['mirroring'] },
    { cells: ['outside', 'is outside of requested namespaces'] },
    { cells: ['requestrouting'] },
    { cells: ['requesttimeout'] },
    { cells: ['outofmesh'] },
    { cells: ['serviceentry'] },
    { cells: ['tcptrafficshifting'] },
    { cells: ['trafficshifting'] },
    { cells: ['trafficsource', `has only outbound edges`] },
    { cells: ['virtualservice'] },
    { cells: ['workloadentry'] }
  ];

  const noteColumns: ThProps[] = [{ title: 'Usage Note', width: 10 }];

  const noteRows: IRow[] = [
    { cells: ['Press Tab key to autocomplete operands.'] },
    { cells: ['OR has precedence over AND.  Parentheses are not supported.'] },
    { cells: ['Use OR to combine node and edge criteria.'] },
    { cells: ['Use "<operand> = NaN" to test for no activity. Use "!= NaN" for any activity. (e.g. httpout = NaN)'] },
    { cells: [`Unary operands may optionally be prefixed with "is" or "has". (i.e. "has mtls")`] },
    { cells: ['The "name" operand expands internally to an "OR" expression (an "AND" when negated).'] },
    {
      cells: [
        'For the configured app and version labels, use the "app" and "version" Node operands, as opposed to "label:".'
      ]
    },
    { cells: ['Abbreviate: ns|namespace, svc|service, se|serviceentry, wl|workload, we|workloadentry, op|operation'] },
    { cells: ['Abbreviate: rt|responsetime, om|outofmesh, vs|virtualservice'] },
    {
      cells: [
        'Abbreviate: cb|circuitbreaker, fi|faultinjection, rr|requestrouting, rto|requesttimeout, ts|trafficshifting'
      ]
    },
    { cells: ['Hiding nodes will automatically hide connected edges.'] },
    { cells: ['Hiding edges will automatically hide nodes left with no visible edges.'] },
    { cells: ['Hiding "healthy" nodes may still leave valid, healthy edges in the graph.'] }
  ];

  const operatorColumns: ThProps[] = [{ title: 'Operator' }, { title: 'Description' }];

  const operatorRows: IRow[] = [
    { cells: ['! | not <unary expression>', `negation`] },
    { cells: ['=', `equals`] },
    { cells: ['!=', `not equals`] },
    { cells: ['endswith | $=', `ends with, strings only`] },
    { cells: ['!endswith | !$=', `not ends with, strings only`] },
    { cells: ['startswith | ^=', `starts with, strings only`] },
    { cells: ['!startswith | !^=', `not starts with, strings only`] },
    { cells: ['contains | *=', 'contains, strings only'] },
    { cells: ['!contains | !*=', 'not contains, strings only'] },
    { cells: ['>', `greater than`] },
    { cells: ['>=', `greater than or equals`] },
    { cells: ['<', `less than`] },
    { cells: ['<=', `less than or equals`] }
  ];

  const getTable = (label: string, columns: ThProps[], rows: IRow[]): React.ReactNode => {
    return <SimpleTable label={label} columns={columns} rows={rows} />;
  };

  const exampleTable = getTable('Example Table', exampleColumns, exampleRows);
  const nodeTable = getTable('Node Table', nodeColumns, nodeRows);
  const edgeTable = getTable('Edge Table', edgeColumns, edgeRows);
  const operatorTable = getTable('Operator Table', operatorColumns, operatorRows);
  const noteTable = getTable('Note Table', noteColumns, noteRows);

  return (
    <>
      <ReactResizeDetector
        refreshMode="debounce"
        refreshRate={100}
        skipOnMount={true}
        handleWidth={true}
        handleHeight={true}
        onResize={onResize}
      />

      <Popover
        data-test="graph-find-hide-help"
        className={popoverStyle}
        position={PopoverPosition.auto}
        isVisible={true}
        hideOnOutsideClick={false}
        shouldClose={props.onClose}
        headerContent={
          <div>
            <span>Graph Find/Hide</span>
          </div>
        }
        bodyContent={
          <>
            <textarea className={`${prefaceStyle}`} readOnly={true} value={preface} />

            <SimpleTabs id="graph_find_help_tabs" defaultTab={0} style={{ width: contentWidth }}>
              <Tab style={tabFont} eventKey={0} title="Examples">
                {exampleTable}
              </Tab>

              <Tab style={tabFont} eventKey={1} title="Nodes">
                {nodeTable}
              </Tab>

              <Tab style={tabFont} eventKey={2} title="Edges">
                {edgeTable}
              </Tab>

              <Tab style={tabFont} eventKey={3} title="Operators">
                {operatorTable}
              </Tab>

              <Tab style={tabFont} eventKey={4} title="Usage Notes">
                {noteTable}
              </Tab>
            </SimpleTabs>
          </>
        }
      >
        <>{props.children}</>
      </Popover>
    </>
  );
};
