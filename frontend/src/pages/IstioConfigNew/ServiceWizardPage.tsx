import * as React from 'react';
import { DefaultSecondaryMasthead } from 'components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import { RenderContent } from 'components/Nav/Page';
// import { kialiStyle } from 'styles/StyleUtils';
import { MeshCluster } from 'types/Mesh';
import { KialiAppState } from 'store/Store';
import { activeClustersSelector, activeNamespacesSelector, namespacesPerClusterSelector } from 'store/Selectors';
import { connect } from 'react-redux';
import { Namespace } from 'types/Namespace';
import { ServiceId } from 'types/ServiceInfo';

type ReduxProps = {
  activeClusters: MeshCluster[];
  activeNamespaces: Namespace[];
  kiosk: string;
  namespacesPerCluster?: Map<string, string[]>;
};

type Props = ReduxProps & {
  serviceId: ServiceId;
  wizardType: string;
};

// const editIcon = kialiStyle({
//   marginLeft: '0.25rem',
//   marginBottom: '0.20rem'
// });

// const editButton = kialiStyle({
//   marginLeft: '0.5rem',
//   display: 'flex',
//   alignItems: 'center'
// });

// const editStyle = kialiStyle({
//   display: 'flex',
//   paddingTop: '0.25rem'
// });

const ServiceWizardPageComponent: React.FC<Props> = (props: Props) => {
  console.log(props); // TODO temporary to avoid unused warning

  return (
    <>
      <div>
        <DefaultSecondaryMasthead showClusterSelector={false} hideNamespaceSelector={true} />
      </div>

      <RenderContent>
        {/* <Form className={formPadding} isHorizontal={true}>
          <FormGroup label={t('Namespaces')} isRequired={true} fieldId="namespaces">
            <NamespaceDropdown disabled={false} />

            {!isValid(isNamespacesValid) && (
              <FormHelperText>
                <HelperText>
                  <HelperTextItem>{t('An Istio Config resource needs at least one namespace selected')}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup>

          {isMultiCluster && (
            <FormGroup label={t('Clusters')} isRequired={true} fieldId="clusters">
              <ClusterDropdown />

              {!isValid(isClustersValid) && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>{t('An Istio Config resource needs at least one cluster selected')}</HelperTextItem>
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
                  <HelperTextItem>{t('A valid {{kind}} name is required', props.objectGVK.Kind)}</HelperTextItem>
                </HelperText>
              </FormHelperText>
            )}
          </FormGroup> */}

        {/* {getGVKTypeString(props.objectGVK) === getGVKTypeString(gvkType.AuthorizationPolicy) && (
            <AuthorizationPolicyForm authorizationPolicy={authorizationPolicy} onChange={onChangeAuthorizationPolicy} />
          )}

          {getGVKTypeString(props.objectGVK) === getGVKTypeString(gvkType.Gateway) && (
            <GatewayForm gateway={gateway} onChange={onChangeGateway} />
          )}

          {getGVKTypeString(props.objectGVK) === getGVKTypeString(gvkType.K8sGateway) && (
            <K8sGatewayForm k8sGateway={k8sGateway} onChange={onChangeK8sGateway} />
          )}

          {getGVKTypeString(props.objectGVK) === getGVKTypeString(gvkType.K8sReferenceGrant) && (
            <K8sReferenceGrantForm k8sReferenceGrant={k8sReferenceGrant} onChange={onChangeK8sReferenceGrant} />
          )}

          {getGVKTypeString(props.objectGVK) === getGVKTypeString(gvkType.PeerAuthentication) && (
            <PeerAuthenticationForm peerAuthentication={peerAuthentication} onChange={onChangePeerAuthentication} />
          )}

          {getGVKTypeString(props.objectGVK) === getGVKTypeString(gvkType.RequestAuthentication) && (
            <RequestAuthenticationForm
              requestAuthentication={requestAuthentication}
              onChange={onChangeRequestAuthentication}
            />
          )}

          {getGVKTypeString(props.objectGVK) === getGVKTypeString(gvkType.ServiceEntry) && (
            <ServiceEntryForm serviceEntry={serviceEntry} onChange={onChangeServiceEntry} />
          )}

          {getGVKTypeString(props.objectGVK) === getGVKTypeString(gvkType.Sidecar) && (
            <SidecarForm sidecar={sidecar} onChange={onChangeSidecar} />
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
                data-test={'edit-labels'}
              >
                {t('Edit')}
                <KialiIcon.PencilAlt className={editIcon} />
              </Button>
            </div>

            <WizardLabels
              showAnotationsWizard={showLabelsWizard}
              type={'labels'}
              onChange={labels => onAddLabels(labels)}
              onClose={() => onLabelsWizardToggle(false)}
              labels={labels}
              canEdit={true}
            />
          </FormGroup>

          <FormGroup fieldId="annotations" label={t('Annotations')}>
            <div className={editStyle}>
              <Labels labels={annotations} type={'annotations'} expanded={true} />

              <Button
                className={editButton}
                type="button"
                variant="link"
                isInline
                onClick={() => onAnnotationsWizardToggle(true)}
                data-test={'edit-annotations'}
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
              data-test={'preview'}
            >
              {t('Preview')}
            </Button>

            <Button variant={ButtonVariant.secondary} onClick={() => backToList()}>
              {t('Cancel')}
            </Button>
          </ActionGroup>
        </Form>

        <IstioConfigPreview
          isOpen={showPreview}
          items={itemsPreview}
          downloadPrefix={props.objectGVK.Kind}
          title={t('Preview new istio objects')}
          opTarget={'create'}
          disableAction={!canCreate}
          ns={props.activeNamespaces.map(n => n.name).join(',')}
          onConfirm={items => onPreviewConfirm(items)}
          onClose={() => setShowPreview(false)}
        /> */}
      </RenderContent>
    </>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => {
  return {
    activeClusters: activeClustersSelector(state),
    activeNamespaces: activeNamespacesSelector(state),
    kiosk: state.globalState.kiosk,
    namespacesPerCluster: namespacesPerClusterSelector(state)
  };
};

export const ServiceWizardPage = connect(mapStateToProps)(ServiceWizardPageComponent);
