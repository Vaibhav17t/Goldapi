# 🏆 Gold Trading APIs

A comprehensive gold trading platform with two interconnected APIs for gold information and purchase transactions, featuring an AI-powered chat system and complete transaction management.

## Project Overview

This system consists of two main APIs that work together to provide a complete gold trading experience:

**API 1 - Gold Information & AI Chat (Port 3001)**
- AI-powered chat system using OpenAI GPT
- Real-time gold price information
- Investment advice and recommendations
- Session token generation for secure transactions
- Gold-related query detection and routing

**API 2 - Gold Purchase & Transactions (Port 3002)**
- Purchase initiation and confirmation
- User transaction history
- Payment processing simulation
- Purchase options and pricing
- Integration with API 1 session tokens

## Key Features

- **AI Chat Integration**: Smart chatbot that provides gold investment advice and current pricing
- **Secure Transaction Flow**: Session-based authentication between APIs
- **Complete Purchase System**: From inquiry to transaction completion
- **User Management**: Customer data handling and transaction tracking
- **Web Interface**: Interactive testing dashboard for all API endpoints
- **Database Integration**: PostgreSQL for persistent data storage
- **Health Monitoring**: Built-in health checks for system reliability

## System Architecture

The system uses a microservices architecture with two specialized APIs:

1. **Information API**: Handles user queries, provides AI responses, generates session tokens
2. **Transaction API**: Manages purchases, processes payments, stores transaction records
3. **Database**: PostgreSQL database for users, transactions, and analytics
4. **Web Interface**: HTML/JavaScript frontend for testing and demonstration

## 🚀 Quick Start

### Docker Compose (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd gold-trading-apis

# Set up environment variables
cp .env.example .env
# Edit .env and add your OpenAI API key

# Start all services
docker-compose up -d

# Verify deployment
curl http://localhost:3001/health
curl http://localhost:3002/health
```

### Local Development

```bash
# Run setup script
chmod +x setup.sh
./setup.sh

# Start APIs
./start.sh

# Test the system
./test-apis.sh
```

## 🖥️ Web Interface

The project includes a comprehensive web testing interface (`web3.html`) that provides:

- **Interactive API Testing**: Direct interaction with both APIs
- **Real-time Health Monitoring**: Status indicators for each API
- **Complete Purchase Flow**: End-to-end transaction testing
- **Quick Action Buttons**: Pre-configured test scenarios
- **Response Visualization**: Formatted JSON responses with syntax highlighting

### 📸 Screenshots

**Gold Information API Interface**
![Gold Information API](1.png)
*API 1 interface showing gold investment query with AI-powered response and session token generation*

**Gold Purchase API Interface**
![Gold Purchase API](2.png)
*API 2 interface displaying successful gold purchase transaction with complete details*

**Docker Deployment**
![Docker Compose Setup](3.png)
*Docker containers running successfully with all services healthy*

### 🎥 Demo Video

**Complete System Walkthrough**
[Watch Demo Video](https://drive.google.com/your-video-link)
*Full demonstration of the gold trading system including API interactions, purchase flow, and web interface features*

### Using the Web Interface

1. Open `web3.html` in your browser
2. Ensure both APIs are running (green status dots)
3. Test gold queries using the chat interface
4. Use the generated session token for purchase flows
5. Monitor all responses in the formatted display areas

## API Endpoints

### API 1 - Gold Information

```
GET  /health                    - Health check
POST /api/chat                  - AI chat endpoint
GET  /api/analytics/daily       - Daily analytics
GET  /api/analytics/users       - User analytics
```

### API 2 - Gold Purchase

```
GET  /health                           - Health check
GET  /api/purchase/options             - Available purchase options
POST /api/purchase/initiate            - Start purchase process
POST /api/purchase/confirm             - Complete purchase
GET  /api/user/:id/transactions        - User transaction history
```

## ⚙️ Environment Variables

Create a `.env` file with the following variables:

```bash
# OpenAI Configuration (Required)
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-3.5-turbo

# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/goldtrading

# Security
JWT_SECRET=your-secret-key-minimum-32-characters

# Application Settings
GOLD_PRICE_PER_GRAM=6500
CURRENCY=INR
NODE_ENV=development
```

## Database Schema

The system uses PostgreSQL with the following main tables:

- **users**: Customer information and registration details
- **conversations**: Chat history and AI interactions
- **sessions**: Authentication tokens and session management
- **transactions**: Purchase records and transaction details
- **daily_analytics**: Usage statistics and metrics
- **user_analytics**: Individual user engagement data

## 🔄 Complete Transaction Flow

1. **User Inquiry**: Customer asks about gold investment via API 1
2. **AI Response**: System provides personalized advice and current pricing
3. **Session Creation**: API 1 generates secure session token
4. **Purchase Initiation**: API 2 receives session token and user details
5. **Transaction Confirmation**: Purchase is processed and recorded
6. **History Tracking**: All activities are logged for analytics

## Testing the System

### Basic Health Check
```bash
# Check API 1
curl http://localhost:3001/health

# Check API 2
curl http://localhost:3002/health
```

### Complete Flow Test
```bash
# 1. Ask about gold (save the session_token from response)
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the current gold price?", "user_id": 1}'

# 2. Initiate purchase
curl -X POST http://localhost:3002/api/purchase/initiate \
  -H "Content-Type: application/json" \
  -d '{"session_token": "TOKEN_FROM_STEP_1", "user_details": {"name": "Test User", "email": "test@example.com", "phone": "+91-9876543210"}}'

# 3. Complete purchase
curl -X POST http://localhost:3002/api/purchase/confirm \
  -H "Content-Type: application/json" \
  -d '{"user_id": 1, "gold_amount": 5.0, "session_token": "TOKEN_FROM_STEP_1", "payment_method": "digital"}'
```

## Deployment Options

### Production Deployment

**Cloud Platforms:**
- Render: Automatic deployments with PostgreSQL
- Railway: Simple deployment with database integration
- Vercel + Supabase: Serverless deployment option

**Self-Hosted:**
- Docker Compose: Complete containerized setup
- Traditional VPS: Manual installation and configuration

### Security Considerations

- JWT-based session management
- Environment variable protection
- HTTPS enforcement in production
- Database connection encryption
- Rate limiting implementation
- CORS configuration

## Monitoring and Analytics

The system includes built-in analytics for:

- Daily conversation volumes
- User engagement metrics
- Transaction success rates
- API response times
- Error tracking and reporting

## 🚨 Troubleshooting

**Common Issues:**

- **APIs not responding**: Check if ports 3001 and 3002 are available
- **Database connection failed**: Verify DATABASE_URL and PostgreSQL service
- **OpenAI API errors**: Confirm OPENAI_API_KEY is valid and has sufficient credits
- **Session token invalid**: Ensure JWT_SECRET is consistent across both APIs

**Debug Commands:**
```bash
# Check running containers
docker-compose ps

# View API logs
docker-compose logs -f api1-gold-info
docker-compose logs -f api2-gold-purchase

# Database connection test
docker exec -it gold_trading_db psql -U postgres -d goldtrading -c "SELECT 1;"
```

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **AI Integration**: OpenAI GPT API
- **Authentication**: JWT tokens
- **Frontend**: HTML, JavaScript, CSS
- **Containerization**: Docker, Docker Compose
- **Security**: Helmet.js, CORS, bcrypt

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly using the web interface
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review API logs for error details
3. Verify environment configuration
4. Test individual endpoints using the web interface