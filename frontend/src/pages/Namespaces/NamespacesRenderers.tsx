import * as React from 'react';
import { Td } from '@patternfly/react-table';
import { TooltipPosition } from '@patternfly/react-core';
import { Renderer, Resource } from '../../components/VirtualList/Config';
import { NamespaceInfo } from '../../types/NamespaceInfo';
import { NamespaceStatusesCombined } from './NamespaceStatusesCombined';
import { MTLSIcon } from '../../components/MTls/MTLSIcon';
import { StatusDescriptor, emptyDescriptor } from '../../components/MTls/MTLSStatus';
import { MTLSStatuses } from '../../types/TLSStatus';
import { MTLSIconTypes } from '../../components/MTls/NamespaceMTLSStatus';
import { kialiStyle } from '../../styles/StyleUtils';
import { PFBadge, PFBadges } from '../../components/Pf/PfBadges';
import { getCategoryText } from './Filters';

const statusDescriptors = new Map<string, StatusDescriptor>([
  [
    MTLSStatuses.ENABLED,
    {
      message: 'mTLS is enabled for this namespace',
      icon: MTLSIconTypes.LOCK_FULL,
      showStatus: true
    }
  ],
  [
    MTLSStatuses.ENABLED_EXTENDED,
    {
      message: 'mTLS is enabled for this namespace, extended from Mesh-wide config',
      icon: MTLSIconTypes.LOCK_FULL,
      showStatus: true
    }
  ],
  [
    MTLSStatuses.PARTIALLY,
    {
      message: 'mTLS is partially enabled for this namespace',
      icon: MTLSIconTypes.LOCK_HOLLOW,
      showStatus: true
    }
  ],
  [MTLSStatuses.DISABLED, emptyDescriptor],
  [MTLSStatuses.NOT_ENABLED, emptyDescriptor]
]);

const tlsIconStyle = kialiStyle({
  marginTop: '-0.125rem',
  marginRight: '0.75rem',
  width: '0.75rem'
});

export const statusNamespaces: Renderer<NamespaceInfo> = (ns: NamespaceInfo) => {
  return (
    <Td role="gridcell" dataLabel="Status" key={`VirtuaItem_Status_${ns.name}`} style={{ verticalAlign: 'middle' }}>
      <NamespaceStatusesCombined
        name={ns.name}
        statusApp={ns.statusApp}
        statusService={ns.statusService}
        statusWorkload={ns.statusWorkload}
      />
    </Td>
  );
};

export const category: Renderer<NamespaceInfo> = (ns: NamespaceInfo) => {
  const categoryText = getCategoryText(ns.isControlPlane);
  return (
    <Td role="gridcell" dataLabel="Category" key={`VirtuaItem_Category_${ns.name}`} style={{ verticalAlign: 'middle' }}>
      {categoryText}
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
  if (!ns.tlsStatus) {
    return (
      <Td
        role="gridcell"
        dataLabel="TLS config"
        key={`VirtualItem_tls_${ns.name}`}
        style={{ verticalAlign: 'middle' }}
      />
    );
  }

  const statusDescriptor = statusDescriptors.get(ns.tlsStatus.status) ?? emptyDescriptor;

  if (!statusDescriptor.showStatus) {
    return (
      <Td
        role="gridcell"
        dataLabel="TLS config"
        key={`VirtualItem_tls_${ns.name}`}
        style={{ verticalAlign: 'middle' }}
      />
    );
  }

  return (
    <Td role="gridcell" dataLabel="TLS config" key={`VirtualItem_tls_${ns.name}`} style={{ verticalAlign: 'middle' }}>
      <MTLSIcon
        icon={statusDescriptor.icon}
        iconClassName={tlsIconStyle}
        tooltipText={statusDescriptor.message}
        tooltipPosition={TooltipPosition.auto}
      />
    </Td>
  );
};
