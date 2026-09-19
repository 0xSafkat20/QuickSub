export const paymentMethods = [
  { id: 'bkash', name: 'bKash', category: 'Mobile wallet', color: '#E2136E', detail: 'Approve the payment in the bKash checkout.' },
  { id: 'nagad', name: 'Nagad', category: 'Mobile wallet', color: '#F26522', detail: 'Approve the payment in the Nagad checkout.' },
  { id: 'rocket', name: 'Rocket', category: 'Mobile wallet', color: '#8B2F89', detail: 'Complete the payment through Rocket.' },
  { id: 'visa', name: 'Visa', category: 'Debit / credit card', color: '#1A1F71', detail: 'Enter card details only on the secure payment provider page.' },
  { id: 'mastercard', name: 'Mastercard', category: 'Debit / credit card', color: '#EB001B', detail: 'Enter card details only on the secure payment provider page.' },
  { id: 'bank', name: 'Bank Transfer', category: 'Bank payment', color: '#2563EB', detail: 'Use the bank instructions provided at checkout. Confirmation may require review.' },
] as const;
export type PaymentMethodId = typeof paymentMethods[number]['id'];
