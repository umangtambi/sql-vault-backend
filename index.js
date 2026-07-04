require('dotenv').config();
const express = require('express');
const Razorpay = require('razorpay');
const crypto  = require('crypto'); // built-in Node.js — no install needed
const cors    = require('cors');

const app = express();

// ── CORS ─────────────────────────────────────────────────────────────────────
// Only allow requests from your actual frontend domain
const ALLOWED_ORIGINS = [
  'https://sqlvault.in',
  'https://www.sqlvault.in',
  'https://sqlvault.netlify.app',
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (curl, Postman, mobile apps)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error('CORS: origin not allowed — ' + origin));
  },
  methods: ['POST', 'GET', 'OPTIONS'],
  credentials: true,
}));

app.use(express.json());

// ── Razorpay init ─────────────────────────────────────────────────────────────
const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── PDF download link — stored only on backend, never in frontend HTML ────────
const PDF_DOWNLOAD_LINK = process.env.PDF_DOWNLOAD_LINK ||
  'https://drive.google.com/file/d/17t9TVLoeR9iwNb19X1OKdDG2iGecYLNP/view?usp=sharing';

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'SQLVault Backend is Live!' });
});

// ── STEP 1: Create Razorpay order ─────────────────────────────────────────────
// Frontend calls this first → gets back an order_id
app.post('/create-order', async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount:   34900,               // ₹349 in paise — hardcoded, not from client
      currency: 'INR',
      receipt:  'rcpt_' + Date.now(),
    });

    res.json({
      success:  true,
      id:       order.id,
      amount:   order.amount,
      currency: order.currency,
    });
  } catch (err) {
    console.error('[create-order] Razorpay error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to create order' });
  }
});

// ── STEP 2: Verify payment signature + return PDF link ───────────────────────
// Frontend calls this after Razorpay payment succeeds
// Razorpay docs: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/build-integration/#14-verify-the-signature
app.post('/verify-payment', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ success: false, message: 'Missing payment fields' });
  }

  try {
    // Razorpay signature = HMAC-SHA256(order_id + "|" + payment_id, key_secret)
    const body      = razorpay_order_id + '|' + razorpay_payment_id;
    const expected  = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(razorpay_signature, 'hex')
    );

    if (!isValid) {
      console.warn('[verify-payment] Signature mismatch — possible tampering', {
        razorpay_order_id,
        razorpay_payment_id,
      });
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    // Signature valid — payment is genuine
    console.log('[verify-payment] ✓ Payment verified:', razorpay_payment_id);

    // Return the PDF link — only after verification
    res.json({
      success:       true,
      payment_id:    razorpay_payment_id,
      download_link: PDF_DOWNLOAD_LINK,
    });

  } catch (err) {
    console.error('[verify-payment] Error:', err.message);
    res.status(500).json({ success: false, message: 'Verification error' });
  }
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SQLVault backend running on port ${PORT}`);
});
