import * as React from 'react';
import { isK8sGatewayHostValid } from '../../../utils/IstioConfigUtils';
import {
  Button,
  ButtonVariant,
  FormGroup,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
  TextInput
} from '@patternfly/react-core';
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
export const SELECTOR = 'Selector';
export const allowedRoutes = ['All', SELECTOR, 'Same'];
export const TERMINATE = 'Terminate';
export const tlsModes = [TERMINATE];

export const isValidName = (name: string): boolean => {
  return name !== undefined && name.length > 0;
};

export const isValidHostname = (hostname: string): boolean => {
  return hostname !== undefined && hostname.length > 0 && isK8sGatewayHostValid(hostname);
};

export const isValidTLS = (protocol: string, tls?: K8sGatewayTLS): boolean => {
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
  return addSelectorLabels(selector)[0];
};

export const ListenerBuilder: React.FC<ListenerBuilderProps> = (props: ListenerBuilderProps) => {
  const [isProtocolSelectOpen, setIsProtocolSelectOpen] = React.useState<boolean>(false);
  const [isFromSelectOpen, setIsFromSelectOpen] = React.useState<boolean>(false);
  const [isTlsModeSelectOpen, setIsTlsModeSelectOpen] = React.useState<boolean>(false);

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

  const onAddProtocol = (value: string): void => {
    const l = props.listener;
    l.protocol = value.trim();
    setIsProtocolSelectOpen(false);

    props.onChange(l, props.index);
  };

  const onAddFrom = (value: string): void => {
    const l = props.listener;
    l.from = value.trim();
    setIsFromSelectOpen(false);

    props.onChange(l, props.index);
  };

  const onAddSelectorLabels = (_event: React.FormEvent, value: string): void => {
    const l = props.listener;
    l.sSelectorLabels = value.trim();

    props.onChange(l, props.index);
  };

  const onAddTlsMode = (value: string): void => {
    const listener = props.listener;
    listener.tlsMode = value.trim();
    setIsTlsModeSelectOpen(false);

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
          <Select
            id={`addPortProtocol_${props.index}`}
            isOpen={isProtocolSelectOpen}
            selected={props.listener.protocol}
            onSelect={(_event, value) => onAddProtocol(value as string)}
            onOpenChange={setIsProtocolSelectOpen}
            toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
              <MenuToggle
                id={`addPortProtocol_${props.index}-toggle`}
                ref={toggleRef}
                onClick={() => setIsProtocolSelectOpen(!isProtocolSelectOpen)}
                isExpanded={isProtocolSelectOpen}
                isFullWidth
              >
                {props.listener.protocol}
              </MenuToggle>
            )}
            aria-label="Protocol Select"
          >
            <SelectList>
              {protocols.map((option, index) => (
                <SelectOption key={`p_${index}`} value={option}>
                  {option}
                </SelectOption>
              ))}
            </SelectList>
          </Select>
        </Td>

        <Td>
          <Select
            id={`addFrom_${props.index}`}
            isOpen={isFromSelectOpen}
            selected={props.listener.from}
            onSelect={(_event, value) => onAddFrom(value as string)}
            onOpenChange={setIsFromSelectOpen}
            toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
              <MenuToggle
                id={`addFrom_${props.index}-toggle`}
                ref={toggleRef}
                onClick={() => setIsFromSelectOpen(!isFromSelectOpen)}
                isExpanded={isFromSelectOpen}
                isFullWidth
              >
                {props.listener.from}
              </MenuToggle>
            )}
            aria-label="From Select"
          >
            <SelectList>
              {allowedRoutes.map((option, index) => (
                <SelectOption key={`p_${index}`} value={option}>
                  {option}
                </SelectOption>
              ))}
            </SelectList>
          </Select>
        </Td>

        <Td>
          <TextInput
            id={`addSelectorLabels_${props.index}`}
            name="addSelectorLabels"
            isDisabled={props.listener.from !== SELECTOR}
            onChange={onAddSelectorLabels}
            validated={isValid(
              props.listener.from === SELECTOR ? isValidSelector(props.listener.sSelectorLabels) : undefined
            )}
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
              <Select
                id={`addTlsMode_${props.index}`}
                isOpen={isTlsModeSelectOpen}
                selected={props.listener.tlsMode}
                onSelect={(_event, value) => onAddTlsMode(value as string)}
                onOpenChange={setIsTlsModeSelectOpen}
                toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                  <MenuToggle
                    id={`addTlsMode_${props.index}-toggle`}
                    ref={toggleRef}
                    onClick={() => setIsTlsModeSelectOpen(!isTlsModeSelectOpen)}
                    isExpanded={isTlsModeSelectOpen}
                    isFullWidth
                  >
                    {props.listener.tlsMode}
                  </MenuToggle>
                )}
                aria-label="TLS Mode Select"
              >
                <SelectList>
                  {tlsModes.map((option, index) => (
                    <SelectOption key={`p_${index}`} value={option}>
                      {option}
                    </SelectOption>
                  ))}
                </SelectList>
              </Select>
            </FormGroup>
          </Td>
          {props.listener.tlsMode === TERMINATE && (
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
