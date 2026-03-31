apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: {{ .Values.cnpg.cluster.name }}
  namespace: {{ .Values.cnpg.cluster.namespace }}
spec:
  instances: {{ .Values.cnpg.cluster.replicaCount }}
  imageName: {{ .Values.cnpg.cluster.postgres.image }}
  postgresql:
    version: {{ .Values.cnpg.cluster.postgres.version }}
  storage:
    size: {{ .Values.cnpg.cluster.volume.capacity }}
    storageClass: {{ .Values.cnpg.cluster.volume.class }}
  serviceAccountName: {{ .Values.cnpg.cluster.name }}-sa
