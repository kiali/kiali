import * as React from 'react';
import Iframe from 'react-iframe';

interface JaegerTracesIframeProps {
  url: string;
}

const JaegerTracesIframe = (props: JaegerTracesIframeProps) => (
  <div className="container-fluid container-cards-pf" style={{ height: 'calc(100vh - 100px)' }}>
    <Iframe id={'jaeger-iframe'} url={props.url} position="inherit" allowFullScreen={true} />
  </div>
);

export default JaegerTracesIframe;
