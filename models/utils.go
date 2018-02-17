package models

import (
	"github.com/swift-sunshine/swscore/kubernetes"
	"github.com/swift-sunshine/swscore/log"
)

func KubernetesClient() (*kubernetes.IstioClient, error) {
	istioClient, err := kubernetes.NewClient()
	if err != nil {
		log.Error(err)
		return nil, err
	}
	return istioClient, nil
}
