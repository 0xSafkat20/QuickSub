import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
const steps=[['typecheck',['npm','run','typecheck']],['lint',['npm','run','lint']],['coverage',['npm','run','test:coverage']],['build',['npm','run','build']]];
if(process.argv.includes('--browser'))steps.push(...[['browser-checkout','scripts/check-checkout.mjs'],['browser-payments','scripts/check-payments.mjs'],['browser-admin','scripts/check-admin.mjs'],['browser-chat','scripts/check-chat.mjs'],['browser-privacy','scripts/check-privacy.mjs'],['browser-storefront','scripts/check-storefront.mjs']].map(([name,path])=>[name,['node',path]]));
mkdirSync('deliverables/test-report',{recursive:true});const results=[];
for(const [name,[command,...args]] of steps){
 const start=Date.now();
 const npmCli=process.env.npm_execpath;
 if(command==='npm'&&!npmCli){console.error('Run this verifier with npm run verify or npm run verify:full.');process.exit(1);}
 const result=spawnSync(process.execPath,command==='npm'?[npmCli,...args]:args,{encoding:'utf8',maxBuffer:20*1024*1024});
 writeFileSync('deliverables/test-report/'+name+'.txt',(result.stdout||'')+(result.stderr||''));
 const entry={name,exitCode:result.status,durationMs:Date.now()-start,passed:result.status===0&&!result.error};results.push(entry);console.log((entry.passed?'PASS ':'FAIL ')+name);
 writeFileSync('deliverables/test-report/results.json',JSON.stringify({generatedAt:new Date().toISOString(),browserIncluded:process.argv.includes('--browser'),results},null,2));
 if(!entry.passed){console.error('See deliverables/test-report/'+name+'.txt');process.exit(1);}
}
