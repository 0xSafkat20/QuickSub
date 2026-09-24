import { safeStorageGet, safeStorageSet } from './storage';
type SavedReceipt={id:string;accessCode:string};
const key='quicksub-private-receipts';
export function savedReceipts():SavedReceipt[]{
 try {const rows=JSON.parse(safeStorageGet(key)||'[]');return Array.isArray(rows)?rows.filter(r=>typeof r.id==='string'&&/^[a-f0-9]{64}$/.test(r.accessCode)).slice(-50):[];}catch{return [];}
}
export function rememberReceipt(receipt:SavedReceipt){safeStorageSet(key,JSON.stringify([...savedReceipts().filter(r=>r.id!==receipt.id),receipt].slice(-50)));}
