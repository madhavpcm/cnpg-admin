package k8s

import (
	"github.com/cnpg-admin/internal/config"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

type Client struct {
	Clientset *kubernetes.Clientset
	Config    *rest.Config
	Namespace string
}

func NewClient(cfg *config.Config) (*Client, error) {
	config, err := rest.InClusterConfig()
	if err != nil {
		return nil, err
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, err
	}

	return &Client{
		Clientset: clientset,
		Config:    config,
		Namespace: cfg.Namespace,
	}, nil
}
