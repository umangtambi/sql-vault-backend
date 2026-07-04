require('dotenv').config();
const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const cors = require('cors');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const PDF_LINK = process.env.PDF_DOWNLOAD_LINK || 'https://drive.google.com/file/d/17t9TVLoeR9iwNb19X1OKdDG2iGecYLNP/view?usp=sharing';

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'SQLVault Backend is Live!' });
});

app.post('/create-order', async (req, res) => {
  try {
    const order = await razorpay.orders.create({
      amount: 34900,
      currency: 'INR',
      receipt: 'rcpt_' + Date.now(),
    });
    res.json({ success: true, id: order.id, amount: order.amount, currency: order.currency });
  } catch (err) {
    console.error('create-order error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/verify-payment', (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expected === razorpay_signature) {
    console.log('Payment verified:', razorpay_payment_id);
    res.json({ success: true, payment_id: razorpay_payment_id, download_link: PDF_LINK });
  } else {
    console.warn('Invalid signature:', razorpay_payment_id);
    res.status(400).json({ success: false, message: 'Payment verification failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('SQLVault backend running on port ' + PORT));
