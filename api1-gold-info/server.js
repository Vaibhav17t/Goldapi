// api1-gold-info/server.js
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');
const OpenAI = require('openai');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password123@localhost:5432/goldtrading'
});

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Gold facts database
const GOLD_FACTS = [
  "Gold has been used as a store of value for over 4,000 years.",
  "India is the world's second-largest consumer of gold after China.",
  "Gold prices have increased over 300% in the last 20 years.",
  "Digital gold allows you to invest in gold without physical storage concerns.",
  "Gold is considered a hedge against inflation and economic uncertainty.",
  "1 gram of gold can be beaten into a sheet covering 1 square meter.",
  "Gold is one of the least reactive chemical elements, making it highly durable.",
  "Central banks worldwide hold approximately 35,000 tonnes of gold reserves.",
  "Gold's chemical symbol 'Au' comes from the Latin word 'aurum' meaning 'shining dawn'.",
  "The largest gold nugget ever found weighed 2,520 troy ounces (78 kg)."
];

// System prompt for OpenAI
const SYSTEM_PROMPT = `You are a gold investment expert and digital gold trading assistant. Your role is to:

1. ANALYZE user messages to determine if they're asking about gold, investments, precious metals, or related topics
2. PROVIDE helpful, accurate information about gold investments and digital gold
3. ENCOURAGE users to consider digital gold investment when appropriate
4. RESPOND professionally but in a friendly, conversational tone

Current gold price: ₹${process.env.GOLD_PRICE_PER_GRAM || 6500} per gram

For your response, you must return a JSON object with this exact structure:
{
  "is_gold_related": boolean,
  "confidence": number (0-1),
  "response": "your main response text",
  "intent_summary": "brief summary of what user is asking",
  "purchase_recommendation": "suggestion about investing in digital gold (only if gold-related)"
}

Guidelines:
- If query is about gold/investment: Set is_gold_related to true and provide helpful gold information
- If query is not about gold: Set is_gold_related to false and politely redirect to gold topics
- Always be encouraging about digital gold investment opportunities
- Keep responses concise but informative (2-3 sentences max)
- Include current price information when relevant`;

// OpenAI intent detection and response generation
async function analyzeWithOpenAI(userMessage, conversationHistory = []) {
  try {
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...conversationHistory,
      { role: "user", content: userMessage }
    ];

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
      messages: messages,
      temperature: 0.7,
      max_tokens: 300
    });

    const responseText = completion.choices[0].message.content;
    
    // Try to parse JSON response
    try {
      const jsonResponse = JSON.parse(responseText);
      return jsonResponse;
    } catch (parseError) {
      // Fallback if JSON parsing fails
      return {
        is_gold_related: userMessage.toLowerCase().includes('gold'),
        confidence: 0.5,
        response: responseText,
        intent_summary: "Unable to parse structured response",
        purchase_recommendation: "Consider investing in digital gold for portfolio diversification"
      };
    }
  } catch (error) {
    console.error('OpenAI API Error:', error);
    
    // Fallback to simple keyword detection
    const isGoldRelated = userMessage.toLowerCase().includes('gold') || 
                         userMessage.toLowerCase().includes('invest') ||
                         userMessage.toLowerCase().includes('price');
    
    return {
      is_gold_related: isGoldRelated,
      confidence: 0.3,
      response: isGoldRelated 
        ? "I'd be happy to help with gold investment information! Current gold price is ₹" + (process.env.GOLD_PRICE_PER_GRAM || 6500) + " per gram."
        : "I specialize in gold investment and digital gold trading. How can I help you with gold investments today?",
      intent_summary: "Fallback response due to API error",
      purchase_recommendation: isGoldRelated ? "Digital gold is a convenient way to invest in gold without storage concerns." : null
    };
  }
}

// Generate session token
function generateSessionToken(userId = null) {
  const payload = {
    sessionId: Math.random().toString(36).substring(2, 15),
    userId: userId,
    timestamp: Date.now()
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET || 'gold-trading-secret-key-2025', {
    expiresIn: '1h'
  });
}

// Get random gold fact
function getRandomGoldFact() {
  return GOLD_FACTS[Math.floor(Math.random() * GOLD_FACTS.length)];
}

// Store session in database
async function storeSession(sessionToken, userId = null, userMessage = null) {
  try {
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now
    
    await pool.query(
      `INSERT INTO sessions (session_token, user_id, intent_confirmed, expires_at, user_message) 
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionToken, userId, true, expiresAt, userMessage]
    );
  } catch (error) {
    console.error('Error storing session:', error);
  }
}

// Store conversation history
async function storeConversation(userId, message, response, isGoldRelated) {
  try {
    await pool.query(
      `INSERT INTO conversations (user_id, user_message, ai_response, is_gold_related, created_at) 
       VALUES ($1, $2, $3, $4, NOW())`,
      [userId, message, response, isGoldRelated]
    );
  } catch (error) {
    console.error('Error storing conversation:', error);
  }
}

// Get user conversation history
async function getConversationHistory(userId, limit = 5) {
  try {
    if (!userId) return [];
    
    const result = await pool.query(
      `SELECT user_message, ai_response FROM conversations 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );
    
    // Convert to OpenAI message format
    const history = [];
    result.rows.reverse().forEach(row => {
      history.push({ role: "user", content: row.user_message });
      history.push({ role: "assistant", content: row.ai_response });
    });
    
    return history;
  } catch (error) {
    console.error('Error getting conversation history:', error);
    return [];
  }
}

// Routes

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await pool.query('SELECT 1');
    
    res.json({
      status: 'healthy',
      service: 'Gold Information API',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      features: {
        database: 'connected',
        openai: process.env.OPENAI_API_KEY ? 'configured' : 'missing'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Main chat endpoint with OpenAI integration
app.post('/api/chat', async (req, res) => {
  try {
    const { message, user_id } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Message is required and must be a string'
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: 'OpenAI API key not configured',
        fallback: 'Service temporarily unavailable'
      });
    }

    // Get conversation history for context
    const conversationHistory = await getConversationHistory(user_id);
    
    // Analyze message with OpenAI
    const aiAnalysis = await analyzeWithOpenAI(message, conversationHistory);
    
    if (aiAnalysis.is_gold_related) {
      // Generate session token for potential purchase flow
      const sessionToken = generateSessionToken(user_id);
      
      // Store session in database
      await storeSession(sessionToken, user_id, message);
      
      // Get current gold price
      const currentGoldPrice = process.env.GOLD_PRICE_PER_GRAM || 6500;
      const currency = process.env.CURRENCY || 'INR';
      
      // Enhanced response for gold-related queries
      const response = {
        is_gold_related: true,
        confidence: aiAnalysis.confidence,
        intent_summary: aiAnalysis.intent_summary,
        response: aiAnalysis.response,
        gold_fact: getRandomGoldFact(),
        purchase_nudge: aiAnalysis.purchase_recommendation || `💰 Ready to invest in digital gold? Start with as little as ${currency} 100!`,
        session_token: sessionToken,
        current_price: {
          amount: currentGoldPrice,
          currency: currency,
          per_unit: 'gram',
          last_updated: new Date().toISOString()
        },
        investment_options: [
          { amount: '1g', price: currentGoldPrice, label: 'Starter' },
          { amount: '5g', price: currentGoldPrice * 5, label: 'Popular' },
          { amount: '10g', price: currentGoldPrice * 10, label: 'Premium' }
        ],
        next_step: "Interested in purchasing? Say 'yes' or 'I want to buy' to get started!",
        api2_endpoint: process.env.API2_URL || 'http://localhost:3002'
      };
      
      // Store conversation
      await storeConversation(user_id, message, aiAnalysis.response, true);
      
      res.json(response);
      
    } else {
      // Non-gold related query - educational redirect
      const response = {
        is_gold_related: false,
        intent_summary: aiAnalysis.intent_summary,
        response: aiAnalysis.response,
        educational_info: {
          did_you_know: getRandomGoldFact(),
          current_gold_price: `${process.env.CURRENCY || 'INR'} ${process.env.GOLD_PRICE_PER_GRAM || 6500} per gram`
        },
        suggestions: [
          "What is the current gold price?",
          "How do I invest in digital gold?",
          "Is gold a good investment?",
          "What are the benefits of digital gold?",
          "Show me gold investment options"
        ]
      };
      
      // Store conversation
      await storeConversation(user_id, message, aiAnalysis.response, false);
      
      res.json(response);
    }
    
  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Please try again later'
    });
  }
});

// Get user conversation history endpoint
app.get('/api/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await pool.query(
      `SELECT user_message, ai_response, is_gold_related, created_at 
       FROM conversations 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );
    
    res.json({
      conversations: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    console.error('History endpoint error:', error);
    res.status(500).json({
      error: 'Failed to retrieve conversation history'
    });
  }
});

// Analytics endpoint
app.get('/api/analytics', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_conversations,
        COUNT(*) FILTER (WHERE is_gold_related = true) as gold_related_conversations,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT user_id) FILTER (WHERE is_gold_related = true) as interested_users
      FROM conversations
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `);
    
    const sessionStats = await pool.query(`
      SELECT COUNT(*) as active_sessions
      FROM sessions 
      WHERE expires_at > NOW()
    `);
    
    res.json({
      last_24_hours: stats.rows[0],
      active_sessions: sessionStats.rows[0].active_sessions,
      conversion_rate: stats.rows[0].total_conversations > 0 
        ? (stats.rows[0].gold_related_conversations / stats.rows[0].total_conversations * 100).toFixed(2) + '%'
        : '0%'
    });
    
  } catch (error) {
    console.error('Analytics endpoint error:', error);
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
      'POST /api/chat',
      'GET /api/history/:userId',
      'GET /api/analytics'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Gold Information API running on port ${PORT}`);
  console.log(`🤖 OpenAI Integration: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Missing API Key'}`);
  console.log(`💰 Gold Price: ${process.env.CURRENCY || 'INR'} ${process.env.GOLD_PRICE_PER_GRAM || 6500} per gram`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await pool.end();
  process.exit(0);
});

module.exports = app;