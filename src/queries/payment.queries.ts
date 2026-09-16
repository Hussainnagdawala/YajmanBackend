export const createPayment = `
  INSERT INTO payments (order_id, razorpay_order_id, amount, currency, status)
  VALUES ($1, $2, $3, 'INR', 'created')
  RETURNING *
`;

export const findPaymentByRazorpayOrderId = `
  SELECT * FROM payments WHERE razorpay_order_id = $1
`;

export const findPaymentByRazorpayPaymentId = `
  SELECT * FROM payments WHERE razorpay_payment_id = $1
`;

export const markPaymentCaptured = `
  UPDATE payments SET
    razorpay_payment_id = $2,
    razorpay_signature = $3,
    method = $4,
    status = 'captured',
    paid_at = NOW(),
    updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;

export const markPaymentFailed = `
  UPDATE payments SET
    status = 'failed',
    error_code = $2,
    error_description = $3,
    error_reason = $4,
    updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;

export const markPaymentRefunded = `
  UPDATE payments SET
    status = 'refunded',
    refunded_at = NOW(),
    refund_amount = $2,
    refund_id = $3,
    updated_at = NOW()
  WHERE id = $1
  RETURNING *
`;

export const storeWebhookRawResponse = `
  UPDATE payments SET raw_response = $2, updated_at = NOW() WHERE id = $1
`;
