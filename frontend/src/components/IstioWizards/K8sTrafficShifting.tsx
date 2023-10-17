import * as React from 'react';
import { Table, Thead, Tbody, Tr, Td, Th, IRowCell, ThProps } from '@patternfly/react-table';
import { Slider } from './Slider/Slider';
import { kialiStyle } from 'styles/StyleUtils';
import { Button, ButtonVariant, TooltipPosition } from '@patternfly/react-core';
import { EqualizerIcon } from '@patternfly/react-icons';
import { getDefaultBackendRefs } from './WizardActions';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { ServiceOverview } from '../../types/ServiceList';

type Props = {
  initRefs: K8sRouteBackendRef[];
  onChange: (backendRefs: K8sRouteBackendRef[], reset: boolean) => void;
  showValid: boolean;
  subServices: ServiceOverview[];
};

export type K8sRouteBackendRef = {
  name: string;
  port?: number;
  weight: number;
};

export type K8sRouteFilter = {
  requestHeaderModifier?: K8sHeaderFilter;
  type: string;
};

export type K8sHeaderFilter = {
  add?: K8sHeader[];
  remove?: string[];
  set?: K8sHeader[];
};

export type K8sHeader = {
  name: string;
  value: string;
};

type State = {
  backendRefs: K8sRouteBackendRef[];
};

const evenlyButtonStyle = kialiStyle({
  width: '100%',
  textAlign: 'right'
});

export class K8sTrafficShifting extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      backendRefs: []
    };
  }

  componentDidMount() {
    this.resetState();
  }

  resetState = () => {
    if (this.props.subServices.length === 0) {
      return;
    }

    this.setState(
      prevState => {
        return {
          backendRefs:
            prevState.backendRefs.length === 0 && this.props.initRefs.length > 0
              ? this.props.initRefs
              : getDefaultBackendRefs(this.props.subServices)
        };
      },
      () => this.props.onChange(this.state.backendRefs, true)
    );
  };

  onWeight = (serviceName: string, newWeight: number) => {
    this.setState(
      prevState => {
        // Set new weight; remember rest of the nodes
        for (let i = 0; i < prevState.backendRefs.length; i++) {
          if (prevState.backendRefs[i].name === serviceName) {
            prevState.backendRefs[i].weight = newWeight;
          }
        }

        return {
          backendRefs: prevState.backendRefs
        };
      },
      () => this.props.onChange(this.state.backendRefs, false)
    );
  };

  render() {
    const columns: ThProps[] = [
      {
        title: 'Destination Service',
        width: 30
      },
      {
        title: 'Traffic Weight',
        width: 70
      }
    ];

    const rows = this.state.backendRefs.map(service => {
      return {
        cells: [
          <div>
            <PFBadge badge={PFBadges.Workload} position={TooltipPosition.top} />
            {service.name}
          </div>,
          <Slider
            id={'slider-' + service.name}
            key={'slider-' + service.name}
            tooltip={true}
            input={true}
            inputFormat=""
            value={service.weight}
            min={0}
            max={100}
            maxLimit={100}
            onSlide={value => {
              this.onWeight(service.name, value as number);
            }}
            onSlideStop={value => {
              this.onWeight(service.name, value as number);
            }}
            locked={false}
            showLock={false}
            mirrored={false}
          />
        ]
      };
    });

    return (
      <>
        <Table aria-label="weighted routing">
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
                {(row.cells as IRowCell[])?.map((cell, index) => (
                  <Td dataLabel={columns[index].title}>{cell}</Td>
                ))}
              </Tr>
            ))}
          </Tbody>
        </Table>

        {this.props.subServices.length > 1 && (
          <div className={evenlyButtonStyle}>
            <Button variant={ButtonVariant.link} icon={<EqualizerIcon />} onClick={() => this.resetState()}>
              Evenly distribute traffic
            </Button>
          </div>
        )}
      </>
    );
  }
}
