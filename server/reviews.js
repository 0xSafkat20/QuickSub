const express = require('express');
const { fail, run } = require('./http');
const { uuid } = require('./validation');

function createReviews({ db, customers, rate }) {
  const router = express.Router();

  router.get('/reviews', run(async (req, res) => {
    rate(req, 'public-reviews', 60);
    const productId = typeof req.query.productId === 'string' ? req.query.productId.trim() : '';
    if (productId && !/^[a-zA-Z0-9_-]{1,80}$/.test(productId)) throw fail(400, 'Invalid product.');
    const filter = productId ? `&product_id=eq.${encodeURIComponent(productId)}` : '';
    const rows = await db(`quicksub_reviews?select=id,product_id,product_name,display_name,rating,comment,created_at${filter}&order=created_at.desc&limit=100`);
    const reviews = rows.map(row => ({ ...row, verifiedPurchase: true }));
    const average = reviews.length
      ? Number((reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length).toFixed(1))
      : 0;
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({ reviews, summary: { count: reviews.length, average } });
  }));

  router.post('/account/reviews', run(async (req, res) => {
    rate(req, 'save-review', 10);
    const person = await customers.user(req);
    const orderId = req.body?.orderId;
    const rating = Number(req.body?.rating);
    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
    if (!uuid.test(orderId) || !Number.isInteger(rating) || rating < 1 || rating > 5 || comment.length < 10 || comment.length > 1000)
      throw fail(400, 'Choose 1–5 stars and write a comment between 10 and 1,000 characters.');
    let review;
    try {
      review = await db('rpc/quicksub_save_review', {
        method: 'POST',
        body: { p_user: person.id, p_order: orderId, p_rating: rating, p_comment: comment },
      });
    } catch (error) {
      if (error.status === 409) throw fail(409, 'Only a paid, delivered purchase from your account can be reviewed.');
      throw error;
    }
    res.status(201).json({ review: { ...review, verifiedPurchase: true } });
  }));

  return router;
}

module.exports = { createReviews };
