const PAGES={g:'games.html',m:'movies.html',s:'software.html'};
const $=s=>document.querySelector(s),home=$('#home'),app=$('#app'),dock=$('#dock'),load=$('#load');
const frames={};let cur=null;
const dec=b=>new TextDecoder().decode(Uint8Array.from(atob(b),c=>c.charCodeAt(0)));
const ls=(k,v)=>{try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch{}};
function openHub(k){
 if(!frames[k]){const f=document.createElement('iframe');f.allow='fullscreen; clipboard-write; clipboard-read; autoplay';f.title=k==='m'?'Zinomi Movie Hub':k==='s'?'Zinomi Software Hub':'Zinomi Game Hub';
  load.classList.add('on');f.onload=()=>load.classList.remove('on');f.src=PAGES[k];app.append(f);frames[k]=f}
 for(const x in frames)frames[x].classList.toggle('on',x===k);
 cur=k;app.classList.add('on');home.classList.add('off');dock.classList.add('on');ls('zc_last',k);
 $('#dM').classList.toggle('cur',k==='m');$('#dG').classList.toggle('cur',k==='g');$('#dS').classList.toggle('cur',k==='s');
 document.title=(k==='m'?'Movie Hub':k==='s'?'Software Hub':'Game Hub')+' · Zinomi Creation';
 setTimeout(()=>{try{frames[k].contentWindow.focus()}catch{}},60)}
function menu(){cur=null;setTimeout(paintCards,200);app.classList.remove('on');dock.classList.remove('on');home.classList.remove('off');document.title='Zinomi Creation';load.classList.remove('on')}
document.querySelectorAll('.card').forEach(c=>{c.onclick=()=>openHub(c.dataset.app);c.onmousemove=e=>{const r=c.getBoundingClientRect();c.style.setProperty('--mx',(e.clientX-r.left)+'px');c.style.setProperty('--my',(e.clientY-r.top)+'px')}});
$('#dH').onclick=menu;$('#dM').onclick=()=>openHub('m');$('#dG').onclick=()=>openHub('g');$('#dS').onclick=()=>openHub('s');
const sk=$('#skip');sk.checked=ls('zc_skip')==='1';sk.onchange=()=>ls('zc_skip',sk.checked?'1':'0');
addEventListener('keydown',e=>{if(cur||/INPUT|TEXTAREA/.test(e.target.tagName)||document.querySelector('#mod.on')||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==='1')openHub('m');if(e.key==='2')openHub('g');if(e.key==='3')openHub('s')});
if(sk.checked&&ls('zc_last'))openHub(ls('zc_last'));
/* ===== Zinomi tools ===== */
const DBS={g:{n:'ZinomiGameHubDB',s:['games']},m:{n:'ZinomiMoviesHubDB',s:['movies','notes']},s:{n:'ZinomiSoftwareHubDB',s:['software']}};
const LSK=/^(zh_|zm_|zs_|zx_prefs_|zx_lastbackup_)|^(zwa|zpin|zbundle|zherobg|zinomi_omdb_api_key_v1)$/;
const MY='94702001206';
const lsj=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch{return d}};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const same=(a,b)=>new Date(a).toDateString()===new Date(b).toDateString();
const fmt=v=>Math.round(v).toLocaleString();
const money=()=>{const c=localStorage.getItem('zh_cur');try{return JSON.parse(c)||'Rs.'}catch{return c||'Rs.'}};
try{if(!(localStorage.getItem('zwa')||'').replace(/\D/g,''))localStorage.setItem('zwa',MY);const s=lsj('zh_shop',null);if(!s||!String(s.wa||'').replace(/\D/g,''))localStorage.setItem('zh_shop',JSON.stringify({name:(s&&s.name)||'Zinomi Game Hub',wa:MY}))}catch{}
const idbOpen=n=>new Promise((res,rej)=>{const r=indexedDB.open(n);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
async function hasDB(n){try{return indexedDB.databases?(await indexedDB.databases()).some(d=>d.name===n):false}catch{return false}}
async function getAll(k,store){const d=DBS[k];if(!await hasDB(d.n))return null;const db=await idbOpen(d.n);try{if(!db.objectStoreNames.contains(store))return [];return await new Promise((res,rej)=>{const q=db.transaction(store).objectStore(store).getAll();q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}finally{db.close()}}
const lastBk=k=>{let v=localStorage.getItem(k==='g'?'zh_lastbk':k==='m'?'zm_lastbk':k==='s'?'zs_lastbk':'zc_lastfull');if(!v)return 0;v=String(v).replace(/"/g,'');const n=+v;return n>1e9?n:(Date.parse(v)||0)};
const ago=t=>{if(!t)return '<span class="bad">never</span>';const d=Math.floor((Date.now()-t)/864e5);return `<span class="${d>7?'am':'ok'}">${d?d+' day'+(d>1?'s':'')+' ago':'today'}</span>`};
async function paintCards(){
 let G=null,M=null,S=null;try{G=await getAll('g','games');M=await getAll('m','movies');S=await getAll('s','software')}catch{}
 const gs=lsj('zh_sales',[]),ms=lsj('zm_orders',[]),now=Date.now();
 const td=a=>{const d=a.filter(x=>same(x.t,now));return [d.length,d.reduce((s,x)=>s+(+x.total||0),0)]};
 const set=(id,a,b)=>{const e=$(id);if(e)e.innerHTML=`<b>${a}</b><small>${b}</small>`};
 if(G){const own=G.filter(g=>!g.wish),sz=own.reduce((a,g)=>a+(+g.size||0),0),[n,v]=td(gs);set('#liveG',`${own.length} games · ${sz>=1000?(sz/1000).toFixed(1)+' TB':Math.round(sz)+' GB'}`,`Today: ${n} sale${n==1?'':'s'} · ${money()} ${fmt(v)}`)}else set('#liveG','No data yet','Open the hub to start');
 if(M){const av=M.filter(m=>!['sold','watched'].includes(m.status)).length,[n,v]=td(ms);set('#liveM',`${M.length} titles · ${av} available`,`Today: ${n} order${n==1?'':'s'} · ${money()} ${fmt(v)}`)}else set('#liveM','No data yet','Open the hub to start');
 if(S){const sz=S.reduce((a,x)=>a+(+x.size||0),0),[n,v]=td(lsj('zs_orders',[]));set('#liveS',`${S.length} software · ${sz>=1000?(sz/1000).toFixed(1)+' TB':Math.round(sz)+' GB'}`,`Today: ${n} order${n==1?'':'s'} · ${money()} ${fmt(v)}`)}else set('#liveS','No data yet','Open the hub to start');
 const has=(G&&G.length)||(M&&M.length)||(S&&S.length);$('#hint').classList.toggle('on',!has);
 const last=Math.max(lastBk('g'),lastBk('m'),lastBk('s'),lastBk('f'));$('#tB').classList.toggle('warn',!!has&&Date.now()-last>7*864e5)}
const mod=$('#mod');mod.onclick=e=>{if(e.target===mod)mod.classList.remove('on')};
addEventListener('keydown',e=>{if(e.key==='Escape')mod.classList.remove('on')});
const show=(h)=>{mod.innerHTML='<div class="mbox">'+h+'</div>';mod.classList.add('on');return mod.firstChild};
function resetFrames(){for(const k in frames){frames[k].remove();delete frames[k]}}
/* backup & restore */
$('#tB').onclick=()=>{const b=show(`<h3>💾 Backup &amp; Restore</h3><p>Your data lives in this browser only. Keep a copy on a USB or Google Drive.</p>
<div>Games last backup: ${ago(lastBk('g'))}<br>Movies last backup: ${ago(lastBk('m'))}<br>Software last backup: ${ago(lastBk('s'))}<br>Full backup (all hubs): ${ago(lastBk('f'))}</div>
<div class="row"><button class="pri" id="bx">Download full backup (all hubs)</button><label class="fb">Restore from file<input type="file" id="bi" accept=".json" hidden></label></div>
<p>Tip: always open this app in the <b>same browser</b> (Chrome or Edge). A different browser shows empty data. Restore a backup file to move to a new PC.</p>`);
 b.querySelector('#bx').onclick=exportAll;b.querySelector('#bi').onchange=e=>e.target.files[0]&&importAll(e.target.files[0])};
async function exportAll(){const o={app:'zinomi-creation',v:1,t:Date.now(),ls:{},idb:{}};
 for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(LSK.test(k))o.ls[k]=localStorage.getItem(k)}
 for(const k in DBS)for(const s of DBS[k].s){const r=await getAll(k,s);if(r)(o.idb[DBS[k].n]=o.idb[DBS[k].n]||{})[s]=r}
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(o)],{type:'application/json'}));a.download='zinomi-full-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();
 try{localStorage.setItem('zc_lastfull',Date.now())}catch{};setTimeout(()=>{$('#tB').click();paintCards()},400)}
async function importAll(f){try{const o=JSON.parse(await f.text());if(o.app!=='zinomi-creation')throw 0;
 if(!confirm('Restore will REPLACE the current data in both hubs. Continue?'))return;
 for(const k in DBS){const d=DBS[k];if(!o.idb[d.n])continue;
  if(!await hasDB(d.n)){const t=document.createElement('iframe');t.style.display='none';t.src=PAGES[k];app.append(t);for(let i=0;i<40&&!await hasDB(d.n);i++)await new Promise(r=>setTimeout(r,250));await new Promise(r=>setTimeout(r,800))}
  const db=await idbOpen(d.n);for(const s in o.idb[d.n]){if(!db.objectStoreNames.contains(s))continue;await new Promise((res,rej)=>{const tx=db.transaction(s,'readwrite'),st=tx.objectStore(s);st.clear();o.idb[d.n][s].forEach(r=>st.put(r));tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}db.close()}
 for(const k in o.ls)localStorage.setItem(k,o.ls[k]);alert('Restored. The app will reload now.');location.reload()}catch(e){alert('That is not a valid Zinomi backup file.')}}
/* data check */
const dups=a=>{const m={};a.forEach(x=>{const k=String(x.name||'').trim().toLowerCase();if(k)(m[k]=m[k]||[]).push(x)});return Object.values(m).filter(v=>v.length>1).map(v=>v[0])};
$('#tD').onclick=async()=>{const G=await getAll('g','games').catch(()=>null),M=await getAll('m','movies').catch(()=>null),S=await getAll('s','software').catch(()=>null);let h='<h3>🔍 Data check</h3><p>Tap an item to open it in its hub.</p>';
 const sec=(t,k,a,f)=>{h+=`<h4>${t} <span class="${a.length?'am':'ok'}">${a.length?a.length:'✓'}</span></h4>`+a.slice(0,40).map(x=>`<div class="itm" data-k="${k}" data-n="${esc(x.name||x.title)}"><span>${esc(x.name||x.title||'(no name)')}</span><small>${f?f(x):''}</small></div>`).join('')+(a.length>40?`<p>+${a.length-40} more</p>`:'')};
 if(G){const own=G.filter(g=>!g.wish);sec('Games without cover','g',G.filter(g=>!(g.image||g.imageUrl)));sec('Games without price','g',own.filter(g=>!(+g.price>0)));sec('Games without size','g',own.filter(g=>!(+g.size>0)));sec('Duplicate game names','g',dups(G))}
 if(M){sec('Movies without poster','m',M.filter(m=>!(m.posterUrl||m.poster)),m=>m.year||'');sec('Movies without price','m',M.filter(m=>!(+m.price>0)),m=>m.year||'');sec('Duplicate movie names','m',dups(M),m=>m.year||'')}
 if(S){sec('Software without size','s',S.filter(x=>!(+x.size>0)),x=>x.category||'');sec('Software without price','s',S.filter(x=>!(+x.price>0)),x=>x.category||'');sec('Duplicate software names','s',dups(S),x=>x.category||'')}
 if(!G&&!M&&!S)h+='<p>No data found yet.</p>';
 const b=show(h);b.onclick=e=>{const r=e.target.closest('.itm');if(r)openFind(r.dataset.k,r.dataset.n)}};
function openFind(k,name){mod.classList.remove('on');openHub(k);const go=()=>setTimeout(()=>{try{const d=frames[k].contentDocument,t=d.querySelector('[data-tab=library]');t&&t.click();const s=d.getElementById('search');if(s){s.value=name;s.dispatchEvent(new Event('input',{bubbles:true}))}}catch{}},500);
 try{frames[k].contentDocument.readyState==='complete'?go():frames[k].addEventListener('load',go,{once:true})}catch{go()}}
/* sales insights */
const bars=(rows,c,f)=>{const mx=Math.max(1,...rows.map(r=>r[1]));return rows.map(r=>`<div class="br"><span>${esc(r[0])}</span><i><b style="width:${r[1]/mx*100}%;background:${c}"></b></i><em>${f(r[1])}</em></div>`).join('')};
$('#tS').onclick=()=>{const cu=money();let h='<h3>📈 Sales insights</h3><p>Built from the orders you saved in each hub.</p>';
 [['Movie Hub',lsj('zm_orders',[]),'#e5b84b'],['Game Hub',lsj('zh_sales',[]),'#4c8dff'],['Software Hub',lsj('zs_orders',[]),'#14e0b4']].forEach(([t,a,c])=>{
  const tot=a.reduce((s,x)=>s+(+x.total||0),0),mo=[];for(let i=5;i>=0;i--){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i);mo.push([d.toLocaleString('en',{month:'short'}),a.filter(x=>{const q=new Date(x.t);return q.getMonth()===d.getMonth()&&q.getFullYear()===d.getFullYear()}).reduce((s,x)=>s+(+x.total||0),0)])}
  const cnt={};a.forEach(x=>(x.items||[]).forEach(n=>cnt[n]=(cnt[n]||0)+1));const top=Object.entries(cnt).sort((x,y)=>y[1]-x[1]).slice(0,5);
  h+=`<h4 style="color:${c}">${t}</h4>`;
  if(!a.length){h+='<p>No saved orders yet.</p>';return}
  h+=`<div class="kp"><div><b>${a.length}</b><span>Orders</span></div><div><b>${cu} ${fmt(tot)}</b><span>Revenue</span></div><div><b>${cu} ${fmt(tot/a.length)}</b><span>Avg order</span></div></div><h4>Last 6 months</h4>`+bars(mo,c,v=>cu+' '+fmt(v))+'<h4>Best sellers</h4>'+(top.length?bars(top,c,v=>v+' sold'):'<p>None yet.</p>')});
 show(h)};
/* whatsapp */
$('#tW').onclick=()=>{const cur=(localStorage.getItem('zwa')||MY);const b=show(`<h3>💬 WhatsApp orders</h3><p>Customer orders from both hubs are sent to this number (with country code).</p><input type="tel" id="wn" value="${esc(cur)}"><div class="row"><button class="pri" id="ws">Save for both hubs</button><button id="wt">Test chat</button></div><p>Sri Lanka format: 94702001206 (a leading 0 is converted automatically).</p>`);
 const num=()=>{let d=b.querySelector('#wn').value.replace(/\D/g,'');if(d.length===10&&d[0]==='0')d='94'+d.slice(1);return d};
 b.querySelector('#ws').onclick=()=>{const d=num();if(d.length<10)return alert('Enter a valid number');localStorage.setItem('zwa',d);const s=lsj('zh_shop',{name:'Zinomi Game Hub'});s.wa=d;localStorage.setItem('zh_shop',JSON.stringify(s));resetFrames();mod.classList.remove('on')};
 b.querySelector('#wt').onclick=()=>window.open('https://wa.me/'+num()+'?text='+encodeURIComponent('Hi Zinomi Creation!'),'_blank')};
/* menu search */
let SI=null;async function loadSI(){SI=[];for(const [k,s] of [['g','games'],['m','movies'],['s','software']]){try{(await getAll(k,s)||[]).forEach(x=>SI.push({k,n:x.name||''}))}catch{}}}
const gi=$('#gsq'),gr=$('#gsr');
gi.onfocus=()=>loadSI();
gi.oninput=async()=>{if(!SI)await loadSI();const q=gi.value.trim().toLowerCase();if(!q){gr.classList.remove('on');return}
 const r=SI.filter(x=>x.n.toLowerCase().includes(q)).slice(0,8);
 gr.innerHTML=r.length?r.map(x=>`<div class="itm" data-k="${x.k}" data-n="${esc(x.n)}"><span>${x.k==='g'?'🎮':x.k==='s'?'🧩':'🎬'} ${esc(x.n)}</span><small>${x.k==='g'?'Game':x.k==='s'?'Software':'Movie'}</small></div>`).join(''):'<div class="itm"><span>No results</span></div>';gr.classList.add('on')};
gr.onclick=e=>{const r=e.target.closest('.itm[data-k]');if(r){gr.classList.remove('on');gi.value='';openFind(r.dataset.k,r.dataset.n)}};
addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!cur){e.preventDefault();gi.focus()}});
document.addEventListener('click',e=>{if(!e.target.closest('.gs'))gr.classList.remove('on')});
paintCards();
/* ===== Online store: orders inbox & publish ===== */
const FBU='https://www.gstatic.com/firebasejs/10.12.2/';
let FB=null,ORDERS=[],ounsub=null,ofirst=true,ofilter='new',ocur=null,ORDERR='';
const OST={new:['New','#f1b44c'],confirmed:['Confirmed','#43a9ff'],ready:['Ready','#34d399'],done:['Done','#8fa3d6'],cancelled:['Cancelled','#ff7a8a']};
const fbCfg=()=>lsj('zc_fb',null);
function parseCfg(t){t=String(t||'').trim();try{const o=JSON.parse(t);if(o&&o.projectId)return o}catch{}const o={};t.replace(/([A-Za-z0-9_]+)\s*:\s*["']([^"']*)["']/g,(m,k,v)=>{o[k]=v});return o.projectId?o:null}
async function fbInit(){if(FB)return FB;const c=fbCfg();if(!c)throw new Error('Add your Firebase settings first.');const [A,Au,F]=await Promise.all([import(FBU+'firebase-app.js'),import(FBU+'firebase-auth.js'),import(FBU+'firebase-firestore.js')]);const app=A.initializeApp(c,'owner'),auth=Au.getAuth(app);try{await auth.authStateReady()}catch{}FB={A,Au,F,app,auth,db:F.getFirestore(app)};return FB}
const signedIn=()=>!!(FB&&FB.auth&&FB.auth.currentUser);
const shortId=id=>String(id).slice(-6).toUpperCase();
const ago2=t=>{const s=(Date.now()-t)/1000;return s<60?'just now':s<3600?Math.floor(s/60)+' min ago':s<86400?Math.floor(s/3600)+' h ago':Math.floor(s/86400)+' d ago'};
const waNum=n=>{let d=String(n||'').replace(/\D/g,'');if(d.length===10&&d[0]==='0')d='94'+d.slice(1);return d};
const nbadge=()=>{const n=ORDERS.filter(o=>o.status==='new').length,e=$('#nb');if(e){e.textContent=n||'';e.style.display=n?'inline-block':'none'}$('#tO').classList.toggle('warn',false)};
function notifyNew(o){try{const a=new(window.AudioContext||window.webkitAudioContext)(),os=a.createOscillator(),g=a.createGain();os.connect(g);g.connect(a.destination);os.frequency.value=880;g.gain.setValueAtTime(.15,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+.6);os.start();os.stop(a.currentTime+.6)}catch{}try{if(Notification.permission==='granted')new Notification('🛒 New order',{body:(o.clientName||'Client')+' · '+(o.items||[]).length+' items · '+money()+' '+fmt(o.total||0)})}catch{}}
async function startOrders(){const f=await fbInit();if(ounsub)return;const{F}=f;ounsub=F.onSnapshot(F.query(F.collection(f.db,'orders'),F.orderBy('createdAt','desc'),F.limit(200)),s=>{ORDERR='';if(!ofirst)s.docChanges().forEach(c=>{if(c.type==='added')notifyNew(c.doc.data())});ofirst=false;ORDERS=s.docs.map(d=>{const x=d.data();return{...x,id:d.id,createdAt:x.createdAt&&x.createdAt.toMillis?x.createdAt.toMillis():Date.now()}});nbadge();if($('#ordv'))drawOrders()},e=>{ounsub=null;ORDERR=e.message||String(e);if($('#ordv'))drawOrders()})}
async function fbBoot(){try{if(!fbCfg())return;await fbInit();if(signedIn())await startOrders()}catch(e){console.warn('fb boot',e)}}
const msgFor=o=>{const n=(o.clientName||'').split(' ')[0]||'there',id=shortId(o.id),its=(o.items||[]).map(i=>'• '+i.name).join('\n'),t=money()+' '+fmt(o.total||0);
 return o.status==='ready'?`Hi ${n}! 🎉 Your order #${id} is ready.\n${its}\nTotal: ${t}\nYou can come to the shop to collect it. Thank you! - Zinomi Creation`:o.status==='cancelled'?`Hi ${n}, sorry, we could not complete your order #${id}. Please message us and we will help. - Zinomi Creation`:o.status==='done'?`Hi ${n}! Thank you for shopping with Zinomi Creation. Enjoy! 🎮🎬`:`Hi ${n}! We received your order #${id}.\n${its}\nTotal: ${t}\nWe will message you when it is ready to collect. - Zinomi Creation`};
async function setStatus(id,st){const f=await fbInit(),m=($('#omsg')||{}).value||'';await f.F.updateDoc(f.F.doc(f.db,'orders',id),{status:st,updatedAt:f.F.serverTimestamp(),ownerMsg:m.slice(0,200)})}
function openOrders(){const b=show('<div id="ordv"></div>');b.classList.add('w');b.onclick=ordClick;
 if(!fbCfg())return drawSetup();(async()=>{try{await fbInit();if(signedIn())await startOrders()}catch(e){ORDERR=e.message}drawOrders()})();drawOrders()}
function drawSetup(msg){const v=$('#ordv'),c=fbCfg();v.innerHTML=`<h3>⚙ Online store setup</h3><p>Paste your Firebase web config (step 7 of the README), then sign in with the owner email you created in Firebase.</p>
<textarea id="fbc" rows="7" placeholder='{ apiKey: "...", authDomain: "...", projectId: "...", ... }' style="width:100%;background:#060c22;border:1px solid var(--line);color:var(--text);border-radius:10px;padding:10px">${esc(c?JSON.stringify(c,null,1):'')}</textarea>
<div class="row"><input type="email" id="fbe" placeholder="Owner email" value="${esc(localStorage.getItem('zc_fbemail')||'')}" style="flex:1;min-width:180px"><input type="password" id="fbp" placeholder="Password" style="flex:1;min-width:150px"></div>
<div class="row"><button class="pri" id="fbs">Save &amp; sign in</button><button id="fbr">Copy Firestore rules</button><button id="fbb">Back</button></div><p id="fbm" style="color:#ff7a8a">${esc(msg||'')}</p>`}
function drawOrders(){const v=$('#ordv');if(!v)return;if(!fbCfg())return drawSetup();if(!FB&&!ORDERR)return v.innerHTML='<h3>📥 Orders</h3><p>Connecting…</p>';if(!signedIn())return drawSetup(ORDERR||'Sign in with your owner email to see orders.');
 const tabs=[['new','New'],['confirmed','Confirmed'],['ready','Ready'],['done','Done'],['all','All']],cnt=s=>s==='all'?ORDERS.length:ORDERS.filter(o=>o.status===s).length,list=ORDERS.filter(o=>ofilter==='all'||o.status===ofilter);
 v.innerHTML=`<h3>📥 Orders</h3><div class="row">${tabs.map(t=>`<button class="${ofilter===t[0]?'pri':''}" data-f="${t[0]}">${t[1]} (${cnt(t[0])})</button>`).join('')}</div>
 <div class="row"><button id="opub">📤 Publish catalog</button><button id="oset">⚙ Settings</button><button id="onot">🔔 Alerts</button><button id="oout">Sign out</button></div><p id="pubmsg" style="color:#9cc4ff;margin:0 0 8px"></p>${ORDERR?`<p style="color:#ff7a8a">${esc(ORDERR)}</p>`:''}
 ${list.length?list.map(o=>{const s=OST[o.status]||OST.new,open=ocur===o.id;return `<div class="ord" data-id="${esc(o.id)}"><div class="oh" data-o="${esc(o.id)}"><b>#${shortId(o.id)}</b><span>${esc(o.clientName||'')} · ${esc(o.phone||'')}</span><span class="st" style="color:${s[1]};border-color:${s[1]}77;background:${s[1]}18">${s[0]}</span><small>${ago2(o.createdAt)}</small><b style="margin-left:auto">${money()} ${fmt(o.total||0)}</b></div>
 ${open?`<div class="od"><div class="kv2"><span>👤 ${esc(o.clientName||'')}</span><span>📞 ${esc(o.phone||'')}</span><span>💬 ${esc(o.whatsapp||o.phone||'')}</span><span>🎂 Age ${esc(o.age||'?')}</span><span>📍 ${esc(o.town||'-')}</span><span>🖥 ${esc((o.platforms||[]).join(', ')||'-')}</span><span>💽 ${o.ownDrive?'Brings own drive':'Needs a drive'}</span></div>
 <table>${(o.items||[]).map(i=>`<tr><td>${i.type==='game'?'🎮':i.type==='movie'?'🎬':'🧩'} ${esc(i.name)}</td><td>${fmt(i.size||0)?(+i.size>=1?(+i.size).toFixed(1)+' GB':Math.round(i.size*1024)+' MB'):'-'}</td><td style="text-align:right">${+i.price>0?money()+' '+fmt(i.price):'ask'}</td></tr>`).join('')}<tr><td><b>${(o.items||[]).length} items</b></td><td><b>${(+o.totalSize||0).toFixed(1)} GB</b></td><td style="text-align:right"><b>${money()} ${fmt(o.total||0)}</b></td></tr></table>
 ${o.note?`<p>📝 ${esc(o.note)}</p>`:''}<input id="omsg" placeholder="Short message the client will see (optional)" value="${esc(o.ownerMsg||'')}" style="width:100%;margin:6px 0">
 <div class="row"><button data-s="confirmed">✅ Confirm</button><button class="pri" data-s="ready">📦 Ready to collect</button><button data-s="done">✔ Done</button><button data-s="cancelled" style="color:#ff7a8a">✖ Cancel</button><button data-w="1" style="background:#1ea952;border-color:#1ea952">💬 Message on WhatsApp</button></div></div>`:''}</div>`}).join(''):'<p>No orders here yet.</p>'}`}
async function ordClick(e){const t=e.target,id=(t.closest('.ord')||{}).dataset&&t.closest('.ord').dataset.id;
 if(t.dataset.f){ofilter=t.dataset.f;return drawOrders()}
 if(t.closest('.oh')&&!t.closest('.od')){ocur=ocur===id?null:id;return drawOrders()}
 if(t.dataset.s&&id){try{await setStatus(id,t.dataset.s)}catch(x){ORDERR=x.message;drawOrders()}return}
 if(t.dataset.w&&id){const o=ORDERS.find(x=>x.id===id);if(o)window.open('https://wa.me/'+waNum(o.whatsapp||o.phone)+'?text='+encodeURIComponent(msgFor(o)),'_blank');return}
 if(t.id==='oset')return drawSetup();if(t.id==='fbb')return drawOrders();if(t.id==='onot'){try{await Notification.requestPermission()}catch{}return}
 if(t.id==='oout'){try{const f=await fbInit();if(ounsub){ounsub();ounsub=null}ofirst=true;ORDERS=[];await f.Au.signOut(f.auth);nbadge()}catch{}return drawOrders()}
 if(t.id==='opub')return publish();
 if(t.id==='fbr'){const em=($('#fbe')||{}).value||'YOUR_EMAIL';const r=RULES(em);try{await navigator.clipboard.writeText(r);$('#fbm').style.color='#34d399';$('#fbm').textContent='Rules copied. Paste them in Firebase → Firestore → Rules → Publish.'}catch{prompt('Copy these rules:',r)}return}
 if(t.id==='fbs'){const m=$('#fbm');m.style.color='#9cc4ff';m.textContent='Connecting…';const cfg=parseCfg($('#fbc').value),em=$('#fbe').value.trim(),pw=$('#fbp').value;
  if(!cfg)return m.textContent='Could not read the Firebase config. Paste the whole block.';if(!em||!pw)return m.textContent='Enter your owner email and password.';
  const old=fbCfg();if(FB&&JSON.stringify(old)!==JSON.stringify(cfg)){localStorage.setItem('zc_fb',JSON.stringify(cfg));return location.reload()}
  localStorage.setItem('zc_fb',JSON.stringify(cfg));localStorage.setItem('zc_fbemail',em);
  try{const f=await fbInit();await f.Au.signInWithEmailAndPassword(f.auth,em,pw);await startOrders();drawOrders()}catch(x){const c=x.code||'';m.style.color='#ff7a8a';m.textContent=/invalid-credential|wrong-password|user-not-found/.test(c)?'Wrong email or password.':/operation-not-allowed/.test(c)?'Enable Email/Password sign-in in Firebase → Authentication.':/unauthorized-domain/.test(c)?'Add this website address to Firebase → Authentication → Settings → Authorized domains.':'Sign-in failed: '+(x.message||c)}}}
const RULES=em=>`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner() { return request.auth != null && request.auth.token.email == '${em}'; }
    match /catalog/{id} { allow read: if true; allow write: if isOwner(); }
    match /profiles/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      allow read: if isOwner();
    }
    match /orders/{oid} {
      allow create: if request.auth != null && request.resource.data.uid == request.auth.uid
        && request.resource.data.status == 'new' && request.resource.data.items.size() > 0 && request.resource.data.items.size() <= 60;
      allow read: if isOwner() || (request.auth != null && resource.data.uid == request.auth.uid);
      allow update, delete: if isOwner();
    }
  }
}`;
/* publish catalog */
async function thumb(src){if(!src)return '';if(!/^data:/.test(src))return /^https?:/.test(src)?src:'';return new Promise(res=>{const im=new Image();im.onload=()=>{const s=Math.min(1,300/im.width),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*s));c.height=Math.max(1,Math.round(im.height*s));c.getContext('2d').drawImage(im,0,0,c.width,c.height);let u=c.toDataURL('image/webp',.7);if(!u.startsWith('data:image/webp'))u=c.toDataURL('image/jpeg',.7);res(u)};im.onerror=()=>res('');im.src=src})}
const ageOf=x=>{const a=+(x.age||x.pegi||x.ageRating||x.minAge||0);return a||(/18\+|adult|mature/i.test([x.genre,x.tags,x.rated,x.esrb].join(' '))?18:0)};
async function toItem(t,x){return{id:t[0]+'_'+x.id,type:t,name:String(x.name||x.title||'').slice(0,120),price:+x.price||0,oldPrice:+x.oldPrice||0,size:+x.size||0,genre:String(x.genre||x.category||'').split(/[,/]/)[0].trim().slice(0,30),year:x.year||'',rating:x.rating||x.imdb||'',desc:String(x.desc||x.description||x.overview||x.plot||x.notes||'').slice(0,300),age:ageOf(x),platform:String(t==='game'?(x.platform||x.system||'PC'):t==='movie'?(x.quality||x.res||x.language||''):(x.platform||'Windows')).slice(0,30),image:await thumb(x.image||x.poster||x.imageUrl||x.posterUrl||'')}}
function chunkItems(items,max){const ch=[];let cur=[],sz=0;for(const it of items){const n=JSON.stringify(it).length;if(sz+n>max&&cur.length){ch.push(cur);cur=[];sz=0}cur.push(it);sz+=n}if(cur.length)ch.push(cur);return ch}
async function publish(){const out=$('#pubmsg'),say=t=>{if(out)out.textContent=t};try{const f=await fbInit(),{F}=f;say('Reading your catalog…');
 const G=(await getAll('g','games'))||[],M=(await getAll('m','movies'))||[],S=(await getAll('s','software'))||[];
 const src=[...G.filter(x=>!x.wish).map(x=>['game',x]),...M.filter(x=>!['sold','watched'].includes(x.status)).map(x=>['movie',x]),...S.filter(x=>x.status!=='out').map(x=>['software',x])];
 if(!src.length)return say('Nothing to publish yet. Add games, movies or software first.');
 const items=[];let i=0;for(const[t,x]of src){if(++i%4===0)say(`Preparing ${i}/${src.length}…`);items.push(await toItem(t,x))}
 const chunks=chunkItems(items,600000),m=await F.getDoc(F.doc(f.db,'catalog','meta')),old=m.exists()?(m.data().chunks||[]):[],ids=[];
 for(let k=0;k<chunks.length;k++){say(`Uploading part ${k+1}/${chunks.length}…`);const id='c'+k;ids.push(id);await F.setDoc(F.doc(f.db,'catalog',id),{items:chunks[k],updated:Date.now()})}
 await F.setDoc(F.doc(f.db,'catalog','meta'),{chunks:ids,count:items.length,updated:Date.now()});for(const id of old)if(!ids.includes(id))await F.deleteDoc(F.doc(f.db,'catalog',id));
 say(`✅ Published ${items.length} items (${G.filter(x=>!x.wish).length} games, ${items.filter(x=>x.type==='movie').length} movies, ${items.filter(x=>x.type==='software').length} software).`)}catch(e){say('❌ '+(e.message||e))}}
$('#tO').onclick=openOrders;fbBoot();
