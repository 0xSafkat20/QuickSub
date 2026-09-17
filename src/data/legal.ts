export interface LegalDocument {
  title: string;
  lastUpdated: string;
  sections: { heading: string; body: string }[];
}

export const legalDocuments: Record<string, LegalDocument> = {
  'Terms and Conditions': {
    title: 'Terms and Conditions',
    lastUpdated: 'June 2026',
    sections: [
      {
        heading: '1. Acceptance of Terms',
        body: 'By accessing or using QuickSub, you agree to these Terms and Conditions. If you do not agree, please do not use our services.',
      },
      {
        heading: '2. Services',
        body: 'QuickSub provides digital subscription access, gaming top-ups, and AI tool subscriptions. Product availability, pricing, and delivery times may change without prior notice.',
      },
      {
        heading: '3. Orders and Payment',
        body: 'All orders are subject to payment verification. You must provide accurate account or game details. QuickSub reserves the right to cancel orders with incorrect or incomplete information.',
      },
      {
        heading: '4. Delivery',
        body: 'Delivery times shown on product cards are estimates. Most orders are processed within the stated window after payment confirmation. Delays may occur during high demand or verification checks.',
      },
      {
        heading: '5. Account Responsibility',
        body: 'You are responsible for maintaining the security of your accounts and for all activity under your order details. QuickSub is not liable for issues caused by incorrect information you provide.',
      },
      {
        heading: '6. Limitation of Liability',
        body: 'QuickSub is an independent reseller and is not affiliated with the brands listed unless stated otherwise. We are not responsible for third-party service outages, policy changes, or account restrictions imposed by original providers.',
      },
    ],
  },
  'Privacy Policy': {
    title: 'Privacy Policy',
    lastUpdated: 'June 2026',
    sections: [
      {
        heading: 'Information We Collect',
        body: 'We collect information you provide when ordering (name, contact details, game IDs, payment references) and technical data such as browser type and page visits.',
      },
      {
        heading: 'How We Use Your Data',
        body: 'Your data is used to process orders, provide customer support, send order updates, and improve our services. We do not sell your personal information to third parties.',
      },
      {
        heading: 'AI Support Chat',
        body: 'When you send a support chat message, its text and recent conversation context are sent to Google Gemini to generate a reply. Do not share passwords, OTPs, payment PINs or card details. QuickSub keeps recent chat context temporarily in server memory, expires it after 30 minutes of inactivity, and removes expired sessions on subsequent chat requests. AI replies can be inaccurate; human support confirms package prices and handles payments and orders. Provider processing is subject to Google Gemini data policies.',
      },
      {
        heading: 'Data Storage',
        body: 'Order-related data is stored securely and retained only as long as needed for support, legal compliance, and dispute resolution.',
      },
      {
        heading: 'Your Rights',
        body: 'You may request access to, correction of, or deletion of your personal data by contacting our support team. We will respond within a reasonable timeframe.',
      },
      {
        heading: 'Contact',
        body: 'For privacy-related inquiries, reach us via WhatsApp or email listed in the Contact section.',
      },
    ],
  },
  'Refund Policy': {
    title: 'Refund Policy',
    lastUpdated: 'June 2026',
    sections: [
      {
        heading: 'General Policy',
        body: 'Due to the digital nature of our products, refunds are generally not available once an order has been successfully delivered or activated.',
      },
      {
        heading: 'Eligible Refund Cases',
        body: 'Refunds may be considered if: the order was not delivered within the promised timeframe, the wrong product was delivered, or a duplicate charge occurred.',
      },
      {
        heading: 'Non-Refundable Cases',
        body: 'Refunds are not provided for: incorrect player IDs or account details submitted by the customer, account bans by game or service providers, or change of mind after successful delivery.',
      },
      {
        heading: 'How to Request',
        body: 'Contact support within 48 hours of your order with your order ID and payment proof. Each case is reviewed individually.',
      },
    ],
  },
  'Delivery Policy': {
    title: 'Delivery Policy',
    lastUpdated: 'June 2026',
    sections: [
      {
        heading: 'Delivery Method',
        body: 'All products are delivered digitally. Subscriptions are activated on your account or shared via secure credentials. Gaming top-ups are credited directly to your game account.',
      },
      {
        heading: 'Delivery Times',
        body: 'Estimated delivery times are shown on each product card. Most orders complete within 15 minutes to 2 hours depending on product type and verification requirements.',
      },
      {
        heading: 'Order Tracking',
        body: 'Use the Track Order feature in the header with your order ID to check status: Pending, Processing, or Delivered.',
      },
      {
        heading: 'Failed Deliveries',
        body: 'If delivery fails due to incorrect details, our team will contact you to verify information. Repeated failed attempts may result in order cancellation.',
      },
    ],
  },
  'Disclaimer': {
    title: 'Disclaimer',
    lastUpdated: 'June 2026',
    sections: [
      {
        heading: 'Brand Independence',
        body: 'QuickSub is an independent digital product provider. All product names, logos, and trademarks belong to their respective owners. QuickSub is not affiliated with, endorsed by, or sponsored by Netflix, Spotify, PUBG, OpenAI, or any other listed brand unless officially stated.',
      },
      {
        heading: 'Service Availability',
        body: 'We do not guarantee uninterrupted access to third-party services. Outages, regional restrictions, and policy changes by original providers are outside our control.',
      },
      {
        heading: 'Pricing',
        body: 'Prices displayed are starting prices in BDT and may vary by package duration or quantity. Final pricing is confirmed at the time of order.',
      },
    ],
  },
  'Cookie Policy': {
    title: 'Cookie Policy',
    lastUpdated: 'June 2026',
    sections: [
      {
        heading: 'What We Use',
        body: 'QuickSub uses browser local storage to remember your saved products (favorites) and cookie consent preference. We do not use third-party advertising or analytics tracking cookies.',
      },
      {
        heading: 'Managing Preferences',
        body: 'You can clear local storage through your browser settings at any time. This will reset your saved products and cookie consent choice.',
      },
      {
        heading: 'Newsletter',
        body: 'If you subscribe to our newsletter, your email is stored securely via Supabase and used only for promotional updates. You can unsubscribe at any time.',
      },
    ],
  },
};

export const legalLinkMap: Record<string, string> = {
  'Terms and Conditions': 'Terms and Conditions',
  'Privacy Policy': 'Privacy Policy',
  'Refund Policy': 'Refund Policy',
  'Delivery Policy': 'Delivery Policy',
  'Disclaimer': 'Disclaimer',
  'Cookie Policy': 'Cookie Policy',
};
