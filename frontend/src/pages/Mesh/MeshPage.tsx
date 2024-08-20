import * as React from 'react';
import {
  Alert,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Title,
  TitleSizes,
  Tooltip
} from '@patternfly/react-core';
import { StarIcon } from '@patternfly/react-icons';
import { cellWidth, sortable, SortByDirection, Table, TableBody, TableHeader } from '@patternfly/react-table';
import { style } from 'typestyle';

import DefaultSecondaryMasthead from '../../components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import { RenderContent } from '../../components/Nav/Page';
import RefreshButtonContainer from '../../components/Refresh/RefreshButton';
import { getClusters } from '../../services/Api';
import { MeshClusters } from '../../types/Mesh';
import { addError } from '../../utils/AlertUtils';

const MeshPage: React.FunctionComponent = () => {
  const [meshClustersList, setMeshClustersList] = React.useState(null as MeshClusters | null);
  const [sortBy, setSortBy] = React.useState({ index: 0, direction: SortByDirection.asc });

  const containerPadding = style({ padding: '20px' });
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

  function buildKialiInstancesColumn(cluster): React.ReactNode {
    if (!cluster.kialiInstances || cluster.kialiInstances.length === 0) {
      return 'N / A';
    }

    return cluster.kialiInstances.map(instance => {
      if (instance.url.length !== 0) {
        return (
          <Tooltip content={`Go to this Kiali instance: ${instance.url}`}>
            <p key={cluster.name + '/' + instance.namespace + '/' + instance.serviceName}>
              <img alt="kiali-icon" src="kiali_icon_lightbkg_16px.png" />{' '}
              <a href={instance.url} target="_blank" rel="noopener noreferrer">
                {instance.namespace} {' / '} {instance.serviceName}
              </a>
            </p>
          </Tooltip>
        );
      } else {
        return (
          <p key={cluster.name + '/' + instance.namespace + '/' + instance.serviceName}>
            <img alt="kiali-icon" src="kiali_icon_lightbkg_16px.png" />{' '}
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
        <>{buildKialiInstancesColumn(cluster)}</>,
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

  const clusterRows = React.useMemo(buildTableRows, [meshClustersList, sortBy]);

  React.useEffect(() => {
    fetchMeshClusters();
  }, []);

  return (
    <>
      <div style={{ backgroundColor: '#fff' }}>
        <DefaultSecondaryMasthead
          hideNamespaceSelector={true}
          rightToolbar={<RefreshButtonContainer key={'Refresh'} handleRefresh={fetchMeshClusters} />}
        />
      </div>
      <RenderContent>
        <div className={containerPadding}>
          <Alert isInline={true} variant="warning" title="This feature is experimental." />
        </div>
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

export default MeshPage;
