import * as React from 'react';
import {
  Divider,
  Dropdown,
  DropdownGroup,
  DropdownItem,
  DropdownList,
  MenuToggle,
  MenuToggleElement
} from '@patternfly/react-core';
import { detailTabActionsStyle } from 'styles/FlexStyles';
import { kialiStyle } from 'styles/StyleUtils';
import { useKialiTranslation } from 'utils/I18nUtils';
import type { ExternalLink } from 'types/Dashboards';
import {
  istioDashboardViewTitle,
  loadIstioDashboardLinks,
  type IstioDashboardLoadOptions,
  type IstioDashboardTool
} from 'utils/IstioDashboardUtils';
import { ReactComponent as GrafanaLogo } from '../../assets/img/mesh/grafana.svg';
import { ReactComponent as PersesLogo } from '../../assets/img/mesh/perses.svg';

type IstioDashboardsDropdownProps = {
  grafanaLinks: ExternalLink[];
  persesLinks: ExternalLink[];
};

type IstioDashboardsDropdownLoaderProps = IstioDashboardLoadOptions & {
  extra?: React.ReactNode;
};

const logoStyle = kialiStyle({
  flexShrink: 0,
  height: '1rem',
  width: '1rem'
});

type ToolGroupProps = {
  Logo: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  links: ExternalLink[];
  tool: IstioDashboardTool;
};

const ToolGroup: React.FC<ToolGroupProps> = ({ Logo, links, tool }: ToolGroupProps) => {
  if (links.length === 0) {
    return null;
  }

  const toolId = tool.toLowerCase();

  return (
    <DropdownGroup key={tool} label={tool}>
      {links.map((link, idx) => (
        <DropdownItem
          key={link.url}
          data-test={`istio-dashboard-link-${toolId}-${idx}`}
          icon={<Logo aria-hidden={true} className={logoStyle} />}
          isExternalLink
          rel="noopener noreferrer"
          title={istioDashboardViewTitle(link.name, tool)}
          to={link.url}
        >
          {link.name}
        </DropdownItem>
      ))}
    </DropdownGroup>
  );
};

export const IstioDashboardsDropdown: React.FC<IstioDashboardsDropdownProps> = ({
  grafanaLinks,
  persesLinks
}: IstioDashboardsDropdownProps) => {
  const { t } = useKialiTranslation();
  const [isOpen, setIsOpen] = React.useState(false);

  if (grafanaLinks.length === 0 && persesLinks.length === 0) {
    return null;
  }

  return (
    <Dropdown
      data-test="istio-dashboards-dropdown"
      isOpen={isOpen}
      onOpenChange={(open: boolean) => setIsOpen(open)}
      onSelect={() => setIsOpen(false)}
      popperProps={{ position: 'right' }}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          data-test="istio-dashboards-toggle"
          isExpanded={isOpen}
          onClick={() => setIsOpen(!isOpen)}
        >
          {t('Dashboards')}
        </MenuToggle>
      )}
    >
      <DropdownList>
        <ToolGroup Logo={GrafanaLogo} links={grafanaLinks} tool="Grafana" />
        {grafanaLinks.length > 0 && persesLinks.length > 0 && <Divider />}
        <ToolGroup Logo={PersesLogo} links={persesLinks} tool="Perses" />
      </DropdownList>
    </Dropdown>
  );
};

export const IstioDashboardsDropdownLoader: React.FC<IstioDashboardsDropdownLoaderProps> = ({
  extra,
  kind,
  namespace,
  object,
  objectType
}: IstioDashboardsDropdownLoaderProps) => {
  const [grafanaLinks, setGrafanaLinks] = React.useState<ExternalLink[]>([]);
  const [persesLinks, setPersesLinks] = React.useState<ExternalLink[]>([]);

  React.useEffect(() => {
    let cancelled = false;

    loadIstioDashboardLinks({ kind, namespace, object, objectType }).then(links => {
      if (!cancelled) {
        setGrafanaLinks(links.grafanaLinks);
        setPersesLinks(links.persesLinks);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [kind, namespace, object, objectType]);

  const dropdown = <IstioDashboardsDropdown grafanaLinks={grafanaLinks} persesLinks={persesLinks} />;
  const hasDropdown = grafanaLinks.length > 0 || persesLinks.length > 0;

  if (!hasDropdown && extra == null) {
    return null;
  }

  if (extra == null) {
    return dropdown;
  }

  return (
    <div className={detailTabActionsStyle}>
      {dropdown}
      {extra}
    </div>
  );
};
