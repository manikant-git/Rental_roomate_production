# IMPLEMENTATION GUIDE — Rental Roommate Finder CI/CD
# Step-by-step: Where to Start, What to Setup, How to Run

---

## PHASE 0 — Tools You Must Install First (Local Machine)

Do this BEFORE touching any code or AWS.

```bash
# 1. Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install
aws --version   # should show aws-cli/2.x

# 2. Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
kubectl version --client

# 3. Install eksctl
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin
eksctl version

# 4. Install Docker
sudo apt-get update && sudo apt-get install -y docker.io
sudo usermod -aG docker $USER   # IMPORTANT: logout and login again after this
docker --version

# 5. Install Terraform (for infra setup)
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
sudo apt-get update && sudo apt-get install terraform
terraform --version

# 6. Install Node.js (for running services locally)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # should be v20.x
npm --version
```

---

## PHASE 1 — AWS Account Setup (Do This First, One Time)

### Step 1.1 — Configure AWS CLI
```bash
aws configure
# Enter:
# AWS Access Key ID: <your-key>
# AWS Secret Access Key: <your-secret>
# Default region: us-east-1
# Default output format: json

# Verify
aws sts get-caller-identity
# Should return your Account ID, UserID, ARN
```

### Step 1.2 — Create EKS Clusters (Staging + Production)
```bash
# STAGING cluster (takes 15-20 minutes)
eksctl create cluster \
  --name rental-staging-cluster \
  --region us-east-1 \
  --nodegroup-name staging-nodes \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 3 \
  --managed

# PRODUCTION cluster (takes 15-20 minutes)
eksctl create cluster \
  --name rental-prod-cluster \
  --region us-east-1 \
  --nodegroup-name prod-nodes \
  --node-type t3.large \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 5 \
  --managed

# Verify clusters are running
kubectl get nodes
eksctl get cluster --region us-east-1
```

### Step 1.3 — Setup GitHub OIDC Provider in AWS (Skip long-lived keys)
```bash
# Add GitHub as OIDC identity provider
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# Verify it was added
aws iam list-open-id-connect-providers
```

### Step 1.4 — Create IAM Roles for GitHub Actions

Create file `github-staging-trust.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::YOUR_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:manikant-git/Rental_roomate_production:ref:refs/heads/develop"
      }
    }
  }]
}
```

```bash
# Create staging role
aws iam create-role \
  --role-name github-staging-role \
  --assume-role-policy-document file://github-staging-trust.json

# Attach EKS permissions
aws iam attach-role-policy \
  --role-name github-staging-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonEKSClusterPolicy

aws iam attach-role-policy \
  --role-name github-staging-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy

# Get the Role ARN (you will paste this into GitHub Secrets)
aws iam get-role --role-name github-staging-role --query 'Role.Arn' --output text
# Example output: arn:aws:iam::123456789012:role/github-staging-role
```

Repeat same steps for `github-prod-role` but change branch to `refs/heads/main`.

---

## PHASE 2 — Docker Hub Setup

### Step 2.1 — Create Docker Hub Account
1. Go to https://hub.docker.com
2. Sign up / login
3. Your username is what goes into `DOCKERHUB_USERNAME` secret

### Step 2.2 — Create Access Token (NOT your password)
```
hub.docker.com → Click your avatar → Account Settings
→ Security → New Access Token
→ Name: github-actions-rentmate
→ Permission: Read, Write, Delete
→ COPY the token — it shows only ONCE
```

### Step 2.3 — Create Docker Hub Repositories
Create these repos on Docker Hub (they are public or private):
```
rentmate-auth-service
rentmate-listing-service
rentmate-roommate-service
rentmate-notification-service
rentmate-api-gateway
rentmate-frontend
```
Or they will be auto-created on first `docker push`.

---

## PHASE 3 — GitHub Repository Secrets Setup

Go to: **GitHub Repo → Settings → Secrets and variables → Actions → New repository secret**

Add these one by one:

| Secret Name | Value | How to get |
|---|---|---|
| `DOCKERHUB_USERNAME` | Your Docker Hub username | hub.docker.com login page |
| `DOCKERHUB_TOKEN` | Access Token from Docker Hub | Phase 2.2 above |
| `AWS_STAGING_ROLE_ARN` | `arn:aws:iam::ACCOUNT:role/github-staging-role` | Phase 1.4 output |
| `AWS_PROD_ROLE_ARN` | `arn:aws:iam::ACCOUNT:role/github-prod-role` | Phase 1.4 output |

---

## PHASE 4 — GitHub Environment Protection Setup

Go to: **Repo → Settings → Environments → New environment**

### Create `staging` environment:
- Name: `staging`
- Deployment branches: `develop` only
- No required reviewers (auto-deploy)

### Create `production` environment:
- Name: `production`
- Deployment branches: `main` only
- Required reviewers: Add yourself or team lead
- This means production won't deploy until someone manually approves in GitHub

---

## PHASE 5 — Kubernetes Manifests Setup (k8s folder)

Make sure `rental-roommate-finder/k8s/` folder has these files:

```
k8s/
├── namespace.yaml         # Create rentmate namespace
├── auth-deployment.yaml
├── listing-deployment.yaml
├── roommate-deployment.yaml
├── notification-deployment.yaml
├── api-gateway-deployment.yaml
├── frontend-deployment.yaml
└── services.yaml          # Service definitions (ClusterIP / LoadBalancer)
```

Example `auth-deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: rentmate
spec:
  replicas: 2
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      containers:
      - name: auth-service
        image: DOCKERHUB_USERNAME/rentmate-auth-service:staging
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "staging"
```

---

## PHASE 6 — Local Testing Before Pushing to CI/CD

### Step 6.1 — Test Docker builds locally
```bash
# Go to project root
cd rental-roommate-finder

# Build one service
docker build -t rentmate-auth-service:local ./backend/auth-service

# Run it
docker run -p 3001:3001 rentmate-auth-service:local

# Test it
curl http://localhost:3001/health
```

### Step 6.2 — Test all services with Docker Compose
```bash
docker compose up --build
# All services should start without errors
```

### Step 6.3 — Verify your kubeconfig works
```bash
aws eks update-kubeconfig --name rental-staging-cluster --region us-east-1
kubectl get nodes
kubectl get namespaces
```

---

## PHASE 7 — First Pipeline Run (The Right Way)

### Correct branch strategy:
```
main branch     → Production deploys  (cd-production.yml)
develop branch  → Staging deploys     (cd-staging.yml)
feature/* PRs   → PR validation runs  (pr-validation.yml + ci-testing.yml)
```

### First run checklist before pushing:
```
[ ] Docker Hub account created
[ ] DOCKERHUB_USERNAME secret added to GitHub
[ ] DOCKERHUB_TOKEN secret added to GitHub
[ ] AWS EKS staging cluster running (eksctl get cluster)
[ ] AWS EKS prod cluster running
[ ] AWS OIDC provider created in IAM
[ ] github-staging-role created with correct trust policy
[ ] github-prod-role created with correct trust policy
[ ] AWS_STAGING_ROLE_ARN secret added to GitHub
[ ] AWS_PROD_ROLE_ARN secret added to GitHub
[ ] k8s manifests exist in rental-roommate-finder/k8s/
[ ] Each service has a Dockerfile
[ ] staging environment created in GitHub
[ ] production environment created in GitHub
```

### Then push to trigger:
```bash
# Push to develop to trigger staging deployment
git checkout develop
git push origin develop

# Watch it run
# Go to GitHub → Actions tab → See CD - Staging Deploy running
```
