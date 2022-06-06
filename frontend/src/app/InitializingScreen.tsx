import * as React from 'react';
import { Alert, Button, ButtonVariant } from '@patternfly/react-core';
import { style } from 'typestyle';
import { isKioskMode } from '../utils/SearchParamUtils';

import kialiTitle from '../assets/img/logo-lightbkg.svg';

type initializingScreenProps = {
  errorMsg?: string;
  errorDetails?: string;
};

const defaultErrorStyle = style({
  $nest: {
    '& > textarea': {
      display: 'none'
    },
    '& > p:last-of-type': {
      marginTop: '3em'
    }
  }
});

const expandedErrorStyle = style({
  $nest: {
    '& > p:last-of-type': {
      display: 'none'
    },
    '& > textarea': {
      width: '100%',
      whiteSpace: 'pre',
      marginTop: '3em'
    }
  }
});

const centerVerticalHorizontalStyle = style({
  position: 'relative',
  top: '10em',
  textAlign: 'center',
  $nest: {
    '& > img': {
      marginBottom: '3em'
    },
    '& > div': {
      width: '40em',
      marginLeft: 'auto',
      marginRight: 'auto',
      textAlign: 'left'
    }
  }
});

const InitializingScreen: React.FC<initializingScreenProps> = (props: initializingScreenProps) => {
  const errorDiv = React.createRef<HTMLDivElement>();

  if (document.documentElement) {
    document.documentElement.className = isKioskMode() ? 'kiosk' : '';
  }

  return (
    <div data-test="loading-screen" className={centerVerticalHorizontalStyle}>
      <img alt="Kiali Logo" src={kialiTitle} width="200" />
      {props.errorMsg ? (
        <div ref={errorDiv} className={defaultErrorStyle}>
          <Alert variant="danger" title={props.errorMsg} />
          {props.errorDetails ? (
            <>
              <p>
                <Button
                  variant={ButtonVariant.link}
                  onClick={e => {
                    e.preventDefault();
                    if (errorDiv.current) {
                      errorDiv.current.setAttribute('class', expandedErrorStyle);
                    }
                  }}
                >
                  Show details
                </Button>
              </p>
              <textarea readOnly={true} rows={10}>
                {props.errorDetails}
              </textarea>
            </>
          ) : null}
        </div>
      ) : (
        <h1>Loading...</h1>
      )}
    </div>
  );
};

export default InitializingScreen;
