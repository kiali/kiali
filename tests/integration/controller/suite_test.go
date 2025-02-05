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
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

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

var (
	kialiOutputFolder     = filepath.Join(kialicmd.KialiProjectRoot, "_output")
	binaryAssetsDirectory = filepath.Join(kialiOutputFolder, "k8s")
)

var _ = BeforeSuite(func() {
	logf.SetLogger(zap.New(zap.WriteTo(GinkgoWriter), zap.UseDevMode(true)))

	ctx, cancel = context.WithCancel(context.TODO())

	istioVersion := os.Getenv("ISTIO_VERSION")
	if istioVersion == "" {
		files, err := os.ReadDir(kialiOutputFolder)
		Expect(err).NotTo(HaveOccurred())
		for _, file := range files {
			// Simply pick one that beings with istio-
			if strings.HasPrefix(file.Name(), "istio-") {
				istioVersion = file.Name()
				break
			}
		}
	}

	// Istio needs to be installed in the kiali/_output folder in order for these tests to run because
	// these tests spin up a real API server and we need to find the Istio CRDs in the output folder
	// so they can be installed in the API server.
	if istioVersion == "" {
		Fail(fmt.Sprintf("ISTIO_VERSION not set and could not be automatically determined. Have you installed istio in your kiali output directory: '%s'?", kialiOutputFolder))
	}

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
		// TODO: This method of loading in the istio CRDs needs to change. It is too reliant on the structure of the manifests dir
		// which we don't control. Would be better to embed the CRDs if possible.
		// e.g. _output/istio-1.24.0/manifests/charts/base/files/crd-all.gen.yaml
		CRDDirectoryPaths:     []string{filepath.Join(kialiOutputFolder, istioVersion, "manifests", "charts", "base", "files")},
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
