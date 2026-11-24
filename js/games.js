/* DATABASE COMPATIBILITY: KEEP THESE VALUES */
const DB_NAME='ZinomiGameHubDB',STORE='games';
let gamesLoaded=false,lastFocus=null,cartFocus=null;
let db,editingId=null,selectedImage=null,existingImage=null,games=[];
const $=id=>document.getElementById(id);
const LS=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const LSset=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
let caps=LS('zh_caps',{}),extraHdds=LS('zh_hdds',0),listView=LS('zh_list',false),sfxOn=LS('zh_sfx',true),favOnly=false,diskSel='all',wishOnly=false,popId=null,wishN=0;
const DEFAULT_CAP=1000;
let cart=LS('zh_cart',[]),shop=LS('zh_shop',{name:'Zinomi Game Hub',wa:''}),clientMode=LS('zh_client',false),rmPick=null,cur=LS('zh_cur','Rs.'),orderRef=LS('zh_ref',null);

/* SYNTHESIZED CYBERPUNK UI AUDIO (Web Audio API) */
const AudioCtx=window.AudioContext||window.webkitAudioContext;
let actx;
function playSfx(type){
 if(!sfxOn||!AudioCtx)return;
 try{
  if(!actx)actx=new AudioCtx();
  if(actx.state==='suspended')actx.resume();
  const o=actx.createOscillator(),g=actx.createGain(),now=actx.currentTime;
  o.connect(g);g.connect(actx.destination);
  if(type==='click'){
   o.type='triangle';o.frequency.setValueAtTime(520,now);o.frequency.exponentialRampToValueAtTime(880,now+0.05);
   g.gain.setValueAtTime(0.06,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.06);
   o.start(now);o.stop(now+0.06);
  }else if(type==='tick'){
   o.type='sine';o.frequency.setValueAtTime(900,now);
   g.gain.setValueAtTime(0.04,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.03);
   o.start(now);o.stop(now+0.03);
  }else if(type==='err'){
   o.type='sawtooth';o.frequency.setValueAtTime(160,now);o.frequency.linearRampToValueAtTime(110,now+0.18);
   g.gain.setValueAtTime(0.08,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.19);
   o.start(now);o.stop(now+0.19);
  }else if(type==='unlock'){
   o.type='triangle';o.frequency.setValueAtTime(330,now);o.frequency.setValueAtTime(440,now+0.08);o.frequency.setValueAtTime(660,now+0.16);
   g.gain.setValueAtTime(0.08,now);g.gain.exponentialRampToValueAtTime(0.001,now+0.35);
   o.start(now);o.stop(now+0.35);
  }
 }catch{}
}
const SV1='<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zM17 8a5 5 0 0 1 0 8"/></svg>',SV2='<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9zM17 9l4 6m0-6-4 6"/></svg>';
function updateSfxBtn(){$('sfxBtn').innerHTML=sfxOn?'<span>'+SV1+'</span> Sound on':'<span>'+SV2+'</span> Sound off'}
updateSfxBtn();
$('sfxBtn').onclick=()=>{sfxOn=!sfxOn;LSset('zh_sfx',sfxOn);updateSfxBtn();if(sfxOn)playSfx('click')};

function notify(msg,undo){
 $('toastMsg').textContent=msg;$('undoBtn').hidden=!undo;$('undoBtn').onclick=()=>{playSfx('click');undo();$('toast').classList.remove('show')};
 $('toast').classList.add('show');clearTimeout(notify.t);notify.t=setTimeout(()=>$('toast').classList.remove('show'),undo?6000:2400);
}

/* DB */
const openDB=()=>new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const req=(mode,fn)=>new Promise((res,rej)=>{const r=fn(db.transaction(STORE,mode).objectStore(STORE));r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const allGames=()=>req('readonly',s=>s.getAll());
const saveRecord=g=>req('readwrite',s=>s.put(g));
const deleteRecord=id=>req('readwrite',s=>s.delete(id));
const money=v=>cur+' '+Number(v||0).toLocaleString('en-LK',{maximumFractionDigits:2});
const fmt=v=>Number(v||0).toLocaleString('en-LK',{maximumFractionDigits:2});
const hddName=n=>'HDD '+String(n).padStart(2,'0');
const hddList=()=>{const l=[];for(let i=1;i<=10+extraHdds;i++)l.push(hddName(i));games.forEach(g=>{if(g.disk&&!l.includes(g.disk))l.push(g.disk)});return l};
const own=()=>games.filter(g=>!g.wish);
const diskUsed=d=>own().filter(g=>g.disk===d).reduce((a,g)=>a+(+g.size||0),0);
const capOf=d=>+caps[d]||DEFAULT_CAP;

/* NAV */
function switchTab(t){
 playSfx('click');
 document.querySelectorAll('.section').forEach(s=>s.classList.toggle('active',s.id===t));
 document.querySelectorAll('.nav-btn[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
 if(t==='stats')renderStats();if(t==='ratings')renderRatingsDashboard();
 scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{if(b.dataset.tab==='adding'&&!editingId)resetForm();switchTab(b.dataset.tab)});
$('addBtn').onclick=()=>{resetForm();switchTab('adding')};
$('ratingsOpenBtn').onclick=()=>switchTab('ratings');
addEventListener('keydown',e=>{
 if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){e.preventDefault();switchTab('library');$('search').focus()}
});

/* IMAGE (auto-compress + web cover helper) */
function imgUrl(g,track){
 if(!g)return null;
 if(g.imageUrl)return g.imageUrl;
 if(g.image){
  if(typeof g.image==='string')return g.image;
  const u=URL.createObjectURL(g.image);
  if(track)track.push(u);
  return u;
 }
 return null;
}
function hasCover(g){return !!(g&&(g.imageUrl||g.image))}
function mountImg(box,g,alt,lazy){
 const u=imgUrl(g);
 if(!u)return false;
 const img=new Image();
 img.src=u;
 if(alt)img.alt=alt;
 if(lazy)img.loading='lazy';
 img.onload=()=>{if(u.startsWith('blob:'))URL.revokeObjectURL(u)};
 img.onerror=()=>{img.remove();if(!box.children.length)box.textContent='🎮'};
 box.append(img);
 return true;
}
function compress(file,max=480,q=.72){
 return new Promise(res=>{
  const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{
   const sc=Math.min(1,max/Math.max(img.width,img.height));
   const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*sc));c.height=Math.max(1,Math.round(img.height*sc));
   c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);
   const pick=b=>res(b&&b.size<file.size?new File([b],b.type==='image/webp'?'cover.webp':'cover.jpg',{type:b.type}):file);
   c.toBlob(w=>{if(w&&w.type==='image/webp')pick(w);else c.toBlob(pick,'image/jpeg',q)},'image/webp',q);
  };
  img.onerror=()=>{URL.revokeObjectURL(url);res(file)};img.src=url;
 });
}
async function takeImage(file){
 if(!file||!file.type.startsWith('image/'))return notify('Please choose an image file');
 if(file.size>20*1024*1024)return notify('Image too large (max 20 MB)');
 selectedImage=await compress(file);showPreview(selectedImage);playSfx('click');
}
function showPreview(f){
 if(!f){$('preview').textContent='Click, drop or paste cover art';return}
 if(typeof f==='string'){
  const img=new Image();img.src=f;
  img.onerror=()=>{$('preview').textContent='⚠ Could not load image URL'};
  $('preview').replaceChildren(img);return;
 }
 const url=URL.createObjectURL(f),img=new Image();img.src=url;img.onload=()=>URL.revokeObjectURL(url);$('preview').replaceChildren(img);
}
function syncCoverPreview(){
 const u=$('gameImageUrl').value.trim();
 if(u)showPreview(u);
 else if(selectedImage)showPreview(selectedImage);
 else if(existingImage)showPreview(existingImage);
 else $('preview').textContent='Click, drop or paste cover art';
}
$('preview').onclick=()=>$('gameImage').click();
$('gameImage').onchange=e=>takeImage(e.target.files[0]);
$('gameImageUrl').oninput=syncCoverPreview;
['dragover','dragenter'].forEach(ev=>$('preview').addEventListener(ev,e=>{e.preventDefault();$('preview').classList.add('drag')}));
['dragleave','drop'].forEach(ev=>$('preview').addEventListener(ev,e=>{e.preventDefault();$('preview').classList.remove('drag')}));
$('preview').addEventListener('drop',e=>takeImage(e.dataTransfer.files[0]));
addEventListener('paste',e=>{if(!$('adding').classList.contains('active'))return;const f=[...e.clipboardData.files].find(f=>f.type.startsWith('image/'));if(f)takeImage(f)});

$('autoCoverBtn').onclick=()=>{
 const q=$('gameName').value.trim();
 if(!q)return notify('Enter a game name first');
 playSfx('click');
 window.open('https://www.google.com/search?tbm=isch&q='+encodeURIComponent(q+' video game cover art'),'_blank');
 notify('Copy an image & press Ctrl+V here!');
};

/* STORAGE HELPERS */
async function saveRecordSafe(rec){
 try{await saveRecord(rec);updStorage();return}catch(e){
  if(!rec.image||typeof rec.image==='string')throw e;
  try{rec.image=await compress(rec.image,320,.5);await saveRecord(rec);notify('Storage low - cover shrunk to fit');updStorage();return}
  catch(e2){rec.image=null;await saveRecord(rec);notify('Storage full - saved WITHOUT cover. Use Free Up Space');updStorage()}
 }
}
async function updStorage(){
 const t=$('storTxt'),b=$('storBar');if(!t||!navigator.storage||!navigator.storage.estimate)return;
 try{const {usage,quota}=await navigator.storage.estimate(),p=quota?Math.min(100,usage/quota*100):0,mb=v=>(v/1048576).toFixed(v>1073741824?0:1)+' MB';
  t.textContent=mb(usage)+' used of '+mb(quota)+' ('+p.toFixed(1)+'%)';b.style.width=Math.max(2,p)+'%';b.parentNode.className='bar'+(p>=90?' full':p>=70?' warn':'')}catch{}
}
/* FORM */
function fillDiskSelects(){
 const l=hddList(),cur=$('gameDisk').value,cf=diskSel;
 $('gameDisk').replaceChildren(new Option('Select HDD',''),...l.map(d=>new Option(d,d)));$('gameDisk').value=cur;
 const f=$('diskFilter');
 f.replaceChildren(new Option('All HDDs','all'),...l.map(d=>new Option(d,d)),new Option('Unassigned','unassigned'));f.value=cf;
}
function resetForm(){
 editingId=null;selectedImage=null;existingImage=null;$('gameForm').reset();
 $('preview').textContent='Click, drop or paste cover art';$('formTitle').textContent='Add a game';$('saveBtn').textContent='Save game';
 $('dupHint').hidden=true;spaceHint();
}
$('clearBtn').onclick=()=>{playSfx('click');resetForm()};
function spaceHint(){
 const d=$('gameDisk').value,h=$('spaceHint');
 if(!d){h.textContent='';h.className='hint';return}
 let used=diskUsed(d);if(editingId){const o=games.find(g=>g.id===editingId);if(o&&o.disk===d)used-=+o.size||0}
 const free=capOf(d)-used,need=+$('gameSize').value||0;
 h.textContent=fmt(free)+' GB free on '+d;h.className='hint'+(need>free?' warn':'');
 if(need>free)h.textContent+=' — insufficient slot capacity!';
}
$('gameDisk').onchange=$('gameSize').oninput=spaceHint;
$('gameName').oninput=()=>{
 const n=$('gameName').value.trim().toLowerCase(),d=n&&games.find(g=>g.id!==editingId&&(g.name||'').toLowerCase()===n);
 $('dupHint').hidden=!d;if(d)$('dupHint').textContent='⚠ Duplicate detected'+(d.disk?' on '+d.disk:'')+'.';
};
$('gameForm').onsubmit=async e=>{
 e.preventDefault();const name=$('gameName').value.trim();if(!name)return;
 try{
  const old=editingId?games.find(g=>g.id===editingId):null;
  const done=$('gameStatus').value==='completed'&&!$('gameWish').checked&&old?.status!=='completed';
  const rec={
   id:editingId||'g_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),name,
   price:Number($('gamePrice').value)||0,salePrice:Number($('gameSale').value)||0,popular:$('gamePopular').checked,isNew:$('gameIsNew').checked,size:Number($('gameSize').value)||0,disk:$('gameDisk').value,
   platform:$('gamePlat').value.trim(),status:$('gameStatus').value,wish:$('gameWish').checked,fav:old?.fav||false,
   imageUrl:$('gameImageUrl').value.trim(),image:selectedImage||existingImage||null,note:$('gameNote').value.trim(),
   genre:$('gameGenre').value.trim(),year:Number($('gameYear').value)||0,desc:$('gameDesc').value.trim(),
   personalRating:$('gamePersonalRating').value===''?(old?.personalRating??null):Math.max(0,Math.min(10,Number($('gamePersonalRating').value))),
   rawgRating:old?.rawgRating??null,metacritic:old?.metacritic??null,rawgRating10:old?.rawgRating10??null,rawgRatingsCount:old?.rawgRatingsCount??0,rawgId:old?.rawgId??null,rawgSlug:old?.rawgSlug??null,rawgGenres:old?.rawgGenres??[],rawgFetchedAt:old?.rawgFetchedAt??null,rawgMatchName:old?.rawgMatchName??null,rawgLookupStatus:old?.rawgLookupStatus??'pending',
   req:{min:reqRead('Min')},
   banner:old?.banner||null,created:old?.created||Date.now(),updated:Date.now()
  };
  await saveRecordSafe(rec);
  resetForm();switchTab('library');await render();notify('Game saved to vault');if(done)confetti();
  if(!old)autoFetchGameRating(rec.id).catch(err=>console.warn('Automatic RAWG lookup:',err));
 }catch(err){console.error(err);playSfx('err');alert('Could not save: '+(err&&err.name||'error')+'. Browser storage is full. Click "Free Up Space" in the sidebar, export a backup, or delete unused games.')}
};
const REQK=['OS','CPU','RAM','GPU'];
const reqRead=p=>Object.fromEntries(REQK.map(k=>[k.toLowerCase(),$('rq'+p+k).value.trim()]));
function reqFill(p,o){REQK.forEach(k=>$('rq'+p+k).value=(o&&o[k.toLowerCase()])||'')}
function editGame(id){
 const g=games.find(x=>x.id===id);if(!g)return;
 editingId=id;existingImage=g.image||null;selectedImage=null;
 $('gameName').value=g.name||'';$('gameImageUrl').value=g.imageUrl||'';$('gamePrice').value=g.price||'';$('gameSale').value=g.salePrice||'';$('gamePopular').checked=!!g.popular;$('gameIsNew').checked=!!g.isNew;$('gameSize').value=g.size||'';
 $('gameDisk').value=g.disk||'';$('gamePlat').value=g.platform||'';$('gameStatus').value=g.status||'';$('gameWish').checked=!!g.wish;$('gameNote').value=g.note||'';
 $('gameGenre').value=g.genre||'';$('gameYear').value=g.year||'';$('gamePersonalRating').value=g.personalRating??'';$('gameDesc').value=g.desc||'';reqFill('Min',g.req&&g.req.min);
 (g.imageUrl||g.image)?showPreview(g.imageUrl||g.image):$('preview').textContent='🖼️ NO COVER — CLICK TO ADD';
 $('formTitle').textContent='✏️ EDIT GAME';$('saveBtn').textContent='UPDATE VAULT';spaceHint();switchTab('adding');
}
async function removeGame(id){
 const g=games.find(x=>x.id===id);if(!g)return;
 playSfx('err');
 await deleteRecord(id);await render();
 notify('Deleted “'+g.name+'”',async()=>{await saveRecord(g);await render();notify('Restored')});
}
async function toggleFav(g){g.fav=!g.fav;popId=g.fav?g.id:null;playSfx('click');await saveRecord(g);render()}

/* CARD */
function el(tag,cls,txt){const e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
/* CIRCULAR RATING BADGE */
const rrIO='IntersectionObserver' in window?new IntersectionObserver((es)=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('go');rrCount(e.target);rrIO.unobserve(e.target)}}),{threshold:.3}):null;
function rrCount(n){const b=n.querySelector('b'),to=Number(n.dataset.v),dc=Number(n.dataset.dec||1);if(matchMedia('(prefers-reduced-motion:reduce)').matches){b.textContent=to.toFixed(dc);return}const t0=performance.now();(function f(t){const k=Math.min(1,(t-t0-150)/1500),e=1-Math.pow(1-Math.max(0,k),3);b.textContent=(to*e).toFixed(dc);if(k<1)requestAnimationFrame(f)})(t0)}
function ratingRing(score,label,big,max,mini){
 const MX=max||10;
 if(score==null||score===''||!Number.isFinite(Number(score))){const n=el('div','rate-ring na'+(big?' lg':''));n.title=(label||'RAWG')+' rating not available yet';const NS='http://www.w3.org/2000/svg',sv=document.createElementNS(NS,'svg');sv.setAttribute('viewBox','0 0 52 52');['trk','prg'].forEach(c=>{const ci=document.createElementNS(NS,'circle');ci.setAttribute('class',c);ci.setAttribute('cx','26');ci.setAttribute('cy','26');ci.setAttribute('r','20');sv.append(ci)});const rv=el('div','rv');rv.append(el('b','','N/A'),el('small','',(label||'RAWG').toUpperCase()));n.append(sv,rv);return n}
 const v=Math.max(0,Math.min(MX,Number(score)||0)),col=MX===100?(v>=75?'#3ddc84':v>=50?'#f5c518':'#ef4444'):(v>=8?'#3ddc84':v>=6?'#f5c518':v>=4?'#fb923c':'#ef4444'),dec=MX===100?0:1;
 const n=el('div','rate-ring'+(big?' lg':'')+(mini?' mini':''));n.dataset.v=v;n.dataset.dec=dec;n.style.setProperty('--rc',col);n.style.setProperty('--p',v/MX);n.title=(label||'RAWG')+' rating: '+v.toFixed(dec)+' / '+MX;
 const NS='http://www.w3.org/2000/svg',sv=document.createElementNS(NS,'svg');sv.setAttribute('viewBox','0 0 52 52');
 ['trk','prg'].forEach(c=>{const ci=document.createElementNS(NS,'circle');ci.setAttribute('class',c);ci.setAttribute('cx','26');ci.setAttribute('cy','26');ci.setAttribute('r','20');sv.append(ci)});
 const rv=el('div','rv'),b=el('b','',dec?'0.0':'0'),sm=el('small','',(label||'RAWG').toUpperCase());rv.append(b,sm);n.append(sv,rv);
 if(rrIO)rrIO.observe(n);else{n.classList.add('go');b.textContent=v.toFixed(dec)}
 return n;
}

const STL={backlog:'📌 BACKLOG',playing:'▶ PLAYING',completed:'✔ CLEARED'};
function makeCard(g,i){
 const inCart=cart.includes(g.id),card=el('article','game'+(g.wish?' wish':'')+(inCart?' incart':'')),cover=el('div','cover');
 card.style.setProperty('--i',Math.min(i||0,20));
 if(!listView){
 }
 if(!mountImg(cover,g,(g.name||'Game')+' cover',true))cover.textContent='🎮';
 const fav=el('button','fav'+(g.fav?' on':'')+(popId===g.id?' pop':''),'★');fav.title='Favorite';fav.setAttribute('aria-label','Toggle favorite');fav.setAttribute('aria-pressed',g.fav?'true':'false');fav.onclick=()=>toggleFav(g);
 cover.classList.add('has-rate');cover.append(ratingRing(g.rawgRating10,'RAWG'));if(g.metacritic!=null)cover.append(ratingRing(g.metacritic,'META',false,100,true));
 cover.append(fav,el('div','hl'+(g.disk||g.wish?'':' un'),g.wish?'🎁 WISHLIST':g.disk?'📀 '+g.disk:'⚠ UNASSIGNED'));
 if(g.status)cover.append(el('div','st '+g.status,STL[g.status]));
 if(g.platform)cover.append(el('div','plat',g.platform.toUpperCase()));
 cover.append(priceNode(g,'pricetag'));if(onSale(g))cover.append(el('div','sale-b','-'+salePct(g)+'%'));
 const body=el('div','gb'),name=el('div','gn',g.name||'Untitled');name.title=g.name||'';
 const meta=el('div','gm'),sz=el('span','',fmt(g.size)+' GB'),pr=priceNode(g,'gp');
 if(listView&&g.disk)meta.append(el('span','',g.disk));
 meta.append(sz,pr);body.append(name,meta);
 if(g.personalRating!=null){const rt=el('div','game-rating');if(g.personalRating!=null)rt.append(el('span','mine','♥ My '+Number(g.personalRating).toFixed(1)+'/10'));body.append(rt)}
 if(g.note)body.append(el('div','gnote',g.note));
 const b=el('div','gbtn'),ed=el('button','btn small admin','✏️'),dl=el('button','btn red small admin','🗑');ed.title='Edit';ed.setAttribute('aria-label','Edit '+(g.name||'game'));
 ed.onclick=()=>editGame(g.id);dl.onclick=()=>removeGame(g.id);dl.title='Delete';dl.setAttribute('aria-label','Delete '+(g.name||'game'));
 if(!g.wish){const ad=el('button','btn buy small'+(inCart?' in':''),inCart?'✔ In cart':'Add to cart');ad.onclick=()=>toggleCart(g.id);b.append(ad)}
 else b.append(el('span','gm admin','Not owned yet'));
 const pf=el('button','btn small admin'+(g.popular?' on':''),'⭐');pf.title='Popular on/off';pf.onclick=()=>toggleFlag(g,'popular');
 const nw=el('button','btn small admin'+(g.isNew?' on':''),'🔥');nw.title='New arrival on/off';nw.onclick=()=>toggleFlag(g,'isNew');
 b.append(pf,nw,ed,dl);body.append(b);
 card.append(cover,body);
 card.onclick=e=>{if(e.target.closest('button'))return;openDetails(g.id)};
 card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label','View details for '+(g.name||'Untitled'));
 card.onkeydown=e=>{if(e.target===card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();openDetails(g.id)}};
 return card;
}

/* GAME DETAILS */
function openDetails(id){
 const g=games.find(x=>x.id===id);if(!g)return;
 playSfx('click');
 const box=$('dmBox');box.replaceChildren();
 const x=el('button','btn small dm-x','Close');x.onclick=closeDetails;
 const top=el('div','dm-top'),cv=el('div','dm-cover');
 if(!mountImg(cv,g,g.name,false))cv.textContent='🎮';
 cv.append(ratingRing(g.rawgRating10,'RAWG',true));if(g.metacritic!=null)cv.append(ratingRing(g.metacritic,'META',true,100,true));
 const info=el('div','');
 info.append(el('h3','dm-name',g.name||'Untitled'));
 const tags=el('div','dm-tags');
 [g.platform,g.genre,g.year||''].forEach(t=>{if(t)tags.append(el('span','',String(t)))});
 if(tags.children.length)info.append(tags);
 info.append(el('div','dm-desc',g.desc||'No description added yet.'));
 const f=el('div','dm-facts'),mk=(l,v,c)=>{const d=el('div',c||'',l);d.append(el('b','',v));return d};
 f.append(mk('INSTALL SIZE',fmt(g.size)+' GB'),mk('PLATFORM',g.platform||'PC'),mk('PRICE',money(effP(g))+(onSale(g)?'  (was '+money(g.price)+')':''),'pr'));
 if(g.rawgRating10!=null)f.append(mk('RAWG RATING',Number(g.rawgRating10).toFixed(1)+'/10'));if(g.metacritic!=null)f.append(mk('METACRITIC',g.metacritic+'/100'));if(g.personalRating!=null)f.append(mk('MY RATING',Number(g.personalRating).toFixed(1)+'/10'));
 if(!clientMode&&g.disk)f.append(mk('STORED ON',g.disk));
 info.append(f);
 const buy=el('div','dm-buy');
 if(!g.wish){const inC=cart.includes(g.id),b=el('button','btn buy'+(inC?' in':''),inC?'✔ In cart (tap to remove)':'Add to cart');b.onclick=()=>{toggleCart(g.id);openDetailsKeep(g.id)};buy.append(b)}
 else buy.append(el('span','gm','Not available yet'));
 if(!clientMode){const e=el('button','btn','✏️');e.title='Edit';e.setAttribute('aria-label','Edit '+(g.name||'game'));e.onclick=()=>{closeDetails();editGame(g.id)};buy.append(e)}
 info.append(buy);top.append(cv,info);
 const rq=el('div','dm-req'),r=g.req||{},mn=r.min||{};
 rq.append(el('h4','','MINIMUM SYSTEM REQUIREMENTS'));
 if(REQK.some(k=>mn[k.toLowerCase()])){
  const t=el('table','dm-table'),h=el('tr');
  ['','REQUIRED'].forEach(c=>h.append(el('th','',c)));t.append(h);
  const lab={OS:'OS',CPU:'PROCESSOR',RAM:'MEMORY',GPU:'GRAPHICS'};
  REQK.forEach(k=>{const tr=el('tr');tr.append(el('td','',lab[k]),el('td','',mn[k.toLowerCase()]||'—'));t.append(tr)});
  const st=el('tr');st.append(el('td','','STORAGE'),el('td','',fmt(g.size)+' GB free space'));t.append(st);
  rq.append(t);
 }else rq.append(el('div','dm-desc','Requirements not added yet. Ask the shop for details.'));
 box.append(x,top,rq);
 if(!$('detailModal').classList.contains('open'))lastFocus=document.activeElement;
 $('detailModal').classList.add('open');x.focus();
}
function openDetailsKeep(id){const bx=$('dmBox').scrollTop;openDetails(id);$('dmBox').scrollTop=bx}
function closeDetails(){$('detailModal').classList.remove('open');if(lastFocus&&lastFocus.focus&&document.contains(lastFocus))lastFocus.focus()}
$('detailModal').onclick=e=>{if(e.target.id==='detailModal')closeDetails()};
addEventListener('keydown',e=>{if(e.key==='Escape')closeDetails()});

/* CART */
const cartGames=()=>cart.map(id=>games.find(g=>g.id===id)).filter(Boolean);
function saveCart(){LSset('zh_cart',cart)}
function toggleCart(id){
 const g=games.find(x=>x.id===id);if(!g)return;
 const i=cart.indexOf(id);
 if(i>=0){cart.splice(i,1);playSfx('tick');notify('Removed “'+g.name+'”')}
 else{cart.push(id);playSfx('click');notify('Added “'+g.name+'” to cart');document.querySelectorAll('.cart-badge').forEach(b=>{b.classList.remove('bump');void b.offsetWidth;b.classList.add('bump')})}
 saveCart();render(true);
}
function cartTotals(){const l=cartGames();return{n:l.length,size:l.reduce((a,g)=>a+(+g.size||0),0),price:l.reduce((a,g)=>a+effP(g),0)}}
function renderCart(){
 cart=cart.filter(id=>games.some(g=>g.id===id));saveCart();
 const l=cartGames(),t=cartTotals();
 document.querySelectorAll('.cart-badge').forEach(b=>{b.textContent=t.n;b.hidden=!t.n});
 $('cSumCount').textContent=t.n;$('cSumSize').textContent=fmt(t.size)+' GB';$('cSumPrice').textContent=money(t.price);
 $('cartFoot').hidden=!l.length;updFree(t);
 const box=$('cartItems');box.replaceChildren();
 if(!l.length){const e=el('div','cd-empty');e.innerHTML='<strong>CART IS EMPTY</strong>Tap “Add to cart” on any game you want.';box.append(e);return}
 for(const g of l){
  const row=el('div','ci'),im=el('div','ci-img');
  if(!mountImg(im,g,g.name,false))im.textContent='🎮';
  const info=el('div','ci-info'),nm=el('div','ci-name',g.name);nm.title=g.name;
  info.append(nm,el('div','ci-meta',[g.platform||'PC',fmt(g.size)+' GB'].join(' // ')));
  const pr=el('div','ci-price',money(effP(g))),x=el('button','ci-x','✕');x.title='Remove';x.onclick=()=>toggleCart(g.id);
  row.append(im,info,pr,x);box.append(row);
 }
}
const getRef=()=>{if(!orderRef){orderRef='ZH-'+stamp().replace(/-/g,'')+'-'+Math.random().toString(36).slice(2,6).toUpperCase();LSset('zh_ref',orderRef)}return orderRef};
function updFree(t){const fr=+($('cFree')||{}).value,w=$('cWarn');if(!w)return;w.textContent=fr&&t.size>fr?'⚠ These games need '+fmt(t.size)+' GB but you have '+fmt(fr)+' GB free. Remove about '+fmt(t.size-fr)+' GB.':''}
function orderText(){
 const l=cartGames(),t=cartTotals(),nm=$('cName').value.trim(),note=$('cNote').value.trim();
 const lines=['Hi'+(shop.name?' '+shop.name:'')+'! I would like to order these games:',''];
 l.forEach((g,i)=>lines.push((i+1)+'. '+g.name+(g.platform?' ['+g.platform+']':'')+' - '+money(effP(g))+' ('+fmt(g.size)+' GB)'));
 lines.push('','Total: '+money(t.price)+' | '+t.n+' game'+(t.n>1?'s':'')+' | '+fmt(t.size)+' GB');
 if(nm)lines.push('Name: '+nm);const fr=+($('cFree')||{}).value;if(fr)lines.push('Free space: '+fmt(fr)+' GB');if(note)lines.push('Note: '+note);lines.push('Order ref: '+getRef());
 return lines.join('\n');
}
function openCart(){cartFocus=document.activeElement;playSfx('click');renderCart();setTimeout(()=>$('cartClose').focus(),60);$('cartDrawer').classList.add('open');$('cartOverlay').classList.add('open')}
function closeCart(){const was=$('cartDrawer').classList.contains('open');$('cartDrawer').classList.remove('open');$('cartOverlay').classList.remove('open');if(was&&cartFocus&&cartFocus.focus)cartFocus.focus()}
document.querySelectorAll('.cart-open').forEach(b=>b.onclick=openCart);
$('cartClose').onclick=$('cartOverlay').onclick=()=>{playSfx('click');closeCart()};
addEventListener('keydown',e=>{if(e.key==='Escape')closeCart()});
$('cWa').onclick=()=>{
 if(!cart.length)return notify('Your cart is empty');
 playSfx('unlock');
 const num=(shop.wa||'').replace(/\D/g,'');
 window.open('https://wa.me/'+num+'?text='+encodeURIComponent(orderText()),'_blank');orderRef=null;LSset('zh_ref',null);
};
$('cCopy').onclick=async()=>{
 if(!cart.length)return notify('Your cart is empty');
 try{await navigator.clipboard.writeText(orderText());playSfx('click');notify('Order list copied')}
 catch{prompt('Copy your order list:',orderText())}
};
$('cDl').onclick=()=>{if(!cart.length)return notify('Your cart is empty');playSfx('click');download(new Blob([orderText()],{type:'text/plain'}),'game-order-'+stamp()+'.txt')};
$('cClear').onclick=()=>{
 if(!cart.length)return;
 const old=[...cart];cart=[];saveCart();playSfx('err');render();
 notify('Cart emptied',()=>{cart=old;saveCart();render()});
};

/* CLIENT MODE */
function applyClient(){
 document.body.classList.toggle('client',clientMode);
 $('clientLbl').textContent=clientMode?'Exit Client Mode':'Client Mode';
 if(clientMode){if($('library').classList.contains('active')===false)switchTab('library');wishOnly=false;favOnly=false;diskSel='all'}
 $('shopTitle').textContent=shop.name||'Zinomi Game Hub';
}
$('clientBtn').onclick=async()=>{
 if(!clientMode){
  clientMode=true;LSset('zh_client',true);applyClient();playSfx('unlock');render();
  notify('Client mode on - owner tools hidden');
 }else{
  const k=prompt('Enter your access key to exit client mode:');if(k===null)return;
  if(await hash(k,lock.salt)!==lock.hash){playSfx('err');return notify('Wrong key')}
  clientMode=false;LSset('zh_client',false);applyClient();playSfx('click');render();notify('Owner mode');
 }
};
$('shopBtn').onclick=()=>{
 const n=prompt('Shop name (shown in the title and order message):',shop.name||'');if(n===null)return;
 const w=prompt('Your WhatsApp number WITH country code, digits only (e.g. 94771234567).\nOrders from clients will be sent here. Leave empty to let the client choose a contact:',shop.wa||'');if(w===null)return;
 const cu=prompt('Currency symbol (e.g. Rs., $, €):',cur);if(cu===null)return;cur=cu.trim()||'Rs.';LSset('zh_cur',cur);
 shop={name:n.trim(),wa:w.replace(/\D/g,'')};LSset('zh_shop',shop);applyClient();render();notify('Shop settings saved');
};

/* RANDOM GAME PICKER (ROULETTE) */
function spinRandomGame(){
 const list=own();
 if(!list.length)return notify('Add some owned games first!');
 $('rouletteModal').classList.add('open');
 let ticks=0,maxTicks=16;
 clearInterval(spinRandomGame.t);const timer=spinRandomGame.t=setInterval(()=>{
  const pick=list[Math.floor(Math.random()*list.length)];
  rmPick=pick;$('rmName').textContent=pick.name;
  $('rmMeta').textContent=[pick.platform||'PC',pick.disk||'Unassigned',fmt(pick.size)+' GB'].join(' // ');
  $('rmCover').replaceChildren();
  if(!mountImg($('rmCover'),pick,pick.name,false))$('rmCover').textContent='🎮';
  playSfx('tick');
  if(++ticks>=maxTicks){clearInterval(timer);playSfx('unlock')}
 },65);
}
$('randomBtn').onclick=spinRandomGame;
$('rmSpinAgain').onclick=spinRandomGame;
$('rmCart').onclick=()=>{if(rmPick&&!cart.includes(rmPick.id))toggleCart(rmPick.id);else if(rmPick)notify('Already in your cart')};
const closeRoulette=()=>{clearInterval(spinRandomGame.t);$('rouletteModal').classList.remove('open')};
$('rmClose').onclick=()=>{playSfx('click');closeRoulette()};
$('rouletteModal').onclick=e=>{if(e.target.id==='rouletteModal')closeRoulette()};
addEventListener('keydown',e=>{if(e.key==='Escape')closeRoulette()});

/* HDD MANAGER */
function renderHdds(){
 const box=$('hddSummary'),games=own();box.replaceChildren();
 const items=[...hddList(),'Unassigned'];
 for(const d of items){
  const un=d==='Unassigned',list=games.filter(g=>un?!g.disk:g.disk===d),used=list.reduce((a,g)=>a+(+g.size||0),0);
  const c=el('div','hdd'+(diskSel===(un?'unassigned':d)?' sel':''));
  c.onclick=()=>{diskSel=un?'unassigned':d;$('diskFilter').value=diskSel;switchTab('library');render()};
  const top=el('span','',un?'⚠ UNASSIGNED':'📀 '+d);
  if(!un){const e=el('button','','✎');e.style.cssText='background:none;border:0;color:var(--muted)';e.title='Set capacity';
   e.onclick=ev=>{ev.stopPropagation();const v=prompt('Capacity of '+d+' in GB:',capOf(d));if(v&&+v>0){caps[d]=+v;LSset('zh_caps',caps);render()}};top.append(e)}
  c.append(top,el('b','',list.length+' TITLES'));
  if(!un){const pct=Math.min(100,used/capOf(d)*100),bar=el('div','bar'+(pct>=100?' full':pct>=85?' warn':''));const i=el('i');i.style.width=pct+'%';bar.append(i);
   c.append(bar,el('small','',fmt(used)+' / '+fmt(capOf(d))+' GB · '+fmt(Math.max(0,capOf(d)-used))+' FREE'))}
  else c.append(el('small','',fmt(used)+' GB'));
  box.append(c);
 }
}
$('addHdd').onclick=()=>{playSfx('click');extraHdds++;LSset('zh_hdds',extraHdds);render();notify(hddName(10+extraHdds)+' mounted')};

/* RAWG GAME RATINGS - keeps the existing IndexedDB store and record IDs */
const RAWG_ENDPOINT_DEFAULT='https://prhfkwwijhczdeybmvar.supabase.co/functions/v1/dynamic-action';
let ratingCfg=LS('zh_rating_cfg',{endpoint:RAWG_ENDPOINT_DEFAULT,key:''}),ratingBusy=false;
function loadRatingConfigUI(){if(!$('ratingEndpoint'))return;$('ratingEndpoint').value=ratingCfg.endpoint||RAWG_ENDPOINT_DEFAULT;$('ratingPublicKey').value=ratingCfg.key||'';$('ratingConfigStatus').textContent=ratingCfg.key?'Connection settings saved on this browser.':'Paste your Supabase Publishable key and save.'}
function saveRatingConfig(){const endpoint=$('ratingEndpoint').value.trim(),key=$('ratingPublicKey').value.trim();if(!/^https:\/\/[a-z0-9.-]+\/functions\/v1\/[a-z0-9-]+$/i.test(endpoint))return notify('Enter a valid Supabase Edge Function URL');if(!key)return notify('Paste your Supabase Publishable key first');if(/service_role|secret/i.test(key))return notify('Do not use a service_role or secret key here');ratingCfg={endpoint,key};LSset('zh_rating_cfg',ratingCfg);$('ratingConfigStatus').textContent='Saved. You can test the connection now.';notify('Ratings connection saved')}
async function rawgSearch(query){
 if(!ratingCfg.key)throw new Error('Add your Supabase Publishable key in Game Ratings → API connection settings.');
 const response=await fetch(ratingCfg.endpoint||RAWG_ENDPOINT_DEFAULT,{method:'POST',headers:{'Content-Type':'application/json','apikey':ratingCfg.key},body:JSON.stringify({query})});
 let data={};try{data=await response.json()}catch{}
 if(!response.ok||data.success===false)throw new Error(data.error||('Function request failed ('+response.status+'). Check the Edge Function JWT setting and API key.'));
 if(!Array.isArray(data.results))throw new Error('Unexpected response from game-ratings function.');
 return data.results;
}
function normGameName(v){return String(v||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,' and ').replace(/\b(the|edition|remastered|deluxe|definitive|complete|goty)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')}
function matchGameResult(localName,results){
 const target=normGameName(localName);if(!target||!results.length)return null;
 let best=null,bestScore=0;
 for(const r of results){const n=normGameName(r.name);let score=0;if(n===target)score=1;else if(n.includes(target)||target.includes(n))score=Math.min(n.length,target.length)/Math.max(n.length,target.length)*.94;else{const a=new Set(target.split(' ')),b=new Set(n.split(' '));const overlap=[...a].filter(x=>b.has(x)).length;score=(2*overlap)/(a.size+b.size||1)}if(score>bestScore){bestScore=score;best=r}}
 return bestScore>=.68?best:null;
}
async function lookupRatingForGame(g){
 const results=await rawgSearch(g.name);const hit=matchGameResult(g.name,results);const fresh={...g,rawgFetchedAt:Date.now(),rawgLookupStatus:hit?'matched':'not-found'};
 if(hit){fresh.rawgId=hit.id??null;fresh.rawgSlug=hit.slug??null;fresh.rawgMatchName=hit.name??null;fresh.rawgRating=hit.rating??null;{const mc=Number(hit.metacritic??hit.metascore);fresh.metacritic=Number.isFinite(mc)&&mc>0?Math.round(mc):null}fresh.rawgRating10=hit.rating_out_of_10??(hit.rating!=null?Number((hit.rating*2).toFixed(1)):null);fresh.rawgRatingsCount=hit.ratings_count??0;fresh.rawgGenres=Array.isArray(hit.genres)?hit.genres:[];if(!fresh.genre&&fresh.rawgGenres.length)fresh.genre=fresh.rawgGenres.join(', ');if(!fresh.year&&hit.released)fresh.year=Number(String(hit.released).slice(0,4))||0;}
 await saveRecord(fresh);const i=games.findIndex(x=>x.id===g.id);if(i>=0)games[i]=fresh;return fresh;
}
async function autoFetchGameRating(id){
 const g=games.find(x=>x.id===id)|| (await allGames()).find(x=>x.id===id);if(!g)return;
 try{const updated=await lookupRatingForGame(g);await render(true);notify(updated.rawgRating10!=null?'RAWG rating added: '+updated.name+' ('+updated.rawgRating10+'/10)':'No confident RAWG match for '+g.name)}catch(e){console.warn(e);notify('Game saved. Automatic rating needs setup: '+e.message)}
}
const waitMs=ms=>new Promise(r=>setTimeout(r,ms));
async function importGameRatings(onlyMissing=true){
 if(ratingBusy)return; if(!ratingCfg.key){switchTab('ratings');return notify('Add your Supabase Publishable key in API connection settings first')}
 const list=[...games].filter(g=>!g.wish&&(!onlyMissing||g.rawgRating10==null));if(!list.length){renderRatingsDashboard();return notify(onlyMissing?'All owned games already have a RAWG rating.':'No owned games to rate.')}
 if(!confirm('Look up RAWG ratings for '+list.length+' games? This uses one API lookup per game. Your existing images, prices, HDD assignments and IDs will be preserved.'))return;
 ratingBusy=true;$('importRatingsBtn').disabled=$('retryRatingsBtn').disabled=true;let done=0,matched=0,failed=0;
 for(const g of list){
  $('ratingProgress').textContent='Looking up '+(done+1)+' / '+list.length+': '+g.name;
  try{const u=await lookupRatingForGame(g);if(u.rawgRating10!=null)matched++}catch(e){failed++;console.warn('RAWG lookup failed for',g.name,e)}
  done++;$('ratingProgressBar').style.width=(done/list.length*100)+'%';
  if(done<list.length)await waitMs(300);
 }
 games=await allGames();gamesLoaded=true;ratingBusy=false;$('importRatingsBtn').disabled=$('retryRatingsBtn').disabled=false;
 $('ratingProgress').textContent='Finished: '+matched+' matched · '+(list.length-matched-failed)+' no confident match · '+failed+' errors.';
 renderRatingsDashboard();await render(true);notify('RAWG import complete: '+matched+' games matched');
}
function renderRatingsDashboard(){
 if(!$('ratings'))return;const owned=games.filter(g=>!g.wish),rated=owned.filter(g=>Number.isFinite(Number(g.rawgRating10))&&g.rawgRating10!==null),personal=owned.filter(g=>g.personalRating!==null&&g.personalRating!==undefined&&g.personalRating!=='');
 const avg=a=>a.length?(a.reduce((s,g)=>s+Number(g.rawgRating10),0)/a.length).toFixed(2):'—';
 $('ratingTotal').textContent=owned.length;$('ratingRated').textContent=rated.length;$('ratingAverage').textContent=avg(rated);$('personalAverage').textContent=personal.length?(personal.reduce((s,g)=>s+Number(g.personalRating),0)/personal.length).toFixed(2):'—';
 const top=[...rated].sort((a,b)=>b.rawgRating10-a.rawgRating10).slice(0,10),tb=$('topRatedGames');tb.replaceChildren();if(!top.length)tb.append(el('div','hint','No RAWG ratings yet. Import ratings to build your Top 10.'));top.forEach((g,i)=>{const row=el('div','rating-line'),rank=el('span','rank',String(i+1).padStart(2,'0')),nm=el('span','nm',g.name),score=el('b','',Number(g.rawgRating10).toFixed(1)+'/10');row.append(rank,nm,score);row.title='RAWG: '+(g.rawgMatchName||g.name)+' · '+(g.rawgRatingsCount||0)+' ratings';row.onclick=()=>openDetails(g.id);row.style.cursor='pointer';tb.append(row)});
 const genres={};rated.forEach(g=>{const gs=(g.rawgGenres&&g.rawgGenres.length?g.rawgGenres:(g.genre||'').split(',')).map(x=>String(x).trim()).filter(Boolean);gs.forEach(k=>genres[k]=(genres[k]||0)+1)});const gb=$('ratingGenreStats');gb.replaceChildren();const entries=Object.entries(genres).sort((a,b)=>b[1]-a[1]).slice(0,12);if(!entries.length)gb.append(el('div','hint','Genre statistics will appear after ratings are imported.'));entries.forEach(([name,count])=>{const row=el('div','rating-line'),nm=el('span','nm',name),v=el('b','',count+' games');row.append(nm,v);gb.append(row)});
}
$('saveRatingConfig').onclick=saveRatingConfig;
$('testRatingConnection').onclick=async()=>{try{saveRatingConfig();const r=await rawgSearch('Red Dead Redemption 2');if(!r.length)throw new Error('Connection worked, but no results were returned.');$('ratingConfigStatus').textContent='Connected successfully. Example result: '+r[0].name;notify('RAWG connection successful')}catch(e){$('ratingConfigStatus').textContent='Connection test failed: '+e.message;notify('Connection test failed')}};
$('importRatingsBtn').onclick=()=>importGameRatings(false);
$('retryRatingsBtn').onclick=()=>importGameRatings(true);
loadRatingConfigUI();

/* STATS */
function rows(box,list){box.replaceChildren(...(list.length?list:[['','No telemetry data yet','']]).map((r,i)=>{const d=el('div','row');d.append(el('em','',r[0]===''?'':String(i+1).padStart(2,'0')),el('span','',r[1]),el('b','',r[2]));return d}))}
function renderStats(){
 const games=own(),top=(k,f)=>[...games].filter(g=>+g[k]>0).sort((a,b)=>b[k]-a[k]).slice(0,5).map(g=>[1,g.name,f(g[k])]);
 rows($('topSize'),top('size',v=>fmt(v)+' GB'));rows($('topPrice'),top('price',money));
 const per=hddList().map(d=>[1,d,games.filter(g=>g.disk===d).length+' games']).filter(r=>parseInt(r[2])>0);
 const un=games.filter(g=>!g.disk).length;if(un)per.push([1,'Unassigned',un+' games']);rows($('perHdd'),per);
 const n=games.length,sz=games.reduce((a,g)=>a+(+g.size||0),0),val=games.reduce((a,g)=>a+(+g.price||0),0);
 rows($('insights'),n?[['','Average price',money(val/n)],['','Average install size',fmt(sz/n)+' GB'],['','Cleared / Completed',games.filter(g=>g.status==='completed').length],['','Wishlist targets',wishN],['','Favorites',games.filter(g=>g.fav).length],['','Missing cover art',games.filter(g=>!hasCover(g)).length],['','Cost per GB',sz?money(val/sz):'—']]:[]);
 rows($('insights'),n?[['','Average price',money(val/n)],['','Average install size',fmt(sz/n)+' GB'],['','Cleared / Completed',games.filter(g=>g.status==='completed').length],['','Wishlist targets',wishN],['','Favorites',games.filter(g=>g.fav).length],['','RAWG rated',games.filter(g=>!g.wish&&g.rawgRating10!=null).length],['','Personal ratings',games.filter(g=>!g.wish&&g.personalRating!=null).length],['','Missing cover art',games.filter(g=>!hasCover(g)).length],['','Cost per GB',sz?money(val/sz):'—']]:[]);
}

/* HERO */
let heroIdx=0,heroUrls=[];
function effP(g){return g.salePrice>0&&g.salePrice<g.price?g.salePrice:(+g.price||0)}
function onSale(g){return g.salePrice>0&&g.salePrice<g.price}
function salePct(g){return Math.round(100-g.salePrice/g.price*100)}
function priceNode(g,cls){const e=el('span',cls||'');if(onSale(g)){e.append(el('s','',money(g.price)),document.createTextNode(' '+money(g.salePrice)))}else e.textContent=money(g.price);return e}
async function toggleFlag(g,k){
 const first=k==='popular'&&!g.popular&&!games.some(x=>x.popular);
 g[k]=!g[k];await saveRecord(g);await render();
 notify(first?'Popular now shows only the games you pick':(g[k]?'Added to ':'Removed from ')+(k==='popular'?'Popular Games':'New Arrivals'));
}
function rowTile(g){
 const t=el('div','rt'),p=el('div','rtp');
 const u=imgUrl(g,heroUrls);if(u)p.style.backgroundImage='url('+JSON.stringify(u)+')';else p.textContent='🎮';
 if(onSale(g))p.append(el('span','sale-b','-'+salePct(g)+'%'));
 const n=el('div','rtn',g.name||'Untitled');n.title=g.name||'';
 t.append(p,n,priceNode(g,'rtm'));t.onclick=()=>openDetails(g.id);return t;
}
function renderRows(list,show){
 const w=$('moreRows');w.replaceChildren();if(!show)return;
 const nf=list.filter(g=>g.isNew),rows=[['🏷 On Sale',list.filter(onSale).slice(0,14)]];
 const gm={};list.forEach(g=>{const k=(g.genre||'').trim();if(k)(gm[k]=gm[k]||[]).push(g)});
 Object.entries(gm).filter(e=>e[1].length>=2).sort((a,b)=>b[1].length-a[1].length).slice(0,6).forEach(e=>rows.push([e[0],e[1].slice(0,14)]));
 rows.filter(r=>r[1].length).forEach(r=>{w.append(el('div','row-t',r[0]));const d=el('div','hero-row');r[1].forEach(g=>d.append(rowTile(g)));w.append(d)});
}
function renderHero(list,show){
 const h=$('hero'),rw=$('heroRowWrap'),rr=$('heroRow'),sl=rr.scrollLeft;
 heroUrls.forEach(u=>URL.revokeObjectURL(u));heroUrls=[];
 renderRows(list,show);
 const pool=show?list.filter(hasCover):[],pfl=pool.filter(g=>g.popular),c=[...pfl,...pool.filter(x=>!x.popular)].slice(0,60);
 if(!c.length){h.hidden=true;rw.hidden=true;return}
 h.hidden=false;rw.hidden=false;if(heroIdx>=c.length)heroIdx=0;
 const g=c[heroIdx],bg=imgUrl(g,heroUrls);
 h.replaceChildren();
 const bgd=el('div','hero-bg');bgd.style.backgroundImage='url('+JSON.stringify(bg)+')';
 const inn=el('div','hero-in');
 inn.append(el('span','tag','● '+(g.fav?'Favorite':'Featured')),el('h2','',g.name||'Untitled'),el('div','meta',[g.platform||'PC',fmt(g.size)+' GB',onSale(g)?money(g.salePrice)+' (-'+salePct(g)+'%)':money(g.price)].join('  ·  ')),el('p','',g.desc||''));
 const b=el('div','hero-btns');
 if(!g.wish){const a=el('button','btn primary',cart.includes(g.id)?'✔ In cart':'Add to cart');a.onclick=()=>toggleCart(g.id);b.append(a)}
 const pb=el('button','btn admin'+(g.popular?' on':''),'⭐');pb.title=g.popular?'Remove from Popular':'Add to Popular';pb.onclick=()=>toggleFlag(g,'popular');b.append(pb);
 const d=el('button','btn','ⓘ');d.title='Details';d.onclick=()=>openDetails(g.id);b.append(d);inn.append(b);
 const cv=el('div','hero-cover');cv.style.backgroundImage='url('+JSON.stringify(bg)+')';
 const ar=el('div','hero-arrows'),pv=el('button','','‹'),nx=el('button','','›');
 pv.setAttribute('aria-label','Previous');nx.setAttribute('aria-label','Next');
 pv.onclick=()=>{heroIdx=(heroIdx-1+c.length)%c.length;playSfx('tick');renderHero(list,show)};
 nx.onclick=()=>{heroIdx=(heroIdx+1)%c.length;playSfx('tick');renderHero(list,show)};
 ar.append(pv,nx);h.append(bgd,inn,cv,ar);
 rr.replaceChildren();
 c.forEach((x,i)=>{const u=imgUrl(x,heroUrls);const t=el('button',i===heroIdx?'on':'');t.style.backgroundImage='url('+JSON.stringify(u)+')';t.title=x.name||'';t.onclick=()=>{heroIdx=i;playSfx('tick');renderHero(list,show)};rr.append(t)});
 rr.scrollLeft=sl;
}

/* RENDER */
async function render(skip){
 if(skip!==true||!gamesLoaded){games=await allGames();gamesLoaded=true}
 renderCart();
 fillDiskSelects();
 const O=own(),sz=O.reduce((a,g)=>a+(+g.size||0),0),val=O.reduce((a,g)=>a+(+g.price||0),0);wishN=games.length-O.length;
 countTo('totalCount',O.length,Math.round);countTo('totalSize',sz,v=>fmt(v)+' GB');countTo('totalValue',val,money);countTo('unassigned',O.filter(g=>!g.disk).length,Math.round);
 renderHdds();
 const gs=[...new Set(games.map(g=>(g.genre||'').trim()).filter(Boolean))].sort(),gsel=$('genreFilter'),gcur=gsel.value;gsel.replaceChildren(new Option('All genres',''),...gs.map(x=>new Option(x,x)));gsel.value=gs.includes(gcur)?gcur:'';
 const q=$('search').value.trim().toLowerCase();
 if(clientMode){diskSel='all';$('statusFilter').value=''}
 let list=games.filter(g=>(clientMode?[g.name,g.platform]:[g.name,g.note,g.platform,g.disk]).join(' ').toLowerCase().includes(q));
 if(diskSel==='unassigned')list=list.filter(g=>!g.disk);else if(diskSel!=='all')list=list.filter(g=>g.disk===diskSel);
 if(clientMode){diskSel='all';favOnly=false;wishOnly=false}
 if(favOnly)list=list.filter(g=>g.fav);
 list=list.filter(g=>wishOnly?g.wish:!g.wish);
 const sf=$('statusFilter').value;if(sf)list=list.filter(g=>g.status===sf);
 const gf=$('genreFilter').value,mp=+$('maxPrice').value,ms=+$('maxSize').value;
 if(gf)list=list.filter(g=>(g.genre||'').trim()===gf);if(mp)list=list.filter(g=>(+g.price||0)<=mp);if(ms)list=list.filter(g=>(+g.size||0)<=ms);
 const minRawg=+$('minRatingFilter').value||0;if(minRawg===-1)list=list.filter(g=>g.rawgRating10==null);else if(minRawg)list=list.filter(g=>g.rawgRating10!=null&&g.rawgRating10>=minRawg);
 const S={az:(a,b)=>(a.name||'').localeCompare(b.name||''),za:(a,b)=>(b.name||'').localeCompare(a.name||''),price:(a,b)=>(a.price||0)-(b.price||0),pricedesc:(a,b)=>(b.price||0)-(a.price||0),size:(a,b)=>(a.size||0)-(b.size||0),sizedesc:(a,b)=>(b.size||0)-(a.size||0),new:(a,b)=>(b.created||0)-(a.created||0),ratingdesc:(a,b)=>(b.rawgRating10??-1)-(a.rawgRating10??-1),personaldesc:(a,b)=>(b.personalRating??-1)-(a.personalRating??-1)};
 list.sort(S[$('sort').value]);
 renderHero(list,!q&&!listView&&!wishOnly&&!favOnly&&diskSel==='all'&&!$('statusFilter').value&&!$('genreFilter').value&&!$('maxPrice').value&&!$('maxSize').value);
 $('library').classList.toggle('list',listView);$('gameGrid').classList.toggle('noanim',skip===true);
 $('gameGrid').replaceChildren(...list.map(makeCard));
 const shown=games.filter(g=>clientMode?!g.wish:true).length;
 $('resultCount').textContent='SHOWING '+(list.length===shown?shown+' TITLES':list.length+' OF '+shown+' TITLES');
 const em=$('empty');em.hidden=!!list.length;
 em.innerHTML=wishOnly&&!list.length&&!q&&!favOnly?'<strong>WISHLIST EMPTY</strong>Add a game and tick “Wishlist”.':!games.length?(clientMode?'<strong>NO GAMES YET</strong>Please check back soon.':'<strong>VAULT EMPTY</strong>Click “Add game” to initialize your library.'):'<strong>NO MATCHING GAMES</strong>Try a different search.';
 if($('stats').classList.contains('active'))renderStats();if($('ratings').classList.contains('active'))renderRatingsDashboard();
}
let searchT;$('search').oninput=()=>{clearTimeout(searchT);searchT=setTimeout(()=>render(true),150)};$('statusFilter').onchange=()=>{playSfx('click');render(true)};
$('wishOnly').onclick=()=>{playSfx('click');wishOnly=!wishOnly;$('wishOnly').classList.toggle('on',wishOnly);render(true)};$('sort').onchange=()=>{playSfx('click');render(true)};
$('diskFilter').onchange=()=>{playSfx('click');diskSel=$('diskFilter').value;render(true)};
$('favOnly').onclick=()=>{playSfx('click');favOnly=!favOnly;$('favOnly').classList.toggle('on',favOnly);render(true)};
$('viewBtn').onclick=()=>{playSfx('click');listView=!listView;LSset('zh_list',listView);render(true)};

/* BACKUP / RESTORE / CSV */
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)}
const stamp=()=>new Date().toISOString().slice(0,10);
$('backupBtn').onclick=async()=>{
 playSfx('click');
 try{
  const recs=[];
  for(const g of games){
   const image=g.image?(typeof g.image==='string'?g.image:await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(g.image)})):null;
   const banner=g.banner?(typeof g.banner==='string'?g.banner:await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(g.banner)})):null;recs.push({...g,image,banner});
  }
  download(new Blob([JSON.stringify({app:'Zinomi Game Hub',version:1,exported:new Date().toISOString(),caps,extraHdds,shop,cur,sales:(()=>{try{return JSON.parse(localStorage.getItem('zh_sales')||'[]')}catch{return[]}})(),games:recs})],{type:'application/json'}),'zinomi-backup-'+stamp()+'.json');
  notify('Backup downloaded');
 }catch(err){console.error(err);alert('Backup failed.')}
};
$('csvBtn').onclick=()=>{
 playSfx('click');
 const q=v=>{let t=String(v??'');if(/^[=+\-@\t\r]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"'};
 const csv=['Name,Platform,HDD,Size GB,Price,Favorite,Status,Wishlist,Notes,Genre,Year,Description,RAWG Rating 10,My Rating 10,Min OS,Min CPU,Min RAM,Min GPU',...games.map(g=>[g.name,g.platform,g.disk,g.size,g.price,g.fav?'yes':'',g.status,g.wish?'yes':'',g.note,g.genre,g.year||'',g.desc,g.rawgRating10??'',g.personalRating??'',...['os','cpu','ram','gpu'].map(k=>((g.req||{}).min||{})[k])].map(q).join(','))].join('\n');
 download(new Blob(['\ufeff'+csv],{type:'text/csv'}),'zinomi-games-'+stamp()+'.csv');notify('CSV exported');
};
$('restoreBtn').onclick=()=>{playSfx('click');$('importFile').click()};
$('importFile').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 try{
  const data=JSON.parse(await file.text());if(!Array.isArray(data.games))throw 0;
  if(!confirm('Restore '+data.games.length+' games? Matching IDs will be replaced; other games are kept.'))return;
  for(const g of data.games){
   let image=g.image;
   if(typeof image==='string'&&image.startsWith('data:')){const b=await(await fetch(image)).blob();image=new File([b],'cover',{type:b.type||'image/jpeg'})}
   await saveRecord({...g,image:image||null});
  }
  if(data.caps){caps={...caps,...data.caps};LSset('zh_caps',caps)}
  if(data.shop&&typeof data.shop==='object'){shop={name:String(data.shop.name||'').trim(),wa:String(data.shop.wa||'').replace(/\D/g,'')};LSset('zh_shop',shop);applyClient()}
 if(data.cur){cur=String(data.cur);LSset('zh_cur',cur)}
 if(Array.isArray(data.sales)){try{const old=JSON.parse(localStorage.getItem('zh_sales')||'[]'),ids=new Set(old.map(x=>x.id));localStorage.setItem('zh_sales',JSON.stringify([...old,...data.sales.filter(x=>x&&x.id&&!ids.has(x.id))]))}catch{}}
 if(data.extraHdds>extraHdds){extraHdds=data.extraHdds;LSset('zh_hdds',extraHdds)}
  await render();notify('Backup restored');
 }catch(err){console.error(err);alert('Could not restore this backup file.')}
 finally{e.target.value=''}
};

/* ANIMATED COUNTERS + THEME */
function countTo(id,v,f){const e=$(id),from=+e.dataset.v||0;e.dataset.v=v;
 if(from===v||matchMedia('(prefers-reduced-motion:reduce)').matches){e.textContent=f(v);return}
 const t0=performance.now();(function s(t){const p=Math.min(1,(t-t0)/800),k=1-Math.pow(1-p,3);e.textContent=f(from+(v-from)*k);if(p<1)requestAnimationFrame(s)})(t0)}
document.documentElement.classList.toggle('light',LS('zh_light',true));
$('themeBtn').onclick=()=>{playSfx('click');const l=document.documentElement.classList.toggle('light');LSset('zh_light',l)};

/* LOGIN / BOOT / AUTO-LOCK */
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
let lock=LS('zh_lock',null),lastAct=Date.now();
async function hash(p,salt){
 if(crypto.subtle){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+p));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
 let h=5381;for(const c of salt+p)h=(h*33^c.charCodeAt(0))>>>0;return'x'+h;
}
const newSalt=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
function gateInit(){
 const setup=!lock;$('pw2').hidden=!setup;$('forgot').hidden=setup||clientMode;
 $('gSub').textContent=setup?'INITIALIZE ACCESS KEY':'ENTER ACCESS KEY';
 $('gBtn').textContent=setup?'SET KEY & BOOT':'BREACH VAULT';
 $('pw').value=$('pw2').value='';$('gErr').textContent='';$('gbox').hidden=false;$('boot').hidden=true;
 $('gate').classList.remove('out');document.body.classList.add('locked');setTimeout(()=>$('pw').focus(),60);
}
function gErr(m){playSfx('err');$('gErr').textContent='⚠ '+m;const b=$('gbox');b.classList.remove('shake');void b.offsetWidth;b.classList.add('shake')}
async function submitGate(){
 const p=$('pw').value;
 if(!lock){
  if(p.length<4)return gErr('Use at least 4 characters');
  if(p!==$('pw2').value)return gErr('Keys do not match');
  const salt=newSalt();lock={salt,hash:await hash(p,salt)};LSset('zh_lock',lock);
 }else if(await hash(p,lock.salt)!==lock.hash)return gErr('ACCESS DENIED');
 playSfx('unlock');
 boot();
}
async function boot(){
 $('gbox').hidden=true;$('boot').hidden=false;
 const steps=['KEY VERIFIED…','MOUNTING INDEXEDDB…','DECRYPTING GAME VAULT…','SCANNING HDD SLOTS…','SYSTEM ONLINE'];
 for(let i=0;i<steps.length;i++){
  $('bootMsg').textContent=steps[i];$('bootBar').style.width=(i+1)/steps.length*100+'%';
  if(i===1&&!db){try{db=await openDB()}catch(err){console.error(err);alert('Could not open the game database. Use Chrome, Edge or Opera.');return}}
  if(i===2)await render();
  await sleep(reduced?0:360);
 }
 $('gate').classList.add('out');document.body.classList.remove('locked');lastAct=Date.now();
 applyClient();switchTab('library');
}
$('gBtn').onclick=submitGate;
['pw','pw2'].forEach(i=>$(i).onkeydown=e=>{if(e.key==='Enter')submitGate()});
$('showPw').onclick=()=>{const t=$('pw').type==='password'?'text':'password';$('pw').type=$('pw2').type=t;$('showPw').textContent=t==='text'?'🙈 Hide':'Show'};
$('forgot').onclick=()=>{
 if(clientMode)return;
 if(prompt('This resets ONLY the password (your games are kept).\nType RESET to continue:')==='RESET'){localStorage.removeItem('zh_lock');lock=null;gateInit()}
};
$('lockBtn').style.display='none';
$('pwBtn').style.display='none';
$('pwBtn').onclick=async()=>{
 const o=prompt('Current access key:');if(o===null)return;
 if(await hash(o,lock.salt)!==lock.hash)return notify('Wrong key');
 const n=prompt('New access key (min 4 characters):');if(!n||n.length<4)return notify('Key unchanged');
 const salt=newSalt();lock={salt,hash:await hash(n,salt)};LSset('zh_lock',lock);notify('Access key updated');
};
['mousemove','keydown','click','touchstart'].forEach(e=>addEventListener(e,()=>lastAct=Date.now(),{passive:true}));


/* CONFETTI */
function confetti(){
 return;
 playSfx('unlock');
 const c=$('fx'),x=c.getContext('2d'),cols=['#00f5ff','#ff2a85','#9d4edd','#00f59b','#ffb703'];c.width=innerWidth;c.height=innerHeight;
 const P=Array.from({length:140},()=>({x:innerWidth/2,y:innerHeight*.65,vx:(Math.random()-.5)*18,vy:-Math.random()*17-4,s:5+Math.random()*6,c:cols[Math.random()*5|0],r:Math.random()*6,vr:(Math.random()-.5)*.4,l:1}));
 (function f(){x.clearRect(0,0,c.width,c.height);let n=0;
  for(const p of P){p.vy+=.4;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;p.l-=.008;
   if(p.l>0&&p.y<c.height){n++;x.save();x.globalAlpha=p.l;x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6);x.restore()}}
  n?requestAnimationFrame(f):x.clearRect(0,0,c.width,c.height)})();
}

/* DIALOG ACCESSIBILITY */
['detailModal','cartDrawer','rouletteModal'].forEach(id=>{const e=$(id);e.setAttribute('role','dialog');e.setAttribute('aria-modal','true')});
addEventListener('keydown',e=>{
 if(e.key!=='Tab')return;
 const m=[...document.querySelectorAll('#detailModal.open .dm-box,#cartDrawer.open,#rouletteModal.open .rm-box')].pop();if(!m)return;
 const f=[...m.querySelectorAll('button,input,textarea,select,a[href],[tabindex="0"]')].filter(x=>!x.disabled&&!x.hidden&&x.getClientRects().length);
 if(!f.length)return;const a=f[0],z=f[f.length-1];
 if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}
});

/* CATALOG EXPORT, FULLSCREEN, CART EXTRAS */
{const f=document.createElement('input'),w=el('div','hint warn');f.id='cFree';f.type='number';f.min=0;f.placeholder='Your free disk space in GB (optional)';w.id='cWarn';$('cName').before(f,w);f.oninput=()=>updFree(cartTotals())}
$('fsBtn').onclick=()=>{playSfx('click');const de=document.documentElement;document.fullscreenElement?document.exitFullscreen():de.requestFullscreen?de.requestFullscreen():notify('Fullscreen is not supported here')};
$('genreFilter').onchange=()=>render(true);$('minRatingFilter').onchange=()=>render(true);
$('maxPrice').oninput=$('maxSize').oninput=()=>{clearTimeout(searchT);searchT=setTimeout(()=>render(true),200)};
$('catBtn').onclick=async()=>{
 playSfx('click');
 const rd=f=>new Promise(r=>{const x=new FileReader();x.onload=()=>r(x.result);x.onerror=()=>r(null);x.readAsDataURL(f)});
 const items=[];for(const g of own())items.push({n:g.name,p:g.platform||'PC',s:+g.size||0,c:effP(g),g:g.genre||'',r:g.rawgRating10??null,i:g.imageUrl||(g.image?(typeof g.image==='string'?g.image:await rd(g.image)):null)});
 if(!items.length)return notify('Add some owned games first');
 const data=JSON.stringify({shop:shop.name||'Zinomi Game Hub',wa:shop.wa||'',cur,items}).replace(/</g,'\\u003c');
 const html=`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Catalog</title><style>
*{box-sizing:border-box}
:root{--bg:#f5f6f9;--card:#fff;--line:#e1e5ee;--text:#171b24;--muted:#677085;--accent:#2f6df6;--accent2:#2559d4;--ok:#12915f}
@media(prefers-color-scheme:dark){:root{--bg:#0e1116;--card:#161a22;--line:#262c38;--text:#e8ebf1;--muted:#8b93a5;--accent:#4c8dff;--accent2:#3a74e0;--ok:#34c38f}}
body{margin:0;background:var(--bg);color:var(--text);font:400 14px/1.5 Inter,system-ui,-apple-system,Segoe UI,sans-serif;-webkit-font-smoothing:antialiased}
.in{max-width:1280px;margin:0 auto;display:flex;gap:10px;align-items:center}
header{position:sticky;top:0;z-index:5;background:var(--card);border-bottom:1px solid var(--line);padding:14px 24px}
h1{margin:0 12px 0 0;font-size:19px;font-weight:650;letter-spacing:-.02em;flex:none}
input,select{background:var(--bg);border:1px solid var(--line);border-radius:8px;color:inherit;padding:9px 12px;font:inherit;outline:0}
input{flex:1;min-width:0}input:focus,select:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(47,109,246,.18)}
#ct{max-width:1280px;margin:20px auto 12px;padding:0 24px;color:var(--muted);font-size:13px}
main{max-width:1280px;margin:0 auto;padding:0 24px 120px;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px}
.c{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;transition:border-color .15s}
.c:hover{border-color:#b9c3d9}.c.in{border-color:var(--ok)}
.i{height:210px;background:var(--line) center/cover;display:grid;place-items:center;font-size:44px;font-weight:600;color:var(--muted)}
.b{padding:12px 14px 14px;display:flex;flex-direction:column;flex:1}
.n{font-weight:600;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.m{color:var(--muted);font-size:13px;margin:3px 0 12px;display:flex;justify-content:space-between;gap:8px;align-items:baseline}.m b{color:var(--text);font-weight:650;font-size:14px;white-space:nowrap}
button{border:1px solid var(--accent);border-radius:8px;background:var(--accent);color:#fff;font:inherit;font-weight:550;padding:8px 14px;cursor:pointer;width:100%;margin-top:auto;transition:background .15s}
button:hover{background:var(--accent2)}
.in button{background:transparent;color:var(--ok);border-color:var(--ok)}
.i{position:relative}.rr{position:absolute;top:8px;left:8px;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:rgba(10,12,18,.92);box-shadow:0 4px 12px rgba(0,0,0,.45);color:#fff;font-weight:800;font-size:14px;line-height:1}
.rr svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}.rr .t{fill:none;stroke:rgba(255,255,255,.15);stroke-width:4}
.rr .p{fill:none;stroke-width:4;stroke-linecap:round;stroke-dasharray:125.66;stroke-dashoffset:125.66;animation:rf 1.4s cubic-bezier(.22,1,.36,1) .2s forwards}
.rr div{position:relative;text-align:center}.rr small{display:block;font-size:6px;font-weight:700;letter-spacing:.08em;margin-top:2px}
@keyframes rf{to{stroke-dashoffset:var(--o)}}@media(prefers-reduced-motion:reduce){.rr .p{animation:none;stroke-dashoffset:var(--o)}}
footer{position:fixed;left:0;right:0;bottom:0;background:var(--card);border-top:1px solid var(--line);padding:12px 24px}
footer .in{justify-content:space-between}footer span{font-weight:550}
footer button{width:auto;margin:0;background:#1fa855;border-color:#1fa855;padding:10px 20px}footer button:hover{background:#188a45}
@media(max-width:700px){header{padding:12px 14px}header .in{flex-wrap:wrap}h1{width:100%;margin:0}select{flex:1}main,#ct{padding-left:14px;padding-right:14px}main{grid-template-columns:repeat(2,1fr);gap:12px}.i{height:160px}footer{padding:10px 14px}}
</style></head><body><header><div class="in"><h1 id="t"></h1><input id="q" placeholder="Search by title, genre or platform"><select id="gf"><option value="">All genres</option></select><select id="so"><option value="0">Featured</option><option value="1">Name A–Z</option><option value="2">Price: low to high</option><option value="3">Price: high to low</option><option value="4">Top rated</option></select></div></header><div id="ct"></div><main id="g"></main><footer><div class="in"><span id="s"></span><button id="w">Send order on WhatsApp</button></div></footer>
<script type="application/json" id="d">${data}<\/script><script>
const D=JSON.parse(document.getElementById("d").textContent),cart=new Set(),$=i=>document.getElementById(i);
const m=v=>D.cur+" "+Number(v).toLocaleString();function ring(v){const k=v>=8?"#3ddc84":v>=6?"#f5c518":v>=4?"#fb923c":"#ef4444",d=document.createElement("div");d.className="rr";d.style.setProperty("--o",(125.66*(1-v/10)).toFixed(2));d.innerHTML='<svg viewBox="0 0 52 52"><circle class="t" cx="26" cy="26" r="20"/><circle class="p" cx="26" cy="26" r="20" stroke="'+k+'"/></svg><div>'+v.toFixed(1)+'<small style="color:'+k+'">RAWG</small></div>';return d}$("t").textContent=D.shop;document.title=D.shop;
function draw(){const q=$("q").value.toLowerCase(),g=$("g");g.replaceChildren();
const gf=$("gf").value,so=$("so").value;const ix=D.items.map((x,k)=>k).filter(k=>{const x=D.items[k];return (x.n+" "+x.p+" "+x.g).toLowerCase().includes(q)&&(!gf||x.g===gf)});if(so==="1")ix.sort((a,b)=>D.items[a].n.localeCompare(D.items[b].n));if(so==="2")ix.sort((a,b)=>D.items[a].c-D.items[b].c);if(so==="3")ix.sort((a,b)=>D.items[b].c-D.items[a].c);if(so==="4")ix.sort((a,b)=>(D.items[b].r||-1)-(D.items[a].r||-1));$("ct").textContent=ix.length+(ix.length===1?" game":" games");ix.forEach(k=>{const x=D.items[k];
const c=document.createElement("div");c.className="c"+(cart.has(k)?" in":"");
c.innerHTML='<div class="i"></div><div class="b"><div class="n"></div><div class="m"><span></span><b></b></div><button></button></div>';
const i=c.firstChild;if(x.i)i.style.backgroundImage="url("+x.i+")";else i.textContent=x.n.charAt(0).toUpperCase();
c.querySelector(".n").textContent=x.n;if(x.r!=null)i.append(ring(Number(x.r)));c.querySelector(".m span").textContent=x.p+" · "+x.s+" GB";c.querySelector("b").textContent=m(x.c);
const b=c.querySelector("button");b.textContent=cart.has(k)?"Remove from cart":"Add to cart";b.onclick=()=>{cart.has(k)?cart.delete(k):cart.add(k);draw()};g.append(c)});
let n=0,t=0,z=0;cart.forEach(k=>{n++;t+=D.items[k].c;z+=D.items[k].s});$("s").textContent=n?n+" games · "+z+" GB · "+m(t):"Cart is empty"}
[...new Set(D.items.map(x=>x.g).filter(Boolean))].sort().forEach(v=>{const o=document.createElement("option");o.value=o.textContent=v;$("gf").append(o)});$("q").oninput=$("gf").onchange=$("so").onchange=draw;
$("w").onclick=()=>{if(!cart.size)return alert("Your cart is empty");const r="ZH-"+Date.now().toString(36).toUpperCase();let t=0,l=["Hi "+D.shop+"! I would like to order:",""];[...cart].forEach((k,i)=>{const x=D.items[k];t+=x.c;l.push((i+1)+". "+x.n+" - "+m(x.c))});l.push("","Total: "+m(t),"Order ref: "+r);window.open("https://wa.me/"+D.wa+"?text="+encodeURIComponent(l.join("\\n")),"_blank")};
draw();
<\/script></body></html>`;
 download(new Blob([html],{type:'text/html'}),'zinomi-catalog-'+stamp()+'.html');notify('Catalog exported');
};


/* PDF CATALOG */
$('pdfBtn').onclick=async()=>{
 playSfx('click');
 const rd=f=>new Promise(r=>{const x=new FileReader();x.onload=()=>r(x.result);x.onerror=()=>r(null);x.readAsDataURL(f)});
 const items=[];for(const g of own())items.push({n:g.name,p:g.platform||'PC',s:+g.size||0,c:effP(g),o:+g.price||0,g:g.genre||'',r:g.rawgRating10??null,i:g.imageUrl||(g.image?(typeof g.image==='string'?g.image:await rd(g.image)):null)});
 if(!items.length)return notify('Add some owned games first');
 items.sort((a,b)=>a.n.localeCompare(b.n));
 const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const logo=(document.querySelector('.zlogo')||{}).src||'';
 const shopName=shop.name||'Zinomi Game Hub';
 const total=items.reduce((a,x)=>a+x.s,0);
 const rc=v=>v>=8?'#16a34a':v>=6?'#ca8a04':v>=4?'#ea580c':'#dc2626';
 const cards=items.map(x=>`<div class="c"><div class="i">${x.i?`<img src="${esc(x.i)}" alt="">`:`<span>${esc(x.n.charAt(0).toUpperCase())}</span>`}${x.r!=null?`<b class="r" style="background:${rc(+x.r)}">&#9733; ${(+x.r).toFixed(1)}</b>`:''}</div><div class="b"><div class="n">${esc(x.n)}</div><div class="m">${esc(x.p)}${x.g?' &middot; '+esc(x.g):''}${x.s?' &middot; '+fmt(x.s)+' GB':''}</div><div class="p">${x.c<x.o?`<s>${esc(cur)} ${fmt(x.o)}</s> `:''}${esc(cur)} ${fmt(x.c)}</div></div></div>`).join('');
 const date=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
 const html=`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${esc(shopName)} - Catalog ${stamp()}</title><style>
@page{size:A4;margin:12mm}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font:400 11px/1.4 Inter,Arial,Helvetica,sans-serif;color:#171b24}
.h{display:flex;align-items:center;gap:14px;padding-bottom:12px;margin-bottom:14px;border-bottom:3px solid #2f6df6}
.h img{width:52px;height:52px;object-fit:contain;border-radius:10px}
.h h1{margin:0;font-size:24px;letter-spacing:-.02em;line-height:1.1}
.h p{margin:3px 0 0;color:#677085;font-size:11px}
.h .d{margin-left:auto;text-align:right;color:#677085;font-size:11px}.h .d b{display:block;color:#171b24;font-size:13px}
.g{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.c{border:1px solid #dfe3ec;border-radius:8px;overflow:hidden;break-inside:avoid;page-break-inside:avoid;background:#fff}
.i{position:relative;height:150px;background:#eaedf4;display:grid;place-items:center;font-size:40px;font-weight:700;color:#8b93a5;overflow:hidden}
.i img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.r{position:absolute;top:6px;left:6px;color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px}
.b{padding:8px 10px 10px}
.n{font-weight:700;font-size:12px;line-height:1.25;height:30px;overflow:hidden}
.m{color:#677085;font-size:10px;margin:3px 0 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.p{font-weight:800;font-size:13px;color:#2f6df6}.p s{color:#9aa3b5;font-weight:500;font-size:10px}
.f{margin-top:14px;padding-top:8px;border-top:1px solid #dfe3ec;color:#677085;font-size:10px;text-align:center}
</style></head><body>
<div class="h">${logo?`<img src="${esc(logo)}" alt="">`:''}<div><h1>${esc(shopName)}</h1><p>Game Catalog${shop.wa?' &middot; WhatsApp +'+esc(shop.wa):''}</p></div><div class="d"><b>${items.length} games</b>${fmt(total)} GB total<br>${esc(date)}</div></div>
<div class="g">${cards}</div>
<div class="f">Prices in ${esc(cur)} &middot; ${esc(shopName)} &middot; ${esc(date)}</div>
</body></html>`;
 const fr=document.createElement('iframe');
 fr.style.cssText='position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
 fr.onload=async()=>{
  const w=fr.contentWindow,imgs=[...w.document.images];
  await Promise.race([Promise.all(imgs.map(im=>im.complete?1:new Promise(r=>{im.onload=im.onerror=r}))),new Promise(r=>setTimeout(r,8000))]);
  try{w.focus();w.print()}catch{notify('Could not open the print dialog')}
  setTimeout(()=>fr.remove(),120000);
 };
 fr.srcdoc=html;document.body.append(fr);
 notify('Preparing PDF… choose "Save as PDF" in the print window');
};

/* THEMES */
$('shrinkBtn').onclick=async()=>{
 if(!confirm('Shrink all saved cover images to free browser storage? Covers stay (just slightly smaller). Export a backup first if unsure.'))return;
 if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});
 notify('Shrinking covers…');let saved=0,n=0;
 for(const g of await allGames()){
  if(!g.image||typeof g.image==='string'||g.image.size<60*1024)continue;const before=g.image.size;
  const b=await compress(g.image,480,.72);
  if(b.size<before){try{await saveRecord({...g,image:b});saved+=before-b.size;n++}catch{}}
 }
 await render();updStorage();notify('Freed '+(saved/1048576).toFixed(1)+' MB from '+n+' covers');
};
/* IMPORT DETAILS FROM CSV */
function parseCSV(t){t=t.replace(/^\ufeff/,'');const R=[];let r=[],c='',q=false;
 for(let i=0;i<t.length;i++){const ch=t[i];
  if(q){if(ch=='"'){if(t[i+1]=='"'){c+='"';i++}else q=false}else c+=ch}
  else if(ch=='"')q=true;else if(ch==','){r.push(c);c=''}
  else if(ch=='\n'){r.push(c);R.push(r);r=[];c=''}else if(ch!='\r')c+=ch}
 if(c||r.length){r.push(c);R.push(r)}return R}
$('impBtn').onclick=()=>{playSfx('click');$('impFile').click()};
$('impFile').onchange=async e=>{
 const f=e.target.files[0];e.target.value='';if(!f)return;
 try{
  const R=parseCSV(await f.text()),H=R[0].map(x=>x.trim().toLowerCase()),ix=k=>H.indexOf(k);
  if(ix('name')<0)return notify('This CSV has no Name column');
  const nk=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,''),all=await allGames(),by=new Map(all.map(g=>[nk(g.name),g]));
  const rows=R.slice(1).filter(r=>by.has(nk(r[ix('name')])));
  if(!rows.length)return notify('No matching game names found');
  if(!confirm('Update details for '+rows.length+' games (genre, year, description, note, requirements)? Existing values are replaced only where the CSV has a value. Back up first if unsure.'))return;
  const v=(r,k)=>ix(k)<0?'':String(r[ix(k)]||'').trim();let n=0;
  for(const r of rows){const g=by.get(nk(r[ix('name')])),u={...g},min={...((g.req&&g.req.min)||{})};
   if(v(r,'genre'))u.genre=v(r,'genre');if(+v(r,'year'))u.year=+v(r,'year');
   if(v(r,'description'))u.desc=v(r,'description');if(v(r,'notes'))u.note=v(r,'notes');
   [['os','min os'],['cpu','min cpu'],['ram','min ram'],['gpu','min gpu']].forEach(([a,b])=>{if(v(r,b))min[a]=v(r,b)});
   u.req={...(g.req||{}),min};u.updated=Date.now();await saveRecord(u);n++}
  await render();updStorage();notify('Updated '+n+' games')
 }catch(err){console.error(err);notify('Import failed. Check the CSV file')}
};
/* START */
updStorage();
if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(()=>{});
boot();

;/* CINEMATIC HEADER SEARCH: keep the original search input and all existing filters functional. */
(()=>{
 const search=document.getElementById('search');
 const actions=document.querySelector('.topbar .actions');
 if(search&&actions){search.classList.add('top-search');search.placeholder='Search games…';actions.insertBefore(search,actions.firstChild)}
 
})();

;(()=>{
const $=id=>document.getElementById(id),clk=s=>{const e=typeof s==='string'?document.querySelector(s):s;if(e)e.click()};
const isCl=()=>typeof clientMode!=='undefined'&&clientMode;
/* ACCENT PICKER */
const ACC=[['Green',null,null],['Blue','#4c8dff','#3a74e0'],['Purple','#9b7bff','#8261ee'],['Amber','#f1b44c','#d99a2e'],['Rose','#f2668b','#dc4f75']];
let ai=0;try{ai=(+localStorage.getItem('zh_accent')||0)%ACC.length}catch{}
const ab=document.createElement('button');ab.className='nav-btn';ab.id='accBtn';
function applyAcc(){const a=ACC[ai],r=document.documentElement.style;
 if(a[1]){r.setProperty('--accent',a[1]);r.setProperty('--accent-2',a[2])}else{r.removeProperty('--accent');r.removeProperty('--accent-2')}
 ab.innerHTML='<span><i class="zx-sw"></i></span> Accent: '+a[0]}
ab.onclick=()=>{ai=(ai+1)%ACC.length;try{localStorage.setItem('zh_accent',ai)}catch{}applyAcc()};
$('themeBtn').before(ab);applyAcc();
/* COMMAND PALETTE */
const pal=document.createElement('div');pal.id='zxPal';pal.innerHTML='<div class="bx"><input id="zxQ" placeholder="Search games or type a command…" autocomplete="off"><ul id="zxL"></ul><div class="ft">↑↓ navigate · Enter select · Esc close · Ctrl+K</div></div>';document.body.append(pal);
const Q=$('zxQ'),L=$('zxL');let items=[],sel=0;
const fz=(q,t)=>{q=q.toLowerCase();t=t.toLowerCase();if(!q)return 1;const i=t.indexOf(q);if(i>=0)return 100-i;let p=0,s=0;for(const c of q){const j=t.indexOf(c,p);if(j<0)return 0;s+=j===p?3:1;p=j+1}return s/(t.length||1)+.1};
const cmds=()=>{const c=[['Go to Library',()=>switchTab('library')],['Open cart',()=>clk('.cart-open')],['Surprise me',()=>clk('#randomBtn')],['Toggle theme',()=>clk('#themeBtn')],['Toggle grid / list',()=>clk('#viewBtn')],['Change accent colour',()=>ab.click()]];
 if(!isCl())c.push(['Add game',()=>clk('#addBtn')],['Go to Drives',()=>switchTab('drives')],['Go to Insights',()=>switchTab('stats')],['Back up data',()=>clk('#backupBtn')],['Export CSV',()=>clk('#csvBtn')]);return c};
function build(){const q=Q.value.trim();items=[];
 for(const [n,f] of cmds()){const s=fz(q,n);if(s)items.push({s:s+(q?0:50),t:n,h:'command',f})}
 if(q)for(const g of (typeof games!=='undefined'?games:[])){if(isCl()&&g.wish)continue;const s=Math.max(fz(q,g.name||''),fz(q,(g.platform||'')+' '+(g.genre||''))*.6);if(s)items.push({s,t:g.name||'Untitled',h:(g.disk||'')+(g.platform?' · '+g.platform:''),f:()=>openDetails(g.id)})}
 items.sort((a,b)=>b.s-a.s);items=items.slice(0,10);sel=0;paint()}
function paint(){L.replaceChildren(...items.map((it,i)=>{const li=document.createElement('li');if(i===sel)li.className='on';const a=document.createElement('span'),b=document.createElement('small');a.textContent=it.t;b.textContent=it.h;li.append(a,b);li.onclick=()=>run(i);return li}));if(!items.length){const li=document.createElement('li');li.textContent='No matches';L.append(li)}}
function run(i){const it=items[i];if(!it)return;closePal();it.f()}
function openPal(){pal.classList.add('open');Q.value='';build();setTimeout(()=>Q.focus(),10)}
function closePal(){pal.classList.remove('open')}
Q.oninput=build;pal.onclick=e=>{if(e.target===pal)closePal()};
Q.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();sel=Math.min(items.length-1,sel+1);paint()}else if(e.key==='ArrowUp'){e.preventDefault();sel=Math.max(0,sel-1);paint()}else if(e.key==='Enter'){e.preventDefault();run(sel)}else if(e.key==='Escape')closePal()};
addEventListener('keydown',e=>{
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();pal.classList.contains('open')?closePal():openPal();return}
 if(e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)||pal.classList.contains('open'))return;
 if(document.querySelector('#detailModal.open,#cartDrawer.open,#rouletteModal.open'))return;
 const k=e.key.toLowerCase();
 if(k==='n'&&!isCl()){e.preventDefault();clk('#addBtn')}
 else if(k==='1')switchTab('library');
 else if(!isCl()&&k==='2')switchTab('drives');
 else if(!isCl()&&k==='3')switchTab('stats');
});
/* MOBILE BOTTOM NAV */
const nv=document.createElement('nav');nv.id='zxNav';
[['library','🎮','Library',()=>switchTab('library'),''],['cart','🛒','Cart',()=>clk('.cart-open'),''],['find','🔍','Find',openPal,''],['ratings','⭐','Ratings',()=>switchTab('ratings'),'admin'],['drives','💾','Drives',()=>switchTab('drives'),'admin'],['stats','📊','Insights',()=>switchTab('stats'),'admin'],['adding','➕','Add',()=>clk('#addBtn'),'admin']].forEach(([id,ic,lb,f,c])=>{const b=document.createElement('button');b.dataset.n=id;if(c)b.className=c;b.innerHTML='<i>'+ic+'</i>'+lb;b.onclick=f;nv.append(b)});
document.body.append(nv);
const _sw=switchTab;switchTab=function(t){_sw(t);nv.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.n===t))};
nv.querySelector('[data-n=library]').classList.add('on');
/* DUPLICATE FINDER (Insights) */
const two=document.querySelector('#stats .two');
if(two){const p=document.createElement('div');p.className='panel pad';p.innerHTML='<h2 class="t">Duplicate games</h2><div id="zxDup"></div>';two.append(p)}
function dups(){const box=$('zxDup');if(!box)return;box.replaceChildren();
 const m={};for(const g of games.filter(g=>!g.wish)){const k=(g.name||'').toLowerCase().replace(/\b(repack|deluxe|goty|complete|ultimate|edition|game of the year)\b/g,'').replace(/[^a-z0-9]/g,'');if(k)(m[k]=m[k]||[]).push(g)}
 const gr=Object.values(m).filter(a=>a.length>1);let rec=0;
 if(!gr.length){const d=document.createElement('div');d.className='zx-dup';d.textContent='No duplicates found 👍';box.append(d);return}
 for(const a of gr){const sz=a.map(g=>+g.size||0),r=sz.reduce((x,y)=>x+y,0)-Math.max(...sz);rec+=r;
  const row=document.createElement('div'),l=document.createElement('span'),s=document.createElement('small');row.className='zx-dup';
  l.textContent=a[0].name+' ×'+a.length;s.textContent=a.map(g=>g.disk||'Unassigned').join(', ')+' · save '+r.toFixed(1)+' GB';row.append(l,s);row.onclick=()=>{$('search').value=a[0].name;switchTab('library');render(true)};row.style.cursor='pointer';box.append(row)}
 const t=document.createElement('div');t.className='zx-dup';t.style.fontWeight='600';t.textContent='Reclaimable: '+rec.toFixed(1)+' GB';box.append(t)}
const _rs=renderStats;renderStats=function(){_rs();try{dups()}catch{}};
/* DRAG A GAME ONTO A DRIVE */
const dock=document.createElement('div');dock.id='zxDock';document.body.append(dock);let dragId=null;
const _mc=makeCard;makeCard=function(g,i){const c=_mc(g,i);if(!isCl()&&!g.wish){c.draggable=true;c.ondragstart=e=>{dragId=g.id;e.dataTransfer.setData('text/plain',g.id);e.dataTransfer.effectAllowed='move';buildDock()};c.ondragend=()=>{dock.classList.remove('show')}}return c};
function buildDock(){dock.replaceChildren();const h=document.createElement('b');h.textContent='Drop on a drive to move this game';dock.append(h);
 for(const d of [...hddList(),'Unassigned']){const s=document.createElement('span');s.textContent=(d==='Unassigned'?'⚠ ':'📀 ')+d;
  s.ondragover=e=>{e.preventDefault();s.classList.add('over')};s.ondragleave=()=>s.classList.remove('over');
  s.ondrop=async e=>{e.preventDefault();dock.classList.remove('show');const g=games.find(x=>x.id===dragId);if(!g)return;g.disk=d==='Unassigned'?'':d;await saveRecord(g);await render();notify('Moved '+(g.name||'game')+' to '+d)};dock.append(s)}
 dock.classList.add('show')}
try{if(gamesLoaded)render(true)}catch{}
})();

;(()=>{
const _rh=renderHero;renderHero=function(l,sh){_rh(l,sh);const h=$('hero'),b=[...$('heroRow').children];if(!b.length)return;const i=Math.max(0,b.findIndex(x=>x.classList.contains('on'))),f=x=>(x&&x.style.backgroundImage)||'none';
 h.style.setProperty('--pv',f(b[i-1]||b[b.length-1]));h.style.setProperty('--nx',f(b[i+1]||b[0]))};
const _mc=makeCard;makeCard=function(g,i){const c=_mc(g,i);try{const gb=c.querySelector('.gb'),gm=c.querySelector('.gm'),sb=c.querySelector('.sale-b');
 gb.prepend(el('span','zx-chip',(g.wish?'WISHLIST':(g.platform||'Basic game')).toUpperCase()));
 if(sb&&gm){sb.className='zx-disc';gm.prepend(sb)}}catch{}return c};
const box=document.createElement('div');box.className='zx-fast';document.querySelector('.sidebar nav').after(box);
function fast(){try{const l=own().filter(hasCover),p=l.filter(g=>g.popular),pick=[...p,...l.filter(g=>!g.popular)].slice(0,4);box.replaceChildren();if(!pick.length)return;
 box.append(el('h4','','FAST LAUNCH'));
 for(const g of pick){const r=el('div','zx-fi'),th=el('div','zx-th');if(!mountImg(th,g,'',true))th.textContent='🎮';r.append(th,el('span','',g.name||'Untitled'));r.onclick=()=>openDetails(g.id);box.append(r)}}catch{}}
const _r=render;render=async function(s){await _r(s);fast()};
try{if(gamesLoaded)render(true)}catch{}
})();

;(()=>{
const t=document.querySelector('.sidebar .side-title.admin');if(!t)return;
const w=document.createElement('div');w.id='zxManage';
let n=t.nextElementSibling;while(n&&!n.classList.contains('sys')){const x=n.nextElementSibling;w.append(n);n=x}
t.after(w);t.classList.add('zxt');
let open=false;try{open=localStorage.getItem('zh_manage')==='1'}catch{}
const ap=()=>{w.classList.toggle('open',open);t.textContent='Manage '+(open?'▾':'▸')};
t.onclick=()=>{open=!open;try{localStorage.setItem('zh_manage',open?'1':'0')}catch{}ap()};ap();
})();

;(()=>{
const main=document.querySelector('.main'),hd=document.createElement('header');hd.id='zxHead';
hd.innerHTML='<div class="zx-br"><img class="zlogo sm" src="images/game-hub-logo.png" alt="Zinomi logo"><span><span class="z1">Zinomi</span> <span class="z2">Game Hub</span></span></div><nav class="zx-nav"></nav><div class="zx-act"></div>';
main.prepend(hd);
const nav=hd.querySelector('.zx-nav'),act=hd.querySelector('.zx-act');
[['Library','library',''],['Drives','drives','admin'],['Insights','stats','admin'],['Add Game','adding','admin']].forEach(([lb,t,c])=>{const b=document.createElement('button');b.className='zx-nl '+c;b.dataset.t=t;b.textContent=lb;b.onclick=()=>{const o=document.querySelector('.sidebar .nav-btn[data-tab="'+t+'"]');if(o)o.click()};nav.append(b)});
const mark=t=>nav.querySelectorAll('.zx-nl').forEach(b=>b.classList.toggle('on',b.dataset.t===t));mark('library');
const _sw=switchTab;switchTab=function(t){_sw(t);mark(t)};
const sr=$('search');act.append(sr);sr.placeholder='Search';
[...document.querySelectorAll('.topbar .actions>*')].forEach(e=>act.append(e));
const tb=document.createElement('button');tb.className='btn';tb.textContent='⋯ Tools';
const mn=document.createElement('div');mn.id='zxMenu2';
const mg=$('zxManage');if(mg)[...mg.children].forEach(e=>mn.append(e));
document.querySelectorAll('.sidebar .sys').forEach(e=>mn.append(e));
act.append(tb,mn);
tb.onclick=e=>{e.stopPropagation();mn.classList.toggle('open')};
mn.onclick=e=>{if(e.target.closest('.nav-btn'))mn.classList.remove('open')};
document.addEventListener('click',e=>{if(!act.contains(e.target))mn.classList.remove('open')});
addEventListener('keydown',e=>{if(e.key==='Escape')mn.classList.remove('open')});
const _rh=renderHero;renderHero=function(l,sh){_rh(l,sh);const h=$('hero');if(h.hidden)return;
 const pool=sh?l.filter(hasCover):[],pf=pool.filter(g=>g.popular),c=(pf.length?pf:pool).slice(0,14),g=c[heroIdx];if(!g)return;
 const inn=h.querySelector('.hero-in'),ch=el('div','zx-genres');
 [...String(g.genre||'').split(/[,/|·]+/),g.platform].map(x=>(x||'').trim()).filter(Boolean).slice(0,4).forEach(x=>ch.append(el('span','zx-gc',x)));
 inn.prepend(ch);
 const hb=el('button','btn admin zx-heart'+(g.fav?' on':''),g.fav?'♥':'♡');hb.title='Favorite';hb.onclick=()=>toggleFav(g);h.querySelector('.hero-btns').append(hb)};
try{if(gamesLoaded)render(true)}catch{}
})();

;(()=>{
const LSg=k=>{try{return localStorage.getItem(k)}catch{return null}},LSs=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
const bk=document.createElement('div');bk.className='zx-bk adm admin';bk.hidden=true;
bk.innerHTML='<span id="zxBkT"></span><button class="btn" id="zxBkB">Back up now</button><button class="x" title="Remind me tomorrow">✕</button>';
$('heroTop').after(bk);
$('zxBkB').onclick=()=>$('backupBtn').click();
bk.querySelector('.x').onclick=()=>{LSs('zh_snz',Date.now());bk.hidden=true};
$('backupBtn').addEventListener('click',()=>{LSs('zh_lastbk',Date.now());bk.hidden=true});
function bkCheck(n){const t=+LSg('zh_lastbk')||0,sn=+LSg('zh_snz')||0,d=Math.floor((Date.now()-t)/864e5);
 const show=n>0&&(!t||d>=7)&&Date.now()-sn>864e5;bk.hidden=!show;
 if(show)$('zxBkT').textContent=t?'⚠ Last backup was '+d+' days ago. Your data is saved only in this browser.':'⚠ You have never backed up. Your data is saved only in this browser.'}
const chips=document.createElement('div');chips.className='zx-chips';document.querySelector('#library .toolbar').before(chips);
function chipsUpd(){const gf=$('genreFilter');if(!gf)return;chips.replaceChildren();
 [...gf.options].forEach(o=>{const b=document.createElement('button');b.className='zx-c2'+(gf.value===o.value?' on':'');b.textContent=o.value?o.text:'All';
  b.onclick=()=>{gf.value=o.value;gf.dispatchEvent(new Event('change'))};chips.append(b)});chips.hidden=gf.options.length<3}

const _rr=renderRows;renderRows=function(l,sh){_rr(l,sh);if(!sh)return;const nf=l.filter(g=>g.isNew).slice(0,14);if(!nf.length)return;
 const w=$('moreRows'),t=el('div','row-t','🔥 New Arrivals'),d=el('div','hero-row');nf.forEach(g=>d.append(rowTile(g)));w.prepend(t,d)};
let LA=null;const _rh=renderHero;renderHero=function(l,sh){LA=[l,sh];_rh(l,sh)};

const _r=render;render=async function(s){await _r(s);try{chipsUpd();bkCheck(games.length)}catch{}};
try{if(gamesLoaded)render(true)}catch{}
})();

;(()=>{
const f=document.createElement('input');f.type='file';f.accept='image/*';f.hidden=true;document.body.append(f);
let tgt=null,LA=null,last=Date.now();
const sel=(l,sh)=>{const pool=sh?l.filter(hasCover):[],pf=pool.filter(g=>g.popular);return [...pf,...pool.filter(x=>!x.popular)].slice(0,60)};
f.onchange=async()=>{const file=f.files[0];f.value='';if(!file||!tgt)return;if(!file.type.startsWith('image/'))return notify('Please choose an image file');
 notify('Saving background…');tgt.banner=await compress(file,1920,.82);try{await saveRecord(tgt);notify('Background saved')}catch{tgt.banner=null;return notify('Storage full - could not save background')}render(true)};
const _rh=renderHero;renderHero=function(l,sh){LA=[l,sh];last=Date.now();_rh(l,sh);const h=$('hero');if(h.hidden)return;
 const c=sel(l,sh),g=c[heroIdx];if(!g)return;
 if(g.banner){const u=typeof g.banner==='string'?g.banner:URL.createObjectURL(g.banner);if(typeof g.banner!=='string')heroUrls.push(u);h.querySelector('.hero-bg').style.backgroundImage='url('+JSON.stringify(u)+')'}
 const bt=el('button','btn admin','🖼 '+(g.banner?'Change background':'Set background'));bt.id='zxBgBtn';bt.title='Choose a wide image for this hero background';bt.onclick=()=>{tgt=g;f.click()};
 const bb=h.querySelector('.hero-btns');bb.append(bt);
 if(g.banner){const rm=el('button','btn admin','✕');rm.title='Remove custom background';rm.onclick=async()=>{g.banner=null;await saveRecord(g);render(true)};bb.append(rm)}
 const p=el('div','zx-prog');p.append(document.createElement('i'));h.append(p);
 h.append(el('div','zx-cnt',(heroIdx+1)+' / '+c.length))};
setInterval(()=>{if(!LA)return;const h=$('hero');
 if(!h||h.hidden||document.hidden||h.matches(':hover')||!$('library').classList.contains('active')||document.querySelector('#detailModal.open,#cartDrawer.open,#rouletteModal.open')){last+=250;return}
 if(Date.now()-last>=8000){const n=sel(LA[0],LA[1]).length;if(n<2){last=Date.now();return}heroIdx=(heroIdx+1)%n;renderHero(LA[0],LA[1])}},250);
try{if(gamesLoaded)render(true)}catch{}
})();

;(()=>{
 const KEY='zh_autoretry',WEEK=7*864e5,MAX=10;
 const on=()=>{try{return localStorage.getItem(KEY)!=='0'}catch(e){return true}};
 const chk=document.getElementById('autoRetryChk');
 if(chk){chk.checked=on();chk.onchange=()=>{try{localStorage.setItem(KEY,chk.checked?'1':'0')}catch(e){}}}
 async function run(){
  try{
   if(!on()||clientMode||ratingBusy||!ratingCfg||!ratingCfg.key||!gamesLoaded)return;
   const now=Date.now();
   const todo=games.filter(g=>g.rawgRating10==null&&(!g.rawgFetchedAt||now-g.rawgFetchedAt>WEEK)).slice(0,MAX);
   if(!todo.length)return;
   ratingBusy=true;let found=0;
   for(const g of todo){
    try{const u=await lookupRatingForGame(g);if(u.rawgRating10!=null)found++}catch(e){console.warn('Auto-retry stopped:',e);break}
    await new Promise(r=>setTimeout(r,1500));
   }
   ratingBusy=false;
   if(found){await render(true);notify('Auto-found '+found+' missing rating'+(found>1?'s':''))}
  }catch(e){ratingBusy=false;console.warn(e)}
 }
 setTimeout(run,6000);
})();

;(()=>{
const KEY='zh_sales';
const load=()=>{try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a:[]}catch{return[]}};
const save=a=>{try{localStorage.setItem(KEY,JSON.stringify(a))}catch{}};
const uid=()=>'s_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
/* log every order sent via WhatsApp from this device */
const wa=$('cWa');
if(wa)wa.addEventListener('click',()=>{try{
 if(!cart.length)return;const l=cartGames(),t=cartTotals(),ref=getRef(),a=load();
 if(a.some(x=>x.ref===ref))return;
 a.unshift({id:uid(),ref,t:Date.now(),name:($('cName').value||'').trim(),items:l.map(g=>g.name),count:t.n,size:t.size,total:t.price,done:false});save(a);
}catch(e){console.warn(e)}},true);
const same=(a,b)=>new Date(a).toDateString()===new Date(b).toDateString();
function stat(label,val,sub){const d=el('div','stat'),s=el('span','',label),b=el('b','',val);d.append(s,b);if(sub){const m=el('small','',sub);m.style.color='var(--muted)';d.append(m)}return d}
function renderSales(){
 const a=load(),now=Date.now(),ok=a.filter(x=>x.done);
 const sum=l=>l.reduce((s,x)=>s+(+x.total||0),0);
 const today=ok.filter(x=>same(x.t,now)),mon=ok.filter(x=>{const d=new Date(x.t),n=new Date();return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear()});
 $('salesStats').replaceChildren(stat('Today',money(sum(today)),today.length+' sales'),stat('This month',money(sum(mon)),mon.length+' sales'),stat('All time',money(sum(ok)),ok.length+' sales'),stat('Pending',String(a.length-ok.length),'waiting for payment'));
 const box=$('salesList');box.replaceChildren();
 if(!a.length){box.append(el('div','sub','No sales yet. Orders sent from this device will appear here, or tap “+ Add sale”.'));return}
 a.forEach(x=>{
  const r=el('div','sl-row'),m=el('div','sl-main');
  m.append(el('b','',(x.name||'Client')+' · '+money(x.total)),el('small','',new Date(x.t).toLocaleString()+(x.device?' · '+x.device:'')+' · '+(x.count||0)+' game'+(x.count===1?'':'s')+(x.discount>0?' · discount '+money(x.discount):'')+' · '+(x.items||[]).join(', ')));
  const st=el('span','sl-st'+(x.done?' ok':''),x.done?'PAID':'PENDING');
  const ck=el('button','',x.done?'↩':'✓');ck.title=x.done?'Mark pending':'Mark paid';ck.onclick=()=>{x.done=!x.done;save(a);renderSales()};
  const dl=el('button','','🗑');dl.title='Delete';dl.onclick=()=>{if(confirm('Delete this sale?')){save(a.filter(y=>y.id!==x.id));renderSales()}};
  r.append(m,st,ck,dl);box.append(r)});
}
const DEVICES=['HDD','SSD','Pen Drive'];
function openSale(){
 const pool=(typeof own==='function'?own():games.filter(g=>!g.wish)).slice().sort((a,b)=>(a.name||'').localeCompare(b.name||''));
 let lines=[];
 const ov=el('div','zs-ov'),box=el('div','zs-box');ov.append(box);
 box.append(el('h3','','+ Add sale'));
 const mkSel=(opts)=>{const s=document.createElement('select');opts.forEach(o=>s.append(new Option(o[0],o[1])));return s};
 const f=(lab,node)=>{const d=document.createElement('div');d.append(el('label','',lab),node);return d};
 const name=document.createElement('input');name.placeholder='Client name (optional)';name.maxLength=60;
 const dev=mkSel(DEVICES.map(d=>[d,d]));
 const g1=el('div','zs-g2');g1.append(f('Client',name),f('Device',dev));
 const g2=el('div','zs-g2');g2.style.gridTemplateColumns='1fr';g2.append(f('Payment',mkSel([['Paid','1'],['Pending','0']])));
 const pay=g2.querySelectorAll('select')[0];
 box.append(g1,g2);
 const q=document.createElement('input');q.placeholder='Type game name…';q.autocomplete='off';q.maxLength=80;
 const sug=el('div','zs-sug');sug.hidden=true;
 const wrap=el('div','zs-wrap');wrap.append(q,sug);
 box.append(el('label','','Games'),wrap);
 let hi=-1,cur_=[];
 const addGame=g=>{if(lines.some(l=>String(l.id)===String(g.id)))return notify('Already added');
  lines.push({id:g.id,name:g.name||'Untitled',price:effP(g),size:+g.size||0});q.value='';showSug();draw();q.focus()};
 const showSug=()=>{const t=q.value.trim().toLowerCase();sug.replaceChildren();hi=-1;
  if(!t){sug.hidden=true;cur_=[];return}
  cur_=pool.filter(g=>!lines.some(l=>String(l.id)===String(g.id))&&(g.name||'').toLowerCase().includes(t))
   .sort((x,y)=>((x.name||'').toLowerCase().startsWith(t)?0:1)-((y.name||'').toLowerCase().startsWith(t)?0:1)).slice(0,8);
  if(!cur_.length){sug.append(el('div','zs-none','No game found'));sug.hidden=false;return}
  cur_.forEach(g=>{const r=el('div','zs-opt'),n=el('span','',g.name||'Untitled'),pr=el('small','',money(effP(g))+(onSale(g)?' (sale)':''));
   r.append(n,pr);r.onmousedown=e=>{e.preventDefault();addGame(g)};sug.append(r)});
  sug.hidden=false};
 const mark=()=>[...sug.children].forEach((c,i)=>c.classList.toggle('on',i===hi));
 q.oninput=showSug;q.onfocus=showSug;q.onblur=()=>{sug.hidden=true};
 q.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();if(cur_.length){hi=(hi+1)%cur_.length;mark()}}
  else if(e.key==='ArrowUp'){e.preventDefault();if(cur_.length){hi=(hi-1+cur_.length)%cur_.length;mark()}}
  else if(e.key==='Enter'){e.preventDefault();const g=cur_[hi<0?0:hi];if(g)addGame(g)}
  else if(e.key==='Escape'&&!sug.hidden){e.stopPropagation();sug.hidden=true}};
 const box2=el('div','zs-lines');box.append(box2);
 const dt=mkSel([['Discount (Rs.)','rs'],['Discount (%)','pct']]);
 const dv=document.createElement('input');dv.type='number';dv.min='0';dv.step='0.01';dv.placeholder='0';
 const g3=el('div','zs-g2');g3.append(f('Discount type',dt),f('Discount value',dv));box.append(g3);
 const sum=el('div','zs-sum');box.append(sum);
 const calc=()=>{const gt=lines.reduce((a,l)=>a+(+l.price||0),0),sub=gt;
  let d=(+dv.value||0);d=dt.value==='pct'?sub*Math.min(d,100)/100:d;d=Math.max(0,Math.min(d,sub));
  return{gt,sub,d,total:sub-d}};
 const draw=()=>{
  box2.replaceChildren();
  if(!lines.length)box2.append(el('div','zs-empty','No games added yet. Type a game name above and pick it from the list.'));
  lines.forEach((l,i)=>{const r=el('div','zs-line'),n=el('span','',l.name);n.title=l.name;
   const pi=document.createElement('input');pi.type='number';pi.min='0';pi.step='0.01';pi.value=l.price;pi.oninput=()=>{l.price=+pi.value||0;drawSum()};
   const x=el('button','','✕');x.type='button';x.onclick=()=>{lines.splice(i,1);draw()};
   r.append(n,pi,x);box2.append(r)});
  drawSum()};
 const drawSum=()=>{const c=calc();sum.replaceChildren();
  const row=(a,b,cl)=>{const d=el('div',cl||'');d.append(el('span','',a),el('span','',b));sum.append(d)};
  row('Games ('+lines.length+')',money(c.gt));
  row('Discount','− '+money(c.d));
  row('Total',money(c.total),'tot')};
 dv.oninput=drawSum;dt.onchange=dev.onchange=drawSum;
 const cancel=el('button','btn','Cancel'),ok=el('button','btn primary','Confirm sale');cancel.type=ok.type='button';
 const act=el('div','zs-act');act.append(cancel,ok);box.append(act);
 const close=()=>{ov.remove();document.removeEventListener('keydown',esc)};
 const esc=e=>{if(e.key==='Escape')close()};document.addEventListener('keydown',esc);
 cancel.onclick=close;ov.onclick=e=>{if(e.target===ov)close()};
 ok.onclick=()=>{const c=calc();if(!lines.length)return alert('Add at least one game.');
  const a=load();
  a.unshift({id:uid(),ref:'MAN',t:Date.now(),name:name.value.trim(),device:dev.value,items:lines.map(l=>l.name),count:lines.length,size:lines.reduce((s,l)=>s+l.size,0),subtotal:c.sub,discount:c.d,total:c.total,done:pay.value==='1'});
  save(a);renderSales();close();notify('Sale added')};
 document.body.append(ov);draw();
}
$('saleAdd').onclick=openSale;
$('saleClear').onclick=()=>{if(load().length&&confirm('Delete the whole sales log? This cannot be undone.')){save([]);renderSales()}};
$('saleCsv').onclick=()=>{const q=v=>{let t=String(v??'');if(/^[=+\-@\t\r]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"'};
 const rows=['Date,Ref,Client,Device,Games,Count,Subtotal,Discount,Total,Status',...load().map(x=>[new Date(x.t).toISOString(),x.ref,x.name,x.device||'',(x.items||[]).join(' | '),x.count,x.subtotal??x.total,x.discount||0,x.total,x.done?'Paid':'Pending'].map(q).join(','))];
 download(new Blob([rows.join('\n')],{type:'text/csv'}),'zinomi-sales-'+stamp()+'.csv')};
/* header nav button (owner only) */
const nav=document.querySelector('.zx-nav');
if(nav){const b=document.createElement('button');b.className='zx-nl admin';b.dataset.t='sales';b.textContent='Sales';b.onclick=()=>switchTab('sales');const ins=nav.querySelector('[data-t="stats"]');ins?ins.after(b):nav.append(b)}
const _sw=switchTab;switchTab=function(t){_sw(t);if(t==='sales')renderSales()};
/* NEW badge: games added in the last 7 days */
const _mc=makeCard;makeCard=function(g,i){const c=_mc(g,i);try{if(!g.wish&&g.created&&Date.now()-g.created<7*864e5){const cv=c.querySelector('.cover');if(cv)cv.append(el('div','zx-new','NEW'))}}catch{}return c};
try{if(gamesLoaded)render(true)}catch{}
})();

;(()=>{try{
const $=s=>document.querySelector(s),H=document.documentElement,K='zx_prefs_'+(document.getElementById('gameGrid')?'g':'m'),B='zx_lastbackup_'+(document.getElementById('gameGrid')?'g':'m');
let P={};try{P=JSON.parse(localStorage.getItem(K)||'{}')}catch{}
const sv=()=>{try{localStorage.setItem(K,JSON.stringify(P))}catch{}};
const mk=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e};
function apply(){
 H.classList.toggle('zx-noanim',P.anim===false);H.classList.toggle('zx-customer',!!P.customer);H.classList.toggle('zx-xlight',P.xl===true);
 if(P.accent){H.style.setProperty('--accent',P.accent);H.style.setProperty('--gold',P.accent);H.style.setProperty('--gold-bright',P.accent)}
 if(P.size){H.classList.add('zx-sized');H.style.setProperty('--zx-min',P.size+'px')}
}
apply();
/* stagger */
const stag=g=>{[...g.children].forEach((c,i)=>c.style.setProperty('--zi',Math.min(i,24)))};
['gameGrid','movieGrid'].forEach(id=>{const g=document.getElementById(id);if(!g)return;stag(g);new MutationObserver(()=>stag(g)).observe(g,{childList:true})});
/* palette */
const modal=(c)=>{const m=mk('div','zxM');m.onclick=e=>{if(e.target===m)m.classList.remove('on')};const b=mk('div','zxBox');m.append(b);document.body.append(m);c(b);return m};
const grid=()=>$('#gameGrid')||$('#movieGrid');
const title=c=>{const e=c.querySelector('.movie-title,[class*=title],[class*=name],h3,b');return (e?e.textContent:c.textContent).trim().split('\n')[0].slice(0,80)};
const acts=[['Settings','⚙',()=>openSet()],['Focus search','/',()=>$('#search')&&$('#search').focus()],['Toggle theme','◐',()=>{const t=$('#themeBtn');if(t)t.click();else{P.xl=!P.xl;sv();apply()}}],['Customer mode on/off','👁',()=>{P.customer=!P.customer;sv();apply()}],['Backup now','💾',()=>($('#backupBtn')||$('#sideBackup')||{click(){}}).click()],['Save current filters as preset','★',()=>savePre()]];
const FL=['search','genreFilter','statusFilter','sort','minRatingFilter','diskFilter','langFilter','subFilter','maxPrice','maxSize'];
function savePre(){const n=prompt('Preset name?');if(!n)return;const o={};FL.forEach(i=>{const e=document.getElementById(i);if(e)o[i]=e.value});(P.pre=P.pre||{})[n]=o;sv()}
function usePre(o){FL.forEach(i=>{const e=document.getElementById(i);if(e&&i in o){e.value=o[i];e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))}})}
let pal,sel=0,cur=[];
function openPal(){if(!pal){pal=modal(b=>{const i=mk('input');i.type='text';i.placeholder='Search titles, run an action, apply a preset…';const l=mk('div','zxList');b.append(i,l);
 const draw=()=>{const q=i.value.toLowerCase().trim();cur=[];
  acts.forEach(a=>{if(!q||a[0].toLowerCase().includes(q))cur.push({t:a[1]+'  '+a[0],s:'action',f:a[2]})});
  Object.keys(P.pre||{}).forEach(n=>{if(!q||n.toLowerCase().includes(q))cur.push({t:'★  '+n,s:'preset',f:()=>usePre(P.pre[n])})});
  const g=grid();if(g&&q)[...g.children].forEach(c=>{const t=title(c);if(cur.length<40&&t.toLowerCase().includes(q))cur.push({t,s:'title',f:()=>{c.scrollIntoView({behavior:'smooth',block:'center'});c.click()}})});
  sel=0;l.innerHTML='';cur.forEach((x,k)=>{const r=mk('div','zxIt'+(k?'':' sel'));r.append(mk('span','',x.t.replace(/</g,'&lt;')),mk('small','',x.s));r.onclick=()=>{pal.classList.remove('on');x.f()};l.append(r)})};
 i.oninput=draw;i.onkeydown=e=>{const r=l.children;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();sel=Math.max(0,Math.min(r.length-1,sel+(e.key==='ArrowDown'?1:-1)));[...r].forEach((x,k)=>x.classList.toggle('sel',k===sel));r[sel]&&r[sel].scrollIntoView({block:'nearest'})}else if(e.key==='Enter'&&r[sel])r[sel].click();else if(e.key==='Escape')pal.classList.remove('on')};b._d=draw;b._i=i})}
 pal.classList.add('on');const b=pal.firstChild;b._i.value='';b._d();b._i.focus()}
/* settings */
let sm;function openSet(){if(!sm)sm=modal(b=>{b.innerHTML='<h3>Settings</h3>';
 const row=(l,n)=>{const r=mk('div','zxRow');r.append(mk('span','',l),n);b.append(r);return n};
 const acc=mk('input');acc.type='color';acc.value=P.accent||'#4c8dff';acc.oninput=()=>{P.accent=acc.value;sv();apply()};row('Accent colour',acc);
 const rs=mk('button','','Reset');rs.onclick=()=>{delete P.accent;sv();['--accent','--gold','--gold-bright'].forEach(v=>H.style.removeProperty(v))};row('Reset accent',rs);
 const sz=mk('input');sz.type='range';sz.min=140;sz.max=320;sz.step=10;sz.value=P.size||200;sz.oninput=()=>{P.size=+sz.value;sv();apply()};row('Card size',sz);
 const an=mk('input');an.type='checkbox';an.checked=P.anim!==false;an.onchange=()=>{P.anim=an.checked;sv();apply()};row('Animations',an);
 if(!$('#themeBtn')){const xl=mk('input');xl.type='checkbox';xl.checked=!!P.xl;xl.onchange=()=>{P.xl=xl.checked;sv();apply()};row('Light theme',xl)}
 const cu2=mk('input');cu2.type='checkbox';cu2.checked=!!P.customer;cu2.onchange=()=>{P.customer=cu2.checked;sv();apply()};row('Customer mode (hide admin)',cu2);
  const hp=mk('div','zxRow','<span style="color:var(--muted)">Shortcuts: Ctrl+K palette · / search · N new · ? this panel</span>');b.append(hp)});sm.classList.add('on')}
const gear=mk('button','','⚙');gear.id='zxGear';gear.title='Settings';gear.setAttribute('aria-label','Settings');gear.onclick=openSet;document.body.append(gear);
/* shortcuts */
addEventListener('keydown',e=>{const t=e.target,typing=t&&/INPUT|TEXTAREA|SELECT/.test(t.tagName);
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPal();return}
 if(e.key==='Escape')document.querySelectorAll('.zxM.on').forEach(m=>m.classList.remove('on'));
 if(typing||e.ctrlKey||e.metaKey||e.altKey)return;
 if(e.key==='/'){e.preventDefault();const s=$('#search');s&&s.focus()}
 else if(e.key==='?')openSet();
 else if(e.key.toLowerCase()==='n'){const a=$('#addBtn')||$('#quickAdd');a&&a.click()}});
}catch(e){console.warn('zx upgrade',e)}})();

;try{document.querySelectorAll(".logo").forEach(e=>{e.innerHTML='<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ag1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a3cff"/><stop offset="1" stop-color="#3f86ff"/></linearGradient><linearGradient id="ag2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f6bff"/><stop offset="1" stop-color="#22a0f0"/></linearGradient><linearGradient id="ag3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b78ff"/><stop offset="1" stop-color="#2f93f6"/></linearGradient><linearGradient id="ag4" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2186f6"/><stop offset="1" stop-color="#0fb3e6"/></linearGradient><linearGradient id="agl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><g class="pt tl"><path d="M10 10L100.0 10A90.0 90.0 0 0 1 190 100.0A90.0 90.0 0 0 1 100.0 190A90.0 90.0 0 0 1 10 100.0Z" fill="url(#ag1)"/><path d="M10 10L100.0 10A90.0 90.0 0 0 1 190 100.0A90.0 90.0 0 0 1 100.0 190A90.0 90.0 0 0 1 10 100.0Z" fill="url(#agl)"/></g><g class="pt tr"><path d="M390 10L390 100.0A90.0 90.0 0 0 1 300.0 190A90.0 90.0 0 0 1 210 100.0A90.0 90.0 0 0 1 300.0 10Z" fill="url(#ag2)"/><path d="M390 10L390 100.0A90.0 90.0 0 0 1 300.0 190A90.0 90.0 0 0 1 210 100.0A90.0 90.0 0 0 1 300.0 10Z" fill="url(#agl)"/></g><g class="pt bl"><path d="M10 390L10 300.0A90.0 90.0 0 0 1 100.0 210A90.0 90.0 0 0 1 190 300.0A90.0 90.0 0 0 1 100.0 390Z" fill="url(#ag3)"/><path d="M10 390L10 300.0A90.0 90.0 0 0 1 100.0 210A90.0 90.0 0 0 1 190 300.0A90.0 90.0 0 0 1 100.0 390Z" fill="url(#agl)"/></g><g class="pt br"><path d="M390 390L300.0 390A90.0 90.0 0 0 1 210 300.0A90.0 90.0 0 0 1 300.0 210A90.0 90.0 0 0 1 390 300.0Z" fill="url(#ag4)"/><path d="M390 390L300.0 390A90.0 90.0 0 0 1 210 300.0A90.0 90.0 0 0 1 300.0 210A90.0 90.0 0 0 1 390 300.0Z" fill="url(#agl)"/></g></svg>'})}catch(x){}
