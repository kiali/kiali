import * as React from 'react';
import { FormGroup, MenuToggle, MenuToggleElement, Select, SelectList, SelectOption } from '@patternfly/react-core';
import { GroupVersionKind, K8sReferenceRule } from '../../types/IstioObjects';
import { Namespace } from '../../types/Namespace';
import { KialiAppState } from '../../store/Store';
import { namespaceItemsSelector } from '../../store/Selectors';
import { KialiDispatch } from '../../types/Redux';
import { NamespaceThunkActions } from '../../actions/NamespaceThunkActions';
import { connect } from 'react-redux';
import { dicTypeToGVK, gvkType } from '../../types/IstioConfigList';

export const FROM_KINDS = [
  dicTypeToGVK[gvkType.K8sHTTPRoute],
  dicTypeToGVK[gvkType.K8sGateway],
  dicTypeToGVK[gvkType.K8sGRPCRoute],
  dicTypeToGVK[gvkType.K8sTCPRoute],
  dicTypeToGVK[gvkType.K8sTLSRoute]
];

export const TO_KINDS = {
  Service: '',
  Secret: ''
};

type ReduxStateProps = {
  namespaces: Namespace[];
};

type ReduxDispatchProps = {
  refresh: () => void;
};

type Props = ReduxStateProps &
  ReduxDispatchProps & {
    k8sReferenceGrant: K8sReferenceGrantState;
    onChange: (k8sReferenceGrant: K8sReferenceGrantState) => void;
  };

export type K8sReferenceGrantState = {
  from: K8sReferenceRule[];
  to: K8sReferenceRule[];
};

type K8sReferenceGrantFormState = K8sReferenceGrantState & {
  isFromKindSelectOpen: boolean;
  isFromNamespaceSelectOpen: boolean;
  isToKindSelectOpen: boolean;
};

export const initK8sReferenceGrant = (): K8sReferenceGrantState => ({
  from: [
    {
      kind: FROM_KINDS[0].Kind,
      group: FROM_KINDS[0].Group,
      namespace: ''
    }
  ],
  to: [{ kind: Object.keys(TO_KINDS)[0], group: Object.values(TO_KINDS)[0] }]
});

export const isK8sReferenceGrantStateValid = (g: K8sReferenceGrantState): boolean => {
  return g.from.length > 0 && g.to.length > 0;
};

export class K8sReferenceGrantFormComponent extends React.Component<Props, K8sReferenceGrantFormState> {
  constructor(props: Props) {
    super(props);
    this.state = {
      ...initK8sReferenceGrant(),
      isFromKindSelectOpen: false,
      isFromNamespaceSelectOpen: false,
      isToKindSelectOpen: false
    };
  }

  componentDidMount(): void {
    this.props.k8sReferenceGrant.from[0].namespace = this.props.namespaces[0].name;
    this.setState({
      ...this.props.k8sReferenceGrant,
      isFromKindSelectOpen: false,
      isFromNamespaceSelectOpen: false,
      isToKindSelectOpen: false
    });
  }

  private getFormState(): K8sReferenceGrantState {
    const { isFromKindSelectOpen, isFromNamespaceSelectOpen, isToKindSelectOpen, ...formState } = this.state;
    return formState;
  }

  render(): React.ReactNode {
    return (
      <>
        <FormGroup label="From Namespace" fieldId="FromNamespace">
          <Select
            id="ReferenceGrantFromNamespace"
            isOpen={this.state.isFromNamespaceSelectOpen}
            selected={this.state.from[0].namespace}
            onSelect={(_event, value) => {
              this.setState(
                {
                  from: [
                    { group: this.state.from[0].group, kind: this.state.from[0].kind, namespace: value as string }
                  ],
                  isFromNamespaceSelectOpen: false
                },
                () => this.props.onChange(this.getFormState())
              );
            }}
            onOpenChange={isFromNamespaceSelectOpen => this.setState({ isFromNamespaceSelectOpen })}
            toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
              <MenuToggle
                id="ReferenceGrantFromNamespace-toggle"
                ref={toggleRef}
                onClick={() => this.setState({ isFromNamespaceSelectOpen: !this.state.isFromNamespaceSelectOpen })}
                isExpanded={this.state.isFromNamespaceSelectOpen}
                isFullWidth
              >
                {this.state.from[0].namespace}
              </MenuToggle>
            )}
            aria-label="From Namespace Select"
          >
            <SelectList>
              {this.props.namespaces.map((option, index) => (
                <SelectOption key={index} value={option.name}>
                  {option.name}
                </SelectOption>
              ))}
            </SelectList>
          </Select>
        </FormGroup>
        <FormGroup label="From Kind" fieldId="FromKind">
          <Select
            id="ReferenceGrantFromKind"
            isOpen={this.state.isFromKindSelectOpen}
            selected={this.state.from[0].kind}
            onSelect={(_event, value) => {
              this.setState(
                {
                  from: [
                    {
                      group: dicTypeToGVK[`K8s${value}`].Group,
                      kind: value as string,
                      namespace: this.state.from[0].namespace
                    }
                  ],
                  isFromKindSelectOpen: false
                },
                () => this.props.onChange(this.getFormState())
              );
            }}
            onOpenChange={isFromKindSelectOpen => this.setState({ isFromKindSelectOpen })}
            toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
              <MenuToggle
                id="ReferenceGrantFromKind-toggle"
                ref={toggleRef}
                onClick={() => this.setState({ isFromKindSelectOpen: !this.state.isFromKindSelectOpen })}
                isExpanded={this.state.isFromKindSelectOpen}
                isFullWidth
              >
                {`K8s ${this.state.from[0].kind}`}
              </MenuToggle>
            )}
            aria-label="From Kind Select"
          >
            <SelectList>
              {FROM_KINDS.map((fromKey: GroupVersionKind, index: number) => (
                <SelectOption key={index} value={fromKey.Kind}>
                  {`K8s ${fromKey.Kind}`}
                </SelectOption>
              ))}
            </SelectList>
          </Select>
        </FormGroup>
        <FormGroup label="To Kind" fieldId="ToKind">
          <Select
            id="ReferenceGrantToKind"
            isOpen={this.state.isToKindSelectOpen}
            selected={this.state.to[0].kind}
            onSelect={(_event, value) => {
              this.setState(
                {
                  to: [{ group: TO_KINDS[value as string], kind: value as string }],
                  isToKindSelectOpen: false
                },
                () => this.props.onChange(this.getFormState())
              );
            }}
            onOpenChange={isToKindSelectOpen => this.setState({ isToKindSelectOpen })}
            toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
              <MenuToggle
                id="ReferenceGrantToKind-toggle"
                ref={toggleRef}
                onClick={() => this.setState({ isToKindSelectOpen: !this.state.isToKindSelectOpen })}
                isExpanded={this.state.isToKindSelectOpen}
                isFullWidth
              >
                {this.state.to[0].kind}
              </MenuToggle>
            )}
            aria-label="To Kind Select"
          >
            <SelectList>
              {Object.keys(TO_KINDS).map((toKey: string, index: number) => (
                <SelectOption key={index} value={toKey}>
                  {toKey}
                </SelectOption>
              ))}
            </SelectList>
          </Select>
        </FormGroup>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxStateProps => {
  return {
    namespaces: namespaceItemsSelector(state)!
  };
};

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => {
  return {
    refresh: () => {
      dispatch(NamespaceThunkActions.fetchNamespacesIfNeeded());
    }
  };
};

export const K8sReferenceGrantForm = connect(mapStateToProps, mapDispatchToProps)(K8sReferenceGrantFormComponent);
