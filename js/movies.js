(function(){var s=document.getElementById('zSplash'),b=document.getElementById('zsBar'),m=document.getElementById('zsMsg');if(!s)return;document.body.style.overflow='hidden';
var st=['STARTING PROJECTOR…','LOADING FILM VAULT…','INDEXING MOVIES & SERIES…','CHECKING SUBTITLES…','NOW SHOWING'],i=0;
function step(){m.textContent=st[i];b.style.width=((i+1)/st.length*100)+'%';i++;if(i<st.length)setTimeout(step,420);else setTimeout(done,500)}
function done(){s.classList.add('out');document.body.style.overflow='';setTimeout(function(){s.remove()},700)}
step();setTimeout(function(){if(document.getElementById('zSplash'))done()},6000)})();

;const DB_NAME='ZinomiMoviesHubDB', DB_VERSION=1;
let db, movies=[], notes=[], selectedNote=null, posterData='', currentPoster='', favOnly=false, activeModalId=null;
const $=id=>document.getElementById(id);
const CUR='Rs.';let limit=60;
const money=n=>CUR+' '+Number(n||0).toLocaleString();
let mode='movie';
const isSeries=m=>m&&m.type==='series';
const inMode=m=>isSeries(m)===(mode==='series');
const cur=()=>movies.filter(inMode);
const kind=m=>isSeries(m)?'TV series':'film';
const pad2=n=>String(n).padStart(2,'0');
function seasonsOf(m){
 if(!isSeries(m))return [];
 if(Array.isArray(m.seasonList)&&m.seasonList.length)return m.seasonList;
 const n=m.seasons||0;return Array.from({length:n},(_,k)=>({n:k+1,ep:n===1?(m.episodes||0):0,total:0}));
}
const isDone=x=>x.total>0&&x.ep>=x.total;
function seriesInfo(m){
 const l=seasonsOf(m);if(!l.length)return '';
 const eps=l.reduce((t,x)=>t+(x.ep||0),0);
 return l.length+(l.length>1?' Seasons':' Season')+(eps?' · '+eps+' Eps':'');
}
function seasonChips(m,full){
 const l=seasonsOf(m);if(!l.length)return '';
 if(full)return l.map(x=>`<div class="srow-v"><b>Season ${pad2(x.n)}</b><span class="${isDone(x)?'done':''}">${x.ep||0}${x.total?' / '+x.total:''} episodes${isDone(x)?' ✔ Completed':x.total?' completed':''}</span></div>`).join('');
 return l.map(x=>`<span class="schip ${isDone(x)?'done':''}">S${pad2(x.n)} · ${x.ep||0}${x.total?'/'+x.total:''} eps${isDone(x)?' ✔':''}</span>`).join('');
}
const stOf=m=>m.status==='sold'||m.status==='watched'?'sold':m.status==='reserved'?'reserved':'available';

function toast(msg){
 const t=$('toast');t.textContent=msg;t.classList.add('show');
 clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2600);
}

function openDB(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB_NAME,DB_VERSION);
  req.onupgradeneeded=()=>{
   const d=req.result;
   if(!d.objectStoreNames.contains('movies'))d.createObjectStore('movies',{keyPath:'id'});
   if(!d.objectStoreNames.contains('notes'))d.createObjectStore('notes',{keyPath:'id'});
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
 });
}
function store(name,mode='readonly'){return db.transaction(name,mode).objectStore(name)}
function all(name){return new Promise((resolve,reject)=>{const r=store(name).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function put(name,obj){return new Promise((resolve,reject)=>{const tx=db.transaction(name,'readwrite');tx.objectStore(name).put(obj);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
function del(name,id){return new Promise((resolve,reject)=>{const tx=db.transaction(name,'readwrite');tx.objectStore(name).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
function makeId(){return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)}
function escapeHTML(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

/* AUTO-COMPRESS POSTER IMAGES */
function compressImage(file){
 return new Promise(res=>{
  const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{
   const max=420,sc=Math.min(1,max/Math.max(img.width,img.height));
   const c=document.createElement('canvas');
   c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);
   c.getContext('2d').drawImage(img,0,0,c.width,c.height);
   URL.revokeObjectURL(url);
   res(c.toDataURL('image/jpeg',0.78));
  };
  img.onerror=()=>{
   URL.revokeObjectURL(url);
   const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(file);
  };
  img.src=url;
 });
}

async function handlePosterFile(file){
 if(!file||!file.type.startsWith('image/'))return toast('Please choose a valid image file');
 if(file.size>15*1024*1024)return toast('Image must be under 15 MB');
 posterData=await compressImage(file);
 setPreview(posterData);
 toast('Poster ready');
}

async function refresh(){
 movies=await loadMovies();
 notes=await all('notes');
 $('movieCount').textContent=movies.length;
 $('watchedCount').textContent=movies.filter(m=>stOf(m)==='available').length;
 $('watchlistCount').textContent=movies.filter(m=>stOf(m)==='sold').length;
 $('noteCount').textContent=money(movies.filter(m=>stOf(m)==='sold').reduce((t,m)=>t+(m.soldPrice??m.price??0),0));storageInfo();
 updateFilters();
 renderMovies();
 renderNotes();
}

function updateFilters(){
 const gSel=$('genreFilter'),gv=gSel.value,gs=[...new Set(cur().map(m=>m.genre).filter(Boolean))].sort();
 gSel.innerHTML='<option value="">All genres</option>'+gs.map(g=>`<option>${escapeHTML(g)}</option>`).join('');
 gSel.value=gs.includes(gv)?gv:'';

 const lSel=$('langFilter'),lv=lSel.value,ls=[...new Set(cur().map(m=>m.language).filter(Boolean))].sort();
 lSel.innerHTML='<option value="">All languages</option>'+ls.map(l=>`<option>${escapeHTML(l)}</option>`).join('');
 lSel.value=ls.includes(lv)?lv:'';
}

function subOf(m){return m.sinSub==='yes'||m.sinSub==='no'?m.sinSub:'unk'}
function subPill(m){const s=subOf(m);return s==='yes'?'<div class="sub-pill yes">✔ SINHALA SUB</div>':s==='no'?'<div class="sub-pill no">✖ NO SINHALA SUB</div>':''}
function subTxt(m){const s=subOf(m);return s==='yes'?'Sinhala Sub ✔':s==='no'?'No Sinhala Sub':''}
function renderMovies(){
 let list=[...cur()];
 const q=$('search').value.trim().toLowerCase();
 const g=$('genreFilter').value;
 const l=$('langFilter').value;
 const st=$('statusFilter').value;
 const sf=$('subFilter').value;
 const mr=$('minRatingFilter').value;
 const rt=m=>{const n=Number(m.imdbRating);return Number.isFinite(n)&&n>0?n:null};
 const s=$('sort').value;

 list=list.filter(m=>{
  const matchQ=!q||[m.name,m.genre,m.year,m.language,m.quality,subTxt(m),m.price,m.buyer,m.description].join(' ').toLowerCase().includes(q);
  const matchG=!g||m.genre===g;
  const matchL=!l||m.language===l;
  const matchSt=!st||stOf(m)===st;
  const matchSub=!sf||subOf(m)===sf;
  const matchFav=!favOnly||m.fav;
  const matchR=!mr||(mr==='na'?rt(m)===null:(rt(m)!==null&&rt(m)>=+mr));
  return matchQ&&matchG&&matchL&&matchSt&&matchSub&&matchFav&&matchR;
 });

 list.sort((a,b)=>{
  if(s==='az')return a.name.localeCompare(b.name);
  if(s==='za')return b.name.localeCompare(a.name);
  if(s==='year')return (b.year||0)-(a.year||0);
  if(s==='pl')return (a.price||0)-(b.price||0);
  if(s==='ph')return (b.price||0)-(a.price||0);
  if(s==='rating')return (rt(b)??-1)-(rt(a)??-1)||(b.created||0)-(a.created||0);
  return (b.created||0)-(a.created||0);
 });

 const _tot=cur().length,_lbl=mode==='series'?'TV SERIES':'MOVIES';
 $('countBar').textContent=list.length===_tot
  ? `SHOWING ALL ${_tot} ${_lbl}`
  : `SHOWING ${list.length} OF ${_tot} ${_lbl}`;

 $('moreBtn').hidden=list.length<=limit;$('moreBtn').textContent='Load more ('+(list.length-limit)+' left)';
 $('movieGrid').innerHTML=list.slice(0,limit).map(m=>{
  const s2=stOf(m);
  
  return `<article class="movie ${s2==='sold'?'sold':''}" data-id="${m.id}" onclick="openMovieModal('${m.id}')">
   <div class="poster">
    ${m.poster?`<img src="${m.poster}" alt="${escapeHTML(m.name)}" loading="lazy" onerror="this.parentElement.innerHTML='<span class=placeholder>🎬</span>'">`:`<span class="placeholder">${isSeries(m)?'📺':'🎬'}</span>`}
    ${m.isNew?'<span class="zx-new">NEW</span>':''}
    ${m.language?`<span class="badge-lang">${escapeHTML(m.language.toUpperCase())}</span>`:''}
    <button class="btn-fav adm ${m.fav?'on':''}" title="Favorite" onclick="event.stopPropagation();toggleFav('${m.id}')">${m.fav?'♥':'♡'}</button>
    <span class="badge-status ${s2}">${s2.toUpperCase()}</span>
    ${m.price?`<span class="badge-rating">${onSale(m)?`<s style="opacity:.55">${money(m.price)}</s> `:''}${money(effP(m))}</span>`:''}${onSale(m)?`<span class="sale">-${Math.round(100-effP(m)/m.price*100)}%</span>`:''}
   </div>
   <div class="movie-info">
    <div class="movie-title" title="${escapeHTML(m.name)}">${escapeHTML(m.name)}</div>
    <div class="movie-meta">${[m.year,m.genre,m.quality,seriesInfo(m)].filter(Boolean).map(escapeHTML).join(' · ')||'No genre or year'}</div>
    ${subPill(m)}
    <div class="movie-actions" onclick="event.stopPropagation()">
     <button class="btn small" title="Add to cart" aria-label="Add to cart" onclick="addCart('${m.id}')" ${s2==='sold'?'disabled':''}>🛒</button>
     <button class="btn small wa buy" title="${s2==='sold'?'Sold':'Buy on WhatsApp'}" aria-label="Buy on WhatsApp" onclick="buyMovie('${m.id}')" ${s2==='sold'?'disabled':''}>${s2==='sold'?'🚫':'💬'}</button>
     <button class="btn small adm" title="${s2==='sold'?'Undo sale':'Mark as sold'}" aria-label="${s2==='sold'?'Undo sale':'Mark as sold'}" onclick="sellMovie('${m.id}')">${s2==='sold'?'↩️':'💰'}</button>
     <button class="btn small adm" title="Edit" aria-label="Edit" onclick="editMovie('${m.id}')">✏️</button>
     <button class="btn small adm" title="${m.isNew?'Remove NEW label':'Mark as NEW'}" aria-label="Toggle NEW label" style="${m.isNew?'background:#ff5a5a33;border-color:#ff5a5a':''}" onclick="toggleFlag('${m.id}','isNew','New Arrivals')">🔥</button>
     <button class="btn small danger adm" title="Remove" aria-label="Remove" onclick="removeMovie('${m.id}')">🗑️</button>
    </div>
   </div>
  </article>`;
 }).join('');
 $('emptyLibrary').hidden=list.length!==0;
}

/* MOVIE DETAILS MODAL */
function openMovieModal(id,tagText='FILM DETAILS'){
 const m=movies.find(x=>x.id===id);if(!m)return;
 activeModalId=id;
 if(isSeries(m)&&tagText==='FILM DETAILS')tagText='TV SERIES DETAILS';
 $('modalTag').textContent=tagText;
 $('modalTitle').textContent=m.name;
 const stars=m.price?' · '+money(effP(m))+(stOf(m)==='sold'?' (SOLD)':''):'';
 $('modalMeta').textContent=([m.year,m.genre,m.language,m.quality,subTxt(m),seriesInfo(m)].filter(Boolean).join(' · ')||'No metadata')+stars;
 $('modalDesc').textContent=m.description||'No synopsis or remarks saved for this movie.';
 $('modalSeasons').innerHTML=seasonChips(m,true);
 $('modalPoster').innerHTML=m.poster?`<img src="${m.poster}" alt="${escapeHTML(m.name)}">`:'🎬';
 $('modalToggleStatus').textContent=stOf(m)==='sold'?'↩ Mark Available':'💰 Mark Sold';
 $('movieModal').classList.add('open');
}
window.openMovieModal=openMovieModal;

$('modalCloseBtn').onclick=()=>$('movieModal').classList.remove('open');
$('movieModal').onclick=e=>{if(e.target===$('movieModal'))$('movieModal').classList.remove('open')};
$('modalTrailerBtn').onclick=()=>{
 const m=movies.find(x=>x.id===activeModalId);if(!m)return;
 const q=[m.name,m.year,'official trailer'].filter(Boolean).join(' ');
 window.open('https://www.youtube.com/results?search_query='+encodeURIComponent(q),'_blank');
};
$('modalToggleStatus').onclick=async()=>{
 if(!activeModalId)return;
 await sellMovie(activeModalId);
 openMovieModal(activeModalId,$('modalTag').textContent);
};
$('modalCopyBtn').onclick=()=>{
 const m=movies.find(x=>x.id===activeModalId);if(!m)return;
 const t='🎬 '+m.name+(m.year?' ('+m.year+')':'')+'\n'+[m.quality,m.language,subTxt(m),m.genre,m.size?m.size+' GB':''].filter(Boolean).join(' · ')+'\n💰 '+money(effP(m));
 navigator.clipboard.writeText(t).then(()=>toast('Listing copied – paste in WhatsApp / Facebook'),()=>toast('Copy failed'));
};
$('modalEditBtn').onclick=()=>{
 const id=activeModalId;
 $('movieModal').classList.remove('open');
 editMovie(id);
};

/* SELL / UNDO */
async function sellMovie(id){
 const m=movies.find(x=>x.id===id);if(!m)return;
 if(stOf(m)==='sold'){m.status='available';delete m.soldPrice;delete m.buyer;delete m.soldAt}
 else{
  const p=prompt('Sold price ('+CUR+')',m.price||'');if(p===null)return;
  const b=prompt('Buyer name / phone (optional)','');
  m.status='sold';m.soldPrice=Number(p)||0;m.buyer=b||'';m.soldAt=Date.now();
 }
 m.updated=Date.now();await put('movies',m);await refresh();
 toast(stOf(m)==='sold'?'Marked as sold':'Back to available');
}
window.sellMovie=sellMovie;

/* PRICE LIST CSV */
$('exportCsvBtn').onclick=()=>{
 if(!movies.length)return toast('No films to export');
 const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const rows=[['Type','Title','Year','Genre','Language','Quality','Sinhala Sub','Size GB','Price','Status','Buyer','Sold Price']]
  .concat(movies.map(m=>[isSeries(m)?'TV Series':'Movie',m.name,m.year,m.genre,m.language,m.quality,subTxt(m)||'Not checked',m.size,m.price,stOf(m),m.buyer,m.soldPrice]));
 const blob=new Blob(['\ufeff'+rows.map(r=>r.map(q).join(',')).join('\n')],{type:'text/csv'});
 const a=document.createElement('a'),u=URL.createObjectURL(blob);
 a.href=u;a.download='Zinomi-Price-List-'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(u);
};

/* STORAGE METER */
async function storageInfo(){
 try{
  if(navigator.storage&&navigator.storage.persist)await navigator.storage.persist();
  const e=await navigator.storage.estimate();
  $('storageInfo').textContent='STORAGE USED: '+(e.usage/1048576).toFixed(1)+' MB of ~'+Math.round(e.quota/1048576).toLocaleString()+' MB available';
 }catch(err){}
}

async function toggleFav(id){
 const m=movies.find(x=>x.id===id);if(!m)return;
 m.fav=!m.fav;
 await put('movies',m);await refresh();
}
window.toggleFav=toggleFav;

function showTab(id){
 document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
 document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id===id));
}

function resetForm(){
 $('movieForm').reset();$('movieId').value='';posterData='';currentPoster='';
 $('posterPreview').innerHTML='Click / Drop<br>Poster';
 $('formHeading').textContent='Add a Movie';$('saveMovie').textContent='Save Movie';$('cancelEdit').hidden=true;
}

function editMovie(id){
 const m=movies.find(x=>x.id===id);if(!m)return;
 showTab('add');
 $('movieId').value=m.id;
 $('itemType').value=isSeries(m)?'series':'movie';loadSeasons(seasonsOf(m));typeUI();
 $('movieName').value=m.name;
 $('movieYear').value=m.year||'';
 $('movieGenre').value=m.genre||'';
 $('movieLanguage').value=m.language||'';
 $('movieStatus').value=stOf(m);
 $('moviePrice').value=m.price||'';$('salePrice').value=m.salePrice||'';$('movieQuality').value=m.quality||'';$('movieSinSub').value=m.sinSub||'';$('movieSize').value=m.size||'';
 $('posterUrl').value=m.posterUrl||'';$('trailerUrl').value=m.trailerUrl||'';$('moviePopular').checked=!!m.popular;$('movieIsNew').checked=!!m.isNew;
 $('movieDescription').value=m.description||'';
 posterData='';currentPoster=m.poster||'';setPreview(currentPoster);
 $('formHeading').textContent='Edit Movie';$('saveMovie').textContent='Update Movie';$('cancelEdit').hidden=false;
 window.scrollTo({top:0,behavior:'smooth'});
}

function setPreview(src){
 $('posterPreview').innerHTML=src?`<img src="${src}" alt="Poster preview">`:'Click / Drop<br>Poster';
}

async function removeMovie(id){
 const m=movies.find(x=>x.id===id);
 if(m&&confirm(`Remove "${m.name}" from your vault?`)){
  await del('movies',id);await refresh();toast('Movie removed');
 }
}
window.editMovie=editMovie;window.removeMovie=removeMovie;

$('movieForm').addEventListener('submit',async e=>{
 e.preventDefault();
 const id=$('movieId').value||makeId(),old=movies.find(m=>m.id===id);
 if(!old){const nm=$('movieName').value.trim().toLowerCase(),yr=Number($('movieYear').value)||null,d=movies.find(x=>x.name.trim().toLowerCase()===nm&&(x.year||null)===yr&&((x.type==='series')?'series':'movie')===$('itemType').value);
  if(d&&!confirm('"'+d.name+'"'+(yr?' ('+yr+')':'')+' is already in your store. Add it again?'))return}
 let poster=posterData||currentPoster;
 const url=$('posterUrl').value.trim();
 if(!poster&&url)poster=url;
 const obj={
  id,
  type:$('itemType').value==='series'?'series':'movie',
  seasonList:curSeasons(),seasons:curSeasons().length,episodes:curSeasons().reduce((t,x)=>t+x.ep,0),
  name:$('movieName').value.trim(),
  year:Number($('movieYear').value)||null,
  genre:$('movieGenre').value.trim(),
  language:$('movieLanguage').value.trim(),
  status:$('movieStatus').value||'available',
  price:Number($('moviePrice').value)||0,salePrice:Number($('salePrice').value)||0,quality:$('movieQuality').value.trim(),sinSub:$('movieSinSub').value,size:Number($('movieSize').value)||0,soldPrice:old?.soldPrice,buyer:old?.buyer,soldAt:old?.soldAt,
  herobg:old?.herobg||'',fav:old?.fav||false,popular:$('moviePopular').checked,isNew:$('movieIsNew').checked,
  poster,
  posterUrl:url,trailerUrl:$('trailerUrl').value.trim(),
  description:$('movieDescription').value.trim(),
  created:old?.created||Date.now(),
  updated:Date.now()
 };
 if(!obj.name)return;
 try{
  await put('movies',obj);mode=obj.type==='series'?'series':'movie';await refresh();resetForm();showTab('library');
  toast(old?'Movie updated':'Movie archived in vault');
 }catch(err){
  alert('Could not save this movie. Browser storage may be full—export a backup first.');
 }
});

/* POSTER INPUTS: CLICK, FILE, DRAG/DROP, PASTE, WEB SEARCH */
$('posterPreview').onclick=()=>$('posterFile').click();
$('posterFile').addEventListener('change',e=>{if(e.target.files[0])handlePosterFile(e.target.files[0])});
['dragover','dragenter'].forEach(ev=>$('posterPreview').addEventListener(ev,e=>{e.preventDefault();$('posterPreview').classList.add('drag')}));
['dragleave','drop'].forEach(ev=>$('posterPreview').addEventListener(ev,e=>{e.preventDefault();$('posterPreview').classList.remove('drag')}));
$('posterPreview').addEventListener('drop',e=>{if(e.dataTransfer.files[0])handlePosterFile(e.dataTransfer.files[0])});
window.addEventListener('paste',e=>{
 if(!$('add').classList.contains('active'))return;
 const f=[...e.clipboardData.files].find(x=>x.type.startsWith('image/'));
 if(f)handlePosterFile(f);
});
$('findPosterBtn').onclick=()=>{
 const name=$('movieName').value.trim();
 if(!name)return toast('Enter a movie title first');
 window.open('https://www.google.com/search?tbm=isch&q='+encodeURIComponent(name+' movie poster'),'_blank');
 toast('Copy a poster image & press Ctrl+V here!');
};
$('posterUrl').addEventListener('input',()=>{
 if(!$('posterFile').files.length){currentPoster='';setPreview($('posterUrl').value.trim())}
});

$('clearForm').onclick=resetForm;$('cancelEdit').onclick=resetForm;$('quickAdd').onclick=()=>{resetForm();showTab('add')};
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
const rr=()=>{limit=60;renderMovies()};$('search').oninput=rr;$('genreFilter').onchange=rr;$('langFilter').onchange=rr;$('statusFilter').onchange=rr;$('subFilter').onchange=rr;$('sort').onchange=rr;$('minRatingFilter').onchange=rr;$('moreBtn').onclick=()=>{limit+=60;renderMovies()};
$('favFilter').onclick=()=>{favOnly=!favOnly;limit=60;$('favFilter').classList.toggle('on',favOnly);renderMovies()};

/* NOTES */
function renderNotes(){
 const el=$('notesList');
 el.innerHTML=notes.sort((a,b)=>b.updated-a.updated).map(n=>`<div class="note-item ${selectedNote===n.id?'active':''}" onclick="selectNote('${n.id}')"><b>${escapeHTML(n.title||'Untitled note')}</b><small>${new Date(n.updated).toLocaleString()}</small></div>`).join('')||'<div class="empty">No notes yet. Create your first cinema note.</div>';
}
function selectNote(id){
 const n=notes.find(x=>x.id===id);if(!n)return;
 selectedNote=id;$('noteTitle').value=n.title;$('noteBody').value=n.body;renderNotes();
}
window.selectNote=selectNote;
$('newNote').onclick=()=>{selectedNote=null;$('noteTitle').value='';$('noteBody').value='';renderNotes();$('noteTitle').focus()};
$('saveNote').onclick=async()=>{
 const title=$('noteTitle').value.trim(),body=$('noteBody').value.trim();
 if(!title&&!body)return toast('Write something before saving');
 const old=notes.find(n=>n.id===selectedNote);
 const n={id:selectedNote||makeId(),title:title||'Untitled note',body,created:old?.created||Date.now(),updated:Date.now()};
 await put('notes',n);selectedNote=n.id;await refresh();toast('Note saved');
};
$('deleteNote').onclick=async()=>{
 if(!selectedNote)return toast('Select a saved note first');
 if(confirm('Delete this note?')){
  await del('notes',selectedNote);selectedNote=null;$('noteTitle').value='';$('noteBody').value='';
  await refresh();toast('Note deleted');
 }
};

/* BACKUP & RESTORE */
$('backupBtn').onclick=async()=>{
 const data={app:'Zinomi Movies Hub',version:1,exportedAt:new Date().toISOString(),movies:await all('movies'),notes:await all('notes')};
 const blob=new Blob([JSON.stringify(data)],{type:'application/json'}),a=document.createElement('a'),url=URL.createObjectURL(blob);
 a.href=url;a.download='Zinomi-Movies-Hub-Backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();
 URL.revokeObjectURL(url);toast('Backup downloaded');
};
$('restoreBtn').onclick=()=>$('restoreFile').click();
$('restoreFile').onchange=async e=>{
 const f=e.target.files[0];if(!f)return;
 try{
  const data=JSON.parse(await f.text());
  if(!Array.isArray(data.movies)||!Array.isArray(data.notes))throw Error('Invalid backup');
  if(!confirm(`Restore ${data.movies.length} movies and ${data.notes.length} notes? Existing items with matching IDs will be replaced.`))return;
  for(const m of data.movies){if(!m.id||!m.name)continue;await put('movies',m)}
  for(const n of data.notes){if(!n.id)continue;await put('notes',n)}
  await refresh();toast('Backup restored successfully');
 }catch(err){
  alert('This file is not a valid Zinomi Movies Hub backup.');
 }finally{e.target.value=''}
};

/* ===== HERO / POPULAR / TRAILER ===== */
let heroIdx=0;
function trailer(m){if(!m)return toast('Add a film first');window.open('https://www.youtube.com/results?search_query='+encodeURIComponent([m.name,m.year,'official trailer'].filter(Boolean).join(' ')),'_blank')}
function heroList(){return [...cur()].sort((a,b)=>(!!b.poster-!!a.poster)||(!!b.fav-!!a.fav)||((b.created||0)-(a.created||0)))}
function renderHero(){
 const l=heroList(),m=l[heroIdx%(l.length||1)];
 $('heroTitle').textContent=m?m.name:(mode==='series'?'TV Series – coming soon':'Welcome to Zinomi');
 $('heroSeasons').innerHTML=m?seasonChips(m):'';
 $('heroMeta').textContent=m?[m.year,m.genre,m.language,m.quality,subTxt(m),seriesInfo(m),m.price?money(m.price):''].filter(Boolean).join(' · '):'';
 $('heroDesc').textContent=m?(m.description||'No synopsis saved for this '+kind(m)+' yet.'):(mode==='series'?'Add your first TV series to see it featured here.':'Add your first film to see it featured here.');
 $('heroPoster').innerHTML=m&&m.poster?`<img src="${m.poster}" alt="">`:(mode==='series'?'📺':'🎬');
 $('heroBg').style.backgroundImage=m&&m.poster?`url("${m.poster}")`:'none';
 $('popRow').innerHTML=l.slice(0,20).map((x,i)=>`<div class="p ${i===heroIdx%l.length?'on':''}" data-i="${i}" title="${escapeHTML(x.name)}">${x.poster?`<img src="${x.poster}" alt="" loading="lazy">`:'🎬'}</div>`).join('')||'<div style="color:var(--muted);font-size:13px">No films yet.</div>';
}
$('popRow').onclick=e=>{const p=e.target.closest('.p');if(p){heroIdx=+p.dataset.i;renderHero();window.scrollTo({top:0,behavior:'smooth'})}};
$('heroPrev').onclick=()=>{const n=movies.length||1;heroIdx=(heroIdx-1+n)%n;renderHero()};
$('heroNext').onclick=()=>{heroIdx=(heroIdx+1)%(movies.length||1);renderHero()};
$('heroTrailer').onclick=()=>trailer(heroList()[heroIdx%(movies.length||1)]);
$('heroAdd').onclick=()=>{resetForm();showTab('add')};
$('sideBackup').onclick=()=>$('backupBtn').click();
document.querySelectorAll('.side [data-go]').forEach(b=>b.onclick=()=>{showTab(b.dataset.go);window.scrollTo({top:0,behavior:'smooth'})});
const _rm=renderMovies;renderMovies=function(){_rm();renderHero()};
const _st=showTab;showTab=function(id){_st(id);$('homeTop').style.display=id==='library'?'':'none';document.querySelector('header').style.position=id==='library'?'':'relative';document.querySelectorAll('.side [data-go]').forEach(b=>b.classList.toggle('on',b.dataset.go===id&&b===document.querySelector('.side [data-go="'+id+'"]')))};

/* ===== ADMIN PIN / WHATSAPP / EMBEDDED TRAILER ===== */
const LS={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:k_v=>{}};
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}},lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const isAdmin=()=>document.body.classList.contains('admin');
function setAdmin(on){document.body.classList.toggle('admin',on);$('adminBtn').textContent=on?'🔓 Admin mode (lock)':'🔒 Admin';if(!on)showTab('library')}
function newPin(){
 const p=prompt('Create an admin PIN (4+ characters). Customers will not be able to edit, sell or delete without it.');
 if(p===null)return false;if(p.trim().length<4){toast('PIN must be 4+ characters');return false}
 lsSet('zpin',p.trim());toast('PIN saved');return true;
}
$('adminBtn').onclick=()=>{
 if(isAdmin()){if(!lsGet('zpin')&&!newPin())return;setAdmin(false);return}
 const p=prompt('Enter admin PIN');if(p===null)return;
 if(p===lsGet('zpin'))setAdmin(true);else toast('Wrong PIN');
};
function waNumber(){return (lsGet('zwa')||'').replace(/\D/g,'')}
function setupWA(){
 const cur=lsGet('zwa')||'';
 const n=prompt('Your WhatsApp number with country code (e.g. 94771234567 or 0771234567):',cur);
 if(n===null)return;
 let d=n.replace(/\D/g,'');if(d.length===10&&d[0]==='0')d='94'+d.slice(1);
 if(d.length<9){toast('Enter a valid number');return}
 lsSet('zwa',d);toast('WhatsApp number saved: +'+d);
}
$('settingsBtn').onclick=()=>{setupWA();if(confirm('Change admin PIN as well?'))newPin()};
function buyMovie(id){
 const m=movies.find(x=>x.id===id);if(!m)return;
 if(stOf(m)==='sold')return toast('Sorry, this film is already sold');
 const num=waNumber();
 if(!num){if(isAdmin())setupWA();else toast('Seller WhatsApp number is not set yet');return}
 const t='Hi Zinomi Movie Hub! I want to buy this film:\n🎬 '+m.name+(m.year?' ('+m.year+')':'')+'\n'+[m.quality,m.language,subTxt(m)].filter(Boolean).join(' · ')+(m.price?'\n💰 '+money(m.price):'');
 window.open('https://wa.me/'+num+'?text='+encodeURIComponent(t),'_blank');
}
window.buyMovie=buyMovie;
const heroCur=()=>{const l=heroList();return l[heroIdx%(l.length||1)]};
$('heroBuy').onclick=()=>{const m=heroCur();m?buyMovie(m.id):toast('Add a film first')};
$('modalBuyBtn').onclick=()=>activeModalId&&buyMovie(activeModalId);

function ytId(u=''){const m=u.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);return m?m[1]:(/^[\w-]{11}$/.test(u.trim())?u.trim():'')}
function trailer(m){
 if(!m)return toast('Add a film first');
 const id=ytId(m.trailerUrl||'');
 if(!id){
  window.open('https://www.youtube.com/results?search_query='+encodeURIComponent([m.name,m.year,'official trailer'].filter(Boolean).join(' ')),'_blank');
  if(isAdmin())toast('Tip: paste the trailer link in Edit to play it inside the site');
  return;
 }
 $('trTitle').textContent=m.name+' – Trailer';
 $('trYt').href='https://www.youtube.com/watch?v='+id;
 $('trFrame').src='https://www.youtube.com/embed/'+id+'?autoplay=1&rel=0';
 $('trailerModal').classList.add('open');
}
function closeTrailer(){$('trailerModal').classList.remove('open');$('trFrame').src='about:blank'}
$('trClose').onclick=closeTrailer;
$('trailerModal').onclick=e=>{if(e.target===$('trailerModal'))closeTrailer()};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeTrailer()});
$('modalTrailerBtn').onclick=()=>trailer(movies.find(x=>x.id===activeModalId));
$('findTrailerBtn').onclick=()=>{
 const n=$('movieName').value.trim();if(!n)return toast('Enter a movie title first');
 window.open('https://www.youtube.com/results?search_query='+encodeURIComponent(n+' '+($('movieYear').value||'')+' official trailer'),'_blank');
 toast('Copy the YouTube link and paste it here');
};
const _st2=showTab;showTab=function(id){if(!isAdmin()&&id!=='library')id='library';_st2(id)};
setAdmin(!lsGet('zpin'));

/* ===== SHARED CATALOG / SALE / CART / ROWS / SHARE IMAGE / TMDB ===== */
let remote=null;
async function loadMovies(){
 if(!isAdmin()){try{const r=await fetch('films.json?'+Date.now());if(r.ok){const d=await r.json();if(Array.isArray(d.movies)){remote=d;return d.movies}}}catch(e){}}
 return all('movies');
}
function waNumber(){return (lsGet('zwa')||(remote&&remote.wa)||'').replace(/\D/g,'')}
function bundleText(){return lsGet('zbundle')||(remote&&remote.bundle)||''}
function effP(m){return m.salePrice>0&&m.salePrice<m.price?m.salePrice:(m.price||0)}
function onSale(m){return m.salePrice>0&&m.salePrice<m.price&&stOf(m)!=='sold'}
const _sa=setAdmin;setAdmin=function(on){_sa(on);if(db)refresh()};

/* settings */
function openSettings(){$('setWA').value=lsGet('zwa')||'';$('setBundle').value=lsGet('zbundle')||'';$('setTmdb').value=lsGet('ztmdb')||'';$('setPin').value='';$('setModal').classList.add('open')}
$('settingsBtn').onclick=openSettings;
$('setCancel').onclick=()=>$('setModal').classList.remove('open');
$('setSave').onclick=()=>{
 let d=$('setWA').value.replace(/\D/g,'');if(d.length===10&&d[0]==='0')d='94'+d.slice(1);
 if(d&&d.length<9)return toast('Enter a valid WhatsApp number');
 lsSet('zwa',d);lsSet('zbundle',$('setBundle').value.trim());lsSet('ztmdb',$('setTmdb').value.trim());
 const p=$('setPin').value.trim();if(p){if(p.length<4)return toast('PIN must be 4+ characters');lsSet('zpin',p)}
 $('setModal').classList.remove('open');renderRows();toast('Settings saved ✔');
};
function buyMovie(id){
 const m=movies.find(x=>x.id===id);if(!m)return;
 if(stOf(m)==='sold')return toast('Sorry, this is already sold');
 const num=waNumber();
 if(!num){if(isAdmin())openSettings();else toast('Seller WhatsApp number is not set yet');return}
 const t='Hi Zinomi Movie Hub! I want to buy this '+kind(m)+':\n'+(isSeries(m)?'📺 ':'🎬 ')+m.name+(m.year?' ('+m.year+')':'')+'\n'+[m.quality,m.language,subTxt(m),seriesInfo(m)].filter(Boolean).join(' · ')+(m.price?'\n💰 '+money(effP(m)):'');
 window.open('https://wa.me/'+num+'?text='+encodeURIComponent(t),'_blank');
}
window.buyMovie=buyMovie;

/* publish films.json */
$('publishBtn').onclick=async()=>{
 const list=(await all('movies')).map(({buyer,soldPrice,...r})=>r);
 const data={app:'Zinomi Movie Hub',exportedAt:new Date().toISOString(),wa:waNumber(),bundle:lsGet('zbundle')||'',herobg:lsGet('zherobg')||(remote&&remote.herobg)||'',movies:list};
 const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));
 a.href=u;a.download='films.json';a.click();URL.revokeObjectURL(u);
 toast('films.json downloaded – upload it next to your site file');
};

/* cart */
let cart=[];try{cart=JSON.parse(lsGet('zcart')||'[]')}catch(e){}
function saveCart(){lsSet('zcart',JSON.stringify(cart));renderCart()}
function addCart(id){const m=movies.find(x=>x.id===id);if(!m)return;if(stOf(m)==='sold')return toast('Already sold');if(cart.includes(id))return toast('Already in your cart');cart.push(id);saveCart();toast('Added to cart 🛒')}
window.addCart=addCart;
window.rmCart=id=>{cart=cart.filter(x=>x!==id);saveCart()};
function cartItems(){return cart.map(id=>movies.find(x=>x.id===id)).filter(m=>m&&stOf(m)!=='sold')}
function renderCart(){
 if(movies.length){cart=cartItems().map(m=>m.id)}
 const it=cartItems();
 $('cartN').textContent=cart.length;$('cartFab').hidden=!cart.length;
 $('cartList').innerHTML=it.map(m=>`<div class="ci">${m.poster?`<img src="${m.poster}" alt="">`:'<img alt="">'}<div><b>${escapeHTML(m.name)}</b>${[m.year,m.quality].filter(Boolean).join(' · ')} · ${money(effP(m))}</div><button class="btn small danger" onclick="rmCart('${m.id}')">✕</button></div>`).join('')||'<div style="padding:18px;color:var(--muted)">Your cart is empty.</div>';
 $('cartTotal').textContent=it.length?'Total: '+money(it.reduce((t,m)=>t+effP(m),0))+' ('+it.length+' films)':'';
}
$('cartFab').onclick=()=>{renderCart();$('cartModal').classList.add('open')};
$('cartClose').onclick=()=>$('cartModal').classList.remove('open');
$('cartModal').onclick=e=>{if(e.target===$('cartModal'))$('cartModal').classList.remove('open')};
$('cartClear').onclick=()=>{cart=[];saveCart()};
$('cartSend').onclick=()=>{
 const it=cartItems();if(!it.length)return toast('Cart is empty');
 const num=waNumber();if(!num)return toast('Seller WhatsApp number is not set yet');
 const t='Hi Zinomi Movie Hub! I want to order these films:\n\n'+it.map((m,i)=>(i+1)+'. 🎬 '+m.name+(m.year?' ('+m.year+')':'')+(m.quality?' – '+m.quality:'')+' – '+money(effP(m))).join('\n')+'\n\n💰 Total: '+money(it.reduce((a,m)=>a+effP(m),0));
 window.open('https://wa.me/'+num+'?text='+encodeURIComponent(t),'_blank');
};
$('modalCartBtn').onclick=()=>activeModalId&&addCart(activeModalId);

/* rows: new arrivals, best sellers, sale, genres */
function tile(m){return `<div class="t" onclick="openMovieModal('${m.id}')"><div class="tp">${m.poster?`<img src="${m.poster}" loading="lazy" alt="">`:(isSeries(m)?'📺':'🎬')}${m.isNew?'<span class="zx-new">NEW</span>':''}${onSale(m)?`<span class="sale">-${Math.round(100-effP(m)/m.price*100)}%</span>`:''}</div><div class="tn">${escapeHTML(m.name)}</div><div class="tm">${m.price?money(effP(m)):''}</div></div>`}
function renderRows(){
 const av=cur().filter(m=>stOf(m)!=='sold');
 const rows=[['🏷 On Sale',av.filter(onSale)],['🏆 Best Sellers',cur().filter(m=>stOf(m)==='sold').sort((a,b)=>(b.soldAt||0)-(a.soldAt||0)).slice(0,14)]];
 [...new Set(av.map(m=>m.genre).filter(Boolean))].forEach(g=>{const l=av.filter(m=>m.genre===g);if(l.length>=2)rows.push([g,l.slice(0,14)])});
 $('moreRows').innerHTML=rows.filter(r=>r[1].length).map(r=>`<div class="row-title">${escapeHTML(r[0])}</div><div class="pop">${r[1].map(tile).join('')}</div>`).join('');
 const b=bundleText();$('bundleBar').hidden=!b;$('bundleBar').textContent=b;
}
const _rm3=renderMovies;renderMovies=function(){_rm3();renderRows();renderCart()};

/* share image */
function loadImg(src){return new Promise((res,rej)=>{const i=new Image();i.crossOrigin='anonymous';i.onload=()=>res(i);i.onerror=rej;i.src=src})}
async function shareImage(id){
 const m=movies.find(x=>x.id===id);if(!m)return;
 try{await document.fonts.load('700 50px Poppins')}catch(e){}
 const c=document.createElement('canvas');c.width=1080;c.height=1350;const x=c.getContext('2d');
 x.fillStyle='#0c0b0a';x.fillRect(0,0,1080,1350);
 const g=x.createRadialGradient(540,0,40,540,0,950);g.addColorStop(0,'#e0993a66');g.addColorStop(1,'#e0993a00');x.fillStyle=g;x.fillRect(0,0,1080,1350);
 x.textAlign='center';x.fillStyle='#e0993a';x.font='600 30px Poppins,sans-serif';x.fillText('ZINOMI MOVIE HUB',540,70);
 const pw=520,ph=780,px=280,py=105;
 x.save();x.beginPath();x.roundRect?x.roundRect(px,py,pw,ph,28):x.rect(px,py,pw,ph);x.clip();
 x.fillStyle='#171412';x.fillRect(px,py,pw,ph);
 if(m.poster){try{const i=await loadImg(m.poster),r=Math.max(pw/i.width,ph/i.height),w=i.width*r,h=i.height*r;x.drawImage(i,px+(pw-w)/2,py+(ph-h)/2,w,h)}catch(e){}}
 x.restore();
 let fs=60;x.fillStyle='#fff';do{x.font='700 '+fs+'px Poppins,sans-serif';fs-=2}while(x.measureText(m.name).width>960&&fs>28);
 x.fillText(m.name,540,980);
 x.fillStyle='#b8aea4';x.font='500 30px Poppins,sans-serif';
 x.fillText([m.year,m.genre,m.language,m.quality].filter(Boolean).join('  ·  '),540,1035);
 if(m.price){x.fillStyle='#f2b25c';x.font='700 76px Poppins,sans-serif';x.fillText(money(effP(m)),540,1150);
  if(onSale(m)){x.fillStyle='#8a817a';x.font='500 32px Poppins,sans-serif';const t=money(m.price),w=x.measureText(t).width;x.fillText(t,540,1200);x.fillRect(540-w/2,1190,w,3)}}
 x.fillStyle='#1fa855';x.font='600 34px Poppins,sans-serif';
 x.fillText(waNumber()?'💬 WhatsApp: +'+waNumber():'💬 Order on WhatsApp',540,1300);
 c.toBlob(async b=>{
  if(!b)return toast('Could not create image');
  const file=new File([b],m.name.replace(/[^\w]+/g,'-')+'.png',{type:'image/png'});
  if(navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],title:m.name});return}catch(e){}}
  const a=document.createElement('a'),u=URL.createObjectURL(b);a.href=u;a.download=file.name;a.click();URL.revokeObjectURL(u);toast('Image downloaded – post it on WhatsApp / Facebook');
 },'image/png');
}
$('modalShareBtn').onclick=()=>activeModalId&&shareImage(activeModalId);

/* TMDB auto-fill */
const GEN={10759:'Action',10765:'Sci-Fi',10768:'War',10764:'Reality',10766:'Drama',28:'Action',12:'Adventure',16:'Animation',35:'Comedy',80:'Crime',99:'Documentary',18:'Drama',10751:'Family',14:'Fantasy',36:'History',27:'Horror',10402:'Music',9648:'Mystery',10749:'Romance',878:'Sci-Fi',53:'Thriller',10752:'War',37:'Western'};
const LANG={en:'English',hi:'Hindi',ta:'Tamil',ml:'Malayalam',ko:'Korean',ja:'Japanese',si:'Sinhala',te:'Telugu',zh:'Chinese'};
async function tm(path,key){
 const bearer=key.startsWith('eyJ');
 const r=await fetch('https://api.themoviedb.org/3'+path+(bearer?'':(path.includes('?')?'&':'?')+'api_key='+encodeURIComponent(key)),bearer?{headers:{Authorization:'Bearer '+key}}:{});
 if(!r.ok)throw Error('tmdb');return r.json();
}
$('autoFillBtn').onclick=async()=>{
 const key=lsGet('ztmdb');if(!key){toast('Add your free TMDB key in ⚙ Settings first');openSettings();return}
 const q=$('movieName').value.trim();if(!q)return toast('Enter a movie title first');
 toast('Searching TMDB…');
 try{
  const y=$('movieYear').value;
  const tv=$('itemType').value==='series',r=await tm('/search/'+(tv?'tv':'movie')+'?query='+encodeURIComponent(q)+(y?(tv?'&first_air_date_year=':'&year=')+y:''),key),m=r.results&&r.results[0];
  if(!m)return toast('No match found – check the title');
  if(!$('movieYear').value)$('movieYear').value=(m.release_date||m.first_air_date||'').slice(0,4);
  if(!$('movieGenre').value)$('movieGenre').value=(m.genre_ids||[]).map(i=>GEN[i]).find(Boolean)||'';
  if(!$('movieLanguage').value)$('movieLanguage').value=LANG[m.original_language]||'';
  if(!$('movieDescription').value)$('movieDescription').value=m.overview||'';
  try{const v=await tm('/'+(tv?'tv':'movie')+'/'+m.id+'/videos',key),t=(v.results||[]).find(x=>x.site==='YouTube'&&x.type==='Trailer')||(v.results||[]).find(x=>x.site==='YouTube');if(t)$('trailerUrl').value='https://www.youtube.com/watch?v='+t.key}catch(e){}
  if(m.poster_path){
   const u='https://image.tmdb.org/t/p/w500'+m.poster_path;
   try{const b=await(await fetch(u)).blob();posterData=await compressImage(new File([b],'p.jpg',{type:b.type||'image/jpeg'}));setPreview(posterData)}
   catch(e){$('posterUrl').value=u;setPreview(u)}
  }
  toast('Filled from TMDB ✔ – check & save');
 }catch(e){toast('Auto-fill failed – check your key / internet')}
};

/* ===== CHOOSE POPULAR / NEW ARRIVALS ===== */
$('heroPrev').onclick=()=>{const n=heroList().length||1;heroIdx=(heroIdx-1+n)%n;renderHero()};
$('heroNext').onclick=()=>{heroIdx=(heroIdx+1)%(heroList().length||1);renderHero()};
$('heroTrailer').onclick=()=>trailer(heroCur());
async function toggleFlag(id,key,label){
 const m=movies.find(x=>x.id===id);if(!m)return;
 m[key]=!m[key];m.updated=Date.now();await put('movies',m);await refresh();
 toast((m[key]?'Added to ':'Removed from ')+label);
 if(activeModalId===id)modalFlags();
}
function modalFlags(){
 const m=movies.find(x=>x.id===activeModalId);if(!m)return;
 $('modalPopBtn').textContent=m.popular?'⭐ Remove from Popular':'⭐ Add to Popular';
 $('modalNewBtn').textContent=m.isNew?'🔥 Remove from New':'🔥 Add to New Arrivals';
}
const _om=openMovieModal;openMovieModal=function(id,t){_om(id,t);modalFlags()};
$('modalPopBtn').onclick=()=>toggleFlag(activeModalId,'popular','Popular Movies');
$('modalNewBtn').onclick=()=>toggleFlag(activeModalId,'isNew','New Arrivals');
$('heroPopBtn').onclick=()=>{const m=heroCur();m?toggleFlag(m.id,'popular','Popular Movies'):toast('Add a film first')};
const _rh=renderHero;renderHero=function(){_rh();const m=heroCur();if(m)$('heroPopBtn').textContent=m.popular?'⭐ Remove from Popular':'⭐ Add to Popular'};
const _rr=renderRows;renderRows=function(){
 _rr();
 const av=cur().filter(m=>stOf(m)!=='sold'),fl=av.filter(m=>m.isNew);
 if(fl.length){const h=[...$('moreRows').querySelectorAll('.row-title')].find(e=>e.textContent.includes('New Arrivals'));
  if(h)h.nextElementSibling.innerHTML=fl.sort((a,b)=>(b.created||0)-(a.created||0)).map(tile).join('')}
};

/* ===== TV SERIES SECTION ===== */
function renumber(){[...$('seasonRows').children].forEach((r,i)=>r.firstChild.textContent='Season '+pad2(i+1))}
function addSeasonRow(ep,total){
 const r=document.createElement('div');r.className='srow';
 r.innerHTML='<span></span><input type="number" class="s-ep" min="0" max="9999" placeholder="Episodes completed"><input type="number" class="s-tot" min="0" max="9999" placeholder="Total eps (optional)"><button type="button" class="btn small danger" title="Remove season">✕</button>';
 r.querySelector('.s-ep').value=ep||'';r.querySelector('.s-tot').value=total||'';
 r.querySelector('button').onclick=()=>{r.remove();renumber()};
 $('seasonRows').appendChild(r);renumber();
}
function loadSeasons(l){$('seasonRows').innerHTML='';(l||[]).forEach(x=>addSeasonRow(x.ep,x.total))}
function curSeasons(){
 if($('itemType').value!=='series')return [];
 return [...$('seasonRows').children].map((r,i)=>({n:i+1,ep:Number(r.querySelector('.s-ep').value)||0,total:Number(r.querySelector('.s-tot').value)||0}));
}
$('addSeasonBtn').onclick=()=>{addSeasonRow();const l=$('seasonRows').lastChild;l&&l.querySelector('.s-ep').focus()};
function typeUI(){const sr=$('itemType').value==='series';if(sr&&!$('seasonRows').children.length)addSeasonRow();$('seriesFields').style.display=sr?'':'none';$('formHeading').textContent=($('movieId').value?'Edit ':'Add a ')+(sr?'TV Series':'Movie');$('saveMovie').textContent=($('movieId').value?'Update ':'Save ')+(sr?'Series':'Movie');document.querySelector('label[for="movieName"]').textContent=sr?'SERIES TITLE *':'MOVIE TITLE *'}
$('itemType').onchange=typeUI;
const _rf=resetForm;resetForm=function(){_rf();$('seasonRows').innerHTML='';$('itemType').value=mode;typeUI()};
function syncTabs(){
 const lib=$('library').classList.contains('active');
 document.querySelectorAll('.tab[data-mode]').forEach(b=>b.classList.toggle('active',lib&&b.dataset.mode===mode));
 document.querySelectorAll('.side [data-mode]').forEach(b=>b.classList.toggle('on',lib&&b.dataset.mode===mode));
 document.querySelectorAll('.side [data-go="library"]').forEach((b,i)=>b.classList.toggle('on',lib&&mode==='movie'&&i===0));
}
const _st4=showTab;showTab=function(id){_st4(id);syncTabs()};
function setMode(m){
 mode=m;heroIdx=0;limit=60;favOnly=false;$('favFilter').classList.remove('on');
 $('search').value='';$('genreFilter').value='';$('langFilter').value='';$('statusFilter').value='';$('subFilter').value='';$('minRatingFilter').value='';
 const sr=m==='series';
 $('search').placeholder=sr?'⌕ Search title, genre, language, quality, year…':'⌕ Search title, genre, language, quality, year…';
 $('quickAdd').textContent=sr?'＋ Add Series':'＋ Add Film';
 document.querySelector('.tab[data-tab="add"]').textContent=sr?'Add Series':'Add Film';
 document.querySelector('.live').textContent=sr?'● Now Streaming':'● Now Showing';
 $('heroAdd').title=sr?'Add series':'Add film';
 updateFilters();renderMovies();showTab('library');window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
document.querySelectorAll('.side [data-go="library"]').forEach(b=>b.onclick=()=>setMode('movie'));
$('heroAdd').onclick=()=>{resetForm();showTab('add')};
$('quickAdd').onclick=()=>{resetForm();showTab('add')};
syncTabs();

/* ===== BULK SELECT + NOT-CHECKED COUNTER ===== */
let selMode=false;const picked=new Set();
function applySel(){
 document.body.classList.toggle('selmode',selMode);
 $('selBar').hidden=!selMode;$('selModeBtn').classList.toggle('on',selMode);
 document.querySelectorAll('#movieGrid .movie').forEach(a=>a.classList.toggle('picked',picked.has(a.dataset.id)));
 $('selCount').textContent=picked.size+' selected';
 const n=cur().filter(m=>subOf(m)==='unk').length;$('unkChip').textContent='❔ Not checked ('+n+')';$('unkChip').classList.toggle('on',$('subFilter').value==='unk');
}
const _rmSel=renderMovies;renderMovies=function(){_rmSel();applySel()};
$('movieGrid').addEventListener('click',e=>{
 if(!selMode)return;const a=e.target.closest('.movie');if(!a)return;
 e.stopPropagation();e.preventDefault();
 picked.has(a.dataset.id)?picked.delete(a.dataset.id):picked.add(a.dataset.id);applySel();
},true);
$('selModeBtn').onclick=()=>{selMode=!selMode;if(!selMode)picked.clear();applySel()};
$('selDone').onclick=()=>{selMode=false;picked.clear();applySel()};
$('selAll').onclick=()=>{document.querySelectorAll('#movieGrid .movie').forEach(a=>picked.add(a.dataset.id));applySel()};
async function bulkSub(v){
 if(!picked.size)return toast('Select some movies first');
 for(const id of picked){const m=movies.find(x=>x.id===id);if(m){m.sinSub=v;m.updated=Date.now();await put('movies',m)}}
 const n=picked.size;picked.clear();await refresh();toast(n+' updated');
}
$('selYes').onclick=()=>bulkSub('yes');$('selNo').onclick=()=>bulkSub('no');$('selUnk').onclick=()=>bulkSub('');
$('subOnlyChip').onclick=()=>{$('subFilter').value=$('subFilter').value==='yes'?'':'yes';limit=60;renderMovies()};
$('subFilter').addEventListener('change',applySel);
const _as=applySel;applySel=function(){_as();$('subOnlyChip').classList.toggle('on',$('subFilter').value==='yes')};
$('unkChip').onclick=()=>{$('subFilter').value=$('subFilter').value==='unk'?'':'unk';limit=60;renderMovies()};

/* sales report */
function sumRev(l){return l.reduce((t,m)=>t+(m.soldPrice??m.price??0),0)}
$('reportBtn').onclick=()=>{
 const sold=movies.filter(m=>stOf(m)==='sold'),now=new Date(),t0=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime(),
  wk=t0-6*864e5,mo=new Date(now.getFullYear(),now.getMonth(),1).getTime(),
  per=(a)=>sold.filter(m=>(m.soldAt||0)>=a),
  row=(n,l)=>`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)"><span>${n}</span><span><b style="color:var(--gold-bright)">${money(sumRev(l))}</b> <span style="color:var(--muted)">· ${l.length} sold</span></span></div>`,
  g={};sold.forEach(m=>{if(m.genre)g[m.genre]=(g[m.genre]||0)+1});
  const top=Object.entries(g).sort((a,b)=>b[1]-a[1])[0],
  recent=[...sold].sort((a,b)=>(b.soldAt||0)-(a.soldAt||0)).slice(0,5);
 $('repBody').innerHTML=row('Today',per(t0))+row('Last 7 days',per(wk))+row('This month',per(mo))+row('All time',sold)+
  `<div style="margin-top:12px;color:var(--muted)">Best-selling genre: <b style="color:var(--text)">${top?escapeHTML(top[0])+' ('+top[1]+')':'–'}</b></div>`+
  (recent.length?'<div style="margin-top:12px;font-weight:700">Recent sales</div>'+recent.map(m=>`<div style="display:flex;justify-content:space-between;padding:5px 0;color:var(--muted)"><span>${escapeHTML(m.name)}${m.buyer?' · '+escapeHTML(m.buyer):''}</span><span>${money(m.soldPrice??m.price)}</span></div>`).join(''):'<div style="margin-top:12px;color:var(--muted)">No sales yet.</div>');
 $('repModal').classList.add('open');
};
$('repClose').onclick=()=>$('repModal').classList.remove('open');
$('repModal').onclick=e=>{if(e.target===$('repModal'))$('repModal').classList.remove('open')};

/* price presets */
document.querySelectorAll('[data-price]').forEach(b=>b.onclick=()=>{$('moviePrice').value=b.dataset.price});

/* backup reminder */
function bkNote(){
 const t=Number(lsGet('zlastbk'))||0,d=t?Math.floor((Date.now()-t)/864e5):null;
 let el=$('bkInfo');if(!el){el=document.createElement('div');el.id='bkInfo';el.style.cssText='margin-top:6px;font-family:var(--font-mono);font-size:11px';$('storageInfo').after(el)}
 el.textContent=t?'LAST BACKUP: '+(d===0?'today':d+' day(s) ago'):'LAST BACKUP: never – tap Backup!';
 el.style.color=(!t||d>=7)?'#ff7b89':'';
}
$('backupBtn').addEventListener('click',()=>{lsSet('zlastbk',Date.now());bkNote()});
setTimeout(()=>{bkNote();const t=Number(lsGet('zlastbk'))||0;if(document.body.classList.contains('admin')&&movies.length&&(!t||Date.now()-t>7*864e5))toast('⚠ Backup is old – tap Backup to save your data')},1500);

(async()=>{
 try{db=await openDB();await refresh()}
 catch(e){alert('Your browser could not open local storage. Please use Chrome, Edge, or Opera with site storage enabled.')}
})();

;(()=>{
const $=id=>document.getElementById(id),clk=e=>{e=typeof e==='string'?$(e)||document.querySelector(e):e;if(e)e.click()};
const adm=()=>document.body.classList.contains('admin');
/* ACCENT PICKER */
const ACC=[['Cinema',null,null],['Gold','#e0993a','#f2b25c'],['Crimson','#e63946','#ff6b78'],['Violet','#9b7bff','#c0a8ff'],['Rose','#f2668b','#ff9bb5']];
let ai=0;try{ai=(+localStorage.getItem('zm_accent')||0)%ACC.length}catch{}
const ab=document.createElement('button');ab.className='btn';ab.id='accBtn';
function applyAcc(){const a=ACC[ai],r=document.documentElement.style;
 if(a[1]){r.setProperty('--gold',a[1]);r.setProperty('--gold-bright',a[2])}else{r.removeProperty('--gold');r.removeProperty('--gold-bright')}
 ab.innerHTML='<i class="zx-sw"></i> '+a[0]}
ab.onclick=()=>{ai=(ai+1)%ACC.length;try{localStorage.setItem('zm_accent',ai)}catch{}applyAcc()};
$('adminBtn').before(ab);applyAcc();
/* COMMAND PALETTE */
const pal=document.createElement('div');pal.id='zxPal';pal.innerHTML='<div class="bx"><input id="zxQ" placeholder="Search movies, series or type a command…" autocomplete="off"><ul id="zxL"></ul><div class="ft">↑↓ navigate · Enter select · Esc close · Ctrl+K</div></div>';document.body.append(pal);
const Q=$('zxQ'),L=$('zxL');let items=[],sel=0;
const fz=(q,t)=>{q=q.toLowerCase();t=String(t||'').toLowerCase();if(!q)return 1;const i=t.indexOf(q);if(i>=0)return 100-i;let p=0,s=0;for(const c of q){const j=t.indexOf(c,p);if(j<0)return 0;s+=j===p?3:1;p=j+1}return s/(t.length||1)+.1};
const cmds=()=>{const c=[['Movies',()=>setMode('movie')],['TV Series',()=>setMode('series')],['Open cart',()=>clk('cartFab')],['Change accent colour',()=>ab.click()]];
 if(adm())c.push(['Add film / series',()=>clk('quickAdd')],['Notes & Orders',()=>showTab('notes')],['Find duplicates',()=>clk('dupBtn')],['Report',()=>clk('reportBtn')],['Backup',()=>clk('backupBtn')],['Price list (CSV)',()=>clk('exportCsvBtn')],['Settings',()=>clk('settingsBtn')]);return c};
function build(){const q=Q.value.trim();items=[];
 for(const [n,f] of cmds()){const s=fz(q,n);if(s)items.push({s:s+(q?0:50),t:n,h:'command',f})}
 if(q)for(const m of movies){const s=Math.max(fz(q,m.name),fz(q,[m.genre,m.language,m.year].join(' '))*.6);if(s)items.push({s,t:m.name||'Untitled',h:[isSeries(m)?'Series':'Film',m.year,m.genre].filter(Boolean).join(' · '),f:()=>{if(inMode(m)===false)setMode(isSeries(m)?'series':'movie');openMovieModal(m.id)}})}
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
 if(document.querySelector('.modal-backdrop.open'))return;
 const k=e.key;
 if(k==='/'){e.preventDefault();showTab('library');$('search').focus()}
 else if(k.toLowerCase()==='n'&&adm()){e.preventDefault();clk('quickAdd')}
 else if(k==='1')setMode('movie');else if(k==='2')setMode('series');else if(k==='3'&&adm())showTab('notes');
});
/* MOBILE BOTTOM NAV */
const nv=document.createElement('nav');nv.id='zxNav';
[['movie','🎬','Movies',()=>setMode('movie'),''],['series','📺','Series',()=>setMode('series'),''],['find','🔍','Find',openPal,''],['cart','🛒','Cart',()=>clk('cartFab'),''],['add','➕','Add',()=>clk('quickAdd'),'adm'],['notes','📒','Orders',()=>showTab('notes'),'adm']].forEach(([id,ic,lb,f,c])=>{const b=document.createElement('button');b.dataset.n=id;if(c)b.className=c;b.innerHTML='<i>'+ic+'</i>'+lb;b.onclick=f;nv.append(b)});
document.body.append(nv);
function hl(){const t=document.querySelector('.panel.active'),id=t&&t.id;nv.querySelectorAll('button').forEach(b=>b.classList.toggle('on',id==='library'?b.dataset.n===mode:b.dataset.n===id))}
const _sm=setMode;setMode=function(m){_sm(m);hl()};const _st=showTab;showTab=function(t){_st(t);hl()};hl();
/* DUPLICATE FINDER */
const db2=document.createElement('button');db2.className='btn adm';db2.id='dupBtn';db2.textContent='🧩 Duplicates';$('reportBtn').before(db2);
const dm=document.createElement('div');dm.className='modal-backdrop';dm.id='zxDupM';dm.innerHTML='<div class="tr-card" style="max-width:560px"><div class="tr-bar"><b>🧩 Duplicate titles</b><button class="btn small" id="zxDupX">✕ Close</button></div><div id="zxDupL" style="max-height:60vh;overflow:auto"></div></div>';document.body.append(dm);
$('zxDupX').onclick=()=>dm.classList.remove('open');dm.onclick=e=>{if(e.target===dm)dm.classList.remove('open')};
function dups(){const box=$('zxDupL');box.replaceChildren();
 const g={};for(const m of movies){const k=(isSeries(m)?'s':'m')+(m.name||'').toLowerCase().replace(/\b(the|a|an)\b/g,'').replace(/[^a-z0-9]/g,'')+(m.year||'');if(k.length>2)(g[k]=g[k]||[]).push(m)}
 const gr=Object.values(g).filter(a=>a.length>1);let rec=0;
 if(!gr.length){const d=document.createElement('div');d.className='zx-dup';d.textContent='No duplicates found 👍';box.append(d);return}
 for(const a of gr){const t=document.createElement('div');t.style.cssText='font-weight:700;margin-top:12px;color:var(--gold-bright)';t.textContent=a[0].name+(a[0].year?' ('+a[0].year+')':'');box.append(t);
  const mx=Math.max(...a.map(m=>+m.size||0));
  for(const m of a){const r=document.createElement('div'),l=document.createElement('span'),s=document.createElement('small'),b=document.createElement('button');r.className='zx-dup';
   l.textContent=[m.quality,m.language,m.size?m.size+' GB':'',stOf(m)].filter(Boolean).join(' · ')||'No details';s.textContent=m.price?money(m.price):'';l.append(s);
   b.className='btn small danger';b.textContent='🗑️';b.onclick=async()=>{await removeMovie(m.id);dups()};r.append(l,b);box.append(r)}
  rec+=a.reduce((x,m)=>x+(+m.size||0),0)-mx}
 const f=document.createElement('div');f.className='zx-dup';f.style.fontWeight='600';f.textContent='Groups: '+gr.length+(rec?' · extra space used: '+rec.toFixed(1)+' GB':'');box.append(f)}
db2.onclick=()=>{dups();dm.classList.add('open')};
/* DRAG A TITLE ONTO A STATUS */
const dock=document.createElement('div');dock.id='zxDock';document.body.append(dock);let dragId=null;
const _rm=renderMovies;renderMovies=function(){_rm();if(adm())document.querySelectorAll('#movieGrid .movie').forEach(c=>{c.draggable=true;c.ondragstart=e=>{dragId=c.dataset.id;e.dataTransfer.setData('text/plain',dragId);e.dataTransfer.effectAllowed='move';buildDock()};c.ondragend=()=>dock.classList.remove('show')})};
function buildDock(){dock.replaceChildren();const h=document.createElement('b');h.textContent='Drop to change status';dock.append(h);
 for(const [k,lb] of [['available','✅ Available'],['reserved','⏳ Reserved'],['sold','💰 Sold']]){const s=document.createElement('span');s.textContent=lb;
  s.ondragover=e=>{e.preventDefault();s.classList.add('over')};s.ondragleave=()=>s.classList.remove('over');
  s.ondrop=async e=>{e.preventDefault();dock.classList.remove('show');const m=movies.find(x=>x.id===dragId);if(!m||stOf(m)===k)return;
   if(k==='sold'){await sellMovie(m.id);return}
   delete m.soldPrice;delete m.buyer;delete m.soldAt;m.status=k;m.updated=Date.now();await put('movies',m);await refresh();toast((m.name||'Title')+' → '+k)};dock.append(s)}
 dock.classList.add('show')}
try{if(movies.length)renderMovies()}catch{}
})();

;(()=>{
const hb=document.querySelector('.header-actions'),sr=$('search');hb.prepend(sr);sr.onfocus=()=>{if(!document.querySelector('#library.active'))showTab('library')};
const ph=()=>{sr.placeholder='Search'};ph();
const _sm=setMode;setMode=function(m){_sm(m);ph()};
const gb=document.createElement('div');gb.className='zx-genres';$('heroTitle').before(gb);
const hf=document.createElement('button');hf.id='zxHeart';hf.className='btn adm';hf.title='Favorite';hf.onclick=()=>{const m=heroCur();if(m)toggleFav(m.id)};document.querySelector('.hero-btns').append(hf);
const _rh=renderHero;renderHero=function(){_rh();const m=heroCur();gb.replaceChildren();
 if(m&&m.genre)String(m.genre).split(/[,/|·]+/).map(x=>x.trim()).filter(Boolean).slice(0,3).forEach(x=>{const c=document.createElement('span');c.className='zx-gc';c.textContent=x;gb.append(c)});
 hf.textContent=m&&m.fav?'♥':'♡';hf.classList.toggle('on',!!(m&&m.fav))};
try{if(movies.length)renderHero()}catch{}
})();

;(()=>{
const ha=document.querySelector('.header-actions'),w=document.createElement('div');w.className='zx-tools adm';
const tb=document.createElement('button');tb.className='btn';tb.textContent='⋯ Tools';
const mn=document.createElement('div');mn.id='zxMenu';
['publishBtn','settingsBtn','exportCsvBtn','dupBtn','reportBtn','backupBtn','restoreBtn'].forEach(id=>{const b=$(id);if(b)mn.append(b)});
w.append(tb,mn);ha.append(w);
tb.onclick=e=>{e.stopPropagation();mn.classList.toggle('open')};
mn.onclick=()=>mn.classList.remove('open');
document.addEventListener('click',e=>{if(!w.contains(e.target))mn.classList.remove('open')});
addEventListener('keydown',e=>{if(e.key==='Escape')mn.classList.remove('open')});
})();

;(()=>{
const LSg=k=>{try{return localStorage.getItem(k)}catch{return null}},LSs=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
const bk=document.createElement('div');bk.className='zx-bk adm admin';bk.hidden=true;
bk.innerHTML='<span id="zxBkT"></span><button class="btn" id="zxBkB">Back up now</button><button class="x" title="Remind me tomorrow">✕</button>';
$('homeTop').after(bk);
$('zxBkB').onclick=()=>$('backupBtn').click();
bk.querySelector('.x').onclick=()=>{LSs('zm_snz',Date.now());bk.hidden=true};
$('backupBtn').addEventListener('click',()=>{LSs('zm_lastbk',Date.now());bk.hidden=true});
function bkCheck(n){const t=+LSg('zm_lastbk')||0,sn=+LSg('zm_snz')||0,d=Math.floor((Date.now()-t)/864e5);
 const show=n>0&&(!t||d>=7)&&Date.now()-sn>864e5;bk.hidden=!show;
 if(show)$('zxBkT').textContent=t?'⚠ Last backup was '+d+' days ago. Your data is saved only in this browser.':'⚠ You have never backed up. Your data is saved only in this browser.'}
const chips=document.createElement('div');chips.className='zx-chips';document.querySelector('#library .toolbar').before(chips);
function chipsUpd(){const gf=$('genreFilter');if(!gf)return;chips.replaceChildren();
 [...gf.options].forEach(o=>{const b=document.createElement('button');b.className='zx-c2'+(gf.value===o.value?' on':'');b.textContent=o.value?o.text:'All';
  b.onclick=()=>{gf.value=o.value;gf.dispatchEvent(new Event('change'))};chips.append(b)});chips.hidden=gf.options.length<3}

/* ===== PER-MOVIE BACKGROUND BUTTONS ===== */
(function(){
 const css=document.createElement('style');css.textContent='#zxBgChg,#zxBgClr{background:#2e2e33!important;color:#fff!important;border:0!important;border-radius:10px!important;height:44px;padding:0 18px;font-weight:700;box-shadow:none!important}#zxBgClr{width:44px;padding:0;justify-content:center;font-size:18px}#zxBgChg:hover,#zxBgClr:hover{background:#3b3b41!important}';
 document.head.append(css);
 const box=document.querySelector('.hero-btns');
 const chg=document.createElement('button');chg.id='zxBgChg';chg.className='btn adm';chg.textContent='🖼 Change background';
 const clr=document.createElement('button');clr.id='zxBgClr';clr.className='btn adm';clr.textContent='✕';clr.title='Remove this movie\'s background';
 const file=document.createElement('input');file.type='file';file.accept='image/*';file.hidden=true;
 box.append(chg,clr,file);
 let target=null;
 chg.onclick=()=>{target=heroCur();if(!target)return toast('Add a film first');file.click()};
 file.onchange=e=>{const f=e.target.files[0];e.target.value='';const m=target;if(!f||!m)return;
  const url=URL.createObjectURL(f),img=new Image();
  img.onload=async()=>{const max=1600,sc=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');
   c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);
   m.herobg=c.toDataURL('image/jpeg',0.82);m.updated=Date.now();
   try{await put('movies',m);await refresh();toast('Background saved for "'+m.name+'" ✔ (press ⬆ Publish for your live site)')}catch(err){toast('Could not save the image')}};
  img.onerror=()=>{URL.revokeObjectURL(url);toast('Could not read that image')};img.src=url};
 clr.onclick=async()=>{const m=heroCur();if(!m||!m.herobg)return;m.herobg='';m.updated=Date.now();await put('movies',m);await refresh();toast('Background removed')};
 const _rh4=renderHero;
 renderHero=function(){_rh4();const m=heroCur();clr.style.display=m&&m.herobg?'':'none'};
 try{renderHero()}catch{}
})();

/* ===== CUSTOM HERO BACKGROUND (same image behind all movies) ===== */
const heroBgUrl=()=>lsGet('zherobg')||(remote&&remote.herobg)||'';
function applyHeroBg(){const hm=heroCur(),u=(hm&&hm.herobg)||heroBgUrl();if(u)$('heroBg').style.backgroundImage='url("'+u.replace(/"/g,'%22')+'")'}
(function(){
 const _rh3=renderHero;
 renderHero=function(){_rh3();applyHeroBg()};
 const css=document.createElement('style');css.textContent='#zxBgPrev{height:90px;border-radius:10px;background:#171412 center/cover no-repeat;border:1px solid #ffffff18;margin-bottom:8px;display:grid;place-items:center;color:#8a8178;font-size:12px}.zx-bgrow{display:flex;gap:8px;flex-wrap:wrap}';
 document.head.append(css);
 const f=document.createElement('div');f.className='field';
 f.innerHTML='<label>TOP BACKGROUND IMAGE (same image behind all movies)</label><div id="zxBgPrev">No custom background</div><input id="zxBgUrl" placeholder="Paste image link (https://...)"><div class="zx-bgrow" style="margin-top:8px"><button type="button" class="btn" id="zxBgPick">📁 Upload image</button><button type="button" class="btn" id="zxBgUse">Use link</button><button type="button" class="btn" id="zxBgDel">✕ Remove</button></div><input type="file" id="zxBgFile" accept="image/*" hidden>';
 $('setPin').closest('.field').before(f);
 const prev=()=>{const u=lsGet('zherobg')||'';$('zxBgPrev').style.backgroundImage=u?'url("'+u.replace(/"/g,'%22')+'")':'none';$('zxBgPrev').textContent=u?'':'No custom background';$('zxBgUrl').value=u&&!u.startsWith('data:')?u:''};
 const save=u=>{try{if(u)localStorage.setItem('zherobg',u);else localStorage.removeItem('zherobg')}catch(e){toast('Image too big for browser storage. Use a smaller image or paste a link.');return false}
  prev();applyHeroBg();if(!u)renderHero();toast(u?'Background saved ✔ (press ⬆ Publish to show it on your live site)':'Background removed');return true};
 const _os=openSettings;openSettings=function(){_os();prev()};
 $('settingsBtn').onclick=()=>openSettings();
 $('zxBgPick').onclick=()=>$('zxBgFile').click();
 $('zxBgFile').onchange=e=>{const file=e.target.files[0];e.target.value='';if(!file)return;
  const url=URL.createObjectURL(file),img=new Image();
  img.onload=()=>{const max=1600,sc=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement('canvas');
   c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);
   save(c.toDataURL('image/jpeg',0.8))};
  img.onerror=()=>{URL.revokeObjectURL(url);toast('Could not read that image')};img.src=url};
 $('zxBgUse').onclick=()=>{const u=$('zxBgUrl').value.trim();if(!/^https?:\/\//i.test(u))return toast('Paste a full image link starting with https://');save(u)};
 $('zxBgDel').onclick=()=>save('');
})();

/* ===== HERO AUTO-SLIDE WITH ANIMATION ===== */
(function(){
 const css=document.createElement('style');css.textContent=`
@keyframes zxBgIn{from{transform:scale(1.14);filter:saturate(1.1) brightness(.25) blur(8px)}to{transform:scale(1);filter:saturate(1.1) brightness(1) blur(0)}}
@keyframes zxTxtIn{from{opacity:0;transform:translateX(-46px)}to{opacity:1;transform:none}}
@keyframes zxPosterIn{from{opacity:0;transform:translateX(70px) scale(.9) rotate(2deg)}to{opacity:1;transform:none}}
@keyframes zxProg{from{transform:scaleX(0)}to{transform:scaleX(1)}}
#hero .bg.zx-anim{animation:zxBgIn 1.1s cubic-bezier(.22,.8,.3,1) both}
#hero .hero-text.zx-anim{animation:zxTxtIn .8s cubic-bezier(.22,.8,.3,1) .15s both}
#hero .hero-poster.zx-anim{animation:zxPosterIn .9s cubic-bezier(.22,.8,.3,1) .25s both}
#hero .zx-prog{position:absolute;left:0;bottom:0;height:3px;width:100%;z-index:5;background:linear-gradient(90deg,#e0993a,#ffd08a);transform-origin:left;transform:scaleX(0);pointer-events:none}
#hero .zx-prog.run{animation:zxProg 8s linear forwards}
#hero:hover .zx-prog.run{animation-play-state:paused}
@media(prefers-reduced-motion:reduce){#hero .zx-anim,#hero .zx-prog{animation:none!important}}
`;document.head.append(css);
 const hero=$('hero'),prog=document.createElement('div');prog.className='zx-prog';hero.append(prog);
 const re=(el,c)=>{el.classList.remove(c);void el.offsetWidth;el.classList.add(c)};
 let lastKey=null;
 const _rh2=renderHero;
 renderHero=function(){
  _rh2();
  const m=heroCur(),key=m?m.id+'|'+mode:'none';
  if(key===lastKey)return;
  lastKey=key;
  {const hm=heroCur();if(!heroBgUrl()||(hm&&hm.herobg))re($('heroBg'),'zx-anim')}re(document.querySelector('#hero .hero-text'),'zx-anim');re($('heroPoster'),'zx-anim');
  prog.classList.remove('run');void prog.offsetWidth;
  if(heroList().length>1&&!matchMedia('(prefers-reduced-motion:reduce)').matches)prog.classList.add('run');
 };
 prog.addEventListener('animationend',()=>{
  const l=heroList();
  const busy=document.hidden||!$('library').classList.contains('active')||document.querySelector('.modal-backdrop.open');
  if(l.length<2||busy){prog.classList.remove('run');void prog.offsetWidth;prog.classList.add('run');return}
  heroIdx=(heroIdx+1)%l.length;renderHero();
 });
 try{if(movies.length){lastKey=null;renderHero()}}catch{}
})();
const _rm=renderMovies;renderMovies=function(){_rm();try{chipsUpd();bkCheck(movies.length)}catch{}};
try{if(movies.length)renderMovies()}catch{}
})();

;(()=> {
 'use strict';
 const KEY_NAME='zinomi_omdb_api_key_v1';
 const getKey=()=>{try{return localStorage.getItem(KEY_NAME)||''}catch{return ''}};
 const setKey=v=>{try{localStorage.setItem(KEY_NAME,v)}catch{}};
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const safeRating=v=>{if(v===null||v===undefined||String(v).trim()===''||String(v).trim().toUpperCase()==='N/A')return null;const n=Number(v);return Number.isFinite(n)&&n>0&&n<=10?n:null};
 let busy=false, refreshAll=false, missingOnly=false, modalId=null;
 function addControls(){
   const menu=document.getElementById('zxMenu'); if(!menu||document.getElementById('imdbTools'))return;
   const wrap=document.createElement('div');wrap.id='imdbTools';wrap.style.display='contents';
   wrap.innerHTML='<div class="zx-sep">IMDb RATINGS</div><button type="button" class="btn small" id="imdbSetupBtn" title="Set or change your OMDb API key">⭐ IMDb Setup</button><button type="button" class="btn small" id="imdbRefreshBtn" title="Refresh stored IMDb ratings">↻ Refresh IMDb</button><button type="button" class="btn small" id="imdbMissingBtn" title="Only look up titles that have no IMDb rating yet (saves API requests)">↻ Refresh missing</button>';
   menu.appendChild(wrap);
   const pdf=document.getElementById('pdfCatBtn'),csv=document.getElementById('exportCsvBtn');
   if(pdf){pdf.classList.remove('cinema');if(csv&&csv.parentNode===menu)csv.after(pdf);else menu.insertBefore(pdf,wrap)}
   document.getElementById('imdbSetupBtn').onclick=()=>{
     const current=getKey();
     const v=prompt('Paste your OMDb API key'+(current?' (saved key ends with ...'+current.slice(-4)+'). Leave empty to keep it.':'.'),'');
     if(v===null)return;
     if(!v.trim())return toast('API key was not changed');
     setKey(v.trim());toast('IMDb API key saved in this browser');refreshAll=true;scanVisible();
   };
   document.getElementById('imdbRefreshBtn').onclick=async()=>{
     if(!getKey())return toast('Set your OMDb API key first');
     if(!confirm('Refresh IMDb ratings for all movies and series? This uses API requests.'))return;
     refreshAll=true;
     try{
       for(const m of movies){
         delete m.imdbChecked;delete m.imdbRating;if(!m.imdbManual)delete m.imdbID;
         await put('movies',m);
       }
       await refresh();scanVisible();
       toast('IMDb ratings refresh started');
     }catch(e){toast('Could not refresh ratings')}
   };
   document.getElementById('imdbMissingBtn').onclick=async()=>{
     if(!getKey())return toast('Set your OMDb API key first');
     const miss=movies.filter(m=>safeRating(m.imdbRating)===null);
     if(!miss.length)return toast('Every title already has an IMDb rating');
     if(!confirm('Look up IMDb ratings for '+miss.length+' title(s) that have no rating yet?\nTitles that already have a rating are skipped, so this saves API requests.'))return;
     try{
       for(const m of miss){delete m.imdbChecked;delete m.imdbError;await put('movies',m)}
       await refresh();missingOnly=true;scanVisible();
       toast('Looking up '+miss.length+' missing rating(s)…');
     }catch(e){toast('Could not start the lookup')}
   };
 }
 async function fetchRating(m){
   const key=getKey(); if(!key||!m)return;
   const title=(m.name||'').trim();if(!title)return;
   const kind=m.type==='series'?'series':'movie';
   const byId=!!(m.imdbManual&&/^tt\d{6,10}$/i.test(m.imdbID||''));
   const ask=async withYear=>{
     const params=byId?new URLSearchParams({apikey:key,i:m.imdbID}):new URLSearchParams({apikey:key,t:title,type:kind});
     if(!byId&&withYear&&m.year)params.set('y',String(m.year));
     const res=await fetch('https://www.omdbapi.com/?'+params.toString());
     return res.json();
   };
   let data=await ask(true);
   if(data.Response!=='True'&&m.year&&!byId){data=await ask(false)}   // year mismatch: retry without it
   if(data.Response!=='True'){
     m.imdbChecked=true;m.imdbError=data.Error||'Not found';
   }else{
     m.imdbRating=safeRating(data.imdbRating);
     m.imdbID=data.imdbID||'';
     m.imdbVotes=data.imdbVotes||'';
     m.imdbChecked=true;m.imdbError='';
   }
   await put('movies',m);
 }
 const ringKey=r=>r===null?(getKey()?'na':'na-idle'):r.toFixed(1);
 const ringIO='IntersectionObserver' in window?new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){goRing(e.target);ringIO.unobserve(e.target)}}),{threshold:.3}):null;
 function goRing(n){
   n.classList.add('go');const b=n.querySelector('b'),to=Number(n.dataset.v);
   if(!to||matchMedia('(prefers-reduced-motion:reduce)').matches){if(to)b.textContent=to.toFixed(1);return}
   const t0=performance.now();(function f(t){const k=Math.min(1,(t-t0-150)/1500),e=1-Math.pow(1-Math.max(0,k),3);b.textContent=(to*e).toFixed(1);if(k<1)requestAnimationFrame(f)})(t0);
 }
 function makeRing(rating,big){
   const na=rating===null,v=na?0:rating,col=v>=8?'#3ddc84':v>=6?'#f5c518':v>=4?'#fb923c':'#ef4444';
   const n=document.createElement('div');n.className='imdb-ring'+(na?' na':'')+(na&&!getKey()?' idle':'')+(big?' lg':'');
   n.dataset.key=ringKey(rating);n.dataset.v=v;
   if(!na){n.style.setProperty('--rc',col);n.style.setProperty('--p',v/10)}
   n.setAttribute('aria-label',na?'IMDb rating not available yet':'IMDb rating '+v.toFixed(1)+' out of 10');
   n.title=na?'IMDb rating not available yet':'IMDb rating: '+v.toFixed(1)+' / 10';
   n.innerHTML='<svg viewBox="0 0 52 52"><circle class="trk" cx="26" cy="26" r="20"/><circle class="prg" cx="26" cy="26" r="20"/></svg><div class="rv"><b>'+(na?'N/A':'0.0')+'</b><small>IMDb</small></div>';
   return n;
 }
 function attachRing(host,rating,big){
   let old=host.querySelector('.imdb-ring');const key=ringKey(rating);
   if(old&&old.dataset.key===key)return;               // unchanged: don't restart the animation
   if(old)old.remove();
   const n=makeRing(rating,big);host.appendChild(n);
   if(rating===null)return;
   if(big||!ringIO)goRing(n);else ringIO.observe(n);
 }
 function paintBadges(){
   if(typeof movies==='undefined')return;
   document.querySelectorAll('#movieGrid .movie[data-id]').forEach(card=>{
     const m=movies.find(x=>String(x.id)===card.dataset.id);
     if(!m)return;
     const poster=card.querySelector('.poster');if(!poster)return;
     attachRing(poster,safeRating(m.imdbRating));
   });
 }
 function paintModal(id){
   const m=typeof movies!=='undefined'&&movies.find(x=>String(x.id)===String(id));
   const host=document.getElementById('modalPoster');if(!m||!host)return;
   attachRing(host,safeRating(m.imdbRating),true);
 }
 async function scanVisible(){
   if(busy||!getKey()||typeof movies==='undefined')return;
   busy=true;
   try{
     const ids=(refreshAll||missingOnly)?movies.map(x=>String(x.id)):[...document.querySelectorAll('#movieGrid .movie[data-id]')].map(x=>x.dataset.id);
     for(const id of ids){
       const m=movies.find(x=>String(x.id)===id);
       if(!m||(!refreshAll&&(m.imdbChecked||safeRating(m.imdbRating)!==null)))continue;
       try{await fetchRating(m)}catch(e){console.warn('IMDb lookup failed:',e)}
       paintBadges();
       await wait(1100);
     }
     refreshAll=false;missingOnly=false;
   }finally{busy=false;paintBadges()}
 }
 function addIdButton(){
   const buy=document.getElementById('modalBuyBtn');if(!buy||document.getElementById('modalImdbIdBtn'))return;
   const b=document.createElement('button');b.type='button';b.id='modalImdbIdBtn';b.className='btn adm';b.textContent='🆔 IMDb ID';
   b.title='Fix a wrong or N/A rating by entering the IMDb ID';
   buy.parentNode.insertBefore(b,buy.nextSibling);
   b.onclick=async()=>{
     const m=typeof movies!=='undefined'&&movies.find(x=>String(x.id)===String(modalId));if(!m)return;
     if(!getKey())return toast('Set your OMDb API key first');
     const v=prompt('Paste the IMDb ID or IMDb link for "'+m.name+'" (example: tt0463985).\nLeave empty to remove a manual ID.',m.imdbManual?(m.imdbID||''):'');
     if(v===null)return;
     const t=v.trim();
     try{
       if(!t){
         delete m.imdbManual;delete m.imdbID;delete m.imdbRating;delete m.imdbChecked;delete m.imdbError;
         await put('movies',m);await refresh();renderMovies();paintModal(m.id);return toast('Manual IMDb ID removed');
       }
       const id=(t.match(/tt\d{6,10}/i)||[])[0];
       if(!id)return toast('Not a valid IMDb ID. It looks like tt0463985');
       m.imdbID=id.toLowerCase();m.imdbManual=true;delete m.imdbChecked;delete m.imdbRating;
       await fetchRating(m);await refresh();renderMovies();paintModal(m.id);
       const u=movies.find(x=>String(x.id)===String(m.id));
       toast(u&&safeRating(u.imdbRating)!==null?'IMDb rating set: '+Number(u.imdbRating).toFixed(1)+'/10':'ID saved, but OMDb has no rating for it ('+((u&&u.imdbError)||'no score')+')');
     }catch(e){toast('Could not look up that IMDb ID')}
   };
 }
 addControls();addIdButton();
 const _openModal=window.openMovieModal;
 if(typeof _openModal==='function')window.openMovieModal=function(id){modalId=id;const r=_openModal.apply(this,arguments);try{addIdButton();paintModal(id)}catch(e){}return r};
 const original=window.renderMovies;
 if(typeof original==='function'){
   window.renderMovies=function(){original.apply(this,arguments);paintBadges();setTimeout(scanVisible,250)};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',addControls);
 setTimeout(()=>{addControls();paintBadges();scanVisible()},900);
 window.zinomiRefreshIMDb=()=>{refreshAll=true;scanVisible()};
})();

;(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 let viewFilter='all';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const rating=m=>{const n=Number(m.imdbRating);return Number.isFinite(n)&&n>0&&n<=10?n:null};
 const watchState=m=>m.viewStatus==='watched'?'watched':m.viewStatus==='watchlist'?'watchlist':'unwatched';
 function addDashboard(){
  const nav=document.querySelector('.topnav');
  if(nav&&!document.getElementById('cinemaDashTab')){
   const b=document.createElement('button');b.className='tab';b.id='cinemaDashTab';b.dataset.tab='cinemaDashboard';b.textContent='📊 Cinema Dashboard';
   nav.insertBefore(b,nav.querySelector('[data-tab="add"]'));
   b.addEventListener('click',()=>{showTab('cinemaDashboard');renderDashboard();window.scrollTo({top:0,behavior:'smooth'})});
  }
  const main=document.querySelector('main'),library=$('library');
  if(main&&library&&!$('cinemaDashboard')){
   const sec=document.createElement('section');sec.className='panel';sec.id='cinemaDashboard';
   sec.innerHTML=`<div class="cinema-dashboard">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><div><div class="sub">ZINOMI • COLLECTION INSIGHTS</div><h2 style="font-family:var(--font-display);margin:5px 0 0">Cinema Intelligence</h2></div><button class="btn" id="cinemaDashRefresh">↻ Refresh statistics</button></div>
    <div class="cinema-kpis" id="cinemaKpis"></div>
    <div class="cinema-panels"><div class="cinema-box"><h3>🏆 TOP 10 IMDb RATED TITLES</h3><div id="cinemaTopList" class="cinema-toplist"></div></div><div class="cinema-box"><h3>🎭 GENRE BREAKDOWN</h3><div id="cinemaGenres" class="cinema-genre"></div></div></div>
    <div class="cinema-box"><h3>💡 COLLECTION SNAPSHOT</h3><div id="cinemaSnapshot" style="color:var(--muted);font-size:12px;line-height:1.9"></div></div>
   </div>`;
   main.insertBefore(sec,library);
   $('cinemaDashRefresh').onclick=renderDashboard;
  }
 }
 function renderDashboard(){
  if(typeof movies==='undefined'||!$('cinemaKpis'))return;
  const films=movies.filter(m=>m.type!=='series'),series=movies.filter(m=>m.type==='series');
  const rated=films.map(m=>({m,r:rating(m)})).filter(x=>x.r!==null);
  const ratedAll=movies.map(m=>({m,r:rating(m)})).filter(x=>x.r!==null);
  const avg=rated.length? rated.reduce((a,x)=>a+x.r,0)/rated.length:0;
  const wl=films.filter(m=>watchState(m)==='watchlist').length;
  const watched=films.filter(m=>watchState(m)==='watched').length;
  const fav=movies.filter(m=>!!m.fav).length;
  $('cinemaKpis').innerHTML=[['MOVIES',films.length],['TV SERIES',series.length],['AVG IMDb',rated.length?avg.toFixed(1)+'/10':'—'],['WATCHLIST',wl],['WATCHED',watched]].map(([l,v])=>`<div class="cinema-kpi"><small>${l}</small><strong>${v}</strong></div>`).join('');
  const top=[...ratedAll].sort((a,b)=>b.r-a.r||String(a.m.name).localeCompare(String(b.m.name))).slice(0,10);
  $('cinemaTopList').innerHTML=top.length?top.map((x,i)=>`<div class="cinema-toprow" data-open-movie="${esc(x.m.id)}"><span class="cinema-rank">${String(i+1).padStart(2,'0')}</span>${x.m.poster?`<img src="${esc(x.m.poster)}" alt="">`:'<div style="width:42px;height:58px;background:#20283a;border-radius:5px;display:grid;place-items:center">🎬</div>'}<div class="cinema-topname"><b>${esc(x.m.name)}${x.m.type==='series'?' 📺':''}</b><small>${esc(x.m.year||'Year unknown')}${x.m.type==='series'?' · TV series':''}</small></div><span class="cinema-score">★ ${x.r.toFixed(1)}</span></div>`).join(''):'<div class="cinema-empty">No IMDb-rated titles yet. Fetch ratings to build your Top 10.</div>';
  $('cinemaTopList').querySelectorAll('[data-open-movie]').forEach(el=>el.onclick=()=>{if(typeof openMovieModal==='function')openMovieModal(el.dataset.openMovie)});
  const counts={};films.forEach(m=>String(m.genre||'Other').split(/[,/]/).map(x=>x.trim()).filter(Boolean).forEach(g=>counts[g]=(counts[g]||0)+1));
  const genres=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10),max=genres[0]?.[1]||1;
  $('cinemaGenres').innerHTML=genres.length?genres.map(([g,n])=>`<div class="cinema-genre-row"><span title="${esc(g)}">${esc(g)}</span><div class="cinema-bar"><i style="width:${n/max*100}%"></i></div><b>${n}</b></div>`).join(''):'<div class="cinema-empty">Add movie genres to see your collection breakdown.</div>';
  $('cinemaSnapshot').innerHTML=`<b style="color:#f3f6fc">${fav}</b> favorites saved · <b style="color:#f3f6fc">${ratedAll.length}</b> of ${movies.length} titles (movies + series) have IMDb ratings · <b style="color:#f3f6fc">${movies.length-ratedAll.length}</b> are not rated yet.<br>Watched and watchlist labels are separate from your existing store availability / sold status.`;
 }
 async function saveWatchState(id,state){
  const m=movies.find(x=>String(x.id)===String(id));if(!m)return;
  m.viewStatus=state;
  try{await put('movies',m);await refresh();renderDashboard();toast(state==='watchlist'?'Added to Watchlist':state==='watched'?'Marked as Watched':'Marked as Unwatched')}
  catch(e){console.error(e);toast('Could not save viewing status')}
 }
 function decorateCards(){
  const grid=$('movieGrid');if(!grid||typeof movies==='undefined')return;
  grid.querySelectorAll('.movie[data-id]').forEach(card=>{
   const m=movies.find(x=>String(x.id)===card.dataset.id);if(!m)return;
   const poster=card.querySelector('.poster');if(!poster)return;
   if(!poster.querySelector('.watch-toggle.wl')){const b=document.createElement('button');b.className='watch-toggle wl';b.type='button';b.title='Add/remove from Watchlist';b.setAttribute('aria-label',b.title);b.textContent='▣';b.onclick=e=>{e.preventDefault();e.stopPropagation();saveWatchState(m.id,watchState(m)==='watchlist'?'unwatched':'watchlist')};poster.appendChild(b)}
   if(!poster.querySelector('.watch-toggle.done')){const b=document.createElement('button');b.className='watch-toggle done';b.type='button';b.title='Mark watched / unwatched';b.setAttribute('aria-label',b.title);b.textContent='✓';b.onclick=e=>{e.preventDefault();e.stopPropagation();saveWatchState(m.id,watchState(m)==='watched'?'unwatched':'watched')};poster.appendChild(b)}
   const wl=poster.querySelector('.watch-toggle.wl'),done=poster.querySelector('.watch-toggle.done');
   wl.classList.toggle('active',watchState(m)==='watchlist');wl.textContent=watchState(m)==='watchlist'?'▣':'＋';
   done.classList.toggle('active',watchState(m)==='watched');done.textContent=watchState(m)==='watched'?'✓':'○';
   let label=poster.querySelector('.watch-label');const state=watchState(m);
   if(state==='unwatched'){if(label)label.remove()}
   else {if(!label){label=document.createElement('span');label.className='watch-label';poster.appendChild(label)}label.classList.toggle('done',state==='watched');label.textContent=state==='watched'?'✓ WATCHED':'▣ WATCHLIST'}
  });
  applyViewFilter();
 }
 function applyViewFilter(){
  const cards=[...document.querySelectorAll('#movieGrid .movie[data-id]')];let visible=0;
  cards.forEach(c=>{const m=movies.find(x=>String(x.id)===c.dataset.id);const st=m?watchState(m):'unwatched';const ok=viewFilter==='all'||(viewFilter==='watchlist'&&st==='watchlist')||(viewFilter==='watched'&&st==='watched')||(viewFilter==='unwatched'&&st==='unwatched');c.style.display=ok?'':'none';if(ok)visible++});
  const bar=$('countBar');if(bar&&viewFilter!=='all')bar.textContent=`SHOWING ${visible} ${viewFilter.toUpperCase()} · CURRENT PAGE`;
  document.querySelectorAll('[data-view-filter]').forEach(b=>b.classList.toggle('on',b.dataset.viewFilter===viewFilter));
 }
 function addFilters(){
  const host=$('favFilter')?.parentElement;if(!host||host.querySelector('[data-view-filter]'))return;
  const html=[['all','All'],['watchlist','▣ Watchlist'],['watched','✓ Watched'],['unwatched','○ Unwatched']].map(([v,t])=>`<button type="button" class="chip cinema-filter ${v==='all'?'on':''}" data-view-filter="${v}">${t}</button>`).join('');
  $('favFilter').insertAdjacentHTML('beforebegin',html);
  host.querySelectorAll('[data-view-filter]').forEach(b=>b.onclick=()=>{viewFilter=b.dataset.viewFilter;applyViewFilter()});
 }
 addDashboard();addFilters();
 const previousRender=window.renderMovies;
 if(typeof previousRender==='function')window.renderMovies=function(){previousRender.apply(this,arguments);decorateCards()};
 const previousRefresh=window.refresh;
 if(typeof previousRefresh==='function')window.refresh=async function(){const r=await previousRefresh.apply(this,arguments);decorateCards();renderDashboard();return r};
 // Some earlier wrappers keep renderMovies in a lexical binding; observe grid mutations too.
 const grid=$('movieGrid');if(grid&&window.MutationObserver)new MutationObserver(()=>{decorateCards()}).observe(grid,{childList:true});
 document.addEventListener('click',e=>{const tab=e.target.closest('#cinemaDashTab');if(tab){renderDashboard()}});
 // Initial and later updates.
 setTimeout(()=>{addDashboard();addFilters();decorateCards();renderDashboard()},500);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderDashboard()});
})();

;(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const rate=m=>{const n=Number(m.imdbRating);return Number.isFinite(n)&&n>0&&n<=10?n:null};
 const col=v=>v>=8?'#16a34a':v>=6?'#d4a000':v>=4?'#ea7a1a':'#dc2626';

 /* live duplicate hint while typing in the Add form */
 function dupCheck(){
  const box=$('dupWarn');if(!box||typeof movies==='undefined')return;
  const nm=($('movieName').value||'').trim().toLowerCase(),yr=Number($('movieYear').value)||null,type=$('itemType').value,me=$('movieId').value;
  if(!nm){box.hidden=true;return}
  const d=movies.find(x=>x.id!==me&&String(x.name||'').trim().toLowerCase()===nm&&(x.year||null)===yr&&((x.type==='series')?'series':'movie')===type);
  box.hidden=!d;if(d)box.textContent='⚠ "'+d.name+'"'+(yr?' ('+yr+')':'')+' is already in your store.';
 }
 ['movieName','movieYear','itemType'].forEach(id=>{const e=$(id);if(e){e.addEventListener('input',dupCheck);e.addEventListener('change',dupCheck)}});

 /* customer catalogue: opens a clean print page (Print > Save as PDF) */
 function ring(v){
  if(v===null)return '';
  const c=col(v),off=(125.66*(1-v/10)).toFixed(2);
  return '<svg class="rg" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" fill="#10131a"/><circle cx="26" cy="26" r="20" fill="none" stroke="#3a3f4b" stroke-width="4"/><circle cx="26" cy="26" r="20" fill="none" stroke="'+c+'" stroke-width="4" stroke-linecap="round" stroke-dasharray="125.66" stroke-dashoffset="'+off+'" transform="rotate(-90 26 26)"/><text x="26" y="29.5" text-anchor="middle" font-size="13" font-weight="800" fill="#fff" font-family="Arial,sans-serif">'+v.toFixed(1)+'</text><text x="26" y="38" text-anchor="middle" font-size="6" font-weight="700" fill="'+c+'" font-family="Arial,sans-serif">IMDb</text></svg>';
 }
 function card(m){
  const v=rate(m),sale=typeof onSale==='function'&&onSale(m),p=typeof effP==='function'?effP(m):(m.price||0),fm=n=>typeof money==='function'?money(n):String(n);
  const meta=[m.year,m.genre,m.quality,m.language].filter(Boolean).join(' · ');
  return '<div class="c"><div class="p">'+(m.poster?'<img src="'+esc(m.poster)+'" alt="">':'<span class="ph">'+(m.type==='series'?'📺':'🎬')+'</span>')+ring(v)+'</div><div class="b"><div class="n">'+esc(m.name)+'</div><div class="m">'+esc(meta)+'</div>'+(m.price?'<div class="pr">'+(sale?'<s>'+fm(m.price)+'</s> ':'')+fm(p)+'</div>':'')+'</div></div>';
 }
 function section(title,list){
  if(!list.length)return '';
  const sorted=[...list].sort((a,b)=>((rate(b)??-1)-(rate(a)??-1))||String(a.name).localeCompare(String(b.name)));
  return '<h2>'+title+' <small>'+sorted.length+'</small></h2><div class="g">'+sorted.map(card).join('')+'</div>';
 }
 function build(){
  const avail=movies.filter(m=>typeof stOf==='function'?stOf(m)!=='sold':m.status!=='sold');
  const films=avail.filter(m=>m.type!=='series'),series=avail.filter(m=>m.type==='series');
  const wa=typeof waNumber==='function'?waNumber():'';
  const d=new Date().toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});
  return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Zinomi Film Store - Catalogue</title><style>'+
  '*{box-sizing:border-box}body{margin:0;padding:22px;font:13px/1.4 Arial,Helvetica,sans-serif;color:#151821;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}'+
  'header{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;border-bottom:3px solid #d4a000;padding-bottom:10px;margin-bottom:6px}h1{margin:0;font-size:24px}header span{color:#5b6172;font-size:12px;text-align:right}'+
  'h2{margin:20px 0 10px;font-size:16px;letter-spacing:.04em}h2 small{color:#7b8294;font-weight:400}'+
  '.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}.c{break-inside:avoid;border:1px solid #e3e6ee;border-radius:10px;overflow:hidden;background:#fff}'+
  '.p{position:relative;aspect-ratio:2/3;background:#eef0f5;display:grid;place-items:center;font-size:36px}.p img{width:100%;height:100%;object-fit:cover;display:block}'+
  '.rg{position:absolute;top:7px;left:7px;width:46px;height:46px;filter:drop-shadow(0 2px 4px rgba(0,0,0,.4))}'+
  '.b{padding:8px 10px 10px}.n{font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.m{color:#677085;font-size:11px;margin:2px 0 6px;min-height:15px}.pr{font-weight:800;font-size:14px;color:#0f7a43}.pr s{color:#9aa1b2;font-weight:400;font-size:11px}'+
  'footer{margin-top:22px;padding-top:10px;border-top:1px solid #e3e6ee;color:#5b6172;font-size:12px}.bar{position:sticky;top:0;margin:-22px -22px 14px;padding:10px 22px;background:#151821;color:#fff;display:flex;justify-content:space-between;align-items:center}.bar button{background:#d4a000;border:0;border-radius:6px;padding:7px 14px;font-weight:700;cursor:pointer}'+
  '@page{margin:12mm}@media print{body{padding:0}.bar{display:none}.g{grid-template-columns:repeat(4,1fr)}}'+
  '</style></head><body><div class="bar"><span>Choose "Save as PDF" in the print window</span><button onclick="window.print()">Print / Save PDF</button></div>'+
  '<header><h1>Zinomi Film Store - Catalogue</h1><span>'+esc(d)+'<br>'+avail.length+' titles available'+(wa?'<br>WhatsApp +'+esc(wa):'')+'</span></header>'+
  section('MOVIES',films)+section('TV SERIES',series)+
  '<footer>Prices in the listed currency. Ratings from IMDb. Availability can change, message us on WhatsApp to confirm and order.</footer></body></html>';
 }
 const b=$('pdfCatBtn');
 if(b)b.onclick=()=>{
  if(typeof movies==='undefined'||!movies.length)return toast('Add some titles first');
  const w=window.open('','_blank');
  if(!w)return toast('Allow pop-ups to open the catalogue');
  w.document.open();w.document.write(build());w.document.close();
  w.addEventListener('load',()=>setTimeout(()=>{try{w.focus();w.print()}catch(e){}},600));
  toast('Catalogue opened. Choose "Save as PDF" in the print window');
 };
})();

;(()=>{
const OK='zm_orders';
const load=()=>{try{const a=JSON.parse(lsGet(OK)||'[]');return Array.isArray(a)?a:[]}catch(e){return[]}};
const save=a=>lsSet(OK,JSON.stringify(a));
const same=(a,b)=>new Date(a).toDateString()===new Date(b).toDateString();
const sold=()=>movies.filter(m=>m.status==='sold').map(m=>({m,t:m.soldAt||m.updated||0,p:Number(m.soldPrice??m.price??0)})).sort((a,b)=>b.t-a.t);
const card=(l,v,s)=>'<div class="zs-card"><span>'+l+'</span><b>'+v+'</b><small>'+s+'</small></div>';
function render(){
 const a=sold(),now=Date.now(),n=new Date(),sum=l=>l.reduce((s,x)=>s+x.p,0);
 const td=a.filter(x=>x.t&&same(x.t,now)),mo=a.filter(x=>{const d=new Date(x.t);return x.t&&d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear()});
 const ords=load();
 $('zsStats').innerHTML=card('Today',money(sum(td)),td.length+' sold')+card('This month',money(sum(mo)),mo.length+' sold')+card('All time',money(sum(a)),a.length+' sold')+card('Orders to deliver',String(ords.length),'from this device');
 $('zsSold').innerHTML=a.length?a.map(x=>'<div class="zs-row"><div class="zs-main"><b>'+escapeHTML(x.m.name||'Untitled')+'</b><small>'+(x.t?new Date(x.t).toLocaleString():'')+(x.m.buyer?' · '+escapeHTML(x.m.buyer):'')+'</small></div><span class="zs-amt">'+money(x.p)+'</span><button title="Undo sale" onclick="sellMovie(\''+x.m.id+'\')">↩</button></div>').join(''):'<div class="zs-empty">No sales yet. Mark a title as sold from its card and it appears here.</div>';
 $('zsOrders').innerHTML=ords.length?ords.map(o=>'<div class="zs-row"><div class="zs-main"><b>'+money(o.total)+' · '+o.count+' title'+(o.count===1?'':'s')+'</b><small>'+new Date(o.t).toLocaleString()+' · '+escapeHTML((o.items||[]).join(', '))+'</small></div><button title="Delivered" data-ok="'+o.id+'">✓</button></div>').join(''):'<div class="zs-empty">No pending orders.</div>';
 $('zsOrders').querySelectorAll('[data-ok]').forEach(b=>b.onclick=()=>{save(load().filter(x=>x.id!==b.dataset.ok));render()});
}
const nav=document.querySelector('.topnav');
if(nav){const b=document.createElement('button');b.className='tab adm';b.dataset.tab='zxSales';b.textContent='Sales';b.addEventListener('click',()=>{showTab('zxSales');render();window.scrollTo({top:0,behavior:'smooth'})});nav.insertBefore(b,nav.querySelector('[data-tab="notes"]'))}
$('zsCsv').onclick=()=>{const q=v=>{let t=String(v??'');if(/^[=+\-@\t\r]/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"'};
 const rows=['Date,Title,Buyer,Price',...sold().map(x=>[x.t?new Date(x.t).toISOString():'',x.m.name,x.m.buyer,x.p].map(q).join(','))];
 const u=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'})),a=document.createElement('a');a.href=u;a.download='Zinomi-Movie-Sales-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(u),1500)};
const cs=$('cartSend');
if(cs)cs.addEventListener('click',()=>{try{const it=cartItems();if(!it.length||!waNumber())return;const a=load();a.unshift({id:makeId(),t:Date.now(),items:it.map(m=>m.name),count:it.length,total:it.reduce((s,m)=>s+effP(m),0)});save(a)}catch(e){console.warn(e)}},true);
try{const _rf=refresh;refresh=async function(){const r=await _rf.apply(this,arguments);try{if($('zxSales').classList.contains('active'))render()}catch(e){}return r};}catch(e){}
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
