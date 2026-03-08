---
name: stock-dashboard
description: Build, deploy, and manage the Stock Analysis Dashboard. Use for deploying to analysis.geekzlabs.com, updating GitHub, and managing the container.
disable-model-invocation: true
argument-hint: "[deploy|setup|status|logs|push|ship|down|restart]"
---

# Stock Analysis Dashboard — Deployment & Management

## Project Info
- **App**: Stock Analysis Dashboard (3-tab trading dashboard: Portfolio, Journal, DRMA)
- **Repo**: https://github.com/sirjoon/analysis
- **Local Path**: /Users/siru/analysis
- **Domain**: https://analysis.geekzlabs.com
- **Type**: Static React app (Vite + React + Recharts), no backend/database

## Infrastructure (shared with MagicCRM, $0 extra cost)
- **EC2**: t4g.small ARM (Graviton), ap-south-1, IP: 43.205.152.73
- **ECR**: 675045716724.dkr.ecr.ap-south-1.amazonaws.com/analysis-frontend
- **Image Tag**: `:latest`
- **Container**: analysis-frontend (on `dentacrm-net` network)
- **SSH Key**: /Users/siru/Documents/LeadManagement/terraform/environments/ec2-mumbai/dentacrm-mumbai.pem
- **SSH**: `ssh -i <SSH_KEY> -o StrictHostKeyChecking=no ec2-user@43.205.152.73`
- **Deploy dir on EC2**: /home/ec2-user/dentacrm/

## Architecture
```
EC2 (same machine as MagicCRM)
├── nginx (routes by subdomain)
│   ├── magiccrm.geekzlabs.com      → dentacrm containers (DO NOT TOUCH)
│   ├── dev.magiccrm.geekzlabs.com  → dev containers (DO NOT TOUCH)
│   └── analysis.geekzlabs.com      → analysis-frontend:80 (THIS APP)
└── Containers
    ├── dentacrm-*                   (DO NOT TOUCH)
    └── analysis-frontend            (static React app, nginx:alpine, ~10MB)
```

## Key Files (in /Users/siru/analysis)
- `src/StockPortfolioTracker.jsx` — Main 3-tab component
- `src/main.jsx` — React entry point
- `Dockerfile` — Multi-stage build (node:20-alpine → nginx:alpine)
- `docker-compose.analysis.yml` — Single-service compose (also copied to EC2)
- `nginx.analysis.conf` — Nginx subdomain config for analysis.geekzlabs.com
- `terraform/main.tf` — ECR repo + Route53 A record

## CRITICAL RULES
- **NEVER touch MagicCRM** — no prod containers, no prod DB, no prod compose, no prod nginx
- **This is a frontend-only app** — no backend, no database
- **Always use `docker-compose.analysis.yml`** (NOT docker-compose.prod.yml)
- **ARM64 builds required** — EC2 is Graviton (ARM)
- **Push to GitHub** after any code change

---

## Commands

Based on `$ARGUMENTS`, perform the following:

### `deploy` — Deploy to production
1. `cd /Users/siru/analysis`
2. Login to ECR: `aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 675045716724.dkr.ecr.ap-south-1.amazonaws.com`
3. Build ARM64 image and push:
   ```
   docker buildx build --platform linux/arm64 -t 675045716724.dkr.ecr.ap-south-1.amazonaws.com/analysis-frontend:latest --push .
   ```
4. SSH to EC2 and deploy:
   ```
   ssh -i <SSH_KEY> -o StrictHostKeyChecking=no ec2-user@43.205.152.73 'cd /home/ec2-user/dentacrm && docker compose -f docker-compose.analysis.yml pull && docker compose -f docker-compose.analysis.yml up -d && docker exec dentacrm-nginx nginx -s reload'
   ```
5. Wait 5s, then verify: `curl -sk https://analysis.geekzlabs.com`

### `setup` — First-time setup (run once)
This sets up everything needed on EC2 for the first deployment.

1. `cd /Users/siru/analysis`
2. **Create ECR repo** (if not exists):
   ```
   aws ecr create-repository --repository-name analysis-frontend --region ap-south-1 --image-tag-mutability MUTABLE --image-scanning-configuration scanOnPush=true 2>/dev/null || true
   ```
3. **Create Route53 A record**:
   ```
   aws route53 change-resource-record-sets --hosted-zone-id Z01213603PUH8MLSQUY6J --change-batch '{"Changes":[{"Action":"UPSERT","ResourceRecordSet":{"Name":"analysis.geekzlabs.com","Type":"A","TTL":300,"ResourceRecords":[{"Value":"43.205.152.73"}]}}]}'
   ```
4. **Copy configs to EC2**:
   ```
   scp -i <SSH_KEY> -o StrictHostKeyChecking=no docker-compose.analysis.yml nginx.analysis.conf ec2-user@43.205.152.73:/home/ec2-user/dentacrm/
   ```
5. **Add nginx config on EC2**:
   ```
   ssh -i <SSH_KEY> -o StrictHostKeyChecking=no ec2-user@43.205.152.73 'docker cp /home/ec2-user/dentacrm/nginx.analysis.conf dentacrm-nginx:/etc/nginx/conf.d/analysis.conf && docker exec dentacrm-nginx nginx -s reload'
   ```
6. **Get SSL cert** (needs nginx ACME conf first):
   First, create a temp HTTP-only server block for ACME:
   ```
   ssh -i <SSH_KEY> -o StrictHostKeyChecking=no ec2-user@43.205.152.73 'cat > /tmp/analysis-acme.conf << "CONF"
   server {
       listen 80;
       server_name analysis.geekzlabs.com;
       location /.well-known/acme-challenge/ { root /var/www/certbot; }
       location / { return 301 https://$host$request_uri; }
   }
   CONF
   docker cp /tmp/analysis-acme.conf dentacrm-nginx:/etc/nginx/conf.d/analysis.conf && docker exec dentacrm-nginx nginx -s reload'
   ```
   Wait 30s for DNS propagation, then get cert:
   ```
   ssh -i <SSH_KEY> -o StrictHostKeyChecking=no ec2-user@43.205.152.73 'docker exec dentacrm-certbot certbot certonly --webroot -w /var/www/certbot -d analysis.geekzlabs.com --non-interactive --agree-tos --email admin@geekzlabs.com'
   ```
   Then replace the ACME-only config with the full nginx config:
   ```
   ssh -i <SSH_KEY> -o StrictHostKeyChecking=no ec2-user@43.205.152.73 'docker cp /home/ec2-user/dentacrm/nginx.analysis.conf dentacrm-nginx:/etc/nginx/conf.d/analysis.conf && docker exec dentacrm-nginx nginx -s reload'
   ```
7. **Build, push, and start container** (same as `deploy` steps 2-5)
8. Verify: `curl -sk https://analysis.geekzlabs.com`

### `status` — Check container status
```
ssh -i <SSH_KEY> -o StrictHostKeyChecking=no ec2-user@43.205.152.73 'docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep -E "NAME|analysis"'
```
If no containers found, report "Analysis dashboard is not running."

### `logs` — View container logs
```
ssh -i <SSH_KEY> -o StrictHostKeyChecking=no ec2-user@43.205.152.73 'docker logs analysis-frontend --tail 50'
```

### `push` or `github` — Commit and push to GitHub
1. `cd /Users/siru/analysis`
2. `git status` and `git diff --stat`
3. Stage relevant changed files
4. Commit with `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
5. Push to `main` branch

### `ship` — Build, deploy, AND push to GitHub
Combines `deploy` + `push` in sequence.

### `down` — Stop the analysis container
```
ssh -i <SSH_KEY> -o StrictHostKeyChecking=no ec2-user@43.205.152.73 'cd /home/ec2-user/dentacrm && docker compose -f docker-compose.analysis.yml down'
```

### `restart` — Restart the analysis container
```
ssh -i <SSH_KEY> -o StrictHostKeyChecking=no ec2-user@43.205.152.73 'cd /home/ec2-user/dentacrm && docker compose -f docker-compose.analysis.yml restart && docker exec dentacrm-nginx nginx -s reload'
```
