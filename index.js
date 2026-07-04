require('dotenv').config();
const express = require('express');
const Razorpay = require('razorpay');
const crypto  = require('crypto');
const cors    = require('cors');

const app = express();

// CORS — allow all origins for now, restrict after testing
app.use(cors({
  origin: '*',
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors()); // handle preflight

app.use(express.json());

// Razorpay
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// PDF link — set as Railway env variable: PDF_DOWNLOAD_LINK
const PDF_LINK = process.env.PDF_DOWNLOAD_LINK ||
  'https://drive.google.com/file/d/17t9TVLoeR9iwNb19X1OKdDG2iGecYLNP/view?usp=sharing';

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'SQLVault Backend is Live!' });
});

// Step 1: Create order
app.post('/create-order', async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount:   34900, // ₹349 in paise — hardcoded server-side
      currency: 'INR',
      receipt:  'rcpt_' + Date.now(),
    });
    console.log('[create-order] Created:', order.id);
    res.json({
      success:  true,
      id:       order.id,
      amount:   order.amount,
      currency: order.currency,
    });
  } catch (err) {
    console.error('[create-order] Error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to create order', error: err.message });
  }
});

// Step 2: Verify payment signature
app.post('/verify-payment', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ success: false, message: 'Missing payment fields' });
  }

  try {
    const body     = razorpay_order_id + '|' + razorpay_payment_id;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    // timing-safe comparison to prevent timing attacks
    const sigBuffer = Buffer.from(razorpay_signature, 'hex');
    const expBuffer = Buffer.from(expected, 'hex');

    if (sigBuffer.length !== expBuffer.length ||
        !crypto.timingSafeEqual(expBuffer, sigBuffer)) {
      console.warn('[verify-payment] INVALID signature:', razorpay_payment_id);
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    console.log('[verify-payment] ✓ Verified:', razorpay_payment_id);
    res.json({
      success:       true,
      payment_id:    razorpay_payment_id,
      download_link: PDF_LINK,
    });
  } catch (err) {
    console.error('[verify-payment] Error:', err.message);
    res.status(500).json({ success: false, message: 'Server error during verification' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SQLVault backend on port ${PORT}`));
