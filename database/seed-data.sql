-- database/seed-data.sql
-- Sample data for testing and demonstration

-- Insert sample users
INSERT INTO users (name, email, phone) VALUES
('John Doe', 'john.doe@email.com', '+91-9876543210'),
('Jane Smith', 'jane.smith@email.com', '+91-9876543211'),
('Raj Patel', 'raj.patel@email.com', '+91-9876543212'),
('Priya Sharma', 'priya.sharma@email.com', '+91-9876543213'),
('Mike Johnson', 'mike.johnson@email.com', '+91-9876543214')
ON CONFLICT (email) DO NOTHING;

-- Insert sample transactions
INSERT INTO transactions (user_id, gold_amount, price_per_gram, total_amount, status) VALUES
(1, 5.0000, 10500.00, 52500.00, 'completed'),
(1, 2.5000, 10500.00, 26250.00, 'completed'),
(2, 10.0000, 10500.00, 105000.00, 'completed'),
(3, 1.0000, 10500.00, 10500.00, 'completed'),
(3, 7.5000, 10500.00, 78750.00, 'completed'),
(4, 3.0000, 10500.00, 31500.00, 'completed'),
(5, 15.0000, 10500.00, 157500.00, 'completed')
ON CONFLICT DO NOTHING;

-- Insert sample conversations for testing
INSERT INTO conversations (user_id, user_message, ai_response, is_gold_related, confidence_score) VALUES
(1, 'What is the current gold price?', 'Current gold price is ₹6,500 per gram. Gold has been a trusted investment for centuries.', true, 0.95),
(1, 'I want to buy gold', 'Great choice! Digital gold allows you to invest without storage concerns. Would you like to see our investment options?', true, 0.98),
(2, 'How is the weather today?', 'I specialize in gold investment and digital gold trading. How can I help you with gold investments today?', false, 0.15),
(2, 'Tell me about gold investment benefits', 'Gold investment offers portfolio diversification, inflation hedge, and long-term value preservation. Digital gold makes it accessible and convenient.', true, 0.92),
(3, 'Is gold a good investment?', 'Yes! Gold has historically been an excellent store of value and hedge against inflation. It has increased 300% in the last 20 years.', true, 0.88),
(4, 'What are your gold prices?', 'Our current gold price is ₹6,500 per gram. You can start investing with as little as ₹100 in digital gold.', true, 0.94),
(5, 'Show me investment options', 'Here are our popular options: 1g (₹6,500), 5g (₹32,500), 10g (₹65,000). All come with secure digital storage.', true, 0.96)
ON CONFLICT DO NOTHING;

-- Insert sample gold price history
INSERT INTO gold_prices (price_per_gram, currency, source) VALUES
(6450.00, 'INR', 'market_data'),
(6475.00, 'INR', 'market_data'),
(6500.00, 'INR', 'market_data'),
(6520.00, 'INR', 'market_data'),
(10500.00, 'INR', 'current')
ON CONFLICT DO NOTHING;

-- Insert user preferences
INSERT INTO user_preferences (user_id, preferred_currency, investment_amount_preference, notification_enabled) VALUES
(1, 'INR', 25000.00, true),
(2, 'INR', 50000.00, true),
(3, 'INR', 10000.00, false),
(4, 'INR', 20000.00, true),
(5, 'INR', 75000.00, true)
ON CONFLICT (user_id) DO NOTHING;

-- Insert sample analytics events
INSERT INTO analytics_events (event_type, user_id, metadata) VALUES
('query', 1, '{"query_type": "price_inquiry", "gold_related": true}'),
('purchase_intent', 1, '{"interest_level": "high", "preferred_amount": "5g"}'),
('purchase_completed', 1, '{"amount": "5g", "value": 32500}'),
('query', 2, '{"query_type": "general", "gold_related": false}'),
('query', 2, '{"query_type": "investment_benefits", "gold_related": true}'),
('purchase_intent', 2, '{"interest_level": "medium", "preferred_amount": "10g"}'),
('purchase_completed', 2, '{"amount": "10g", "value": 105000}')
ON CONFLICT DO NOTHING;

-- Update sequences to continue from current max IDs
SELECT setval('users_id_seq', (SELECT COALESCE(MAX(id), 1) FROM users));
SELECT setval('transactions_id_seq', (SELECT COALESCE(MAX(id), 1) FROM transactions));
SELECT setval('sessions_id_seq', (SELECT COALESCE(MAX(id), 1) FROM sessions));
SELECT setval('conversations_id_seq', (SELECT COALESCE(MAX(id), 1) FROM conversations));
SELECT setval('gold_prices_id_seq', (SELECT COALESCE(MAX(id), 1) FROM gold_prices));
SELECT setval('user_preferences_id_seq', (SELECT COALESCE(MAX(id), 1) FROM user_preferences));
SELECT setval('analytics_events_id_seq', (SELECT COALESCE(MAX(id), 1) FROM analytics_events));

-- Display sample data summary
DO $$
BEGIN
    RAISE NOTICE 'Sample data inserted successfully!';
    RAISE NOTICE 'Sample Users: %', (SELECT COUNT(*) FROM users);
    RAISE NOTICE 'Sample Transactions: %', (SELECT COUNT(*) FROM transactions);
    RAISE NOTICE 'Sample Conversations: %', (SELECT COUNT(*) FROM conversations);
    RAISE NOTICE 'Sample Gold Prices: %', (SELECT COUNT(*) FROM gold_prices);
    RAISE NOTICE 'Ready for testing!';
END $$;
