import { useEffect, useState } from 'react';
import { api } from '../utils/api';
export default function AdminSubscription({orderId}:{orderId:string}) {
 const [date,setDate]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false);
 useEffect(()=>{let active=true;api<{expires_at:string|null}>('/admin/orders/'+orderId+'/subscription').then(d=>{if(active)setDate(d.expires_at?.slice(0,10)||'');}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[orderId]);
 return <section className="qs-admin-note"><h3>Subscription expiry</h3><p>After saving paid and delivered status, set the confirmed expiry date. Leave empty for one-time purchases.</p><label>Expiry date (end of day, Bangladesh time)<input type="date" value={date} onChange={e=>{setDate(e.target.value);setSaved(false);}}/></label><button type="button" disabled={busy} onClick={async()=>{setBusy(true);setError('');setSaved(false);try{await api('/admin/orders/'+orderId+'/subscription',{expires_at:date?date+'T23:59:59+06:00':null});setSaved(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{busy?'Saving…':'Save expiry date'}</button>{error&&<p role="alert">{error}</p>}{saved&&<p role="status">Expiry saved.</p>}</section>;
}
