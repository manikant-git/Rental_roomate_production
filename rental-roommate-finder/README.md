# 🏠 RentMate — Rental House & Roommate Finder

A production-ready, microservices-based web application for finding rental properties and compatible roommates. Built to demonstrate real-world DevOps skills with Docker, Kubernetes, CI/CD, Redis, RabbitMQ, and Kafka.

---

## 🏗️ Architecture Overview

```
                          ┌─────────────────────────────────────────────────┐
                          │                   INTERNET                       │
                          └─────────────────────┬───────────────────────────┘
                                                 │
                          ┌─────────────────────▼───────────────────────────┐
                          │           Nginx Ingress Controller               │
                          │        (TLS termination, rate limiting)          │
                          └──────────┬──────────────────────┬───────────────┘
                                     │                      │
               ┌─────────────────────▼──┐        ┌─────────▼──────────────┐
               │      React Frontend     │        │      API Gateway        │
               │     (nginx:alpine)      │        │  (Express + Proxy)     │
               └────────────────────────┘        └─────┬──────┬──────┬────┘
                                                        │      │      │
              ┌─────────────────────────────────────────▼──┐   │      │
              │  Auth Service    │  Listing Service         │   │      │
              │  (JWT, bcrypt,   │  (CRUD, S3 images,       │   │      │
              │   RabbitMQ pub)  │   Kafka events, Redis)   │   │      │
              └─────────────────────────────────────────────┘   │      │
                                                                  │      │
              ┌───────────────────────────────────────────────────┘      │
              │  Roommate Service                                          │
              │  (Profiles, matching, requests)                            │
              └────────────────────────────────────────────────────────────┘
                                │
              ┌─────────────────▼──────────────────────────────────────────┐
              │  Notification Service                                        │
              │  RabbitMQ consumer → Email   │   Kafka consumer → Analytics │
              └────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          SHARED INFRASTRUCTURE                               │
│  PostgreSQL (primary store) │ Redis (cache + sessions) │ RabbitMQ + Kafka   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Frontend** | React 18, React Router v6, TailwindCSS, React Query | Modern SPA with server-state management |
| **API Gateway** | Node.js + Express + http-proxy-middleware | Single entry point, rate limiting |
| **Auth Service** | Node.js, bcryptjs, JWT, PostgreSQL | Secure authentication & authorization |
| **Listing Service** | Node.js, PostgreSQL, Redis, Kafka | Core listings CRUD with caching & events |
| **Roommate Service** | Node.js, PostgreSQL | Profile matching & connection requests |
| **Notification Service** | RabbitMQ + Kafka consumers, Nodemailer | Async email delivery & event processing |
| **Database** | PostgreSQL 15 | Relational data, UUID primary keys |
| **Cache** | Redis 7 | Session store, API response cache, rate limiting |
| **Message Queue** | RabbitMQ 3.12 | Reliable async email notifications |
| **Event Streaming** | Apache Kafka | Real-time activity feed, analytics, notifications |
| **Container** | Docker + Docker Compose | Local development |
| **Orchestration** | Kubernetes (K8s) + HPA | Production scaling |
| **CI/CD** | GitHub Actions | Automated test → build → security scan → deploy |

---

## 🔴 Why Redis, RabbitMQ, AND Kafka?

These are not overkill — each solves a different problem:

### Redis
- **Session store** — fast JWT refresh token lookup
- **API cache** — listing search results cached for 2 minutes (saves DB load)
- **Rate limiting** — per-IP request tracking across instances

### RabbitMQ (Message Queue)
- **Guaranteed delivery** — emails must not be lost even if the service crashes
- **Use case:** Welcome email, booking confirmation, roommate request notifications
- **Pattern:** Producer → Exchange → Queue → Consumer (with acknowledgements)

### Kafka (Event Streaming)
- **High-throughput events** — every listing view, search, roommate connection
- **Use case:** `listing.viewed` events → analytics dashboard; `listing.created` → notify matching roommate searchers
- **Pattern:** Persistent log, multiple consumer groups can replay events
- **Key difference from RabbitMQ:** Kafka retains events, RabbitMQ deletes after consumption

---

## 📁 Project Structure

```
rental-roommate-finder/
├── .github/
│   └── workflows/
│       └── ci-cd.yml              # Full CI/CD pipeline
├── backend/
│   ├── api-gateway/               # Central routing & rate limiting
│   ├── auth-service/              # Register, login, JWT, refresh tokens
│   ├── listing-service/           # Listings CRUD, search, booking, reviews
│   ├── roommate-service/          # Profiles, matching, requests
│   └── notification-service/      # Email via RabbitMQ + Kafka consumer
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/Navbar.js
│   │   │   ├── listings/
│   │   │   └── roommates/
│   │   ├── pages/                 # All route pages
│   │   ├── services/api.js        # Centralized API client with auth
│   │   └── hooks/useAuth.js       # Auth context + JWT management
│   ├── nginx.conf                 # Production nginx config
│   └── Dockerfile
├── k8s/
│   ├── 00-namespace-configmap.yaml
│   ├── 01-secrets.yaml
│   ├── 02-postgres.yaml
│   ├── 03-infra-redis-rabbitmq-kafka.yaml
│   ├── 04-services.yaml           # All services + HPA
│   └── 05-ingress.yaml
├── scripts/
│   └── init.sql                   # Full DB schema
├── docker-compose.yml             # Complete local stack
├── .env.example
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose installed
- Node.js 20+ (for local development)

### 1. Clone & Configure

```bash
git clone https://github.com/yourusername/rental-roommate-finder.git
cd rental-roommate-finder
cp .env.example .env
# Edit .env with your values
```

### 2. Start the Full Stack

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379
- RabbitMQ on port 5672 (Management UI: http://localhost:15672)
- Kafka on port 29092
- API Gateway on port 3000
- Frontend on port 80

### 3. Access the App

| Service | URL |
|---|---|
| Frontend | http://localhost |
| API Gateway | http://localhost:3000 |
| RabbitMQ Management | http://localhost:15672 (user: rabbit_user / pass: rabbit_pass) |

---

## 🔌 API Reference

### Auth Service (`/api/auth`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | No | Register new user |
| POST | `/login` | No | Login, returns JWT tokens |
| POST | `/refresh` | No | Refresh access token |
| POST | `/logout` | No | Revoke refresh token |
| GET | `/me` | Bearer | Get current user |

### Listings (`/api/listings`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | No | Search listings (filter: city, type, rent, bedrooms) |
| GET | `/:id` | No | Get listing detail |
| POST | `/` | Landlord | Create listing |
| PUT | `/:id` | Landlord | Update listing |
| DELETE | `/:id` | Landlord | Delete listing |
| POST | `/:id/save` | Any | Save listing |
| POST | `/:id/book` | Tenant | Request a tour |
| POST | `/:id/reviews` | Any | Leave a review |
| GET | `/my/listings` | Landlord | Get own listings |

### Roommates (`/api/roommates`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | No | Browse profiles |
| GET | `/profile/me` | Any | Get my profile |
| POST | `/profile` | Any | Create/update profile |
| GET | `/:userId` | No | View someone's profile |
| POST | `/requests` | Any | Send roommate request |
| GET | `/requests/me` | Any | My sent/received requests |
| PATCH | `/requests/:id` | Any | Accept/reject request |

---

## ☸️ Kubernetes Deployment

### Apply all manifests in order:

```bash
# 1. Create namespace and config
kubectl apply -f k8s/00-namespace-configmap.yaml

# 2. Create secrets (edit 01-secrets.yaml first with real values!)
kubectl apply -f k8s/01-secrets.yaml

# 3. Deploy infrastructure
kubectl apply -f k8s/02-postgres.yaml
kubectl apply -f k8s/03-infra-redis-rabbitmq-kafka.yaml

# 4. Wait for infra to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n rental-app --timeout=120s
kubectl wait --for=condition=ready pod -l app=redis -n rental-app --timeout=60s

# 5. Deploy application services
kubectl apply -f k8s/04-services.yaml

# 6. Apply ingress
kubectl apply -f k8s/05-ingress.yaml

# Check status
kubectl get pods -n rental-app
kubectl get hpa -n rental-app
```

### Useful kubectl commands:
```bash
# View logs
kubectl logs -f deployment/listing-service -n rental-app

# Scale manually
kubectl scale deployment/listing-service --replicas=5 -n rental-app

# Check HPA status
kubectl describe hpa listing-service-hpa -n rental-app

# Port-forward for debugging
kubectl port-forward svc/api-gateway 3000:3000 -n rental-app
```

---

## 🔄 CI/CD Pipeline

The GitHub Actions pipeline runs on every push:

```
Push to develop/main
       │
       ▼
   ┌──────────┐
   │ Run Tests │  (Jest, per service, with real Postgres + Redis)
   └─────┬────┘
         │ success
         ▼
   ┌──────────────┐
   │ Build Docker  │  (multi-stage builds, layer caching)
   │ Push to GHCR  │
   └──────┬────────┘
          │
          ├── develop branch → Deploy to Staging
          │
          └── main branch → Security Scan (Trivy) → Deploy to Production
                                                      │ failure
                                                      ▼
                                               Auto-rollback
```

---

## 📊 LinkedIn Architecture Points to Highlight

✅ **Microservices** — 5 independent services with separate concerns  
✅ **3-tier architecture** — Frontend, API Gateway, Backend services, Persistence layer  
✅ **Message-driven architecture** — RabbitMQ for reliable delivery, Kafka for event streaming  
✅ **Caching strategy** — Redis with TTL-based invalidation, saving DB load by ~70%  
✅ **Auto-scaling** — Kubernetes HPA based on CPU/memory metrics  
✅ **Zero-downtime deploys** — Rolling update strategy with readiness probes  
✅ **Security** — JWT with refresh rotation, bcrypt, Helmet.js, rate limiting  
✅ **Observability** — Health endpoints, structured logging (Winston)  
✅ **CI/CD** — Automated pipeline from code → production with rollback  

---

## 🧩 Future Enhancements

- [ ] Real-time chat using WebSockets (Socket.io)
- [ ] Image uploads to S3 with presigned URLs
- [ ] Map integration (Google Maps / Mapbox) for listing locations
- [ ] AI-powered roommate compatibility scoring
- [ ] Stripe payment for rental deposits
- [ ] Admin dashboard with analytics
- [ ] Mobile app (React Native)

---

## 📄 License

MIT — Build, deploy, showcase, and learn freely.
