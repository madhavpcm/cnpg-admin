package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/cnpg-admin/internal/config"
	"github.com/cnpg-admin/internal/handler"
	"github.com/cnpg-admin/internal/k8s"
	"github.com/cnpg-admin/internal/middleware"
	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
)

func main() {
	cfg := config.Load()

	k8sClient, err := k8s.NewClient(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize k8s client: %v", err)
	}

	// Determine static files directory
	staticDir := "./web/static"
	if _, err := os.Stat(staticDir); os.IsNotExist(err) {
		staticDir = "/web/static"
	}

	r := chi.NewRouter()
	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.RealIP)
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)

	apiHandler := handler.NewAPIHandler(k8sClient)

	r.Route("/api", func(r chi.Router) {
		r.Use(middleware.Auth(cfg))

		r.Get("/health", handler.HealthCheck)

		r.Route("/clusters", func(r chi.Router) {
			r.Get("/", apiHandler.ListClusters)
			r.Post("/", apiHandler.CreateCluster)
			r.Get("/{name}", apiHandler.GetCluster)
			r.Put("/{name}", apiHandler.UpdateCluster)
			r.Delete("/{name}", apiHandler.DeleteCluster)
			r.Post("/{name}/scale", apiHandler.ScaleCluster)

			r.Get("/{name}/users", apiHandler.ListUsers)
			r.Post("/{name}/users", apiHandler.CreateUser)
			r.Delete("/{name}/users/{user}", apiHandler.DeleteUser)

			r.Post("/{name}/query", apiHandler.ExecuteQuery)
			r.Get("/{name}/tables", apiHandler.ListTables)
			r.Get("/{name}/tables/{table}", apiHandler.GetTableSchema)

			r.Get("/{name}/metrics", apiHandler.GetMetrics)
			r.Get("/{name}/logs", apiHandler.GetLogs)
			r.Get("/{name}/queries", apiHandler.GetQueryAnalytics)
		})

		r.Route("/gitops", func(r chi.Router) {
			r.Get("/repos", apiHandler.ListGitOpsRepos)
			r.Post("/repos", apiHandler.ConnectGitOpsRepo)
			r.Get("/repos/{id}/clusters", apiHandler.GetGitOpsClusters)
			r.Post("/repos/{id}/sync", apiHandler.SyncGitOpsCluster)
		})
	})

	// Serve static files
	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, staticDir+"/index.html")
	})
	r.Handle("/wasm/*", http.FileServer(http.Dir(staticDir)))
	r.Handle("/css/*", http.FileServer(http.Dir(staticDir)))
	r.Handle("/js/*", http.FileServer(http.Dir(staticDir)))

	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("Starting CNPG Admin server on %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
