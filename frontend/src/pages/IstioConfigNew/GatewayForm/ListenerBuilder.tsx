import * as React from 'react';
import { isK8sGatewayHostValid } from '../../../utils/IstioConfigUtils';
import { Button, ButtonVariant, FormGroup, FormSelect, FormSelectOption, TextInput } from '@patternfly/react-core';
import { isValid } from '../../../utils/Common';
import { ListenerForm } from '../K8sGatewayForm';
import { Td, Tr } from '@patternfly/react-table';
import { addSelectorLabels } from './ListenerList';
import { K8sGatewayTLS, MAX_PORT, MIN_PORT } from '../../../types/IstioObjects';
import { KialiIcon } from 'config/KialiIcon';

type ListenerBuilderProps = {
  index: number;
  listener: ListenerForm;
  onChange: (listenerForm: ListenerForm, i: number) => void;
  onRemoveListener: (i: number) => void;
};

// Only HTTPRoute is supported in Istio
export const protocols = ['HTTP', 'HTTPS'];
// protocols which could require certificate
export const protocolsCert = ['HTTPS'];
export const allowedRoutes = ['All', 'Selector', 'Same'];
export const tlsModes = ['Terminate'];
// TLS mode which require ceritificate cuttently one
export const tlsModesCert = ['Terminate'];

export const isValidName = (name: string): boolean => {
  return name !== undefined && name.length > 0;
};

export const isValidHostname = (hostname: string): boolean => {
  return hostname !== undefined && hostname.length > 0 && isK8sGatewayHostValid(hostname);
};

export const isValidTLS = (protocol: string, tls: K8sGatewayTLS | null): boolean => {
  const tlsRequired = protocolsCert.includes(protocol);
  if (!tls || !tlsRequired) {
    return true;
  }

  for (const cert of tls.certificateRefs) {
    const certsValid = tlsRequired ? cert.name?.length > 0 : true;
    if (!certsValid) {
      return false;
    }
  }

  return true;
};

export const isValidPort = (port: string): boolean => {
  return port.length > 0 && !isNaN(Number(port)) && Number(port) >= MIN_PORT && Number(port) <= MAX_PORT;
};

export const isValidSelector = (selector: string): boolean => {
  return selector.length === 0 || typeof addSelectorLabels(selector) !== 'undefined';
};

export const ListenerBuilder: React.FC<ListenerBuilderProps> = (props: ListenerBuilderProps) => {
  const onAddHostname = (_event: React.FormEvent, value: string): void => {
    const l = props.listener;
    l.hostname = value.trim();

    props.onChange(l, props.index);
  };

  const onAddPort = (_event: React.FormEvent, value: string): void => {
    const l = props.listener;
    l.port = value.trim();

    props.onChange(l, props.index);
  };

  const onAddName = (_event: React.FormEvent, value: string): void => {
    const l = props.listener;
    l.name = value.trim();

    props.onChange(l, props.index);
  };

  const onAddProtocol = (_event: React.FormEvent, value: string): void => {
    const l = props.listener;
    l.protocol = value.trim();

    props.onChange(l, props.index);
  };

  const onAddFrom = (_event: React.FormEvent, value: string): void => {
    const l = props.listener;
    l.from = value.trim();

    props.onChange(l, props.index);
  };

  const onAddSelectorLabels = (_event: React.FormEvent, value: string): void => {
    const l = props.listener;
    l.sSelectorLabels = value.trim();

    props.onChange(l, props.index);
  };

  const onAddTlsMode = (_event: React.FormEvent, value: string): void => {
    const listener = props.listener;
    listener.tlsMode = value.trim();

    props.onChange(listener, props.index);
  };

  const onAddTlsCert = (_event: React.FormEvent, value: string): void => {
    const listener = props.listener;
    listener.tlsCert = value.trim();

    props.onChange(listener, props.index);
  };

  const showTls = protocolsCert.includes(props.listener.protocol);

  return (
    <>
      <Tr>
        <Td>
          <TextInput
            value={props.listener.name}
            type="text"
            id={`addName_${props.index}`}
            aria-describedby="add name"
            onChange={onAddName}
            validated={isValid(isValidName(props.listener.name))}
          />
        </Td>

        <Td>
          <TextInput
            value={props.listener.hostname}
            type="text"
            id={`addHostname_${props.index}`}
            aria-describedby="add hostname"
            name="addHostname"
            onChange={onAddHostname}
            validated={isValid(isValidHostname(props.listener.hostname))}
          />
        </Td>

        <Td>
          <TextInput
            value={props.listener.port}
            type="text"
            id={`addPort_${props.index}`}
            placeholder="80"
            aria-describedby="add port"
            name="addPortNumber"
            onChange={onAddPort}
            validated={isValid(isValidPort(props.listener.port))}
          />
        </Td>

        <Td>
          <FormSelect
            value={props.listener.protocol}
            id={`addPortProtocol_${props.index}`}
            name="addPortProtocol"
            onChange={onAddProtocol}
          >
            {protocols.map((option, index) => (
              <FormSelectOption isDisabled={false} key={`p_${index}`} value={option} label={option} />
            ))}
          </FormSelect>
        </Td>

        <Td>
          <FormSelect value={props.listener.from} id={`addFrom_${props.index}`} name="addFrom" onChange={onAddFrom}>
            {allowedRoutes.map((option, index) => (
              <FormSelectOption isDisabled={false} key={`p_${index}`} value={option} label={option} />
            ))}
          </FormSelect>
        </Td>

        <Td>
          <TextInput
            id={`addSelectorLabels_${props.index}`}
            name="addSelectorLabels"
            onChange={onAddSelectorLabels}
            validated={isValid(isValidSelector(props.listener.sSelectorLabels))}
          />
        </Td>
        <Td>
          <Button
            id={`deleteBtn_${props.index}`}
            variant={ButtonVariant.link}
            icon={<KialiIcon.Trash />}
            style={{ padding: 0 }}
            onClick={() => props.onRemoveListener(props.index)}
          />
        </Td>
      </Tr>
      {showTls && (
        <Tr>
          <Td colSpan={2}>
            <FormGroup label="TLS Mode" fieldId="addTlsMode" style={{ margin: '0.5rem 0' }}>
              <FormSelect
                value={props.listener.tlsMode}
                id={`addTlsMode_${props.index}`}
                name="addTlsMode"
                onChange={onAddTlsMode}
              >
                {tlsModes.map((option, index) => (
                  <FormSelectOption isDisabled={false} key={`p_${index}`} value={option} label={option} />
                ))}
              </FormSelect>
            </FormGroup>
          </Td>
          {(props.listener.tlsMode === tlsMode.TERMINATE && (
            <Td colSpan={4}>
              <FormGroup
                label="TLS Certificate"
                style={{ margin: '0.5rem 0' }}
                isRequired={true}
                fieldId="server-certificate"
              >
                <TextInput
                  value={props.listener.tlsCert}
                  isRequired={true}
                  type="text"
                  id={`tlsCert_${props.index}`}
                  aria-describedby="server-certificate"
                  name="tls-certificate"
                  onChange={onAddTlsCert}
                  validated={isValid(props.listener.tlsCert.length > 0)}
                />
              </FormGroup>
            </Td>
          )}
        </Tr>
      )}
    </>
  );
};
