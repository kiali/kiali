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
  title: string;
};

const noAnnotationsStyle = kialiStyle({
  color: 'var(--pf-t--global--color--nonstatus--gray--default)',
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

export const EditableAnnotationsCard: React.FC<EditableAnnotationsCardProps> = ({
  annotations,
  canEdit,
  numAnnotations = 5,
  onSave,
  title
}) => {
  const [showEditor, setShowEditor] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const handleChange = (updated: Record<string, string>): void => {
    onSave(updated);
    setShowEditor(false);
  };

  const annotationEntries = Object.entries(annotations ?? {});
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
                {(expanded ? annotationEntries : annotationEntries.slice(0, numAnnotations)).map(([key, value]) => (
                  <DescriptionListGroup key={key}>
                    <DescriptionListTerm>{key}</DescriptionListTerm>
                    {value && (
                      <DescriptionListDescription className={annotationValueStyle}>{value}</DescriptionListDescription>
                    )}
                  </DescriptionListGroup>
                ))}
              </DescriptionList>
              {annotationEntries.length > numAnnotations && (
                <Button variant="link" isInline onClick={() => setExpanded(!expanded)} style={{ marginTop: '0.25rem' }}>
                  {expanded
                    ? t('Show less')
                    : t('{{count}} more', { count: annotationEntries.length - numAnnotations })}
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
