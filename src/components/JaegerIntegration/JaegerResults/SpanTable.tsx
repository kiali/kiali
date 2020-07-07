import * as React from 'react';
import { JaegerInfo, Span } from '../../../types/JaegerInfo';
import { Table, TableHeader, TableBody, IRow, expandable, RowWrapperProps } from '@patternfly/react-table';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { Tooltip } from '@patternfly/react-core';
import { KialiAppState } from '../../../store/Store';
import { connect } from 'react-redux';
import { formatDuration } from './transform';
import history from '../../../app/History';
import { Link } from 'react-router-dom';
import { serverConfig } from '../../../config';
import { SpanTabsTags } from './SpanTabsTags';
import { getWorkloadFromSpan, isErrorTag } from '../JaegerHelper';
import { css } from '@patternfly/react-styles';
import styles from '@patternfly/react-styles/css/components/Table/table';
import { PfColors } from '../../Pf/PfColors';

interface SpanDetailProps {
  spans: Span[];
  jaegerInfo?: JaegerInfo;
}

interface SpanDetailState {
  spanSelected?: Span;
  columns: any;
  rows: any;
}

export class SpanTableC extends React.Component<SpanDetailProps, SpanDetailState> {
  constructor(props: SpanDetailProps) {
    super(props);
    this.state = {
      columns: [
        {
          title: 'Operation',
          cellFormatters: [expandable]
        },
        'Service',
        { title: 'Duration' },
        '',
        ''
      ],
      rows: this.getRows()
    };
  }

  componentDidUpdate(prevProps: Readonly<SpanDetailProps>): void {
    if (prevProps.spans !== this.props.spans) {
      this.setState({ rows: this.getRows() });
    }
  }

  private goService = (service: string = this.props.spans[0].process.serviceName, extra: string = '') => {
    if (service) {
      const ns = service.split('.')[1] || serverConfig.istioNamespace;
      const srv = service.split('.')[0];
      return '/namespaces/' + ns + '/services/' + srv + extra;
    } else {
      return undefined;
    }
  };

  private goLogsWorkloads = (workload: string, namespace: string) => {
    return '/namespaces/' + namespace + '/workloads/' + workload + '?tab=logs';
  };

  private getNodeLog = (sp: Span) => {
    const srv = sp.process.serviceName.split('.')[0];
    let workloadNs = getWorkloadFromSpan(sp);
    if (!workloadNs && this.props.jaegerInfo && this.props.jaegerInfo.whiteListIstioSystem.includes(srv)) {
      // Special case (why?)
      workloadNs = {
        workload: srv === 'jaeger-query' ? 'jaeger' : srv,
        namespace: serverConfig.istioNamespace
      };
    }
    if (workloadNs) {
      const path = this.goLogsWorkloads(workloadNs.workload, workloadNs.namespace);
      return (
        <Tooltip content={<>View logs of workload {workloadNs.workload}</>}>
          <Link to={path} onClick={() => history.push(path)}>
            View logs
          </Link>
        </Tooltip>
      );
    }

    return <>Logs not found</>;
  };

  private getRows = () => {
    let rows: (IRow | string)[] = [];
    this.props.spans.map(span => {
      const service = span.process.serviceName === 'jaeger-query' ? span.process.serviceName : span.operationName;
      const linkToService = this.goService(service);
      const linkToMetrics = this.goService(service, '?tab=metrics');
      const serviceDefinition = (
        <>
          {span.operationName.split('.')[0] +
            (span.operationName.split('.')[1] ? '(' + span.operationName.split('.')[1] + ')' : '')}
          {span.tags.some(isErrorTag) && (
            <ExclamationCircleIcon color={PfColors.Red200} style={{ marginLeft: '10px' }} />
          )}
        </>
      );
      let number = rows.push({
        isOpen: false,
        cells: [
          {
            title: linkToService ? (
              <Tooltip content={<>Go to Service {span.operationName.split('.')[0]}</>}>
                <Link to={linkToService} onClick={() => history.push(linkToService)}>
                  {serviceDefinition}
                </Link>
              </Tooltip>
            ) : (
              serviceDefinition
            )
          },
          {
            title: (
              <Tooltip
                content={
                  <>
                    {span.operationName}({span.process.serviceName})
                  </>
                }
              >
                <span>{span.operationName.slice(0, 40)}...</span>
              </Tooltip>
            )
          },
          { title: <>{formatDuration(span.duration)}</> },
          {
            title: linkToMetrics ? (
              <Tooltip content={<>View metrics of {span.operationName.split('.')[0]}</>}>
                <Link to={linkToMetrics} onClick={() => history.push(linkToMetrics)}>
                  View metrics
                </Link>
              </Tooltip>
            ) : (
              <></>
            )
          },
          { title: this.getNodeLog(span) }
        ]
      });
      rows.push({
        parent: number - 1,
        fullWidth: true,
        cells: [{ title: <SpanTabsTags span={span} /> }]
      });
      return undefined;
    });
    return rows;
  };

  private customRowWrapper = ({ trRef, className, rowProps, row: { isExpanded, isHeightAuto }, ...props }) => {
    const dangerErrorStyle = {
      borderLeft: '3px solid var(--pf-global--danger-color--100)'
    };

    const span = this.props.spans[rowProps.rowIndex - Math.round(rowProps.rowIndex / 2)];
    const hasError = span && span.tags.some(isErrorTag);
    return (
      <tr
        {...props}
        ref={trRef}
        className={css(
          className,
          'custom-static-class',
          isExpanded !== undefined && styles.tableExpandableRow,
          isExpanded && styles.modifiers.expanded,
          isHeightAuto && styles.modifiers.heightAuto
        )}
        hidden={isExpanded !== undefined && !isExpanded}
        style={hasError ? dangerErrorStyle : { borderLeft: '3px solid var(--pf-global--primary-color--100)' }}
      />
    );
  };

  private onCollapse = (_, rowKey, isOpen) => {
    const { rows } = this.state;
    /**
     * Please do not use rowKey as row index for more complex tables.
     * Rather use some kind of identifier like ID passed with each row.
     */
    rows[rowKey].isOpen = isOpen;
    this.setState({
      rows
    });
  };

  render() {
    const { columns, rows } = this.state;
    return (
      <Table
        aria-label="SpanTable"
        className={'spanTracingTagsTable'}
        onCollapse={this.onCollapse}
        rows={rows}
        cells={columns}
        rowWrapper={(props: RowWrapperProps) =>
          this.customRowWrapper({
            trRef: props.trRef,
            className: props.className,
            rowProps: props.rowProps,
            row: props.row as any,
            ...props
          })
        }
      >
        <TableHeader />
        <TableBody />
      </Table>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    jaegerInfo: state.jaegerState.info
  };
};

export const SpanTable = connect(mapStateToProps)(SpanTableC);
