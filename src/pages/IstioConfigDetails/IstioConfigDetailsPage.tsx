import * as React from 'react';
import { Prompt, RouteComponentProps } from 'react-router-dom';
import { aceOptions, IstioConfigDetails, IstioConfigId, safeDumpOptions } from '../../types/IstioConfigDetails';
import * as MessageCenter from '../../utils/MessageCenter';
import * as API from '../../services/Api';
import AceEditor from 'react-ace';
import 'brace/mode/yaml';
import 'brace/theme/eclipse';
import { ObjectValidation } from '../../types/IstioObjects';
import { AceValidations, jsYaml, parseKialiValidations, parseYamlValidations } from '../../types/AceValidations';
import IstioActionDropdown from '../../components/IstioActions/IstioActionsDropdown';
import './IstioConfigDetailsPage.css';
import { default as IstioActionButtonsContainer } from '../../components/IstioActions/IstioActionsButtons';
import BreadcrumbView from '../../components/BreadcrumbView/BreadcrumbView';
import VirtualServiceDetail from './IstioObjectDetails/VirtualServiceDetail';
import DestinationRuleDetail from './IstioObjectDetails/DestinationRuleDetail';
import history from '../../app/History';
import { Paths } from '../../config';
import { MessageType } from '../../types/MessageCenter';
import { getIstioObject, mergeJsonPatch } from '../../utils/IstioConfigUtils';
import { style } from 'typestyle';
import ParameterizedTabs, { activeTab } from '../../components/Tab/Tabs';
import { Tab, Text, TextVariants } from '@patternfly/react-core';
import { dicIstioType } from '../../types/IstioConfigList';
import { showInMessageCenter } from '../../utils/IstioValidationUtils';

const rightToolbarStyle = style({ float: 'right', marginTop: '8px' });

interface IstioConfigDetailsState {
  istioObjectDetails?: IstioConfigDetails;
  istioValidations?: ObjectValidation;
  originalIstioObjectDetails?: IstioConfigDetails;
  originalIstioValidations?: ObjectValidation;
  isModified: boolean;
  yamlModified?: string;
  yamlValidations?: AceValidations;
  currentTab: string;
}

const tabName = 'list';
const paramToTab: { [key: string]: number } = {
  overview: 0,
  yaml: 1
};

class IstioConfigDetailsPage extends React.Component<RouteComponentProps<IstioConfigId>, IstioConfigDetailsState> {
  aceEditorRef: React.RefObject<AceEditor>;
  promptTo: string;

  constructor(props: RouteComponentProps<IstioConfigId>) {
    super(props);
    this.state = {
      isModified: false,
      currentTab: activeTab(tabName, this.defaultTab())
    };
    this.aceEditorRef = React.createRef();
    this.promptTo = '';
  }

  defaultTab() {
    return this.hasOverview() ? 'overview' : 'yaml';
  }

  objectTitle() {
    let title: string = '';
    if (this.state.istioObjectDetails) {
      const objectType = dicIstioType[this.props.match.params.objectType];
      const methodName = objectType.charAt(0).toLowerCase() + objectType.slice(1);
      title = this.state.istioObjectDetails[methodName].metadata.name;
    }

    return title;
  }

  fetchIstioObjectDetails = () => {
    this.fetchIstioObjectDetailsFromProps(this.props.match.params);
  };

  fetchIstioObjectDetailsFromProps = (props: IstioConfigId) => {
    const promiseConfigDetails = props.objectSubtype
      ? API.getIstioConfigDetailSubtype(props.namespace, props.objectType, props.objectSubtype, props.object)
      : API.getIstioConfigDetail(props.namespace, props.objectType, props.object, true);

    // Note that adapters/templates are not supported yet for validations
    promiseConfigDetails
      .then(resultConfigDetails => {
        this.setState({
          istioObjectDetails: resultConfigDetails.data,
          originalIstioObjectDetails: resultConfigDetails.data,
          istioValidations: resultConfigDetails.data.validation,
          originalIstioValidations: resultConfigDetails.data.validation,
          isModified: false,
          yamlModified: '',
          currentTab: activeTab(tabName, this.defaultTab())
        });
      })
      .catch(error => {
        MessageCenter.addError('Could not fetch IstioConfig details.', error);
      });
  };

  componentDidMount() {
    this.fetchIstioObjectDetails();
  }

  componentDidUpdate(prevProps: RouteComponentProps<IstioConfigId>, prevState: IstioConfigDetailsState) {
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
      // tslint:disable-next-line
      this.aceEditorRef.current!['editor'].onChangeAnnotation();
    }

    if (this.state.currentTab !== activeTab(tabName, this.defaultTab())) {
      this.setState({
        currentTab: activeTab(tabName, this.defaultTab())
      });
    }

    if (!this.propsMatch(prevProps)) {
      this.fetchIstioObjectDetailsFromProps(this.props.match.params);
    }

    if (this.state.istioValidations && this.state.istioValidations !== prevState.istioValidations) {
      showInMessageCenter(this.state.istioValidations);
    }
  }

  propsMatch(prevProps: RouteComponentProps<IstioConfigId>) {
    return (
      this.props.match.params.namespace === prevProps.match.params.namespace &&
      this.props.match.params.object === prevProps.match.params.object &&
      this.props.match.params.objectType === prevProps.match.params.objectType &&
      this.props.match.params.objectSubtype === prevProps.match.params.objectSubtype
    );
  }

  componentWillUnmount() {
    // Reset ask confirmation flag
    window.onbeforeunload = null;
  }

  backToList = () => {
    // Back to list page
    history.push(`/${Paths.ISTIO}?namespaces=${this.props.match.params.namespace}`);
  };

  canDelete = () => {
    return this.state.istioObjectDetails !== undefined && this.state.istioObjectDetails.permissions.delete;
  };

  canUpdate = () => {
    return this.state.istioObjectDetails !== undefined && this.state.istioObjectDetails.permissions.update;
  };

  onCancel = () => {
    if (this.hasOverview()) {
      this.setState(
        prevState => {
          return {
            isModified: false,
            yamlModified: '',
            currentTab: 'overview',
            istioObjectDetails: prevState.originalIstioObjectDetails,
            istioValidations: prevState.originalIstioValidations
          };
        },
        () => {
          this.props.history.push(this.props.location.pathname + '?list=overview');
        }
      );
    } else {
      this.backToList();
    }
  };

  onDelete = () => {
    const deletePromise = this.props.match.params.objectSubtype
      ? API.deleteIstioConfigDetailSubtype(
          this.props.match.params.namespace,
          this.props.match.params.objectType,
          this.props.match.params.objectSubtype,
          this.props.match.params.object
        )
      : API.deleteIstioConfigDetail(
          this.props.match.params.namespace,
          this.props.match.params.objectType,
          this.props.match.params.object
        );
    deletePromise
      .then(_r => this.backToList())
      .catch(error => {
        MessageCenter.addError('Could not delete IstioConfig details.', error);
      });
  };

  onUpdate = () => {
    jsYaml.safeLoadAll(this.state.yamlModified, (objectModified: object) => {
      const jsonPatch = JSON.stringify(mergeJsonPatch(objectModified, getIstioObject(this.state.istioObjectDetails)));
      const updatePromise = this.props.match.params.objectSubtype
        ? API.updateIstioConfigDetailSubtype(
            this.props.match.params.namespace,
            this.props.match.params.objectType,
            this.props.match.params.objectSubtype,
            this.props.match.params.object,
            jsonPatch
          )
        : API.updateIstioConfigDetail(
            this.props.match.params.namespace,
            this.props.match.params.objectType,
            this.props.match.params.object,
            jsonPatch
          );
      updatePromise
        .then(_r => {
          const targetMessage =
            this.props.match.params.namespace +
            ' / ' +
            (this.props.match.params.objectSubtype
              ? this.props.match.params.objectSubtype
              : this.props.match.params.objectType) +
            ' / ' +
            this.props.match.params.object;
          MessageCenter.add('Changes applied on ' + targetMessage, 'default', MessageType.SUCCESS);
          this.fetchIstioObjectDetails();
        })
        .catch(error => {
          MessageCenter.addError('Could not update IstioConfig details.', error);
        });
    });
  };

  onEditorChange = (value: string) => {
    this.setState({
      isModified: true,
      yamlModified: value,
      istioValidations: undefined,
      yamlValidations: parseYamlValidations(value)
    });
  };

  onRefresh = () => {
    let refresh = true;
    if (this.state.isModified) {
      refresh = window.confirm('You have unsaved changes, are you sure you want to refresh ?');
    }
    if (refresh) {
      this.fetchIstioObjectDetails();
    }
  };

  fetchYaml = () => {
    if (this.state.isModified) {
      return this.state.yamlModified;
    }
    const istioObject = getIstioObject(this.state.istioObjectDetails);
    return istioObject ? jsYaml.safeDump(istioObject, safeDumpOptions) : '';
  };

  renderEditor = () => {
    const yamlSource = this.fetchYaml();
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

    return (
      <div className="container-fluid container-cards-pf">
        {this.state.istioObjectDetails ? (
          <AceEditor
            ref={this.aceEditorRef}
            mode="yaml"
            theme="eclipse"
            onChange={this.onEditorChange}
            width={'100%'}
            height={'var(--kiali-yaml-editor-height)'}
            className={'istio-ace-editor'}
            readOnly={!this.canUpdate()}
            setOptions={aceOptions}
            value={this.state.istioObjectDetails ? yamlSource : undefined}
            annotations={editorValidations.annotations}
            markers={editorValidations.markers}
          />
        ) : null}
        {this.renderActionButtons()}
      </div>
    );
  };

  renderActionButtons = () => {
    // User won't save if file has yaml errors
    const yamlErrors = this.state.yamlValidations && this.state.yamlValidations.markers.length > 0 ? true : false;
    return (
      <IstioActionButtonsContainer
        objectName={this.props.match.params.object}
        readOnly={!this.canUpdate()}
        canUpdate={this.canUpdate() && this.state.isModified && !yamlErrors}
        onCancel={this.onCancel}
        onUpdate={this.onUpdate}
        onRefresh={this.onRefresh}
      />
    );
  };

  renderRightToolbar = () => {
    const canDelete = this.state.istioObjectDetails !== undefined && this.state.istioObjectDetails.permissions.delete;
    const istioObject = getIstioObject(this.state.istioObjectDetails);

    return (
      <span className={rightToolbarStyle}>
        <IstioActionDropdown
          objectKind={istioObject ? istioObject.kind : undefined}
          objectName={this.props.match.params.object}
          canDelete={canDelete}
          onDelete={this.onDelete}
        />
      </span>
    );
  };

  // Not all Istio types have components to render an overview tab
  hasOverview = (): boolean => {
    return (
      this.props.match.params.objectType === 'virtualservices' ||
      this.props.match.params.objectType === 'destinationrules'
    );
  };

  renderOverview = (): any => {
    if (this.state.istioObjectDetails) {
      if (this.state.istioObjectDetails.virtualService) {
        return (
          <VirtualServiceDetail
            virtualService={this.state.istioObjectDetails.virtualService}
            validation={this.state.istioValidations}
            namespace={this.state.istioObjectDetails.namespace.name}
          />
        );
      }
      if (this.state.istioObjectDetails.destinationRule) {
        return (
          <DestinationRuleDetail
            destinationRule={this.state.istioObjectDetails.destinationRule}
            validation={this.state.istioValidations}
            namespace={this.state.istioObjectDetails.namespace.name}
          />
        );
      }
    } else {
      // In theory it shouldn't enter here
      return <div>{this.props.match.params.object} has not been loaded</div>;
    }
  };

  renderTabs = (): any => {
    const tabs: JSX.Element[] = [];
    if (this.hasOverview()) {
      tabs.push(
        <Tab key="istio-overview" title="Overview" eventKey={0}>
          {this.state.currentTab === 'overview' ? this.renderOverview() : undefined}
        </Tab>
      );
    }

    tabs.push(
      <Tab key="istio-yaml" title={`YAML ${this.state.isModified ? ' * ' : ''}`} eventKey={1}>
        {this.state.currentTab === 'yaml' ? this.renderEditor() : undefined}
      </Tab>
    );

    return (
      <ParameterizedTabs
        id="basic-tabs"
        onSelect={tabValue => {
          this.setState({ currentTab: tabValue });
        }}
        tabMap={paramToTab}
        tabName={tabName}
        defaultTab={this.defaultTab()}
        activeTab={this.state.currentTab}
      >
        {tabs}
      </ParameterizedTabs>
    );
  };

  render() {
    return (
      <>
        <BreadcrumbView location={this.props.location} />
        <Text component={TextVariants.h1}>{this.objectTitle()}</Text>
        {this.renderRightToolbar()}
        {this.renderTabs()}
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
        />
      </>
    );
  }
}

export default IstioConfigDetailsPage;
