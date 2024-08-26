package kubernetes_test

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/kubernetes"
)

func TestStructOrBool(t *testing.T) {
	cases := map[string]struct {
		jsonStr        string
		expectErr      bool
		expectedOutput struct{}
	}{
		"has bool":   {jsonStr: `true`},
		"has struct": {jsonStr: `{}`},
		"is empty":   {jsonStr: ``, expectErr: true},
		"is null":    {jsonStr: `null`},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			require := require.New(t)

			var sob kubernetes.StructOrBool
			err := json.Unmarshal([]byte(tc.jsonStr), &sob)
			if tc.expectErr {
				require.Error(err)
				return
			} else {
				require.NoError(err)
			}
			require.EqualValues(struct{}{}, sob)
			require.NotNil(sob)
		})
	}
}
