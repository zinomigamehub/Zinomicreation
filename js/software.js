const $=s=>document.querySelector(s),LS=localStorage;
const CATS=[['Operating Systems','🪟','#168cff'],['Office & Productivity','📄','#f59e0b'],['Design & Creative','🎨','#ec4899'],['Video & Audio','🎬','#8b5cf6'],['Security & Antivirus','🛡️','#10b981'],['Utilities & Tools','🧰','#06b6d4'],['Developer Tools','💻','#64748b'],['Other','📦','#94a3b8']];
const PLAT=['Windows','macOS','Android','Linux','Any'];
const cm=c=>CATS.find(x=>x[0]===c)||CATS[7];
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const jl=(k,d)=>{try{const v=JSON.parse(LS.getItem(k));return v==null?d:v}catch{return d}};
const cur=()=>{const c=LS.getItem('zh_cur');try{return JSON.parse(c)||'Rs.'}catch{return c||'Rs.'}};
const money=v=>cur()+' '+Math.round(v||0).toLocaleString();
const fs=g=>!(+g>0)?'—':g>=1?(+g%1?(+g).toFixed(1):+g)+' GB':Math.round(g*1024)+' MB';
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
let items=[],DB=null,cart=new Set(jl('zs_cart',[])),cat='All',cust=LS.getItem('zs_cust')==='1';
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),2200)};
/* storage */
const idb=()=>new Promise((res,rej)=>{const r=indexedDB.open('ZinomiSoftwareHubDB',1);r.onupgradeneeded=()=>r.result.createObjectStore('software',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const tx=(m,f)=>new Promise((res,rej)=>{if(!DB)return res([]);const t=DB.transaction('software',m),q=f(t.objectStore('software'));t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error)});
const put=r=>tx('readwrite',s=>s.put(r)),del=id=>tx('readwrite',s=>s.delete(id));
async function reload(){if(DB)items=await tx('readonly',s=>s.getAll())||[];render()}
/* render */
function list(){const q=$('#search').value.trim().toLowerCase(),s=$('#sort').value;
 const a=items.filter(x=>(cat==='All'||x.category===cat)&&(!q||(x.name+' '+(x.version||'')+' '+x.category+' '+(x.notes||'')+' '+(x.disk||'')).toLowerCase().includes(q)));
 a.sort((x,y)=>s==='price'?(+x.price||0)-(+y.price||0):s==='size'?(+y.size||0)-(+x.size||0):s==='new'?(y.created||0)-(x.created||0):x.name.localeCompare(y.name));return a}
function render(){
 cart.forEach(id=>{if(!items.some(x=>x.id===id))cart.delete(id)});
 const a=list();$('#cnt').textContent=a.length+' shown';
 const ch=['All',...CATS.map(c=>c[0]).filter(c=>items.some(x=>x.category===c))];
 $('#chips').innerHTML=ch.map(c=>`<button class="chip ${c===cat?'on':''}" data-c="${esc(c)}">${c==='All'?'All':cm(c)[1]+' '+esc(c)}<small>${c==='All'?items.length:items.filter(x=>x.category===c).length}</small></button>`).join('');
 $('#grid').innerHTML=a.length?a.map((x,i)=>{const c=cm(x.category),d=+x.oldPrice>+x.price&&+x.price>0?Math.round((1-x.price/x.oldPrice)*100):0,inC=cart.has(x.id);
  const img=x.image?`<img src="${esc(x.image)}" alt="" loading="lazy">`:`<div class="ph" style="background:linear-gradient(135deg,${c[2]}66,#0a1230)"><div><b>${c[1]}</b><span>${esc(x.name.split(/\s+/).slice(0,2).join(' ').toUpperCase())}</span></div></div>`;
  return `<div class="card" style="--i:${Math.min(i,24)}" data-id="${x.id}"><div class="cv">${img}${d?`<span class="off">-${d}%</span>`:''}${x.status==='out'?'<span class="na">Unavailable</span>':''}</div><div class="bd"><div class="nm">${esc(x.name)}</div><div class="mt">${esc(x.version||'')}${x.version&&x.platform?' · ':''}${esc(x.platform||'')}${x.disk?' · 💽 '+esc(x.disk):''}</div><div class="tags"><span class="tg" style="border-color:${c[2]}88">${c[1]} ${esc(x.category)}</span></div><div class="row"><span class="pr">${+x.price>0?money(x.price):'Ask price'}${d?`<s>${money(x.oldPrice)}</s>`:''}</span><span class="sz">💾 ${fs(x.size)}</span></div><div class="acts"><button class="btn ${inC?'':'pri'}" data-a="cart" ${x.status==='out'?'disabled':''}>${inC?'✓ In cart':'＋ Add to cart'}</button><button class="btn ic adm" data-a="edit" title="Edit">✎</button></div></div></div>`}).join('')
  :`<div class="empty"><h3>${items.length?'No software matches':'No software yet'}</h3><p>${items.length?'Try another search or category.':'Add your first software, paste a list with Quick add, or load a starter list.'}</p><div class="adm"><button class="btn pri" id="st">Load starter list</button></div></div>`;
 const tot=items.reduce((s,x)=>s+(+x.price||0),0),sz=items.reduce((s,x)=>s+(+x.size||0),0);
 $('#s1').textContent=items.length;$('#s2').textContent=sz>=1000?(sz/1000).toFixed(1)+' TB':fs(sz).replace('—','0 GB');$('#s3').textContent=money(tot);$('#s4').textContent=cart.size;$('#cc').textContent=cart.size;
 LS.setItem('zs_cart',JSON.stringify([...cart]));drawCart()}
/* cart */
function drawCart(){const a=items.filter(x=>cart.has(x.id)),t=a.reduce((s,x)=>s+(+x.price||0),0),z=a.reduce((s,x)=>s+(+x.size||0),0);
 $('#dl').innerHTML=a.length?a.map(x=>`<div class="ci"><div><b>${esc(x.name)}</b><small>${fs(x.size)} · ${+x.price>0?money(x.price):'ask price'}</small></div><button data-r="${x.id}">✕</button></div>`).join(''):'<p class="mt">Your cart is empty.</p>';
 $('#ct1').textContent=a.length+' items · '+(z>=1000?(z/1000).toFixed(1)+' TB':fs(z).replace('—','0 GB'));$('#ct2').textContent=money(t)}
function msg(){const a=items.filter(x=>cart.has(x.id)),t=a.reduce((s,x)=>s+(+x.price||0),0),z=a.reduce((s,x)=>s+(+x.size||0),0),n=$('#cn').value.trim();
 return `Hi Zinomi Creation!${n?' I am '+n+'.':''} I would like to order these software:\n`+a.map((x,i)=>`${i+1}. ${x.name}${x.version?' '+x.version:''} (${fs(x.size)}) - ${+x.price>0?money(x.price):'ask price'}`).join('\n')+`\n\nTotal: ${money(t)}\nTotal size: ${z>=1000?(z/1000).toFixed(1)+' TB':fs(z)}`}
function record(){const a=items.filter(x=>cart.has(x.id));if(!a.length)return toast('Cart is empty'),false;
 const o=jl('zs_orders',[]);o.unshift({t:Date.now(),name:$('#cn').value.trim(),items:a.map(x=>x.name),count:a.length,size:a.reduce((s,x)=>s+(+x.size||0),0),total:a.reduce((s,x)=>s+(+x.price||0),0),done:true});LS.setItem('zs_orders',JSON.stringify(o));cart.clear();render();return true}
$('#wa').onclick=()=>{if(!cart.size)return toast('Cart is empty');const n=((LS.getItem('zwa')||'94702001206')+'').replace(/\D/g,'');window.open('https://wa.me/'+n+'?text='+encodeURIComponent(msg()),'_blank');if(record()){toast('Order saved');$('#drw').classList.remove('on')}};
$('#rs').onclick=()=>{if(record())toast('Sale recorded')};$('#cl').onclick=()=>{cart.clear();render()};$('#cx').onclick=()=>$('#drw').classList.remove('on');$('#cartB').onclick=()=>$('#drw').classList.add('on');
$('#dl').onclick=e=>{const r=e.target.dataset.r;if(r){cart.delete(r);render()}};
/* forms */
const mod=$('#mod');mod.onclick=e=>{if(e.target===mod)mod.classList.remove('on')};
const show=h=>{mod.innerHTML='<div class="box">'+h+'</div>';mod.classList.add('on');return mod.firstChild};
function shrink(file){return new Promise(res=>{const r=new FileReader();r.onload=()=>{const i=new Image();i.onload=()=>{const s=Math.min(1,520/i.width),c=document.createElement('canvas');c.width=i.width*s;c.height=i.height*s;c.getContext('2d').drawImage(i,0,0,c.width,c.height);res(c.toDataURL('image/webp',.82))};i.onerror=()=>res('');i.src=r.result};r.readAsDataURL(file)})}
function form(x){const n=!x;x=x||{category:'Other',platform:'Windows',status:'in',size:0,price:0};let u='GB',sv=+x.size||0;if(sv&&sv<1){sv=Math.round(sv*1024);u='MB'}
 const b=show(`<h3>${n?'Add software':'Edit software'}</h3><div class="f"><label class="w">Name<input id="fn" value="${esc(x.name||'')}" placeholder="e.g. Adobe Photoshop 2024"></label><label>Version<input id="fv" value="${esc(x.version||'')}" placeholder="e.g. v25.1"></label>
<label>Category<select id="fc">${CATS.map(c=>`<option ${c[0]===x.category?'selected':''}>${esc(c[0])}</option>`).join('')}</select></label>
<label>Platform<select id="fp">${PLAT.map(c=>`<option ${c===x.platform?'selected':''}>${c}</option>`).join('')}</select></label>
<label>Size<div class="sz2"><input id="fs" type="number" step="any" min="0" value="${sv||''}"><select id="fu"><option ${u==='MB'?'selected':''}>MB</option><option ${u==='GB'?'selected':''}>GB</option></select></div></label>
<label>Price<input id="fr" type="number" min="0" value="${x.price||''}"></label><label>Old price (optional)<input id="fo" type="number" min="0" value="${x.oldPrice||''}"></label>
<label>Drive / location<input id="fd" value="${esc(x.disk||'')}" placeholder="e.g. HDD 3"></label><label>Status<select id="ft"><option value="in" ${x.status!=='out'?'selected':''}>Available</option><option value="out" ${x.status==='out'?'selected':''}>Unavailable</option></select></label>
<label class="w">Notes<textarea id="fnote" rows="2">${esc(x.notes||'')}</textarea></label><label class="w">Picture (optional)<input id="fi" type="file" accept="image/*"></label></div>
<div class="ft">${n?'':'<button class="btn dng" id="fx">Delete</button><button class="btn" id="fd2">Duplicate</button>'}<button class="btn" id="fcn">Cancel</button><button class="btn pri" id="fsv">Save</button></div>`);
 b.querySelector('#fcn').onclick=()=>mod.classList.remove('on');
 b.querySelector('#fsv').onclick=async()=>{const nm=b.querySelector('#fn').value.trim();if(!nm)return toast('Enter a name');let s=+b.querySelector('#fs').value||0;if(b.querySelector('#fu').value==='MB')s/=1024;
  const f=b.querySelector('#fi').files[0],img=f?await shrink(f):(x.image||'');
  await put({...x,id:x.id||uid(),created:x.created||Date.now(),name:nm,version:b.querySelector('#fv').value.trim(),category:b.querySelector('#fc').value,platform:b.querySelector('#fp').value,size:s,price:+b.querySelector('#fr').value||0,oldPrice:+b.querySelector('#fo').value||0,disk:b.querySelector('#fd').value.trim(),status:b.querySelector('#ft').value,notes:b.querySelector('#fnote').value.trim(),image:img});mod.classList.remove('on');await reload();toast('Saved')};
 if(!n){b.querySelector('#fx').onclick=async()=>{if(confirm('Delete '+x.name+'?')){await del(x.id);cart.delete(x.id);mod.classList.remove('on');await reload()}};
  b.querySelector('#fd2').onclick=async()=>{await put({...x,id:uid(),created:Date.now(),name:x.name+' (copy)'});mod.classList.remove('on');await reload()}}}
const guess=n=>{n=n.toLowerCase();return /windows|win ?\d|ubuntu|linux/.test(n)?'Operating Systems':/office|word|excel|powerpoint|acrobat|pdf/.test(n)?'Office & Productivity':/photoshop|illustrator|coreldraw|corel|indesign|lightroom|canva|blender|autocad/.test(n)?'Design & Creative':/premiere|after effects|audition|davinci|vegas|filmora|camtasia|fl studio|cubase/.test(n)?'Video & Audio':/antivirus|kaspersky|norton|eset|mcafee|avast|security/.test(n)?'Security & Antivirus':/visual studio|python|android studio|jetbrains|vscode|java/.test(n)?'Developer Tools':/winrar|idm|driver|utility|cleaner|tool/.test(n)?'Utilities & Tools':'Other'};
function parseSize(t){const m=String(t||'').match(/([\d.]+)\s*(tb|gb|mb)?/i);if(!m)return 0;const v=parseFloat(m[1]);const u=(m[2]||'gb').toLowerCase();return u==='mb'?v/1024:u==='tb'?v*1024:v}
function quick(){const b=show(`<h3>⚡ Quick add</h3><p class="mt">One software per line:  <b>Name | Size | Price | Category (optional)</b><br>Example: <code>Adobe Photoshop 2024 | 3.2 GB | 500</code></p><textarea id="qt" rows="9" style="width:100%;background:#060c22;border:1px solid var(--line);border-radius:10px;padding:10px;color:var(--text);outline:0" placeholder="Windows 10 Pro | 5.4 GB | 300&#10;Microsoft Office 2019 | 3 GB | 400&#10;Adobe Premiere Pro | 2.1 GB | 600"></textarea><div class="ft"><button class="btn" id="qc">Cancel</button><button class="btn pri" id="qs">Add all</button></div>`);
 b.querySelector('#qc').onclick=()=>mod.classList.remove('on');
 b.querySelector('#qs').onclick=async()=>{const L=b.querySelector('#qt').value.split('\n').map(s=>s.trim()).filter(Boolean);let n=0;for(const l of L){const p=l.split('|').map(s=>s.trim());if(!p[0])continue;const c=CATS.find(c=>p[3]&&c[0].toLowerCase().startsWith(p[3].toLowerCase()));await put({id:uid(),created:Date.now()+n,name:p[0],version:'',category:c?c[0]:guess(p[0]),platform:/mac/i.test(p[0])?'macOS':'Windows',size:parseSize(p[1]),price:parseFloat((p[2]||'').replace(/[^\d.]/g,''))||0,oldPrice:0,disk:'',status:'in',notes:'',image:''});n++}mod.classList.remove('on');await reload();toast(n+' added')}}
async function starter(){const S=[['Windows 7','Operating Systems'],['Windows 8.1','Operating Systems'],['Windows 10','Operating Systems'],['Microsoft Office Package','Office & Productivity'],['Adobe Photoshop','Design & Creative'],['Adobe Illustrator','Design & Creative'],['Adobe Premiere Pro','Video & Audio']];let i=0;for(const [n,c] of S)await put({id:uid(),created:Date.now()+i++,name:n,version:'',category:c,platform:'Windows',size:0,price:0,oldPrice:0,disk:'',status:'in',notes:'',image:''});await reload();toast('Starter list added — now set size & price')}
/* backup */
function backup(){const b=show(`<h3>💾 Backup &amp; Restore</h3><p class="mt">Saves all software to one file. (The menu's "Full backup" also includes this hub.)</p><div class="ft" style="justify-content:flex-start"><button class="btn pri" id="bx">Download backup</button><label class="btn">Restore from file<input type="file" id="bi" accept=".json" hidden></label><button class="btn" id="bc">Close</button></div>`);
 b.querySelector('#bc').onclick=()=>mod.classList.remove('on');
 b.querySelector('#bx').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({app:'zinomi-software',v:1,t:Date.now(),items,orders:jl('zs_orders',[])})],{type:'application/json'}));a.download='zinomi-software-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();LS.setItem('zs_lastbk',Date.now());toast('Backup downloaded')};
 b.querySelector('#bi').onchange=async e=>{try{const o=JSON.parse(await e.target.files[0].text());if(o.app!=='zinomi-software')throw 0;if(!confirm('Replace all current software with this backup?'))return;await tx('readwrite',s=>s.clear());for(const r of o.items)await put(r);if(o.orders)LS.setItem('zs_orders',JSON.stringify(o.orders));mod.classList.remove('on');await reload();toast('Restored')}catch{toast('Not a valid backup file')}}}
/* events */
$('#grid').onclick=e=>{if(e.target.id==='st')return starter();const c=e.target.closest('.card');if(!c)return;const id=c.dataset.id,a=e.target.dataset.a;if(a==='cart'){cart.has(id)?cart.delete(id):cart.add(id);render()}else if(a==='edit')form(items.find(x=>x.id===id))};
$('#chips').onclick=e=>{const c=e.target.closest('.chip');if(c){cat=c.dataset.c;render()}};
$('#search').oninput=render;$('#sort').onchange=render;$('#addB').onclick=()=>form();$('#qB').onclick=quick;$('#bkB').onclick=backup;
const setCust=()=>{document.body.classList.toggle('cust',cust);$('#cuB').textContent=cust?'👁 Customer mode: ON':'👁 Customer mode';LS.setItem('zs_cust',cust?'1':'0')};
$('#cuB').onclick=()=>{cust=!cust;setCust()};setCust();
addEventListener('keydown',e=>{const t=e.target,ty=/INPUT|TEXTAREA|SELECT/.test(t.tagName);if(e.key==='Escape'){mod.classList.remove('on');$('#drw').classList.remove('on')}if(ty||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==='/'){e.preventDefault();$('#search').focus()}else if(e.key.toLowerCase()==='n'&&!cust)form()});
(async()=>{try{DB=await idb()}catch{toast('Storage unavailable in this browser')}await reload()})();
