package status

import (
	"testing"
)

func TestParseIstioRawVersion(t *testing.T) {
	type versionsToTestStruct struct {
		rawVersion string
		name       string
		version    string
	}

	// see config.go/IstioVersionSupported for what versions are supported
	versionsToTest := []versionsToTestStruct{
		{
			rawVersion: "redhat@redhat-docker.io/openshift-service-mesh-1.0.0-1-123454535353-unknown",
			name:       "OpenShift Service Mesh",
			version:    "1.0.0",
		},
		{
			rawVersion: "redhat@redhat-docker.io/openshift-service-mesh-0.9.0-1-123454535353-unknown",
			name:       "OpenShift Service Mesh",
			version:    "0.9.0",
		},
		{
			rawVersion: "OSSM_1.1.0-291c5419cf19d2b015e7e5dee970c458fb8f1982-Clean",
			name:       "OpenShift Service Mesh",
			version:    "1.1.0",
		},
		{
			rawVersion: "OSSM_1.1.99-291c5419cf19d2b015e7e5dee970c458fb8f1982-Clean",
			name:       "OpenShift Service Mesh",
			version:    "1.1.99",
		},
		{
			rawVersion: "OSSM_3.0.0-tp.1-ed90e14d3473bc3fe54f98298eb16664002d14d1-Clean",
			name:       "OpenShift Service Mesh",
			version:    "3.0.0-tp.1",
		},
		{
			rawVersion: "OSSM_3.3.3-tp.10-ed90e14d3473bc3fe54f98298eb16664002d14d1-Clean",
			name:       "OpenShift Service Mesh",
			version:    "3.3.3-tp.10",
		},
		{
			rawVersion: "OSSM_3.0.0-ed90e14d3473bc3fe54f98298eb16664002d14d1-Clean",
			name:       "OpenShift Service Mesh",
			version:    "3.0.0",
		},
		{
			rawVersion: "foo-istio-1.2.3-bar",
			name:       "Istio",
			version:    "1.2.3",
		},
		{
			rawVersion: "foo-istio-10.11.122-bar",
			name:       "Istio",
			version:    "10.11.122",
		},
		{
			rawVersion: "foo-istio-0.123.789-bar",
			name:       "Istio",
			version:    "0.123.789",
		},
		{
			rawVersion: "root@f72e3d3ef3c2-docker.io/istio-release-1.0-20180927-21-10-deadbeef-Clean",
			name:       "Istio Snapshot",
			version:    "1.0-20180927",
		},
		{
			rawVersion: "root@f72e3d3ef3c2-docker.io/istio-release-1.1-20190327-21-10-deadbeef-Clean",
			name:       "Istio Snapshot",
			version:    "1.1-20190327",
		},
		{
			rawVersion: "root@f72e3d3ef3c2-docker.io/istio-release-11.12-20180927-21-10-deadbeef-Clean",
			name:       "Istio Snapshot",
			version:    "11.12-20180927",
		},
		{
			rawVersion: "root@f72e3d3ef3c2-docker.io/istio-release-0.11-20180927-21-10-deadbeef-Clean",
			name:       "Istio Snapshot",
			version:    "0.11-20180927",
		},
		{
			rawVersion: "root@f72e3d3ef3c2-docker.io/1.5-alpha.5c882cd74304ec037d38cd3abdf147cf1c44a392-5c882cd74304ec037d38cd3abdf147cf1c44a392-Clean",
			name:       "Istio Dev",
			version:    "1.5 (dev 5c882cd74304ec037d38cd3abdf147cf1c44a392)",
		},
		{
			rawVersion: "1.10-dev-65a124dc2ab69f91331298fbf6d9b4335abcf0fd-Clean",
			name:       "Istio Dev",
			version:    "1.10 (dev 65a124dc2ab69f91331298fbf6d9b4335abcf0fd)",
		},
		{
			rawVersion: "root@f72e3d3ef3c2-docker.io/1.6.0-beta.0",
			name:       "Istio RC",
			version:    "1.6.0 (beta.0)",
		},
		{
			rawVersion: "root@f72e3d3ef3c2-docker.io/1.6.0-rc.0",
			name:       "Istio RC",
			version:    "1.6.0 (rc.0)",
		},
		{
			rawVersion: "some-unknown-version-string",
			name:       "Unknown Istio Implementation",
			version:    "some-unknown-version-string",
		},
		{
			rawVersion: "root@f72e3d3ef3c2-docker.io/1.7.0-alpha.1-cd46a166947eac363380c3aa3523b26a8c391f98-dirty-Modified",
			name:       "Istio RC",
			version:    "1.7.0 (alpha.1)",
		},
	}

	for _, versionToTest := range versionsToTest {
		p := parseIstioRawVersion(versionToTest.rawVersion)
		if p.Name != versionToTest.name {
			t.Errorf("Cannot validate [%+v] - name is incorrect: %+v", versionToTest, p)
		}
		if p.Version != versionToTest.version {
			t.Errorf("Cannot validate [%+v] - version is incorrect: %+v", versionToTest, p)
		}
	}
}
