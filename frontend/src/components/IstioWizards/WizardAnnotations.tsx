import * as React from 'react';
import { ActionGroup, Button, Modal, ModalVariant, TextInput, Title, TitleSizes } from '@patternfly/react-core';
import { TableComposable, Tbody, Th, Thead, Tr } from '@patternfly/react-table';
import { KialiIcon } from 'config/KialiIcon';
import { cloneDeep } from 'lodash';

interface Props {
    annotations: { [key: string]: string };
    onChange: (annotations) => void;
    onClose: () => void;
    showAnotationsWizard: boolean,
    canEdit: boolean
}

interface State {
    annotations: { [key: string]: string }
    key: string;
    value: string;
    newAnnotation: boolean; 
}

class WizardAnnotations extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { annotations: cloneDeep(this.props.annotations), key: "", value: "", newAnnotation: false }
    }     

    componentDidUpdate(prevProps: Readonly<Props>): void {
        if (prevProps.annotations !== this.props.annotations) {
            this.onClear();
        }        
    }

    removeAnnotation = (key: string) => {
        const annotations = this.state.annotations;
        delete annotations[key]
        this.setState({annotations})
    };

    changeKeyAnnotation = (oldKey: string, newKey: string) => {
        const annotations = this.state.annotations;
        delete annotations[oldKey];
        annotations[newKey] = this.state.annotations[oldKey];
        this.setState({annotations})
    }

    changeValueAnnotation = (key: string, value: string) => {
        const annotations = this.state.annotations;
        annotations[key] = value;
        this.setState({annotations});
    }

    onChange = () => {        
        this.props.onChange(this.state.annotations);
    }

    onClose = () => {        
        this.setState({annotations: this.props.annotations}, () => this.props.onClose())
    }

    onClear = () => {
        this.setState({annotations: cloneDeep(this.props.annotations)});
    }

    saveAnnotation = () => {
        if(this.state.key.length > 0 && this.state.value.length > 0 && Object.keys(this.state.annotations).indexOf(this.state.key) === -1) {
            const annotations = this.state.annotations;
            annotations[this.state.key] = this.state.value;
            this.clearAnnotation(annotations)
        }
    };

    clearAnnotation = (annotations?: { [key: string]: string }) => {        
        this.setState({newAnnotation: false, key: '', value: '', annotations: annotations || this.state.annotations})
    }

    generateInput = (): JSX.Element[] => {
        const rows: JSX.Element[] = Object.keys(this.state.annotations).map((k) => (
             this.props.canEdit ? (
                <Tr key={"edit_annotation_for_" + k}>
                 <Th>
                    <TextInput aria-invalid={k === ""} id={"annotationInputForKey_" + k} onChange={(newKey) => this.changeKeyAnnotation(k, newKey)} placeholder={"key"} type="text" value={k}/>
                 </Th>
                 <Th>
                    <TextInput aria-invalid={this.state.annotations[k] === ""} id={"annotationInputForValue_" + this.state.annotations[k]} onChange={(v) => this.changeValueAnnotation(k, v)} placeholder={"value"} type="text" value={this.state.annotations[k]}/>
                 </Th>
                 <Th><Button variant={'plain'} icon={<KialiIcon.Delete />} onClick={() => this.removeAnnotation(k)}/></Th>
                </Tr>
            ) : (
                <Tr>
                    <Th>{k}</Th>
                    <Th>{this.state.annotations[k]}</Th>
                </Tr>
            )
        ));   
        if (this.state.newAnnotation) {
            rows.push(
                <Tr key={"edit_annotation_for_new_annotation"}>
                 <Th>
                    <TextInput aria-invalid={this.state.key === "" || Object.keys(this.state.annotations).indexOf(this.state.key) > -1} id={"annotationInputForNewKey"} onChange={(key) => this.setState({key})} placeholder={"key"} type="text" value={this.state.key}/>
                 </Th>
                 <Th>
                    <TextInput aria-invalid={this.state.value === ""} id={"annotationInputForNewValue"} onChange={(value) => this.setState({value})} placeholder={"value"} type="text" value={this.state.value}/>
                 </Th>
                 <Th><Button variant={'plain'} icon={<KialiIcon.Save />} onClick={() => this.saveAnnotation()}/><Button variant={'plain'} icon={<KialiIcon.Delete />} onClick={() => this.clearAnnotation()}/></Th>
                </Tr>
            )
        }
        return rows;      
    }
    
    AddNewkeyValue = () => {
        if(Object.values(this.state.annotations).filter(v => v.length === 0).length === 0) {
            const annotations = this.state.annotations;
            annotations[""] = "";
            this.setState({annotations});
        }
    }

    render() {
        const header = (
            <>
              <Title id="modal-custom-header-label" headingLevel="h1" size={TitleSizes['2xl']}>
                {this.props.canEdit ? 'Edit ' : 'View '}annotations
              </Title>
            </>
        );
        const footer = (
            <ActionGroup>           
                <Button variant="primary" isDisabled={!this.props.canEdit || this.state.newAnnotation} onClick={this.onChange}>Save</Button>        
                {this.props.canEdit && (<Button variant="link" onClick={this.onClear}>Clear</Button>)}
                <Button variant="link" onClick={this.onClose}>Cancel</Button>
            </ActionGroup>
        );

        return (
            <>
                <Modal
                    variant={ModalVariant.large}
                    isOpen={this.props.showAnotationsWizard}
                    onClose={this.props.onClose}
                    header={header}
                    aria-labelledby="modal-custom-header-label"
                    aria-describedby="modal-custom-header-description"
                    footer={footer}
                >
                   <TableComposable variant={'compact'}>
                    <Thead>
                        <Tr>
                            <Th>Key</Th>
                            <Th>Value</Th>
                            {this.props.canEdit && <Th></Th> }
                        </Tr>    
                    </Thead>
                    <Tbody>
                        {this.generateInput()}                                         
                    </Tbody>
                   </TableComposable >
                   <Button variant="link" isDisabled={this.state.newAnnotation} icon={<KialiIcon.AddMore />} onClick={() => {!this.state.newAnnotation && this.setState({newAnnotation: true})}}>
                        Add more
                    </Button>                    
                </Modal>
            </>
        );
    }
}
export default WizardAnnotations;