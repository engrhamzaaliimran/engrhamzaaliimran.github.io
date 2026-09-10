'use strict';
const $=id=>document.getElementById(id);
const config={responsive:true,displaylogo:false,modeBarButtonsToRemove:['lasso2d','select2d'],toImageButtonOptions:{format:'png',scale:2}};
const palette=['#154ec1','#d47720','#008976','#9554c5','#cb486e','#547485','#8a7420','#307dc2','#bf5432'];
const temperatureColors={150:'#008976',250:'#d47720',350:'#154ec1'};
let manifest,mode='mixtures',conditionId='mix-e1-a4',current,comparison=[],requestId=0,timer=null,clickBound=false;
const cache=new Map();
function element(tag,text,cls){const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x;}
function options(select,items,value){select.replaceChildren();for(const [v,label] of items){const o=element('option',label);o.value=v;select.append(o);}if(items.some(x=>String(x[0])===String(value)))select.value=value;}
function conditions(){return manifest.conditions.filter(c=>c.mode===mode);}
function meta(){return manifest.conditions.find(c=>c.id===conditionId);}
function fmt(n){return n==null?'Unavailable':Number(n).toLocaleString('en-US',{maximumSignificantDigits:5});}
function stop(){clearInterval(timer);timer=null;$('play').textContent='▶ Play sweeps';}
async function load(id){if(!cache.has(id)){const promise=fetch('assets/eis-data/'+encodeURIComponent(id)+'.json').then(r=>{if(!r.ok)throw Error('The measurement could not be loaded.');return r.json();}).catch(e=>{cache.delete(id);throw e;});cache.set(id,promise);}return cache.get(id);}
function layout(xTitle,yTitle,log=true){const theme=getComputedStyle(document.documentElement);const surface=theme.getPropertyValue('--surface').trim()||'white',muted=theme.getPropertyValue('--text-soft').trim()||'#61718a',line=theme.getPropertyValue('--line').trim()||'#dce3ec';return {margin:{l:75,r:20,t:20,b:65},paper_bgcolor:surface,plot_bgcolor:surface,font:{family:'Inter, system-ui, sans-serif',color:muted,size:12},xaxis:{title:{text:xTitle},type:log?'log':'linear',gridcolor:line,zerolinecolor:line,automargin:true},yaxis:{title:{text:yTitle},gridcolor:line,zerolinecolor:line,automargin:true},legend:{orientation:'h',y:1.12,x:0,font:{size:11}},hovermode:'closest',uirevision:mode+'-'+$('view').value};}
function setSingleControls(){
 const cs=conditions(),m=meta();options($('gas'),[...new Set(cs.map(c=>c.gas))].sort().map(x=>[x,x]),m.gas);
 options($('rh'),[...new Set(cs.filter(c=>c.gas===m.gas).map(c=>c.rh))].sort((a,b)=>a-b).map(x=>[x,x+'% RH']),m.rh);
 options($('concentration'),cs.filter(c=>c.gas===m.gas&&c.rh===m.rh).sort((a,b)=>a.concentration-b.concentration).map(c=>[c.id,c.concentration+' ppm']),conditionId);
}
function syncControls(){
 const m=meta();$('mixtures').classList.toggle('selected',mode==='mixtures');$('single').classList.toggle('selected',mode==='single');$('mixtures').setAttribute('aria-pressed',mode==='mixtures');$('single').setAttribute('aria-pressed',mode==='single');$('mixture-picker').hidden=mode!=='mixtures';$('single-picker').hidden=mode!=='single';
 if(mode==='single')setSingleControls();
 document.querySelectorAll('[data-condition]').forEach(b=>{b.classList.toggle('active',b.dataset.condition===conditionId);b.setAttribute('aria-pressed',b.dataset.condition===conditionId);});
 options($('temperature'),m.temperatures.map(t=>[t,t+' °C']),$('temperature').value||350);
 const old=$('compare').value;options($('compare'),[['','No comparison'],...EISComparison.choices(mode),...conditions().filter(c=>c.id!==conditionId).map(c=>[c.id,c.label])],old);
}
async function selectCondition(id,sweep=0){
 stop();conditionId=id;syncControls();const req=++requestId;
 $('status').hidden=false;$('status').textContent='Loading '+meta().label+'…';
 try{const choice=$('compare').value;const batch=choice.startsWith('@');$('all-temperatures').disabled=batch;if(batch)$('all-temperatures').checked=false;const selectedComparisons=EISComparison.select(manifest.conditions,meta(),choice,$('temperature').value);const [a,b]=await Promise.all([load(id),Promise.all(selectedComparisons.map(c=>load(c.id)))]);if(req!==requestId)return;current=a;comparison=b;$('sweep').max=current.temperatures[$('temperature').value].sweeps.length-1;$('sweep').value=sweep;$('status').hidden=true;renderAll();}
 catch(e){if(req!==requestId)return;$('status').replaceChildren(element('span',e.message+' '));const retry=element('button','Retry');retry.onclick=()=>selectCondition(id,sweep);$('status').append(retry);$('status').hidden=false;}
}
function pointFor(data,t,s){const rec=data?.temperatures[String(t)];if(!rec)return null;const i=Math.min(s,rec.sweeps.length-1);return {row:rec.sweeps[i],index:i,source:rec.source};}
function renderAll(){if(!current||current.id!==conditionId)return;const t=$('temperature').value;let count=current.temperatures[t].sweeps.length;if($('all-temperatures').checked)count=Math.min(...Object.values(current.temperatures).map(r=>r.sweeps.length));for(const other of comparison){const temps=$('all-temperatures').checked?Object.keys(current.temperatures):[t];for(const temp of temps){if(other.temperatures[temp])count=Math.min(count,other.temperatures[temp].sweeps.length);}}const previous=Number($('sweep').value);$('sweep').max=count-1;$('sweep').value=Math.min(previous,count-1);$('sweep-label').textContent=`${Number($('sweep').value)+1} / ${count}`;drawSpectrum();drawPCA();}
function drawSpectrum(){
 const t=Number($('temperature').value),s=Number($('sweep').value),view=$('view').value,selected=pointFor(current,t,s),r=selected.row;
 $('condition-title').textContent=current.label;
 const useTemps=$('all-temperatures').checked?Object.keys(current.temperatures).map(Number).sort((a,b)=>a-b):[t];
 const traces=[];let yTitle={'imag':'−Im(Z) (Ω)','real':'Re(Z) (Ω)','mag':'|Z| (Ω)','phase':'Phase (°)','nyquist':'−Im(Z) (Ω)'}[view];
 const datasets=[current,...comparison];
 for(const [di,data] of datasets.entries()){for(const temp of useTemps){const point=pointFor(data,temp,s);if(!point)continue;const row=point.row;const dark=document.documentElement.dataset.theme==='dark';const colors=dark?['#77a6ff','#f2a65f','#63ccb3','#c796ef','#f188ab','#9bbccc','#dbc769','#7abbea']:palette;const col=datasets.length>1?colors[di%colors.length]:(dark?({150:'#63ccb3',250:'#f2a65f',350:'#77a6ff'})[temp]:temperatureColors[temp]);const label=mode==='single'?data.gas+' '+data.concentration+' ppm'+(data.rh!==current.rh?' · '+data.rh+'% RH':''):'E '+data.ethanol+' / A '+data.acetone+' ppm';const name=label+' · '+temp+' °C';const key={imag:'z',nyquist:'z',real:'real',mag:'mag',phase:'phase'}[view];const x=view==='nyquist'?row.real:row.f;
 traces.push({type:'scatter',mode:'lines',x,y:row[key],name,legendgroup:data.id+'-'+temp,line:{color:col,width:di===0?2.8:2,dash:datasets.length>1&&di>=colors.length?'dot':'solid'},hovertemplate:'%{x:.5g}<br>%{y:.5g}<extra>'+name+' · sweep '+(point.index+1)+'</extra>'});
 if(view==='imag'&&$('fit-toggle').checked&&row.ok)traces.push({type:'scatter',mode:'lines',x:row.f,y:row.fit,name:name+' EMG',legendgroup:data.id+'-'+temp,showlegend:false,line:{color:col,width:1.3,dash:'dash'},hovertemplate:'%{y:.5g} Ω<extra>'+name+' · EMG fit</extra>'});}}
 $('fit-toggle').disabled=view!=='imag';
 const l=layout(view==='nyquist'?'Re(Z) (Ω)':'Frequency (Hz)',yTitle,view!=='nyquist');l.uirevision=conditionId+'-'+view+'-'+$('all-temperatures').checked+'-'+$('compare').value;l.legend={orientation:'h',y:-.22,x:0,font:{size:12},groupclick:'togglegroup'};l.margin.b=comparison.length>6?140:95;
 Plotly.react('spectrum',traces,l,config);
 $('fit-status').textContent=r.ok?'Dense fit · '+t+' °C':'Fit unavailable';
 const labels=['A','μ','σ','λ','R²'];const values=[...r.params,r.r2];$('parameters').replaceChildren();labels.forEach((label,i)=>{const box=element('div',undefined,'parameter');box.append(element('small',label),element('strong',fmt(values[i])));$('parameters').append(box);});
 const source=$('source');source.href=mode==='single'?'https://github.com/engrhamzaaliimran/tftis/blob/main/'+selected.source:'https://github.com/engrhamzaaliimran/tftis/blob/main/mixtures-data.zip';source.title=selected.source;source.textContent=mode==='single'?'View source measurement ↗':'View source mixture archive ↗';
 const note=$('measurement-note');note.textContent=`${t} °C · sweep ${s+1} · ${r.nFull} original frequency points · ${r.f.length} displayed points`;
 $('comparison-hint').textContent=comparison.length?`${comparison.length+1} conditions overlaid at the same sweep index.`+(mode==='single'&&$('compare').value.startsWith('@')?` ${current.rh}% RH; ${t} °C.`:'')+' Click a legend entry to hide or show a curve. Dashed curves are EMG fits.':$('compare').value.startsWith('@')?'Only one measured condition is available in this group.':'Overlay another condition, or compare all concentrations.';
 $('feature-table').replaceChildren();for(const temp of [150,250,350]){const p=pointFor(current,temp,s);const tr=element('tr');[temp+' °C',...(p?p.row.params:[null,null,null,null])].forEach((v,i)=>tr.append(element(i===0?'th':'td',i===0?v:fmt(v))));$('feature-table').append(tr);}
}
const ethanolColors={1:'#A7D8FF',2:'#3399FF',3:'#005BBB',6:'#001A4D'};
const gasStyles={
 Acetone_train:{name:'Acetone · training',symbol:'circle',color:'#f16913',edge:'#111'},
 Ethanol_train:{name:'Ethanol · training',symbol:'square',color:'#4292c6',edge:'#111'},
 Hydrogen_train:{name:'Hydrogen · training',symbol:'triangle-up',color:'#41ab5d',edge:'#111'},
 Ethanol_3ppm_test:{name:'Ethanol 3 ppm · test',symbol:'square-open',color:'#e7298a',edge:'#e7298a'},
 Ethanol_6ppm_test:{name:'Ethanol 6 ppm · test',symbol:'square-open',color:'#e7298a',edge:'#e7298a'},
 Hydrogen_90RH_test:{name:'Hydrogen 90% RH · test',symbol:'triangle-up-open',color:'#7b3294',edge:'#7b3294'},
 ZeroAir_50RH_test:{name:'Zero air 50% RH',symbol:'cross',color:'#b8b8b8',edge:'#333'},
 ZeroAir_80RH_test:{name:'Zero air 80% RH',symbol:'x',color:'#b8b8b8',edge:'#333'},
 Other_test:{name:'Other test',symbol:'diamond',color:'#b8b8b8',edge:'#333'}
};
let pcaColors={};
const boundPlots=new Set();
function setupPCA(){const n=manifest.pca[mode].variance.length;options($('pc-x'),Array.from({length:n},(_,i)=>[i,'PC'+(i+1)]),0);options($('pc-y'),Array.from({length:n},(_,i)=>[i,'PC'+(i+1)]),mode==='single'?3:1);options($('color-by'),[['notebook','Original notebook'],...(mode==='mixtures'?[['ethanol','Ethanol'],['acetone','Acetone']]:[['gas','Gas'],['rh','Humidity'],['group','Notebook group']])],'notebook');$('pairwise-wrap').hidden=mode!=='single';$('ellipse-wrap').hidden=mode!=='mixtures';}
function ellipseTrace(ps,x,y,color){
 const n=ps.length;if(n<3)return null;const mx=ps.reduce((s,p)=>s+p.pc[x],0)/n,my=ps.reduce((s,p)=>s+p.pc[y],0)/n;
 let a=0,b=0,d=0;for(const p of ps){const dx=p.pc[x]-mx,dy=p.pc[y]-my;a+=dx*dx;b+=dx*dy;d+=dy*dy;}a/=n-1;b/=n-1;d/=n-1;
 const delta=Math.sqrt((a-d)**2+4*b*b),l1=(a+d+delta)/2,l2=(a+d-delta)/2;if(l2<=0)return null;
 const theta=.5*Math.atan2(2*b,a-d),r1=1.5*Math.sqrt(l1),r2=1.5*Math.sqrt(l2),xx=[],yy=[];
 for(let i=0;i<=100;i++){const t=2*Math.PI*i/100;xx.push(mx+r1*Math.cos(t)*Math.cos(theta)-r2*Math.sin(t)*Math.sin(theta));yy.push(my+r1*Math.cos(t)*Math.sin(theta)+r2*Math.sin(t)*Math.cos(theta));}
 return {type:'scatter',mode:'lines',x:xx,y:yy,fill:'toself',fillcolor:'rgba('+[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).join(',')+',0.12)',line:{color:'rgba('+[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)).join(',')+',0.27)',width:1.5},hoverinfo:'skip',showlegend:false};
}
function pcaTraces(x,y){
 const data=manifest.pca[mode],choice=$('color-by').value,notebook=choice==='notebook',key=notebook?(mode==='mixtures'?'ethanol':'group'):choice,traces=[];
 if(mode==='mixtures'&&$('ellipses').checked)for(const eth of [1,2,3,6]){const ellipse=ellipseTrace(data.points.filter(p=>p.ethanol===eth),x,y,ethanolColors[eth]);if(ellipse)traces.push(ellipse);}
 const keys=mode==='single'&&notebook?Object.keys(gasStyles).filter(g=>data.points.some(p=>p.group===g)):[...new Set(data.points.map(p=>String(p[key])))].sort((a,b)=>isNaN(a-b)?a.localeCompare(b):a-b);
 keys.forEach((k,i)=>{
  const ps=data.points.filter(p=>String(p[key])===k),st=gasStyles[k];let colors,symbols,edges,size,name;
  if(mode==='single'&&notebook){colors=ps.map(p=>p.group.endsWith('_train')?(pcaColors[p.condition]||st.color):st.color);symbols=st.symbol;edges=st.edge;size=st.symbol.includes('open')?10:8;name=st.name;}
  else {colors=mode==='mixtures'&&(notebook||choice==='ethanol')?ethanolColors[k]:palette[i%palette.length];symbols=mode==='mixtures'?ps.map(p=>({4:'circle',8:'square',16:'triangle-up'})[p.acetone]):'circle';edges='#111';size=mode==='mixtures'?12:8;name=k+(key==='rh'?'% RH':mode==='mixtures'?' ppm':'');}
  traces.push({type:'scatter',mode:'markers',name,x:ps.map(p=>p.pc[x]),y:ps.map(p=>p.pc[y]),customdata:ps.map(p=>[p.condition,p.sweep]),text:ps.map(p=>manifest.conditions.find(c=>c.id===p.condition).label+' · sweep '+(p.sweep+1)+(p.group?' · '+(gasStyles[p.group]?.name||p.group):'')),marker:{color:colors,size,opacity:mode==='mixtures'?.82:1,symbol:symbols,line:{color:edges,width:mode==='single'&&String(symbols).includes('open')?1.8:.65}},hovertemplate:'%{text}<br>PC coordinates: %{x:.3f}, %{y:.3f}<extra></extra>'});
 });
 const ps=data.points.filter(p=>p.condition===conditionId&&p.sweep===Number($('sweep').value));if(ps.length)traces.push({type:'scatter',mode:'markers',name:'Selected sweep',x:ps.map(p=>p.pc[x]),y:ps.map(p=>p.pc[y]),customdata:ps.map(p=>[p.condition,p.sweep]),marker:{symbol:'circle-open',size:21,color:'#ba2d24',line:{width:2}},hoverinfo:'skip',showlegend:false});return traces;
}
function drawPCA(){
 const data=manifest.pca[mode],pairwise=mode==='single'&&$('pairwise').checked;
 $('pca').hidden=pairwise;$('pca-pairs').hidden=!pairwise;$('pc-x').disabled=pairwise;$('pc-y').disabled=pairwise;
 const plots=pairwise?[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]].map((p,i)=>({id:'pca-pair-'+i,x:p[0],y:p[1]})):[{id:'pca',x:Number($('pc-x').value),y:Number($('pc-y').value)}];
 $('pca-legend').replaceChildren();
 const symbols={circle:'●',square:'■','triangle-up':'▲','square-open':'□','triangle-up-open':'△',cross:'✚',x:'✕',diamond:'◆'};
 const entries=mode==='mixtures'?[...[1,2,3,6].map(e=>({text:'Ethanol '+e+' ppm',symbol:'●',color:ethanolColors[e]})),...[4,8,16].map(a=>({text:'Acetone '+a+' ppm',symbol:({4:'○',8:'□',16:'△'})[a],color:'#111'}))]:Object.entries(gasStyles).filter(([g])=>data.points.some(p=>p.group===g)).map(([g,s])=>({text:s.name,symbol:symbols[s.symbol],color:s.color}));
 if($('color-by').value==='notebook'||(mode==='mixtures'&&$('color-by').value==='ethanol'))for(const e of entries){const entry=element('span'),marker=element('b',e.symbol);marker.style.color=e.color;entry.append(marker,document.createTextNode(' '+e.text));$('pca-legend').append(entry);}
 for(const {id,x,y} of plots){const l=layout(`PC${x+1} (${data.variance[x].toFixed(1)}%)`,`PC${y+1} (${data.variance[y].toFixed(1)}%)`,false);l.paper_bgcolor='white';l.plot_bgcolor='white';l.font.color='#526073';l.xaxis.showgrid=false;l.yaxis.showgrid=false;l.xaxis.zeroline=false;l.yaxis.zeroline=false;l.xaxis.showline=true;l.yaxis.showline=true;l.xaxis.linecolor='#333';l.yaxis.linecolor='#333';l.uirevision=mode+'-'+x+'-'+y;l.margin={l:65,r:18,t:pairwise?40:20,b:60};l.title=pairwise?{text:`PC${x+1} vs PC${y+1}`,font:{size:15}}:undefined;l.showlegend=$('pca-legend').childElementCount===0&&!pairwise;
 Plotly.react(id,pcaTraces(x,y),l,config).then(()=>{if(!boundPlots.has(id)){$(id).on('plotly_click',e=>{const p=e.points[0]?.customdata;if(p){selectCondition(p[0],p[1]);$('workspace').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}});boundPlots.add(id);}});}
 const hasPoint=data.points.some(p=>p.condition===conditionId&&p.sweep===Number($('sweep').value));
 $('pca-note').textContent=`${data.totalRows} complete observations · 12 EMG features · ${data.trainingRows} rows fit scaling and PCA. `+(mode==='mixtures'?'Ellipses use the notebook’s 1.5-standard-deviation covariance construction for each ethanol group. ':'Filled gas markers use the notebook’s concentration colour scales; hollow markers distinguish the held-out conditions. ')+(hasPoint?'Red ring: selected sweep. ':'Selected sweep has no complete valid 12D vector. ')+'Coordinates remain fixed during selection.';
}
async function init(){try{if(!window.Plotly)throw Error('The plotting library could not load. Please reload this page.');const response=await fetch('assets/eis-data/manifest.json');if(!response.ok)throw Error('The dataset index could not load. Please reload this page.');manifest=await response.json(); const colorsResponse=await fetch('assets/eis-pca-colors.json');if(!colorsResponse.ok)throw Error('PCA colour data could not load. Please reload.');pcaColors=await colorsResponse.json();
 for(const c of manifest.conditions.filter(c=>c.mode==='mixtures').sort((a,b)=>a.ethanol-b.ethanol||a.acetone-b.acetone)){const b=element('button',`${c.ethanol} + ${c.acetone}`);b.type='button';b.dataset.condition=c.id;b.setAttribute('aria-label',c.label);b.onclick=()=>selectCondition(c.id);$('mixture-grid').append(b);}
 $('processing').textContent=manifest.processing;
 const n=element('p',undefined,'hint');n.id='measurement-note';$('spectrum').after(n);
 const details=element('details');details.append(element('summary','Inspect the 12 temperature-combined features'));const table=element('table');table.innerHTML='<thead><tr><th>Temperature</th><th>A</th><th>μ</th><th>σ</th><th>λ</th></tr></thead><tbody id="feature-table"></tbody>';details.append(table);document.querySelector('.fit-panel').append(details);
 $('workspace').hidden=false;$('pca-panel').hidden=false;setupPCA();
 for(const m of ['mixtures','single'])$(m).onclick=()=>{mode=m;setupPCA();$('compare').value='';selectCondition(conditions().find(c=>c.id==='mix-e1-a4')?.id||conditions()[0].id);};
 $('gas').onchange=()=>selectCondition(conditions().find(c=>c.gas===$('gas').value).id);
 $('rh').onchange=()=>selectCondition(conditions().find(c=>c.gas===$('gas').value&&c.rh===Number($('rh').value)).id);
 $('concentration').onchange=()=>selectCondition($('concentration').value);
 $('compare').onchange=()=>selectCondition(conditionId,Number($('sweep').value));
 $('temperature').onchange=()=>selectCondition(conditionId,Number($('sweep').value));
 for(const id of ['view','fit-toggle','all-temperatures'])$(id).onchange=()=>{stop();renderAll();};
 $('sweep').oninput=()=>{stop();renderAll();};
 for(const id of ['pc-x','pc-y','color-by','pairwise','ellipses'])$(id).onchange=drawPCA;
 $('play').onclick=()=>{if(timer){stop();return;}if(matchMedia('(prefers-reduced-motion: reduce)').matches){/* Playback is still explicitly user initiated. */}timer=setInterval(()=>{$('sweep').value=(Number($('sweep').value)+1)%(Number($('sweep').max)+1);renderAll();},1000);$('play').textContent='Ⅱ Pause';};
 $('reset').onclick=()=>{stop();$('view').value='imag';$('temperature').value='350';$('fit-toggle').checked=true;$('all-temperatures').checked=false;$('compare').value='';setupPCA();selectCondition(conditionId,0);};
 new MutationObserver(()=>{if(current)renderAll();}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});await selectCondition(conditionId);
 }catch(e){$('status').hidden=false;$('status').textContent=e.message;}}
init();
