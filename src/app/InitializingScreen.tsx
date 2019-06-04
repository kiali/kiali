import * as React from 'react';
import {
  BasicLoginCardLayout,
  BasicLoginPageLayout,
  Icon,
  LoginCard,
  LoginCardHeader,
  LoginPageContainer,
  LoginPageFooter,
  LoginPageHeader,
  Spinner
} from 'patternfly-react';
import { style } from 'typestyle';
import { isKioskMode } from '../utils/SearchParamUtils';

type initializingScreenProps = {
  errorMsg?: string;
  errorDetails?: string;
};

const kialiTitle = require('../assets/img/logo-login.svg');

const defaultErrorStyle = style({
  $nest: {
    '& p:last-of-type': {
      textAlign: 'right'
    },
    '& textarea, & hr': {
      display: 'none'
    },
    '& p:first-of-type': {
      textAlign: 'left'
    }
  }
});

const expandedErrorStyle = style({
  $nest: {
    '& p:last-of-type': {
      display: 'none'
    },
    '& textarea': {
      width: '100%',
      whiteSpace: 'pre'
    }
  }
});

const InitializingScreen: React.FC<initializingScreenProps> = (props: initializingScreenProps) => {
  const errorDiv = React.createRef<HTMLDivElement>();

  const onClickHandler = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (errorDiv.current) {
      errorDiv.current.setAttribute('class', expandedErrorStyle);
    }
  };

  if (document.documentElement) {
    document.documentElement.className = isKioskMode() ? 'kiosk' : '';
  }

  return (
    <LoginPageContainer style={{ backgroundImage: 'none' }}>
      <BasicLoginPageLayout>
        <LoginPageHeader logoSrc={kialiTitle} />
        <BasicLoginCardLayout>
          <LoginCard>
            <LoginCardHeader>
              {props.errorMsg ? (
                <div ref={errorDiv} className={defaultErrorStyle}>
                  <p>
                    <Icon type="pf" name="error-circle-o" /> {props.errorMsg}
                  </p>
                  {props.errorDetails ? (
                    <>
                      <p>
                        <a href="#" onClick={onClickHandler}>
                          Show details
                        </a>
                      </p>
                      <hr />
                      <textarea readOnly={true} rows={10}>
                        {props.errorDetails}
                      </textarea>
                    </>
                  ) : null}
                </div>
              ) : (
                <>
                  <Spinner loading={true} />
                  <h1>Initializing...</h1>
                </>
              )}
            </LoginCardHeader>
          </LoginCard>
          <LoginPageFooter />
        </BasicLoginCardLayout>
      </BasicLoginPageLayout>
    </LoginPageContainer>
  );
};

export default InitializingScreen;
