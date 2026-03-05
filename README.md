# RentMate: Production-Grade Rental & Roommate Finder

A high-availability, scalable microservices application designed for production environments. This project demonstrates modern DevOps practices, including automated CI/CD pipelines, Kubernetes orchestration, and cloud-native architecture.

## 🏗 Architecture Overview

The application follows a **Microservices Architecture** with a centralized API Gateway and dedicated services for core functionalities.

### Core Services
- **Frontend**: React-based user interface optimized for performance.
- **API Gateway**: Entry point for all client requests, handling routing and security.
- **Auth Service**: Manages user authentication, JWT issuance, and session security.
- **Listing Service**: Handles rental property listings, search, and filtering.
- **Roommate Service**: Manages roommate profiles and matching logic.
- **Notification Service**: Event-driven alerts via RabbitMQ/Kafka.

## 🚀 Production Infrastructure

### Kubernetes Orchestration
The app is deployed on Kubernetes (EKS/GKE) with the following production-grade features:
- **Ingress Controller (NGNIX)**: Handles SSL termination, rate limiting, and path-based routing.
- **Auto-Scaling**: Horizontal Pod Autoscaler (HPA) based on CPU/Memory metrics.
- **High Availability**: Multi-replica deployments with anti-affinity rules across availability zones.
- **Managed Databases**: Integration with production-grade PostgreSQL and Redis.

### CI/CD Pipeline
Fully automated workflows using **GitHub Actions**:
1. **Lint & Test**: Automated code quality checks and unit tests.
2. **Security Scanning**: Trivy scans for container vulnerabilities.
3. **Build & Push**: Docker images built and pushed to GHCR with unique SHA tags.
4. **Automated Deployment**: Blue-Green/Rolling deployments to Staging and Production environments.

## 🛠 Tech Stack
- **Backend**: Node.js, Express
- **Frontend**: React.js
- **Database**: PostgreSQL, Redis
- **Messaging**: RabbitMQ / Kafka
- **DevOps**: Docker, Kubernetes, GitHub Actions, Terraform
- **Monitoring**: Prometheus, Grafana

## 📦 Deployment Guide

### Prerequisites
- Kubernetes Cluster
- Helm & Kubectl
- NGINX Ingress Controller installed

### Steps
1. **Clone the repo**:
   ```bash
   git clone https://github.com/manikant-git/Rental_roomate_production.git
   ```
2. **Apply Configurations**:
   ```bash
   kubectl apply -f rental-roommate-finder/k8s/
   ```
3. **Configure DNS**:
   Point your domain to the Ingress LoadBalancer IP.

---
*Maintained by [manikant-git](https://github.com/manikant-git)*
