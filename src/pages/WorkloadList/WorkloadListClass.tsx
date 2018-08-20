import { WorkloadIcons, WorkloadListItem, WorkloadNamespaceResponse, worloadLink } from '../../types/Workload';
import * as React from 'react';
import { Link } from 'react-router-dom';
import { Badge, ListViewIcon, ListViewItem } from 'patternfly-react';
import { IstioLogo } from '../../config';
import { PfColors } from '../../components/Pf/PfColors';

export namespace WorkloadList {
  export const getDeploymentItems = (data: WorkloadNamespaceResponse): WorkloadListItem[] => {
    let workloadsItems: WorkloadListItem[] = [];
    if (data.workloads) {
      data.workloads.forEach(deployment => {
        workloadsItems.push({
          namespace: data.namespace.name,
          workload: deployment
        });
      });
    }
    return workloadsItems;
  };

  export const renderWorkloadListItem = (workloadItem: WorkloadListItem, index: number): React.ReactElement<{}> => {
    let object = workloadItem.workload;
    let ns = workloadItem.namespace;
    let iconName = WorkloadIcons[object.type];
    let iconType = 'pf';
    const heading = (
      <div className="ServiceList-Heading">
        <div className="ServiceList-IstioLogo">
          {object.istioSidecar && <img className="IstioLogo" src={IstioLogo} alt="Istio sidecar" />}
        </div>
        <div className="ServiceList-Title">
          {object.name}
          <small>{ns}</small>
        </div>
      </div>
    );
    const itemDescription = (
      <table style={{ width: '30em', tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            <td>{object.type}</td>
            {(object.appLabel || object.versionLabel) && (
              <td style={{ width: '20em' }}>
                <strong>Label Validation :</strong>
                {object.appLabel && <Badge>app</Badge>}
                {object.versionLabel && <Badge>version</Badge>}
              </td>
            )}
          </tr>
        </tbody>
      </table>
    );
    const content = (
      <ListViewItem
        leftContent={<ListViewIcon type={iconType} name={iconName} />}
        key={'worloadItemItemView_' + index + '_' + ns + '_' + object.name}
        heading={heading}
        description={itemDescription}
      />
    );
    return (
      <Link
        key={'worloadItemItem_' + index + '_' + ns + '_' + object.name}
        to={worloadLink(ns, object.name)}
        style={{ color: PfColors.Black }}
      >
        {content}
      </Link>
    );
  };
}
