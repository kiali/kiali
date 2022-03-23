import { ToleranceConfig } from './ServerConfig';

export enum HealthAnnotationConfig {
  HEALTH_RATE = 'health.kiali.io/rate'
}

/*
Health Annotation
- Map key-value with annotations related with health configuration
*/
export type HealthAnnotationType = { [key: string]: string };

export class HealthAnnotation {
  healthAnnotations: HealthAnnotationType;

  constructor(annotations: HealthAnnotationType) {
    this.healthAnnotations = annotations;
  }
}

export class RateHealth extends HealthAnnotation {
  annotation: string;
  isValid: boolean;
  toleranceConfig?: ToleranceConfig[];

  constructor(annotations: HealthAnnotationType) {
    super(annotations);
    this.annotation = annotations[HealthAnnotationConfig.HEALTH_RATE] || '';
    if (this.annotation && this.annotation.length > 0) {
      this.isValid = this.validate();
      this.toleranceConfig = this.isValid ? this.getToleranceConfig() : undefined;
    } else {
      this.isValid = false;
    }
  }

  validate = () => {
    return !this.annotation.split(';').some(annotate => this.isNotValidAnnotation(annotate));
  };

  getToleranceConfig = (): ToleranceConfig[] => {
    var configs: ToleranceConfig[] = [];
    if (this.isValid) {
      this.annotation.split(';').forEach(annotate => {
        const splits = annotate.split(',');
        configs.push({
          code: this.convertRegex(splits[0], true),
          degraded: Number(splits[1]),
          failure: Number(splits[2]),
          protocol: this.convertRegex(splits[3]),
          direction: this.convertRegex(splits[4])
        });
      });
    }
    return configs;
  };

  private convertRegex = (str: string, code: boolean = false): RegExp => {
    if (code) {
      return new RegExp(str.replace(/x|X/g, '\\d'));
    }
    return new RegExp(str);
  };

  private isNotValidAnnotation = (annotation: string): boolean => {
    const splits = annotation.split(',');
    // Be sure annotation type 4xx,10,20,htpp,inbound
    if (splits.length !== 5) {
      return true;
    }
    // validate Thresholds are numbers and degraded is lower than failure
    if (!(isNumeric(splits[1]) && isNumeric(splits[2]))) {
      return true;
    }
    const degraded = Number(splits[1]);
    const failure = Number(splits[2]);
    return degraded > failure ? true : false;
  };
}

const isNumeric = (val: string): boolean => {
  return !isNaN(Number(val));
};
