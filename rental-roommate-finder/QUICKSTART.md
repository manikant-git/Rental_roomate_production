# 🚀 Quick Fix Guide — Login/Registration Working in 5 Minutes

## What Was Wrong?

I found **8 critical bugs** causing login/registration to fail:

1. **DATABASE_URL** never injected → auth-service crashed on startup
2. **REDIS_URL** never injected → Redis connection failed
3. **RABBITMQ_URL** never injected → RabbitMQ connection failed
4. **init.sql never run** → No database tables exist
5. **Secrets had placeholder values**
6. **Frontend called localhost instead of real API**
7. **Docker image names were placeholders**
8. **Ingress domain was placeholder**

---

## ✅ Automated Fix (Recommended)

### Step 1: Pull Latest Code

```bash
cd ~/Rental_roomate_production
git pull origin main
cd rental-roommate-finder
```

### Step 2: Run The Auto-Fix Script

```bash
chmod +x scripts/fix-production-issues.sh
./scripts/fix-production-issues.sh
```

**This script will:**
- Inject DATABASE_URL, REDIS_URL, RABBITMQ_URL into all backend services
- Mount init.sql as ConfigMap into postgres
- Update Docker image references
- Create `scripts/create-secrets.sh` helper
- Create `DEPLOY.md` deployment guide

### Step 3: Update Your Docker Hub Username

```bash
# Replace 'yourusername' with your actual Docker Hub username
sed -i 's/${DOCKERHUB_USERNAME}/manikant-git/g' k8s/04-services.yaml
```

### Step 4: Commit and Push

```bash
git add -A
git commit -m "fix: apply all production deployment patches"
git push origin main
```

---

## 🛠️ Deploy to Production

### 1. Update kubeconfig

```bash
aws eks update-kubeconfig --name rental-prod-cluster --region us-east-1
```

### 2. Create Kubernetes Secrets

```bash
cd rental-roommate-finder
./scripts/create-secrets.sh
```

### 3. Deploy Infrastructure

```bash
kubectl apply -f k8s/00-namespace-configmap.yaml
kubectl apply -f k8s/02-postgres.yaml
kubectl apply -f k8s/03-infra-redis-rabbitmq-kafka.yaml

# Wait for Postgres, Redis, RabbitMQ to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n rental-app --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n rental-app --timeout=300s
kubectl wait --for=condition=ready pod -l app=rabbitmq -n rental-app --timeout=300s
```

### 4. Build and Push Docker Images

```bash
# Make sure you're logged into Docker Hub
docker login

# Build and push all services
for svc in auth-service listing-service roommate-service notification-service api-gateway; do
  docker build -t manikant-git/rentmate-$svc:latest rental-roommate-finder/backend/$svc
  docker push manikant-git/rentmate-$svc:latest
done

# Build frontend with correct API URL (replace with your domain)
docker build \
  --build-arg REACT_APP_API_URL=https://rentmate.yourdomain.com/api \
  -t manikant-git/rentmate-frontend:latest \
  rental-roommate-finder/frontend
docker push manikant-git/rentmate-frontend:latest
```

### 5. Deploy Services

```bash
kubectl apply -f k8s/04-services.yaml

# Watch pods come up
kubectl get pods -n rental-app -w
```

### 6. Deploy Ingress (Update domain first!)

```bash
# Edit k8s/05-ingress.yaml and replace 'rentmate.yourdomain.com' with your real domain
vim k8s/05-ingress.yaml

kubectl apply -f k8s/05-ingress.yaml
```

---

## 🔍 Verify Everything Works

### Check Auth Service Logs

```bash
kubectl logs deployment/auth-service -n rental-app
```

**You should see:**
```
PostgreSQL connected
Redis connected
RabbitMQ connected
Auth service running on port 3001
```

### Check Database Tables

```bash
kubectl exec -it deployment/postgres -n rental-app -- \
  psql -U rental_user -d rental_db -c "\dt"
```

**You should see:**
```
             List of relations
 Schema |        Name        | Type  |    Owner
--------+--------------------+-------+--------------
 public | amenities          | table | rental_user
 public | bookings           | table | rental_user
 public | listing_amenities  | table | rental_user
 public | listing_images     | table | rental_user
 public | listings           | table | rental_user
 public | notifications      | table | rental_user
 public | refresh_tokens     | table | rental_user
 public | reviews            | table | rental_user
 public | roommate_profiles  | table | rental_user
 public | roommate_requests  | table | rental_user
 public | saved_listings     | table | rental_user
 public | users              | table | rental_user
```

### Test Registration

1. Open browser DevTools → Network tab
2. Go to your app (via Ingress domain or LoadBalancer IP)
3. Try to register a new account
4. Check the Network request:
   - URL should be `https://yourdomain.com/api/auth/register` (NOT localhost)
   - Status should be `201 Created`
   - Response should have `{"user": {...}, "accessToken": "..."}`

### Test Login

1. Try to login with the account you just created
2. Should get `200 OK` with `accessToken` and `refreshToken`

---

## 🐞 Troubleshooting

### "502 Bad Gateway" on login/register

**Cause:** Auth service crashed on startup

**Fix:**
```bash
kubectl logs deployment/auth-service -n rental-app
# Look for errors about DATABASE_URL, REDIS_URL, or RABBITMQ_URL

# Verify env vars are injected:
kubectl exec -it deployment/auth-service -n rental-app -- env | grep -E '(DATABASE|REDIS|RABBITMQ)_URL'
```

### "relation 'users' does not exist"

**Cause:** init.sql was not run (postgres pod started without the init script)

**Fix:**
```bash
# Delete the PVC to force re-initialization
kubectl delete pvc postgres-pvc -n rental-app

# Redeploy postgres
kubectl delete deployment postgres -n rental-app
kubectl apply -f k8s/02-postgres.yaml

# Wait for it to come up
kubectl wait --for=condition=ready pod -l app=postgres -n rental-app --timeout=300s

# Verify tables exist
kubectl exec -it deployment/postgres -n rental-app -- psql -U rental_user -d rental_db -c "\dt"
```

### Frontend calls "localhost:3000" instead of real API

**Cause:** REACT_APP_API_URL not set at Docker build time

**Fix:**
```bash
# Rebuild frontend with correct URL
docker build \
  --build-arg REACT_APP_API_URL=https://yourapp.com/api \
  -t manikant-git/rentmate-frontend:latest \
  rental-roommate-finder/frontend

docker push manikant-git/rentmate-frontend:latest

# Force restart frontend pods
kubectl rollout restart deployment/frontend -n rental-app
```

### "NOAUTH Authentication required"

**Cause:** Redis password mismatch

**Fix:**
```bash
# Check Redis pod logs
kubectl logs deployment/redis -n rental-app

# Verify secret exists
kubectl get secret app-secrets -n rental-app -o yaml

# Verify REDIS_URL in auth-service
kubectl exec -it deployment/auth-service -n rental-app -- env | grep REDIS_URL
# Should be: redis://:SOME_PASSWORD@redis:6379
```

---

## 🎉 Success Checklist

- [ ] All pods running: `kubectl get pods -n rental-app`
- [ ] Auth service logs show "PostgreSQL connected", "Redis connected", "RabbitMQ connected"
- [ ] Database has 12 tables
- [ ] Registration returns 201 with accessToken
- [ ] Login returns 200 with accessToken
- [ ] Frontend calls correct domain (not localhost)

---

## 📝 Summary of What Changed

| File | Change |
|------|--------|
| `k8s/04-services.yaml` | Added DATABASE_URL, REDIS_URL, RABBITMQ_URL env vars to all backend services |
| `k8s/02-postgres.yaml` | Added init.sql ConfigMap mount to `/docker-entrypoint-initdb.d` |
| `k8s/04-services.yaml` | Changed image references from `your-registry/` to `manikant-git/rentmate-` |
| `scripts/create-secrets.sh` | Auto-generates strong secrets with `openssl rand` |
| `DEPLOY.md` | Complete deployment guide with troubleshooting |

---

## Need Help?

If login/registration still fails after following this guide:

1. Run: `kubectl get pods -n rental-app` — share the output
2. Run: `kubectl logs deployment/auth-service -n rental-app` — share the last 50 lines
3. Open browser DevTools → Network tab → try to register → screenshot the failed request

Then I can pinpoint the exact issue.
