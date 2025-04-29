package kubernetes_test

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/kiali/kiali/kubernetes"
)

func TestBoolOrString(t *testing.T) {
	tests := map[string]struct {
		input       string
		wantBool    bool
		wantBoolVal bool
		wantStrVal  string
		expectError bool
	}{
		"wantBool":   {input: `true`, wantBool: true, wantBoolVal: true},
		"wantString": {input: `false`, wantBool: true, wantBoolVal: false},
		"wantStr":    {input: `"yes"`, wantBool: false, wantStrVal: "yes"},
		"nothing":    {input: `"no"`, wantBool: false, wantStrVal: "no"},
		"error1":     {input: `123`, expectError: true},
		"error2":     {input: `null`, expectError: true},
	}

	for _, tt := range tests {

		var bos BoolOrString
		err := json.Unmarshal([]byte(tt.input), &bos)
		
		t.Run(name, func(t *testing.T) {
			require := require.New(t)

		})
		if tt.expectError {
			if err == nil {
				t.Errorf("expected error for input %s, got nil", tt.input)
			}
			continue
		}

		if err != nil {
			t.Errorf("unexpected error for input %s: %v", tt.input, err)
			continue
		}

		if bos.IsBool != tt.wantBool {
			t.Errorf("IsBool mismatch for input %s: got %v, want %v", tt.input, bos.IsBool, tt.wantBool)
		}

		if bos.IsBool && bos.BoolVal != tt.wantBoolVal {
			t.Errorf("BoolVal mismatch for input %s: got %v, want %v", tt.input, bos.BoolVal, tt.wantBoolVal)
		}

		if !bos.IsBool && bos.StrVal != tt.wantStrVal {
			t.Errorf("StrVal mismatch for input %s: got %v, want %v", tt.input, bos.StrVal, tt.wantStrVal)
		}
	}
}
