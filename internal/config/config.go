package config

import "os"

type Config struct {
	Port           int
	KubeconfigPath string
	Namespace      string
	Mock           bool
}

func Load() *Config {
	return &Config{
		Port:           8080,
		KubeconfigPath: os.Getenv("KUBECONFIG"),
		Namespace:      "cnpg-system",
		Mock:           os.Getenv("MOCK_K8S") == "true",
	}
}
