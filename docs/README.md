# 🚀 Gold Trading APIs - Deployment Guide

## Overview
This guide covers multiple deployment options for the Gold Trading APIs system, from local development to cloud production deployment.

## 📋 Prerequisites

### Required
- **OpenAI API Key** - Get from [OpenAI Platform](https://platform.openai.com/api-keys)
- **Git** - For cloning the repository
- **Node.js 18+** - For local development

### Optional (Choose based on deployment method)
- **Docker & Docker Compose** - For containerized deployment
- **PostgreSQL** - For local database (if not using Docker)
- **Cloud Account** - For production deployment (Render/Railway/Vercel)

## 🎯 Deployment Options

### Option 1: Docker Compose (Recommended)

**Best for:** Quick setup, production-ready, consistent environments

```bash
# 1. Clone repository
git clone <your-repo-url>
cd gold-trading-apis

# 2. Set up environment
cp .env.example .env
# Edit .env and add your OpenAI API key

# 3. Start everything
docker-compose up -d

# 4. Verify deployment
curl http://localhost:3001/health
curl http://localhost:3002/health
```

**What it includes:**
- ✅ PostgreSQL database with automatic initialization
- ✅ Both APIs with health checks
- ✅ Nginx load balancer
- ✅ Persistent data storage
- ✅ Automatic restarts

### Option 2: Local Development Setup

**Best for:** Development, debugging, customization

```bash
# 1. Clone and setup
git clone <your-repo-url>
cd gold-trading-apis
chmod +x setup.sh
./setup.sh

# 2. Start APIs
./start.sh

# 3. Test APIs
./test-apis.sh
```

**Manual steps if setup.sh doesn't work:**
```bash
# Install dependencies
cd api1-gold-info && npm install && cd ..
cd api2-gold-purchase && npm install && cd ..

# Setup database (requires PostgreSQL)
createdb goldtrading
psql -d goldtrading < database/init.sql
psql -d goldtrading < database/seed-data.sql

# Start APIs in separate terminals
cd api1-gold-info && npm start
cd api2-gold-purchase && npm start
```

### Option 3: Render Deployment

**Best for:** Production deployment, free tier available

#### Deploy Database
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Create new PostgreSQL database:
   - Name: `gold-trading-db`
   - Plan: Free tier
   - Save connection details

#### Deploy API 1 (Gold Info)
1. Create new Web Service
2. Connect your GitHub repository
3. Settings:
   ```
   Name: gold-info-api
   Root Directory: api1-gold-info
   Build Command: npm install
   Start Command: npm start
   ```
4. Environment Variables:
   ```
   NODE_ENV=production
   DATABASE_URL=<your-render-postgres-url>
   OPENAI_API_KEY=<your-openai-key>
   JWT_SECRET=<your-secret>
   GOLD_PRICE_PER_GRAM=6500
   CURRENCY=INR
   ```

#### Deploy API 2 (Gold Purchase)
1. Create another Web Service
2. Settings:
   ```
   Name: gold-purchase-api
   Root Directory: api2-gold-purchase
   Build Command: npm install
   Start Command: npm start
   ```
3. Use same environment variables as API 1

#### Initialize Database
```bash
# Connect to your Render PostgreSQL
psql <your-render-postgres-url>

# Run initialization scripts
\i database/init.sql
\i database/seed-data.sql
```

### Option 4: Railway Deployment

**Best for:** Simple deployment, great for startups

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login to Railway
railway login

# 3. Create new project
railway new

# 4. Add PostgreSQL
railway add -d postgresql

# 5. Deploy API 1
cd api1-gold-info
railway up

# 6. Deploy API 2 (in new service)
cd ../api2-gold-purchase
railway up --service api2
```

Environment variables in Railway:
```
OPENAI_API_KEY=your-key
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=your-secret
```

### Option 5: Vercel + Supabase

**Best for:** Serverless deployment, edge functions

#### Setup Supabase Database
1. Create account at [Supabase](https://supabase.com)
2. Create new project
3. Run SQL commands from `database/init.sql` in SQL Editor
4. Get connection string

#### Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy API 1
cd api1-gold-info
vercel

# Deploy API 2
cd ../api2-gold-purchase
vercel
```

Add environment variables in Vercel dashboard.

## 🔧 Environment Configuration

### Required Environment Variables

```bash
# OpenAI (Required for API 1)
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-3.5-turbo

# Database
DATABASE_URL=postgresql://user:pass@host:port/dbname

# Security
JWT_SECRET=your-super-secret-key-min-32-chars

# Application
GOLD_PRICE_PER_GRAM=6500
CURRENCY=INR
NODE_ENV=production
```

### Platform-specific Environment Setup

#### Docker Compose
```bash
# Edit .env file
OPENAI_API_KEY=your-key
# Other variables use defaults
```

#### Render
```bash
# Set in Render dashboard
DATABASE_URL=postgresql://render-postgres-url
OPENAI_API_KEY=your-key
PORT=10000  # Render assigns this
```

#### Railway
```bash
# Railway auto-injects database URL
DATABASE_URL=${{Postgres.DATABASE_URL}}
OPENAI_API_KEY=your-key
```

#### Vercel
```bash
# Set in Vercel dashboard
DATABASE_URL=your-supabase-url
OPENAI_API_KEY=your-key
```

## 📊 Post-Deployment Verification

### Health Checks
```bash
# API 1 Health
curl https://your-api1-url/health

# API 2 Health
curl https://your-api2-url/health
```

### Complete Flow Test
```bash
# 1. Test gold query (save session_token from response)
curl -X POST https://your-api1-url/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is gold price today?", "user_id": 1}'

# 2. Test purchase initiation
curl -X POST https://your-api2-url/api/purchase/initiate \
  -H "Content-Type: application/json" \
  -d '{"session_token": "TOKEN_FROM_STEP_1", "user_details": {"name": "Test", "email": "test@example.com"}}'

# 3. Test purchase confirmation
curl -X POST https://your-api2-url/api/purchase/confirm \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1, "gold_amount": 5.0, "session_token": "TOKEN_FROM_STEP_1"}'
```

## 🔒 Security Considerations

### Production Checklist
- [ ] Strong JWT secret (min 32 characters)
- [ ] HTTPS enabled (automatic on most platforms)
- [ ] Database connections encrypted
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Environment variables secured
- [ ] Database credentials rotated regularly

### Security Headers
```javascript
// Both APIs include helmet.js for security headers
app.use(helmet({
  contentSecurityPolicy: false, // Adjust as needed
  crossOriginEmbedderPolicy: false
}));
```

## 📈 Monitoring & Maintenance

### Health Monitoring
Set up monitoring for:
- `/health` endpoints (both APIs)
- Database connectivity
- OpenAI API availability
- Response times

### Log Monitoring
Monitor for:
- OpenAI API errors
- Database connection issues
- Authentication failures
- High response times

### Database Maintenance
```sql
-- Clean expired sessions (run regularly)
SELECT clean_expired_sessions();

-- Monitor database performance
SELECT * FROM daily_analytics ORDER BY date DESC LIMIT 7;

-- Check user engagement
SELECT * FROM user_analytics ORDER BY total_conversations DESC LIMIT 10;
```

## 🚨 Troubleshooting

### Common Issues

#### "OpenAI API key not configured"
- Verify `OPENAI_API_KEY` is set correctly
- Check API key is valid on OpenAI platform
- Ensure no extra spaces or characters

#### "Database connection failed"
- Verify `DATABASE_URL` format
- Check database is running and accessible
- Verify credentials are correct

#### "Session token invalid"
- Check `JWT_SECRET` is consistent across APIs
- Verify token hasn't expired (1 hour default)
- Ensure APIs can communicate with database

#### APIs not starting
- Check port availability (3001, 3002)
- Verify Node.js version (18+)
- Check all dependencies installed

### Debug Commands
```bash
# Check API logs
docker-compose logs -f api1-gold-info
docker-compose logs -f api2-gold-purchase

# Database logs
docker-compose logs -f database

# Test database connection
docker exec -it gold_trading_db psql -U postgres -d goldtrading -c "SELECT 1;"

# Check running processes
docker-compose ps

# Restart services
docker-compose restart
```

## 📞 Support

### Documentation
- 📖 API Documentation: See main README.md
- 📮 Postman Collection: `postman-collection.json`
- 🗃️ Database Schema: `database/init.sql`

### Getting Help
1. Check logs for specific error messages
2. Verify all environment variables are set
3. Test health endpoints
4. Review troubleshooting section
5. Check platform-specific documentation

---

## ✅ Deployment Success Checklist

After deployment, verify:

- [ ] Both APIs respond to health checks
- [ ] Database tables created and populated
- [ ] OpenAI integration working
- [ ] Gold price queries work correctly
- [ ] Purchase flow completes successfully
- [ ] Transaction records stored in database
- [ ] User conversation history tracked
- [ ] Analytics endpoints functioning
- [ ] Error handling working properly
- [ ] Security headers in place

**🎉 Your Gold Trading APIs are ready for production!**