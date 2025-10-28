{{/*
Expand the name of the chart.
*/}}
{{- define "kraken.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "kraken.fullname" -}}
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
{{- define "kraken.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "kraken.labels" -}}
helm.sh/chart: {{ include "kraken.chart" . }}
{{ include "kraken.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "kraken.selectorLabels" -}}
app.kubernetes.io/name: {{ include "kraken.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Backend labels
*/}}
{{- define "kraken.backend.labels" -}}
{{ include "kraken.labels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Backend selector labels
*/}}
{{- define "kraken.backend.selectorLabels" -}}
{{ include "kraken.selectorLabels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Frontend labels
*/}}
{{- define "kraken.frontend.labels" -}}
{{ include "kraken.labels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Frontend selector labels
*/}}
{{- define "kraken.frontend.selectorLabels" -}}
{{ include "kraken.selectorLabels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "kraken.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "kraken.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
MongoDB URI - either from bundled or external
*/}}
{{- define "kraken.mongodb.uri" -}}
{{- if .Values.mongodb.bundled }}
{{- $fullname := include "kraken.fullname" . }}
{{- $user := .Values.mongodb.auth.username }}
{{- $pass := .Values.mongodb.auth.password }}
{{- $db := .Values.mongodb.auth.database }}
{{- $rsName := .Values.mongodb.replicaSetName }}
{{- printf "mongodb://%s:%s@%s-mongodb:27017/%s?replicaSet=%s&retryWrites=true&w=majority" $user $pass $fullname $db $rsName }}
{{- else }}
{{- .Values.mongodb.external.uri }}
{{- end }}
{{- end }}

{{/*
Redis host - either from bundled or external
*/}}
{{- define "kraken.redis.host" -}}
{{- if .Values.redis.bundled }}
{{- printf "%s-redis-master" (include "kraken.fullname" .) }}
{{- else }}
{{- .Values.redis.external.host }}
{{- end }}
{{- end }}

{{/*
Redis port - either from bundled or external
*/}}
{{- define "kraken.redis.port" -}}
{{- if .Values.redis.bundled }}
{{- print "6379" }}
{{- else }}
{{- .Values.redis.external.port | toString }}
{{- end }}
{{- end }}

{{/*
Redis password - either from bundled or external
*/}}
{{- define "kraken.redis.password" -}}
{{- if .Values.redis.bundled }}
{{- .Values.redis.auth.password }}
{{- else }}
{{- .Values.redis.external.password }}
{{- end }}
{{- end }}

{{/*
Image pull secrets
*/}}
{{- define "kraken.imagePullSecrets" -}}
{{- if .Values.global.imagePullSecrets }}
imagePullSecrets:
{{- range .Values.global.imagePullSecrets }}
  - name: {{ . }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Backend image
*/}}
{{- define "kraken.backend.image" -}}
{{- $registry := .Values.global.imageRegistry | default "" }}
{{- $repository := .Values.backend.image.repository }}
{{- $tag := .Values.backend.image.tag | default .Chart.AppVersion }}
{{- if $registry }}
{{- printf "%s/%s:%s" $registry $repository $tag }}
{{- else }}
{{- printf "%s:%s" $repository $tag }}
{{- end }}
{{- end }}

{{/*
Frontend image
*/}}
{{- define "kraken.frontend.image" -}}
{{- $registry := .Values.global.imageRegistry | default "" }}
{{- $repository := .Values.frontend.image.repository }}
{{- $tag := .Values.frontend.image.tag | default .Chart.AppVersion }}
{{- if $registry }}
{{- printf "%s/%s:%s" $registry $repository $tag }}
{{- else }}
{{- printf "%s:%s" $repository $tag }}
{{- end }}
{{- end }}
