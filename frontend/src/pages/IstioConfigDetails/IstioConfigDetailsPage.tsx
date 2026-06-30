import * as React from 'react';
// import { Prompt } from 'react-router-dom';
import type { IstioConfigDetails, IstioConfigId } from '../../types/IstioConfigDetails';
import { yamlDumpOptions } from '../../types/IstioConfigDetails';
import { addError, addSuccess } from '../../utils/AlertUtils';
import * as API from '../../services/Api';
import Editor from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { MarkerSeverity } from 'monaco-editor';
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
  EditorAnnotation,
  EditorMarker,
  applyMonacoMarkers,
  parseHelpAnnotations,
  parseKialiValidations,
  parseLine,
  parseYamlValidations
} from '../../types/AceValidations';
import type { MonacoInstance } from '../../types/AceValidations';
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
  Drawer,
  DrawerActions,
  DrawerCloseButton,
  DrawerContent,
  DrawerContentBody,
  DrawerHead,
  DrawerPanelContent,
  Tab,
  Title,
  TitleSizes,
  TooltipPosition
} from '@patternfly/react-core';
import { showInNotificationCenter } from '../../utils/IstioValidationUtils';
import { Refresh } from '../../components/Refresh/Refresh';
import { IstioConfigOverview } from './IstioObjectDetails/IstioConfigOverview';
import { RenderHeader } from '../../components/Nav/Page/RenderHeader';
import { ErrorMsg } from '../../types/ErrorMsg';
import { ErrorSection } from '../../components/ErrorSection/ErrorSection';
import { RefreshNotifier } from '../../components/Refresh/RefreshNotifier';
import { isParentKiosk, kioskNavigateAction } from '../../components/Kiosk/KioskActions';
import { KialiAppState } from '../../store/Store';
import { connect, DispatchProp } from 'react-redux';
import { basicTabStyle } from 'styles/TabStyles';
import { drawerPanelStyle, editorStyle } from 'styles/EditorStyle';
import { Theme } from 'types/Common';
import { ApiError, ApiResponse } from 'types/Api';
import { dump, loadAll } from 'js-yaml';
import { ResizeHeightObserver } from 'utils/ResizeHeightObserver';
import { canDelete as canDeletePermission, canUpdate as canUpdatePermission } from 'types/Permissions';

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

interface IstioConfigDetailsState {
  cluster?: string;
  currentTab: string;
  editorHeight: number;
  error?: ErrorMsg;
  isExpanded: boolean;
  isModified: boolean;
  isRemoved: boolean;
  istioObjectDetails?: IstioConfigDetails;
  istioValidations?: ObjectValidation;
  originalIstioObjectDetails?: IstioConfigDetails;
  originalIstioValidations?: ObjectValidation;
  selectedEditorLine?: string;
  yamlModified: string;
  yamlValidations?: AceValidations;
}
const tabName = 'list';

const paramToTab: { [key: string]: number } = {
  yaml: 0
};

interface ReduxProps {
  kiosk: string;
  theme: string;
}

type IstioConfigDetailsProps = ReduxProps &
  DispatchProp & {
    istioConfigId: IstioConfigId;
  };

class IstioConfigDetailsPageComponent extends React.Component<IstioConfigDetailsProps, IstioConfigDetailsState> {
  monacoEditorRef: editor.IStandaloneCodeEditor | null = null;
  monacoRef: MonacoInstance | null = null;
  drawerRef: React.RefObject<IstioConfigDetails>;
  private editorContainerRef = React.createRef<HTMLDivElement>();
  private heightObserver = new ResizeHeightObserver(h => this.setState({ editorHeight: h }));
  private isObserving = false;
  private suppressOnChange = false;
  promptTo: string;
  timerId: number;

  constructor(props: IstioConfigDetailsProps) {
    super(props);
    const cluster = HistoryManager.getClusterName();

    this.state = {
      cluster: cluster,
      editorHeight: 0,
      isModified: false,
      isRemoved: false,
      currentTab: activeTab(tabName, this.defaultTab()),
      isExpanded: false,
      yamlModified: ''
    };

    this.drawerRef = React.createRef();
    this.promptTo = '';
    this.timerId = -1;
  }

  defaultTab(): string {
    return 'yaml';
  }

  objectTitle(): string {
    let title = '';

    if (this.state.istioObjectDetails) {
      const objectType = this.props.istioConfigId.objectKind;
      const methodName = objectType.charAt(0).toLowerCase() + objectType.slice(1);
      const object = this.state.istioObjectDetails[methodName];

      if (object) {
        title = object.metadata.name;
      }
    }

    return title;
  }

  fetchIstioObjectDetails = (): void => {
    this.fetchIstioObjectDetailsFromProps(this.props.istioConfigId);
  };

  newIstioObjectPromise = (props: IstioConfigId): Promise<ApiResponse<IstioConfigDetails>> => {
    return API.getIstioConfigDetail(
      props.namespace,
      { Group: props.objectGroup, Version: props.objectVersion, Kind: props.objectKind },
      props.objectName,
      true,
      this.state.cluster
    );
  };

  fetchIstioObjectDetailsFromProps = (props: IstioConfigId): void => {
    const promiseConfigDetails = this.newIstioObjectPromise(props);

    // Note that adapters/templates are not supported yet for validations
    promiseConfigDetails
      .then(resultConfigDetails => {
        this.setState(
          {
            cluster:
              resultConfigDetails.data.cluster || resultConfigDetails.data.namespace.cluster || this.state.cluster,
            istioObjectDetails: resultConfigDetails.data,
            originalIstioObjectDetails: resultConfigDetails.data,
            istioValidations: resultConfigDetails.data.validation,
            originalIstioValidations: resultConfigDetails.data.validation,
            isModified: false,
            isExpanded: this.isExpanded(resultConfigDetails.data),
            yamlModified: '',
            currentTab: activeTab(tabName, this.defaultTab())
          },
          () => this.resizeEditor()
        );
      })
      .catch(error => {
        const msg: ErrorMsg = {
          title: 'No Istio object is selected',
          description: `${this.props.istioConfigId.objectName} is not found in the mesh`
        };

        this.setState({
          isRemoved: true,
          error: msg
        });

        addError(
          `Could not fetch Istio object type [${props.objectKind}] name [${props.objectName}] in namespace [${props.namespace}].`,
          error
        );
      });
  };

  componentDidMount(): void {
    this.fetchIstioObjectDetails();
    this.tryStartObserving();
  }

  componentDidUpdate(prevProps: IstioConfigDetailsProps, prevState: IstioConfigDetailsState): void {
    // Start observing once the editor container mounts (may happen after
    // componentDidMount if data was still loading on first render).
    if (!this.isObserving) {
      this.tryStartObserving();
    }

    // This will ask confirmation if we want to leave page on pending changes without save
    if (this.state.isModified) {
      window.onbeforeunload = () => true;
    } else {
      window.onbeforeunload = null;
    }

    // This will reset the flag to prevent ask multiple times the confirmation to leave with unsaved changed
    this.promptTo = '';

    // Apply validation markers after editor update
    if (this.monacoEditorRef && this.monacoRef) {
      // Fold status and/or managedFields fields only when fresh data arrives
      const dataJustLoaded =
        this.state.istioObjectDetails !== prevState.istioObjectDetails ||
        (prevState.isModified && !this.state.isModified);

      if (dataJustLoaded && !this.state.isModified) {
        // Sync editor content and apply folding when data reloads
        const yamlSource = this.fetchYaml();
        if (this.monacoEditorRef.getValue() !== yamlSource) {
          this.suppressOnChange = true;
          this.monacoEditorRef.setValue(yamlSource);
          this.suppressOnChange = false;
        }
        const foldLines = this.getFoldLines(yamlSource);
        if (foldLines.length > 0) {
          const ed = this.monacoEditorRef;
          // Defer folding to ensure the editor model has synced the new value
          setTimeout(() => {
            for (const line of foldLines) {
              ed.setPosition({ lineNumber: line + 1, column: 1 });
              ed.trigger('fold', 'editor.fold', {});
            }
            ed.setPosition({ lineNumber: 1, column: 1 });
          }, 0);
        }
      }

      // Re-apply validation markers when validations or data change
      if (
        dataJustLoaded ||
        this.state.istioValidations !== prevState.istioValidations ||
        this.state.yamlValidations !== prevState.yamlValidations
      ) {
        this.applyValidationMarkers();
      }
    }

    const active = activeTab(tabName, this.defaultTab());
    if (this.state.currentTab !== active) {
      this.setState({ currentTab: active });
    }

    if (!this.propsMatch(prevProps)) {
      this.fetchIstioObjectDetailsFromProps(this.props.istioConfigId);
    }

    if (this.state.istioValidations && this.state.istioValidations !== prevState.istioValidations) {
      showInNotificationCenter(this.state.istioValidations);
    }
  }

  propsMatch(prevProps: IstioConfigDetailsProps): boolean {
    return (
      this.props.istioConfigId.namespace === prevProps.istioConfigId.namespace &&
      this.props.istioConfigId.objectName === prevProps.istioConfigId.objectName &&
      this.props.istioConfigId.objectGroup === prevProps.istioConfigId.objectGroup &&
      this.props.istioConfigId.objectVersion === prevProps.istioConfigId.objectVersion &&
      this.props.istioConfigId.objectKind === prevProps.istioConfigId.objectKind
    );
  }

  componentWillUnmount(): void {
    window.onbeforeunload = null;
    window.clearInterval(this.timerId);
    this.heightObserver.disconnect();
  }

  private tryStartObserving(): void {
    if (this.editorContainerRef.current) {
      this.heightObserver.observe(this.editorContainerRef.current);
      this.isObserving = true;
    }
  }

  backToList = (): void => {
    // Back to list page
    const backUrl = `/${Paths.ISTIO}?namespaces=${this.props.istioConfigId.namespace}`;

    if (isParentKiosk(this.props.kiosk)) {
      kioskNavigateAction(backUrl);
    } else {
      router.navigate(backUrl);
    }
  };

  canDelete = (): boolean => {
    return canDeletePermission(this.state.istioObjectDetails?.permissions);
  };

  canUpdate = (): boolean => {
    return canUpdatePermission(this.state.istioObjectDetails?.permissions);
  };

  onCancel = (): void => {
    this.backToList();
  };

  onDelete = (): void => {
    API.deleteIstioConfigDetail(
      this.props.istioConfigId.namespace,
      {
        Group: this.props.istioConfigId.objectGroup,
        Version: this.props.istioConfigId.objectVersion,
        Kind: this.props.istioConfigId.objectKind
      },
      this.props.istioConfigId.objectName,
      this.state.cluster
    )
      .then(() => this.backToList())
      .catch(error => {
        addError('Could not delete IstioConfig details.', error);
      });
  };

  onUpdate = (): void => {
    loadAll(this.state.yamlModified, objectModified => {
      const jsonPatch = JSON.stringify(
        mergeJsonPatch(objectModified as object, getIstioObject(this.state.istioObjectDetails))
      ).replace(new RegExp('(,null)+]', 'g'), ']');

      API.updateIstioConfigDetail(
        this.props.istioConfigId.namespace,
        {
          Group: this.props.istioConfigId.objectGroup,
          Version: this.props.istioConfigId.objectVersion,
          Kind: this.props.istioConfigId.objectKind
        },
        this.props.istioConfigId.objectName,
        jsonPatch,
        this.state.cluster
      )
        .then(() => {
          const targetMessage = `${this.props.istioConfigId.namespace} / ${this.props.istioConfigId.objectKind} / ${this.props.istioConfigId.objectName}`;
          addSuccess(`Changes applied on ${targetMessage}`);
          this.fetchIstioObjectDetails();
        })
        .catch(error => {
          addError('Could not update IstioConfig details.', error);
          this.setState({
            yamlValidations: this.injectGalleyError(error)
          });
        });
    });
  };

  injectGalleyError = (error: ApiError): AceValidations => {
    const msg: string[] = API.getErrorString(error).split(':');
    const errMsg: string = msg.slice(1, msg.length).join(':');

    const anno: EditorAnnotation = {
      column: 0,
      row: 0,
      text: errMsg,
      type: 'error'
    };

    return { annotations: [anno], markers: [] };
  };

  resizeEditor = (): void => {
    if (this.monacoEditorRef) {
      // The Drawer has an async animation that needs a timeout before resizing the editor
      setTimeout(() => {
        this.monacoEditorRef?.layout();
      }, 250);
    }
  };

  onDrawerToggle = (): void => {
    this.setState(
      prevState => {
        return {
          isExpanded: !prevState.isExpanded
        };
      },
      () => this.resizeEditor()
    );
  };

  onDrawerClose = (): void => {
    this.setState(
      {
        isExpanded: false
      },
      () => this.resizeEditor()
    );
  };

  onEditorChange = (value: string | undefined): void => {
    if (this.suppressOnChange) {
      return;
    }
    this.setState({
      isModified: true,
      yamlModified: value || '',
      istioValidations: undefined,
      yamlValidations: parseYamlValidations(value || '')
    });
  };

  onRefresh = (): void => {
    let refresh = true;

    if (this.state.isModified) {
      refresh = window.confirm('You have unsaved changes, are you sure you want to refresh ?');
    }

    if (refresh) {
      this.fetchIstioObjectDetails();
    }
  };

  fetchYaml = (): string => {
    if (this.state.isModified) {
      return this.state.yamlModified ?? '';
    }

    const istioObject = getIstioObject(this.state.istioObjectDetails);
    return istioObject ? dump(istioObject, yamlDumpOptions) : '';
  };

  getStatusMessages = (istioConfigDetails?: IstioConfigDetails): ValidationMessage[] => {
    const istioObject = getIstioObject(istioConfigDetails);

    return istioObject && istioObject.status && istioObject.status.validationMessages
      ? istioObject.status.validationMessages
      : ([] as ValidationMessage[]);
  };

  // Not all Istio types have an overview card
  hasOverview = (): boolean => {
    return true;
  };

  objectReferences = (istioConfigDetails?: IstioConfigDetails): ObjectReference[] => {
    const details: IstioConfigDetails = istioConfigDetails ?? ({} as IstioConfigDetails);
    return details.references?.objectReferences ?? ([] as ObjectReference[]);
  };

  serviceReferences = (istioConfigDetails?: IstioConfigDetails): ServiceReference[] => {
    const details: IstioConfigDetails = istioConfigDetails ?? ({} as IstioConfigDetails);
    return details.references?.serviceReferences ?? ([] as ServiceReference[]);
  };

  workloadReferences = (istioConfigDetails?: IstioConfigDetails): ServiceReference[] => {
    const details: IstioConfigDetails = istioConfigDetails ?? ({} as IstioConfigDetails);
    return details.references?.workloadReferences ?? ([] as WorkloadReference[]);
  };

  helpMessages = (istioConfigDetails?: IstioConfigDetails): HelpMessage[] => {
    const details: IstioConfigDetails = istioConfigDetails ?? ({} as IstioConfigDetails);
    return details.help ?? ([] as HelpMessage[]);
  };

  // Returns line numbers (0-based) of top-level sections that should be folded (status, managedFields)
  getFoldLines = (yaml: string): number[] => {
    const lines: number[] = [];
    if (yaml) {
      const ylines = yaml.split('\n');
      ylines.forEach((line: string, i: number) => {
        if (line.startsWith('status:') || line.startsWith('  managedFields:')) {
          lines.push(i);
        }
      });
    }
    return lines;
  };

  isExpanded = (istioConfigDetails?: IstioConfigDetails): boolean => {
    let isExpanded = false;

    if (istioConfigDetails) {
      isExpanded = this.showCards(
        this.objectReferences(istioConfigDetails).length > 0,
        this.getStatusMessages(istioConfigDetails)
      );
    }

    return isExpanded;
  };

  showCards = (refPresent: boolean, istioStatusMsgs: ValidationMessage[]): boolean => {
    return refPresent || this.hasOverview() || istioStatusMsgs.length > 0;
  };

  onCursorChange = (e: any): void => {
    if (e && e.position) {
      const line = parseLine(this.fetchYaml(), e.position.lineNumber - 1);
      this.setState({ selectedEditorLine: line });
    }
  };

  onEditorDidMount = (ed: editor.IStandaloneCodeEditor, monaco: MonacoInstance): void => {
    this.monacoEditorRef = ed;
    this.monacoRef = monaco;
    ed.onDidChangeCursorPosition(this.onCursorChange);
    this.applyValidationMarkers();
  };

  applyValidationMarkers = (): void => {
    if (!this.monacoRef || !this.monacoEditorRef) {
      return;
    }
    const yamlSource = this.fetchYaml();
    let markers: EditorMarker[] = [];

    if (!this.state.isModified) {
      const validations = parseKialiValidations(yamlSource, this.state.istioValidations);
      markers = [...validations.markers];
    } else if (this.state.yamlValidations) {
      markers = [...this.state.yamlValidations.markers];
    }

    const helpMessages = this.helpMessages(this.state.istioObjectDetails);
    const helpAnnotations = parseHelpAnnotations(yamlSource, helpMessages);
    const linesWithMarkers = new Set(markers.map(m => m.startLineNumber));
    helpAnnotations.forEach(ha => {
      const lineNumber = ha.row + 1;
      if (!linesWithMarkers.has(lineNumber)) {
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

    applyMonacoMarkers(this.monacoRef, this.monacoEditorRef, markers);
  };

  renderEditor = (): React.ReactNode => {
    const yamlSource = this.fetchYaml();
    const istioStatusMsgs = this.getStatusMessages(this.state.istioObjectDetails);

    const objectReferences = this.objectReferences(this.state.istioObjectDetails);
    const serviceReferences = this.serviceReferences(this.state.istioObjectDetails);
    const workloadReferences = this.workloadReferences(this.state.istioObjectDetails);
    const helpMessages = this.helpMessages(this.state.istioObjectDetails);

    const refPresent = objectReferences.length > 0;
    const showCards = this.showCards(refPresent, istioStatusMsgs);

    let editorValidations: AceValidations = {
      markers: [],
      annotations: []
    };

    if (!this.state.isModified) {
      editorValidations = parseKialiValidations(yamlSource, this.state.istioValidations);
    } else {
      if (this.state.yamlValidations) {
        editorValidations.markers = [...this.state.yamlValidations.markers];
        editorValidations.annotations = [...this.state.yamlValidations.annotations];
      }
    }

    const helpAnnotations = parseHelpAnnotations(yamlSource, helpMessages);
    helpAnnotations.forEach(ha => editorValidations.annotations.push(ha));

    const panelContent = (
      <DrawerPanelContent>
        <DrawerHead>
          <div>
            {showCards && (
              <>
                {this.state.istioObjectDetails && (
                  <IstioConfigOverview
                    istioObjectDetails={this.state.istioObjectDetails}
                    istioValidations={this.state.istioValidations}
                    namespace={this.state.istioObjectDetails.namespace.name}
                    statusMessages={istioStatusMsgs}
                    objectReferences={objectReferences}
                    serviceReferences={serviceReferences}
                    workloadReferences={workloadReferences}
                    helpMessages={helpMessages}
                    selectedLine={this.state.selectedEditorLine}
                  />
                )}
              </>
            )}
          </div>

          <DrawerActions>
            <DrawerCloseButton onClick={this.onDrawerClose} />
          </DrawerActions>
        </DrawerHead>
      </DrawerPanelContent>
    );

    const aceHeight = Math.max(this.state.editorHeight, 200);

    const editor = this.state.istioObjectDetails ? (
      <div style={{ width: '100%' }}>
        <div className={editorStyle} data-test="istio-config-editor">
          <Editor
            value={yamlSource}
            language="yaml"
            theme={this.props.theme === Theme.DARK ? 'vs-dark' : 'light'}
            height={`${aceHeight}px`}
            onChange={this.onEditorChange}
            onMount={this.onEditorDidMount}
            options={{
              readOnly: !this.canUpdate(),
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              folding: true,
              glyphMargin: true,
              editContext: false
            }}
          />
        </div>
      </div>
    ) : null;

    return (
      <div className={`object-drawer ${editorDrawer} ${drawerPanelStyle}`}>
        <div ref={this.editorContainerRef} className={editorAreaStyle}>
          {showCards ? (
            <Drawer isExpanded={this.state.isExpanded} isInline={true}>
              <DrawerContent panelContent={showCards ? panelContent : undefined}>
                <DrawerContentBody>{editor}</DrawerContentBody>
              </DrawerContent>
            </Drawer>
          ) : (
            editor
          )}
        </div>
        <div className={noShrinkStyle}>{this.renderActionButtons(showCards)}</div>
      </div>
    );
  };

  renderActionButtons = (showOverview: boolean): React.ReactNode => {
    // User won't save if file has yaml errors
    const yamlErrors = !!(this.state.yamlValidations && this.state.yamlValidations.markers.length > 0);

    return (
      <IstioActionButtons
        objectName={this.props.istioConfigId.objectName}
        readOnly={!this.canUpdate()}
        canUpdate={this.canUpdate() && this.state.isModified && !this.state.isRemoved && !yamlErrors}
        onCancel={this.onCancel}
        onUpdate={this.onUpdate}
        onRefresh={this.onRefresh}
        showOverview={showOverview}
        overview={this.state.isExpanded}
        onOverview={this.onDrawerToggle}
      />
    );
  };

  renderActions = (): React.ReactNode => {
    const canDelete = this.canDelete() && !this.state.isRemoved;

    const istioObject = getIstioObject(this.state.istioObjectDetails);

    return (
      <IstioActionDropdown
        objectKind={istioObject ? istioObject.kind : undefined}
        objectName={this.props.istioConfigId.objectName}
        canDelete={canDelete}
        onDelete={this.onDelete}
      />
    );
  };

  render(): React.ReactNode {
    return (
      <>
        <RefreshNotifier onTick={this.onRefresh} />

        <RenderHeader rightToolbar={<Refresh id="config_details_refresh" />}>
          {this.state.istioObjectDetails && (
            <div className={detailTitleRowStyle}>
              <div className={detailTitleMainStyle}>
                <PFBadge
                  badge={
                    GVKToBadge[
                      getGVKTypeString({
                        Group: this.props.istioConfigId.objectGroup,
                        Kind: this.props.istioConfigId.objectKind,
                        Version: this.props.istioConfigId.objectVersion
                      })
                    ]
                  }
                  position={TooltipPosition.top}
                />
                <Title headingLevel="h1" size={TitleSizes.xl} style={{ margin: 0, flexShrink: 0 }}>
                  {this.props.istioConfigId.objectName}
                </Title>
              </div>
            </div>
          )}
        </RenderHeader>

        {this.state.error && <ErrorSection error={this.state.error} />}

        {!this.state.error && (
          <ParameterizedTabs
            id="basic-tabs"
            className={basicTabStyle}
            actionsToolbar={this.renderActions()}
            onSelect={tabValue => {
              this.setState({ currentTab: tabValue });
            }}
            tabMap={paramToTab}
            tabName={tabName}
            defaultTab={this.defaultTab()}
            activeTab={this.state.currentTab}
            mountOnEnter={false}
            unmountOnExit={true}
          >
            <Tab key="istio-yaml" title={`YAML ${this.state.isModified ? ' * ' : ''}`} eventKey={0}>
              <div className={classes(flexFillStyle, constrainedScrollStyle)}>{this.renderEditor()}</div>
            </Tab>
          </ParameterizedTabs>
        )}

        {/* TODO Enable Prompt
        <Prompt
          message={location => {
            if (this.state.isModified) {
              // Check if Prompt is invoked multiple times
              if (this.promptTo === location.pathname) {
                return true;
              }

              this.promptTo = location.pathname;
              return 'You have unsaved changes, are you sure you want to leave?';
            }
            return true;
          }}
        /> */}
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  kiosk: state.globalState.kiosk,
  theme: state.globalState.theme
});

export { IstioConfigDetailsPageComponent };
export const IstioConfigDetailsPage = connect(mapStateToProps)(IstioConfigDetailsPageComponent);
