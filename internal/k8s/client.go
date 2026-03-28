package k8s

import (
	"log"
	"os"

	"github.com/cnpg-admin/internal/config"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

type Client struct {
	Clientset     *kubernetes.Clientset
	DynamicClient dynamic.Interface
	Config        *rest.Config
	Namespace     string
	Mock          bool
}

func NewClient(cfg *config.Config) (*Client, error) {
	if cfg.Mock {
		return &Client{
			Namespace: cfg.Namespace,
			Mock:      true,
		}, nil
	}

	var config *rest.Config
	var err error

	if _, err := os.Stat("/var/run/secrets/kubernetes.io/serviceaccount"); err == nil {
		config, err = rest.InClusterConfig()
	} else {
		loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
		config, err = clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, &clientcmd.ConfigOverrides{}).ClientConfig()
	}

	if err != nil || config == nil {
		// Fallback to mock if requested via env or if we just want to be helpful locally
		log.Printf("Warning: Failed to load Kubernetes config: %v (config is nil: %v). Falling back to Mock mode.", err, config == nil)
		return &Client{
			Namespace: cfg.Namespace,
			Mock:      true,
		}, nil
	}

	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, err
	}

	dynamicClient, err := dynamic.NewForConfig(config)
	if err != nil {
		return nil, err
	}

	return &Client{
		Clientset:     clientset,
		DynamicClient: dynamicClient,
		Config:        config,
		Namespace:     cfg.Namespace,
		Mock:          false,
	}, nil
}
