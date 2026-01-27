# XCH - Simple Deployment Guide

**Quick deployment with Docker Compose in 5 steps**

---

## Prerequisites

- Docker + Docker Compose installed
- Git installed
- Ports available: 3001 (frontend), 3002 (backend), 5433 (postgres), 6380 (redis), 9000-9001 (minio)

---

## Step 1: Clone Repository

```bash
git clone <repository-url>
cd XCH
```

---

## Step 2: Configure Environment Variables

### Root Directory

```bash
# Copy root env template
cp .env.example .env

# Edit if needed (default values work for local dev)
nano .env
```

### Backend

```bash
# Copy backend env template
cp backend/.env.example backend/.env

# IMPORTANT: Change JWT_SECRET in production
nano backend/.env
```

### Frontend

```bash
# Copy frontend env template
cp frontend/.env.example frontend/.env.local

# Should work with defaults
nano frontend/.env.local
```

**Default Configuration:**
- Frontend: http://localhost:3001
- Backend API: http://localhost:3002
- PostgreSQL: localhost:5433
- Redis: localhost:6380
- MinIO Console: http://localhost:9001

---

## Step 3: Start Docker Stack

```bash
docker compose up -d
```

**What happens automatically:**
1. PostgreSQL starts and initializes `xch_dev` database
2. Redis starts for caching
3. MinIO starts for file storage (creates buckets automatically)
4. Backend container:
   - Generates Prisma client
   - Runs database migrations
   - Seeds database with initial data (tenant + admin user)
   - Starts NestJS API server on port 3002
5. Frontend container starts Next.js on port 3001
6. Nginx reverse proxy starts (if configured)

**Wait 30-60 seconds for full initialization.**

---

## Step 4: Verify Services

### Check container status:
```bash
docker compose ps
```

All containers should show `Up` status.

### Check backend logs:
```bash
docker compose logs backend -f
```

Look for: `"Application is running on: http://[::]:3002"`

### Check frontend logs:
```bash
docker compose logs frontend -f
```

Look for: `"Ready in X ms"`

### Test backend API:
```bash
curl http://localhost:3002/api/health
```

Should return: `{"status":"ok"}`

---

## Step 5: Access Application

1. **Open browser:** http://localhost:3001

2. **Default credentials:**
   - Email: `admin@xch.local`
   - Password: `admin123`

3. **Load demo data (optional):**
   - Login as admin
   - Go to: Settings > Organisation > "Données de démonstration"
   - Click "Charger données démo"
   - Demo data includes: sites, assets, racks, tasks, users

---

## Troubleshooting

### Port conflicts
If ports are already in use, edit `.env`:
```bash
POSTGRES_PORT=5434
REDIS_PORT=6381
# etc.
```

Then restart: `docker compose down && docker compose up -d`

### Backend won't start
```bash
# Check logs
docker compose logs backend

# Common fixes:
docker compose restart backend
docker compose exec backend npx prisma migrate deploy
```

### Database connection errors
```bash
# Verify PostgreSQL is healthy
docker compose ps postgres

# If unhealthy, restart:
docker compose restart postgres
sleep 10
docker compose restart backend
```

### Frontend can't reach backend
Check `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3002
```

### Reset everything
```bash
docker compose down -v  # Removes volumes (all data lost!)
docker compose up -d
```

---

## Production Deployment

For production, see: `docs/installation/INSTALL_PROD.md`

**Key differences:**
- Use production domain names (not localhost)
- Enable HTTPS with SSL certificates
- Change all passwords and secrets
- Configure firewall (UFW)
- Set up automated backups
- Configure monitoring

---

## Stopping Services

```bash
# Stop containers (keeps data)
docker compose stop

# Stop and remove containers (keeps data volumes)
docker compose down

# Remove everything including data
docker compose down -v
```

---

## Useful Commands

```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs backend -f
docker compose logs frontend -f

# Restart a service
docker compose restart backend

# Execute command in container
docker compose exec backend npx prisma studio  # Open Prisma Studio
docker compose exec backend npx prisma db seed  # Re-seed database

# Check resource usage
docker stats
```

---

## Next Steps

After deployment:
1. Change admin password in Settings > Profil
2. Create additional users with appropriate roles
3. Configure integrations (NetBox, Uptime Kuma) if needed
4. Set up regular backups
5. Test all features

---

## Support

- Documentation: `docs/00-INDEX.md`
- Issues: GitHub Issues
- Production guide: `docs/installation/INSTALL_PROD.md`
