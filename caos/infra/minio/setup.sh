#!/bin/bash
# MinIO bucket initialization script
# Run once after MinIO container is healthy

set -e

MC="mc"
ALIAS="caos"
ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
ACCESS_KEY="${MINIO_ROOT_USER:-caosadmin}"
SECRET_KEY="${MINIO_ROOT_PASSWORD:-caossecret}"

echo "Configuring MinIO alias..."
$MC alias set $ALIAS $ENDPOINT $ACCESS_KEY $SECRET_KEY

echo "Creating buckets..."
$MC mb --ignore-existing $ALIAS/caos-documents
$MC mb --ignore-existing $ALIAS/caos-models
$MC mb --ignore-existing $ALIAS/caos-audit-logs

echo "Setting bucket policies..."
# Documents bucket: private (no public access for MNPI compliance)
$MC anonymous set none $ALIAS/caos-documents
$MC anonymous set none $ALIAS/caos-models
$MC anonymous set none $ALIAS/caos-audit-logs

echo "MinIO setup complete."
