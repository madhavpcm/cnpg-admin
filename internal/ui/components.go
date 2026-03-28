package ui

import (
	"github.com/maxence-charriere/go-app/v10/pkg/app"
)

type Dashboard struct {
	app.Compo
}

func (d *Dashboard) Render() app.UI {
	return app.Div().Class("dashboard").Body(
		app.H1().Text("Dashboard"),
		app.Div().Class("card").Body(
			app.P().Text("Welcome to CNPG Admin"),
		),
	)
}

type Clusters struct {
	app.Compo
	Clusters []Cluster
	Loading  bool
}

type Cluster struct {
	Name      string
	Namespace string
	Status    string
	Instances int
}

func (c *Clusters) OnMount(ctx app.Context) {
	c.Loading = true
	app.TryUpdate()
}

func (c *Clusters) Render() app.UI {
	return app.Div().Class("clusters-page").Body(
		app.H1().Text("Clusters"),
		app.Div().Class("card").Body(
			app.Button().Class("btn btn-primary").
				Text("Create Cluster").
				OnClick(c.OnCreateCluster),
		),
		app.If(c.Loading,
			func() app.UI { return app.P().Text("Loading...") },
		),
	)
}

func (c *Clusters) OnCreateCluster(ctx app.Context, e app.Event) {
	app.Window().Get("location").Set("hash", "#/clusters/new")
}

type ClusterDetail struct {
	app.Compo
	Name string
}

func (c *ClusterDetail) Render() app.UI {
	return app.Div().Class("cluster-detail").Body(
		app.H1().Text("Cluster: " + c.Name),
	)
}

type Users struct {
	app.Compo
}

func (u *Users) Render() app.UI {
	return app.Div().Class("users-page").Body(
		app.H1().Text("Users"),
		app.Div().Class("card").Body(
			app.Button().Class("btn btn-primary").Text("Create User"),
		),
	)
}

type Query struct {
	app.Compo
	Query   string
	Results [][]interface{}
}

func (q *Query) Render() app.UI {
	return app.Div().Class("query-page").Body(
		app.H1().Text("Query Executor"),
		app.Div().Class("card").Body(
			app.Textarea().Class("query-editor").
				Placeholder("SELECT * FROM...").
				OnInput(func(ctx app.Context, e app.Event) {
					q.Query = e.Get("target").Get("value").String()
				}),
			app.Br(),
			app.Button().Class("btn btn-primary").Text("Execute").OnClick(q.OnExecute),
		),
	)
}

func (q *Query) OnExecute(ctx app.Context, e app.Event) {
	_ = ctx
	_ = e
}

type Tables struct {
	app.Compo
}

func (t *Tables) Render() app.UI {
	return app.Div().Class("tables-page").Body(
		app.H1().Text("Tables"),
	)
}

type Metrics struct {
	app.Compo
}

func (m *Metrics) Render() app.UI {
	return app.Div().Class("metrics-page").Body(
		app.H1().Text("Metrics"),
	)
}

type Logs struct {
	app.Compo
}

func (l *Logs) Render() app.UI {
	return app.Div().Class("logs-page").Body(
		app.H1().Text("Logs"),
	)
}

type GitOps struct {
	app.Compo
	Repos []GitOpsRepo
}

type GitOpsRepo struct {
	ID     string
	URL    string
	Branch string
}

func (g *GitOps) Render() app.UI {
	return app.Div().Class("gitops-page").Body(
		app.H1().Text("GitOps"),
		app.Div().Class("card").Body(
			app.Button().Class("btn btn-primary").Text("Connect Repository"),
		),
	)
}
