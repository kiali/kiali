import * as React from 'react';
import { useTopologyResize } from 'utils/ResizeDetectorUtils';
import { Tab, Popover, PopoverPosition } from '@patternfly/react-core';
import type { ThProps, IRow } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { SimpleTabs } from 'components/Tab/SimpleTabs';
import { PFColors } from 'components/Pf/PfColors';
import { SimpleTable } from 'components/Table/SimpleTable';
import { useKialiTranslation } from 'utils/I18nUtils';

export interface MeshHelpFindProps {
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

export const MeshHelpFind: React.FC<MeshHelpFindProps> = (props: MeshHelpFindProps) => {
  const { t } = useKialiTranslation();
  // Incrementing mock counter to force a re-render in React hooks
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);

  const handleResize = (): void => {
    forceUpdate();
  };

  useTopologyResize(handleResize);

  const preface = t(
    'You can use the Find and Hide fields to highlight or hide mesh nodes and edges. Each field accepts expressions using the language described below. Preset expressions are available via the dropdown. Hide takes precedence when using Find and Hide together.'
  );

  const edgeColumns: ThProps[] = [{ title: t('Expression') }, { title: t('Notes') }];

  const edgeRows: IRow[] = [{ cells: [t('N/A Currently no Edge expressions')] }];

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
    { cells: ['name = test-kiali', t("nodes with infraName equal to 'test-kiali'")] },
    {
      cells: ['name not contains test', t("\"nodes with infraName not containing 'test'")]
    },
    { cells: ['name startswith test', t("nodes with infraName starting with 'test'")] },
    {
      cells: [
        'name != test-kiali and ns=test-ns',
        t("nodes with infraName not equal to 'test-kiali' and with namespace equal to 'test-ns'")
      ]
    },
    {
      cells: ['node = infra or name startswith test or !traffic', t('infra node or any node starting with "test"')]
    }
  ];

  const nodeColumns: ThProps[] = [{ title: t('Expression') }, { title: t('Notes') }];

  const nodeRows: IRow[] = [
    { cells: ['cluster <op> <clusterName>', t('nodes within the matching clusters')] },
    {
      cells: ['label:<label> <op> <value>', t('<label> is a k8s label on the service, workload, etc')]
    },
    { cells: ['name <op> <string>', t('tests against infraName')] },
    { cells: ['namespace <op> <namespaceName>', t('nodes within the matching namespaces')] },
    {
      cells: ['type <op> <infraType>', t('infraType: dataplane | istiod | kiali | metricStore | traceStore')]
    },
    { cells: ['healthy', t('is not degraded or failing.')] }
  ];

  const noteColumns: ThProps[] = [{ title: t('Usage Note'), width: 10 }];

  const noteRows: IRow[] = [
    { cells: [t('Press Tab key to autocomplete operands.')] },
    { cells: [t('OR has precedence over AND.  Parentheses are not supported.')] },
    { cells: [t('Use OR to combine node and edge criteria.')] },
    {
      cells: [t('Unary operands may optionally be prefixed with "is" or "has". (i.e. "is outofmesh")')]
    },
    { cells: [t('Abbreviate: ns|namespace, ms|metricStore, ts|traceStore')] },
    { cells: [t('Hiding nodes will automatically hide connected edges.')] },
    { cells: [t('Hiding edges will automatically hide nodes left with no visible edges.')] },
    {
      cells: [t('Hiding "healthy" nodes may still leave valid, healthy edges in the mesh.')]
    }
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
          data-test="mesh-find-hide-help"
          className={popoverStyle}
          position={PopoverPosition.auto}
          isVisible={props.isVisible}
          hideOnOutsideClick={false}
          shouldClose={props.onClose}
          headerContent={
            <div>
              <span>{t('Mesh Find/Hide')}</span>
            </div>
          }
          bodyContent={
            <>
              <textarea className={`${prefaceStyle}`} readOnly={true} value={preface} />

              <SimpleTabs id="mesh_find_help_tabs" defaultTab={0} style={{ width: contentWidth }}>
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
