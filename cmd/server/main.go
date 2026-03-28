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

	app.Route("/", func() app.Composer { return &ui.Dashboard{} })
	app.Route("/clusters", func() app.Composer { return &ui.Clusters{} })
	app.Route("/clusters/new", func() app.Composer { return &ui.CreateCluster{} })
	app.Route("/clusters/:namespace/:name", func() app.Composer { return &ui.ClusterDetail{} })
	app.Route("/users", func() app.Composer { return &ui.Users{} })
	app.Route("/query", func() app.Composer { return &ui.Query{} })
	app.Route("/tables", func() app.Composer { return &ui.Tables{} })
	app.Route("/metrics", func() app.Composer { return &ui.Metrics{} })
	app.Route("/logs", func() app.Composer { return &ui.Logs{} })
	app.Route("/gitops", func() app.Composer { return &ui.GitOps{} })
	app.Route("/settings", func() app.Composer { return &ui.Settings{} })

	appHandler := &app.Handler{
		Name:        "CNPG Admin",
		Description: "CloudNativePG Admin Interface",
		Styles: []string{
			"/app.css",
			"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap",
		},
		Title: "CNPG Admin",
	}

	apiHandler := handler.NewAPIHandler(k8sClient)

	r := chi.NewRouter()
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)

	r.Route("/api", func(r chi.Router) {
		r.Use(middleware.Auth(cfg))
		r.Get("/health", handler.HealthCheck)
		r.Route("/clusters", func(r chi.Router) {
			r.Get("/", apiHandler.ListClusters)
			r.Post("/", apiHandler.CreateCluster)
			r.Route("/{namespace}/{name}", func(r chi.Router) {
				r.Get("/", apiHandler.GetCluster)
				r.Put("/", apiHandler.UpdateCluster)
				r.Delete("/", apiHandler.DeleteCluster)
				r.Post("/scale", apiHandler.ScaleCluster)
				r.Get("/users", apiHandler.ListUsers)
				r.Post("/query", apiHandler.ExecuteQuery)
				r.Get("/tables", apiHandler.ListTables)
				r.Get("/metrics", apiHandler.GetMetrics)
				r.Get("/logs", apiHandler.GetLogs)
			})
		})
	})

	// Static files handling that WORKED
	webFS := http.FileServer(http.Dir("web"))
	r.With(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Serve WASM and JS and CSS from web folder
			if r.URL.Path == "/app.css" || r.URL.Path == "/app.wasm" || r.URL.Path == "/wasm.js" || r.URL.Path == "/manifest.json" {
				webFS.ServeHTTP(w, r)
				return
			}
			// Special case for the long WASM path or redirects
			if r.URL.Path == "/web/app.wasm" {
				http.Redirect(w, r, "/app.wasm", http.StatusMovedPermanently)
				return
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
