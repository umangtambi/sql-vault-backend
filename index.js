require('dotenv').config();
const express = require('express');
const Razorpay = require('razorpay');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors({
    origin: '*', // In production, replace '*' with your actual frontend domain
    methods: ['POST', 'GET'],
    credentials: true
}));
app.use(express.json());

// Initialize Razorpay
// Ensure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set in Railway Variables
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Health check route to verify the server is running
app.get('/', (req, res) => {
    res.send('SQLVault Backend is Live!');
});

// Order creation route
app.post('/create-order', async (req, res) => {
  try {
    const options = {
      amount: 34900, // Amount in paise (349 INR)
      currency: 'INR',
      receipt: 'order_receipt_' + Date.now(),
    };
    
    const order = await razorpay.orders.create(options);
    
    // Send back the order details
    res.json({
      success: true,
      id: order.id,
      amount: order.amount,
      currency: order.currency
    });
  } catch (err) {
    console.error('Razorpay Error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create order', 
      error: err.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
