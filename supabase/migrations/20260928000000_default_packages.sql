begin;

-- Create one real, purchasable entry package for every catalog product. Stable
-- IDs make the migration safe to rerun and preserve later admin edits.
insert into public.quicksub_packages(id,product_id,name,details,price_bdt,active) values
  ('30000000-0000-4000-8000-000000000001','1','1 Month Premium','1 month subscription. Access: 1 device at a time on phone, tablet, computer, or TV.',299,true),
  ('30000000-0000-4000-8000-000000000002','2','1 Month Individual','1 month individual subscription. Access: 1 device at a time.',149,true),
  ('30000000-0000-4000-8000-000000000003','3','325 UC','325 UC top-up delivered to the PUBG player ID supplied at checkout.',199,true),
  ('30000000-0000-4000-8000-000000000004','4','100 Diamonds','100 Diamonds top-up delivered to the Free Fire player ID supplied at checkout.',99,true),
  ('30000000-0000-4000-8000-000000000005','5','100 Coins','100 Coins top-up delivered to the eFootball account supplied at checkout.',249,true),
  ('30000000-0000-4000-8000-000000000006','6','86 Diamonds','86 Diamonds top-up delivered to the Mobile Legends player ID supplied at checkout.',89,true),
  ('30000000-0000-4000-8000-000000000007','7','1 Month Plus','1 month ChatGPT Plus subscription. Access: 1 device at a time.',499,true),
  ('30000000-0000-4000-8000-000000000008','8','1 Month Premium','1 month QuillBot Premium subscription. Access: 1 device at a time.',349,true),
  ('30000000-0000-4000-8000-000000000009','9','1 Month Premium','1 month Disney+ Hotstar subscription. Access: 1 device at a time.',199,true),
  ('30000000-0000-4000-8000-000000000010','10','1 Month Individual','1 month YouTube Premium subscription. Access: 1 device at a time.',179,true),
  ('30000000-0000-4000-8000-000000000011','11','475 VP','475 VP top-up delivered to the Valorant account supplied at checkout.',149,true),
  ('30000000-0000-4000-8000-000000000012','12','1 Month Pro','1 month Canva Pro subscription. Access: 1 device at a time.',399,true),
  ('30000000-0000-4000-8000-000000000013','13','1 Month Personal','1 month Microsoft 365 Personal subscription. Access: 1 device at a time.',599,true),
  ('30000000-0000-4000-8000-000000000014','14','1 Month Individual','1 month Apple Music subscription. Access: 1 device at a time.',169,true),
  ('30000000-0000-4000-8000-000000000015','15','80 Gems','80 Gems top-up delivered to the Clash of Clans player tag supplied at checkout.',149,true),
  ('30000000-0000-4000-8000-000000000016','16','400 Robux','400 Robux delivered to the Roblox account supplied at checkout.',99,true),
  ('30000000-0000-4000-8000-000000000017','17','1 Month Basic','1 month Midjourney Basic subscription. Access: 1 device at a time.',449,true),
  ('30000000-0000-4000-8000-000000000018','18','1 Month Plus','1 month Notion Plus with AI subscription. Access: 1 device at a time.',399,true),
  ('30000000-0000-4000-8000-000000000019','19','1 Month Premium','1 month Grammarly Premium subscription. Access: 1 device at a time.',299,true),
  ('30000000-0000-4000-8000-000000000020','20','1 Month All Apps','1 month Adobe Creative Cloud All Apps subscription. Access: 1 device at a time.',799,true),
  ('30000000-0000-4000-8000-000000000021','21','1 Month Prime','1 month Amazon Prime Video subscription. Access: 1 device at a time.',199,true)
on conflict(id) do nothing;

commit;
