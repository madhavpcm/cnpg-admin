package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/cnpg-admin/internal/config"
	"github.com/cnpg-admin/internal/handler"
	"github.com/cnpg-admin/internal/k8s"
	"github.com/cnpg-admin/internal/middleware"
	"github.com/cnpg-admin/internal/ui"
	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/maxence-charriere/go-app/v10/pkg/app"
)

func main() {
	cfg := config.Load()

	k8sClient, err := k8s.NewClient(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize k8s client: %v", err)
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

	app.Route("/", func() app.Composer { return &ui.Dashboard{} })
	app.Route("/clusters", func() app.Composer { return &ui.Clusters{} })
	app.Route("/clusters/:name", func() app.Composer { return &ui.ClusterDetail{} })
	app.Route("/users", func() app.Composer { return &ui.Users{} })
	app.Route("/query", func() app.Composer { return &ui.Query{} })
	app.Route("/tables", func() app.Composer { return &ui.Tables{} })
	app.Route("/metrics", func() app.Composer { return &ui.Metrics{} })
	app.Route("/logs", func() app.Composer { return &ui.Logs{} })
	app.Route("/gitops", func() app.Composer { return &ui.GitOps{} })

	appHandler := &app.Handler{
		Styles: []string{"/app.css"},
	}

	noCache := func(h http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			w.Header().Set("Pragma", "no-cache")
			w.Header().Set("Expires", "0")
			h.ServeHTTP(w, r)
		})
	}

	webFS := http.FileServer(http.Dir("web"))

	staticFiles := []string{"/app.css", "/wasm.js", "/manifest.json"}
	r.With(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			for _, path := range staticFiles {
				if r.URL.Path == path || r.URL.Path == "/wasm/app.wasm" {
					noCache(webFS).ServeHTTP(w, r)
					return
				}
			}
			next.ServeHTTP(w, r)
		})
	}).Handle("/*", appHandler)

	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("Starting CNPG Admin server on %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
