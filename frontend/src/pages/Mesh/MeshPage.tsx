import * as React from 'react';
import { EmptyState, EmptyStateBody, EmptyStateVariant, Tooltip, EmptyStateHeader } from '@patternfly/react-core';
import { StarIcon } from '@patternfly/react-icons';
import { cellWidth, sortable, SortByDirection } from '@patternfly/react-table';
import { Table, TableBody, TableHeader } from '@patternfly/react-table/deprecated';
import { kialiStyle } from 'styles/StyleUtils';

import { DefaultSecondaryMasthead } from '../../components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import { RenderContent } from '../../components/Nav/Page';
import { RefreshButton } from '../../components/Refresh/RefreshButton';
import { getClusters } from '../../services/Api';
import { MeshClusters, MeshCluster } from '../../types/Mesh';
import { addError } from '../../utils/AlertUtils';
import { kialiIconDark, kialiIconLight } from 'config';
import { KialiAppState } from 'store/Store';
import { connect } from 'react-redux';
import { Theme } from 'types/Common';

const iconStyle = kialiStyle({
  width: '25px',
  marginRight: '10px',
  marginTop: '-2px'
});

const containerPadding = kialiStyle({ padding: '20px' });

type MeshPageProps = {
  theme: string;
};

const MeshPageComponent: React.FunctionComponent<MeshPageProps> = (props: MeshPageProps) => {
  const [meshClustersList, setMeshClustersList] = React.useState(null as MeshClusters | null);
  const [sortBy, setSortBy] = React.useState({ index: 0, direction: SortByDirection.asc });

  React.useEffect(() => {
    fetchMeshClusters();
  }, []);

  const columns = [
    {
      title: $t('ClusterName', 'Cluster Name'),
      transforms: [sortable, cellWidth(20)]
    },
    {
      title: $t('Network'),
      transforms: [sortable, cellWidth(10)]
    },
    {
      title: 'Kiali',
      transforms: [cellWidth(20)]
    },
    {
      title: $t('APIEndpoint', 'API Endpoint'),
      transforms: [sortable, cellWidth(20)]
    },
    {
      title: $t('SecretName', 'Secret name'),
      transforms: [sortable, cellWidth(30)]
    }
  ];

  const buildKialiInstancesColumn = (cluster: MeshCluster, theme: string): React.ReactNode => {
    if (!cluster.kialiInstances || cluster.kialiInstances.length === 0) {
      return 'N / A';
    }

    const kialiIcon = theme === Theme.DARK ? kialiIconDark : kialiIconLight;

    return cluster.kialiInstances.map(instance => {
      if (instance.url.length !== 0) {
        return (
          <Tooltip
            key={cluster.name + '/' + instance.namespace + '/' + instance.serviceName}
            content={`${$t('label11', 'Go to this Kiali instance')}: ${instance.url}`}
          >
            <p>
              <img alt="Kiali Icon" src={kialiIcon} className={iconStyle} />
              <a href={instance.url} target="_blank" rel="noopener noreferrer">
                {instance.namespace} {' / '} {instance.serviceName}
              </a>
            </p>
          </Tooltip>
        );
      } else {
        return (
          <p key={cluster.name + '/' + instance.namespace + '/' + instance.serviceName}>
            <img alt="Kiali Icon" src={kialiIcon} className={iconStyle} />
            {`${instance.namespace} / ${instance.serviceName}`}
          </p>
        );
      }
    });
  };

  const buildTableRows = () => {
    if (meshClustersList === null) {
      return [];
    }

    const sortAttributes = ['name', 'apiEndpoint', 'network', 'secretName'];
    const sortByAttr = sortAttributes[sortBy.index];
    const sortedList = Array.from(meshClustersList).sort((a, b) =>
      a[sortByAttr].localeCompare(b[sortByAttr], undefined, { sensitivity: 'base' })
    );

    const tableRows = sortedList.map(cluster => ({
      cells: [
        <>
          {cluster.isKialiHome ? <StarIcon /> : null} {cluster.name}
        </>,
        cluster.network,
        <>{buildKialiInstancesColumn(cluster, props.theme)}</>,
        cluster.apiEndpoint,
        cluster.secretName
      ]
    }));

    return sortBy.direction === SortByDirection.asc ? tableRows : tableRows.reverse();
  };

  const fetchMeshClusters = async () => {
    try {
      const meshClusters = await getClusters();
      setMeshClustersList(meshClusters.data);
    } catch (e) {
      if (e instanceof Error) {
        addError($t('tip93', 'Could not fetch the list of clusters that are part of the mesh'), e);
      }
    }
  };

  const onSortHandler = (_event: React.MouseEvent, index: number, direction: SortByDirection) => {
    setSortBy({ index, direction });
  };

  const clusterRows = React.useMemo(buildTableRows, [meshClustersList, sortBy, props.theme]);

  return (
    <>
      <DefaultSecondaryMasthead
        hideNamespaceSelector={true}
        rightToolbar={<RefreshButton key={$t('Refresh')} handleRefresh={fetchMeshClusters} />}
      />
      <RenderContent>
        <div className={containerPadding}>
          <Table aria-label="Sortable Table" cells={columns} onSort={onSortHandler} rows={clusterRows} sortBy={sortBy}>
            <TableHeader />
            <TableBody />
          </Table>
          {clusterRows.length === 0 ? (
            <EmptyState variant={EmptyStateVariant.full}>
              <EmptyStateHeader titleText={$t('NoClusters', 'No Clusters')} headingLevel="h2" />
              <EmptyStateBody>{$t('tip352', 'No clusters were discovered in your mesh.')}</EmptyStateBody>
            </EmptyState>
          ) : null}
        </div>
      </RenderContent>
    </>
  );
};

const mapStateToProps = (state: KialiAppState) => {
  return {
    theme: state.globalState.theme
  };
};

export const MeshPage = connect(mapStateToProps)(MeshPageComponent);
