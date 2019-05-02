package status

import (
	"testing"
)

func TestParseIstioRawVersion(t *testing.T) {
	type versionsToTestStruct struct {
		rawVersion string
		name       string
		version    string
		supported  bool
	}

	// see config.go/[Maistra,Istio]VersionSupported for what versions are supported
	versionsToTest := []versionsToTestStruct{
		{
			rawVersion: "redhat@redhat-brew.abc.xyz.redhat.com:8888/openshift-istio-tech-preview-0.1.2-1-3a13-Custom",
			name:       "Maistra Project",
			version:    "0.1.2",
			supported:  false,
		},
		{
			rawVersion: "redhat@redhat-brew.abc.xyz.redhat.com:8888/openshift-istio-10.11.12-1-3a13-Custom",
			name:       "Maistra Project",
			version:    "10.11.12",
			supported:  true,
		},
		{
			rawVersion: "redhat@redhat-brew.abc.xyz.redhat.com:8888/openshift-istio-0.0.12-1-3a13-Custom",
			name:       "Maistra Project",
			version:    "0.0.12",
			supported:  false,
		},
		{
			rawVersion: "redhat@redhat-docker.io/maistra-0.1.0-1-3a13-unknown",
			name:       "Maistra",
			version:    "0.1.0",
			supported:  false,
		},
		{
			rawVersion: "redhat@redhat-docker.io/maistra-0.7.0-1-3a13-unknown",
			name:       "Maistra",
			version:    "0.7.0",
			supported:  true,
		},
		{
			rawVersion: "foobar-maistra-11.12.13-wotgorilla?",
			name:       "Maistra",
			version:    "11.12.13",
			supported:  true,
		},
		{
			rawVersion: "foobar-maistra-0.0.987-wotgorilla?",
			name:       "Maistra",
			version:    "0.0.987",
			supported:  false,
		},
		{
			rawVersion: "foo-istio-1.2.3-bar",
			name:       "Istio",
			version:    "1.2.3",
			supported:  true,
		},
		{
			rawVersion: "foo-istio-10.11.122-bar",
			name:       "Istio",
			version:    "10.11.122",
			supported:  true,
		},
		{
			rawVersion: "foo-istio-0.123.789-bar",
			name:       "Istio",
			version:    "0.123.789",
			supported:  false,
		},
		{
			rawVersion: "root@f72e3d3ef3c2-docker.io/istio-release-1.0-20180927-21-10-deadbeef-Clean",
			name:       "Istio Snapshot",
			version:    "1.0-20180927",
			supported:  false,
		},
		{
			rawVersion: "root@f72e3d3ef3c2-docker.io/istio-release-1.1-20190327-21-10-deadbeef-Clean",
			name:       "Istio Snapshot",
			version:    "1.1-20190327",
			supported:  true,
		},
		{
			rawVersion: "root@f72e3d3ef3c2-docker.io/istio-release-11.12-20180927-21-10-deadbeef-Clean",
			name:       "Istio Snapshot",
			version:    "11.12-20180927",
			supported:  true,
		},
		{
			rawVersion: "root@f72e3d3ef3c2-docker.io/istio-release-0.11-20180927-21-10-deadbeef-Clean",
			name:       "Istio Snapshot",
			version:    "0.11-20180927",
			supported:  false,
		},
		{
			rawVersion: "some-unknown-version-string",
			name:       "Unknown Istio Implementation",
			version:    "some-unknown-version-string",
			supported:  false,
		},
	}

	for _, versionToTest := range versionsToTest {
		info.WarningMessages = []string{} // reset before we test
		p, err := parseIstioRawVersion(versionToTest.rawVersion)
		if err != nil {
			t.Errorf("Got an error trying to validate [%+v]: %+v", versionToTest, err)
		}
		if p.Name != versionToTest.name {
			t.Errorf("Cannot validate [%+v] - name is incorrect: %+v", versionToTest, p)
		}
		if p.Version != versionToTest.version {
			t.Errorf("Cannot validate [%+v] - version is incorrect: %+v", versionToTest, p)
		}
		if versionToTest.supported && len(info.WarningMessages) > 0 {
			t.Errorf("Version [%+v] is supported but the parsed version [%+v] caused a warning: %+v", versionToTest, p, info.WarningMessages)
		}
		if !versionToTest.supported && len(info.WarningMessages) == 0 {
			t.Errorf("Version [%+v] is not supported but the parsed version [%+v] did not cause a warning", versionToTest, p)
		}
	}
}

func TestValidateVersion(t *testing.T) {
	result := validateVersion(">= 0.7.1", "0.7.1")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 0.7.1 is >= 0.7.1")
	}

	result = validateVersion(">= 0.7.1", "0.8.1")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 0.8.1 is >= 0.7.1")
	}

	result = validateVersion(">= 0.7.1", "1.3.0")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 1.3.0 is >= 0.7.1")
	}

	result = validateVersion("== 0.7.1", "1.3.0")

	if result {
		t.Errorf("validateVersion was incorrect, got true, want false, 1.3.0 is not == 0.7.1")
	}

	result = validateVersion("> 0.7.1", "1.3.0")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 1.3.0 is > 0.7.1")
	}

	result = validateVersion(">= 0.7.1", "0.6.3")

	if result {
		t.Errorf("validateVersion was incorrect, got true, want false, 0.6.3 is not >= 0.7.1")
	}

	result = validateVersion("> 0.7.1", "0.6.3")

	if result {
		t.Errorf("validateVersion was incorrect, got true, want false, 0.6.3 is not > 0.7.1")
	}

	// Alpha / Beta versions

	result = validateVersion("> 0.7.1", "0.8.3-alpha")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 0.8.3-alpha is > 0.7.1")
	}

	result = validateVersion(">= 0.8.3-alpha", "0.8.3-alpha")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 0.8.3-alpha is >= 0.8.3-alpha")
	}

	// Longer releases

	result = validateVersion(">= 0.8.3", "0.8.3.1")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 0.8.3.1 is >= 0.8.3")
	}

	result = validateVersion("> 0.9", "0.9.1.1")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 0.9.1.1 is > 0.9")
	}

	result = validateVersion("> 0.8.1.1", "0.8.2")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 0.8.2 is > 0.8.1.1")
	}

	result = validateVersion("> 0.8.1.1", "1")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 1 is > 0.8.1.1")
	}
}
