#!/bin/bash

# setup.sh - Automated setup script for Gold Trading APIs

set -e  # Exit on any error

echo "🚀 Starting Gold Trading APIs Setup..."
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}$1${NC}"
}

# Check if required tools are installed
check_requirements() {
    print_header "Checking requirements..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18 or higher is required. Current version: $(node -v)"
        exit 1
    fi
    
    print_status "Node.js $(node -v) ✓"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    print_status "npm $(npm -v) ✓"
    
    # Check PostgreSQL (optional - can use Docker)
    if command -v psql &> /dev/null; then
        print_status "PostgreSQL $(psql --version | awk '{print $3}') ✓"
    else
        print_warning "PostgreSQL not found locally. Will use Docker for database."
    fi
    
    # Check Docker (optional)
    if command -v docker &> /dev/null; then
        print_status "Docker $(docker --version | awk '{print $3}' | sed 's/,//') ✓"
        DOCKER_AVAILABLE=true
    else
        print_warning "Docker not found. Manual setup will be used."
        DOCKER_AVAILABLE=false
    fi
}

# Setup environment file
setup_environment() {
    print_header "Setting up environment..."
    
    if [ ! -f .env ]; then
        if [ -f .env.example ]; then
            cp .env.example .env
            print_status "Created .env file from template"
        else
            print_error ".env.example not found"
            exit 1
        fi
    else
        print_status ".env file already exists"
    fi
    
    # Check if OpenAI API key is set
    if grep -q "your-openai-api-key-here" .env; then
        print_warning "Please set your OpenAI API key in .env file"
        print_warning "Edit .env and replace 'your-openai-api-key-here' with your actual OpenAI API key"
        read -p "Press Enter when you have updated the .env file..."
    fi
}

# Install dependencies
install_dependencies() {
    print_header "Installing dependencies..."
    
    # Install API 1 dependencies
    if [ -d "api1-gold-info" ]; then
        print_status "Installing API 1 (Gold Info) dependencies..."
        cd api1-gold-info
        npm install
        cd ..
    else
        print_error "api1-gold-info directory not found"
        exit 1
    fi
    
    # Install API 2 dependencies
    if [ -d "api2-gold-purchase" ]; then
        print_status "Installing API 2 (Gold Purchase) dependencies..."
        cd api2-gold-purchase
        npm install
        cd ..
    else
        print_error "api2-gold-purchase directory not found"
        exit 1
    fi
    
    print_status "All dependencies installed successfully!"
}

# Setup database
setup_database() {
    print_header "Setting up database..."
    
    if [ "$DOCKER_AVAILABLE" = true ]; then
        print_status "Using Docker for database setup..."
        
        # Check if PostgreSQL container is running
        if docker ps | grep -q gold_trading_db; then
            print_status "Database container already running"
        else
            print_status "Starting PostgreSQL container..."
            docker run --name gold_trading_db \
                -e POSTGRES_DB=goldtrading \
                -e POSTGRES_USER=postgres \
                -e POSTGRES_PASSWORD=password123 \
                -p 5432:5432 \
                -v postgres_data:/var/lib/postgresql/data \
                -d postgres:15
            
            # Wait for database to be ready
            print_status "Waiting for database to be ready..."
            sleep 10
        fi
        
        # Run database initialization
        print_status "Initializing database schema..."
        docker exec -i gold_trading_db psql -U postgres -d goldtrading < database/init.sql
        docker exec -i gold_trading_db psql -U postgres -d goldtrading < database/seed-data.sql
        
    else
        print_warning "Docker not available. Please ensure PostgreSQL is running locally."
        print_warning "Create database 'goldtrading' and run:"
        print_warning "  psql -U postgres -d goldtrading < database/init.sql"
        print_warning "  psql -U postgres -d goldtrading < database/seed-data.sql"
    fi
}

# Create start script
create_start_script() {
    print_header "Creating start script..."
    
    cat > start.sh << 'EOF'
#!/bin/bash

# start.sh - Start both APIs

echo "🚀 Starting Gold Trading APIs..."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Start API 1 in background
echo "Starting API 1 (Gold Info) on port ${API1_PORT:-3001}..."
cd api1-gold-info
npm start &
API1_PID=$!
cd ..

# Start API 2 in background
echo "Starting API 2 (Gold Purchase) on port ${API2_PORT:-3002}..."
cd api2-gold-purchase
npm start &
API2_PID=$!
cd ..

echo "✅ Both APIs are starting..."
echo "📊 API 1 (Gold Info): http://localhost:${API1_PORT:-3001}"
echo "💰 API 2 (Gold Purchase): http://localhost:${API2_PORT:-3002}"
echo ""
echo "Health checks:"
echo "curl http://localhost:${API1_PORT:-3001}/health"
echo "curl http://localhost:${API2_PORT:-3002}/health"
echo ""
echo "Press Ctrl+C to stop both APIs"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "Stopping APIs..."
    kill $API1_PID $API2_PID 2>/dev/null
    echo "APIs stopped."
    exit 0
}

# Set trap for cleanup
trap cleanup INT TERM

# Wait for both processes
wait $API1_PID $API2_PID
EOF
    
    chmod +x start.sh
    print_status "Created start.sh script"
}

# Create test script
create_test_script() {
    print_header "Creating test script..."
    
    cat > test-apis.sh << 'EOF'
#!/bin/bash

# test-apis.sh - Test both APIs

echo "🧪 Testing Gold Trading APIs..."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

API1_URL="http://localhost:${API1_PORT:-3001}"
API2_URL="http://localhost:${API2_PORT:-3002}"

# Test API 1 Health
echo "Testing API 1 Health..."
curl -s "$API1_URL/health" | jq '.' || echo "API 1 health check failed"

# Test API 2 Health
echo "Testing API 2 Health..."
curl -s "$API2_URL/health" | jq '.' || echo "API 2 health check failed"

# Test gold-related query
echo "Testing gold-related query..."
curl -s -X POST "$API1_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the current gold price?", "user_id": 1}' \
  | jq '.' || echo "Gold query test failed"

# Test non-gold query
echo "Testing non-gold query..."
curl -s -X POST "$API1_URL/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "How is the weather?", "user_id": 1}' \
  | jq '.' || echo "Non-gold query test failed"

# Test purchase options
echo "Testing purchase options..."
curl -s "$API2_URL/api/purchase/options" | jq '.' || echo "Purchase options test failed"

echo "✅ API testing completed!"
EOF
    
    chmod +x test-apis.sh
    print_status "Created test-apis.sh script"
}

# Main execution
main() {
    echo ""
    print_header "Gold Trading APIs - Automated Setup"
    echo ""
    
    check_requirements
    echo ""
    
    setup_environment
    echo ""
    
    install_dependencies
    echo ""
    
    setup_database
    echo ""
    
    create_start_script
    create_test_script
    echo ""
    
    print_header "🎉 Setup Complete!"
    echo ""
    print_status "Next steps:"
    echo "  1. Make sure your OpenAI API key is set in .env"
    echo "  2. Start the APIs: ./start.sh"
    echo "  3. Test the APIs: ./test-apis.sh"
    echo ""
    print_status "Docker option (recommended):"
    echo "  docker-compose up -d"
    echo ""
    print_status "APIs will be available at:"
    echo "  📊 API 1 (Gold Info): http://localhost:3001"
    echo "  💰 API 2 (Purchase): http://localhost:3002"
    echo ""
    print_status "Documentation:"
    echo "  📖 Full API docs available in README.md"
    echo "  📮 Postman collection: postman-collection.json"
    echo ""
}

# Run main function
main