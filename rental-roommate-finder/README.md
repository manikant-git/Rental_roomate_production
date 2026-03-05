# RentMate: Production Microservices Platform

RentMate is a production-grade, organisation-level rental and roommate matching platform. It is built using a cloud-native microservices architecture, automated infrastructure as code (Terraform), and a high-security CI/CD pipeline on AWS EKS.

---

## 🏗 1. Architecture Flow

### High-Level Traffic Flow
1. **User Request**: User accesses `rentmate.yourdomain.com` via browser.
2. **DNS & Networking**: Traffic hits **AWS Route 53**, which routes to an **AWS Application Load Balancer (ALB)** created by the EKS Ingress Controller.
3. **Ingress Layer**: The **NGINX Ingress Controller** terminates SSL (via cert-manager) and applies rate-limiting.
4. **Routing**:
   - Requests to `/` are served by the **Frontend (React)** pod.
   - Requests to `/api/*` are routed to the **API Gateway**.
5. **API Gateway**: Handles cross-cutting concerns (JWT verification, logging) and proxies requests to internal microservices.
6. **Microservices**: Services like `Auth`, `Listing`, and `Roommate` process business logic.
7. **Data Layer**: Services connect to a **Multi-AZ RDS PostgreSQL** for persistence and **ElasticCache Redis** for session caching.
8. **Asynchronous Tasks**: Events (like user signup) are published to **RabbitMQ**, which the **Notification Service** consumes to send emails.

---

## 🛠 2. Implementation details (How we built it)

- **Infrastructure (IaC)**: We used **Terraform Modules** to ensure consistency. A VPC with public/private subnets and NAT Gateways provides a secure network perimeter.
- **Kubernetes Orchestration**: Deployed on **AWS EKS**. We implemented **Horizontal Pod Autoscalers (HPA)** to scale based on traffic and **PodDisruptionBudgets** to ensure 99.9% availability during upgrades.
- **Security**:
  - **Zero-Trust**: K8s NetworkPolicies deny all traffic by default, allowing only specific microservice-to-microservice paths.
  - **IAM Roles for Service Accounts (IRSA)**: Pods assume IAM roles directly via OIDC, eliminating the need for hardcoded AWS keys.
  - **Secrets**: Replaced standard K8s secrets with **External Secrets Operator**, which auto-syncs encrypted values from **AWS Secrets Manager**.
- **CI/CD**: A 5-stage GitHub Actions pipeline that includes **Trivy Vulnerability Scanning** and **Automated Rollbacks** if a deployment fails health checks.

---

## 🚀 3. Getting Started: Step-by-Step

### Step 1: Prerequisites
You must have the following tools installed locally:
- [AWS CLI](https://aws.amazon.com/cli/) (configured with Admin permissions)
- [Terraform](https://www.terraform.io/downloads) (v1.5+)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [Helm](https://helm.sh/docs/intro/install/)

### Step 2: Provision Cloud Infrastructure
Deploy the VPC, EKS Cluster, and RDS Database.
```bash
cd rental-roommate-finder/terraform
terraform init
terraform apply -var="db_password=YOUR_SECURE_PASSWORD"
```
*Note: This will take ~15-20 minutes to provision the EKS cluster.*

### Step 3: Configure Kubernetes Cluster
Connect your local `kubectl` to the new cluster.
```bash
aws eks update-kubeconfig --name rental-prod-cluster --region us-east-1
```

### Step 4: Install Controller Prerequisites
Install the required operators via Helm:
```bash
# 1. Ingress Controller
helm install ingress-nginx ingress-nginx/ingress-nginx -n ingress-nginx --create-namespace

# 2. External Secrets Operator
helm install external-secrets external-secrets/external-secrets -n external-secrets --create-namespace
```

### Step 5: Deploy the Application
Apply the manifests in order to set up the namespace, networking, and services.
```bash
cd ../k8s
kubectl apply -f 00-namespace-configmap.yaml
kubectl apply -f 03-infra-redis-rabbitmq.yaml
kubectl apply -f 04-services.yaml
kubectl apply -f 05-ingress.yaml
kubectl apply -f 06-network-policy.yaml
kubectl apply -f 07-pdb-external-secrets.yaml
```

---

## 📈 4. End-to-End Production Checklist
- [ ] **Infrastructure**: VPC, EKS, RDS provisioned via Terraform.
- [ ] **Networking**: Ingress routing traffic to Frontend and Backend.
- [ ] **Security**: NetworkPolicies active; Secrets pulled from AWS SSM.
- [ ] **Scaling**: HPA configured for API Gateway and Listing Service.
- [ ] **Monitoring**: Prometheus/Grafana stack viewing EKS metrics.
- [ ] **Pipeline**: GitHub Secrets (`AWS_PROD_ROLE_ARN`, `SLACK_WEBHOOK`) configured.

---
*Developed for Organisation-level scaling by [manikant-git](https://github.com/manikant-git)*
