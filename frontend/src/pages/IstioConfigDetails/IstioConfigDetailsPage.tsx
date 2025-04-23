import * as React from 'react';
// import { Prompt } from 'react-router-dom';
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
import { HistoryManager, router } from '../../app/History';
import { Paths } from '../../config';
import { MessageType } from '../../types/MessageCenter';
import { getIstioObject, mergeJsonPatch } from '../../utils/IstioConfigUtils';
import { kialiStyle } from 'styles/StyleUtils';
import { ParameterizedTabs, activeTab } from '../../components/Tab/Tabs';
import {
  Drawer,
  DrawerActions,
  DrawerCloseButton,
  DrawerContent,
  DrawerContentBody,
  DrawerHead,
  DrawerPanelContent,
  Tab
} from '@patternfly/react-core';
import { showInMessageCenter } from '../../utils/IstioValidationUtils';
import { Refresh } from '../../components/Refresh/Refresh';
import { IstioConfigOverview } from './IstioObjectDetails/IstioConfigOverview';
import { Annotation } from 'react-ace/types';
import { RenderHeader } from '../../components/Nav/Page/RenderHeader';
import { ErrorMsg } from '../../types/ErrorMsg';
import { ErrorSection } from '../../components/ErrorSection/ErrorSection';
import { RefreshNotifier } from '../../components/Refresh/RefreshNotifier';
import { isParentKiosk, kioskContextMenuAction } from '../../components/Kiosk/KioskActions';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { basicTabStyle } from 'styles/TabStyles';
import { istioAceEditorStyle } from 'styles/AceEditorStyle';
import { Theme } from 'types/Common';
import { ApiError, ApiResponse } from 'types/Api';
import { dump, loadAll } from 'js-yaml';

const rightToolbarStyle = kialiStyle({
  zIndex: 500
});

const editorDrawer = kialiStyle({
  margin: 0
});

interface IstioConfigDetailsState {
  cluster?: string;
  currentTab: string;
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

interface RangeRow {
  endRow: number;
  startRow: number;
}

const tabName = 'list';

const paramToTab: { [key: string]: number } = {
  yaml: 0
};

interface ReduxProps {
  istioAPIEnabled: boolean;
  kiosk: string;
  theme: string;
}

type IstioConfigDetailsProps = ReduxProps & {
  istioConfigId: IstioConfigId;
};

class IstioConfigDetailsPageComponent extends React.Component<IstioConfigDetailsProps, IstioConfigDetailsState> {
  aceEditorRef: React.RefObject<AceEditor>;
  drawerRef: React.RefObject<IstioConfigDetails>;
  promptTo: string;
  timerId: number;

  constructor(props: IstioConfigDetailsProps) {
    super(props);
    const cluster = HistoryManager.getClusterName();

    this.state = {
      cluster: cluster,
      isModified: false,
      isRemoved: false,
      currentTab: activeTab(tabName, this.defaultTab()),
      isExpanded: false,
      yamlModified: ''
    };

    this.aceEditorRef = React.createRef();
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

  newIstioObjectPromise = (props: IstioConfigId, validate: boolean): Promise<ApiResponse<IstioConfigDetails>> => {
    return API.getIstioConfigDetail(
      props.namespace,
      { Group: props.objectGroup, Version: props.objectVersion, Kind: props.objectKind },
      props.objectName,
      validate,
      this.state.cluster
    );
  };

  fetchIstioObjectDetailsFromProps = (props: IstioConfigId): void => {
    const validate = this.props.istioAPIEnabled ? true : false;
    const promiseConfigDetails = this.newIstioObjectPromise(props, validate);

    // Note that adapters/templates are not supported yet for validations
    promiseConfigDetails
      .then(resultConfigDetails => {
        this.setState(
          {
            cluster: this.state.cluster,
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

        AlertUtils.addError(
          `Could not fetch Istio object type [${props.objectKind}] name [${props.objectName}] in namespace [${props.namespace}].`,
          error
        );
      });
  };

  componentDidMount(): void {
    this.fetchIstioObjectDetails();
  }

  componentDidUpdate(prevProps: IstioConfigDetailsProps, prevState: IstioConfigDetailsState): void {
    // This will ask confirmation if we want to leave page on pending changes without save
    if (this.state.isModified) {
      window.onbeforeunload = () => true;
    } else {
      window.onbeforeunload = null;
    }

    // This will reset the flag to prevent ask multiple times the confirmation to leave with unsaved changed
    this.promptTo = '';

    // Hack to force redisplay of annotations after update
    // See https://github.com/securingsincity/react-ace/issues/300
    if (this.aceEditorRef.current) {
      const editor = this.aceEditorRef.current!['editor'];

      // tslint:disable-next-line
      editor.onChangeAnnotation();

      // Fold status and/or managedFields fields
      const { startRow, endRow } = this.getFoldRanges(this.fetchYaml());
      if (!this.state.isModified) {
        editor.session.foldAll(startRow, endRow, 0);
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
      showInMessageCenter(this.state.istioValidations);
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
    // Reset ask confirmation flag
    window.onbeforeunload = null;
    window.clearInterval(this.timerId);
  }

  backToList = (): void => {
    // Back to list page
    const backUrl = `/${Paths.ISTIO}?namespaces=${this.props.istioConfigId.namespace}`;

    if (isParentKiosk(this.props.kiosk)) {
      kioskContextMenuAction(backUrl);
    } else {
      router.navigate(backUrl);
    }
  };

  canDelete = (): boolean => {
    return this.state.istioObjectDetails !== undefined && this.state.istioObjectDetails.permissions.delete;
  };

  canUpdate = (): boolean => {
    return this.state.istioObjectDetails !== undefined && this.state.istioObjectDetails.permissions.update;
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
        AlertUtils.addError('Could not delete IstioConfig details.', error);
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
          AlertUtils.add(`Changes applied on ${targetMessage}`, 'default', MessageType.SUCCESS);
          this.fetchIstioObjectDetails();
        })
        .catch(error => {
          AlertUtils.addError('Could not update IstioConfig details.', error);
          this.setState({
            yamlValidations: this.injectGalleyError(error)
          });
        });
    });
  };

  injectGalleyError = (error: ApiError): AceValidations => {
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

  resizeEditor = (): void => {
    if (this.aceEditorRef.current) {
      // The Drawer has an async animation that needs a timeout before to resize the editor
      setTimeout(() => {
        const editor = this.aceEditorRef.current!['editor'];
        editor.resize(true);
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

  onEditorChange = (value: string): void => {
    this.setState({
      isModified: true,
      yamlModified: value,
      istioValidations: undefined,
      yamlValidations: parseYamlValidations(value)
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

  // Aux function to calculate rows for 'status' and 'managedFields' which are typically folded
  getFoldRanges = (yaml: string): RangeRow => {
    let range = {
      startRow: -1,
      endRow: -1
    };

    if (!!yaml) {
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
    const line = parseLine(this.fetchYaml(), e.cursor.row);
    this.setState({ selectedEditorLine: line });
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
        editorValidations.markers = this.state.yamlValidations.markers;
        editorValidations.annotations = this.state.yamlValidations.annotations;
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
                    cluster={this.state.cluster}
                    statusMessages={istioStatusMsgs}
                    objectReferences={objectReferences}
                    serviceReferences={serviceReferences}
                    workloadReferences={workloadReferences}
                    helpMessages={helpMessages}
                    selectedLine={this.state.selectedEditorLine}
                    kiosk={this.props.kiosk}
                    istioAPIEnabled={this.props.istioAPIEnabled}
                  />
                )}
              </>
            )}
          </div>

          {!isParentKiosk(this.props.kiosk) && (
            <DrawerActions>
              <DrawerCloseButton onClick={this.onDrawerClose} />
            </DrawerActions>
          )}
        </DrawerHead>
      </DrawerPanelContent>
    );

    const editor = this.state.istioObjectDetails ? (
      <div style={{ width: '100%' }}>
        <AceEditor
          ref={this.aceEditorRef}
          mode="yaml"
          theme={this.props.theme === Theme.DARK ? 'twilight' : 'eclipse'}
          onChange={this.onEditorChange}
          height="calc(var(--kiali-yaml-editor-height)"
          width="100%"
          className={istioAceEditorStyle}
          wrapEnabled={true}
          readOnly={!this.canUpdate() || isParentKiosk(this.props.kiosk)}
          setOptions={aceOptions}
          value={this.state.istioObjectDetails ? yamlSource : undefined}
          annotations={editorValidations.annotations}
          markers={editorValidations.markers}
          onCursorChange={this.onCursorChange}
        />
      </div>
    ) : null;

    return (
      <div className={`object-drawer ${editorDrawer}`}>
        {showCards ? (
          <Drawer isExpanded={this.state.isExpanded} isInline={true}>
            <DrawerContent panelContent={showCards ? panelContent : undefined}>
              <DrawerContentBody>{editor}</DrawerContentBody>
            </DrawerContent>
          </Drawer>
        ) : (
          editor
        )}
        {this.renderActionButtons(showCards)}
      </div>
    );
  };

  renderActionButtons = (showOverview: boolean): React.ReactNode => {
    // User won't save if file has yaml errors
    const yamlErrors = !!(this.state.yamlValidations && this.state.yamlValidations.markers.length > 0);

    return !isParentKiosk(this.props.kiosk) ? (
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
    ) : (
      ''
    );
  };

  renderActions = (): React.ReactNode => {
    const canDelete =
      this.state.istioObjectDetails !== undefined &&
      this.state.istioObjectDetails.permissions.delete &&
      !this.state.isRemoved;

    const istioObject = getIstioObject(this.state.istioObjectDetails);

    return (
      <span className={rightToolbarStyle}>
        <IstioActionDropdown
          objectKind={istioObject ? istioObject.kind : undefined}
          objectName={this.props.istioConfigId.objectName}
          canDelete={canDelete}
          onDelete={this.onDelete}
        />
      </span>
    );
  };

  render(): React.ReactNode {
    return (
      <>
        <RefreshNotifier onTick={this.onRefresh} />

        <RenderHeader
          rightToolbar={<Refresh id="config_details_refresh" />}
          actionsToolbar={!this.state.error ? this.renderActions() : undefined}
        />

        {this.state.error && <ErrorSection error={this.state.error} />}

        {!this.state.error && !isParentKiosk(this.props.kiosk) && (
          <ParameterizedTabs
            id="basic-tabs"
            className={basicTabStyle}
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
              <RenderComponentScroll>{this.renderEditor()}</RenderComponentScroll>
            </Tab>
          </ParameterizedTabs>
        )}

        {!this.state.error && isParentKiosk(this.props.kiosk) && (
          <RenderComponentScroll>{this.renderEditor()}</RenderComponentScroll>
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
  istioAPIEnabled: state.statusState.istioEnvironment.istioAPIEnabled,
  theme: state.globalState.theme
});

export const IstioConfigDetailsPage = connect(mapStateToProps)(IstioConfigDetailsPageComponent);
