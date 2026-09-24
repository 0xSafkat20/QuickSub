import { startTestServer, packageId } from './admin-test-server.mjs';
// Disposable local PostgreSQL simulation. Never connects to a production service.
const env = await startTestServer({port:4178,receiptSimulation:true});
await env.db.query("update quicksub_packages set details='1 month subscription. Access: 1 device at a time; mobile, tablet, computer or TV.' where id=$1",[packageId]);
await env.db.query("insert into quicksub_packages(id,product_id,name,price_bdt,details) values('20000000-0000-4000-8000-000000000003','3','325 UC',499,'One-time PUBG UC top-up. Player ID required.')");
const credentials={email:'demo@quicksub.test',password:'QuickSub-demo-123'};
const response=await fetch(env.base+'/api/account/signup',{method:'POST',headers:{origin:env.base,'x-quicksub-client':'web','content-type':'application/json'},body:JSON.stringify({name:'Demo Customer',...credentials})});
if(!response.ok){await env.close();throw Error('Could not initialize demo account');}
const cookie=response.headers.get('set-cookie').split(';')[0];
const secondId='20000000-0000-4000-8000-000000000002';
await env.db.query("insert into quicksub_packages(id,product_id,name,price_bdt,details) values($1,'2','Premium · 1 month',199,'Monthly plan')",[secondId]);
for(const id of [packageId,secondId]){
 const saved=await fetch(env.base+'/api/cart/items/'+id,{method:'PUT',headers:{origin:env.base,'x-quicksub-client':'web','content-type':'application/json',cookie},body:JSON.stringify({name:'Demo Customer',contact:'demo@quicksub.test',note:'Demo delivery details — no real purchase'})});
 if(!saved.ok){await env.close();throw Error('Could not seed demo cart');}
}
console.log('Local cart simulation: '+env.base+'/cart');
console.log('Demo sign-in: '+credentials.email+' / '+credentials.password);
console.log('All accounts, orders and payments here are simulated. Stop this process to discard demo data.');
for(const event of ['SIGINT','SIGTERM'])process.on(event,async()=>{await env.close();process.exit(0);});
