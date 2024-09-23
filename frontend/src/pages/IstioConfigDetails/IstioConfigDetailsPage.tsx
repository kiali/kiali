import * as React from 'react';
import { aceOptions, IstioConfigDetails, IstioConfigId, yamlDumpOptions } from '../../types/IstioConfigDetails';
import * as AlertUtils from '../../utils/AlertUtils';
import * as API from '../../services/Api';
import AceEditor from 'react-ace';
import {
  HelpMessage,
  ObjectReference,
  ObjectValidation,
  ServiceReference,
  ValidationMessage,
  WorkloadReference
} from '../../types/IstioObjects';
import {
  AceValidations,
  parseHelpAnnotations,
  parseKialiValidations,
  parseLine,
  parseYamlValidations
} from '../../types/AceValidations';
import { IstioActionDropdown } from '../../components/IstioActions/IstioActionsDropdown';
import { RenderComponentScroll } from '../../components/Nav/Page';
import { IstioActionButtons } from '../../components/IstioActions/IstioActionsButtons';
import { router, HistoryManager } from '../../app/History';
import { Paths } from '../../config';
import { MessageType } from '../../types/MessageCenter';
import { getIstioObject, mergeJsonPatch } from '../../utils/IstioConfigUtils';
import { kialiStyle } from 'styles/StyleUtils';
import { ParameterizedTabs, activeTab } from '../../components/Tab/Tabs';
import {
  Button,
  ButtonVariant,
  Drawer,
  DrawerActions,
  DrawerCloseButton,
  DrawerContent,
  DrawerContentBody,
  DrawerHead,
  DrawerPanelContent,
  Modal,
  ModalVariant,
  Tab,
  Text,
  TextVariants
} from '@patternfly/react-core';
import { showInMessageCenter } from '../../utils/IstioValidationUtils';
import { IstioConfigOverview } from './IstioObjectDetails/IstioConfigOverview';
import { Annotation } from 'react-ace/types';
import { RenderHeader } from '../../components/Nav/Page/RenderHeader';
import { ErrorMsg } from '../../types/ErrorMsg';
import { ErrorSection } from '../../components/ErrorSection/ErrorSection';
import { isParentKiosk, kioskContextMenuAction } from '../../components/Kiosk/KioskActions';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { basicTabStyle } from 'styles/TabStyles';
import { istioAceEditorStyle } from 'styles/AceEditorStyle';
import { Theme } from 'types/Common';
import { ApiError } from 'types/Api';
import { dump, loadAll } from 'js-yaml';
import { BlockerFunction, useBlocker } from 'react-router-dom-v5-compat';
import ReactAce from 'react-ace/lib/ace';
import { RefreshButton } from 'components/Refresh/RefreshButton';
import { t, useKialiTranslation } from 'utils/I18nUtils';

const rightToolbarStyle = kialiStyle({
  zIndex: 500
});

const editorDrawer = kialiStyle({
  margin: 0
});

interface RangeRow {
  endRow: number;
  startRow: number;
}

interface ReduxProps {
  istioAPIEnabled: boolean;
  kiosk: string;
  theme: string;
}

type IstioConfigDetailsProps = ReduxProps & {
  istioConfigId: IstioConfigId;
};

const tabName = 'list';
const defaultTab = 'yaml';

const paramToTab = { yaml: 0 };

const RELOAD = t('Reload');
const LEAVE = t('Leave');

const IstioConfigDetailsPageComponent: React.FC<IstioConfigDetailsProps> = (props: IstioConfigDetailsProps) => {
  const [currentTab, setCurrentTab] = React.useState<string>(activeTab(tabName, defaultTab));
  const [error, setError] = React.useState<ErrorMsg>();
  const [editorEvent, setEditorEvent] = React.useState<boolean>(false);
  const [isExpanded, setIsExpanded] = React.useState<boolean>(true);
  const [isModified, setIsModified] = React.useState<boolean>(false);
  const [isRemoved, setIsRemoved] = React.useState<boolean>(false);
  const [istioObjectDetails, setIstioObjectDetails] = React.useState<IstioConfigDetails>();
  const [istioValidations, setIstioValidations] = React.useState<ObjectValidation>();
  const [modalType, setModalType] = React.useState<string>('');
  const [selectedEditorLine, setSelectedEditorLine] = React.useState<string>();
  const [showModal, setShowModal] = React.useState<boolean>(false);
  const [yamlSource, setYamlSource] = React.useState<string>('');
  const [yamlFolded, setYamlFolded] = React.useState<boolean>(true);
  const [yamlValidations, setYamlValidations] = React.useState<AceValidations>();

  const aceEditorRef = React.useRef<ReactAce | null>(null);

  const { t } = useKialiTranslation();

  const cluster = HistoryManager.getClusterName();

  const { namespace, object, objectType } = props.istioConfigId;
  const { istioAPIEnabled } = props;

  const fetchIstioObjectDetails = React.useCallback((): void => {
    const validate = istioAPIEnabled ? true : false;

    // Note that adapters/templates are not supported yet for validations
    API.getIstioConfigDetail(namespace, objectType, object, validate, cluster)
      .then(resultConfigDetails => {
        setIstioObjectDetails(resultConfigDetails.data);
        setIstioValidations(resultConfigDetails.data.validation);
        setIsModified(false);
        setYamlFolded(true);

        const istioObject = getIstioObject(resultConfigDetails.data);
        setYamlSource(istioObject ? dump(istioObject, yamlDumpOptions) : '');

        resizeEditor();
      })
      .catch(error => {
        const msg: ErrorMsg = {
          title: 'No Istio object is selected',
          description: `${object} is not found in the mesh`
        };

        setIsRemoved(true);
        setError(msg);

        AlertUtils.addError(
          `Could not fetch Istio object type [${objectType}] name [${object}] in namespace [${namespace}].`,
          error
        );
      });
  }, [namespace, objectType, object, istioAPIEnabled, cluster]);

  React.useEffect(() => {
    fetchIstioObjectDetails();
  }, [fetchIstioObjectDetails]);

  // Router navigation is blocked if the editor value is modified (ask confirmation)
  const shouldBlock = React.useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) => isModified && currentLocation.pathname !== nextLocation.pathname,
    [isModified]
  );

  const blocker = useBlocker(shouldBlock);
  const isBlockedState = blocker.state === 'blocked';

  React.useEffect(() => {
    if (isBlockedState && isModified) {
      setShowModal(true);
      setModalType(LEAVE);
    }
  }, [isBlockedState, isModified]);

  // External navigation is blocked if the editor value is modified (ask confirmation)
  React.useEffect(() => {
    if (isModified) {
      window.onbeforeunload = () => true;
    } else {
      window.onbeforeunload = null;
    }
  }, [isModified]);

  React.useEffect(() => {
    const { editor } = aceEditorRef.current ?? {};

    if (editor) {
      // Hack to avoid yaml unfolded after modification
      if (!editorEvent) {
        editor.session.on('changeFold', fold => {
          setTimeout(() => {
            if (fold.action === 'add') {
              setYamlFolded(true);
            } else if (fold.action === 'remove') {
              setYamlFolded(false);
            }
          }, 0);
        });

        setEditorEvent(true);
      }

      // Hack to force redisplay of annotations after update
      // See https://github.com/securingsincity/react-ace/issues/300
      editor.onChangeAnnotation();

      // Fold status and/or managedFields fields
      if (yamlFolded) {
        const { startRow, endRow } = getFoldRanges(yamlSource);

        editor.session.foldAll(startRow, endRow, 0);
      }
    }
  }, [yamlSource, yamlFolded, editorEvent]);

  React.useEffect(() => {
    const active = activeTab(tabName, defaultTab);

    if (currentTab !== active) {
      setCurrentTab(active);
    }
  }, [currentTab]);

  React.useEffect(() => {
    if (istioValidations) {
      showInMessageCenter(istioValidations);
    }
  }, [istioValidations]);

  const backToList = (): void => {
    // Back to list page
    const backUrl = `/${Paths.ISTIO}?namespaces=${props.istioConfigId.namespace}`;

    if (isParentKiosk(props.kiosk)) {
      kioskContextMenuAction(backUrl);
    } else {
      router.navigate(backUrl);
    }
  };

  const canUpdate = (): boolean => {
    return istioObjectDetails !== undefined && istioObjectDetails.permissions.update;
  };

  const onCancel = (): void => {
    backToList();
  };

  const onDelete = (): void => {
    API.deleteIstioConfigDetail(
      props.istioConfigId.namespace,
      props.istioConfigId.objectType,
      props.istioConfigId.object,
      cluster
    )
      .then(() => backToList())
      .catch(error => {
        AlertUtils.addError('Could not delete IstioConfig details.', error);
      });
  };

  const onUpdate = (): void => {
    loadAll(yamlSource, objectModified => {
      const jsonPatch = JSON.stringify(
        mergeJsonPatch(objectModified as object, getIstioObject(istioObjectDetails))
      ).replace(new RegExp('(,null)+]', 'g'), ']');

      API.updateIstioConfigDetail(
        props.istioConfigId.namespace,
        props.istioConfigId.objectType,
        props.istioConfigId.object,
        jsonPatch,
        cluster
      )
        .then(() => {
          const targetMessage = `${props.istioConfigId.namespace} / ${props.istioConfigId.objectType} / ${props.istioConfigId.object}`;
          AlertUtils.add(`Changes applied on ${targetMessage}`, 'default', MessageType.SUCCESS);
          fetchIstioObjectDetails();
        })
        .catch(error => {
          AlertUtils.addError('Could not update IstioConfig details.', error);
          setYamlValidations(injectGalleyError(error));
        });
    });
  };

  const injectGalleyError = (error: ApiError): AceValidations => {
    const msg: string[] = API.getErrorString(error).split(':');
    const errMsg: string = msg.slice(1, msg.length).join(':');

    const anno: Annotation = {
      column: 0,
      row: 0,
      text: errMsg,
      type: 'error'
    };

    return { annotations: [anno], markers: [] };
  };

  const resizeEditor = (): void => {
    if (aceEditorRef.current) {
      // The Drawer has an async animation that needs a timeout before to resize the editor
      setTimeout(() => {
        const { editor } = aceEditorRef.current ?? {};

        if (editor) {
          editor.resize(true);
        }
      }, 250);
    }
  };

  const onDrawerToggle = (): void => {
    setIsExpanded(!isExpanded);
    resizeEditor();
  };

  const onDrawerClose = (): void => {
    setIsExpanded(false);
    resizeEditor();
  };

  const onEditorChange = (value: string): void => {
    setIsModified(true);
    setYamlSource(value);
    setIstioValidations(undefined);
    setYamlValidations(parseYamlValidations(value));
  };

  const onRefresh = (): void => {
    if (isModified) {
      setShowModal(true);
      setModalType(RELOAD);
    }
  };

  const getStatusMessages = (istioConfigDetails?: IstioConfigDetails): ValidationMessage[] => {
    const istioObject = getIstioObject(istioConfigDetails);

    return istioObject && istioObject.status && istioObject.status.validationMessages
      ? istioObject.status.validationMessages
      : ([] as ValidationMessage[]);
  };

  // Not all Istio types have an overview card
  const hasOverview = (): boolean => {
    return true;
  };

  const getObjectReferences = (istioConfigDetails?: IstioConfigDetails): ObjectReference[] => {
    const details: IstioConfigDetails = istioConfigDetails ?? ({} as IstioConfigDetails);
    return details.references?.objectReferences ?? ([] as ObjectReference[]);
  };

  const getServiceReferences = (istioConfigDetails?: IstioConfigDetails): ServiceReference[] => {
    const details: IstioConfigDetails = istioConfigDetails ?? ({} as IstioConfigDetails);
    return details.references?.serviceReferences ?? ([] as ServiceReference[]);
  };

  const getWorkloadReferences = (istioConfigDetails?: IstioConfigDetails): ServiceReference[] => {
    const details: IstioConfigDetails = istioConfigDetails ?? ({} as IstioConfigDetails);
    return details.references?.workloadReferences ?? ([] as WorkloadReference[]);
  };

  const getHelpMessages = (istioConfigDetails?: IstioConfigDetails): HelpMessage[] => {
    const details: IstioConfigDetails = istioConfigDetails ?? ({} as IstioConfigDetails);
    return details.help ?? ([] as HelpMessage[]);
  };

  // Aux function to calculate rows for 'status' and 'managedFields' which are typically folded
  const getFoldRanges = (yaml: string): RangeRow => {
    let range = {
      startRow: -1,
      endRow: -1
    };

    if (yaml) {
      const ylines = yaml.split('\n');
      ylines.forEach((line: string, i: number) => {
        // Counting spaces to check managedFields, yaml is always processed with that structure so this is safe
        if (line.startsWith('status:') || line.startsWith('  managedFields:')) {
          if (range.startRow === -1) {
            range.startRow = i;
          } else if (range.startRow > i) {
            range.startRow = i;
          }
        }

        if (line.startsWith('spec:') && range.startRow !== -1) {
          range.endRow = i;
        }
      });
    }

    return range;
  };

  const getShowCards = (refPresent: boolean, istioStatusMsgs: ValidationMessage[]): boolean => {
    return refPresent || hasOverview() || istioStatusMsgs.length > 0;
  };

  const onCursorChange = (e: any): void => {
    const line = parseLine(yamlSource, e.cursor.row);
    setSelectedEditorLine(line);
  };

  const renderEditor = (): React.ReactNode => {
    const istioStatusMsgs = getStatusMessages(istioObjectDetails);

    const objectReferences = getObjectReferences(istioObjectDetails);
    const serviceReferences = getServiceReferences(istioObjectDetails);
    const workloadReferences = getWorkloadReferences(istioObjectDetails);
    const helpMessages = getHelpMessages(istioObjectDetails);

    const refPresent = objectReferences.length > 0;
    const showCards = getShowCards(refPresent, istioStatusMsgs);

    let editorValidations: AceValidations = {
      markers: [],
      annotations: []
    };

    if (!isModified) {
      editorValidations = parseKialiValidations(yamlSource, istioValidations);
    } else {
      if (yamlValidations) {
        editorValidations.markers = yamlValidations.markers;
        editorValidations.annotations = yamlValidations.annotations;
      }
    }

    const helpAnnotations = parseHelpAnnotations(yamlSource, helpMessages);
    helpAnnotations.forEach(ha => editorValidations.annotations.push(ha));

    const panelContent = (
      <DrawerPanelContent>
        <DrawerHead>
          {showCards && istioObjectDetails && (
            <IstioConfigOverview
              istioObjectDetails={istioObjectDetails}
              istioValidations={istioValidations}
              namespace={istioObjectDetails.namespace.name}
              cluster={cluster}
              statusMessages={istioStatusMsgs}
              objectReferences={objectReferences}
              serviceReferences={serviceReferences}
              workloadReferences={workloadReferences}
              helpMessages={helpMessages}
              selectedLine={selectedEditorLine}
              kiosk={props.kiosk}
              istioAPIEnabled={props.istioAPIEnabled}
            />
          )}

          {!isParentKiosk(props.kiosk) && (
            <DrawerActions>
              <DrawerCloseButton onClick={onDrawerClose} />
            </DrawerActions>
          )}
        </DrawerHead>
      </DrawerPanelContent>
    );

    const editor = istioObjectDetails ? (
      <div style={{ width: '100%' }}>
        <AceEditor
          ref={aceEditorRef}
          mode="yaml"
          theme={props.theme === Theme.DARK ? 'twilight' : 'eclipse'}
          onChange={onEditorChange}
          height="calc(var(--kiali-yaml-editor-height)"
          width="100%"
          className={istioAceEditorStyle}
          wrapEnabled={true}
          readOnly={!canUpdate() || isParentKiosk(props.kiosk)}
          setOptions={aceOptions}
          value={yamlSource}
          annotations={editorValidations.annotations}
          markers={editorValidations.markers}
          onCursorChange={onCursorChange}
        />
      </div>
    ) : null;

    return (
      <div className={`object-drawer ${editorDrawer}`}>
        {showCards ? (
          <Drawer isExpanded={isExpanded} isInline={true}>
            <DrawerContent panelContent={showCards ? panelContent : undefined}>
              <DrawerContentBody>{editor}</DrawerContentBody>
            </DrawerContent>
          </Drawer>
        ) : (
          editor
        )}
        {renderActionButtons(showCards)}
      </div>
    );
  };

  const renderActionButtons = (showOverview: boolean): React.ReactNode => {
    // User won't save if file has yaml errors
    const yamlErrors = !!(yamlValidations && yamlValidations.markers.length > 0);

    return !isParentKiosk(props.kiosk) ? (
      <IstioActionButtons
        objectName={props.istioConfigId.object}
        readOnly={!canUpdate()}
        canUpdate={canUpdate() && isModified && !isRemoved && !yamlErrors}
        onCancel={onCancel}
        onUpdate={onUpdate}
        onRefresh={onRefresh}
        showOverview={showOverview}
        overview={isExpanded}
        onOverview={onDrawerToggle}
      />
    ) : (
      ''
    );
  };

  const renderActions = (): React.ReactNode => {
    const canDelete = istioObjectDetails !== undefined && istioObjectDetails.permissions.delete && !isRemoved;

    const istioObject = getIstioObject(istioObjectDetails);

    return (
      <span className={rightToolbarStyle}>
        <IstioActionDropdown
          objectKind={istioObject ? istioObject.kind : undefined}
          objectName={props.istioConfigId.object}
          canDelete={canDelete}
          onDelete={onDelete}
        />
      </span>
    );
  };

  const confirmModal = (): void => {
    if (modalType === RELOAD) {
      fetchIstioObjectDetails();
    } else if (modalType === LEAVE && isBlockedState) {
      blocker.proceed();
    }

    setShowModal(false);
  };

  const hideModal = (): void => {
    if (isBlockedState) {
      blocker.reset();
    }

    setShowModal(false);
  };

  return (
    <>
      <RenderHeader
        rightToolbar={<RefreshButton key="Refresh" handleRefresh={onRefresh} />}
        actionsToolbar={!error ? renderActions() : undefined}
      />

      {error && <ErrorSection error={error} />}

      {!error && !isParentKiosk(props.kiosk) && (
        <ParameterizedTabs
          id="basic-tabs"
          className={basicTabStyle}
          onSelect={tabValue => {
            setCurrentTab(tabValue);
          }}
          tabMap={paramToTab}
          tabName={tabName}
          defaultTab={defaultTab}
          activeTab={currentTab}
          mountOnEnter={false}
          unmountOnExit={true}
        >
          <Tab key="istio-yaml" title={`YAML ${isModified ? ' * ' : ''}`} eventKey={0}>
            <RenderComponentScroll>{renderEditor()}</RenderComponentScroll>
          </Tab>
        </ParameterizedTabs>
      )}

      {!error && isParentKiosk(props.kiosk) && <RenderComponentScroll>{renderEditor()}</RenderComponentScroll>}

      <Modal
        title={t('Confirm {{modalType}}', { modalType: t(modalType) })}
        variant={ModalVariant.small}
        isOpen={showModal}
        onClose={hideModal}
        actions={[
          <Button key="confirm" variant={ButtonVariant.primary} onClick={confirmModal}>
            {t(modalType)}
          </Button>,
          <Button key="cancel" variant={ButtonVariant.secondary} onClick={hideModal}>
            {t('Cancel')}
          </Button>
        ]}
      >
        <Text component={TextVariants.p}>
          {t(`You have unsaved changes, are you sure you want to {{modalType}}?`, {
            modalType: t(modalType).toLowerCase()
          })}
        </Text>
      </Modal>
    </>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  kiosk: state.globalState.kiosk,
  istioAPIEnabled: state.statusState.istioEnvironment.istioAPIEnabled,
  theme: state.globalState.theme
});

export const IstioConfigDetailsPage = connect(mapStateToProps)(IstioConfigDetailsPageComponent);
