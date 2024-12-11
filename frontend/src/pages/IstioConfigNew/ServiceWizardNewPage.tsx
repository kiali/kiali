import { FormGroup, FormHelperText, HelperText, HelperTextItem, TextInput, Button, ActionGroup, ButtonVariant } from "@patternfly/react-core";
import { DefaultSecondaryMasthead } from "components/DefaultSecondaryMasthead/DefaultSecondaryMasthead";
import { ConfigPreviewItem, IstioConfigPreview } from "components/IstioConfigPreview/IstioConfigPreview";
import { TrafficShifting } from "components/IstioWizards/TrafficShifting";
import { WizardLabels } from "components/IstioWizards/WizardLabels";
import { Labels } from "components/Label/Labels";
import { RenderContent } from "components/Nav/Page";
import { isMultiCluster } from "config";
import { KialiIcon } from "config/KialiIcon";
import { Namespace, t } from "i18next";
import { isTrafficShiftingStateValid, TrafficShiftingForm, TrafficShiftingState } from "pages/Services/TrafficShiftingForm";
import React, { Props } from "react";
import { kialiStyle } from "styles/StyleUtils";
import { gvkType } from "types/IstioConfigList";
import { canCreate } from "types/Permissions";
import { isValid } from "utils/Common";
import { getGVKTypeString } from "utils/IstioConfigUtils";
import { ClusterDropdown } from "./ClusterDropdown";
import { isValidK8SName } from "helpers/ValidationHelpers";
import { GroupVersionKind } from "types/IstioObjects";
import { KialiAppState } from "store/Store";
import { activeClustersSelector, activeNamespacesSelector, namespacesPerClusterSelector } from "store/Selectors";
import { connect } from "react-redux";
import { MeshCluster } from "types/Mesh";
import { ALLOW } from "./AuthorizationPolicyForm";

export const initTrafficShifting = (): TrafficShiftingState => ({
    workloadSelector: '',
    action: ALLOW,
    rules: [],
    addWorkloadSelector: false,
    workloadSelectorValid: false
});

type ReduxProps = {
    activeClusters: MeshCluster[];
    activeNamespaces: Namespace[];
    kiosk: string;
    namespacesPerCluster?: Map<string, string[]>;
  };

type Props = ReduxProps & {
    objectGVK: GroupVersionKind;
  };

const editIcon = kialiStyle({
  marginLeft: '0.25rem',
  marginBottom: '0.20rem'
});

const editButton = kialiStyle({
  marginLeft: '0.5rem',
  display: 'flex',
  alignItems: 'center'
});

const editStyle = kialiStyle({
  display: 'flex',
  paddingTop: '0.25rem'
});

const ServiceWizardNewPageComponent: React.FC<Props> = (props: Props) => {
    const [annotations, setAnnotations] = React.useState<{ [key: string]: string }>({});
    const [trafficShifting, setTrafficShifting] = React.useState<TrafficShifting>(
      initTrafficShifting()
  );
  const [labels, setLabels] = React.useState<{ [key: string]: string }>({});
  const [showLabelsWizard, setShowLabelsWizard] = React.useState<boolean>(false);
  const [showAnnotationsWizard, setShowAnnotationsWizard] = React.useState<boolean>(false);
  const [showPreview, setShowPreview] = React.useState<boolean>(false);
  const [itemsPreview] = React.useState<ConfigPreviewItem[]>([]);
  const [istioPermissions, setIstioPermissions] = React.useState<IstioPermissions>({});


  const openPreview = (): void => {
    const items: ConfigPreviewItem[] = [];
    props.activeNamespaces.forEach(ns => {
      switch (getGVKTypeString(props.objectGVK)) {
        case getGVKTypeString(gvkType.TrafficShifting):
          items.push({
            title: t('Traffic Shifting'),
            objectGVK: props.objectGVK,
            items: [buildTrafficShifting(annotations, labels, name, ns.name, trafficShifting)]
          });
          break;
      }
    });
  };

  const isIstioFormValid = (): boolean => {
    switch (getGVKTypeString(props.objectGVK)) {
      case getGVKTypeString(gvkType.AuthorizationPolicy):
        return isTrafficShiftingStateValid(trafficShifting);
    }
};

  const onChangeTrafficShifting = (trafficShiftingValue: TrafficShiftingState): void => {
     const newTrafficShifting = { ...trafficShifting };
     Object.keys(newTrafficShifting).forEach(key => (newTrafficShifting[key] = trafficShiftingValue[key]));
    
     setTrafficShifting(newTrafficShifting);
    };

    const onNameChange = (_event: React.FormEvent, value: string): void => {
      setName(value);
      };

    const onLabelsWizardToggle = (value: boolean): void => {
      setShowLabelsWizard(value);
    };

    const onAddLabels = (value: { [key: string]: string }): void => {
      setLabels(value);
      setShowLabelsWizard(false);
    };

    const onAddAnnotations = (value: { [key: string]: string }): void => {
      setAnnotations(value);
      setShowAnnotationsWizard(false);
    };

    const onAnnotationsWizardToggle = (value: boolean): void => {
      setShowAnnotationsWizard(value);
    };
    
    {getGVKTypeString(props.objectGVK) === getGVKTypeString(gvkType.TrafficShifting) && (
        <TrafficShiftingForm trafficShifting={trafficShifting} onChange={onChangeTrafficShifting} />
      )}
      
  const canCreate = props.activeNamespaces.every(ns => canCreateNamespace(ns.name, istioPermissions));
  const isNamespacesValid = props.activeNamespaces.length > 0;
  const isClustersValid = props.activeClusters.length > 0 || !isMultiCluster;
  const isNameValid = isValidK8SName(name);
  const isFormValid = isNameValid && isNamespacesValid && isClustersValid && isIstioFormValid();


      function backToList(): void {
          throw new Error("Function not implemented.");
      }

      function onPreviewConfirm(items: ConfigPreviewItem[]): void {
          throw new Error("Function not implemented.");
      }

return (
    <>
      <div>
        <DefaultSecondaryMasthead showClusterSelector={false} hideNamespaceSelector={true} />
      </div>
  
      <RenderContent>
        {isMultiCluster && (
          <FormGroup label={t('Clusters')} isRequired={true} fieldId="clusters">
            <ClusterDropdown />
  
            {!isValid(isClustersValid) && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>
                    {t('An Istio Config resource needs at least one cluster selected')}
                  </HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>
        )}
  
        <FormGroup label={t('Name')} isRequired={true} fieldId="name">
          <TextInput
            value={name}
            isRequired={true}
            type="text"
            id="name"
            aria-describedby={t('name')}
            name="name"
            onChange={onNameChange}
            validated={isValid(isNameValid)}
          />
  
          {!isValid(isNameValid) && (
            <FormHelperText>
              <HelperText>
                <HelperTextItem>
                  {t('A valid {{kind}} name is required', { kind: props.objectGVK.Kind })}
                </HelperTextItem>
              </HelperText>
            </FormHelperText>
          )}
        </FormGroup>
  
        {getGVKTypeString(props.objectGVK) === getGVKTypeString(gvkType.AuthorizationPolicy) && (
          <TrafficShiftingForm
            trafficShifting={trafficShifting}
            onChange={onChangeTrafficShifting}
          />
        )}
  
        <FormGroup fieldId="labels" label="Labels">
          <div className={editStyle}>
            <Labels labels={labels} expanded={true} />
  
            <Button
              className={editButton}
              type="button"
              variant="link"
              isInline
              onClick={() => onLabelsWizardToggle(true)}
              data-test="edit-labels"
            >
              {t('Edit')}
              <KialiIcon.PencilAlt className={editIcon} />
            </Button>
          </div>
  
          <WizardLabels
            showAnotationsWizard={showLabelsWizard}
            type="labels"
            onChange={labels => onAddLabels(labels)}
            onClose={() => onLabelsWizardToggle(false)}
            labels={labels}
            canEdit={true}
          />
        </FormGroup>
  
        <FormGroup fieldId="annotations" label={t('Annotations')}>
          <div className={editStyle}>
            <Labels labels={annotations} type="annotations" expanded={true} />
  
            <Button
              className={editButton}
              type="button"
              variant="link"
              isInline
              onClick={() => onAnnotationsWizardToggle(true)}
              data-test="edit-annotations"
            >
              {t('Edit')}
              <KialiIcon.PencilAlt className={editIcon} />
            </Button>
          </div>
  
          <WizardLabels
              showAnotationsWizard={showAnnotationsWizard}
              type={'annotations'}
              onChange={annotations => onAddAnnotations(annotations)}
              onClose={() => onAnnotationsWizardToggle(false)}
              labels={annotations}
              canEdit={true}
            />
        </FormGroup>
  
        <ActionGroup>
          <Button
            variant={ButtonVariant.primary}
            isDisabled={!isFormValid}
            onClick={() => openPreview()}
            data-test="preview"
          >
            {t('Preview')}
          </Button>
  
          <Button variant={ButtonVariant.secondary} onClick={() => backToList()}>
            {t('Cancel')}
          </Button>
        </ActionGroup>
      </RenderContent>
  
      <IstioConfigPreview
        isOpen={showPreview}
        items={itemsPreview}
        downloadPrefix={props.objectGVK.Kind}
        title={t('Preview new istio objects')}
        opTarget="create"
        disableAction={!canCreate}
        ns={props.activeNamespaces.map(n => n.name).join(',')}
        onConfirm={items => onPreviewConfirm(items)}
        onClose={() => setShowPreview(false)}
      />
    </>
  );
  



      function setName(value: string) {
          throw new Error("Function not implemented.");
      }

    function canCreateNamespace(name: any, istioPermissions: any): unknown {
        throw new Error("Function not implemented.");
    }

