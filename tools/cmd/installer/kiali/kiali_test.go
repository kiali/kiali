package kiali

import (
	"testing"
)

func TestHelmChartArgs(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		helmChartPath string
		want          []string
	}{
		{
			name:          "local path returns path only",
			helmChartPath: "/tmp/kiali-server-2.0.0.tgz",
			want:          []string{"/tmp/kiali-server-2.0.0.tgz"},
		},
		{
			name:          "empty path returns repo flags",
			helmChartPath: "",
			want:          []string{"--repo", defaultHelmRepo, "kiali-server"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			cfg := Config{HelmChartPath: tt.helmChartPath}
			got := cfg.helmChartArgs()

			if len(got) != len(tt.want) {
				t.Fatalf("helmChartArgs() returned %d args, want %d: got %v", len(got), len(tt.want), got)
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Errorf("helmChartArgs()[%d] = %q, want %q", i, got[i], tt.want[i])
				}
			}
		})
	}
}
