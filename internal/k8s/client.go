package k8s

import (
	"os"

	"github.com/cnpg-admin/internal/config"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

type Client struct {
	Clientset *kubernetes.Clientset
	Config    *rest.Config
	Namespace string
}

func NewClient(cfg *config.Config) (*Client, error) {
	var config *rest.Config
	var err error

	if _, err := os.Stat("/var/run/secrets/kubernetes.io/serviceaccount"); err == nil {
		config, err = rest.InClusterConfig()
	} else {
		loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
		config, err = clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, &clientcmd.ConfigOverrides{}).ClientConfig()
	}
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
