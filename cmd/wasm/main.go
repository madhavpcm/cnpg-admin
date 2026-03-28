//go:build js && wasm

package main

import (
	"log"
	"syscall/js"

	"github.com/cnpg-admin/internal/ui"
	"github.com/maxence-charriere/go-app/v10/pkg/app"
)

func main() {
	log.Println("CNPG Admin starting...")

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

	app.RunWhenOnBrowser()

	for {
		select {}
	}
}

func init() {
	js.Global().Set("newAPIClient", js.FuncOf(func(this js.Value, args []js.Value) interface{} {
		return map[string]interface{}{"baseURL": "/api"}
	}))
}
