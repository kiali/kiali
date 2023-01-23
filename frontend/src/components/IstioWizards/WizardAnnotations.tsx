import * as React from 'react';
import { ActionGroup, Button, Modal, ModalVariant, TextInput, Title, TitleSizes } from '@patternfly/react-core';
import { TableComposable, Tbody, Th, Thead, Tr } from '@patternfly/react-table';
import { KialiIcon } from 'config/KialiIcon';

interface Props {
    annotations: { [key: string]: string };
    onChange: (annotations) => void;
    onClose: () => void;
    showAnotationsWizard: boolean,
    canEdit: boolean
}

interface State {
    annotations: { [key: string]: string }
}

class WizardAnnotations extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { annotations: this.props.annotations }
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

    generateInput = (key: string, value: string) => {
        return this.props.canEdit ? (
            <Tr>
             <Th>
                <TextInput id={"annotationInputForKey_" + key} onChange={(value) => this.changeKeyAnnotation(key, value)} type="text" value={key}/>
             </Th>
             <Th>
                <TextInput id={"annotationInputForValue_" + value} onChange={(value) => this.changeValueAnnotation(key, value)} type="text" value={value}/>
             </Th>
             <Th><Button variant={'plain'} icon={<KialiIcon.Delete />} onClick={() => this.removeAnnotation(key)}/></Th>
            </Tr>
        ) : (
            <Tr>
                <Th>{key}</Th>
                <Th>{value}</Th>
            </Tr>
        );
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
                <Button variant="primary" isDisabled={!this.props.canEdit} onClick={() => this.props.onChange(this.state.annotations)}>Save</Button>        
                {this.props.canEdit && (<Button variant="link" onClick={() => this.setState({annotations: this.props.annotations})}>Clear</Button>)}
                <Button variant="link" onClick={this.props.onClose}>Cancel</Button>
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
                        {Object.entries(this.state.annotations).sort().map(([k,v]) => this.generateInput(k,v))}                        
                    </Tbody>
                   </TableComposable >
                </Modal>
            </>
        );
    }
}
export default WizardAnnotations;