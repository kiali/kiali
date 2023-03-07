import * as React from 'react';
import ReactResizeDetector from 'react-resize-detector';
import { Tab, Popover, PopoverPosition } from '@patternfly/react-core';
import { ICell, Table, TableBody, TableHeader, TableVariant, cellWidth } from '@patternfly/react-table';
import { style } from 'typestyle';
import SimpleTabs from 'components/Tab/SimpleTabs';

export interface GraphHelpFindProps {
  onClose: () => void;
  className?: string;
}

const tabFont: React.CSSProperties = {
  fontSize: 'var(--kiali-global--font-size)'
};

const contentWidth = '540px';

export default class GraphHelpFind extends React.Component<GraphHelpFindProps> {
  private onResize = () => {
    this.forceUpdate();
  };

  render() {
    const width = '600px';
    const maxWidth = '604px';
    const popoverStyle = style({
      width: width,
      maxWidth: maxWidth,
      height: '550px',
      overflow: 'hidden',
      overflowX: 'auto',
      overflowY: 'auto'
    });
    const prefaceStyle = style({
      fontSize: '12px',
      color: '#fff',
      backgroundColor: '#003145',
      width: contentWidth,
      height: '80px',
      padding: '5px',
      resize: 'none',
      overflowY: 'hidden'
    });
    const preface =
      'You can use the Find and Hide fields to highlight or hide graph edges and nodes. Each field accepts ' +
      'expressions using the language described below. Preset expressions are available via the dropdown. ' +
      'Hide takes precedence when using Find and Hide together. Uncheck the "Compressed Hide" Display ' +
      'option for hidden elements to retain their space.';

    return (
      <>
        <ReactResizeDetector
          refreshMode={'debounce'}
          refreshRate={100}
          skipOnMount={true}
          handleWidth={true}
          handleHeight={true}
          onResize={this.onResize}
        />
        <Popover
          data-test="graph-find-hide-help"
          className={popoverStyle}
          position={PopoverPosition.auto}
          isVisible={true}
          hideOnOutsideClick={false}
          shouldClose={this.props.onClose}
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
                  <Table
                    header={<></>}
                    variant={TableVariant.compact}
                    cells={this.exampleColumns()}
                    rows={this.exampleRows()}
                  >
                    <TableHeader />
                    <TableBody />
                  </Table>
                </Tab>
                <Tab style={tabFont} eventKey={1} title="Nodes">
                  <Table
                    header={<></>}
                    variant={TableVariant.compact}
                    cells={this.nodeColumns()}
                    rows={this.nodeRows()}
                  >
                    <TableHeader />
                    <TableBody />
                  </Table>
                </Tab>
                <Tab style={tabFont} eventKey={2} title="Edges">
                  <Table
                    header={<></>}
                    variant={TableVariant.compact}
                    cells={this.edgeColumns()}
                    rows={this.edgeRows()}
                  >
                    <TableHeader />
                    <TableBody />
                  </Table>
                </Tab>
                <Tab style={tabFont} eventKey={3} title="Operators">
                  <Table
                    header={<></>}
                    variant={TableVariant.compact}
                    cells={this.operatorColumns()}
                    rows={this.operatorRows()}
                  >
                    <TableHeader />
                    <TableBody />
                  </Table>
                </Tab>
                <Tab style={tabFont} eventKey={4} title="Usage Notes">
                  <Table
                    header={<></>}
                    variant={TableVariant.compact}
                    cells={this.noteColumns()}
                    rows={this.noteRows()}
                  >
                    <TableHeader />
                    <TableBody />
                  </Table>
                </Tab>
              </SimpleTabs>
            </>
          }
        >
          <>{this.props.children}</>
        </Popover>
      </>
    );
  }

  private edgeColumns = (): ICell[] => {
    return [{ title: 'Expression' }, { title: 'Notes' }];
  };
  private edgeRows = (): string[][] => {
    return [
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
  };

  private exampleColumns = (): ICell[] => {
    return [{ title: 'Expression' }, { title: 'Description' }];
  };
  private exampleRows = (): string[][] => {
    return [
      ['label:region', `nodes with the 'region' label. This tests for label existence, the label value is ignored.`],
      [
        '!label:region',
        `nodes without the 'region' label. This tests for label existence, the label value is ignored.`
      ],
      ['label:region = east', `nodes with 'region' label equal to 'east'`],
      [
        'label:region != east',
        `nodes with 'region' label not equal to 'east'.  Note, "!label:region = east" is invalid, leading negation is valid only for label existence.`
      ],
      ['name = reviews', `nodes with app or service name or workload name equal to 'reviews'`],
      ['name not contains rev', `"nodes with app, service name and workload name not containing 'rev'`],
      ['app startswith product', `nodes with app starting with 'product'`],
      ['app != details and version=v1', `nodes with app not equal to 'details' and with version equal to 'v1'`],
      ['!sc', `nodes without a sidecar`],
      ['httpin > 0.5', `nodes with inbound http rate > 0.5 rps`],
      ['tcpout >= 1000', `nodes with outbound tcp rates >= 1000 bps`],
      ['!traffic', 'edges with no traffic'],
      ['http > 0.5', `edges with http rate > 0.5 rps`],
      ['rt > 500', `edges with response time > 500ms. (requires response time edge labels)`],
      ['%httptraffic >= 50.0', `edges with >= 50% of the outbound http request traffic of the parent`],
      ['node = svc and svc startswith det or !traffic', 'service node starting with "det" or edges with no traffic'],
      ['rank <= 2', 'nodes with a top 2 ranking']
    ];
  };

  private nodeColumns = (): ICell[] => {
    return [{ title: 'Expression' }, { title: 'Notes' }];
  };
  private nodeRows = (): string[][] => {
    return [
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
      ['sidecar'],
      ['serviceentry'],
      ['tcptrafficshifting'],
      ['trafficshifting'],
      ['trafficsource', `has only outbound edges`],
      ['virtualservice'],
      ['workloadentry']
    ];
  };

  private noteColumns = (): ICell[] => {
    return [{ title: 'Usage Note', transforms: [cellWidth(10) as any], props: { style: { align: 'text-left' } } }];
  };
  private noteRows = (): string[][] => {
    return [
      ['Press Tab key to autocomplete operands.'],
      ['OR has precedence over AND.  Parentheses are not supported.'],
      ['Use OR to combine node and edge criteria.'],
      ['Use "<operand> = NaN" to test for no activity. Use "!= NaN" for any activity. (e.g. httpout = NaN)'],
      [`Unary operands may optionally be prefixed with "is" or "has". (i.e. "has mtls")`],
      ['The "name" operand expands internally to an "OR" expression (an "AND" when negated).'],
      ['For the configured app and version labels, use the "app" and "version" Node operands, as opposed to "label:".'],
      ['Abbreviate: ns|namespace, svc|service, se|serviceentry, wl|workload, we|workloadentry, op|operation'],
      ['Abbreviate: rt|responsetime, sc|sidecar, vs|virtualservice'],
      ['Abbreviate: cb|circuitbreaker, fi|faultinjection, rr|requestrouting, rto|requesttimeout, ts|trafficshifting'],
      ['Hiding nodes will automatically hide connected edges.'],
      ['Hiding edges will automatically hide nodes left with no visible edges.'],
      ['Hiding "healthy" nodes may still leave valid, healthy edges in the graph.']
    ];
  };

  private operatorColumns = (): ICell[] => {
    return [{ title: 'Operator' }, { title: 'Description' }];
  };
  private operatorRows = (): string[][] => {
    return [
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
  };
}
