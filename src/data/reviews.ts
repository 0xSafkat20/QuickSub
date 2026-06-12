export interface Review {
  id: string;
  name: string;
  rating: number;
  review: string;
  product?: string;
  initials: string;
}

export const reviews: Review[] = [
  {
    id: '1',
    name: 'Rahim Ahmed',
    rating: 5,
    review: 'Ordered Spotify Premium and got clear instructions quickly. The process felt simple and support replied when I had a setup question.',
    product: 'Spotify Premium',
    initials: 'RA',
  },
  {
    id: '2',
    name: 'Sadia Islam',
    rating: 5,
    review: 'I bought Freefire Diamonds through QuickSub. The form was easy, and I liked that the page reminded me to check my Player ID.',
    product: 'Freefire Diamonds',
    initials: 'SI',
  },
  {
    id: '3',
    name: 'Tanvir Hasan',
    rating: 4,
    review: 'PUBG UC order experience was smooth. I would like even more package options, but the delivery update was helpful.',
    product: 'PUBG UC',
    initials: 'TH',
  },
  {
    id: '4',
    name: 'Nusrat Jahan',
    rating: 5,
    review: 'The product page made it easy to compare Netflix and ChatGPT subscription options. Very clean and professional.',
    product: 'Netflix Premium',
    initials: 'NJ',
  },
  {
    id: '5',
    name: 'Arif Mahmud',
    rating: 5,
    review: 'I used the chat option before ordering Mobile Legend Coins. Support helped me understand which details were needed.',
    product: 'Mobile Legend Coins',
    initials: 'AM',
  },
];
