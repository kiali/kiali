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
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { useKialiTranslation } from 'utils/I18nUtils';
import type { ExternalLink } from 'types/Dashboards';
import {
  istioDashboardViewTitle,
  loadIstioDashboardLinks,
  type IstioDashboardKind,
  type IstioDashboardTool
} from 'utils/IstioDashboardUtils';
import { ReactComponent as GrafanaLogo } from '../../assets/img/mesh/grafana.svg';
import { ReactComponent as PersesLogo } from '../../assets/img/mesh/perses.svg';

type IstioDashboardsDropdownProps = {
  grafanaLinks: ExternalLink[];
  persesLinks: ExternalLink[];
};

const logoStyle = kialiStyle({
  flexShrink: 0,
  height: '1rem',
  marginRight: PFSpacer.xs,
  width: '1rem'
});

const groupLabelStyle = kialiStyle({
  alignItems: 'center',
  display: 'inline-flex'
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
    <DropdownGroup
      key={tool}
      label={
        <span className={groupLabelStyle}>
          <Logo aria-hidden={true} className={logoStyle} />
          {tool}
        </span>
      }
    >
      {links.map((link, idx) => (
        <DropdownItem
          key={link.url}
          data-test={`istio-dashboard-link-${toolId}-${idx}`}
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
        <ToolGroup Logo={PersesLogo} links={persesLinks} tool="Perses" />
        {persesLinks.length > 0 && grafanaLinks.length > 0 && <Divider />}
        <ToolGroup Logo={GrafanaLogo} links={grafanaLinks} tool="Grafana" />
      </DropdownList>
    </Dropdown>
  );
};

export const IstioDashboardsDropdownLoader: React.FC<{ kind: IstioDashboardKind }> = ({ kind }) => {
  const [grafanaLinks, setGrafanaLinks] = React.useState<ExternalLink[]>([]);
  const [persesLinks, setPersesLinks] = React.useState<ExternalLink[]>([]);

  React.useEffect(() => {
    let cancelled = false;

    loadIstioDashboardLinks(kind).then(links => {
      if (!cancelled) {
        setGrafanaLinks(links.grafanaLinks);
        setPersesLinks(links.persesLinks);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [kind]);

  return <IstioDashboardsDropdown grafanaLinks={grafanaLinks} persesLinks={persesLinks} />;
};
