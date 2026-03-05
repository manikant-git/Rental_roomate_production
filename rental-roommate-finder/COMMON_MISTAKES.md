# COMMON MISTAKES — What Goes Wrong When People First Run This Project
# Real mistakes, real errors, real fixes

---

## CATEGORY 1 — Docker Mistakes (Most Common)

### MISTAKE #1: Using Docker Hub PASSWORD instead of ACCESS TOKEN
**What happens:**
```
Error: unauthorized: incorrect username or password
```
**Why it happens:** Docker Hub stopped accepting passwords in GitHub Actions since 2023. You MUST use an Access Token.

**Fix:**
```
hub.docker.com → Account Settings → Security → New Access Token
Paste that token into DOCKERHUB_TOKEN secret — NOT your login password
```

---

### MISTAKE #2: Docker build fails — "no such file or directory" for Dockerfile
**What happens:**
```
ERROR: failed to solve: failed to read dockerfile: open Dockerfile: no such file or directory
```
**Why it happens:** The CONTEXT path in the workflow is wrong, or service folder doesn't have a `Dockerfile`.

**Fix:**
```bash
# Verify Dockerfile exists in each service
ls rental-roommate-finder/backend/auth-service/Dockerfile
ls rental-roommate-finder/backend/listing-service/Dockerfile
ls rental-roommate-finder/frontend/Dockerfile

# Each service folder MUST have its own Dockerfile
```

---

### MISTAKE #3: Docker image pushed to wrong Docker Hub user
**What happens:** Image pushed as `manikant/rentmate-auth-service` but your username is `manikant-git`.

**Why it happens:** `DOCKERHUB_USERNAME` secret value has a typo or extra space.

**Fix:**
```bash
# Test locally first
docker login -u YOUR_DOCKERHUB_USERNAME
docker tag myimage:local YOUR_DOCKERHUB_USERNAME/rentmate-auth-service:test
docker push YOUR_DOCKERHUB_USERNAME/rentmate-auth-service:test
# If this works, your username is correct
```

---

### MISTAKE #4: `docker: permission denied` on GitHub Actions runner
**What happens:**
```
docker: permission denied while trying to connect to the Docker daemon socket
```
**Fix:** This rarely happens on GitHub-hosted runners (ubuntu-latest), but if using self-hosted:
```bash
sudo usermod -aG docker $USER
# Logout and login again
```

---

## CATEGORY 2 — AWS / EKS Mistakes

### MISTAKE #5: EKS cluster not found by GitHub Actions
**What happens:**
```
An error occurred (ResourceNotFoundException) when calling the DescribeCluster operation:
No cluster found for name: rental-staging-cluster
```
**Why it happens:** Cluster was created in `us-west-2` but workflow has `us-east-1`.

**Fix:**
```bash
# Check what region your cluster is in
eksctl get cluster --region us-east-1
eksctl get cluster --region us-west-2

# Then update the workflow yaml region to match
# aws-region: us-east-1   <--- make this match your actual region
```

---

### MISTAKE #6: OIDC AssumeRole fails
**What happens:**
```
Error: Could not assume role with OIDC: Not authorized to perform sts:AssumeRoleWithWebIdentity
```
**Why it happens (3 possible reasons):**
1. Trust policy has wrong branch name (e.g., `refs/heads/master` instead of `refs/heads/develop`)
2. Trust policy has wrong repo name (case-sensitive: `Rental_roomate_production` not `Rental_Roomate_Production`)
3. OIDC provider thumbprint is wrong or expired

**Fix:**
```bash
# Check your trust policy
aws iam get-role --role-name github-staging-role --query 'Role.AssumeRolePolicyDocument'

# The sub field must EXACTLY match:
# repo:manikant-git/Rental_roomate_production:ref:refs/heads/develop

# If wrong, update the trust policy:
aws iam update-assume-role-policy \
  --role-name github-staging-role \
  --policy-document file://github-staging-trust.json
```

---

### MISTAKE #7: kubectl commands fail — "no configuration has been provided"
**What happens:**
```
error: no configuration has been provided, try setting KUBERNETES_MASTER environment variable
```
**Why it happens:** `aws eks update-kubeconfig` step ran but the IAM role doesn't have permission to describe the cluster.

**Fix:**
```bash
# The IAM role needs this permission explicitly:
{
  "Effect": "Allow",
  "Action": [
    "eks:DescribeCluster",
    "eks:ListClusters"
  ],
  "Resource": "*"
}

# Add via AWS Console: IAM > Roles > github-staging-role > Add inline policy
```

---

### MISTAKE #8: kubectl apply works but pods don't start — ImagePullBackOff
**What happens:**
```
kubectl get pods
NAME                   READY   STATUS             RESTARTS
auth-service-xxx       0/1     ImagePullBackOff   0
```
**Why it happens:** EKS can't pull image from Docker Hub (private repo without imagePullSecret).

**Fix:**
```bash
# Option 1: Make Docker Hub repo PUBLIC (easiest for dev/staging)
hub.docker.com → your repo → Settings → Make Public

# Option 2: Create imagePullSecret in Kubernetes
kubectl create secret docker-registry dockerhub-cred \
  --docker-username=YOUR_DOCKERHUB_USERNAME \
  --docker-password=YOUR_DOCKERHUB_TOKEN \
  --docker-email=your@email.com \
  -n rentmate

# Then add to your deployment yaml:
# spec:
#   imagePullSecrets:
#   - name: dockerhub-cred
```

---

## CATEGORY 3 — GitHub Actions / Secrets Mistakes

### MISTAKE #9: Secret name typo in workflow vs GitHub settings
**What happens:** Pipeline runs but gets empty string for credentials.

**Why it happens:** Workflow says `secrets.DOCKER_HUB_TOKEN` but secret was added as `DOCKERHUB_TOKEN`.

**Fix:** Always copy-paste secret names exactly. Go to:
```
Repo → Settings → Secrets → Actions
# Check exact spelling of each secret name
# Compare with what's written in your .yml files
```

---

### MISTAKE #10: Workflow doesn't trigger at all
**What happens:** You push to `develop` but nothing runs in Actions tab.

**Why it happens (most common):**
1. You pushed directly to `main` instead of `develop`
2. The `paths` filter doesn't match your changed files
3. The workflow file itself has YAML syntax error

**Fix:**
```bash
# Check YAML syntax locally
npm install -g js-yaml
jsyaml rental-roommate-finder/.github/workflows/cd-staging.yml

# Or paste your yml into: https://yaml-online-parser.appspot.com/

# Check paths filter - if you change a file OUTSIDE these paths, it won't trigger:
# paths:
#   - 'rental-roommate-finder/backend/**'
#   - 'rental-roommate-finder/frontend/**'
```

---

### MISTAKE #11: Pipeline triggered on wrong branch — staging deploys to production accidentally
**Why it happens:** Someone commits directly to `main` without raising a PR from `develop`.

**Fix (Branch Protection Rules):**
```
Repo → Settings → Branches → Add branch protection rule

For `main` branch:
  [x] Require a pull request before merging
  [x] Require approvals (min 1)
  [x] Require status checks to pass (ci-testing)
  [x] Do not allow bypassing above settings
```

---

## CATEGORY 4 — Kubernetes Manifest Mistakes

### MISTAKE #12: Deployment name in manifest doesn't match kubectl set image command
**What happens:**
```
deployment.apps "auth-service" not found
```
**Why it happens:** k8s manifest has `name: auth-svc` but workflow runs `kubectl set image deployment/auth-service`.

**Fix:** Make sure deployment names in `k8s/*.yaml` EXACTLY match what's in the workflow loops:
```yaml
# In k8s/auth-deployment.yaml
metadata:
  name: auth-service    # <-- this must match

# In cd-staging.yml
for svc in auth-service listing-service ...  # <-- this must match
```

---

### MISTAKE #13: Namespace missing — pods not created
**What happens:**
```
Error from server (NotFound): namespaces "rentmate" not found
```
**Why it happens:** You defined `namespace: rentmate` in manifests but never created it.

**Fix:**
```bash
# Create namespace manually once
kubectl create namespace rentmate

# OR add namespace.yaml to your k8s folder:
cat > k8s/namespace.yaml <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: rentmate
EOF

# And apply it FIRST before other manifests in your workflow
kubectl apply -f rental-roommate-finder/k8s/namespace.yaml
kubectl apply -f rental-roommate-finder/k8s/
```

---

### MISTAKE #14: Services using wrong port / pods not connecting
**What happens:** Deployment runs fine but services can't talk to each other.

**Why it happens:** `containerPort` in deployment doesn't match `targetPort` in service.

**Fix:**
```yaml
# Deployment
containers:
- name: auth-service
  containerPort: 3001    # app runs on 3001

# Service - targetPort MUST match containerPort
spec:
  ports:
  - port: 80
    targetPort: 3001     # <-- must be same as containerPort
```

---

## CATEGORY 5 — Rollout / Rollback Mistakes

### MISTAKE #15: Rollout verify times out but pods are actually still starting
**What happens:**
```
error: timed out waiting for the condition
```
**Why it happens:** `--timeout=120s` is too short. Large images can take 3-5 minutes to pull.

**Fix:**
```yaml
# In cd-staging.yml and cd-production.yml
kubectl rollout status deployment/$svc --timeout=300s  # increase to 5 minutes
```

---

### MISTAKE #16: Rollback doesn't work because no previous version exists
**What happens:** First deployment fails and `kubectl rollout undo` has nothing to rollback to.

**Why it happens:** `rollout undo` needs at least 2 deployment revisions in history.

**Fix:** Always keep `revisionHistoryLimit` in your deployment:
```yaml
spec:
  revisionHistoryLimit: 5    # keep last 5 versions for rollback
  replicas: 2
```

---

## QUICK REFERENCE — Error to Fix Mapping

| Error Message | Root Cause | Fix |
|---|---|---|
| `unauthorized: incorrect username or password` | Wrong Docker Hub creds | Use Access Token not password |
| `no such file or directory` (Dockerfile) | Missing Dockerfile | Add Dockerfile to each service |
| `Could not assume role with OIDC` | Wrong trust policy | Fix branch name in IAM trust policy |
| `ImagePullBackOff` | Private Docker Hub repo | Make repo public or add imagePullSecret |
| `namespaces not found` | Namespace not created | kubectl create namespace rentmate |
| `deployment not found` | Name mismatch | Match k8s manifest names with workflow |
| `timed out waiting for condition` | Timeout too short | Increase --timeout=300s |
| Workflow not triggering | Pushed to wrong branch | Push to develop for staging |

---

## TOP 5 THINGS TO DO BEFORE FIRST PUSH

```
1. Run: docker build locally for each service - verify no errors
2. Run: aws sts get-caller-identity - verify AWS credentials work
3. Run: eksctl get cluster - verify cluster exists
4. Check: GitHub Secrets page - all 4 secrets are there with correct names
5. Check: k8s/ folder has all deployment yamls with correct image names
```

If all 5 pass, your first pipeline run will succeed.
