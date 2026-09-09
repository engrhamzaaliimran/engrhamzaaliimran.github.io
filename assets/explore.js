import {matches, searchRecords} from './explore-core.mjs';
const $ = (s,root=document) => root.querySelector(s);
const $$ = (s,root=document) => [...root.querySelectorAll(s)];
function el(tag, text, cls) {const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
$$('.enhanced-only').forEach(n=>n.hidden=false);
// Search reads an index of the portfolio's actual content. No generated answers.
const dialog=el('dialog',undefined,'search-dialog');
dialog.setAttribute('aria-labelledby','search-heading');
dialog.innerHTML='<div class="search-dialog-top"><div class="search-dialog-heading"><h2 id="search-heading">Explore my work</h2><button type="button" class="dialog-close">Close</button></div><label for="all-work-query">Search across papers, projects, experience, and events</label><input id="all-work-query" class="search-input" type="search" placeholder="Try transfer learning, Python, Zaragoza…" autocomplete="off"><div class="search-kinds" role="group" aria-label="Filter search results"></div></div><p class="search-status" role="status"></p><ul class="search-results"></ul>';
document.body.append(dialog);
const query=$('.search-input',dialog),results=$('.search-results',dialog),status=$('.search-status',dialog),kindBar=$('.search-kinds',dialog);
let records=null,kind='',loading=null,searchOpener=null;
for(const label of ['All','Publication','Research','Project','Traditional RAG','GraphRAG','Experience','Event','Entity viewer']){
 const b=el('button',label);b.type='button';b.setAttribute('aria-pressed',String(label==='All'));b.addEventListener('click',()=>{kind=label==='All'?'':label;$$('button',kindBar).forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderSearch();});kindBar.append(b);
}
function renderSearch(){
 results.replaceChildren();
 if(!records){status.textContent='Loading the portfolio index…';return;}
 const found=searchRecords(records,query.value,kind);
 status.textContent=query.value.trim()||kind?`${found.length} matching ${found.length===1?'result':'results'}`:`Browse ${found.length} entries, or search for a topic.`;
 if(!found.length){results.append(el('li','No matches. Try fewer words or choose All.','search-status'));return;}
 for(const r of found){const li=el('li',undefined,'search-result'),a=el('a');a.href=r.url;a.append(el('small',r.kind),el('strong',r.title));if(r.excerpt)a.append(el('p',r.excerpt.length>220?r.excerpt.slice(0,220)+'…':r.excerpt));a.addEventListener('click',()=>dialog.close());li.append(a);results.append(li);}
}
async function openSearch(value='',opener=document.activeElement){
 searchOpener=opener;query.value=value;kind='';$$('button',kindBar).forEach(b=>b.setAttribute('aria-pressed',String(b.textContent==='All')));
 if(!dialog.open)dialog.showModal();document.body.classList.add('dialog-open');query.focus();renderSearch();
 try{
  if(!records){loading??=fetch(new URL('./search-index.json',import.meta.url)).then(r=>{if(!r.ok)throw new Error('index');return r.json();});records=await loading;}
  renderSearch();
 }catch{loading=null;status.textContent='Search could not load. Your pages are still available through navigation.';const b=el('button','Retry','explorer-reset');b.type='button';b.addEventListener('click',()=>openSearch(query.value,searchOpener));results.replaceChildren(b);}
}
query.addEventListener('input',renderSearch);
$('.dialog-close',dialog).addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{document.body.classList.remove('dialog-open');searchOpener?.focus();});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
$$('[data-open-search]').forEach(b=>b.addEventListener('click',()=>openSearch('',b)));
$$('[data-search-query]').forEach(b=>b.addEventListener('click',()=>openSearch(b.dataset.searchQuery,b)));
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openSearch();}});
// Publications: combine text, topic and year; all original entries remain in the page.
const pubForm=$('#publication-controls');
if(pubForm){
 const cards=$$('.publication-item');
 const update=()=>{let count=0;for(const c of cards){const show=matches(c.textContent,$('#pub-query').value)&&(!$('#pub-topic').value||c.dataset.topic===$('#pub-topic').value)&&(!$('#pub-year').value||c.dataset.year===$('#pub-year').value);c.hidden=!show;if(show)count++;}
 $('#pub-count').textContent=`${count} of ${cards.length} publications shown`;
 $('#pub-empty').hidden=count!==0;
 $$('.publication-group-heading').forEach(h=>{let list=h.nextElementSibling;while(list&&!list.classList.contains('publication-list'))list=list.nextElementSibling;if(list)h.hidden=!$$('.publication-item',list).some(c=>!c.hidden);});
 };
 pubForm.addEventListener('input',update);pubForm.addEventListener('change',update);pubForm.addEventListener('submit',e=>e.preventDefault());pubForm.addEventListener('reset',()=>setTimeout(update,0));update();
}
// Connect each existing workflow step to concrete work already in the portfolio.
const workflows=[
 {title:'Measure: start with informative signals',text:'Wearable research uses body-worn accelerometers and gyroscopes. Doctoral research explores frequency-dependent complex impedance in MOS gas sensors, including single gases and mixtures.',links:[['Explore the two sensing domains','#research'],['Inspect the open data','#open-work']]},
 {title:'Model: expose structure in the measurements',text:'Temporal models describe human motion; full-spectrum impedance modelling extracts interpretable features from chemical sensor measurements. The open workflows make these analysis steps inspectable.',links:[['Read the impedance work','#publications'],['Open the analysis workflows','#open-work']]},
 {title:'Learn: build and evaluate representations',text:'The wearable work spans activity recognition, cross-domain transfer to emotion detection, and sleep–wake monitoring. The separate RAG practice projects investigate retrieval choices and evaluation on fictional policies.',links:[['Explore the publications','#publications'],['Explore evaluated retrieval','traditional-rag.html']]},
 {title:'Deploy: connect algorithms with engineering',text:'The engineering background includes C/C++ firmware, embedded Linux and Yocto, microcontroller prototypes, Python automation, and LLM-based assistants. Research also considers compact models and practical acquisition cost.',links:[['View engineering experience','#experience'],['Inspect the project work','#practice-projects']]}
];
$$('[data-workflow]').forEach(b=>b.addEventListener('click',()=>{
 const panel=$('#workflow-detail'),wasOpen=b.getAttribute('aria-expanded')==='true';
 $$('[data-workflow]').forEach(x=>{x.setAttribute('aria-expanded','false');$('span',x).textContent='+';});
 if(wasOpen){panel.hidden=true;return;}
 b.setAttribute('aria-expanded','true');$('span',b).textContent='−';const w=workflows[Number(b.dataset.workflow)];panel.replaceChildren(el('h3',w.title),el('p',w.text));const links=el('div',undefined,'workflow-links');w.links.forEach(([label,url])=>{const a=el('a',label);a.href=url;links.append(a);});panel.append(links);panel.hidden=false;
}));
// Events: searchable places and activities; photo viewer follows visible results.
const eventForm=$('#event-controls'),eventCards=$$('.event-feature-card,.event-row');
if(eventForm){
 const years=[...new Set(eventCards.flatMap(c=>c.textContent.match(/\b(?:19|20)\d{2}\b/g)||[]))].sort().reverse();
 years.forEach(y=>{const o=el('option',y);o.value=y;$('#event-year').append(o);});
 const update=()=>{let count=0;eventCards.forEach(c=>{c.hidden=!(matches(c.textContent,$('#event-query').value)&&(!$('#event-year').value||c.textContent.includes($('#event-year').value)));if(!c.hidden)count++;});$('#event-count').textContent=`${count} of ${eventCards.length} events shown`;$('#event-empty').hidden=count!==0;
 for(const grid of $$('.event-feature-grid,.event-archive')){const sec=grid.closest('section');if(sec)sec.hidden=!$$('.event-feature-card,.event-row',grid).some(c=>!c.hidden);}
 };
 eventForm.addEventListener('input',update);eventForm.addEventListener('change',update);eventForm.addEventListener('submit',e=>e.preventDefault());eventForm.addEventListener('reset',()=>setTimeout(update,0));update();
}
const photos=$$('[data-photo]');
if(photos.length){
 const viewer=el('dialog',undefined,'photo-dialog');viewer.setAttribute('aria-label','Event photo viewer');viewer.innerHTML='<div class="photo-toolbar"><p id="photo-caption"></p><button type="button" class="dialog-close">Close</button></div><img alt=""><div class="photo-controls"><button type="button" class="explorer-reset" data-previous>← Previous</button><span role="status"></span><button type="button" class="explorer-reset" data-next>Next →</button></div>';document.body.append(viewer);let active=[],position=0,opener;
 const show=()=>{const b=active[position],img=$('img',b);$('img',viewer).src=b.dataset.photo;$('img',viewer).alt=img.alt;$('#photo-caption',viewer).textContent=b.closest('article').querySelector('h3')?.textContent||img.alt;$('.photo-controls span',viewer).textContent=`${position+1} / ${active.length}`;};
 photos.forEach(b=>b.addEventListener('click',()=>{opener=b;active=photos.filter(x=>!x.closest('article').hidden);position=active.indexOf(b);show();viewer.showModal();document.body.classList.add('dialog-open');}));
 const move=n=>{position=(position+n+active.length)%active.length;show();};$('[data-previous]',viewer).addEventListener('click',()=>move(-1));$('[data-next]',viewer).addEventListener('click',()=>move(1));$('.dialog-close',viewer).addEventListener('click',()=>viewer.close());viewer.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}if(e.key==='ArrowRight'){e.preventDefault();move(1);}});viewer.addEventListener('close',()=>{document.body.classList.remove('dialog-open');opener?.focus();});
}
