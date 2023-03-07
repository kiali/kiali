import * as H from '../../types/HealthAnnotation';

const createHealthAnnotation = (value: string): H.HealthAnnotationType => {
  const annotations: H.HealthAnnotationType = {};
  annotations[H.HealthAnnotationConfig.HEALTH_RATE] = value;
  return annotations;
};

const correctAnnotations = ['5xx,10,20,http,inbound', '4XX,30,40,http,inbound'];

const wrongAnnotations = [
  '[45]xx,10,20,http', // Not defined the direction
  '[45]xx,40,20,http,inbound', // Degraded is greater than Failure
  '[45]xx,10,sd,http,inbound' // Failure is not numeric
];

describe('healthAnnotation', () => {
  describe('RateHealth', () => {
    describe('Validation', () => {
      it('should be valid/not valid for a correct/wrong annotation', () => {
        correctAnnotations.forEach(annotation => {
          const ratehealth = new H.RateHealth(createHealthAnnotation(annotation));
          expect(ratehealth.isValid).toBeTruthy();
        });

        wrongAnnotations.forEach(annotation => {
          var ratehealth = new H.RateHealth(createHealthAnnotation(annotation));
          expect(ratehealth.isValid).toBeFalsy();
        });
      });
    });

    describe('Validate multiple annotations', () => {
      it('should be valid for a multiple annotations', () => {
        const ratehealth = new H.RateHealth(createHealthAnnotation(correctAnnotations.join(';')));
        expect(ratehealth.isValid).toBeTruthy();
      });

      it('should be not valid if there is a wrong annotation', () => {
        // All wrong
        var ratehealth = new H.RateHealth(createHealthAnnotation(wrongAnnotations.join(';')));
        expect(ratehealth.isValid).toBeFalsy();

        // One of them wrong
        var annotations = [...correctAnnotations];
        annotations.push(wrongAnnotations[0]);
        ratehealth = new H.RateHealth(createHealthAnnotation(annotations.join(';')));
        expect(ratehealth.isValid).toBeFalsy();
      });
    });

    describe('Return the configuration for annotations', () => {
      it('should be empty if there is a worng annotation', () => {
        const ratehealth = new H.RateHealth(createHealthAnnotation(wrongAnnotations.join(';')));
        expect(ratehealth.getToleranceConfig().length).toBe(0);
      });

      it('should be an array of objects', () => {
        const ratehealth = new H.RateHealth(createHealthAnnotation(correctAnnotations.join(';')));
        const configs = ratehealth.getToleranceConfig();
        expect(configs.length).toBe(correctAnnotations.length);
        correctAnnotations.forEach((annotation, i) => {
          const annotate = annotation.split(',');
          const code = annotate[0].replace(/x|X/g, '\\d');
          expect(configs[i].code).toStrictEqual(new RegExp(code));
          expect(configs[i].degraded).toBe(Number(annotate[1]));
          expect(configs[i].failure).toBe(Number(annotate[2]));
          expect(configs[i].protocol).toStrictEqual(new RegExp(annotate[3]));
          expect(configs[i].direction).toStrictEqual(new RegExp(annotate[4]));
        });
      });
    });
  });
});
