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
			rawVersion: "Maistra_1.1.0-291c5419cf19d2b015e7e5dee970c458fb8f1982-Clean",
			name:       "Maistra Project",
			version:    "1.1.0",
			supported:  true,
		},
		{
			rawVersion: "Maistra_1.1.99-291c5419cf19d2b015e7e5dee970c458fb8f1982-Clean",
			name:       "Maistra Project",
			version:    "1.1.99",
			supported:  true,
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
			rawVersion: "redhat@redhat-docker.io/openshift-service-mesh-1.0.0-1-123454535353-unknown",
			name:       "OpenShift Service Mesh",
			version:    "1.0.0",
			supported:  true,
		},
		{
			rawVersion: "redhat@redhat-docker.io/openshift-service-mesh-0.9.0-1-123454535353-unknown",
			name:       "OpenShift Service Mesh",
			version:    "0.9.0",
			supported:  false,
		},
		{
			rawVersion: "OSSM_1.1.0-291c5419cf19d2b015e7e5dee970c458fb8f1982-Clean",
			name:       "OpenShift Service Mesh",
			version:    "1.1.0",
			supported:  true,
		},
		{
			rawVersion: "OSSM_1.1.99-291c5419cf19d2b015e7e5dee970c458fb8f1982-Clean",
			name:       "OpenShift Service Mesh",
			version:    "1.1.99",
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
			supported:  true,
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
			rawVersion: "root@f72e3d3ef3c2-docker.io/1.5-alpha.5c882cd74304ec037d38cd3abdf147cf1c44a392-5c882cd74304ec037d38cd3abdf147cf1c44a392-Clean",
			name:       "Istio Dev",
			version:    "1.5 (dev 5c882cd74304ec037d38cd3abdf147cf1c44a392)",
			supported:  true,
		},
		{
			rawVersion: "1.10-dev-65a124dc2ab69f91331298fbf6d9b4335abcf0fd-Clean",
			name:       "Istio Dev",
			version:    "1.10 (dev 65a124dc2ab69f91331298fbf6d9b4335abcf0fd)",
			supported:  true,
		},
		{
			rawVersion: "root@f72e3d3ef3c2-docker.io/1.6.0-beta.0",
			name:       "Istio RC",
			version:    "1.6.0 (beta.0)",
			supported:  true,
		},
		{
			rawVersion: "root@f72e3d3ef3c2-docker.io/1.6.0-rc.0",
			name:       "Istio RC",
			version:    "1.6.0 (rc.0)",
			supported:  true,
		},
		{
			rawVersion: "some-unknown-version-string",
			name:       "Unknown Istio Implementation",
			version:    "some-unknown-version-string",
			supported:  false,
		},
		{
			rawVersion: "root@f72e3d3ef3c2-docker.io/1.7.0-alpha.1-cd46a166947eac363380c3aa3523b26a8c391f98-dirty-Modified",
			name:       "Istio RC",
			version:    "1.7.0 (alpha.1)",
			supported:  true,
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

	result = validateVersion("> 1.5.0-alpha", "1.6.0-beta.0")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 1.5.0-alpha is <= 1.6.0-beta.0")
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

	result = validateVersion("< 1.5", "1.4")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 1.4 is < 1.5")
	}

	result = validateVersion("< 1.5", "1.4.2")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 1.4.2 is < 1.5")
	}

	result = validateVersion(">= 1.5", "1.5")

	if !result {
		t.Errorf("validateVersion was incorrect, got false, want true, 1.5 is >= 1.5")
	}

	result = validateVersion("< 1.5", "1.5.2")

	if result {
		t.Errorf("validateVersion was incorrect, got true, want false, 1.5.2 is > 1.5")
	}

}

// TestMeshVersionCompatible check meshVersion compatibility witk Kiali
func TestMeshVersionCompatible(t *testing.T) {

	// versionsToTestStruct struct for version compatibility test cases
	type versionsToTestStruct struct {
		meshVersion string
		name        string
		version     string
		supported   bool
	}

	versionsToTest := []versionsToTestStruct{
		{
			name:        "Istio",
			version:     "1.45.1",
			meshVersion: "1.13",
			supported:   true,
		},
		{
			name:        "Istio",
			version:     "1.44.0",
			meshVersion: "1.13",
			supported:   false,
		},
		{
			name:        "Istio",
			version:     "1.44.0",
			meshVersion: "1.12",
			supported:   true,
		},
		{
			name:        "Istio",
			version:     "1.44.1",
			meshVersion: "1.12",
			supported:   false,
		},
		{
			name:        "Istio",
			version:     "1.43.0",
			meshVersion: "1.12",
			supported:   true,
		},
		{
			name:        "Istio",
			version:     "1.41.0",
			meshVersion: "1.12.1",
			supported:   false,
		},
		{
			name:        "Istio",
			version:     "1.38.2",
			meshVersion: "1.11.2",
			supported:   true,
		},
		{
			name:        "Istio Snapshot",
			version:     "1.38.0",
			meshVersion: "1.11",
			supported:   false,
		},
		{
			name:        "Istio Snapshot",
			version:     "1.34.2",
			meshVersion: "1.10",
			supported:   true,
		},
		{
			name:        "Istio Snapshot",
			version:     "1.38.1",
			meshVersion: "1.10",
			supported:   false,
		},
		{
			name:        "Istio Snapshot",
			version:     "1.29.2",
			meshVersion: "1.9",
			supported:   true,
		},
		{
			name:        "Istio Dev",
			version:     "1.36",
			meshVersion: "1.9",
			supported:   false,
		},
		{
			name:        "Istio RC",
			version:     "1.29.1",
			meshVersion: "1.8",
			supported:   false,
		},
		{
			name:        "Istio RC",
			version:     "1.26.2",
			meshVersion: "1.8.1",
			supported:   true,
		},
		{
			name:        "Istio Dev",
			version:     "1.22.2",
			meshVersion: "1.7",
			supported:   true,
		},
		{
			name:        "Istio Dev",
			version:     "1.22.2",
			meshVersion: "1.7.3",
			supported:   true,
		},
		{
			name:        "Istio RC",
			version:     "1.18.2",
			meshVersion: "1.6",
			supported:   true,
		},
		{
			name:        "Istio RC",
			version:     "1.18.2",
			meshVersion: "1.6.1",
			supported:   true,
		},
		{
			name:        "Istio RC",
			version:     "1.22",
			meshVersion: "1.6",
			supported:   false,
		},
		{
			name:        "Istio RC",
			version:     "1.22",
			meshVersion: "1.5",
			supported:   false,
		},
		{
			name:        "Istio RC",
			version:     "1.22",
			meshVersion: "1.5",
			supported:   false,
		},
		{
			name:        "Istio Dev",
			version:     "1.22",
			meshVersion: "1.5.1",
			supported:   false,
		},
		{
			name:        "Istio Dev",
			version:     "1.17",
			meshVersion: "1.0",
			supported:   true,
		},
		{
			name:        "Istio Dev",
			version:     "1.19",
			meshVersion: "1.0",
			supported:   false,
		},
		{
			name:        "Istio Dev",
			version:     "1.17",
			meshVersion: "1.1",
			supported:   true,
		},
		{
			name:        "Istio Dev",
			version:     "1.19",
			meshVersion: "1.1",
			supported:   false,
		},
		{
			name:        "Istio Dev",
			version:     "1.17",
			meshVersion: "1.2",
			supported:   true,
		},
		{
			name:        "Istio Dev",
			version:     "1.19",
			meshVersion: "1.2",
			supported:   false,
		},
		{
			name:        "Istio Dev",
			version:     "1.17",
			meshVersion: "1.3",
			supported:   true,
		},
		{
			name:        "Istio Dev",
			version:     "1.19",
			meshVersion: "1.3",
			supported:   false,
		},
		{
			name:        "Istio Dev",
			version:     "1.17",
			meshVersion: "1.4",
			supported:   true,
		},
		{
			name:        "Istio Dev",
			version:     "1.19",
			meshVersion: "1.4",
			supported:   false,
		},
		{
			name:        "Istio Dev",
			version:     "1.17",
			meshVersion: "1.5",
			supported:   true,
		},
		{
			name:        "Istio Dev",
			version:     "1.19",
			meshVersion: "1.5",
			supported:   false,
		},
		{
			name:        "istioProductNameUnknown",
			version:     "1.18.2",
			meshVersion: "1.6.1",
			supported:   false,
		},
		{
			name:        "Maistra",
			version:     "1.36",
			meshVersion: "2.1",
			supported:   true,
		},
		{
			name:        "Maistra Project",
			version:     "1.24",
			meshVersion: "2.1",
			supported:   true,
		},
		{
			name:        "Maistra Project",
			version:     "1.12",
			meshVersion: "2.1",
			supported:   true,
		},
		{
			name:        "Maistra Project",
			version:     "1.24",
			meshVersion: "2.0",
			supported:   true,
		},
		{
			name:        "Maistra",
			version:     "1.12",
			meshVersion: "2.0",
			supported:   true,
		},
		{
			name:        "Maistra Project",
			version:     "1.12",
			meshVersion: "1.1",
			supported:   true,
		},
		{
			name:        "Maistra",
			version:     "1.12",
			meshVersion: "2.0",
			supported:   true,
		},
		{
			name:        "Maistre",
			version:     "1.12",
			meshVersion: "2.0",
			supported:   false,
		},
		{
			name:        "Maistra",
			version:     "1.23",
			meshVersion: "2.0",
			supported:   false,
		},
		{
			name:        "Maistra",
			version:     "1.23",
			meshVersion: "2.1",
			supported:   false,
		},
		{
			name:        "Maistra",
			version:     "1.23",
			meshVersion: "1.1",
			supported:   false,
		},
		{
			name:        "Maistra",
			version:     "1.12",
			meshVersion: "3.4",
			supported:   false,
		},
		{
			name:        "OpenShift Service Mesh",
			version:     "1.36",
			meshVersion: "2.1",
			supported:   true,
		},
		{
			name:        "OpenShift Service Mesh",
			version:     "1.24",
			meshVersion: "2.0",
			supported:   true,
		},
		{
			name:        "OpenShift Service Mesh",
			version:     "1.12",
			meshVersion: "1.1",
			supported:   true,
		},
		{
			name:        "OpenShift Service Mesh",
			version:     "1.12",
			meshVersion: "1.15",
			supported:   false,
		},
		{
			name:        "OpenShift Service Mesh",
			version:     "1.18",
			meshVersion: "1.1",
			supported:   false,
		},
	}

	for _, versionToTest := range versionsToTest {
		p := CheckMeshVersion(versionToTest.name, versionToTest.meshVersion, versionToTest.version)
		t.Logf("Checking:\n[%+v]\n", versionToTest)
		if p != versionToTest.supported {
			t.Errorf("Cannot validate [%+v] - version range is incorrect: %+v", versionToTest, p)
		}
	}
}
