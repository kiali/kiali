import * as React from 'react';
import { Table, Tbody, Td, Th, Thead, ThProps, Tr } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../../components/Pf/PfColors';
import { Button, ButtonVariant } from '@patternfly/react-core';
import { Listener } from '../../../types/IstioObjects';
import { ListenerForm } from '../K8sGatewayForm';
import { ListenerBuilder, allowedRoutes, protocols, tlsModes, protocolsCert, TERMINATE } from './ListenerBuilder';
import { KialiIcon } from 'config/KialiIcon';

type ListenerListProps = {
  listeners: Listener[];
  listenersForm: ListenerForm[];
  onChange: (listener: Listener[], listenerForm: ListenerForm[]) => void;
};

const noListenerStyle = kialiStyle({
  color: PFColors.Red100,
  textAlign: 'center'
});

const addListenerStyle = kialiStyle({
  marginLeft: '0.5rem',
  marginTop: '0.25rem'
});

const columns: ThProps[] = [
  {
    title: 'Name',
    width: 20
  },
  {
    title: 'Hostname',
    width: 20
  },
  {
    title: 'Port',
    width: 10
  },
  {
    title: 'Protocol',
    width: 10
  },
  {
    title: 'From Namespaces',
    width: 10
  },
  {
    title: 'Labels',
    width: 25
  },
  {
    title: '',
    width: 10
  }
];

export const addSelectorLabels = (value: string): [boolean, {}] => {
  if (value.length === 0) {
    return [true, {}];
  }

  let result = true;
  value = value.trim();
  const labels: string[] = value.split(',');

  const selector: { [key: string]: string } = {};

  // Some smoke validation rules for the labels
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (label.indexOf('=') < 0) {
      result = false;
      break;
    }

    const splitLabel: string[] = label.split('=');
    if (splitLabel.length !== 2) {
      result = false;
      break;
    }

    if (splitLabel[0].trim().length === 0 || splitLabel[1].trim().length === 0) {
      result = false;
      break;
    }

    selector[splitLabel[0].trim()] = splitLabel[1].trim();
  }

  return [result, selector];
};

export const ListenerList: React.FC<ListenerListProps> = (props: ListenerListProps) => {
  const onAddListener = (): void => {
    const newListener: ListenerForm = {
      hostname: '',
      port: '',
      name: '',
      protocol: protocols[0],
      isHostValid: false,
      from: allowedRoutes[0],
      isLabelSelectorValid: false,
      tlsMode: tlsModes[0],
      tlsCert: '',
      sSelectorLabels: ''
    };

    const l = props.listenersForm;
    l.push(newListener);

    const newListenerF: Listener = {
      hostname: '',
      port: 70000,
      name: '',
      protocol: protocols[0],
      allowedRoutes: { namespaces: { from: allowedRoutes[0], selector: { matchLabels: {} } } },
      tls: null
    };

    const lf = props.listeners;
    lf.push(newListenerF);

    props.onChange(lf, l);
  };

  const onRemoveListener = (index: number): void => {
    const l = props.listenersForm;
    l.splice(index, 1);

    const lf = props.listeners;
    lf.splice(index, 1);

    props.onChange(lf, l);
  };

  const onChange = (listenersForm: ListenerForm, i: number): void => {
    const lf = props.listenersForm;
    lf[i] = listenersForm;

    const l = props.listeners;
    const newL = createNewListener(listenersForm);
    if (typeof newL !== 'undefined') {
      l[i] = newL;
    }

    props.onChange(l, lf);
  };

  const createNewListener = (listenerForm: ListenerForm): Listener | undefined => {
    if (listenerForm.port.length === 0 || isNaN(Number(listenerForm.port))) return;
    if (listenerForm.hostname.length === 0) return;

    const selector = addSelectorLabels(listenerForm.sSelectorLabels)[1] || {};

    const listener: Listener = {
      hostname: listenerForm.hostname,
      port: Number(listenerForm.port),
      name: listenerForm.name,
      protocol: listenerForm.protocol,
      allowedRoutes: { namespaces: { from: listenerForm.from, selector: { matchLabels: selector } } },
      tls: null
    };

    if (protocolsCert.includes(listenerForm.protocol) && listenerForm.tlsMode === TERMINATE) {
      listener.tls = {
        certificateRefs: [
          {
            kind: 'Secret',
            name: listenerForm.tlsCert
          }
        ]
      };
    }

    return listener;
  };

  return (
    <>
      <Table aria-label="Listener List">
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
          {props.listenersForm.length > 0 ? (
            <>
              {props.listenersForm.map((listener, index) => (
                <ListenerBuilder
                  key={`listener_builder_${index}`}
                  listener={listener}
                  onRemoveListener={onRemoveListener}
                  index={index}
                  onChange={onChange}
                ></ListenerBuilder>
              ))}
            </>
          ) : (
            <Tr>
              <Td colSpan={columns.length}>
                <div className={noListenerStyle}>No Listeners defined</div>
              </Td>
            </Tr>
          )}
        </Tbody>
      </Table>

      <Button
        name="addListener"
        variant={ButtonVariant.link}
        icon={<KialiIcon.AddMore />}
        onClick={onAddListener}
        className={addListenerStyle}
      >
        Add Listener to Listener List
      </Button>
    </>
  );
};
