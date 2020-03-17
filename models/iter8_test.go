package models

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"encoding/json"
)

func TestIter8MarshalForCreate(t *testing.T) {
	assert := assert.New(t)
	experimentJson := `{
	  "name": "reviews-experiment",
	  "namespace": "default",
	  "service": "reviews",
	  "apiversion": "v1",
	  "baseline": "reviews-v1",
	  "candidate": "reviews-v2",
	  "trafficControl": {
		"algorithm": "check_and_increment",
		"interval": "30s",
		"maxIteration": 100,
		"maxTrafficPercentage": 50,
		"trafficStepSize": 2
	  },
	  "criterias": [
		{
		  "metric": "iter8_latency",
		  "sampleSize": 100,
		  "tolerance": 0.2,
		  "toleranceType": "threshold",
		  "stopOnFailure": false
		}
	  ]
	}`;

	experimentBytes := []byte(experimentJson)

	err := json.Unmarshal(experimentBytes, &Iter8ExperimentSpec{})
	assert.NoError(err)
}