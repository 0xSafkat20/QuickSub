function toProduct(row) {
  const d = row.data;
  const price = Number(row.price_bdt);
  if (!d || !['id','name','slug','shortDescription','cardCopy','deliveryEstimate','cta','icon'].every(k => typeof d[k] === 'string') ||
    typeof row.id !== 'string' || row.id !== d.id || !Number.isFinite(price) || price < 0 ||
    !['streaming','music','gaming','ai'].includes(d.category) || !/^#[a-f0-9]{6}$/i.test(d.accentColor) ||
    typeof row.image_url !== 'string' || !/^(https:\/\/|\/(?!\/))/.test(row.image_url) ||
    typeof row.in_stock !== 'boolean' || !Array.isArray(d.badges) || !d.badges.every(b => typeof b === 'string') ||
    (d.soldItems !== undefined && (!Array.isArray(d.soldItems) || !d.soldItems.every(s => s && typeof s.name === 'string' && Number.isFinite(s.count) && s.count >= 0)))) throw new Error('Invalid catalog row');
  return { id: row.id, name: d.name, slug: d.slug, category: d.category, shortDescription: d.shortDescription,
    cardCopy: d.cardCopy, deliveryEstimate: d.deliveryEstimate, cta: d.cta, icon: d.icon,
    accentColor: d.accentColor, badges: d.badges, soldItems: d.soldItems,
    popularPlan: typeof d.popularPlan === 'string' ? d.popularPlan : undefined,
    isNew: d.isNew === true, outOfStock: !row.in_stock, bannerImage: row.image_url,
    startingPrice: `Starting from ৳${price}`, priceBdt: price };
}

function createCatalog({ localProducts, localKnowledge, url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, fetchImpl = fetch, now = Date.now }) {
  let snapshot = { products: localProducts, knowledge: localKnowledge, source: 'local', stale: false };
  let expires = 0;
  let pending;
  async function get() {
    if (!url || !key) return snapshot;
    if (now() < expires) return snapshot;
    if (pending) return pending;
    pending = (async () => {
      try {
        if (!/^https:\/\/[a-z0-9.-]+\/?$/i.test(url)) throw new Error('Invalid Supabase URL');
        const headers = { apikey: key, Authorization: `Bearer ${key}` };
        const options = { headers, signal: AbortSignal.timeout(4000) };
        const base = url.replace(/\/$/, '');
        const responses = await Promise.all([
          fetchImpl(`${base}/rest/v1/quicksub_products?select=*&active=eq.true&order=sort_order.asc,id.asc&limit=1000`, options),
          fetchImpl(`${base}/rest/v1/quicksub_content?id=eq.store&select=data`, options),
          fetchImpl(`${base}/rest/v1/quicksub_packages?active=eq.true&select=id,product_id,name,details,price_bdt&limit=1000`, options).catch(()=>null),
        ]);
        if (responses.slice(0,2).some(r => !r.ok)) throw new Error('Catalog unavailable');
        const [rows, content] = await Promise.all(responses.slice(0,2).map(r => r.json()));
        let packages = [];
        try { if (responses[2]?.ok) packages = await responses[2].json(); } catch {}
        if (!Array.isArray(packages)) packages = [];
        if (!Array.isArray(rows) || !Array.isArray(content) || !content[0]?.data) throw new Error('Catalog not initialized');
        const products = rows.map(toProduct);
        const data = content[0].data;
        if (!Array.isArray(data.faq) || !data.policies || !data.operations) throw new Error('Invalid content');
        snapshot = { products, knowledge: { packages: packages.filter(p=>p && typeof p.id==='string' && typeof p.name==='string' && Number.isFinite(Number(p.price_bdt)) && Number(p.price_bdt)>0 && products.some(product=>product.id===p.product_id && !product.outOfStock)).map(p=>({id:p.id,productId:p.product_id,name:p.name,details:typeof p.details==='string'?p.details:'',priceBdt:Number(p.price_bdt)})), faq: data.faq, policies: data.policies, operations: data.operations,
          products: products.map(p => ({ id: p.id, name: p.name, category: p.category, description: p.shortDescription,
            details: p.cardCopy, startingPrice: p.startingPrice, deliveryEstimate: p.deliveryEstimate,
            popularPlan: p.popularPlan, inStock: !p.outOfStock })) }, source: 'supabase', stale: false };
        expires = now() + 60000;
      } catch {
        snapshot = { ...snapshot, stale: true };
        expires = now() + 10000;
      }
      return snapshot;
    })().finally(() => { pending = undefined; });
    return pending;
  }
  return { get, invalidate: () => { expires = 0; } };
}
module.exports = { createCatalog, toProduct };
