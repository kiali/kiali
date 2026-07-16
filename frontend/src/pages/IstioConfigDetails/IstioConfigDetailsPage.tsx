import * as React from 'react';
import type { BlockerFunction } from 'react-router-dom-v5-compat';
import { useBlocker } from 'react-router-dom-v5-compat';
import type { IstioConfigDetails, IstioConfigId } from '../../types/IstioConfigDetails';
import { yamlDumpOptions } from '../../types/IstioConfigDetails';
import { addError, addSuccess } from '../../utils/AlertUtils';
import * as API from '../../services/Api';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { MarkerSeverity, Selection } from 'monaco-editor';
import type {
  HelpMessage,
  ObjectReference,
  ObjectValidation,
  ServiceReference,
  ValidationMessage,
  WorkloadReference
} from '../../types/IstioObjects';
import {
  applyMonacoMarkers,
  parseHelpAnnotations,
  parseKialiValidations,
  parseLine,
  parseYamlValidations
} from '../../types/EditorValidations';
import type { MonacoInstance, EditorValidations, EditorAnnotation, EditorMarker } from '../../types/EditorValidations';
import { IstioActionDropdown } from '../../components/IstioActions/IstioActionsDropdown';
import { IstioActionButtons } from '../../components/IstioActions/IstioActionsButtons';
import { HistoryManager, router } from '../../app/History';
import { Paths } from '../../config';
import { getGVKTypeString, getIstioObject, mergeJsonPatch } from '../../utils/IstioConfigUtils';
import { PFBadge } from '../../components/Pf/PfBadges';
import { GVKToBadge } from '../../components/VirtualList/Config';
import { kialiStyle } from 'styles/StyleUtils';
import { classes } from 'typestyle';
import {
  constrainedScrollStyle,
  detailTitleMainStyle,
  detailTitleRowStyle,
  flexFillStyle,
  noShrinkStyle
} from 'styles/FlexStyles';
import { ParameterizedTabs, activeTab } from '../../components/Tab/Tabs';
import {
  Button,
  ButtonVariant,
  Content,
  ContentVariants,
  Drawer,
  DrawerActions,
  DrawerCloseButton,
  DrawerContent,
  DrawerContentBody,
  DrawerHead,
  DrawerPanelContent,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
  Tab,
  Title,
  TitleSizes,
  TooltipPosition
} from '@patternfly/react-core';
import { showInNotificationCenter } from '../../utils/IstioValidationUtils';
import { IstioConfigOverview } from './IstioObjectDetails/IstioConfigOverview';
import { RenderHeader } from '../../components/Nav/Page/RenderHeader';
import type { ErrorMsg } from '../../types/ErrorMsg';
import { ErrorSection } from '../../components/ErrorSection/ErrorSection';
import { isParentKiosk, kioskNavigateAction } from '../../components/Kiosk/KioskActions';
import type { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { basicTabStyle } from 'styles/TabStyles';
import { drawerPanelStyle, editorStyle } from 'styles/EditorStyle';
import { Theme } from 'types/Common';
import type { ApiError } from 'types/Api';
import { dump, loadAll } from 'js-yaml';
import { ResizeHeightObserver } from 'utils/ResizeHeightObserver';
import { canDelete as canDeletePermission, canUpdate as canUpdatePermission } from 'types/Permissions';
import { useKialiTranslation } from 'utils/I18nUtils';

const editorDrawer = kialiStyle({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  margin: 0,
  minHeight: 0
});

const editorAreaStyle = kialiStyle({
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  minHeight: '200px'
});

const tabName = 'list';
const defaultTab = 'yaml';

const paramToTab: { [key: string]: number } = {
  yaml: 0
};

type ConfirmModalType = 'leave' | 'reload';

interface ReduxProps {
  kiosk: string;
  theme: string;
}

type IstioConfigDetailsProps = ReduxProps & {
  istioConfigId: IstioConfigId;
};

const IstioConfigDetailsPageComponent: React.FC<IstioConfigDetailsProps> = (props: IstioConfigDetailsProps) => {
  const { t } = useKialiTranslation();

  const [cluster, setCluster] = React.useState<string | undefined>(() => HistoryManager.getClusterName());
  const [currentTab, setCurrentTab] = React.useState<string>(() => activeTab(tabName, defaultTab));
  const [editorDefaultValue, setEditorDefaultValue] = React.useState<string>('');
  const [editorHeight, setEditorHeight] = React.useState<number>(0);
  // Remount Monaco when server YAML is (re)loaded so we can stay uncontrolled while typing.
  const [editorRevision, setEditorRevision] = React.useState<number>(0);
  const [error, setError] = React.useState<ErrorMsg>();
  const [isExpanded, setIsExpanded] = React.useState<boolean>(false);
  const [isModified, setIsModified] = React.useState<boolean>(false);
  const [isRemoved, setIsRemoved] = React.useState<boolean>(false);
  const [istioObjectDetails, setIstioObjectDetails] = React.useState<IstioConfigDetails>();
  const [istioValidations, setIstioValidations] = React.useState<ObjectValidation>();
  const [modalType, setModalType] = React.useState<ConfirmModalType | null>(null);
  const [selectedEditorLine, setSelectedEditorLine] = React.useState<string>();
  const [showModal, setShowModal] = React.useState<boolean>(false);
  const [yamlModified, setYamlModified] = React.useState<string>('');
  const [yamlValidations, setYamlValidations] = React.useState<EditorValidations>();

  const monacoEditorRef = React.useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = React.useRef<MonacoInstance | null>(null);
  const editorContainerRef = React.useRef<HTMLDivElement>(null);
  const cursorDisposableRef = React.useRef<{ dispose(): void } | null>(null);
  const foldGenerationRef = React.useRef<number>(0);
  const isObservingRef = React.useRef<boolean>(false);
  const heightObserverRef = React.useRef<ResizeHeightObserver>(
    new ResizeHeightObserver(height => setEditorHeight(height))
  );

  // Keep latest values available to Monaco callbacks / fetch without unstable effect deps.
  const clusterRef = React.useRef(cluster);
  const isModifiedRef = React.useRef(isModified);
  const yamlModifiedRef = React.useRef(yamlModified);
  const istioObjectDetailsRef = React.useRef(istioObjectDetails);
  const istioValidationsRef = React.useRef(istioValidations);
  const yamlValidationsRef = React.useRef(yamlValidations);

  clusterRef.current = cluster;
  isModifiedRef.current = isModified;
  yamlModifiedRef.current = yamlModified;
  istioObjectDetailsRef.current = istioObjectDetails;
  istioValidationsRef.current = istioValidations;
  yamlValidationsRef.current = yamlValidations;

  const { kiosk, theme, istioConfigId } = props;

  const fetchYaml = React.useCallback((): string => {
    if (isModifiedRef.current) {
      return yamlModifiedRef.current ?? '';
    }

    const istioObject = getIstioObject(istioObjectDetailsRef.current);
    return istioObject ? dump(istioObject, yamlDumpOptions) : '';
  }, []);

  const getStatusMessages = (details?: IstioConfigDetails): ValidationMessage[] => {
    const istioObject = getIstioObject(details);
    return istioObject?.status?.validationMessages ?? [];
  };

  const objectReferences = (details?: IstioConfigDetails): ObjectReference[] => {
    return details?.references?.objectReferences ?? [];
  };

  const serviceReferences = (details?: IstioConfigDetails): ServiceReference[] => {
    return details?.references?.serviceReferences ?? [];
  };

  const workloadReferences = (details?: IstioConfigDetails): WorkloadReference[] => {
    return details?.references?.workloadReferences ?? [];
  };

  const helpMessages = (details?: IstioConfigDetails): HelpMessage[] => {
    return details?.help ?? [];
  };

  // Not all Istio types have an overview card historically; currently always show overview.
  const hasOverview = (): boolean => {
    return true;
  };

  const showCards = (refPresent: boolean, istioStatusMsgs: ValidationMessage[]): boolean => {
    return refPresent || hasOverview() || istioStatusMsgs.length > 0;
  };

  const isExpandedForDetails = (details?: IstioConfigDetails): boolean => {
    if (!details) {
      return false;
    }

    return showCards(objectReferences(details).length > 0, getStatusMessages(details));
  };

  const getFoldRanges = (yaml: string): { end: number; start: number }[] => {
    const ranges: { end: number; start: number }[] = [];

    if (yaml) {
      const ylines = yaml.split('\n');

      for (let i = 0; i < ylines.length; i++) {
        const line = ylines[i];

        if (line.startsWith('  managedFields:')) {
          const indent = line.search(/\S/);
          let end = i;

          for (let j = i + 1; j < ylines.length; j++) {
            const next = ylines[j];

            if (next.trim() === '') {
              end = j;
              continue;
            }

            const nextIndent = next.search(/\S/);

            if (nextIndent <= indent && !next.match(/^\s*-/)) {
              break;
            }

            end = j;
          }

          if (end > i) {
            ranges.push({ end: end + 1, start: i + 1 });
          }
        }
      }
    }

    return ranges;
  };

  const applyFolding = React.useCallback(
    (ed: editor.IStandaloneCodeEditor): Promise<void> => {
      const generation = ++foldGenerationRef.current;
      const yamlSource = fetchYaml();
      const foldRanges = getFoldRanges(yamlSource);

      if (foldRanges.length === 0) {
        return Promise.resolve();
      }

      // createFoldingRangeFromSelection creates a fold from a selection and collapses it.
      const foldAction = ed.getAction('editor.createFoldingRangeFromSelection');

      if (foldAction) {
        const doFold = async (): Promise<void> => {
          for (const range of foldRanges) {
            // Abort if the user started editing or a newer fold pass started.
            if (generation !== foldGenerationRef.current || isModifiedRef.current) {
              return;
            }

            ed.setSelection(new Selection(range.start, 1, range.end + 1, 1));
            await foldAction.run();
          }

          if (generation !== foldGenerationRef.current || isModifiedRef.current) {
            return;
          }

          ed.setPosition({ lineNumber: 1, column: 1 });
          ed.setSelection(new Selection(1, 1, 1, 1));
        };

        return doFold();
      }

      return Promise.resolve();
    },
    [fetchYaml]
  );

  const applyValidationMarkers = React.useCallback((): void => {
    if (!monacoRef.current || !monacoEditorRef.current) {
      return;
    }

    const yamlSource = fetchYaml();
    let markers: EditorMarker[] = [];

    if (!isModifiedRef.current) {
      const validations = parseKialiValidations(yamlSource, istioValidationsRef.current);
      markers = [...validations.markers];
    } else if (yamlValidationsRef.current) {
      markers = [...yamlValidationsRef.current.markers];
    }

    const help = helpMessages(istioObjectDetailsRef.current);
    const helpAnnotations = parseHelpAnnotations(yamlSource, help);
    const linesWithMarkers = new Set(markers.map(m => m.startLineNumber));

    helpAnnotations.forEach(ha => {
      const lineNumber = ha.row + 1;

      if (!linesWithMarkers.has(lineNumber)) {
        linesWithMarkers.add(lineNumber);
        markers.push({
          startLineNumber: lineNumber,
          startColumn: 1,
          endLineNumber: lineNumber + 1,
          endColumn: 1,
          severity: MarkerSeverity.Info,
          message: ha.text
        });
      }
    });

    applyMonacoMarkers(monacoRef.current, monacoEditorRef.current, markers);
  }, [fetchYaml]);

  const resizeEditor = React.useCallback((): void => {
    if (monacoEditorRef.current) {
      // The Drawer has an async animation that needs a timeout before resizing the editor
      setTimeout(() => {
        monacoEditorRef.current?.layout();
      }, 250);
    }
  }, []);

  const fetchIstioObjectDetailsFromProps = React.useCallback(
    (configId: IstioConfigId): void => {
      API.getIstioConfigDetail(
        configId.namespace,
        { Group: configId.objectGroup, Version: configId.objectVersion, Kind: configId.objectKind },
        configId.objectName,
        true,
        clusterRef.current
      )
        .then(resultConfigDetails => {
          const istioObject = getIstioObject(resultConfigDetails.data);
          const yamlSource = istioObject ? dump(istioObject, yamlDumpOptions) : '';

          setCluster(
            resultConfigDetails.data.cluster || resultConfigDetails.data.namespace.cluster || clusterRef.current
          );
          setIstioObjectDetails(resultConfigDetails.data);
          setIstioValidations(resultConfigDetails.data.validation);
          setIsModified(false);
          setIsExpanded(isExpandedForDetails(resultConfigDetails.data));
          setYamlModified('');
          setYamlValidations(undefined);
          setEditorDefaultValue(yamlSource);
          setEditorRevision(revision => revision + 1);
          setCurrentTab(activeTab(tabName, defaultTab));
          resizeEditor();
        })
        .catch(err => {
          const msg: ErrorMsg = {
            title: 'No Istio object is selected',
            description: `${configId.objectName} is not found in the mesh`
          };

          setIsRemoved(true);
          setError(msg);

          addError(
            `Could not fetch Istio object type [${configId.objectKind}] name [${configId.objectName}] in namespace [${configId.namespace}].`,
            err
          );
        });
    },
    // isExpandedForDetails only depends on helpers derived from the fetched payload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resizeEditor]
  );

  const fetchIstioObjectDetails = React.useCallback((): void => {
    fetchIstioObjectDetailsFromProps(istioConfigId);
  }, [fetchIstioObjectDetailsFromProps, istioConfigId]);

  // Router navigation is blocked when the editor has unsaved changes.
  const shouldBlock = React.useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) => isModified && currentLocation.pathname !== nextLocation.pathname,
    [isModified]
  );

  const blocker = useBlocker(shouldBlock);
  const isBlockedState = blocker.state === 'blocked';

  React.useEffect(() => {
    if (isBlockedState && isModified) {
      setShowModal(true);
      setModalType('leave');
    }
  }, [isBlockedState, isModified]);

  // Block browser/tab close or external navigation when there are unsaved changes.
  React.useEffect(() => {
    if (isModified) {
      window.onbeforeunload = () => true;
    } else {
      window.onbeforeunload = null;
    }

    return () => {
      window.onbeforeunload = null;
    };
  }, [isModified]);

  // Depend on identity fields so a new params object identity does not refetch.
  React.useEffect(() => {
    fetchIstioObjectDetailsFromProps(istioConfigId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fetchIstioObjectDetailsFromProps,
    istioConfigId.namespace,
    istioConfigId.objectGroup,
    istioConfigId.objectKind,
    istioConfigId.objectName,
    istioConfigId.objectVersion
  ]);

  React.useEffect(() => {
    const heightObserver = heightObserverRef.current;

    const tryStartObserving = (): void => {
      if (!isObservingRef.current && editorContainerRef.current) {
        heightObserver.observe(editorContainerRef.current);
        isObservingRef.current = true;
      }
    };

    tryStartObserving();

    return () => {
      heightObserver.disconnect();
      cursorDisposableRef.current?.dispose();
      window.onbeforeunload = null;
    };
  }, []);

  // Start observing once the editor container mounts (may happen after first paint while loading).
  React.useEffect(() => {
    if (!isObservingRef.current && editorContainerRef.current) {
      heightObserverRef.current.observe(editorContainerRef.current);
      isObservingRef.current = true;
    }
  });

  // Re-apply markers when validations change. Do not call setValue here — that fights the
  // user's caret (Monaco React replaces the full model and jumps the cursor to the end).
  React.useEffect(() => {
    applyValidationMarkers();
  }, [istioValidations, yamlValidations, editorRevision, applyValidationMarkers]);

  React.useEffect(() => {
    const active = activeTab(tabName, defaultTab);

    if (currentTab !== active) {
      setCurrentTab(active);
    }
  }, [currentTab]);

  React.useEffect(() => {
    if (istioValidations) {
      showInNotificationCenter(istioValidations);
    }
  }, [istioValidations]);

  const backToList = (): void => {
    const backUrl = `/${Paths.ISTIO}?namespaces=${istioConfigId.namespace}`;

    if (isParentKiosk(kiosk)) {
      kioskNavigateAction(backUrl);
    } else {
      router.navigate(backUrl);
    }
  };

  const canDelete = (): boolean => {
    return canDeletePermission(istioObjectDetails?.permissions);
  };

  const canUpdate = (): boolean => {
    return canUpdatePermission(istioObjectDetails?.permissions);
  };

  const onCancel = (): void => {
    backToList();
  };

  const onDelete = (): void => {
    API.deleteIstioConfigDetail(
      istioConfigId.namespace,
      {
        Group: istioConfigId.objectGroup,
        Version: istioConfigId.objectVersion,
        Kind: istioConfigId.objectKind
      },
      istioConfigId.objectName,
      cluster
    )
      .then(() => backToList())
      .catch(err => {
        addError('Could not delete IstioConfig details.', err);
      });
  };

  const injectGalleyError = (apiError: ApiError): EditorValidations => {
    const msg: string[] = API.getErrorString(apiError).split(':');
    const errMsg: string = msg.slice(1, msg.length).join(':');

    const anno: EditorAnnotation = {
      column: 0,
      row: 0,
      text: errMsg,
      type: 'error'
    };

    return { annotations: [anno], markers: [] };
  };

  const onUpdate = (): void => {
    loadAll(yamlModified, objectModified => {
      const jsonPatch = JSON.stringify(
        mergeJsonPatch(objectModified as object, getIstioObject(istioObjectDetails))
      ).replace(new RegExp('(,null)+]', 'g'), ']');

      API.updateIstioConfigDetail(
        istioConfigId.namespace,
        {
          Group: istioConfigId.objectGroup,
          Version: istioConfigId.objectVersion,
          Kind: istioConfigId.objectKind
        },
        istioConfigId.objectName,
        jsonPatch,
        cluster
      )
        .then(() => {
          const targetMessage = `${istioConfigId.namespace} / ${istioConfigId.objectKind} / ${istioConfigId.objectName}`;
          addSuccess(`Changes applied on ${targetMessage}`);
          fetchIstioObjectDetails();
        })
        .catch(err => {
          addError('Could not update IstioConfig details.', err);
          setYamlValidations(injectGalleyError(err));
        });
    });
  };

  const onDrawerToggle = (): void => {
    setIsExpanded(prev => !prev);
    resizeEditor();
  };

  const onDrawerClose = (): void => {
    setIsExpanded(false);
    resizeEditor();
  };

  const onEditorChange = React.useCallback((value: string | undefined): void => {
    // Cancel any in-flight folding so async selection/position updates cannot steal focus.
    foldGenerationRef.current++;

    setIsModified(true);
    setYamlModified(value || '');
    setIstioValidations(undefined);
    setYamlValidations(parseYamlValidations(value || ''));
  }, []);

  const onRefresh = (): void => {
    if (isModified) {
      setShowModal(true);
      setModalType('reload');
      return;
    }

    fetchIstioObjectDetails();
  };

  const onCursorChange = React.useCallback(
    (e: any): void => {
      if (e?.position) {
        const line = parseLine(fetchYaml(), e.position.lineNumber - 1);
        setSelectedEditorLine(line);
      }
    },
    [fetchYaml]
  );

  const onEditorDidMount = React.useCallback(
    (ed: editor.IStandaloneCodeEditor, monaco: MonacoInstance): void => {
      monacoEditorRef.current = ed;
      monacoRef.current = monaco;
      (window as any).monaco = monaco;
      cursorDisposableRef.current?.dispose();
      cursorDisposableRef.current = ed.onDidChangeCursorPosition(onCursorChange);
      applyValidationMarkers();

      // Open the side panel when clicking an info glyph icon in the margin
      ed.onMouseDown(mouseEvent => {
        if (
          mouseEvent.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN &&
          mouseEvent.target.position
        ) {
          const lineNumber = mouseEvent.target.position.lineNumber;
          const line = parseLine(fetchYaml(), lineNumber - 1);
          setSelectedEditorLine(line);
          setIsExpanded(true);
          resizeEditor();
        }
      });

      applyFolding(ed);
    },
    [applyFolding, applyValidationMarkers, fetchYaml, onCursorChange, resizeEditor]
  );

  const editorOptions = React.useMemo(
    () => ({
      editContext: false,
      folding: true,
      glyphMargin: true,
      readOnly: !canUpdatePermission(istioObjectDetails?.permissions),
      scrollBeyondLastLine: false,
      wordWrap: 'on' as const
    }),
    [istioObjectDetails?.permissions]
  );

  const confirmModal = (): void => {
    if (modalType === 'reload') {
      fetchIstioObjectDetails();
    } else if (modalType === 'leave' && blocker.state === 'blocked') {
      blocker.proceed();
    }

    setShowModal(false);
    setModalType(null);
  };

  const hideModal = (): void => {
    if (blocker.state === 'blocked') {
      blocker.reset();
    }

    setShowModal(false);
    setModalType(null);
  };

  const modalActionLabel = modalType === 'reload' ? t('Reload') : t('Leave');

  const renderEditor = (): React.ReactNode => {
    const istioStatusMsgs = getStatusMessages(istioObjectDetails);
    const objRefs = objectReferences(istioObjectDetails);
    const svcRefs = serviceReferences(istioObjectDetails);
    const wlRefs = workloadReferences(istioObjectDetails);
    const help = helpMessages(istioObjectDetails);
    const refPresent = objRefs.length > 0;
    const cardsVisible = showCards(refPresent, istioStatusMsgs);
    const editorPixelHeight = Math.max(editorHeight, 200);

    const panelContent = (
      <DrawerPanelContent>
        <DrawerHead>
          <div>
            {cardsVisible && (
              <>
                {istioObjectDetails && (
                  <IstioConfigOverview
                    istioObjectDetails={istioObjectDetails}
                    istioValidations={istioValidations}
                    namespace={istioObjectDetails.namespace.name}
                    statusMessages={istioStatusMsgs}
                    objectReferences={objRefs}
                    serviceReferences={svcRefs}
                    workloadReferences={wlRefs}
                    helpMessages={help}
                    selectedLine={selectedEditorLine}
                  />
                )}
              </>
            )}
          </div>

          <DrawerActions>
            <DrawerCloseButton onClick={onDrawerClose} />
          </DrawerActions>
        </DrawerHead>
      </DrawerPanelContent>
    );

    const editorNode = istioObjectDetails ? (
      <div style={{ width: '100%', height: `${editorPixelHeight}px`, overflow: 'hidden' }}>
        <div className={editorStyle} data-test="istio-config-editor" style={{ height: '100%' }}>
          <Editor
            key={editorRevision}
            defaultValue={editorDefaultValue}
            language="yaml"
            theme={theme === Theme.DARK ? 'vs-dark' : 'light'}
            height="100%"
            onChange={onEditorChange}
            onMount={onEditorDidMount}
            options={editorOptions}
          />
        </div>
      </div>
    ) : null;

    return (
      <div className={`object-drawer ${editorDrawer} ${drawerPanelStyle}`}>
        <div ref={editorContainerRef} className={editorAreaStyle}>
          {cardsVisible ? (
            <Drawer isExpanded={isExpanded} isInline={true}>
              <DrawerContent panelContent={cardsVisible ? panelContent : undefined}>
                <DrawerContentBody>{editorNode}</DrawerContentBody>
              </DrawerContent>
            </Drawer>
          ) : (
            editorNode
          )}
        </div>
        <div className={noShrinkStyle}>{renderActionButtons(cardsVisible)}</div>
      </div>
    );
  };

  const renderActionButtons = (showOverview: boolean): React.ReactNode => {
    const yamlErrors = !!(yamlValidations && yamlValidations.markers.length > 0);

    return (
      <IstioActionButtons
        objectName={istioConfigId.objectName}
        readOnly={!canUpdate()}
        canUpdate={canUpdate() && isModified && !isRemoved && !yamlErrors}
        onCancel={onCancel}
        onUpdate={onUpdate}
        onRefresh={onRefresh}
        showOverview={showOverview}
        overview={isExpanded}
        onOverview={onDrawerToggle}
      />
    );
  };

  const renderActions = (): React.ReactNode => {
    const istioObject = getIstioObject(istioObjectDetails);

    return (
      <IstioActionDropdown
        objectKind={istioObject ? istioObject.kind : undefined}
        objectName={istioConfigId.objectName}
        canDelete={canDelete() && !isRemoved}
        onDelete={onDelete}
      />
    );
  };

  return (
    <>
      <RenderHeader>
        {istioObjectDetails && (
          <div className={detailTitleRowStyle}>
            <div className={detailTitleMainStyle}>
              <PFBadge
                badge={
                  GVKToBadge[
                    getGVKTypeString({
                      Group: istioConfigId.objectGroup,
                      Kind: istioConfigId.objectKind,
                      Version: istioConfigId.objectVersion
                    })
                  ]
                }
                position={TooltipPosition.top}
              />
              <Title headingLevel="h1" size={TitleSizes.xl} style={{ margin: 0, flexShrink: 0 }}>
                {istioConfigId.objectName}
              </Title>
            </div>
          </div>
        )}
      </RenderHeader>

      {error && <ErrorSection error={error} />}

      {!error && (
        <ParameterizedTabs
          id="basic-tabs"
          className={basicTabStyle}
          actionsToolbar={renderActions()}
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
            <div className={classes(flexFillStyle, constrainedScrollStyle)}>{renderEditor()}</div>
          </Tab>
        </ParameterizedTabs>
      )}

      <Modal variant={ModalVariant.small} isOpen={showModal} onClose={hideModal} data-test="unsaved-changes-modal">
        <ModalHeader title={t('Confirm {{modalType}}', { modalType: modalActionLabel })} />
        <ModalBody>
          <Content component={ContentVariants.p}>
            {t('You have unsaved changes, are you sure you want to {{modalType}}?', {
              modalType: modalActionLabel.toLowerCase()
            })}
          </Content>
        </ModalBody>
        <ModalFooter>
          <Button key="confirm" variant={ButtonVariant.primary} onClick={confirmModal} data-test="confirm-unsaved">
            {modalActionLabel}
          </Button>
          <Button key="cancel" variant={ButtonVariant.secondary} onClick={hideModal} data-test="cancel-unsaved">
            {t('Cancel')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  kiosk: state.globalState.kiosk,
  theme: state.globalState.theme
});

export { IstioConfigDetailsPageComponent };
export const IstioConfigDetailsPage = connect(mapStateToProps)(IstioConfigDetailsPageComponent);
