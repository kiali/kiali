import * as React from 'react';
import { EmptyState, EmptyStateBody, EmptyStateVariant, Title, TitleSizes, Tooltip } from '@patternfly/react-core';
import { StarIcon } from '@patternfly/react-icons';
import { cellWidth, sortable, SortByDirection, Table, TableBody, TableHeader } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';

import { DefaultSecondaryMasthead } from '../../components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import { RenderContent } from '../../components/Nav/Page';
import { RefreshButton } from '../../components/Refresh/RefreshButton';
import { getClusters } from '../../services/Api';
import { MeshCluster, MeshClusters } from '../../types/Mesh';
import { addError } from '../../utils/AlertUtils';
import { connect } from 'react-redux';
import { KialiAppState } from 'store/Store';
import { Theme } from 'types/Common';
import { kialiIconDark, kialiIconLight } from 'config';

const iconStyle = kialiStyle({
  width: '25px',
  marginRight: '10px',
  marginTop: '-2px'
});

const containerPadding = kialiStyle({ padding: '20px' });

type MeshPageProps = {
  theme: string;
};

export const MeshPageComponent: React.FunctionComponent<MeshPageProps> = (props: MeshPageProps) => {
  const [meshClustersList, setMeshClustersList] = React.useState(null as MeshClusters | null);
  const [sortBy, setSortBy] = React.useState({ index: 0, direction: SortByDirection.asc });

  React.useEffect(() => {
    fetchMeshClusters();
  }, []);

  const columns = [
    {
      title: 'Cluster Name',
      transforms: [sortable, cellWidth(20)]
    },
    {
      title: 'Network',
      transforms: [sortable, cellWidth(10)]
    },
    {
      title: 'Kiali',
      transforms: [cellWidth(20)]
    },
    {
      title: 'API Endpoint',
      transforms: [sortable, cellWidth(20)]
    },
    {
      title: 'Secret name',
      transforms: [sortable, cellWidth(30)]
    }
  ];

  function buildKialiInstancesColumn(cluster: MeshCluster, theme: string): React.ReactNode {
    if (!cluster.kialiInstances || cluster.kialiInstances.length === 0) {
      return 'N / A';
    }

    const kialiIcon = theme === Theme.DARK ? kialiIconDark : kialiIconLight;

    return cluster.kialiInstances.map(instance => {
      if (instance.url.length !== 0) {
        return (
          <Tooltip
            key={cluster.name + '/' + instance.namespace + '/' + instance.serviceName}
            content={`Go to this Kiali instance: ${instance.url}`}
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
  }

  function buildTableRows() {
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
  }

  async function fetchMeshClusters() {
    try {
      const meshClusters = await getClusters();
      setMeshClustersList(meshClusters.data);
    } catch (e) {
      if (e instanceof Error) {
        addError('Could not fetch the list of clusters that are part of the mesh.', e);
      }
    }
  }

  function onSortHandler(_event, index, direction) {
    setSortBy({ index, direction });
  }

  const clusterRows = React.useMemo(buildTableRows, [meshClustersList, sortBy, props.theme]);

  return (
    <>
      <DefaultSecondaryMasthead
        hideNamespaceSelector={true}
        rightToolbar={<RefreshButton key={'Refresh'} handleRefresh={fetchMeshClusters} />}
      />
      <RenderContent>
        <div className={containerPadding}>
          <Table aria-label="Sortable Table" cells={columns} onSort={onSortHandler} rows={clusterRows} sortBy={sortBy}>
            <TableHeader />
            <TableBody />
          </Table>
          {clusterRows.length === 0 ? (
            <EmptyState variant={EmptyStateVariant.full}>
              <Title headingLevel="h2" size={TitleSizes.lg}>
                No Clusters
              </Title>
              <EmptyStateBody>No clusters were discovered in your mesh.</EmptyStateBody>
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
