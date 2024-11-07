import * as React from 'react';

export enum alertType {
  CUSTOM = 'custom',
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  DANGER = 'danger'
}

type InlineAlertProps = {
  message: string;
  type: alertType;
};

export const InlineAlert: React.FC<InlineAlertProps> = (props: InlineAlertProps) => {
  const [isVisible, setIsVisible] = React.useState(true);
  const handleClose = (): void => {
    setIsVisible(false);
  };
  const classType = `pf-v5-c-alert pf-m-${props.type}`;
  return (
    <>
      {isVisible && (
        <div className={`pf-v5-c-alert pf-m-${classType}`} style={{ width: '100%' }}>
          <div className="pf-v5-c-alert__icon">
            <i className="fas fa-fw fa-info-circle" aria-hidden="true"></i>
          </div>
          <p className="pf-v5-c-alert__title">
            <span className="pf-v5-screen-reader"></span>
            {props.message}
          </p>
          <div className="pf-v5-c-alert__action">
            <button className="pf-v5-c-button pf-m-plain" type="button" onClick={handleClose}>
              <i className="fas fa-times" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
