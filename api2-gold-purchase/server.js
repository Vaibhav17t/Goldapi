// api2-gold-purchase/server.js
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3002;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password123@localhost:5432/goldtrading'
});

// Middleware
app.use(helmet()); // Security headers
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50 // limit each IP to 50 requests per windowMs (stricter for purchase API)
});
app.use(limiter);

// Purchase-specific rate limiting
const purchaseLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 purchase attempts per hour
  message: {
    error: 'Too many purchase attempts, please try again later'
  }
});

// Hardcoded gold purchase options
const GOLD_OPTIONS = [
  { 
    id: 'starter', 
    amount: 1, 
    unit: 'gram', 
    label: 'Starter Pack',
    description: 'Perfect for beginners',
    popular: false
  },
  { 
    id: 'popular', 
    amount: 5, 
    unit: 'gram', 
    label: 'Popular Choice',
    description: 'Most chosen by investors',
    popular: true
  },
  { 
    id: 'premium', 
    amount: 10, 
    unit: 'gram', 
    label: 'Premium Investment',
    description: 'For serious investors',
    popular: false
  },
  { 
    id: 'custom', 
    amount: 0, 
    unit: 'gram', 
    label: 'Custom Amount',
    description: 'Choose your own amount',
    popular: false
  }
];

// Utility Functions

// Verify session token from API 1
async function verifySession(sessionToken) {
  try {
    // Verify JWT token
    const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET || 'gold-trading-secret-key-2025');
    
    // Check if session exists in database and is not expired
    const result = await pool.query(
      `SELECT s.*, u.name, u.email, u.phone 
       FROM sessions s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.session_token = $1 AND s.expires_at > NOW() AND s.is_active = true`,
      [sessionToken]
    );
    
    if (result.rows.length === 0) {
      return { valid: false, error: 'Invalid or expired session' };
    }
    
    return { 
      valid: true, 
      session: result.rows[0],
      decoded: decoded
    };
  } catch (error) {
    return { valid: false, error: 'Invalid session token' };
  }
}

// Get current gold price
async function getCurrentGoldPrice() {
  try {
    const result = await pool.query(
      'SELECT price_per_gram FROM gold_prices ORDER BY created_at DESC LIMIT 1'
    );
    
    if (result.rows.length > 0) {
      return parseFloat(result.rows[0].price_per_gram);
    }
    
    // Fallback to environment variable
    return parseFloat(process.env.GOLD_PRICE_PER_GRAM) || 6500.00;
  } catch (error) {
    console.error('Error getting gold price:', error);
    return parseFloat(process.env.GOLD_PRICE_PER_GRAM) || 6500.00;
  }
}

// Create or get user
async function createOrGetUser(userDetails) {
  const { name, email, phone } = userDetails;
  
  try {
    // Try to get existing user by email
    let result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    if (result.rows.length > 0) {
      // Update user details if provided
      if (name || phone) {
        await pool.query(
          `UPDATE users 
           SET name = COALESCE($1, name), phone = COALESCE($2, phone), updated_at = NOW()
           WHERE email = $3`,
          [name, phone, email]
        );
      }
      return result.rows[0];
    }
    
    // Create new user
    result = await pool.query(
      `INSERT INTO users (name, email, phone) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [name, email, phone]
    );
    
    return result.rows[0];
  } catch (error) {
    throw new Error('Failed to create or retrieve user: ' + error.message);
  }
}

// Process purchase transaction
async function processPurchase(userId, goldAmount, pricePerGram, paymentMethod = 'digital') {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const totalAmount = goldAmount * pricePerGram;
    
    // Insert transaction
    const transactionResult = await client.query(
      `INSERT INTO transactions (user_id, gold_amount, price_per_gram, total_amount, payment_method, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, goldAmount, pricePerGram, totalAmount, paymentMethod, 'completed']
    );
    
    // Log analytics event
    await client.query(
      `INSERT INTO analytics_events (event_type, user_id, metadata)
       VALUES ($1, $2, $3)`,
      ['purchase_completed', userId, JSON.stringify({
        gold_amount: goldAmount,
        total_amount: totalAmount,
        price_per_gram: pricePerGram
      })]
    );
    
    await client.query('COMMIT');
    return transactionResult.rows[0];
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Routes

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await pool.query('SELECT 1');
    
    const goldPrice = await getCurrentGoldPrice();
    
    res.json({
      status: 'healthy',
      service: 'Gold Purchase API',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      features: {
        database: 'connected',
        current_gold_price: `₹${goldPrice} per gram`
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Get purchase options
app.get('/api/purchase/options', async (req, res) => {
  try {
    const goldPrice = await getCurrentGoldPrice();
    const currency = process.env.CURRENCY || 'INR';
    
    const optionsWithPrices = GOLD_OPTIONS.map(option => ({
      ...option,
      price: option.amount > 0 ? option.amount * goldPrice : null,
      price_per_gram: goldPrice,
      currency: currency,
      formatted_price: option.amount > 0 ? `${currency} ${(option.amount * goldPrice).toLocaleString()}` : 'Custom'
    }));
    
    res.json({
      options: optionsWithPrices,
      current_price_per_gram: goldPrice,
      currency: currency,
      minimum_purchase: 0.1, // minimum 0.1 grams
      maximum_purchase: 1000, // maximum 1000 grams
      last_updated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Options endpoint error:', error);
    res.status(500).json({
      error: 'Failed to retrieve purchase options'
    });
  }
});

// Initiate purchase process
app.post('/api/purchase/initiate', async (req, res) => {
  try {
    const { session_token, user_details } = req.body;
    
    if (!session_token) {
      return res.status(400).json({
        error: 'Session token is required',
        message: 'Please start from the gold information API first'
      });
    }
    
    if (!user_details || !user_details.email) {
      return res.status(400).json({
        error: 'User details with email are required'
      });
    }
    
    // Verify session
    const sessionVerification = await verifySession(session_token);
    if (!sessionVerification.valid) {
      return res.status(401).json({
        error: sessionVerification.error
      });
    }
    
    // Create or get user
    const user = await createOrGetUser(user_details);
    
    // Get purchase options with current prices
    const goldPrice = await getCurrentGoldPrice();
    const currency = process.env.CURRENCY || 'INR';
    
    const purchaseOptions = GOLD_OPTIONS.filter(opt => opt.amount > 0).map(option => ({
      id: option.id,
      amount: `${option.amount}g`,
      price: option.amount * goldPrice,
      formatted_price: `${currency} ${(option.amount * goldPrice).toLocaleString()}`,
      label: option.label,
      description: option.description,
      popular: option.popular
    }));
    
    // Update session with user ID
    await pool.query(
      'UPDATE sessions SET user_id = $1 WHERE session_token = $2',
      [user.id, session_token]
    );
    
    res.json({
      success: true,
      user_id: user.id,
      user_name: user.name,
      purchase_options: purchaseOptions,
      custom_option: {
        id: 'custom',
        min_amount: 0.1,
        max_amount: 1000.0,
        price_per_gram: goldPrice,
        currency: currency
      },
      session_valid_until: sessionVerification.session.expires_at,
      message: 'Select your preferred gold amount to proceed with purchase'
    });
    
  } catch (error) {
    console.error('Initiate purchase error:', error);
    res.status(500).json({
      error: 'Failed to initiate purchase process',
      message: 'Please try again later'
    });
  }
});

// Confirm and process purchase
app.post('/api/purchase/confirm', purchaseLimiter, async (req, res) => {
  try {
    const { user_id, gold_amount, session_token, payment_method } = req.body;
    
    // Validate input
    if (!user_id || !gold_amount || !session_token) {
      return res.status(400).json({
        error: 'Missing required fields: user_id, gold_amount, session_token'
      });
    }
    
    // Validate gold amount
    const goldAmountNum = parseFloat(gold_amount);
    if (isNaN(goldAmountNum) || goldAmountNum < 0.1 || goldAmountNum > 1000) {
      return res.status(400).json({
        error: 'Invalid gold amount. Must be between 0.1 and 1000 grams'
      });
    }
    
    // Verify session
    const sessionVerification = await verifySession(session_token);
    if (!sessionVerification.valid) {
      return res.status(401).json({
        error: sessionVerification.error
      });
    }
    
    // Verify user exists
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [user_id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }
    
    const user = userResult.rows[0];
    
    // Get current gold price
    const goldPrice = await getCurrentGoldPrice();
    const totalAmount = goldAmountNum * goldPrice;
    
    // Process the purchase
    const transaction = await processPurchase(
      user_id, 
      goldAmountNum, 
      goldPrice, 
      payment_method || 'digital'
    );
    
    // Deactivate session after successful purchase
    await pool.query(
      'UPDATE sessions SET is_active = false WHERE session_token = $1',
      [session_token]
    );
    
    const currency = process.env.CURRENCY || 'INR';
    
    res.json({
      success: true,
      transaction_id: transaction.transaction_id,
      message: `Congratulations! You have successfully purchased ${goldAmountNum}g of digital gold for ${currency} ${totalAmount.toLocaleString()}`,
      transaction_details: {
        id: transaction.transaction_id,
        user_name: user.name,
        gold_amount: `${goldAmountNum}g`,
        price_per_gram: `${currency} ${goldPrice.toLocaleString()}`,
        total_amount: `${currency} ${totalAmount.toLocaleString()}`,
        purchase_date: transaction.created_at,
        status: transaction.status,
        payment_method: transaction.payment_method
      },
      portfolio_summary: {
        total_gold_owned: `${goldAmountNum}g`, // In real app, sum all user's purchases
        current_value: `${currency} ${totalAmount.toLocaleString()}`,
        storage: 'Secure Digital Vault'
      },
      next_steps: [
        'Your gold is stored securely in our digital vault',
        'You can view your portfolio anytime',
        'Track gold price movements',
        'Sell or buy more gold when ready'
      ]
    });
    
  } catch (error) {
    console.error('Confirm purchase error:', error);
    res.status(500).json({
      error: 'Failed to process purchase',
      message: 'Your payment was not processed. Please try again.'
    });
  }
});

// Get user's transaction history
app.get('/api/user/:userId/transactions', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await pool.query(
      `SELECT t.*, u.name as user_name 
       FROM transactions t
       JOIN users u ON t.user_id = u.id
       WHERE t.user_id = $1 
       ORDER BY t.created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    
    const countResult = await pool.query(
      'SELECT COUNT(*) as total FROM transactions WHERE user_id = $1',
      [userId]
    );
    
    const currency = process.env.CURRENCY || 'INR';
    
    // Calculate portfolio summary
    const summaryResult = await pool.query(
      `SELECT 
         SUM(gold_amount) as total_gold,
         SUM(total_amount) as total_invested,
         COUNT(*) as total_transactions
       FROM transactions 
       WHERE user_id = $1 AND status = 'completed'`,
      [userId]
    );
    
    const summary = summaryResult.rows[0];
    const currentGoldPrice = await getCurrentGoldPrice();
    const currentValue = summary.total_gold ? summary.total_gold * currentGoldPrice : 0;
    
    res.json({
      transactions: result.rows.map(t => ({
        ...t,
        formatted_total: `${currency} ${parseFloat(t.total_amount).toLocaleString()}`,
        formatted_gold: `${t.gold_amount}g`
      })),
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: limit,
        offset: offset,
        has_more: offset + limit < countResult.rows[0].total
      },
      portfolio_summary: {
        total_gold: summary.total_gold ? `${summary.total_gold}g` : '0g',
        total_invested: `${currency} ${parseFloat(summary.total_invested || 0).toLocaleString()}`,
        current_value: `${currency} ${currentValue.toLocaleString()}`,
        profit_loss: currentValue - (summary.total_invested || 0),
        total_transactions: summary.total_transactions,
        current_gold_price: `${currency} ${currentGoldPrice}`
      }
    });
    
  } catch (error) {
    console.error('Transaction history error:', error);
    res.status(500).json({
      error: 'Failed to retrieve transaction history'
    });
  }
});

// Get purchase analytics
app.get('/api/analytics/purchases', async (req, res) => {
  try {
    const period = req.query.period || '24h'; // 24h, 7d, 30d
    
    let interval = '24 hours';
    if (period === '7d') interval = '7 days';
    if (period === '30d') interval = '30 days';
    
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_purchases,
        SUM(total_amount) as total_revenue,
        SUM(gold_amount) as total_gold_sold,
        AVG(gold_amount) as avg_purchase_size,
        COUNT(DISTINCT user_id) as unique_buyers
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL '${interval}'
      AND status = 'completed'
    `);
    
    const topPurchases = await pool.query(`
      SELECT t.*, u.name 
      FROM transactions t
      JOIN users u ON t.user_id = u.id
      WHERE t.created_at >= NOW() - INTERVAL '${interval}'
      AND t.status = 'completed'
      ORDER BY t.total_amount DESC
      LIMIT 5
    `);
    
    res.json({
      period: period,
      summary: stats.rows[0],
      top_purchases: topPurchases.rows,
      currency: process.env.CURRENCY || 'INR'
    });
    
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve analytics'
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available_endpoints: [
      'GET /health',
      'GET /api/purchase/options',
      'POST /api/purchase/initiate',
      'POST /api/purchase/confirm',
      'GET /api/user/:userId/transactions',
      'GET /api/analytics/purchases'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Gold Purchase API running on port ${PORT}`);
  console.log(`💰 Gold Price: ${process.env.CURRENCY || 'INR'} ${process.env.GOLD_PRICE_PER_GRAM || 6500} per gram`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

module.exports = app;