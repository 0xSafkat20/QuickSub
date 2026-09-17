import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';

async function readData(name) {
  const source = await readFile(new URL(`../src/data/${name}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { products } = await readData('products');
const { faqItems } = await readData('faq');
const { legalDocuments } = await readData('legal');
const knowledge = {
  products: products.map(p => ({
    id: p.id, name: p.name, category: p.category,
    description: p.shortDescription, details: p.cardCopy,
    startingPrice: p.startingPrice, deliveryEstimate: p.deliveryEstimate,
    popularPlan: p.popularPlan, inStock: !p.outOfStock,
  })),
  // Other FAQ entries describe checkout/account features that are not implemented.
  faq: faqItems.filter(p => ['1', '6', '7'].includes(p.id)),
  policies: legalDocuments,
  operations: {
    ordering: 'Open product details to select an available exact-price package and place an order. Save the receipt ID and private access code. Payment references are reviewed manually. If no packages are available, contact WhatsApp support.',
    supportHours: '10 AM–11 PM Bangladesh time (UTC+6)',
    limitations: 'The support assistant cannot access private orders or confirm payment. Direct customers to Track Order with their saved receipt ID and private access code; never ask them to paste the access code into AI chat. Fulfillment and refunds are handled by staff, not automatically.',
  },
};
await writeFile(new URL('../server/knowledge.json', import.meta.url), JSON.stringify(knowledge, null, 2) + '\n');
await writeFile(new URL('../server/catalog.json', import.meta.url), JSON.stringify(products, null, 2) + '\n');
console.log(`Chat knowledge updated: ${products.length} products.`);
