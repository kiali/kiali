import * as React from 'react';
import ReactResizeDetector from 'react-resize-detector';
import { Tab, Popover, PopoverPosition } from '@patternfly/react-core';
import { ThProps, IRow, Thead, Tr, Th, Tbody, Td, IRowCell, Table } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { SimpleTabs } from 'components/Tab/SimpleTabs';
import { PFColors } from 'components/Pf/PfColors';

export interface GraphHelpFindProps {
  children: React.ReactNode;
  className?: string;
  onClose: () => void;
}

const tabFont: React.CSSProperties = {
  fontSize: 'var(--kiali-global--font-size)'
};

const contentWidth = '540px';

export const GraphHelpFind: React.FC<GraphHelpFindProps> = (props: GraphHelpFindProps) => {
  // Incrementing mock counter to force a re-render in hooks
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  const onResize = () => {
    forceUpdate();
  };

  const width = '600px';
  const maxWidth = '604px';

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

  const preface =
    'You can use the Find and Hide fields to highlight or hide graph edges and nodes. Each field accepts ' +
    'expressions using the language described below. Preset expressions are available via the dropdown. ' +
    'Hide takes precedence when using Find and Hide together. Uncheck the "Compressed Hide" Display ' +
    'option for hidden elements to retain their space.';

  const edgeColumns: ThProps[] = [{ title: 'Expression' }, { title: 'Notes' }];

  const edgeRows: IRow[] = [
    ['destprincipal <op> <principal>'],
    ['grpc <op> <number>', 'unit: requests per second'],
    ['%grpcerr <op> <number>', 'range: [0..100]'],
    ['%grpctraffic <op> <number>', 'range: [0..100]'],
    ['http <op> <number>', 'unit: requests per second'],
    ['%httperr <op> <number>', 'range: [0..100]'],
    ['%httptraffic <op> <number>', 'range: [0..100]'],
    ['mtls', `will auto-enable 'security' display option`],
    ['protocol <op> <protocol>', 'grpc, http, tcp, etc..'],
    ['responsetime <op> <number>', `unit: millis, will auto-enable 'P95 response time' edge labels`],
    ['sourceprincipal <op> <principal>'],
    ['tcp <op> <number>', 'unit: bytes per second'],
    ['throughput <op> <number>', `unit: bytes per second, will auto-enable 'request throughput' edge labels`],
    ['traffic', 'any traffic for any protocol']
  ];

  const exampleColumns: ThProps[] = [{ title: 'Expression' }, { title: 'Description' }];

  const exampleRows: IRow[] = [
    ['label:region', `nodes with the 'region' label. This tests for label existence, the label value is ignored.`],
    ['!label:region', `nodes without the 'region' label. This tests for label existence, the label value is ignored.`],
    ['label:region = east', `nodes with 'region' label equal to 'east'`],
    [
      'label:region != east',
      `nodes with 'region' label not equal to 'east'.  Note, "!label:region = east" is invalid, leading negation is valid only for label existence.`
    ],
    ['name = reviews', `nodes with app or service name or workload name equal to 'reviews'`],
    ['name not contains rev', `"nodes with app, service name and workload name not containing 'rev'`],
    ['app startswith product', `nodes with app starting with 'product'`],
    ['app != details and version=v1', `nodes with app not equal to 'details' and with version equal to 'v1'`],
    ['!outofmesh', `nodes out of mesh (With no sidecar and no Istio Ambient components)`],
    ['httpin > 0.5', `nodes with inbound http rate > 0.5 rps`],
    ['tcpout >= 1000', `nodes with outbound tcp rates >= 1000 bps`],
    ['!traffic', 'edges with no traffic'],
    ['http > 0.5', `edges with http rate > 0.5 rps`],
    ['rt > 500', `edges with response time > 500ms. (requires response time edge labels)`],
    ['%httptraffic >= 50.0', `edges with >= 50% of the outbound http request traffic of the parent`],
    ['node = svc and svc startswith det or !traffic', 'service node starting with "det" or edges with no traffic'],
    ['rank <= 2', 'nodes with a top 2 ranking']
  ];

  const nodeColumns: ThProps[] = [{ title: 'Expression' }, { title: 'Notes' }];

  const nodeRows: IRow[] = [
    ['app <op> <appName>', 'tests against canonical service'],
    ['cluster <op> <clusterName>'],
    ['grpcin <op> <number>', 'unit: requests per second'],
    ['grpcout <op> <number>', 'unit: requests per second'],
    ['httpin <op> <number>', 'unit: requests per second'],
    ['httpout <op> <number>', 'unit: requests per second'],
    ['label:<label> <op> <value>', '<label> is a k8s label on the service, workload, etc'],
    ['name <op> <string>', 'tests against canonical service, operation, service and workload names'],
    ['namespace <op> <namespaceName>'],
    ['node <op> <nodeType>', 'nodeType: app | operation | service | workload | unknown'],
    ['operation <op> <operationName>'],
    ['rank <op> <number>', 'unit: 1..100'],
    ['service <op> <serviceName>'],
    ['version <op> <string>', 'tests against canonical revision'],
    ['tcpin <op> <number>', 'unit: bytes per second'],
    ['tcpout <op> <number>', 'unit: bytes per second'],
    ['workload <op> <workloadName>'],
    ['circuitbreaker'],
    ['faultinjection'],
    ['healthy', 'is not degraded or failing.'],
    ['idle', `will auto-enable 'idle nodes' display option`],
    ['mirroring'],
    ['outside', 'is outside of requested namespaces'],
    ['requestrouting'],
    ['requesttimeout'],
    ['outofmesh'],
    ['serviceentry'],
    ['tcptrafficshifting'],
    ['trafficshifting'],
    ['trafficsource', `has only outbound edges`],
    ['virtualservice'],
    ['workloadentry']
  ];

  const noteColumns: ThProps[] = [{ title: 'Usage Note', width: 10 }]; //style: text-align: left

  const noteRows: IRow[] = [
    ['Press Tab key to autocomplete operands.'],
    ['OR has precedence over AND.  Parentheses are not supported.'],
    ['Use OR to combine node and edge criteria.'],
    ['Use "<operand> = NaN" to test for no activity. Use "!= NaN" for any activity. (e.g. httpout = NaN)'],
    [`Unary operands may optionally be prefixed with "is" or "has". (i.e. "has mtls")`],
    ['The "name" operand expands internally to an "OR" expression (an "AND" when negated).'],
    ['For the configured app and version labels, use the "app" and "version" Node operands, as opposed to "label:".'],
    ['Abbreviate: ns|namespace, svc|service, se|serviceentry, wl|workload, we|workloadentry, op|operation'],
    ['Abbreviate: rt|responsetime, om|outofmesh, vs|virtualservice'],
    ['Abbreviate: cb|circuitbreaker, fi|faultinjection, rr|requestrouting, rto|requesttimeout, ts|trafficshifting'],
    ['Hiding nodes will automatically hide connected edges.'],
    ['Hiding edges will automatically hide nodes left with no visible edges.'],
    ['Hiding "healthy" nodes may still leave valid, healthy edges in the graph.']
  ];

  const operatorColumns: ThProps[] = [{ title: 'Operator' }, { title: 'Description' }];

  const operatorRows: IRow[] = [
    ['! | not <unary expression>', `negation`],
    ['=', `equals`],
    ['!=', `not equals`],
    ['endswith | $=', `ends with, strings only`],
    ['!endswith | !$=', `not ends with, strings only`],
    ['startswith | ^=', `starts with, strings only`],
    ['!startswith | !^=', `not starts with, strings only`],
    ['contains | *=', 'contains, strings only'],
    ['!contains | !*=', 'not contains, strings only'],
    ['>', `greater than`],
    ['>=', `greater than or equals`],
    ['<', `less than`],
    ['<=', `less than or equals`]
  ];

  const getTable = (columns: ThProps[], rows: IRow[]): React.ReactNode => {
    return (
      <Table>
        <Thead>
          <Tr>
            {columns.map((column, index) => (
              <Th key={`column_${index}`} dataLabel={column.title} width={column.width}>
                {column.title}
              </Th>
            ))}
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((row, index) => (
            <Tr key={`row_${index}`}>
              {(row as IRowCell[])?.map((cell, index) => (
                <Td key={`cell_${index}`} dataLabel={columns[index].title}>
                  {cell}
                </Td>
              ))}
            </Tr>
          ))}
        </Tbody>
      </Table>
    );
  };

  const exampleTable = getTable(exampleColumns, exampleRows);
  const nodeTable = getTable(nodeColumns, nodeRows);
  const edgeTable = getTable(edgeColumns, edgeRows);
  const operatorTable = getTable(operatorColumns, operatorRows);
  const noteTable = getTable(noteColumns, noteRows);

  return (
    <>
      <ReactResizeDetector
        refreshMode={'debounce'}
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
