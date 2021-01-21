import * as React from 'react';
import { Alert, EmptyState, EmptyStateBody, EmptyStateVariant, Title } from '@patternfly/react-core';
import { StarIcon } from '@patternfly/react-icons';
import { cellWidth, sortable, SortByDirection, Table, TableBody, TableHeader } from '@patternfly/react-table';
import { style } from 'typestyle';

import { RenderContent } from '../../components/Nav/Page';
import { getClusters } from '../../services/Api';
import { MeshClusters } from '../../types/Mesh';
import { addError } from '../../utils/AlertUtils';
import DefaultSecondaryMasthead from 'components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import RefreshButtonContainer from 'components/Refresh/RefreshButton';

const MeshPage: React.FunctionComponent = () => {
  const [meshClustersList, setMeshClustersList] = React.useState(null as MeshClusters | null);
  const [sortBy, setSortBy] = React.useState({ index: 0, direction: SortByDirection.asc });

  const containerPadding = style({ padding: '20px' });
  const columns = [
    {
      title: 'Cluster Name',
      transforms: [sortable, cellWidth(30)]
    },
    {
      title: 'Network',
      transforms: [sortable, cellWidth(20)]
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
      addError('Could not fetch the list of clusters that are part of the mesh.', e);
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
              <Title headingLevel="h2" size="lg">
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
