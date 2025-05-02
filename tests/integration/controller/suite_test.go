/*
Copyright 2024 The Kubernetes authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Adapted from: https://github.com/kubernetes-sigs/kubebuilder/blob/8afeb403549fa87bf55a00e10a819a34719eec53/docs/book/src/cronjob-tutorial/testdata/project/internal/controller/suite_test.go
*/

package controller

import (
	"context"
	"embed"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"testing"

	"github.com/Masterminds/semver/v3"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"k8s.io/client-go/rest"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/envtest"
	logf "sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/log/zap"
	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"

	"github.com/kiali/kiali/controller"
	kialicmd "github.com/kiali/kiali/tools/cmd"
)

var (
	cfg        *rest.Config
	k8sClient  client.Client
	k8sManager ctrl.Manager
	testEnv    *envtest.Environment
	ctx        context.Context
	cancel     context.CancelFunc
)

func TestControllers(t *testing.T) {
	RegisterFailHandler(Fail)

	RunSpecs(t, "Controller Suite")
}

//go:embed testdata/istio-crds
var istioCRDDir embed.FS

var (
	kialiOutputFolder     = filepath.Join(kialicmd.KialiProjectRoot, "_output")
	binaryAssetsDirectory = filepath.Join(kialiOutputFolder, "k8s")
)

var _ = BeforeSuite(func() {
	logf.SetLogger(zap.New(zap.WriteTo(GinkgoWriter), zap.UseDevMode(true)))

	ctx, cancel = context.WithCancel(context.TODO())

	istioVersion := os.Getenv("ISTIO_VERSION")
	// Istio CRDs needs to be downloaded to the testdata folder in order for these tests to run because
	// these tests spin up a real API server and the Istio CRDs need to be installed in the API server.
	if istioVersion != "" {
		// Take version of the form 1.23.0 and convert it to it's minor form: 1.23
		parts := strings.Split(istioVersion, ".")
		if len(parts) < 2 {
			Fail(fmt.Sprintf("Invalid ISTIO_VERSION env var. Expected version of the form '1.23.0' of '1.23-latest'. Got: %s", istioVersion))
		}
		parts2 := strings.Split(parts[1], "-") // For the 1.23-latest format

		// Put it back together with just the major/minor
		istioVersion = parts[0] + "." + parts2[0]
	} else {
		// Find the latest version
		crdFiles, err := istioCRDDir.ReadDir("testdata/istio-crds")
		if err != nil {
			Fail(fmt.Sprintf("Unable to read istio-crds dir: %s", err))
		}

		var versions semver.Collection
		for _, f := range crdFiles {
			version := strings.TrimSuffix(f.Name(), ".yaml")
			v, err := semver.NewVersion(version)
			if err != nil {
				Fail(fmt.Sprintf("Unable to determine version of file: '%s': %s", f.Name(), err))
			}
			versions = append(versions, v)
		}
		if len(versions) == 0 {
			Fail("No istio-crd files found")
		}

		sort.Sort(sort.Reverse(versions))
		istioVersion = fmt.Sprintf("%d.%d", versions[0].Major(), versions[0].Minor())
	}

	By(fmt.Sprintf("Using istio version: %s", istioVersion))
	kubeVersion := os.Getenv("KUBE_VERSION")
	if kubeVersion == "" {
		// Find one that ends with -<os>-<arch>.
		files, err := os.ReadDir(binaryAssetsDirectory)
		Expect(err).NotTo(HaveOccurred())
		for _, file := range files {
			if strings.HasSuffix(file.Name(), fmt.Sprintf("-%s-%s", runtime.GOOS, runtime.GOARCH)) {
				kubeVersion = file.Name()
				break
			}
		}
	}

	By("bootstrapping test environment")
	testEnv = &envtest.Environment{
		CRDInstallOptions:     envtest.CRDInstallOptions{Paths: []string{"testdata/istio-crds/" + istioVersion + ".yaml"}},
		ErrorIfCRDPathMissing: true,
		// e.g. "_output/k8s/1.29.1-linux-amd64"
		BinaryAssetsDirectory: filepath.Join(kialiOutputFolder, "k8s", kubeVersion),
	}

	var err error
	cfg, err = testEnv.Start()
	Expect(err).NotTo(HaveOccurred())
	Expect(cfg).NotTo(BeNil())

	scheme, err := controller.NewScheme()
	Expect(err).NotTo(HaveOccurred())

	k8sClient, err = client.New(cfg, client.Options{Scheme: scheme})
	Expect(err).NotTo(HaveOccurred())
	Expect(k8sClient).NotTo(BeNil())

	k8sManager, err = ctrl.NewManager(cfg, ctrl.Options{
		Scheme:  scheme,
		Metrics: metricsserver.Options{BindAddress: "0"},
	})
	Expect(err).ToNot(HaveOccurred())

	go func() {
		defer GinkgoRecover()
		err = k8sManager.Start(ctx)
		Expect(err).ToNot(HaveOccurred(), "failed to run manager")
	}()
})

var _ = AfterSuite(func() {
	cancel()
	By("tearing down the test environment")
	err := testEnv.Stop()
	Expect(err).NotTo(HaveOccurred())
})
