import * as React from 'react';
import { Alert, Button, ButtonVariant } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';
import { isKioskMode } from '../utils/SearchParamUtils';

import { PF_THEME_DARK, Theme } from 'types/Common';
import { getKialiTheme } from 'utils/ThemeUtils';
import { kialiLogoDark, kialiLogoLight } from 'config';

type initializingScreenProps = {
  errorMsg?: string;
  errorDetails?: string;
};

const defaultErrorStyle = kialiStyle({
  $nest: {
    '& > textarea': {
      display: 'none'
    },
    '& > p:last-of-type': {
      marginTop: '3em'
    }
  }
});

const expandedErrorStyle = kialiStyle({
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

const centerVerticalHorizontalStyle = kialiStyle({
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

export const InitializingScreen: React.FC<initializingScreenProps> = (props: initializingScreenProps) => {
  const errorDiv = React.createRef<HTMLDivElement>();

  if (isKioskMode()) {
    document.body.classList.add('kiosk');
  }

  const theme = getKialiTheme();
  if (theme === Theme.DARK) {
    document.documentElement.classList.add(PF_THEME_DARK);
  }

  return (
    <div data-test="loading-screen" className={centerVerticalHorizontalStyle}>
      <img alt="Kiali Logo" src={theme === Theme.DARK ? kialiLogoDark : kialiLogoLight} width="200" />
      {props.errorMsg ? (
        <div ref={errorDiv} className={defaultErrorStyle}>
          <Alert variant="danger" isInline={true} title={props.errorMsg} />
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
