import * as React from 'react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Title,
  TitleSizes,
  Tooltip
} from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import { WizardLabels } from 'components/IstioWizards/WizardLabels';
import { t } from 'utils/I18nUtils';

type EditableAnnotationsCardProps = {
  annotations: Record<string, string>;
  canEdit: boolean;
  numAnnotations?: number;
  onSave: (annotations: Record<string, string>) => void;
  prioritizeIstio?: boolean;
  prioritizeIstioCount?: boolean;
  title: string;
};

const noAnnotationsStyle = kialiStyle({
  color: 'var(--pf-t--global--text--color--subtle)',
  fontStyle: 'italic'
});

const headerActionsStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--pf-t--global--spacer--xs)'
});

const annotationValueStyle = kialiStyle({
  paddingLeft: '1rem'
});

const partitionByIstio = (entries: Record<string, string>): { istioCount: number; sorted: Record<string, string> } => {
  const keys = Object.keys(entries);
  const istioKeys = keys.filter(k => k.toLowerCase().includes('istio')).sort();
  const otherKeys = keys.filter(k => !k.toLowerCase().includes('istio')).sort();
  const sorted: Record<string, string> = {};
  for (const k of [...istioKeys, ...otherKeys]) {
    sorted[k] = entries[k];
  }
  return { sorted, istioCount: istioKeys.length };
};

export const EditableAnnotationsCard: React.FC<EditableAnnotationsCardProps> = ({
  annotations,
  canEdit,
  numAnnotations,
  onSave,
  prioritizeIstio = false,
  prioritizeIstioCount = false,
  title
}) => {
  const [showEditor, setShowEditor] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const handleChange = (updated: Record<string, string>): void => {
    onSave(updated);
    setShowEditor(false);
  };

  const { istioCount, sorted } = prioritizeIstio
    ? partitionByIstio(annotations ?? {})
    : { istioCount: 0, sorted: annotations };
  const effectiveNumAnnotations = prioritizeIstioCount ? istioCount : numAnnotations ?? 5;
  const annotationEntries = Object.entries(sorted ?? {});
  if (!prioritizeIstio) {
    annotationEntries.sort(([a], [b]) => a.localeCompare(b));
  }
  const hasAnnotations = annotationEntries.length > 0;

  const headerActions = (
    <div className={headerActionsStyle}>
      <Tooltip content={canEdit ? t('Edit annotations') : t('View annotations')}>
        <Button
          variant="plain"
          size="sm"
          onClick={() => setShowEditor(true)}
          icon={canEdit ? <KialiIcon.PencilAlt /> : <KialiIcon.ExpandArrows />}
        />
      </Tooltip>
    </div>
  );

  return (
    <>
      <Card isCompact>
        <CardHeader actions={{ actions: headerActions, hasNoOffset: true }}>
          <Title headingLevel="h4" size={TitleSizes.md}>
            {title}
          </Title>
        </CardHeader>
        <CardBody>
          {hasAnnotations ? (
            <>
              <DescriptionList isCompact style={{ gap: 0 }}>
                {(expanded ? annotationEntries : annotationEntries.slice(0, effectiveNumAnnotations)).map(
                  ([key, value]) => (
                    <DescriptionListGroup key={key}>
                      <DescriptionListTerm>{key}</DescriptionListTerm>
                      {value && (
                        <DescriptionListDescription className={annotationValueStyle}>
                          {value}
                        </DescriptionListDescription>
                      )}
                    </DescriptionListGroup>
                  )
                )}
              </DescriptionList>
              {annotationEntries.length > effectiveNumAnnotations && (
                <Button variant="link" isInline onClick={() => setExpanded(!expanded)} style={{ marginTop: '0.25rem' }}>
                  {expanded
                    ? t('Show less')
                    : t('{{count}} more', { count: annotationEntries.length - effectiveNumAnnotations })}
                </Button>
              )}
            </>
          ) : (
            <span className={noAnnotationsStyle}>{t('No annotations')}</span>
          )}
        </CardBody>
      </Card>

      <WizardLabels
        canEdit={canEdit}
        labels={annotations ?? {}}
        onChange={handleChange}
        onClose={() => setShowEditor(false)}
        showAnotationsWizard={showEditor}
        type={t('annotations')}
      />
    </>
  );
};
