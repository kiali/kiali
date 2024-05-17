import * as React from 'react';
import ReactResizeDetector from 'react-resize-detector';
import { Tab, Popover, PopoverPosition } from '@patternfly/react-core';
import { ThProps, IRow } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { SimpleTabs } from 'components/Tab/SimpleTabs';
import { PFColors } from 'components/Pf/PfColors';
import { SimpleTable } from 'components/SimpleTable';

export interface MeshHelpFindProps {
  children: React.ReactNode;
  className?: string;
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
  padding: '0.25rem',
  resize: 'none',
  overflowY: 'hidden'
});

export const MeshHelpFind: React.FC<MeshHelpFindProps> = (props: MeshHelpFindProps) => {
  // Incrementing mock counter to force a re-render in React hooks
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  const onResize = () => {
    forceUpdate();
  };

  const preface =
    'You can use the Find and Hide fields to highlight or hide mesh nodes and edges. Each field accepts ' +
    'expressions using the language described below. Preset expressions are available via the dropdown. ' +
    'Hide takes precedence when using Find and Hide together.';

  const edgeColumns: ThProps[] = [{ title: 'Expression' }, { title: 'Notes' }];

  const edgeRows: IRow[] = [{ cells: ['N/A Currently no Edge expressions'] }];

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
    { cells: ['name = test-kiali', `nodes with infraName equal to 'test-kiali'`] },
    { cells: ['name not contains test', `"nodes with infraName not containing 'test'`] },
    { cells: ['name startswith test', `nodes with infraName starting with 'test'`] },
    {
      cells: [
        'name != test-kiali and ns=test-ns',
        `nodes with infraName not equal to 'test-kiali' and with namespace equal to 'test-ns'`
      ]
    },
    {
      cells: ['node = infra or name startswith test or !traffic', 'infra node or any node starting with "test"']
    }
  ];

  const nodeColumns: ThProps[] = [{ title: 'Expression' }, { title: 'Notes' }];

  const nodeRows: IRow[] = [
    { cells: ['cluster <op> <clusterName>', 'nodes within the matching clusters'] },
    { cells: ['label:<label> <op> <value>', '<label> is a k8s label on the service, workload, etc'] },
    { cells: ['name <op> <string>', 'tests against infraName'] },
    { cells: ['namespace <op> <namespaceName>', 'nodes within the matching namespaces'] },
    { cells: ['type <op> <infraType>', 'infraType: dataplane | istiod | kiali | metricStore | traceStore'] },
    { cells: ['healthy', 'is not degraded or failing.'] }
  ];

  const noteColumns: ThProps[] = [{ title: 'Usage Note', width: 10 }];

  const noteRows: IRow[] = [
    { cells: ['Press Tab key to autocomplete operands.'] },
    { cells: ['OR has precedence over AND.  Parentheses are not supported.'] },
    { cells: ['Use OR to combine node and edge criteria.'] },
    { cells: [`Unary operands may optionally be prefixed with "is" or "has". (i.e. "is outofmesh")`] },
    { cells: ['Abbreviate: ns|namespace, ms|metricStore, ts|traceStore'] },
    { cells: ['Hiding nodes will automatically hide connected edges.'] },
    { cells: ['Hiding edges will automatically hide nodes left with no visible edges.'] },
    { cells: ['Hiding "healthy" nodes may still leave valid, healthy edges in the mesh.'] }
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
        data-test="mesh-find-hide-help"
        className={popoverStyle}
        position={PopoverPosition.auto}
        isVisible={true}
        hideOnOutsideClick={false}
        shouldClose={props.onClose}
        headerContent={
          <div>
            <span>Mesh Find/Hide</span>
          </div>
        }
        bodyContent={
          <>
            <textarea className={`${prefaceStyle}`} readOnly={true} value={preface} />

            <SimpleTabs id="mesh_find_help_tabs" defaultTab={0} style={{ width: contentWidth }}>
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
