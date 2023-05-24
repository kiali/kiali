package kubernetes

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd/api"
)

func TestSetUserIdentificationFromRemoteSecretUser(t *testing.T) {
	assert := assert.New(t)

	cases := map[string]struct {
		input    RemoteSecretUser
		expected rest.Config
	}{
		"Only bearer token": {
			input: RemoteSecretUser{
				User: RemoteSecretUserAuthInfo{
					Token: "token",
					Exec:  nil,
				},
			},
			expected: rest.Config{
				BearerToken: "token",
			},
		},
		"Use bearer token and exec credentials": {
			input: RemoteSecretUser{
				User: RemoteSecretUserAuthInfo{
					Token: "token",
					Exec: &RemoteSecretUserExec{
						Command: "command",
						Args:    []string{"arg1", "arg2"},
						Env: []api.ExecEnvVar{
							{Name: "ENV1", Value: "val1"},
							{Name: "ENV2", Value: "val2"},
						},
						APIVersion:         "client.authentication.k8s.io/v1beta1",
						InstallHint:        "hint",
						ProvideClusterInfo: true,
						InteractiveMode:    "IfAvailable",
					},
				},
			},
			expected: rest.Config{
				BearerToken: "token",
				ExecProvider: &api.ExecConfig{
					Command: "command",
					Args:    []string{"arg1", "arg2"},
					Env: []api.ExecEnvVar{
						{Name: "ENV1", Value: "val1"},
						{Name: "ENV2", Value: "val2"},
					},
					APIVersion:         "client.authentication.k8s.io/v1beta1",
					InstallHint:        "hint",
					ProvideClusterInfo: true,
					InteractiveMode:    "IfAvailable",
				},
			},
		},
	}

	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			config := &rest.Config{}
			SetUserIdentificationFromRemoteSecretUser(config, &tc.input)
			assert.Equal(tc.expected, *config)
		})
	}
}
