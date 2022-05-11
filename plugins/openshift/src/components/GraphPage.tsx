import * as React from 'react';
import {properties} from "../properties";

const GraphPage = () => {
    // TODO Obviously, this iframe is a PoC
    return (
        <>
            <iframe
                src={properties.kialiBaseUrl + '/console/graph/namespaces/?kiosk=true'}
                style={{overflow: 'hidden', height: '100%', width: '100%' }}
                height="100%"
                width="100%"
            />
        </>
    );
};

export default GraphPage;