apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: {{ .Values.cluster.name }}
  namespace: {{ .Values.cluster.namespace }}
spec:
  instances: {{ .Values.cluster.instances }}
  imageName: {{ .Values.cluster.postgresql.image }}
  postgresql:
    version: {{ .Values.cluster.postgresql.version }}
  storage:
    size: {{ .Values.cluster.storage.size }}
    storageClass: {{ .Values.cluster.storage.storageClass }}
