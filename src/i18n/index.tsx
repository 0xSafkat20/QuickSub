import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Locale = 'en-BD' | 'bn-BD';
type Variables = Record<string, string | number>;
const STORAGE_KEY = 'quicksub-locale';
export const REFERRAL_KEY = 'quicksub-referral';
const readStorage = (key:string) => { try { return window.localStorage.getItem(key); } catch { return null; } };
const writeStorage = (key:string,value:string) => { try { window.localStorage.setItem(key,value); } catch { /* Preferences remain available for this page session. */ } };

const bn: Record<string,string> = {
  'language.english':'English','language.bangla':'বাংলা','language.choose':'ভাষা নির্বাচন করুন',
  'nav.home':'হোম','nav.products':'পণ্য','nav.deals':'অফার','nav.how':'কীভাবে কাজ করে','nav.reviews':'রিভিউ','nav.faq':'সাধারণ প্রশ্ন','nav.contact':'যোগাযোগ',
  'nav.account':'আমার অ্যাকাউন্ট','nav.cart':'আমার কার্ট','nav.track':'অর্ডার ট্র্যাক করুন','nav.order':'এখনই অর্ডার করুন','nav.browse':'পণ্য দেখুন',
  'header.fast':'দ্রুত ডিজিটাল ডেলিভারি','header.secure':'নিরাপদ পেমেন্ট','header.support':'সহায়তা পাওয়া যাচ্ছে',
  'common.loading':'লোড হচ্ছে…','common.refresh':'রিফ্রেশ','common.retry':'আবার চেষ্টা করুন','common.save':'সংরক্ষণ করুন','common.backStore':'স্টোরে ফিরে যান',
  'common.previous':'আগের','common.next':'পরের','common.copy':'কপি করুন','common.copied':'কপি হয়েছে','common.share':'শেয়ার করুন',
  'common.dismiss':'বন্ধ করুন','common.status':'অবস্থা','common.order':'অর্ডার','common.daysRemaining':'{count} দিন বাকি','common.deviceCount':'সর্বোচ্চ {count}টি ডিভাইস',
  'account.title':'আমার অ্যাকাউন্ট','account.subtitle':'আপনার সংরক্ষিত কার্ট, অর্ডার ও অ্যাকাউন্টের তথ্য এক জায়গায়।',
  'account.welcome':'আবার স্বাগতম','account.create':'অ্যাকাউন্ট তৈরি করুন','account.name':'আপনার নাম','account.email':'ইমেইল','account.password':'পাসওয়ার্ড',
  'account.signin':'সাইন ইন','account.signup':'অ্যাকাউন্ট তৈরি করুন','account.signout':'সাইন আউট','account.saved':'সংরক্ষিত তথ্য','account.contact':'যোগাযোগের ইমেইল বা ফোন',
  'account.reminders':'আমার অ্যাকাউন্টে নবায়নের রিমাইন্ডার দেখান','account.saveProfile':'প্রোফাইল সংরক্ষণ করুন','account.orders':'অর্ডারের ইতিহাস',
  'account.noOrders':'এখনও কোনো অর্ডার নেই। সাইন ইন করে করা কেনাকাটা এখানে দেখা যাবে।','account.delete':'অর্ডার মুছুন','account.buyAgain':'আবার কিনুন',
  'cart.eyebrow':'আপনার অ্যাকাউন্টে সংরক্ষিত','cart.title':'আমার কার্ট','cart.subtitle':'সাইন ইন করলে যেকোনো ডিভাইসে আপনার প্যাকেজ ও ডেলিভারির তথ্য প্রস্তুত থাকবে।','cart.refresh':'কার্ট রিফ্রেশ করুন',
  'cart.loading':'আপনার কার্ট লোড হচ্ছে…','cart.signinTitle':'কার্ট খুলতে সাইন ইন করুন','cart.signinText':'সাইন আউট করলেও সংরক্ষিত প্যাকেজ আপনার অ্যাকাউন্টে থাকবে।','cart.signin':'আমার কার্টে সাইন ইন করুন',
  'cart.empty':'আপনার কার্ট খালি','cart.emptyText':'একটি পণ্য ও প্যাকেজ বেছে চেকআউট পেজে “কার্টে যোগ করুন” চাপুন।','cart.browse':'পণ্য দেখুন','cart.unavailable':'বর্তমানে পাওয়া যাচ্ছে না। পরে জন্য রেখে দিতে বা সরিয়ে দিতে পারেন।',
  'cart.delivery':'ডেলিভারি','cart.checkout':'পর্যালোচনা ও চেকআউট','cart.alternatives':'বিকল্প দেখুন','cart.remove':'সরিয়ে দিন','cart.removing':'সরানো হচ্ছে…','cart.summary':'কার্টের সারাংশ',
  'cart.savedCount':'২০টির মধ্যে {count}টি প্যাকেজ সংরক্ষিত','cart.subtotal':'পাওয়া যাচ্ছে এমন পণ্যের মোট','cart.priceNote':'পেমেন্টের আগে মূল্য আবার যাচাই করা হয়। প্রতিটি প্যাকেজের আলাদা অর্ডার ও পেমেন্ট থাকে।','cart.orderNote':'অর্ডার তৈরি হলেই পণ্যটি কার্ট থেকে সরে যাবে। অপেক্ষমাণ অর্ডার অ্যাকাউন্টে থাকবে।','cart.orders':'আমার অর্ডার দেখুন',
  'tracking.title':'আপনার অর্ডার ট্র্যাক করুন','tracking.subtitle':'অর্ডার আইডি ও ব্যক্তিগত রসিদ কোড দিয়ে পেমেন্ট নিশ্চিতকরণ ও ডেলিভারি দেখুন।','tracking.signedIn':'সাইন ইন করে কিনেছেন?','tracking.history':'অর্ডারের ইতিহাস দেখুন','tracking.continue':'কেনাকাটা চালিয়ে যান',
  'password.back':'সাইন ইনে ফিরে যান','password.forgotTitle':'পাসওয়ার্ড ভুলে গেছেন?','password.resetTitle':'পাসওয়ার্ড পুনরায় সেট করুন','password.forgotText':'অ্যাকাউন্টের ইমেইল লিখুন, আমরা একটি নিরাপদ রিসেট লিংক পাঠাব।','password.resetText':'অন্তত ১০ অক্ষরের একটি শক্তিশালী পাসওয়ার্ড বেছে নিন।','password.new':'নতুন পাসওয়ার্ড','password.confirm':'নতুন পাসওয়ার্ড নিশ্চিত করুন','password.wait':'অনুগ্রহ করে অপেক্ষা করুন…','password.save':'নতুন পাসওয়ার্ড সংরক্ষণ করুন','password.send':'রিসেট লিংক পাঠান','password.request':'নতুন রিসেট লিংক চান','password.signinNew':'নতুন পাসওয়ার্ড দিয়ে সাইন ইন করুন','password.another':'অন্য ইমেইল চেষ্টা করুন',
  'subscriptions.title':'আমার সাবস্ক্রিপশন','subscriptions.subtitle':'পেমেন্ট নিশ্চিত হলে অ্যাক্সেসের মেয়াদ শুরু হয়।','subscriptions.reminders':'নবায়নের রিমাইন্ডার','subscriptions.all':'সব','subscriptions.active':'সক্রিয়','subscriptions.upcoming':'আসন্ন','subscriptions.expired':'মেয়াদ শেষ','subscriptions.suspended':'স্থগিত','subscriptions.cancelled':'বাতিল','subscriptions.loading':'সাবস্ক্রিপশন লোড হচ্ছে…','subscriptions.emptyGroup':'এই গ্রুপে কোনো সাবস্ক্রিপশন নেই।','subscriptions.empty':'পেইড সাবস্ক্রিপশন কেনাকাটা এখানে স্বয়ংক্রিয়ভাবে দেখা যাবে।','subscriptions.details':'বিস্তারিত দেখুন','subscriptions.renew':'নবায়ন করুন','subscriptions.opening':'খোলা হচ্ছে…','subscriptions.detailTitle':'সাবস্ক্রিপশনের বিস্তারিত','subscriptions.back':'আমার অ্যাকাউন্টে ফিরে যান','subscriptions.access':'অ্যাক্সেসের মেয়াদ','subscriptions.confirmed':'পেমেন্ট নিশ্চিত হয়েছে {date}','subscriptions.devices':'ডিভাইস অ্যাক্সেস','subscriptions.assigned':'নির্ধারিত অ্যাকাউন্ট','subscriptions.instructions':'অ্যাক্সেসের নির্দেশনা','subscriptions.receipt':'রসিদ ডাউনলোড করুন','subscriptions.preparing':'প্রস্তুত হচ্ছে…','subscriptions.renewFull':'সাবস্ক্রিপশন নবায়ন করুন',
  'checkout.title':'আপনার অর্ডার সম্পূর্ণ করুন','checkout.subtitle':'একটি প্যাকেজ বেছে নিন, ডেলিভারি তথ্য দিন, তারপর পেমেন্টে যান।',
  'checkout.summary':'অর্ডারের সারাংশ','checkout.details':'প্যাকেজ ও ডেলিভারির তথ্য','checkout.choosePackage':'আপনার প্যাকেজ বেছে নিন',
  'checkout.name':'আপনার নাম','checkout.contact':'ইমেইল বা ফোন নম্বর','checkout.receiptEmail':'রসিদের ইমেইল','checkout.note':'ডেলিভারির তথ্য (ঐচ্ছিক)',
  'checkout.addCart':'কার্টে যোগ করুন','checkout.payment':'পেমেন্টে যান · {amount}','checkout.creating':'অর্ডার তৈরি হচ্ছে…','checkout.savedDetails':'আমার সংরক্ষিত তথ্য ব্যবহার করুন',
  'checkout.signin':'সাইন ইন বা অ্যাকাউন্ট তৈরি করুন','checkout.points':'রিওয়ার্ড পয়েন্ট ব্যবহার করুন','checkout.pointsHelp':'ন্যূনতম {minimum} পয়েন্ট; এই অর্ডারে সর্বোচ্চ {maximum} পয়েন্ট।',
  'checkout.discount':'পয়েন্ট ছাড়','checkout.total':'পরিশোধযোগ্য মোট','checkout.receipt':'পেমেন্ট ও রসিদ',
  'rewards.title':'QuickSub রিওয়ার্ড','rewards.balance':'ব্যবহারযোগ্য পয়েন্ট','rewards.value':'আনুমানিক মূল্য','rewards.earned':'মোট অর্জিত','rewards.redeemed':'মোট ব্যবহার করা হয়েছে',
  'rewards.history':'পয়েন্টের ইতিহাস','rewards.empty':'এখনও কোনো পয়েন্ট লেনদেন নেই।','rewards.referral':'বন্ধুকে আমন্ত্রণ জানান','rewards.code':'আপনার রেফারেল কোড',
  'rewards.pending':'অপেক্ষমাণ রেফারেল','rewards.success':'সফল রেফারেল','rewards.whatsapp':'WhatsApp-এ শেয়ার করুন',
  'rewards.explain':'শুধু ভেরিফাইড ও ডেলিভারড অর্ডারে পয়েন্ট পান। বাতিল বা রিফান্ড করা অর্ডারের পয়েন্ট ও ইতিহাস সরিয়ে দেওয়া হয়।',
  'rewards.startRule':'আপনার রিওয়ার্ড ০ পয়েন্ট থেকে শুরু হয়। পেমেন্ট যাচাই হয়ে অর্ডার ডেলিভারি সম্পন্ন হলে এটি স্বয়ংক্রিয়ভাবে বাড়বে।',
  'referral.applied':'রেফারেল কোড সংরক্ষিত হয়েছে। যোগ্য প্রথম অর্ডারের পর রিওয়ার্ড পাবেন।','referral.invalid':'রেফারেল কোডটি ব্যবহার করা যায়নি।',
  'seo.home.title':'বাংলাদেশে ডিজিটাল সাবস্ক্রিপশন ও গেম টপ-আপ | QuickSub',
  'seo.home.description':'বাংলাদেশে BDT মূল্যে নিরাপদ পেমেন্ট, দ্রুত ডেলিভারি ও যাচাইকৃত রিভিউসহ ডিজিটাল সাবস্ক্রিপশন, AI টুল ও গেম টপ-আপ কিনুন।',
  'seo.checkout.title':'নিরাপদ ডিজিটাল পণ্য চেকআউট | QuickSub','seo.account.title':'আমার অ্যাকাউন্ট ও কেনাকাটা | QuickSub',
  'seo.track.title':'আপনার ডিজিটাল অর্ডার ট্র্যাক করুন | QuickSub','seo.cart.title':'আপনার শপিং কার্ট | QuickSub',
  'footer.about':'QuickSub হলো সাবস্ক্রিপশন, গেমিং টপ-আপ ও AI অ্যাক্সেসের ডিজিটাল পণ্য স্টোর—সহজ অর্ডার ও দ্রুত সহায়তার জন্য তৈরি।',
  'footer.products':'পণ্য','footer.support':'সহায়তা','footer.legal':'আইনি তথ্য','footer.offers':'অফার আপডেট পান','footer.subscribe':'সাবস্ক্রাইব করুন',
};

const english: Record<string,string> = {
  'language.english':'English','language.bangla':'বাংলা','language.choose':'Choose language',
  'nav.home':'Home','nav.products':'Products','nav.deals':'Deals','nav.how':'How It Works','nav.reviews':'Reviews','nav.faq':'FAQ','nav.contact':'Contact',
  'nav.account':'My account','nav.cart':'My cart','nav.track':'Track order','nav.order':'Order Now','nav.browse':'Browse products',
  'header.fast':'Fast Digital Delivery','header.secure':'Secure Payment','header.support':'Friendly Support Available',
  'common.loading':'Loading…','common.refresh':'Refresh','common.retry':'Try again','common.save':'Save','common.backStore':'Back to store','common.previous':'Previous','common.next':'Next','common.copy':'Copy','common.copied':'Copied','common.share':'Share',
  'common.dismiss':'Dismiss','common.status':'Status','common.order':'Order','common.daysRemaining':'{count} days remaining','common.deviceCount':'Up to {count} devices',
  'account.title':'My account','account.subtitle':'Your saved cart, orders, and account details in one place.','account.welcome':'Welcome back','account.create':'Create your account',
  'account.name':'Your name','account.email':'Email','account.password':'Password','account.signin':'Sign in','account.signup':'Create account','account.signout':'Sign out',
  'account.saved':'Saved details','account.contact':'Contact email or phone','account.reminders':'Show renewal reminders in my account','account.saveProfile':'Save profile','account.orders':'Order history',
  'account.noOrders':'No orders yet. Purchases made while signed in appear here.','account.delete':'Delete order','account.buyAgain':'Buy again',
  'cart.eyebrow':'Saved to your account','cart.title':'My cart','cart.subtitle':'Your packages and delivery details, ready on any device when you sign in.','cart.refresh':'Refresh cart','cart.loading':'Loading your cart…',
  'cart.signinTitle':'Sign in to open your cart','cart.signinText':'Your saved packages stay in your account when you sign out.','cart.signin':'Sign in to my cart','cart.empty':'Your cart is empty','cart.emptyText':'Choose a product and package, then select “Add to cart” on the checkout page.','cart.browse':'Browse products','cart.unavailable':'Currently unavailable. You can keep this item for later or remove it.','cart.delivery':'Delivery','cart.checkout':'Review & checkout','cart.alternatives':'Browse alternatives','cart.remove':'Remove','cart.removing':'Removing…','cart.summary':'Cart summary','cart.savedCount':'{count} of 20 saved packages','cart.subtotal':'Available subtotal','cart.priceNote':'Prices are checked again before payment. Each package has its own order and payment.','cart.orderNote':'An item leaves your cart only after its order is created. Pending orders stay in your account.','cart.orders':'View my orders',
  'tracking.title':'Track your order','tracking.subtitle':'Check payment confirmation and delivery using your order ID and private receipt code.','tracking.signedIn':'Purchased while signed in?','tracking.history':'View your order history','tracking.continue':'Continue shopping',
  'password.back':'Back to sign in','password.forgotTitle':'Forgot your password?','password.resetTitle':'Reset your password','password.forgotText':'Enter your account email and we will send you a secure reset link.','password.resetText':'Choose a strong password with at least 10 characters.','password.new':'New password','password.confirm':'Confirm new password','password.wait':'Please wait…','password.save':'Save new password','password.send':'Send reset link','password.request':'Request a new reset link','password.signinNew':'Sign in with new password','password.another':'Try another email',
  'subscriptions.title':'My subscriptions','subscriptions.subtitle':'Access periods begin when payment is confirmed.','subscriptions.reminders':'Renewal reminders','subscriptions.all':'All','subscriptions.active':'Active','subscriptions.upcoming':'Upcoming','subscriptions.expired':'Expired','subscriptions.suspended':'Suspended','subscriptions.cancelled':'Cancelled','subscriptions.loading':'Loading subscriptions…','subscriptions.emptyGroup':'No subscriptions in this group.','subscriptions.empty':'Paid subscription purchases will appear here automatically.','subscriptions.details':'View details','subscriptions.renew':'Renew','subscriptions.opening':'Opening…','subscriptions.detailTitle':'Subscription details','subscriptions.back':'Back to my account','subscriptions.access':'Access period','subscriptions.confirmed':'Payment confirmed {date}','subscriptions.devices':'Device access','subscriptions.assigned':'Assigned account','subscriptions.instructions':'Access instructions','subscriptions.receipt':'Download receipt','subscriptions.preparing':'Preparing…','subscriptions.renewFull':'Renew subscription',
  'checkout.title':'Complete your order','checkout.subtitle':'Choose a package, enter your delivery details, then continue to payment.','checkout.summary':'Order summary',
  'checkout.details':'Package & delivery details','checkout.choosePackage':'Choose your package','checkout.name':'Your name','checkout.contact':'Email or phone number',
  'checkout.receiptEmail':'Receipt email','checkout.note':'Delivery details (optional)','checkout.addCart':'Add to cart','checkout.payment':'Continue to payment · {amount}',
  'checkout.creating':'Creating order…','checkout.savedDetails':'Use my saved details','checkout.signin':'Sign in or create an account','checkout.points':'Use reward points',
  'checkout.pointsHelp':'Minimum {minimum} points; up to {maximum} points on this order.','checkout.discount':'Points discount','checkout.total':'Total to pay','checkout.receipt':'Payment & receipt',
  'rewards.title':'QuickSub Rewards','rewards.balance':'Available points','rewards.value':'Estimated value','rewards.earned':'Lifetime earned','rewards.redeemed':'Lifetime redeemed',
  'rewards.history':'Points history','rewards.empty':'No points activity yet.','rewards.referral':'Invite a friend','rewards.code':'Your referral code','rewards.pending':'Pending referrals',
  'rewards.success':'Successful referrals','rewards.whatsapp':'Share on WhatsApp','rewards.explain':'Earn points only on verified, delivered orders. Cancelled or refunded purchases are removed from rewards.',
  'rewards.startRule':'Your rewards start at 0 points and increase automatically after payment is verified and the order is delivered.',
  'referral.applied':'Referral code saved. Rewards unlock after the first eligible order.','referral.invalid':'The referral code could not be applied.',
  'seo.home.title':'Digital Subscriptions & Game Top-Ups in Bangladesh | QuickSub','seo.home.description':'Buy digital subscriptions, AI tools and game top-ups in Bangladesh with BDT pricing, secure payment, fast delivery and verified reviews.',
  'seo.checkout.title':'Secure Digital Product Checkout | QuickSub','seo.account.title':'My Account & Purchases | QuickSub','seo.track.title':'Track Your Digital Order | QuickSub','seo.cart.title':'Your Shopping Cart | QuickSub',
  'footer.about':'QuickSub is a digital product store for subscriptions, gaming top-ups, and AI access—built for simple ordering and responsive support.',
  'footer.products':'Products','footer.support':'Support','footer.legal':'Legal','footer.offers':'Get Offer Updates','footer.subscribe':'Subscribe',
};

type I18nValue = { locale: Locale; setLocale: (locale: Locale) => void; t: (key:string, variables?:Variables) => string; money:(value:number)=>string; date:(value:string|Date)=>string; number:(value:number)=>string };
const I18nContext = createContext<I18nValue | null>(null);
function initialLocale(): Locale {
  const query = new URLSearchParams(window.location.search).get('lang');
  if (query === 'bn' || query === 'bn-BD') return 'bn-BD';
  const saved = readStorage(STORAGE_KEY);
  if (saved === 'bn-BD' || saved === 'en-BD') return saved;
  return navigator.language.toLowerCase().startsWith('bn') ? 'bn-BD' : 'en-BD';
}
export function I18nProvider({children}:{children:ReactNode}) {
  const [locale,setLocaleState] = useState<Locale>(initialLocale);
  const setLocale = (value:Locale) => {writeStorage(STORAGE_KEY,value);setLocaleState(value);};
  useEffect(()=>{document.documentElement.lang=locale;document.documentElement.dir='ltr';},[locale]);
  useEffect(()=>{const ref=new URLSearchParams(window.location.search).get('ref');if(ref&&/^[a-z0-9-]{4,32}$/i.test(ref))writeStorage(REFERRAL_KEY,ref.toUpperCase());},[]);
  const value=useMemo<I18nValue>(()=>{
    const dictionary=locale==='bn-BD'?bn:english;
    const t=(key:string,variables:Variables={})=>Object.entries(variables).reduce((text,[name,value])=>text.split(`{${name}}`).join(String(value)),dictionary[key]||english[key]||key);
    return {locale,setLocale,t,money:value=>new Intl.NumberFormat(locale,{style:'currency',currency:'BDT',maximumFractionDigits:2}).format(value),date:value=>new Intl.DateTimeFormat(locale,{dateStyle:'medium'}).format(new Date(value)),number:value=>new Intl.NumberFormat(locale).format(value)};
  },[locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useI18n(){const value=useContext(I18nContext);if(!value)throw new Error('I18nProvider is missing');return value;}
export function LanguageSwitcher({className=''}:{className?:string}){
  const {locale,setLocale,t}=useI18n();
  return <label className={`inline-flex items-center gap-2 ${className}`}><span className="sr-only">{t('language.choose')}</span><select aria-label={t('language.choose')} value={locale} onChange={event=>setLocale(event.target.value as Locale)} className="rounded-lg border border-brand-200 bg-white px-2 py-1.5 text-sm font-semibold text-brand-800"><option value="en-BD">English</option><option value="bn-BD">বাংলা</option></select></label>;
}
