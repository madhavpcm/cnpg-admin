apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ .Values.cnpg.cluster.name }}-sa
  namespace: {{ .Values.cnpg.cluster.namespace }}
