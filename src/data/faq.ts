export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: 'delivery' | 'payment' | 'subscription' | 'gaming' | 'support' | 'security';
}

export const faqItems: FAQItem[] = [
  {
    id: '1',
    question: 'How fast will I receive my product?',
    answer: 'Delivery time depends on the product type, package availability, payment confirmation, and the accuracy of the submitted details. Each product card shows an estimated delivery time.',
    category: 'delivery',
  },
  {
    id: '2',
    question: 'What details do I need to provide for gaming top-ups?',
    answer: 'Gaming top-ups may require your Player ID, Server ID, region, platform, or contact information. The form clearly shows which fields are required for each product.',
    category: 'gaming',
  },
  {
    id: '3',
    question: 'Can I renew my subscription through QuickSub?',
    answer: 'Yes. The website includes renewal options for supported subscriptions. You can also contact support before expiry for renewal assistance.',
    category: 'subscription',
  },
  {
    id: '4',
    question: 'Is payment secure?',
    answer: 'The landing page uses HTTPS, trusted payment handling, clear payment instructions, and order confirmation messages. Sensitive details are not exposed in frontend code.',
    category: 'security',
  },
  {
    id: '5',
    question: 'What happens if I submit the wrong Player ID?',
    answer: 'Wrong information may delay or prevent successful delivery. The form asks you to confirm important details before final submission. Always double-check your Player ID.',
    category: 'gaming',
  },
  {
    id: '6',
    question: 'Do you offer refunds?',
    answer: 'Refund rules are clearly defined by product type. Some digital products may not be refundable after successful processing. The policy is visible before checkout.',
    category: 'payment',
  },
  {
    id: '7',
    question: 'Is QuickSub affiliated with the brands listed?',
    answer: 'QuickSub is an independent digital product and service provider. Product names, logos, and trademarks belong to their respective owners. QuickSub is not affiliated with or endorsed by those brands unless stated officially.',
    category: 'security',
  },
  {
    id: '8',
    question: 'How can I contact support?',
    answer: 'You can contact support through live chat, WhatsApp, Messenger, email, or the contact form depending on the business setup.',
    category: 'support',
  },
  {
    id: '9',
    question: 'Can I track my order?',
    answer: 'Yes. You can check whether an order is pending, processing, completed, delayed, or cancelled through the order status system.',
    category: 'delivery',
  },
  {
    id: '10',
    question: 'Do I need an account to order?',
    answer: 'Guest checkout reduces friction, but account creation helps you track orders, renew subscriptions, and save support history.',
    category: 'support',
  },
];
