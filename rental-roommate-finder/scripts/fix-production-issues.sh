#!/bin/bash
# ================================================================
# AUTO-FIX SCRIPT FOR PRODUCTION DEPLOYMENT ISSUES
# ================================================================
# This script patches all k8s manifests to fix the 8 critical bugs
# causing login/registration failures.
#
# Run this ONCE after cloning the repo:
#   chmod +x scripts/fix-production-issues.sh
#   ./scripts/fix-production-issues.sh
# ================================================================

set -e

echo "🔧 Starting auto-fix for production deployment issues..."
echo ""

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.."
cd "$ROOT"

# ================================================================
# FIX 1-3: Inject DATABASE_URL, REDIS_URL, RABBITMQ_URL into auth-service
# ================================================================
echo "[1/7] Fixing auth-service environment variables..."

sed -i '/name: JWT_REFRESH_SECRET/a\      - name: POSTGRES_PASSWORD\n        valueFrom:\n          secretKeyRef:\n            name: app-secrets\n            key: POSTGRES_PASSWORD\n      - name: DATABASE_URL\n        value: "postgresql://rental_user:$(POSTGRES_PASSWORD)@postgres:5432/rental_db"\n      - name: REDIS_PASSWORD\n        valueFrom:\n          secretKeyRef:\n            name: app-secrets\n            key: REDIS_PASSWORD\n      - name: REDIS_URL\n        value: "redis://:$(REDIS_PASSWORD)@redis:6379"\n      - name: RABBITMQ_PASSWORD\n        valueFrom:\n          secretKeyRef:\n            name: app-secrets\n            key: RABBITMQ_PASSWORD\n      - name: RABBITMQ_URL\n        value: "amqp://rabbit_user:$(RABBITMQ_PASSWORD)@rabbitmq:5672"' k8s/04-services.yaml

echo "✅ Auth-service env vars fixed"

# ================================================================
# FIX 4: Inject same URLs into listing-service, roommate-service, notification-service
# ================================================================
echo "[2/7] Fixing listing/roommate/notification service env vars..."

for svc in "listing-service" "roommate-service" "notification-service"; do
  sed -i "/name: $svc/,/^---/s/name: JWT_SECRET/name: POSTGRES_PASSWORD\n        valueFrom:\n          secretKeyRef:\n            name: app-secrets\n            key: POSTGRES_PASSWORD\n      - name: DATABASE_URL\n        value: \"postgresql:\/\/rental_user:\$(POSTGRES_PASSWORD)@postgres:5432\/rental_db\"\n      - name: REDIS_PASSWORD\n        valueFrom:\n          secretKeyRef:\n            name: app-secrets\n            key: REDIS_PASSWORD\n      - name: REDIS_URL\n        value: \"redis:\/\/:\$(REDIS_PASSWORD)@redis:6379\"\n      - name: RABBITMQ_PASSWORD\n        valueFrom:\n          secretKeyRef:\n            name: app-secrets\n            key: RABBITMQ_PASSWORD\n      - name: RABBITMQ_URL\n        value: \"amqp:\/\/rabbit_user:\$(RABBITMQ_PASSWORD)@rabbitmq:5672\"\n      - name: JWT_SECRET/" k8s/04-services.yaml
done

echo "✅ All backend services env vars fixed"

# ================================================================
# FIX 5: Mount init.sql into postgres pod
# ================================================================
echo "[3/7] Fixing postgres init.sql mount..."

cat >> k8s/02-postgres.yaml <<'EOF'

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-init-sql
  namespace: rental-app
data:
  init.sql: |
EOF

sed 's/^/    /' scripts/init.sql >> k8s/02-postgres.yaml

sed -i '/volumeMounts:/a\          - name: init-sql\n            mountPath: /docker-entrypoint-initdb.d' k8s/02-postgres.yaml
sed -i '/volumes:/a\        - name: init-sql\n          configMap:\n            name: postgres-init-sql' k8s/02-postgres.yaml

echo "✅ Postgres init.sql ConfigMap created and mounted"

# ================================================================
# FIX 6: Update image names from placeholders to DockerHub
# ================================================================
echo "[4/7] Updating Docker image references to use DockerHub..."

sed -i 's|image: your-registry/|image: ${DOCKERHUB_USERNAME:-yourusername}/rentmate-|g' k8s/04-services.yaml

echo "✅ Image names updated (replace \${DOCKERHUB_USERNAME} with your Docker Hub username)"

# ================================================================
# FIX 7: Create a proper secrets template
# ================================================================
echo "[5/7] Creating secrets setup script..."

cat > scripts/create-secrets.sh <<'EOF'
#!/bin/bash
# Run this to create production secrets in your EKS cluster
# DO NOT commit the filled values to Git!

set -e

echo "Creating Kubernetes secrets for rental-app..."

kubectl create namespace rental-app --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic app-secrets \
  --namespace=rental-app \
  --from-literal=JWT_SECRET="$(openssl rand -base64 32)" \
  --from-literal=JWT_REFRESH_SECRET="$(openssl rand -base64 32)" \
  --from-literal=POSTGRES_PASSWORD="$(openssl rand -base64 16)" \
  --from-literal=REDIS_PASSWORD="$(openssl rand -base64 16)" \
  --from-literal=RABBITMQ_PASSWORD="$(openssl rand -base64 16)" \
  --from-literal=SMTP_USER="" \
  --from-literal=SMTP_PASS="" \
  --from-literal=AWS_ACCESS_KEY_ID="" \
  --from-literal=AWS_SECRET_ACCESS_KEY="" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "✅ Secrets created successfully!"
EOF

chmod +x scripts/create-secrets.sh

echo "✅ Secrets setup script created at scripts/create-secrets.sh"

# ================================================================
# FIX 8: Add deployment instructions
# ================================================================
echo "[6/7] Creating deployment guide..."

cat > DEPLOY.md <<'EOF'
# 🚀 Production Deployment Guide

## Prerequisites
1. EKS cluster running
2. kubectl configured
3. Docker Hub account
4. Images pushed to Docker Hub

## Step-by-Step Deployment

### 1. Create Secrets
```bash
cd rental-roommate-finder
./scripts/create-secrets.sh
```

### 2. Deploy Infrastructure (Postgres, Redis, RabbitMQ, Kafka)
```bash
kubectl apply -f k8s/00-namespace-configmap.yaml
kubectl apply -f k8s/02-postgres.yaml
kubectl apply -f k8s/03-infra-redis-rabbitmq-kafka.yaml
```

### 3. Wait for infrastructure to be ready
```bash
kubectl wait --for=condition=ready pod -l app=postgres -n rental-app --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n rental-app --timeout=300s
kubectl wait --for=condition=ready pod -l app=rabbitmq -n rental-app --timeout=300s
```

### 4. Deploy Services
```bash
# Replace ${DOCKERHUB_USERNAME} with your Docker Hub username in k8s/04-services.yaml first!
sed -i 's/${DOCKERHUB_USERNAME}/your-actual-username/g' k8s/04-services.yaml

kubectl apply -f k8s/04-services.yaml
```

### 5. Deploy Ingress
```bash
# Update your domain in k8s/05-ingress.yaml first!
kubectl apply -f k8s/05-ingress.yaml
```

### 6. Verify Deployment
```bash
kubectl get pods -n rental-app
kubectl logs -f deployment/auth-service -n rental-app
kubectl logs -f deployment/api-gateway -n rental-app
```

## Troubleshooting

### Login/Registration still failing?

1. **Check auth-service logs**:
   ```bash
   kubectl logs deployment/auth-service -n rental-app
   ```
   Look for:
   - "PostgreSQL connected"
   - "Redis connected"
   - "RabbitMQ connected"

2. **Check if DATABASE_URL is set**:
   ```bash
   kubectl exec -it deployment/auth-service -n rental-app -- env | grep DATABASE_URL
   ```

3. **Verify database tables exist**:
   ```bash
   kubectl exec -it deployment/postgres -n rental-app -- psql -U rental_user -d rental_db -c "\dt"
   ```
   You should see tables: users, refresh_tokens, listings, etc.

4. **Check frontend can reach API**:
   - Open browser DevTools → Network tab
   - Try to register
   - Check the request URL (should hit your domain/api/auth/register, not localhost)

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| 502 Bad Gateway | Auth service crashed on startup | Check logs: `kubectl logs deployment/auth-service -n rental-app` |
| "relation users does not exist" | init.sql not run | Delete postgres PVC and redeploy: `kubectl delete pvc postgres-pvc -n rental-app` |
| CORS errors | Frontend calling localhost | Rebuild frontend with correct REACT_APP_API_URL |
| "Invalid credentials" on correct password | Database empty | Check if init.sql ran successfully |

EOF

echo "✅ Deployment guide created: DEPLOY.md"

# ================================================================
# DONE
# ================================================================
echo ""
echo "🎉 All fixes applied successfully!"
echo ""
echo "Next steps:"
echo "  1. Review the changes: git diff"
echo "  2. Commit and push: git add -A && git commit -m 'fix: resolve production deployment issues' && git push"
echo "  3. Follow DEPLOY.md for deployment instructions"
echo ""
