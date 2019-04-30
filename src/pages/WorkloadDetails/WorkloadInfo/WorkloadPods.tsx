import * as React from 'react';
import { ContainerInfo, ObjectValidation, Pod, Reference } from '../../../types/IstioObjects';
import { Col, OverlayTrigger, Row, Table, Tooltip } from 'patternfly-react';
import * as resolve from 'table-resolver';
import { ConfigIndicator } from '../../../components/ConfigValidation/ConfigIndicator';
import Labels from '../../../components/Label/Labels';

interface PodsGroup {
  commonPrefix: string;
  names: string[];
  validations: ObjectValidation[];
  commonLabels: { [key: string]: string };
  createdAtStart: number;
  createdAtEnd: number;
  createdBy: Reference[];
  istioContainers?: ContainerInfo[];
  istioInitContainers?: ContainerInfo[];
  numberOfPods: number;
  status: string;
}

type WorkloadPodsProps = {
  namespace: string;
  pods: Pod[];
  validations: { [key: string]: ObjectValidation };
};

type WorkloadPodsState = {
  groups: PodsGroup[];
};

class WorkloadPods extends React.Component<WorkloadPodsProps, WorkloadPodsState> {
  static getDerivedStateFromProps(props: WorkloadPodsProps, currentState: WorkloadPodsState) {
    return { groups: WorkloadPods.updateGroups(props) };
  }
  static groupKey = (pod: Pod): string => {
    return JSON.stringify({
      cb: pod.createdBy ? pod.createdBy.map(ref => ref.name).join(',') : '',
      ic: pod.istioContainers ? pod.istioContainers.map(ctnr => ctnr.name + ctnr.image).join(',') : '',
      iic: pod.istioInitContainers ? pod.istioInitContainers.map(ctnr => ctnr.name + ctnr.image).join(',') : ''
    });
  };

  static updateGroups(props: WorkloadPodsProps) {
    if (props.pods) {
      return WorkloadPods.groupPods(props.pods, props.validations);
    } else {
      return [];
    }
  }

  static mergeInGroup = (group: PodsGroup, pod: Pod, validation: ObjectValidation) => {
    group.names.push(pod.name);
    // Update common prefix
    group.commonPrefix = WorkloadPods.commonPrefix(group.commonPrefix, pod.name);
    // Update validations
    group.validations.push(validation);
    // Remove any group.commonLabels that is not found in pod
    Object.keys(group.commonLabels).map(key => {
      const val = group.commonLabels[key];
      if (!pod.labels || val !== pod.labels[key]) {
        delete group.commonLabels[key];
      }
    });
    // Update start/end timestamps
    const podTimestamp = new Date(pod.createdAt).getTime();
    if (podTimestamp < group.createdAtStart) {
      group.createdAtStart = podTimestamp;
    } else if (podTimestamp > group.createdAtEnd) {
      group.createdAtEnd = podTimestamp;
    }
    group.numberOfPods++;
  };

  static groupPods = (pods: Pod[], validations: { [key: string]: ObjectValidation }): PodsGroup[] => {
    const allGroups = new Map<string, PodsGroup>();
    pods.forEach(pod => {
      const key = WorkloadPods.groupKey(pod);
      if (allGroups.has(key)) {
        const group = allGroups.get(key)!;
        WorkloadPods.mergeInGroup(group, pod, validations[pod.name]);
      } else {
        // Make a copy of the labels. This object might be modified later, so do not use the original reference.
        const labels: { [key: string]: string } = {};
        if (pod.labels) {
          Object.keys(pod.labels).map(k => {
            labels[k] = pod.labels![k];
          });
        }
        const timestamp = new Date(pod.createdAt).getTime();
        allGroups.set(key, {
          commonPrefix: pod.name,
          names: [pod.name],
          validations: [validations[pod.name]],
          commonLabels: labels,
          createdAtStart: timestamp,
          createdAtEnd: timestamp,
          createdBy: pod.createdBy,
          istioContainers: pod.istioContainers,
          istioInitContainers: pod.istioInitContainers,
          numberOfPods: 1,
          status: pod.status
        });
      }
    });
    return Array.from(allGroups.values()).sort((a, b) => a.commonPrefix.localeCompare(b.commonPrefix));
  };

  static commonPrefix = (s1: string, s2: string): string => {
    let i = 0;
    while (i < s1.length && i < s2.length && s1.charAt(i) === s2.charAt(i)) {
      i++;
    }
    return s1.substring(0, i);
  };

  constructor(props: WorkloadPodsProps) {
    super(props);
    this.state = {
      groups: WorkloadPods.updateGroups(props)
    };
  }

  validation(pod: PodsGroup): ObjectValidation[] {
    return pod.validations;
  }

  headerFormat = (label, { column }) => <Table.Heading className={column.property}>{label}</Table.Heading>;
  cellFormat = value => {
    return <Table.Cell>{value}</Table.Cell>;
  };

  renderName(group: PodsGroup, u: Number) {
    return group.numberOfPods > 1 ? (
      <OverlayTrigger
        // Prettier makes irrelevant line-breaking clashing with tslint
        // prettier-ignore
        overlay={<Tooltip id={'pod_names_' + u} title="Pod Names">{group.names.join(', ')}</Tooltip>}
        placement="top"
        trigger={['hover', 'focus']}
      >
        <span>{group.commonPrefix + '... (' + group.numberOfPods + ' replicas)'}</span>
      </OverlayTrigger>
    ) : (
      group.commonPrefix + ' (1 replica)'
    );
  }
  renderCreated(group: PodsGroup) {
    return group.createdAtStart === group.createdAtEnd ? (
      <>{new Date(group.createdAtStart).toLocaleString()}</>
    ) : (
      <>{new Date(group.createdAtStart).toLocaleString() + ' and ' + new Date(group.createdAtEnd).toLocaleString()}</>
    );
  }

  columns() {
    return {
      columns: [
        {
          property: 'status',
          header: {
            label: 'Status',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat],
            props: {
              align: 'text-center'
            }
          }
        },
        {
          property: 'name',
          header: {
            label: 'Name',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        },
        {
          property: 'createdAt',
          header: {
            label: 'Created at',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        },
        {
          property: 'createdBy',
          header: {
            label: 'Created by',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        },
        {
          property: 'labels',
          header: {
            label: 'Labels',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        },
        {
          property: 'istioInitContainers',
          header: {
            label: 'Istio Init Containers',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        },
        {
          property: 'istioContainers',
          header: {
            label: 'Istio Containers',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        },
        {
          property: 'podStatus',
          header: {
            label: 'Phase',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        }
      ]
    };
  }
  rows() {
    return (this.state.groups || []).map((group, vsIdx) => {
      const generateRows = {
        id: vsIdx,
        status: (
          <ConfigIndicator id={vsIdx + '-config-validation'} validations={this.validation(group)} definition={true} />
        ),
        name: this.renderName(group, vsIdx),
        createdAt: this.renderCreated(group),
        createdBy:
          group.createdBy && group.createdBy.length > 0
            ? group.createdBy.map(ref => ref.name + ' (' + ref.kind + ')').join(', ')
            : '',
        labels: <Labels key={'labels' + vsIdx} labels={group.commonLabels} />,
        istioInitContainers: group.istioInitContainers
          ? group.istioInitContainers.map(c => `${c.image}`).join(', ')
          : '',
        istioContainers: group.istioContainers ? group.istioContainers.map(c => `${c.image}`).join(', ') : '',
        podStatus: group.status
      };

      return generateRows;
    });
  }

  render() {
    return (
      <>
        <Row className="card-pf-body">
          <Col xs={12}>
            <Table.PfProvider
              columns={this.columns().columns}
              striped={true}
              bordered={true}
              hover={true}
              dataTable={true}
            >
              <Table.Header headerRows={resolve.headerRows(this.columns())} />
              <Table.Body rows={this.rows()} rowKey="id" />
            </Table.PfProvider>
          </Col>
        </Row>
      </>
    );
  }
}

export default WorkloadPods;
