package ui

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/maxence-charriere/go-app/v10/pkg/app"
)

func RenderLayout(content app.UI) app.UI {
	return app.Div().Class("layout-container").Body(
		&Sidebar{},
		app.Main().Class("flex-1").Body(content),
	)
}

type Sidebar struct {
	app.Compo
}

func (s *Sidebar) Render() app.UI {
	return app.Div().Class("nav-sidebar").Body(
		app.Div().Class("mb-10").Body(
			app.H2().Text("CNPG Admin"),
		),
		app.Nav().Body(
			app.Ul().Class("list-none p-0").Body(
				&SidebarItem{Label: "Dashboard", Path: "/", Icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"},
				&SidebarItem{Label: "Clusters", Path: "/clusters", Icon: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73z"},
				&SidebarItem{Label: "GitOps", Path: "/gitops", Icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"},
				&SidebarItem{Label: "Settings", Path: "/settings", Icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"},
			),
		),
	)
}

type SidebarItem struct {
	app.Compo
	Label string
	Path  string
	Icon  string
}

func (si *SidebarItem) OnNav(ctx app.Context) {
	ctx.Update()
}

func (si *SidebarItem) Render() app.UI {
	active := ""
	if app.Window().URL().Path == si.Path {
		active = "active"
	}

	return app.Li().Body(
		app.A().
			Class("nav-item").
			Class(active).
			Href(si.Path).
			Body(
				app.Raw(fmt.Sprintf(`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="%s"></path></svg>`, si.Icon)),
				app.Span().Text(si.Label),
			),
	)
}

type Dashboard struct {
	app.Compo
	TotalClusters  int
	HealthyCount   int
	TotalInstances int
}

func (d *Dashboard) OnNav(ctx app.Context) { ctx.Update() }
func (d *Dashboard) OnMount(ctx app.Context) {
	d.loadStats(ctx)
}

func (d *Dashboard) loadStats(ctx app.Context) {
	ctx.Async(func() {
		resp, err := http.Get("/api/clusters")
		if err != nil {
			return
		}
		defer resp.Body.Close()

		var clusters []map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&clusters); err != nil {
			return
		}

		ctx.Dispatch(func(ctx app.Context) {
			d.TotalClusters = len(clusters)
			d.HealthyCount = 0
			d.TotalInstances = 0

			for _, c := range clusters {
				status, _ := c["status"].(map[string]interface{})
				if status != nil && status["phase"] == "Cluster in healthy state" {
					d.HealthyCount++
				}
				spec, _ := c["spec"].(map[string]interface{})
				if spec != nil {
					if instances, ok := spec["instances"].(float64); ok {
						d.TotalInstances += int(instances)
					}
				}
			}
		})
	})
}

func (d *Dashboard) Render() app.UI {
	return RenderLayout(app.Div().Class("dashboard").Body(
		app.H1().Class("mb-6").Text("Overview"),
		app.Div().Class("grid grid-3").Body(
			app.Div().Class("card stat-card").Body(
				app.Div().Class("flex items-center gap-4").Body(
					app.Raw(`
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
						`),
					app.Div().Body(
						app.Div().Class("stat-value").Text(fmt.Sprint(d.TotalClusters)),
						app.Div().Class("stat-label").Text("Total Clusters"),
					),
				),
			),
			app.Div().Class("card stat-card").Body(
				app.Div().Class("flex items-center gap-4").Body(
					app.Raw(`
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
						`),
					app.Div().Body(
						app.Div().Class("stat-value").Text(fmt.Sprint(d.HealthyCount)),
						app.Div().Class("stat-label").Text("Healthy Clusters"),
					),
				),
			),
			app.Div().Class("card stat-card").Body(
				app.Div().Class("flex items-center gap-4").Body(
					app.Raw(`
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
						`),
					app.Div().Body(
						app.Div().Class("stat-value").Text(fmt.Sprint(d.TotalInstances)),
						app.Div().Class("stat-label").Text("Total Instances"),
					),
				),
			),
		),
	))
}

type Clusters struct {
	app.Compo
	Clusters []ClusterInfo
	Loading  bool
	Error    string
}

func (c *Clusters) OnNav(ctx app.Context) { ctx.Update() }
func (c *Clusters) OnMount(ctx app.Context) {
	c.loadClusters(ctx)
}

func (c *Clusters) loadClusters(ctx app.Context) {
	ctx.Dispatch(func(ctx app.Context) {
		c.Loading = true
		c.Error = ""
	})

	ctx.Async(func() {
		resp, err := http.Get("/api/clusters")
		if err != nil {
			ctx.Dispatch(func(ctx app.Context) {
				c.Error = "Failed to connect to server"
				c.Loading = false
			})
			return
		}
		defer resp.Body.Close()

		var rawClusters []map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&rawClusters); err != nil {
			ctx.Dispatch(func(ctx app.Context) {
				c.Error = "Failed to parse data"
				c.Loading = false
			})
			return
		}

		clusters := make([]ClusterInfo, 0, len(rawClusters))
		for _, rc := range rawClusters {
			metadata := rc["metadata"].(map[string]interface{})
			spec := rc["spec"].(map[string]interface{})
			status, _ := rc["status"].(map[string]interface{})

			phase := "Unknown"
			ready := 0
			if status != nil {
				if p, ok := status["phase"].(string); ok {
					phase = p
				}
				if r, ok := status["readyInstances"].(float64); ok {
					ready = int(r)
				}
			}

			clusters = append(clusters, ClusterInfo{
				Name:      metadata["name"].(string),
				Namespace: metadata["namespace"].(string),
				Status:    phase,
				Instances: int(spec["instances"].(float64)),
				Ready:     ready,
			})
		}

		ctx.Dispatch(func(ctx app.Context) {
			c.Clusters = clusters
			c.Loading = false
		})
	})
}

func (c *Clusters) Render() app.UI {
	return RenderLayout(app.Div().Class("clusters-page").Body(
		app.Div().Class("flex justify-between items-center mb-10").Body(
			app.Div().Body(
				app.H1().Text("CNPG Clusters"),
				app.P().Class("text-gray-400 mt-1").Text("Manage your CloudNativePG database clusters"),
			),
			app.Button().Class("btn btn-primary").
				Body(
					app.Raw(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`),
					app.Text("Create New Cluster"),
				).
				OnClick(c.OnCreateCluster),
		),
		app.If(c.Error != "", func() app.UI {
			return app.Div().Class("error mb-4").Text(c.Error)
		}),
		app.If(c.Loading, func() app.UI {
			return app.Div().Class("loading").Body(
				app.P().Text("Fetching clusters from Kubernetes..."),
			)
		}).Else(func() app.UI {
			return app.Table().Body(
				app.THead().Body(
					app.Tr().Body(
						app.Th().Text("Name"),
						app.Th().Text("Namespace"),
						app.Th().Text("Instances"),
						app.Th().Text("Status"),
						app.Th().Text("Actions"),
					),
				),
				app.TBody().Body(
					app.Range(c.Clusters).Slice(func(i int) app.UI {
						cl := c.Clusters[i]
						statusClass := "badge badge-info"
						if cl.Status == "Cluster in healthy state" {
							statusClass = "badge badge-success"
						} else if cl.Status == "Unhealthy" {
							statusClass = "badge badge-warning"
						}

						return app.Tr().Body(
							app.Td().Body(
								app.A().Href("/clusters/"+cl.Namespace+"/"+cl.Name).
									Class("font-semibold text-blue-600 no-underline hover:underline").
									Text(cl.Name),
							),
							app.Td().Class("text-gray-500").Text(cl.Namespace),
							app.Td().Body(
								app.Span().Class("font-medium").Text(fmt.Sprint(cl.Ready)),
								app.Span().Class("text-gray-300 mx-1").Text("/"),
								app.Span().Class("text-gray-500").Text(fmt.Sprint(cl.Instances)),
							),
							app.Td().Body(
								app.Span().Class(statusClass).Text(cl.Status),
							),
							app.Td().Body(
								app.Button().Class("btn btn-outline btn-sm").
									Text("View Details").
									OnClick(func(ctx app.Context, e app.Event) {
										ctx.Navigate("/clusters/" + cl.Namespace + "/" + cl.Name)
									}),
							),
						)
					}),
				),
			)
		}),
	))
}

func (c *Clusters) OnCreateCluster(ctx app.Context, e app.Event) {
	ctx.Navigate("/clusters/new")
}

type ClusterInfo struct {
	Name      string
	Namespace string
	Status    string
	Instances int
	Ready     int
}

type CreateCluster struct {
	app.Compo
	Name        string
	Instances   int
	Storage     string
	PostgresVer string
	Error       string
	Submitting  bool
}

func (c *CreateCluster) OnInit() {
	c.Instances = 3
	c.Storage = "10Gi"
	c.PostgresVer = "16"
}

func (c *CreateCluster) OnSubmit(ctx app.Context, e app.Event) {
	c.Submitting = true
	c.Error = ""

	body := map[string]interface{}{
		"apiVersion": "postgresql.cnpg.io/v1",
		"kind":       "Cluster",
		"metadata": map[string]interface{}{
			"name": c.Name,
		},
		"spec": map[string]interface{}{
			"instances": c.Instances,
			"storage": map[string]interface{}{
				"size": c.Storage,
			},
			"imageName": fmt.Sprintf("ghcr.io/cloudnative-pg/postgresql:%s", c.PostgresVer),
		},
	}

	ctx.Async(func() {
		data, _ := json.Marshal(body)
		resp, _ := http.Post("/api/clusters", "application/json", strings.NewReader(string(data)))
		_ = resp

		ctx.Dispatch(func(ctx app.Context) {
			c.Submitting = false
			ctx.Navigate("/clusters")
		})
	})
}

func (c *CreateCluster) Render() app.UI {
	return RenderLayout(app.Div().Class("clusters-page").Body(
		app.H1().Class("mb-10").Text("Create New Database Cluster"),
		app.Div().Class("card").Body(
			app.Div().Class("form-group").Body(
				app.Label().Text("Cluster Name"),
				app.Input().Type("text").Placeholder("e.g. prod-db").OnInput(c.ValueTo(&c.Name)),
			),
			app.Div().Class("grid grid-2").Body(
				app.Div().Class("form-group").Body(
					app.Label().Text("PostgreSQL Version"),
					app.Select().Body(
						app.Option().Value("16").Text("PostgreSQL 16 (Latest)"),
						app.Option().Value("15").Text("PostgreSQL 15"),
						app.Option().Value("14").Text("PostgreSQL 14"),
					).OnChange(c.ValueTo(&c.PostgresVer)),
				),
				app.Div().Class("form-group").Body(
					app.Label().Text("Instances (Redundancy)"),
					app.Input().Type("number").Value(fmt.Sprint(c.Instances)).OnInput(func(ctx app.Context, e app.Event) {
						fmt.Sscanf(e.Get("target").Get("value").String(), "%d", &c.Instances)
					}),
				),
			),
			app.Div().Class("form-group").Body(
				app.Label().Text("Storage Size"),
				app.Input().Type("text").Value(c.Storage).OnInput(c.ValueTo(&c.Storage)),
			),
			app.Div().Class("flex justify-end gap-4 mt-6").Body(
				app.Button().Class("btn btn-secondary").Text("Cancel").OnClick(func(ctx app.Context, e app.Event) {
					ctx.Navigate("/clusters")
				}),
				app.Button().Class("btn btn-primary").Text("Provision Cluster").OnClick(c.OnSubmit).Disabled(c.Submitting),
			),
		),
	))
}

type ClusterDetail struct {
	app.Compo
	Name         string
	Namespace    string
	Cluster      map[string]interface{}
	Logs         string
	Users        []map[string]interface{}
	Tables       []string
	QueryText    string
	QueryResults []map[string]interface{}
	Loading      bool
	ActiveTab    string
}

func (c *ClusterDetail) OnNav(ctx app.Context) { ctx.Update() }
func (c *ClusterDetail) OnMount(ctx app.Context) {
	c.ActiveTab = "Overview"
	path := ctx.Page().URL().Path
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) >= 3 {
		c.Namespace = parts[1]
		c.Name = parts[2]
	}
	c.loadCluster(ctx)
}

func (c *ClusterDetail) loadCluster(ctx app.Context) {
	ctx.Dispatch(func(ctx app.Context) { c.Loading = true })
	ctx.Async(func() {
		resp, _ := http.Get("/api/clusters/" + c.Namespace + "/" + c.Name)
		if resp != nil {
			defer resp.Body.Close()
			json.NewDecoder(resp.Body).Decode(&c.Cluster)
		}
		ctx.Dispatch(func(ctx app.Context) { c.Loading = false })
		c.loadLogs(ctx)
		c.loadUsers(ctx)
		c.loadTables(ctx)
	})
}

func (c *ClusterDetail) loadLogs(ctx app.Context) {
	ctx.Async(func() {
		resp, _ := http.Get("/api/clusters/" + c.Namespace + "/" + c.Name + "/logs")
		if resp != nil {
			defer resp.Body.Close()
			logs, _ := io.ReadAll(resp.Body)
			ctx.Dispatch(func(ctx app.Context) { c.Logs = string(logs) })
		}
	})
}

func (c *ClusterDetail) loadUsers(ctx app.Context) {
	ctx.Async(func() {
		resp, _ := http.Get("/api/clusters/" + c.Namespace + "/" + c.Name + "/users")
		if resp != nil {
			defer resp.Body.Close()
			json.NewDecoder(resp.Body).Decode(&c.Users)
			ctx.Update()
		}
	})
}

func (c *ClusterDetail) loadTables(ctx app.Context) {
	ctx.Async(func() {
		resp, _ := http.Get("/api/clusters/" + c.Namespace + "/" + c.Name + "/tables")
		if resp != nil {
			defer resp.Body.Close()
			json.NewDecoder(resp.Body).Decode(&c.Tables)
			ctx.Update()
		}
	})
}

func (c *ClusterDetail) onExecuteQuery(ctx app.Context, e app.Event) {
	ctx.Async(func() {
		resp, _ := http.Post("/api/clusters/"+c.Namespace+"/"+c.Name+"/query", "application/json", strings.NewReader(c.QueryText))
		if resp != nil {
			defer resp.Body.Close()
			json.NewDecoder(resp.Body).Decode(&c.QueryResults)
			ctx.Update()
		}
	})
}

func (c *ClusterDetail) Render() app.UI {
	if c.Loading || c.Cluster == nil {
		return RenderLayout(app.Div().Class("loading").Text("Loading..."))
	}

	return RenderLayout(app.Div().Class("cluster-detail-page").Body(
		app.Div().Class("flex items-center gap-4 mb-10").Body(
			app.Button().Class("btn btn-outline btn-sm").Text("Back").OnClick(func(ctx app.Context, e app.Event) { ctx.Navigate("/clusters") }),
			app.H1().Text(c.Name),
			app.Span().Class("badge badge-success").Text("Online"),
		),
		app.Div().Class("flex gap-10").Body(
			// Sub-navigation sidebar
			app.Div().Class("w-64 flex-shrink-0").Body(
				app.Div().Class("flex flex-col gap-2").Body(
					c.subNavLink("Overview", "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"),
					c.subNavLink("Users", "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"),
					c.subNavLink("Query", "M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z"),
					c.subNavLink("Tables", "M3 3h18v18H3z M3 9h18 M3 15h18 M9 3v18 M15 3v18"),
					c.subNavLink("Metrics", "M18 20V10 M12 20V4 M6 20v-6"),
					c.subNavLink("Logs", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6"),
				),
			),
			// Content area
			app.Div().Class("flex-1").Body(
				app.If(c.ActiveTab == "Overview", func() app.UI { return c.renderOverview() }),
				app.If(c.ActiveTab == "Users", func() app.UI { return c.renderUsers() }),
				app.If(c.ActiveTab == "Query", func() app.UI { return c.renderQuery() }),
				app.If(c.ActiveTab == "Tables", func() app.UI { return c.renderTables() }),
				app.If(c.ActiveTab == "Metrics", func() app.UI { return c.renderMetrics() }),
				app.If(c.ActiveTab == "Logs", func() app.UI { return c.renderLogs() }),
			),
		),
	))
}

func (c *ClusterDetail) subNavLink(name, icon string) app.UI {
	activeClass := ""
	if c.ActiveTab == name {
		activeClass = "bg-blue-50 text-blue-600 font-bold border-r-4 border-blue-600"
	}
	return app.Button().
		Class("flex items-center gap-3 p-4 text-left rounded-l-lg transition-all hover:bg-gray-50").
		Class(activeClass).
		Body(
			app.Raw(fmt.Sprintf(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="%s"></path></svg>`, icon)),
			app.Span().Text(name),
		).
		OnClick(func(ctx app.Context, e app.Event) {
			c.ActiveTab = name
		})
}

func (c *ClusterDetail) renderMetrics() app.UI {
	return app.Div().Class("grid grid-2 gap-8").Body(
		app.Div().Class("card").Body(
			app.H2().Class("mb-4").Text("Throughput"),
			app.Div().Class("stat-value").Text("245 req/s"),
			app.P().Class("text-sm text-gray-400").Text("Requests per second"),
		),
		app.Div().Class("card").Body(
			app.H2().Class("mb-4").Text("Latency"),
			app.Div().Class("stat-value").Text("12ms"),
			app.P().Class("text-sm text-gray-400").Text("Average response time"),
		),
	)
}

func (c *ClusterDetail) tabButton(name string) app.UI {
	activeClass := ""
	if c.ActiveTab == name {
		activeClass = "active"
	}
	return app.Button().
		Class("tab-btn").
		Class(activeClass).
		Text(name).
		OnClick(func(ctx app.Context, e app.Event) {
			c.ActiveTab = name
		})
}

func (c *ClusterDetail) renderOverview() app.UI {
	spec, _ := c.Cluster["spec"].(map[string]interface{})
	status, _ := c.Cluster["status"].(map[string]interface{})
	res, _ := spec["resources"].(map[string]interface{})
	req, _ := res["requests"].(map[string]interface{})

	return app.Div().Class("grid grid-2 gap-8").Body(
		app.Div().Class("card").Body(
			app.H2().Class("mb-4").Text("Infrastructure"),
			app.Div().Class("form-group").Body(app.Label().Text("CPU (Requests)"), app.P().Text(fmt.Sprint(req["cpu"]))),
			app.Div().Class("form-group").Body(app.Label().Text("Memory (Requests)"), app.P().Text(fmt.Sprint(req["memory"]))),
			app.Div().Class("form-group").Body(app.Label().Text("Storage"), app.P().Text(fmt.Sprint(spec["storage"].(map[string]interface{})["size"]))),
		),
		app.Div().Class("card").Body(
			app.H2().Class("mb-4").Text("Health"),
			app.Div().Class("form-group").Body(app.Label().Text("Status"), app.Span().Class("badge badge-success").Text(fmt.Sprint(status["phase"]))),
			app.Div().Class("form-group").Body(app.Label().Text("Instances Ready"), app.P().Class("text-2xl font-bold").Text(fmt.Sprint(status["readyInstances"]))),
		),
	)
}

func (c *ClusterDetail) renderUsers() app.UI {
	return app.Div().Class("card").Body(
		app.Div().Class("flex justify-between items-center mb-6").Body(
			app.H2().Text("Database Users"),
			app.Button().Class("btn btn-primary").Text("Add User"),
		),
		app.Table().Body(
			app.THead().Body(app.Tr().Body(app.Th().Text("Username"), app.Th().Text("Role"), app.Th().Text("Created"))),
			app.TBody().Body(
				app.Range(c.Users).Slice(func(i int) app.UI {
					u := c.Users[i]
					return app.Tr().Body(
						app.Td().Text(fmt.Sprint(u["username"])),
						app.Td().Text(fmt.Sprint(u["role"])),
						app.Td().Text(fmt.Sprint(u["created_at"])),
					)
				}),
			),
		),
	)
}

func (c *ClusterDetail) renderQuery() app.UI {
	return app.Div().Class("card").Body(
		app.H2().Class("mb-4").Text("Query Executor"),
		app.Textarea().Class("query-editor w-full h-40").Placeholder("SELECT * FROM...").OnInput(c.ValueTo(&c.QueryText)),
		app.Button().Class("btn btn-primary mt-4").Text("Run Query").OnClick(c.onExecuteQuery),
		app.If(len(c.QueryResults) > 0, func() app.UI {
			return app.Div().Class("mt-8").Body(
				app.H3().Class("mb-4").Text("Results"),
				app.Div().Class("overflow-auto").Body(
					app.Table().Body(
						app.THead().Body(app.Tr().Body(app.Th().Text("ID"), app.Th().Text("Name"), app.Th().Text("Role"))),
						app.TBody().Body(
							app.Range(c.QueryResults).Slice(func(i int) app.UI {
								r := c.QueryResults[i]
								return app.Tr().Body(app.Td().Text(fmt.Sprint(r["id"])), app.Td().Text(fmt.Sprint(r["name"])), app.Td().Text(fmt.Sprint(r["role"])))
							}),
						),
					),
				),
			)
		}),
	)
}

func (c *ClusterDetail) renderTables() app.UI {
	return app.Div().Class("card").Body(
		app.H2().Class("mb-4").Text("Tables"),
		app.Ul().Class("list-none p-0").Body(
			app.Range(c.Tables).Slice(func(i int) app.UI {
				return app.Li().Class("p-3 border-b border-gray-100 flex justify-between").Body(
					app.Span().Text(c.Tables[i]),
					app.Button().Class("btn btn-outline btn-sm").Text("Preview"),
				)
			}),
		),
	)
}

func (c *ClusterDetail) renderLogs() app.UI {
	return app.Div().Class("card").Body(
		app.H2().Class("mb-4").Text("Logs"),
		app.Pre().Class("query-editor").Style("height", "400px").Text(c.Logs),
	)
}

type Users struct{ app.Compo }

func (u *Users) OnNav(ctx app.Context) { ctx.Update() }
func (u *Users) Render() app.UI        { return RenderLayout(app.H1().Text("Global Users")) }

type Query struct{ app.Compo }

func (q *Query) OnNav(ctx app.Context) { ctx.Update() }
func (q *Query) Render() app.UI        { return RenderLayout(app.H1().Text("Global Query")) }

type Tables struct{ app.Compo }

func (t *Tables) OnNav(ctx app.Context) { ctx.Update() }
func (t *Tables) Render() app.UI        { return RenderLayout(app.H1().Text("Global Tables")) }

type Metrics struct{ app.Compo }

func (m *Metrics) OnNav(ctx app.Context) { ctx.Update() }
func (m *Metrics) Render() app.UI        { return RenderLayout(app.H1().Text("Metrics")) }

type Logs struct{ app.Compo }

func (l *Logs) OnNav(ctx app.Context) { ctx.Update() }
func (l *Logs) Render() app.UI        { return RenderLayout(app.H1().Text("Global Logs")) }

type GitOps struct{ app.Compo }

func (g *GitOps) OnNav(ctx app.Context) { ctx.Update() }
func (g *GitOps) Render() app.UI        { return RenderLayout(app.H1().Text("GitOps")) }

type Settings struct{ app.Compo }

func (s *Settings) OnNav(ctx app.Context) { ctx.Update() }
func (s *Settings) Render() app.UI        { return RenderLayout(app.H1().Text("Settings")) }
