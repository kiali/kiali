import * as React from 'react';
import { KialiAppState } from '../../store/Store';
import { activeClustersSelector, activeNamespacesSelector, namespacesPerClusterSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import { Namespace } from '../../types/Namespace';
import { MeshCluster } from '../../types/Mesh';
import {
  ActionGroup,
  Button,
  ButtonVariant,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  TextInput
} from '@patternfly/react-core';
import { RenderContent } from '../../components/Nav/Page';
import { kialiStyle } from 'styles/StyleUtils';
import { GatewayForm, GatewayState, initGateway, isGatewayStateValid } from './GatewayForm';
import { K8sGatewayForm, K8sGatewayState, initK8sGateway, isK8sGatewayStateValid } from './K8sGatewayForm';
import {
  K8sReferenceGrantForm,
  K8sReferenceGrantState,
  initK8sReferenceGrant,
  isK8sReferenceGrantStateValid
} from './K8sReferenceGrantForm';
import { SidecarForm, initSidecar, isSidecarStateValid, SidecarState } from './SidecarForm';
import { Paths, serverConfig } from '../../config';
import { KialiIcon } from '../../config/KialiIcon';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import * as API from '../../services/Api';
import { IstioPermissions } from '../../types/IstioConfigDetails';
import * as AlertUtils from '../../utils/AlertUtils';
import { router } from '../../app/History';
import {
  buildAuthorizationPolicy,
  buildGateway,
  buildK8sGateway,
  buildK8sReferenceGrant,
  buildPeerAuthentication,
  buildRequestAuthentication,
  buildServiceEntry,
  buildSidecar
} from '../../components/IstioWizards/WizardActions';
import { MessageType } from '../../types/MessageCenter';
import {
  AuthorizationPolicyForm,
  AuthorizationPolicyState,
  initAuthorizationPolicy,
  isAuthorizationPolicyStateValid
} from './AuthorizationPolicyForm';
import {
  PeerAuthenticationForm,
  initPeerAuthentication,
  isPeerAuthenticationStateValid,
  PeerAuthenticationState
} from './PeerAuthenticationForm';
import {
  RequestAuthenticationForm,
  initRequestAuthentication,
  isRequestAuthenticationStateValid,
  RequestAuthenticationState
} from './RequestAuthenticationForm';
import { isValidK8SName } from '../../helpers/ValidationHelpers';
import { DefaultSecondaryMasthead } from '../../components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import { ServiceEntryForm, initServiceEntry, isServiceEntryValid, ServiceEntryState } from './ServiceEntryForm';
import { ConfigPreviewItem, IstioConfigPreview } from 'components/IstioConfigPreview/IstioConfigPreview';
import { isValid } from 'utils/Common';
import { ClusterDropdown } from './ClusterDropdown';
import { NamespaceDropdown } from '../../components/Dropdown/NamespaceDropdown';
import { Labels } from '../../components/Label/Labels';
import { WizardLabels } from '../../components/IstioWizards/WizardLabels';
import { isParentKiosk, kioskContextMenuAction } from 'components/Kiosk/KioskActions';
import { dicTypeToGVK, gvkType } from '../../types/IstioConfigList';
import { getGVKTypeString } from '../../utils/IstioConfigUtils';
import { GroupVersionKind } from '../../types/IstioObjects';
import { useKialiTranslation } from 'utils/I18nUtils';
import { usePreviousValue } from 'utils/ReactUtils';
import { istioNamespaces } from 'config/ServerConfig';

type ReduxProps = {
  activeClusters: MeshCluster[];
  activeNamespaces: Namespace[];
  kiosk: string;
  namespacesPerCluster?: Map<string, string[]>;
};

type Props = ReduxProps & {
  objectGVK: GroupVersionKind;
};

const formPadding = kialiStyle({ padding: '2rem 1.25rem' });

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

// Used in the Istio Config list Actions
export const NEW_ISTIO_RESOURCE = [
  { value: dicTypeToGVK[gvkType.AuthorizationPolicy], disabled: false },
  { value: dicTypeToGVK[gvkType.Gateway], disabled: false },
  { value: dicTypeToGVK[gvkType.K8sGateway], disabled: false },
  { value: dicTypeToGVK[gvkType.K8sReferenceGrant], disabled: false },
  { value: dicTypeToGVK[gvkType.PeerAuthentication], disabled: false },
  { value: dicTypeToGVK[gvkType.RequestAuthentication], disabled: false },
  { value: dicTypeToGVK[gvkType.ServiceEntry], disabled: false },
  { value: dicTypeToGVK[gvkType.Sidecar], disabled: false }
];

const IstioConfigNewPageComponent: React.FC<Props> = (props: Props) => {
  const [annotations, setAnnotations] = React.useState<{ [key: string]: string }>({});
  const [authorizationPolicy, setAuthorizationPolicy] = React.useState<AuthorizationPolicyState>(
    initAuthorizationPolicy()
  );
  const [gateway, setGateway] = React.useState<GatewayState>(initGateway());
  const [istioPermissions, setIstioPermissions] = React.useState<IstioPermissions>({});
  const [itemsPreview, setItemsPreview] = React.useState<ConfigPreviewItem[]>([]);
  const [k8sGateway, setK8sGateway] = React.useState<K8sGatewayState>(initK8sGateway());
  const [k8sReferenceGrant, setK8sReferenceGrant] = React.useState<K8sReferenceGrantState>(initK8sReferenceGrant());
  const [labels, setLabels] = React.useState<{ [key: string]: string }>({});
  const [name, setName] = React.useState<string>('');
  const [peerAuthentication, setPeerAuthentication] = React.useState<PeerAuthenticationState>(initPeerAuthentication());
  const [requestAuthentication, setRequestAuthentication] = React.useState<RequestAuthenticationState>(
    initRequestAuthentication()
  );
  const [serviceEntry, setServiceEntry] = React.useState<ServiceEntryState>(initServiceEntry());
  const [showAnnotationsWizard, setShowAnnotationsWizard] = React.useState<boolean>(false);
  const [showLabelsWizard, setShowLabelsWizard] = React.useState<boolean>(false);
  const [showPreview, setShowPreview] = React.useState<boolean>(false);
  const [sidecar, setSidecar] = React.useState<SidecarState>(initSidecar(`${istioNamespaces()[0]}/*`));

  const { t } = useKialiTranslation();

  const promises = React.useRef<PromisesRegistry>();

  // Promises initialization
  React.useEffect(() => {
    promises.current = new PromisesRegistry();

    return () => {
      promises.current?.cancelAll();
    };
  }, []);

  const { activeNamespaces, activeClusters, namespacesPerCluster, objectGVK } = props;

  const canCreateNamespace = React.useCallback(
    (namespace: string, permissions: IstioPermissions): boolean => {
      return (
        permissions[namespace] &&
        objectGVK.Kind.length > 0 &&
        permissions[namespace][getGVKTypeString(objectGVK)].create
      );
    },
    [objectGVK]
  );

  const isNamespaceInCluster = React.useCallback(
    (namespace: string, cluster: string): boolean => {
      return (
        namespacesPerCluster !== undefined &&
        namespacesPerCluster.has(cluster) &&
        namespacesPerCluster.get(cluster)!.includes(namespace)
      );
    },
    [namespacesPerCluster]
  );

  const fetchPermissionsForCluster = React.useCallback(
    (cluster?: string): void => {
      if (activeNamespaces.length > 0) {
        promises.current
          ?.register(
            `permissions${cluster}`,
            API.getIstioPermissions(
              activeNamespaces.map(n => n.name),
              cluster
            )
          )
          .then(permResponse => {
            setIstioPermissions(permResponse.data);

            activeNamespaces.forEach(ns => {
              if (!canCreateNamespace(ns.name, permResponse.data)) {
                AlertUtils.addWarning(
                  `${t('User does not have permission to create Istio Config on namespace: {{namespace}}', {
                    namespace: ns.name
                  })}${cluster ? t(' in cluster {{clusterName}}', { clusterName: cluster }) : ''}`
                );
              }

              if (cluster && !isNamespaceInCluster(ns.name, cluster)) {
                AlertUtils.addInfo(
                  t('Namespace: {{namespace}} is not found in cluster {{clusterName}}', {
                    namespace: ns.name,
                    clusterName: cluster
                  })
                );
              }
            });
          })
          .catch(error => {
            // Canceled errors are expected on this query when page is unmounted
            if (!error.isCanceled) {
              AlertUtils.addError(t('Could not fetch Permissions.'), error);
            }
          });
      }
    },
    [activeNamespaces, promises, t, isNamespaceInCluster, canCreateNamespace]
  );

  const fetchPermissions = React.useCallback(() => {
    if (activeClusters.length > 0) {
      activeClusters.forEach(cluster => {
        fetchPermissionsForCluster(cluster.name);
      });
    } else {
      fetchPermissionsForCluster();
    }
  }, [activeClusters, fetchPermissionsForCluster]);

  const prevActiveClusters = usePreviousValue(activeClusters);
  const prevActiveNamespaces = usePreviousValue(activeNamespaces);

  React.useEffect(() => {
    // Fetch permissions if the activeClusters or activeNamespaces change
    if (prevActiveClusters !== activeClusters || prevActiveNamespaces !== activeNamespaces) {
      fetchPermissions();
    }
  }, [prevActiveClusters, activeClusters, prevActiveNamespaces, activeNamespaces, fetchPermissions]);

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

  const onAnnotationsWizardToggle = (value: boolean): void => {
    setShowAnnotationsWizard(value);
  };

  const onAddAnnotations = (value: { [key: string]: string }): void => {
    setAnnotations(value);
    setShowAnnotationsWizard(false);
  };

  const onIstioResourceCreate = (): void => {
    if (props.activeClusters.length > 0) {
      props.activeClusters.forEach(cluster => {
        onIstioResourceCreateForCluster(cluster.name);
      });
    } else {
      onIstioResourceCreateForCluster();
    }
  };

  const onIstioResourceCreateForCluster = async (cluster?: string): Promise<void> => {
    const jsonIstioObjects: { json: string; namespace: string }[] = itemsPreview.map(item => ({
      json: JSON.stringify(item.items[0]),
      namespace: item.items[0].metadata.namespace ?? ''
    }));

    let err = 0;
    await Promise.all(
      jsonIstioObjects
        .map(o => API.createIstioConfigDetail(o.namespace, props.objectGVK, o.json, cluster))
        .map(p =>
          p.catch(error => {
            // ignore 404 errors besides no CRD found ones
            if (
              error.response.status !== 404 ||
              API.getErrorString(error).includes('the server could not find the requested resource')
            ) {
              AlertUtils.addError(
                `${t('Could not create Istio {{type}} objects', { type: getGVKTypeString(props.objectGVK) })}${
                  cluster ? t(' in cluster {{clusterName}}', { clusterName: cluster }) : ''
                }`,
                error
              );
              err++;
            }
          })
        )
    ).then(results => {
      if (results.filter(value => value !== undefined).length > 0) {
        AlertUtils.add(
          `${t('Istio {{type}} created', { type: getGVKTypeString(props.objectGVK) })}${
            cluster ? t(' in cluster {{clusterName}}', { clusterName: cluster }) : ''
          }`,
          'default',
          MessageType.SUCCESS
        );
      }
    });

    if (err === 0) {
      backToList();
    }
  };

  const openPreview = (): void => {
    const items: ConfigPreviewItem[] = [];
    props.activeNamespaces.forEach(ns => {
      switch (getGVKTypeString(props.objectGVK)) {
        case getGVKTypeString(gvkType.AuthorizationPolicy):
          items.push({
            title: t('Authorization Policy'),
            objectGVK: props.objectGVK,
            items: [buildAuthorizationPolicy(annotations, labels, name, ns.name, authorizationPolicy)]
          });
          break;
        case getGVKTypeString(gvkType.Gateway):
          items.push({
            title: t('Gateway'),
            objectGVK: props.objectGVK,
            items: [buildGateway(annotations, labels, name, ns.name, gateway)]
          });
          break;
        case getGVKTypeString(gvkType.K8sGateway):
          items.push({
            title: t('K8s Gateway'),
            objectGVK: props.objectGVK,
            items: [buildK8sGateway(annotations, labels, name, ns.name, k8sGateway)]
          });
          break;
        case getGVKTypeString(gvkType.K8sReferenceGrant):
          items.push({
            title: t('K8s Reference Grant'),
            objectGVK: props.objectGVK,
            items: [buildK8sReferenceGrant(annotations, labels, name, ns.name, k8sReferenceGrant)]
          });
          break;
        case getGVKTypeString(gvkType.PeerAuthentication):
          items.push({
            title: t('Peer Authentication'),
            objectGVK: props.objectGVK,
            items: [buildPeerAuthentication(annotations, labels, name, ns.name, peerAuthentication)]
          });
          break;
        case getGVKTypeString(gvkType.RequestAuthentication):
          items.push({
            title: t('Request Authentication'),
            objectGVK: props.objectGVK,
            items: [buildRequestAuthentication(annotations, labels, name, ns.name, requestAuthentication)]
          });
          break;
        case getGVKTypeString(gvkType.ServiceEntry):
          items.push({
            title: t('Service Entry'),
            objectGVK: props.objectGVK,
            items: [buildServiceEntry(annotations, labels, name, ns.name, serviceEntry)]
          });
          break;
        case getGVKTypeString(gvkType.Sidecar):
          items.push({
            title: t('Sidecar'),
            objectGVK: props.objectGVK,
            items: [buildSidecar(annotations, labels, name, ns.name, sidecar)]
          });
          break;
      }
    });
    setItemsPreview(items);
    setShowPreview(true);
    //onIstioResourceCreate()
  };

  const backToList = (): void => {
    // Back to list page
    const backUrl = `/${Paths.ISTIO}?namespaces=${props.activeNamespaces.map(n => n.name).join(',')}`;
    if (isParentKiosk(props.kiosk)) {
      kioskContextMenuAction(backUrl);
    } else {
      router.navigate(backUrl);
    }
  };

  const isIstioFormValid = (): boolean => {
    switch (getGVKTypeString(props.objectGVK)) {
      case getGVKTypeString(gvkType.AuthorizationPolicy):
        return isAuthorizationPolicyStateValid(authorizationPolicy);
      case getGVKTypeString(gvkType.Gateway):
        return isGatewayStateValid(gateway);
      case getGVKTypeString(gvkType.K8sGateway):
        return isK8sGatewayStateValid(k8sGateway);
      case getGVKTypeString(gvkType.K8sReferenceGrant):
        return isK8sReferenceGrantStateValid(k8sReferenceGrant);
      case getGVKTypeString(gvkType.PeerAuthentication):
        return isPeerAuthenticationStateValid(peerAuthentication);
      case getGVKTypeString(gvkType.RequestAuthentication):
        return isRequestAuthenticationStateValid(requestAuthentication);
      case getGVKTypeString(gvkType.ServiceEntry):
        return isServiceEntryValid(serviceEntry);
      case getGVKTypeString(gvkType.Sidecar):
        return isSidecarStateValid(sidecar);
      default:
        return false;
    }
  };

  const onChangeAuthorizationPolicy = (authorizationPolicyValue: AuthorizationPolicyState): void => {
    const newAuthorizationPolicy = { ...authorizationPolicy };
    Object.keys(newAuthorizationPolicy).forEach(key => (newAuthorizationPolicy[key] = authorizationPolicyValue[key]));

    setAuthorizationPolicy(newAuthorizationPolicy);
  };

  const onChangeGateway = (gatewayValue: GatewayState): void => {
    const newGateway = { ...gateway };
    Object.keys(newGateway).forEach(key => (newGateway[key] = gatewayValue[key]));

    setGateway(newGateway);
  };

  const onChangeK8sGateway = (k8sGatewayValue: K8sGatewayState): void => {
    const newK8sGateway = { ...k8sGateway };
    Object.keys(newK8sGateway).forEach(key => (newK8sGateway[key] = k8sGatewayValue[key]));

    setK8sGateway(newK8sGateway);
  };

  const onChangeK8sReferenceGrant = (k8sReferenceGrantValue: K8sReferenceGrantState): void => {
    const newK8sReferenceGrant = { ...k8sReferenceGrant };
    Object.keys(newK8sReferenceGrant).forEach(key => (newK8sReferenceGrant[key] = k8sReferenceGrantValue[key]));

    setK8sReferenceGrant(newK8sReferenceGrant);
  };

  const onChangePeerAuthentication = (peerAuthenticationValue: PeerAuthenticationState): void => {
    const newPeerAuthentication = { ...peerAuthentication };
    Object.keys(newPeerAuthentication).forEach(key => (newPeerAuthentication[key] = peerAuthenticationValue[key]));

    setPeerAuthentication(newPeerAuthentication);
  };

  const onChangeRequestAuthentication = (requestAuthenticationValue: RequestAuthenticationState): void => {
    const newRequestAuthentication = { ...requestAuthentication };
    Object.keys(newRequestAuthentication).forEach(
      key => (newRequestAuthentication[key] = requestAuthenticationValue[key])
    );

    setRequestAuthentication(newRequestAuthentication);
  };

  const onChangeServiceEntry = (serviceEntryValue: ServiceEntryState): void => {
    const newServiceEntry = { ...serviceEntry };
    Object.keys(newServiceEntry).forEach(key => (newServiceEntry[key] = serviceEntryValue[key]));

    setServiceEntry(newServiceEntry);
  };

  const onChangeSidecar = (sidecarValue: SidecarState): void => {
    const newSidecar = { ...sidecar };
    Object.keys(newSidecar).forEach(key => (newSidecar[key] = sidecarValue[key]));

    setSidecar(newSidecar);
  };

  const onPreviewConfirm = (items: ConfigPreviewItem[]): void => {
    setShowPreview(false);
    setItemsPreview(items);

    onIstioResourceCreate();
  };

  const canCreate = props.activeNamespaces.every(ns => canCreateNamespace(ns.name, istioPermissions));
  const isNameValid = isValidK8SName(name);
  const isNamespacesValid = props.activeNamespaces.length > 0;
  const isMultiCluster = Object.keys(serverConfig.clusters).length > 1;
  const isClustersValid = props.activeClusters.length > 0 || !isMultiCluster;
  const isFormValid = isNameValid && isNamespacesValid && isClustersValid && isIstioFormValid();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div>
        <DefaultSecondaryMasthead showClusterSelector={false} hideNamespaceSelector={true} />
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <RenderContent>
          <Form className={formPadding} isHorizontal={true}>
            <FormGroup label={t('Namespaces')} isRequired={true} fieldId="namespaces">
              <NamespaceDropdown disabled={false} />

              {!isValid(isNamespacesValid) && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>
                      {t('An Istio Config resource needs at least one namespace selected')}
                    </HelperTextItem>
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
                    <HelperTextItem>{t('A valid {{kind}} name is required', props.objectGVK.Kind)}</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              )}
            </FormGroup>

            {getGVKTypeString(props.objectGVK) === getGVKTypeString(gvkType.AuthorizationPolicy) && (
              <AuthorizationPolicyForm
                authorizationPolicy={authorizationPolicy}
                onChange={onChangeAuthorizationPolicy}
              />
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
          />
        </RenderContent>
      </div>
    </div>
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

export const IstioConfigNewPage = connect(mapStateToProps)(IstioConfigNewPageComponent);
