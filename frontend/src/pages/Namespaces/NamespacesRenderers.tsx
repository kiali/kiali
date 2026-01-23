import * as React from 'react';
import { Td } from '@patternfly/react-table';
import { Label, TooltipPosition } from '@patternfly/react-core';
import { Renderer, Resource } from '../../components/VirtualList/Config';
import { NamespaceInfo } from '../../types/NamespaceInfo';
import { NamespaceStatusesCombined } from './NamespaceStatusesCombined';
import { MTLSIcon } from '../../components/MTls/MTLSIcon';
import { StatusDescriptor, emptyDescriptor } from '../../components/MTls/MTLSStatus';
import { namespaceMTLSStatusDescriptors } from '../../components/MTls/NamespaceMTLSStatusDescriptors';
import { kialiStyle } from '../../styles/StyleUtils';
import { PFBadge, PFBadges } from '../../components/Pf/PfBadges';
import { ControlPlaneBadge } from './ControlPlaneBadge';
import { DataPlaneBadge } from './DataPlaneBadge';
import { NotPartOfMeshBadge } from './NotPartOfMeshBadge';
import { serverConfig } from '../../config/ServerConfig';

const tlsIconStyle = kialiStyle({
  marginTop: '-1px',
  marginRight: '0.35rem',
  width: '1em',
  height: '1em',
  verticalAlign: 'middle'
});

const tlsLabelStyle = kialiStyle({
  display: 'inline-flex',
  alignItems: 'center',
  paddingTop: '4px',
  paddingBottom: '4px'
});

export const statusNamespaces: Renderer<NamespaceInfo> = (ns: NamespaceInfo) => {
  return (
    <Td role="gridcell" dataLabel="Health" key={`VirtuaItem_Status_${ns.name}`} style={{ verticalAlign: 'middle' }}>
      <NamespaceStatusesCombined
        name={ns.name}
        statusApp={ns.statusApp}
        statusService={ns.statusService}
        statusWorkload={ns.statusWorkload}
      />
    </Td>
  );
};

export const type: Renderer<NamespaceInfo> = (ns: NamespaceInfo) => {
  // Determine if namespace is a data plane namespace
  // A namespace is a data plane namespace if:
  // - It's not a control plane namespace
  // - AND it has the injection label enabled OR has the revision label set
  const isDataPlane =
    !ns.isControlPlane &&
    ns.labels &&
    (ns.labels[serverConfig.istioLabels.injectionLabelName] === 'enabled' ||
      (ns.labels[serverConfig.istioLabels.injectionLabelRev] !== undefined &&
        ns.labels[serverConfig.istioLabels.injectionLabelRev] !== ''));

  return (
    <Td role="gridcell" dataLabel="Type" key={`VirtuaItem_Type_${ns.name}`} style={{ verticalAlign: 'middle' }}>
      {ns.isControlPlane ? (
        <ControlPlaneBadge isAmbient={ns.isAmbient} />
      ) : isDataPlane ? (
        <DataPlaneBadge />
      ) : (
        <NotPartOfMeshBadge />
      )}
    </Td>
  );
};

export const nsItem: Renderer<NamespaceInfo> = (ns: NamespaceInfo, _config: Resource) => {
  return (
    <Td
      role="gridcell"
      dataLabel="Namespace"
      key={`VirtuaItem_NamespaceItem_${ns.name}`}
      style={{ verticalAlign: 'middle' }}
    >
      <PFBadge badge={PFBadges.Namespace} position={TooltipPosition.top} />
      {ns.name}
    </Td>
  );
};

export const tlsNamespaces: Renderer<NamespaceInfo> = (ns: NamespaceInfo) => {
  const isControlPlane = !!ns.isControlPlane;
  const isDataPlane =
    !isControlPlane &&
    !!ns.labels &&
    (ns.labels[serverConfig.istioLabels.injectionLabelName] === 'enabled' ||
      (ns.labels[serverConfig.istioLabels.injectionLabelRev] !== undefined &&
        ns.labels[serverConfig.istioLabels.injectionLabelRev] !== ''));

  // If the namespace is not part of the mesh, mTLS does not apply.
  // Consider ambient namespaces as part of the mesh too.
  const isInMesh = isControlPlane || isDataPlane || !!ns.isAmbient;

  if (!isInMesh) {
    return (
      <Td role="gridcell" dataLabel="mTLS" key={`VirtualItem_tls_${ns.name}`} style={{ verticalAlign: 'middle' }}>
        <Label variant="outline" className={tlsLabelStyle}>
          Not applicable
        </Label>
      </Td>
    );
  }

  if (!ns.tlsStatus) {
    return (
      <Td role="gridcell" dataLabel="mTLS" key={`VirtualItem_tls_${ns.name}`} style={{ verticalAlign: 'middle' }} />
    );
  }

  const statusDescriptor: StatusDescriptor = namespaceMTLSStatusDescriptors.get(ns.tlsStatus.status) ?? emptyDescriptor;

  if (!statusDescriptor.showStatus) {
    return (
      <Td role="gridcell" dataLabel="mTLS" key={`VirtualItem_tls_${ns.name}`} style={{ verticalAlign: 'middle' }} />
    );
  }

  return (
    <Td role="gridcell" dataLabel="mTLS" key={`VirtualItem_tls_${ns.name}`} style={{ verticalAlign: 'middle' }}>
      <Label variant="outline" className={tlsLabelStyle}>
        <MTLSIcon
          icon={statusDescriptor.icon}
          iconClassName={tlsIconStyle}
          color={statusDescriptor.color}
          tooltipText={statusDescriptor.message}
          tooltipPosition={TooltipPosition.auto}
        />
        {statusDescriptor.name}
      </Label>
    </Td>
  );
};
