{{/*
Expand the name of the chart.
*/}}
{{- define "process-gpt.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "process-gpt.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "process-gpt.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "process-gpt.labels" -}}
helm.sh/chart: {{ include "process-gpt.chart" . }}
{{ include "process-gpt.selectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "process-gpt.selectorLabels" -}}
app.kubernetes.io/name: {{ include "process-gpt.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Supabase internal URL (Kong API gateway)
*/}}
{{- define "process-gpt.supabaseInternalUrl" -}}
{{- printf "http://%s-supabase-kong:8000" .Release.Name }}
{{- end }}

{{/*
Postgres host
*/}}
{{- define "process-gpt.postgresHost" -}}
{{- if .Values.global.database.host }}
{{- .Values.global.database.host }}
{{- else }}
{{- printf "%s-supabase-db" .Release.Name }}
{{- end }}
{{- end }}
