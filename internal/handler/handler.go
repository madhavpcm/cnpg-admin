package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/cnpg-admin/internal/k8s"
	"github.com/go-chi/chi/v5"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
)

var (
	clustersGVR = schema.GroupVersionResource{
		Group:    "postgresql.cnpg.io",
		Version:  "v1",
		Resource: "clusters",
	}
)

type APIHandler struct {
	k8sClient *k8s.Client
}

func NewAPIHandler(client *k8s.Client) *APIHandler {
	return &APIHandler{k8sClient: client}
}

func HealthCheck(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *APIHandler) ListClusters(w http.ResponseWriter, r *http.Request) {
	if h.k8sClient.Mock {
		mockClusters := []map[string]interface{}{
			{
				"metadata": map[string]interface{}{"name": "prod-db", "namespace": "default"},
				"spec": map[string]interface{}{
					"instances": 3,
					"imageName": "ghcr.io/cloudnative-pg/postgresql:16",
					"storage":   map[string]interface{}{"size": "50Gi"},
					"resources": map[string]interface{}{
						"requests": map[string]interface{}{"cpu": "2", "memory": "4Gi"},
						"limits":   map[string]interface{}{"cpu": "4", "memory": "8Gi"},
					},
				},
				"status": map[string]interface{}{"phase": "Cluster in healthy state", "readyInstances": 3},
			},
			{
				"metadata": map[string]interface{}{"name": "staging-db", "namespace": "staging"},
				"spec": map[string]interface{}{
					"instances": 1,
					"imageName": "ghcr.io/cloudnative-pg/postgresql:15",
					"storage":   map[string]interface{}{"size": "10Gi"},
					"resources": map[string]interface{}{
						"requests": map[string]interface{}{"cpu": "500m", "memory": "1Gi"},
						"limits":   map[string]interface{}{"cpu": "1", "memory": "2Gi"},
					},
				},
				"status": map[string]interface{}{"phase": "Unhealthy", "readyInstances": 0},
			},
			{
				"metadata": map[string]interface{}{"name": "analytics-db", "namespace": "analytics"},
				"spec": map[string]interface{}{
					"instances": 2,
					"imageName": "ghcr.io/cloudnative-pg/postgresql:14",
					"storage":   map[string]interface{}{"size": "100Gi"},
					"resources": map[string]interface{}{
						"requests": map[string]interface{}{"cpu": "4", "memory": "16Gi"},
						"limits":   map[string]interface{}{"cpu": "8", "memory": "32Gi"},
					},
				},
				"status": map[string]interface{}{"phase": "Cluster in healthy state", "readyInstances": 2},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockClusters)
		return
	}

	list, err := h.k8sClient.DynamicClient.Resource(clustersGVR).Namespace(h.k8sClient.Namespace).List(r.Context(), metav1.ListOptions{})
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to list clusters: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(list.Items)
}

func (h *APIHandler) CreateCluster(w http.ResponseWriter, r *http.Request) {
	if h.k8sClient.Mock {
		w.WriteHeader(http.StatusCreated)
		return
	}

	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	unstructuredCluster := &unstructured.Unstructured{Object: body}
	_, err := h.k8sClient.DynamicClient.Resource(clustersGVR).Namespace(h.k8sClient.Namespace).Create(r.Context(), unstructuredCluster, metav1.CreateOptions{})
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create cluster: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *APIHandler) GetCluster(w http.ResponseWriter, r *http.Request) {
	namespace := chi.URLParam(r, "namespace")
	name := chi.URLParam(r, "name")
	if h.k8sClient.Mock {
		mockCluster := map[string]interface{}{
			"metadata": map[string]interface{}{"name": name, "namespace": namespace},
			"spec": map[string]interface{}{
				"instances": 3,
				"imageName": "ghcr.io/cloudnative-pg/postgresql:16",
				"storage":   map[string]interface{}{"size": "20Gi"},
				"resources": map[string]interface{}{
					"requests": map[string]interface{}{"cpu": "1", "memory": "2Gi"},
					"limits":   map[string]interface{}{"cpu": "2", "memory": "4Gi"},
				},
			},
			"status": map[string]interface{}{"phase": "Cluster in healthy state", "readyInstances": 3},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockCluster)
		return
	}

	cluster, err := h.k8sClient.DynamicClient.Resource(clustersGVR).Namespace(namespace).Get(r.Context(), name, metav1.GetOptions{})
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get cluster: %v", err), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cluster)
}

func (h *APIHandler) UpdateCluster(w http.ResponseWriter, r *http.Request) {
	// TODO: Implement cluster update
}

func (h *APIHandler) DeleteCluster(w http.ResponseWriter, r *http.Request) {
	if h.k8sClient.Mock {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	namespace := chi.URLParam(r, "namespace")
	name := chi.URLParam(r, "name")
	err := h.k8sClient.DynamicClient.Resource(clustersGVR).Namespace(namespace).Delete(r.Context(), name, metav1.DeleteOptions{})
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to delete cluster: %v", err), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *APIHandler) ScaleCluster(w http.ResponseWriter, r *http.Request) {
	if h.k8sClient.Mock {
		w.WriteHeader(http.StatusOK)
		return
	}

	namespace := chi.URLParam(r, "namespace")
	name := chi.URLParam(r, "name")
	var body struct {
		Instances int `json:"instances"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	patch := []byte(fmt.Sprintf(`{"spec":{"instances":%d}}`, body.Instances))
	_, err := h.k8sClient.DynamicClient.Resource(clustersGVR).Namespace(namespace).Patch(r.Context(), name, types.MergePatchType, patch, metav1.PatchOptions{})
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to scale cluster: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (h *APIHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	if h.k8sClient.Mock {
		mockUsers := []map[string]interface{}{
			{"username": "admin", "role": "superuser", "created_at": "2024-03-20"},
			{"username": "app_user", "role": "readwrite", "created_at": "2024-03-21"},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockUsers)
		return
	}
}

func (h *APIHandler) CreateUser(w http.ResponseWriter, r *http.Request) {}

func (h *APIHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {}

func (h *APIHandler) ExecuteQuery(w http.ResponseWriter, r *http.Request) {
	if h.k8sClient.Mock {
		mockResults := []map[string]interface{}{
			{"id": 1, "name": "admin", "role": "superuser"},
			{"id": 2, "name": "app_user", "role": "readwrite"},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockResults)
		return
	}
}

func (h *APIHandler) ListTables(w http.ResponseWriter, r *http.Request) {
	if h.k8sClient.Mock {
		mockTables := []string{"users", "orders", "products", "inventory"}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(mockTables)
		return
	}
}

func (h *APIHandler) GetTableSchema(w http.ResponseWriter, r *http.Request) {}

func (h *APIHandler) GetMetrics(w http.ResponseWriter, r *http.Request) {}

func (h *APIHandler) GetLogs(w http.ResponseWriter, r *http.Request) {
	if h.k8sClient.Mock {
		mockLogs := "2024-03-29 01:50:14 INFO Initializing database...\n2024-03-29 01:50:15 INFO Database is ready for connections.\n2024-03-29 01:50:16 INFO Received connection from 10.0.0.5\n2024-03-29 01:50:17 DEBUG Executing query: SELECT * FROM users;"
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte(mockLogs))
		return
	}

	namespace := chi.URLParam(r, "namespace")
	name := chi.URLParam(r, "name")
	// For simplicity, we fetch logs from the first pod matching the cluster name label
	pods, err := h.k8sClient.Clientset.CoreV1().Pods(namespace).List(r.Context(), metav1.ListOptions{
		LabelSelector: fmt.Sprintf("cnpg.io/cluster=%s", name),
	})
	if err != nil || len(pods.Items) == 0 {
		http.Error(w, "No pods found for cluster", http.StatusNotFound)
		return
	}

	podName := pods.Items[0].Name
	logOptions := &corev1.PodLogOptions{
		Container: "postgres",
		TailLines: func(i int64) *int64 { return &i }(100),
	}

	req := h.k8sClient.Clientset.CoreV1().Pods(namespace).GetLogs(podName, logOptions)
	podLogs, err := req.Stream(r.Context())
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to get logs: %v", err), http.StatusInternalServerError)
		return
	}
	defer podLogs.Close()

	w.Header().Set("Content-Type", "text/plain")
	io.Copy(w, podLogs)
}

func (h *APIHandler) GetQueryAnalytics(w http.ResponseWriter, r *http.Request) {}

func (h *APIHandler) ListGitOpsRepos(w http.ResponseWriter, r *http.Request) {}

func (h *APIHandler) ConnectGitOpsRepo(w http.ResponseWriter, r *http.Request) {}

func (h *APIHandler) GetGitOpsClusters(w http.ResponseWriter, r *http.Request) {}

func (h *APIHandler) SyncGitOpsCluster(w http.ResponseWriter, r *http.Request) {}
