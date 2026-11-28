import * as React from 'react';
import { useState } from 'react';
import type { MenuToggleElement } from '@patternfly/react-core';
import { Badge, Checkbox, Divider, Dropdown, DropdownList, MenuToggle } from '@patternfly/react-core';

import { isMultiCluster, serverConfig } from 'config';
import { KialiIcon } from 'config/KialiIcon';
import { ClusterThunkActions } from 'actions/ClusterThunkActions';
import { useKialiDispatch, useKialiSelector } from 'hooks/redux';
import { selectedClustersSelector } from 'store/Selectors';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { allClusterNames } from 'utils/ClusterUtils';
import { t } from 'utils/I18nUtils';

const dropdownStyle = kialiStyle({
  marginBottom: PFSpacer.xs,
  width: '18rem'
});

const optionStyle = kialiStyle({
  marginLeft: PFSpacer.md
});

const allOptionStyle = kialiStyle({
  marginLeft: PFSpacer.md
});

const dividerStyle = kialiStyle({
  paddingTop: PFSpacer.sm
});

const homeClusterIconStyle = kialiStyle({
  marginLeft: PFSpacer.xs
});

/**
 * Global cluster selection, shown next to the namespace dropdown.
 * The selection scopes the namespaces and the cluster aware views.
 *
 * Undefined means "all clusters"; an explicit empty selection is allowed and
 * leaves the views empty, so deselecting the last cluster is a real state.
 */
export const ClusterSelector: React.FC = () => {
  const dispatch = useKialiDispatch();
  const selectedClusters = useKialiSelector(selectedClustersSelector);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  if (!isMultiCluster) {
    return null;
  }

  const allSelected = selectedClusters === undefined;
  const selectedCount = selectedClusters?.length ?? allClusterNames().length;

  const isChecked = (cluster: string): boolean => allSelected || selectedClusters.includes(cluster);

  const onClusterToggled = (cluster: string): void => {
    dispatch(ClusterThunkActions.toggleSelectedCluster(cluster));
  };

  const toggleText = (): React.ReactNode => {
    if (allSelected) {
      return <span>{t('All clusters')}</span>;
    }

    if (selectedCount === 0) {
      return <span>{t('No clusters')}</span>;
    }

    if (selectedCount === 1) {
      return (
        <>
          <span style={{ paddingRight: PFSpacer.sm }}>{`${t('Cluster')}:`}</span>
          <span>{selectedClusters[0]}</span>
        </>
      );
    }

    return (
      <>
        <span style={{ paddingRight: PFSpacer.sm }}>{t('Clusters')}</span>
        <Badge>{selectedCount}</Badge>
      </>
    );
  };

  const clusterOption = (cluster: string): React.ReactNode => {
    const isHome = serverConfig.clusters[cluster]?.isKialiHome === true;

    return (
      <div className={optionStyle} key={`cluster-list-item[${cluster}]`}>
        <Checkbox
          id={`cluster-list-item[${cluster}]`}
          label={
            <>
              <span>{cluster}</span>
              {isHome && (
                <span className={homeClusterIconStyle} title={t('Home cluster')}>
                  <KialiIcon.Star />
                </span>
              )}
            </>
          }
          isChecked={isChecked(cluster)}
          onChange={() => onClusterToggled(cluster)}
        />
      </div>
    );
  };

  return (
    <Dropdown
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          data-test="cluster-selector"
          id="global-cluster-selector"
          onClick={() => setIsOpen(!isOpen)}
          isExpanded={isOpen}
          aria-label={t('Select clusters')}
        >
          {toggleText()}
        </MenuToggle>
      )}
      isOpen={isOpen}
      onOpenChange={(open: boolean) => setIsOpen(open)}
    >
      <DropdownList data-test="cluster-selector-list" className={dropdownStyle}>
        <div className={allOptionStyle}>
          <Checkbox
            id="cluster-list-item[all]"
            label={t('All clusters')}
            isChecked={allSelected}
            onChange={() => dispatch(ClusterThunkActions.setSelectedClusters(allSelected ? [] : allClusterNames()))}
          />
        </div>
        <Divider className={dividerStyle} />
        {allClusterNames().map(cluster => clusterOption(cluster))}
      </DropdownList>
    </Dropdown>
  );
};
