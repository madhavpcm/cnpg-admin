package config

import "os"

type Config struct {
	Port           int
	KubeconfigPath string
	Namespace      string
}

func Load() *Config {
	return &Config{
		Port:           8080,
		KubeconfigPath: os.Getenv("KUBECONFIG"),
		Namespace:      "cnpg-system",
	}
}
