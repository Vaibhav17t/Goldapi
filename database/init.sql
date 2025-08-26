-- database/init.sql
-- Initialize Gold Trading Database Schema

-- Enable UUID extension for better session management
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(50) UNIQUE NOT NULL DEFAULT ('TXN' || LPAD(nextval('transactions_id_seq')::text, 6, '0')),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    gold_amount DECIMAL(10,4) NOT NULL CHECK (gold_amount > 0),
    price_per_gram DECIMAL(10,2) NOT NULL CHECK (price_per_gram > 0),
    total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount > 0),
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    payment_method VARCHAR(50) DEFAULT 'digital',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sessions Table (for API communication)
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    session_token VARCHAR(500) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    intent_confirmed BOOLEAN DEFAULT FALSE,
    user_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Conversations Table (for OpenAI context and analytics)
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(500) REFERENCES sessions(session_token) ON DELETE CASCADE,
    user_message TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    is_gold_related BOOLEAN DEFAULT FALSE,
    confidence_score DECIMAL(3,2),
    openai_model VARCHAR(50),
    tokens_used INTEGER,
    response_time_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Gold Prices History Table (for price tracking)
CREATE TABLE IF NOT EXISTS gold_prices (
    id SERIAL PRIMARY KEY,
    price_per_gram DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    source VARCHAR(50) DEFAULT 'manual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Preferences Table
CREATE TABLE IF NOT EXISTS user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    preferred_currency VARCHAR(3) DEFAULT 'INR',
    investment_amount_preference DECIMAL(10,2),
    notification_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics Table for tracking metrics
CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL, -- 'query', 'purchase_intent', 'purchase_completed'
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(500),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_is_gold_related ON conversations(is_gold_related);
CREATE INDEX IF NOT EXISTS idx_gold_prices_created_at ON gold_prices(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at);

-- Create Functions for Automatic Timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create Triggers for Automatic Timestamps
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at 
    BEFORE UPDATE ON transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at 
    BEFORE UPDATE ON user_preferences 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean expired sessions
CREATE OR REPLACE FUNCTION clean_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a view for user analytics
CREATE OR REPLACE VIEW user_analytics AS
SELECT 
    u.id as user_id,
    u.name,
    u.email,
    COUNT(c.id) as total_conversations,
    COUNT(c.id) FILTER (WHERE c.is_gold_related = true) as gold_conversations,
    COUNT(t.id) as total_purchases,
    COALESCE(SUM(t.total_amount), 0) as total_spent,
    COALESCE(SUM(t.gold_amount), 0) as total_gold_purchased,
    u.created_at as user_since,
    MAX(c.created_at) as last_conversation
FROM users u
LEFT JOIN conversations c ON u.id = c.user_id
LEFT JOIN transactions t ON u.id = t.user_id
GROUP BY u.id, u.name, u.email, u.created_at;

-- Create a view for daily analytics
CREATE OR REPLACE VIEW daily_analytics AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_conversations,
    COUNT(*) FILTER (WHERE is_gold_related = true) as gold_related_conversations,
    COUNT(DISTINCT user_id) as unique_users,
    ROUND(AVG(confidence_score), 2) as avg_confidence,
    ROUND(AVG(response_time_ms), 0) as avg_response_time_ms
FROM conversations
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Insert initial gold price
INSERT INTO gold_prices (price_per_gram, currency, source) 
VALUES (6500.00, 'INR', 'initial_setup')
ON CONFLICT DO NOTHING;

-- Create function to get current gold price
CREATE OR REPLACE FUNCTION get_current_gold_price(currency_code VARCHAR(3) DEFAULT 'INR')
RETURNS DECIMAL(10,2) AS $
DECLARE
    current_price DECIMAL(10,2);
BEGIN
    SELECT price_per_gram INTO current_price
    FROM gold_prices 
    WHERE currency = currency_code
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- Return default price if no price found
    IF current_price IS NULL THEN
        RETURN 6500.00;
    END IF;
    
    RETURN current_price;
END;
$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Success message
DO $
BEGIN
    RAISE NOTICE 'Gold Trading Database initialized successfully!';
    RAISE NOTICE 'Tables created: users, transactions, sessions, conversations, gold_prices, user_preferences, analytics_events';
    RAISE NOTICE 'Views created: user_analytics, daily_analytics';
    RAISE NOTICE 'Functions created: update_updated_at_column, clean_expired_sessions, get_current_gold_price';
END $;