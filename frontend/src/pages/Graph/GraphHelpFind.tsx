import * as React from 'react';
import { useTopologyResize } from 'utils/ResizeDetectorUtils';
import { Tab, Popover, PopoverPosition } from '@patternfly/react-core';
import type { ThProps, IRow } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { SimpleTabs } from 'components/Tab/SimpleTabs';
import { PFColors } from 'components/Pf/PfColors';
import { SimpleTable } from 'components/Table/SimpleTable';
import { useKialiTranslation } from 'utils/I18nUtils';

export interface GraphHelpFindProps {
  children?: React.ReactNode;
  className?: string;
  isVisible: boolean;
  onClose: () => void;
}

const height = 'auto';
const maxHeight = '34rem';
const maxWidth = '37rem';
const width = maxWidth;
const contentWidth = '34.5rem';

const tabFont: React.CSSProperties = {
  fontSize: 'var(--kiali-global--font-size)'
};

const popoverStyle = kialiStyle({
  height: height,
  maxHeight: maxHeight,
  maxWidth: maxWidth,
  overflow: 'hidden',
  overflowX: 'auto',
  overflowY: 'auto',
  width: width
});

const prefaceStyle = kialiStyle({
  fontSize: '0.75rem',
  color: PFColors.ColorLight100,
  backgroundColor: PFColors.Blue600,
  width: contentWidth,
  height: '4rem',
  marginTop: '0.25rem',
  padding: '0.25rem',
  resize: 'none',
  overflowY: 'hidden'
});

export const GraphHelpFind: React.FC<GraphHelpFindProps> = (props: GraphHelpFindProps) => {
  const { t } = useKialiTranslation();
  // Incrementing mock counter to force a re-render in React hooks
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  const handleResize = (): void => {
    forceUpdate();
  };

  useTopologyResize(handleResize);

  const preface = t(
    'You can use the Find and Hide fields to highlight or hide graph edges and nodes. Each field accepts expressions using the language described below. Preset expressions are available via the dropdown. Hide takes precedence when using Find and Hide together.'
  );

  const edgeColumns: ThProps[] = [{ title: t('Expression') }, { title: t('Notes') }];

  const edgeRows: IRow[] = [
    { cells: ['destprincipal <op> <principal>'] },
    { cells: ['grpc <op> <number>', t('unit: requests per second')] },
    { cells: ['%grpcerr <op> <number>', t('range: [0..100]')] },
    { cells: ['%grpctraffic <op> <number>', t('range: [0..100]')] },
    { cells: ['http <op> <number>', t('unit: requests per second')] },
    { cells: ['%httperr <op> <number>', t('range: [0..100]')] },
    { cells: ['%httptraffic <op> <number>', t('range: [0..100]')] },
    { cells: ['mtls', t("will auto-enable 'security' display option")] },
    { cells: ['protocol <op> <protocol>', t('grpc, http, tcp, etc..')] },
    {
      cells: ['responsetime <op> <number>', t("unit: millis, will auto-enable 'P95 response time' edge labels")]
    },
    { cells: ['sourceprincipal <op> <principal>'] },
    { cells: ['tcp <op> <number>', t('unit: bytes per second')] },
    {
      cells: [
        'throughput <op> <number>',
        t("unit: bytes per second, will auto-enable 'request throughput' edge labels")
      ]
    },
    { cells: ['traffic', t('any traffic for any protocol')] }
  ];

  const exampleColumns: ThProps[] = [{ title: t('Expression') }, { title: t('Description') }];

  const exampleRows: IRow[] = [
    {
      cells: [
        'label:region',
        t("nodes with the 'region' label. This tests for label existence, the label value is ignored.")
      ]
    },
    {
      cells: [
        '!label:region',
        t("nodes without the 'region' label. This tests for label existence, the label value is ignored.")
      ]
    },
    { cells: ['label:region = east', t("nodes with 'region' label equal to 'east'")] },
    {
      cells: [
        'label:region != east',
        t(
          "nodes with 'region' label not equal to 'east'.  Note, \"!label:region = east\" is invalid, leading negation is valid only for label existence."
        )
      ]
    },
    {
      cells: ['name = reviews', t("nodes with app or service name or workload name equal to 'reviews'")]
    },
    {
      cells: ['name not contains rev', t("\"nodes with app, service name and workload name not containing 'rev'")]
    },
    { cells: ['app startswith product', t("nodes with app starting with 'product'")] },
    {
      cells: [
        'app != details and version=v1',
        t("nodes with app not equal to 'details' and with version equal to 'v1'")
      ]
    },
    {
      cells: ['!outofmesh', t('nodes out of mesh (With no sidecar and no Istio Ambient components)')]
    },
    { cells: ['httpin > 0.5', t('nodes with inbound http rate > 0.5 rps')] },
    { cells: ['tcpout >= 1000', t('nodes with outbound tcp rates >= 1000 bps')] },
    { cells: ['!traffic', t('edges with no traffic')] },
    { cells: ['http > 0.5', t('edges with http rate > 0.5 rps')] },
    {
      cells: ['rt > 500', t('edges with response time > 500ms. (requires response time edge labels)')]
    },
    {
      cells: ['%httptraffic >= 50.0', t('edges with >= 50% of the outbound http request traffic of the parent')]
    },
    {
      cells: [
        'node = svc and svc startswith det or !traffic',
        t('service node starting with "det" or edges with no traffic')
      ]
    },
    { cells: ['rank <= 2', t('nodes with a top 2 ranking')] }
  ];

  const nodeColumns: ThProps[] = [{ title: t('Expression') }, { title: t('Notes') }];

  const nodeRows: IRow[] = [
    { cells: ['app <op> <appName>', t('tests against canonical service')] },
    { cells: ['cluster <op> <clusterName>'] },
    { cells: ['grpcin <op> <number>', t('unit: requests per second')] },
    { cells: ['grpcout <op> <number>', t('unit: requests per second')] },
    { cells: ['httpin <op> <number>', t('unit: requests per second')] },
    { cells: ['httpout <op> <number>', t('unit: requests per second')] },
    {
      cells: ['label:<label> <op> <value>', t('<label> is a k8s label on the service, workload, etc')]
    },
    {
      cells: ['name <op> <string>', t('tests against canonical service, operation, service and workload names')]
    },
    { cells: ['namespace <op> <namespaceName>'] },
    {
      cells: ['node <op> <nodeType>', t('nodeType: app | operation | service | workload | unknown')]
    },
    { cells: ['operation <op> <operationName>'] },
    { cells: ['rank <op> <number>', t('unit: 1..100')] },
    { cells: ['service <op> <serviceName>'] },
    { cells: ['version <op> <string>', t('tests against canonical revision')] },
    { cells: ['tcpin <op> <number>', t('unit: bytes per second')] },
    { cells: ['tcpout <op> <number>', t('unit: bytes per second')] },
    { cells: ['workload <op> <workloadName>'] },
    { cells: ['circuitbreaker'] },
    { cells: ['faultinjection'] },
    { cells: ['healthy', t('is not degraded or failing.')] },
    { cells: ['idle', t("will auto-enable 'idle nodes' display option")] },
    { cells: ['mirroring'] },
    { cells: ['outside', t('is outside of requested namespaces')] },
    { cells: ['requestrouting'] },
    { cells: ['requesttimeout'] },
    { cells: ['outofmesh'] },
    { cells: ['serviceentry'] },
    { cells: ['tcptrafficshifting'] },
    { cells: ['trafficshifting'] },
    { cells: ['trafficsource', t('has only outbound edges')] },
    { cells: ['virtualservice'] },
    { cells: ['workloadentry'] }
  ];

  const noteColumns: ThProps[] = [{ title: t('Usage Note'), width: 10 }];

  const noteRows: IRow[] = [
    { cells: [t('Press Tab key to autocomplete operands.')] },
    { cells: [t('OR has precedence over AND.  Parentheses are not supported.')] },
    { cells: [t('Use OR to combine node and edge criteria.')] },
    {
      cells: [t('Use "<operand> = NaN" to test for no activity. Use "!= NaN" for any activity. (e.g. httpout = NaN)')]
    },
    { cells: [t('Unary operands may optionally be prefixed with "is" or "has". (i.e. "has mtls")')] },
    { cells: [t('The "name" operand expands internally to an "OR" expression (an "AND" when negated).')] },
    {
      cells: [
        t(
          'For the configured app and version labels, use the "app" and "version" Node operands, as opposed to "label:".'
        )
      ]
    },
    {
      cells: [t('Abbreviate: ns|namespace, svc|service, se|serviceentry, wl|workload, we|workloadentry, op|operation')]
    },
    { cells: [t('Abbreviate: rt|responsetime, om|outofmesh, vs|virtualservice')] },
    {
      cells: [
        t('Abbreviate: cb|circuitbreaker, fi|faultinjection, rr|requestrouting, rto|requesttimeout, ts|trafficshifting')
      ]
    },
    { cells: [t('Hiding nodes will automatically hide connected edges.')] },
    { cells: [t('Hiding edges will automatically hide nodes left with no visible edges.')] },
    { cells: [t('Hiding "healthy" nodes may still leave valid, healthy edges in the graph.')] }
  ];

  const operatorColumns: ThProps[] = [{ title: t('Operator') }, { title: t('Description') }];

  const operatorRows: IRow[] = [
    { cells: ['! | not <unary expression>', t('negation')] },
    { cells: ['=', t('equals')] },
    { cells: ['!=', t('not equals')] },
    { cells: ['endswith | $=', t('ends with, strings only')] },
    { cells: ['!endswith | !$=', t('not ends with, strings only')] },
    { cells: ['startswith | ^=', t('starts with, strings only')] },
    { cells: ['!startswith | !^=', t('not starts with, strings only')] },
    { cells: ['contains | *=', t('contains, strings only')] },
    { cells: ['!contains | !*=', t('not contains, strings only')] },
    { cells: ['>', t('greater than')] },
    { cells: ['>=', t('greater than or equals')] },
    { cells: ['<', t('less than')] },
    { cells: ['<=', t('less than or equals')] }
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
      {props.isVisible ? (
        <Popover
          data-test="graph-find-hide-help"
          className={popoverStyle}
          position={PopoverPosition.auto}
          isVisible={props.isVisible}
          hideOnOutsideClick={false}
          shouldClose={props.onClose}
          headerContent={
            <div>
              <span>{t('Graph Find/Hide')}</span>
            </div>
          }
          bodyContent={
            <>
              <textarea className={`${prefaceStyle}`} readOnly={true} value={preface} />

              <SimpleTabs id="graph_find_help_tabs" defaultTab={0} style={{ width: contentWidth }}>
                <Tab style={tabFont} eventKey={0} title={t('Examples')}>
                  {exampleTable}
                </Tab>

                <Tab style={tabFont} eventKey={1} title={t('Nodes')}>
                  {nodeTable}
                </Tab>

                <Tab style={tabFont} eventKey={2} title={t('Edges')}>
                  {edgeTable}
                </Tab>

                <Tab style={tabFont} eventKey={3} title={t('Operators')}>
                  {operatorTable}
                </Tab>

                <Tab style={tabFont} eventKey={4} title={t('Usage Notes')}>
                  {noteTable}
                </Tab>
              </SimpleTabs>
            </>
          }
        >
          <>{props.children}</>
        </Popover>
      ) : (
        <>{props.children}</>
      )}
    </>
  );
};
