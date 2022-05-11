import * as React from 'react';
import { VirtualService } from "../k8s/types";
import {
    getGroupVersionKindForResource, K8sResourceCommon, ListPageBody, ListPageFilter, ListPageHeader,
    ResourceLink, RowFilter,
    RowProps,
    TableColumn,
    TableData, useK8sWatchResource, useListPageFilter, VirtualizedTable
} from "@openshift-console/dynamic-plugin-sdk";

const resources = [
    {
        group: 'networking.istio.io',
        version: 'v1beta1',
        kind: 'VirtualService',
    },
];

const columns: TableColumn<VirtualService>[] = [
    {
        title: 'Name',
        id: 'name',
    },
    {
        title: 'Kind',
        id: 'kind',
    },
    {
        title: 'Hosts',
        id: 'hosts',
    },
];

const Row = ({ obj, activeColumnIDs }: RowProps<VirtualService>) => {
    const groupVersionKind = getGroupVersionKindForResource(obj);
    return (
        <>
            <TableData id={columns[0].id} activeColumnIDs={activeColumnIDs}>
                <ResourceLink
                    groupVersionKind={groupVersionKind}
                    name={obj.metadata.name}
                    namespace={obj.metadata.namespace}
                />
            </TableData>
            <TableData id={columns[1].id} activeColumnIDs={activeColumnIDs}>
                {obj.kind}
            </TableData>
            <TableData id={columns[2].id} activeColumnIDs={activeColumnIDs}>
                {obj.spec.hosts}
            </TableData>
        </>
    );
};

export const filters: RowFilter[] = [
    {
        filterGroupName: 'Kind',
        type: 'kind',
        reducer: (obj: K8sResourceCommon) => obj.kind,
        filter: (input, obj: K8sResourceCommon) => {
            if (!input.selected?.length) {
                return true;
            }

            return input.selected.includes(obj.kind);
        },
        items: resources.map(({ kind }) => ({ id: kind, title: kind })),
    },
];

type VirtualServiceTableProps = {
    data: VirtualService[];
    unfilteredData: VirtualService[];
    loaded: boolean;
    loadError?: {
        message?: string;
    };
};

const VirtualServiceTable = ({
    data,
    unfilteredData,
    loaded,
    loadError,
}: VirtualServiceTableProps) => {
    return (
        <VirtualizedTable<VirtualService>
            data={data}
            unfilteredData={unfilteredData}
            loaded={loaded}
            loadError={loadError}
            columns={columns}
            Row={Row}
        />
    );
};

const IstioConfigList = () => {
    const watches = resources.map(({ group, version, kind }) => {
        const [data, loaded, error] = useK8sWatchResource<VirtualService[]>({
            groupVersionKind: { group, version, kind },
            isList: true,
            namespaced: false,
        });
        if (error) {
            console.error('Could not load', kind, error);
        }
        return [data, loaded, error];
    });

    const flatData = watches.map(([list]) => list).flat();
    const loaded = watches.every(([, loaded, error]) => !!(loaded || error));
    const [data, filteredData, onFilterChange] = useListPageFilter(
        flatData,
        filters,
    );
    return (
        <>
            <ListPageHeader title="Istio Config" />
            <ListPageBody>
                <ListPageFilter
                    data={data}
                    loaded={loaded}
                    rowFilters={filters}
                    onFilterChange={onFilterChange}
                />
                <VirtualServiceTable
                    data={filteredData}
                    unfilteredData={data}
                    loaded={loaded}
                />
            </ListPageBody>
        </>
    );
};

export default IstioConfigList;