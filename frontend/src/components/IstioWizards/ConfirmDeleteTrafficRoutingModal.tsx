import * as React from 'react';
import {
  Button,
  ButtonVariant,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant
} from '@patternfly/react-core';
import type { DestinationRuleC, K8sGRPCRoute, K8sHTTPRoute, VirtualService } from '../../types/IstioObjects';
import { t } from 'utils/I18nUtils';

type Props = {
  destinationRules: DestinationRuleC[];
  isOpen: boolean;
  k8sGRPCRoutes: K8sGRPCRoute[];
  k8sHTTPRoutes: K8sHTTPRoute[];
  onCancel: () => void;
  onConfirm: () => void;
  virtualServices: VirtualService[];
};

export const ConfirmDeleteTrafficRoutingModal: React.FunctionComponent<Props> = props => {
  function hasAnyPeerAuthn(drs: DestinationRuleC[]): boolean {
    return drs.filter(dr => !!dr.hasPeerAuthentication()).length > 0;
  }

  function getDeleteMessage(): React.ReactNode {
    const deleteMessage = t('Are you sure you want to delete ?');
    const deleteItems: JSX.Element[] = [];

    const vsMessage =
      props.virtualServices.length > 0
        ? `VirtualService${props.virtualServices.length > 1 ? 's' : ''}: '${props.virtualServices.map(
            vs => vs.metadata.name
          )}'`
        : '';
    deleteItems.push(<div key="delete_item_vs">{vsMessage}</div>);

    const drMessage =
      props.destinationRules.length > 0
        ? `DestinationRule${props.destinationRules.length > 1 ? 's' : ''}: '${props.destinationRules.map(
            dr => dr.metadata.name
          )}'`
        : '';
    deleteItems.push(<div key="delete_item_dr">{drMessage}</div>);

    const paMessage =
      props.destinationRules.length > 0 && hasAnyPeerAuthn(props.destinationRules)
        ? `PeerAuthentication${props.destinationRules.length > 1 ? 's' : ''}: '${props.destinationRules.map(
            dr => dr.metadata.name
          )}'`
        : '';
    deleteItems.push(<div key="delete_item_pa">{paMessage}</div>);

    const k8sHTTPRouteMessage =
      props.k8sHTTPRoutes.length > 0
        ? `K8s HTTPRoute${props.k8sHTTPRoutes.length > 1 ? 's' : ''}: '${props.k8sHTTPRoutes.map(
            k8sr => k8sr.metadata.name
          )}'`
        : '';
    deleteItems.push(<div key="delete_item_k8s_http_route">{k8sHTTPRouteMessage}</div>);

    const k8sGRPCRouteMessage =
      props.k8sGRPCRoutes.length > 0
        ? `K8s GRPCRoute${props.k8sGRPCRoutes.length > 1 ? 's' : ''}: '${props.k8sGRPCRoutes.map(
            k8sr => k8sr.metadata.name
          )}'`
        : '';
    deleteItems.push(<div key="delete_item_k8s_grpc_route">{k8sGRPCRouteMessage}</div>);

    return (
      <>
        <div key="delete_items" style={{ marginBottom: 5 }}>
          {deleteMessage}
        </div>
        {deleteItems}
      </>
    );
  }

  return (
    <Modal
      variant={ModalVariant.small}
      isOpen={props.isOpen}
      onClose={props.onCancel}
      data-test="delete-traffic-routing-modal"
    >
      <ModalHeader title={t('Confirm Delete Traffic Routing ?')} />
      <ModalBody>{getDeleteMessage()}</ModalBody>
      <ModalFooter>
        <Button key="confirm" variant={ButtonVariant.danger} onClick={props.onConfirm} data-test={'confirm-delete'}>
          {t('Delete')}
        </Button>
        <Button key="cancel" variant={ButtonVariant.secondary} isInline onClick={props.onCancel}>
          {t('Cancel')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
