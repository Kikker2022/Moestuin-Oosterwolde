'use strict';
// Mijn Slimme Moestuin 2.2.5 — jaarkopie en Verschuifvak
const KEY='mijn-slimme-moestuin-v1';
// Geen automatische opslag bij het openen: beschermt bestaande tuinplannen.
const crops=[['Leeg','#d5d8c9'],['Aardappel','#a9c984'],['Wortel','#edc27b'],['Ui','#b9c7ec'],['Bonen','#9ed2af'],['Kool','#d8a6bb'],['Sla','#b6db86'],['Prei','#a4c9d4'],['Biet','#d6a0a0'],['Spinazie','#7ebf8e']];
// Versie 1.7: voorbeeldrassen; eigen rassen worden in het tuinplan opgeslagen.
const knownVarieties={
  1:['Annabelle','Frieslander','Agria','Bildtstar','Doré','Eigenheimer','Nicola','Charlotte','Bintje'],
  2:['Nantes 2','Amsterdamse Bak','Berlikumer','Flakkee 2','Parijse Markt'],
  3:['Sturon','Stuttgarter Riesen','Red Baron','Rijnsburger'],
  4:['Stamslaboon Prelude','Dubbele Witte','Neckarkönigin','Helda'],
  5:['Bloemkool Alpha','Boerenkool Westlandse Winter','Spitskool Caraflex','Broccoli Calabrese'],
  6:['Kropsla Meikoningin','Lollo Rossa','Little Gem','Eikenbladsla'],
  7:['Blauwgroene Herfst','Herfstreuzen 2','Bulgaarse Reuzen'],
  8:['Detroit 2','Egyptische Platronde','Chioggia','Cylindra'],
  9:['Winterreuzen','Matador','Viroflay']
};
const extraCrops=['Tomaat','Komkommer','Courgette','Pompoen','Paprika','Peper','Radijs','Pastinaak','Knolselderij','Bleekselderij','Venkel','Erwt','Peultjes','Tuinboon','Mais','Rucola','Andijvie','Snijbiet','Aardbei','Framboos','Braam','Blauwe bes','Rode bes','Zwarte bes','Druif','Rabarber','Appel','Peer','Kers','Pruim','Kruiden'];
extraCrops.forEach((name,i)=>crops.push([name,['#c3dda6','#e7c7a5','#b4d8bd','#d4c7e5','#efd59a'][i%5]]));
const cropNames=()=>crops.map((c,i)=>({id:i,name:c[0]})).filter(c=>c.id>0 && !(state?.hiddenCropIds||[]).includes(c.id)).sort((a,b)=>a.name.localeCompare(b.name,'nl',{sensitivity:'base'}));
const cellVarieties=c=>Array.isArray(c.varieties)?c.varieties:[];
const varietyLabel=c=>{const v=cellVarieties(c);return v.length===1?v[0].name:v.length>1?v.length+' rassen':(crops[c.crop]?.[0]||'Leeg')};
function ensureLibrary(){if(!Array.isArray(state.customVarieties))state.customVarieties=[]}
function availableVarieties(crop){ensureLibrary();return [...new Set([...(knownVarieties[crop]||[]),...state.customVarieties.filter(v=>v.crop===crop).map(v=>v.name)])].sort((a,b)=>a.localeCompare(b,'nl'))}
function addCustomVariety(crop,name){ensureLibrary();name=String(name||'').trim();if(!name)return false;if(!state.customVarieties.some(v=>v.crop===crop&&v.name.toLowerCase()===name.toLowerCase()))state.customVarieties.push({crop,name});return true}
const $=id=>document.getElementById(id);
const clone=v=>JSON.parse(JSON.stringify(v));
// Basis: 30 m lang; links 0,5 m pad, A 5 m, B 5 m, rechts 0,5 m pad.
const initial=()=>({catalog:[],nextCatalogId:1,length:30,width:11,year:'2026',nextId:1,layout:'AB-30x5',objects:[]});
let state;try{state=JSON.parse(localStorage.getItem(KEY))||initial();if(!Array.isArray(state.objects)||!state.length||!state.width)throw Error()}catch{state=initial()}
let selected=null,selectedCell=null,history=[],drag=null;
let managedCropSelection=''; // Vóór de eerste paint() initialiseren
function ensureCatalog(){if(!Array.isArray(state.catalog))state.catalog=[];if(!Number.isInteger(state.nextCatalogId))state.nextCatalogId=1;for(const e of state.catalog){const n=Number(e.id);if(Number.isFinite(n)&&n>=state.nextCatalogId)state.nextCatalogId=n+1}}
ensureCatalog();
function applyCropOverrides(){for(const [id,def] of Object.entries(state.cropOverrides||{})){const n=Number(id);if(crops[n]&&def?.name&&def?.color)crops[n]=[def.name,def.color]}}
function loadCustomCrops(){for(const e of state.extraCropDefs||[]){if(!crops.some(c=>c[0]===e.name))crops.push([e.name,e.color||"#a9c984"])}for(const [key,v] of Object.entries(state.cropOverrides||{})){const id=Number(key);if(crops[id]&&v?.name&&v?.color)crops[id]=[v.name,v.color]}}
loadCustomCrops();
applyCropOverrides();
const HISTORY_KEY=KEY+'-history-v15';
try {const stored=JSON.parse(localStorage.getItem(HISTORY_KEY));if(Array.isArray(stored))history=stored.filter(s=>s&&Array.isArray(s.objects)).slice(-40)}catch{}
function storeHistory(){try{localStorage.setItem(HISTORY_KEY,JSON.stringify(history))}catch{notify('Geschiedenis kon niet worden opgeslagen')}}
function updateUndo(){$('undo').disabled=!history.length;if($('rotatePrevious'))$('rotatePrevious').disabled=!history.length}

let mapZoom=100;
function applyZoom(){
 const map=$('map'),outer=$('mapOuter');
 // 100% vult de beschikbare breedte; hoogte volgt uit de SVG-viewBox.
 // Geen fit-op-hoogte: dat maakte de 30 meter lange tuin slechts 1/3 breed.
 const availableW=Math.max(100,outer.clientWidth-4);
 map.style.minWidth='0';
 map.style.width=(availableW*mapZoom/100)+'px';
 map.style.height='auto';
 $('mapZoom').value=mapZoom;
 $('zoomValue').textContent=mapZoom+'%';
 requestAnimationFrame(()=>{if(typeof syncHorizontalSlider==='function')syncHorizontalSlider()});
}
$('mapZoom').addEventListener('input',e=>{mapZoom=Number(e.target.value);applyZoom()});
$('zoomOut').onclick=()=>{mapZoom=Math.max(40,mapZoom-10);applyZoom()};

$('zoomIn').onclick=()=>{mapZoom=Math.min(200,mapZoom+10);applyZoom()};
const BUFFER_LEFT=5.5,BUFFER_WIDTH=5.2;
const isInYear=(o,year)=>o.type==='path'||o.perennial||
 (!o.registerOnly&&!o.hiddenYears?.includes(String(year))&&(!o.year||String(o.year)===String(year)));
const visible=o=>isInYear(o,state.year);
let openBufferYear=null;
const parkedObjects=()=>state.objects.filter(o=>o.parked&&visible(o));
const bufferOpen=()=>openBufferYear===String(state.year)||parkedObjects().length>0;
const activeObjects=()=>state.objects.filter(visible);
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));$('status').textContent='✓ Lokaal opgeslagen';if(window.gardenCloudChanged)window.gardenCloudChanged(clone(state))}catch{$('status').textContent='Opslag niet beschikbaar'}}
function checkpoint(){history.push(clone(state));if(history.length>40)history.shift();storeHistory();updateUndo()}
function notify(s){$('status').textContent=s;setTimeout(()=>{if($('status').textContent===s)$('status').textContent='✓ Opgeslagen'},2600)}
// Rotatie: positie (x,y) is steeds de linkerbovenhoek van de omhullende rechthoek.
function rotationInfo(o){
 const angle=((Number(o.rotation)||0)%360+360)%360;
 const swapped=angle%180>=90;
 const w=swapped?o.length:o.width,h=swapped?o.width:o.length;
 const localAngle=angle%90;
 const radians=localAngle*Math.PI/180;
 const bw=Math.abs(w*Math.cos(radians))+Math.abs(h*Math.sin(radians));
 const bh=Math.abs(w*Math.sin(radians))+Math.abs(h*Math.cos(radians));
 return {angle,swapped,localAngle,w,h,bw,bh};
}
function dims(o){const r=rotationInfo(o);return {w:r.bw,h:r.bh}}
function polygon(o){
 const r=rotationInfo(o),cx=o.x+r.bw/2,cy=o.y+r.bh/2;
 const a=r.localAngle*Math.PI/180,co=Math.cos(a),si=Math.sin(a);
 return [[-r.w/2,-r.h/2],[r.w/2,-r.h/2],[r.w/2,r.h/2],[-r.w/2,r.h/2]].map(([x,y])=>({x:cx+x*co-y*si,y:cy+x*si+y*co}));
}
function polygonsOverlap(a,b){
 for(const poly of [a,b])for(let i=0;i<poly.length;i++){
  const j=(i+1)%poly.length,dx=poly[j].x-poly[i].x,dy=poly[j].y-poly[i].y;
  const nx=-dy,ny=dx,pa=a.map(p=>p.x*nx+p.y*ny),pb=b.map(p=>p.x*nx+p.y*ny);
  if(Math.max(...pa)<=Math.min(...pb)+.001||Math.max(...pb)<=Math.min(...pa)+.001)return false;
 }
 return true;
}
function fits(o,exclude=o.id){
 const poly=polygon(o),eps=.00001;
 if(poly.some(p=>p.x<-eps||p.y<-eps||p.x>(o.parked?BUFFER_WIDTH:state.width)+eps||p.y>state.length+eps))return false;
 if(o.parked&&o.perennial)return false;
 if(o.type==='bed'&&!o.parked&&!([.5,5.5].some(left=>poly.every(p=>p.x>=left-eps&&p.x<=left+5+eps))))return false;
 if(o.type==='path'&&!o.parked&&poly.some(p=>p.x<.5-eps||p.x>10.5+eps))return false;
 return !state.objects.some(q=>q.id!==exclude&&samePlacementSpace(o,q)&&polygonsOverlap(poly,polygon(q)));
}
function samePlacementSpace(o,q){
 if(o.registerOnly||q.registerOnly||Boolean(o.parked)!==Boolean(q.parked))return false;
 if(o.type==='path'&&q.type==='path')return false;
 if(o.type!=='bed'||q.type!=='bed'||o.perennial||q.perennial)return true;
 return (!o.year||isInYear(q,o.year))&&(!q.year||isInYear(o,q.year));
}
function sections(o){
 if(!o.sections)o.sections={};
 const sectionYear=o.perennial?String(o.perennialSource||o.year||state.year):state.year;
 if(!o.sections[sectionYear])o.sections[sectionYear]=[{crop:0,length:o.length}];
 const rows=o.sections[sectionYear];
 // Migratie: bestaande versie 1.2 gebruikt één gewas per lengtesegment.
 rows.forEach(r=>{if(!Array.isArray(r.cols))r.cols=[{crop:r.crop||0,width:o.width}];});
 return rows;
}
function areaRows(o){return sections(o).reduce((sum,r)=>sum+r.length*r.cols.reduce((s,c)=>s+c.width,0),0)}
function gardenSection(o){if(o.parked)return 'V';const d=dims(o),mid=o.x+d.w/2;return mid<BUFFER_LEFT?'A':'B'}
function paint(){const svg=$('map');svg.replaceChildren();const NS='http://www.w3.org/2000/svg';const add=(tag,attrs,parent=svg)=>{const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));parent.appendChild(e);return e};const pad=1;
const gap=bufferOpen()?BUFFER_WIDTH:0;
const mapWidth=state.width+gap;
svg.setAttribute('viewBox',`0 0 ${mapWidth+2*pad} ${state.length+2*pad}`);
add('rect',{x:pad,y:pad,width:mapWidth,height:state.length,fill:'#ded5b9',stroke:'#75866d','stroke-width':'.08'});
if(state.layout==='AB-30x5'){
 for(const [x,w,fill,label] of [[0,.5,'#d1c5a9',''],[.5,5,'#c6dda9','A'],[5.5,5,'#d1e3b5','B'],[10.5,.5,'#d1c5a9','']]){
  const left=pad+x+(x>=BUFFER_LEFT?gap:0);
  add('rect',{x:left,y:pad,width:w,height:state.length,fill,stroke:'#8ca17e','stroke-width':'.045'});
  if(label){const t=add('text',{x:left+w/2,y:pad+state.length/2,'text-anchor':'middle','font-size':'.9','font-weight':'bold',fill:'#416542','pointer-events':'none'});t.textContent=label;}
 }
}
if(gap){
 add('rect',{x:pad+BUFFER_LEFT,y:pad,width:gap,height:state.length,fill:'#e8f3e8',stroke:'#39764e','stroke-width':'.07','stroke-dasharray':'.3 .16'});
 for(const y of [.65,state.length/2]){
  const title=add('text',{x:pad+BUFFER_LEFT+gap/2,y:pad+y,'text-anchor':'middle','font-size':'.56','font-weight':'bold',fill:'#25563b','pointer-events':'none'});
  title.textContent='Verschuifvak · 5,20 m';
 }
}
for(let x=0;x<=mapWidth;x++){add('line',{x1:x+pad,y1:pad,x2:x+pad,y2:pad+state.length,stroke:'#ffffff','stroke-opacity':'.4','stroke-width':'.025'})}for(let y=0;y<=state.length;y++){add('line',{x1:pad,y1:y+pad,x2:pad+mapWidth,y2:y+pad,stroke:'#ffffff','stroke-opacity':'.4','stroke-width':'.025'})}
function drawPath(o,parent=svg,shift=0){
 const corners=polygon(o);
 const points=vertices=>vertices.map(({x,y})=>`${pad+x+shift},${pad+y}`).join(' ');
 const g=add('g',{'data-id':o.id,'data-path-outline':'','cursor':'grab'},parent);
 const active=selected===o.id;
 add('polygon',{points:points(corners),fill:'#eee8d8',
  stroke:active?'#20583c':'#8e957e','stroke-width':active?.045:.025},g);
 const middle=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
 const r=rotationInfo(o);
 const ends=r.w>=r.h?[middle(corners[0],corners[3]),middle(corners[1],corners[2])]:
  [middle(corners[0],corners[1]),middle(corners[3],corners[2])];
 add('polyline',{points:points(ends),fill:'none',stroke:'#9c927d',
  'stroke-width':'.045','stroke-dasharray':'.18 .16','pointer-events':'none'},g);
 const label=add('text',{x:pad+o.x+shift+.1,y:pad+o.y+.27,
  'font-size':'.19',fill:'#1f432b','pointer-events':'none'},g);
 label.textContent=`P${String(o.id).padStart(2,'0')}`;
 return g;
}
function drawObject(o,x,parent=svg){
 const g=add('g',{'data-id':o.id,transform:`translate(${pad+x} ${pad+o.y})`},parent);
 const d=dims(o),r=rotationInfo(o),active=selected===o.id;
 const shape=r.localAngle?add('g',{transform:`translate(${d.w/2} ${d.h/2}) rotate(${r.localAngle}) translate(${-r.w/2} ${-r.h/2})`},g):g;
 const shapeW=r.w,shapeH=r.h;
 add('rect',{x:0,y:0,width:shapeW,height:shapeH,rx:.08,fill:'#a2c98a',stroke:active?'#20583c':'#8e957e','stroke-width':active?.028:.012},shape);
 let along=0;
 sections(o).forEach((row,i)=>{
  let across=0;
  row.cols.forEach((col,j)=>{
   const crop=crops[col.crop]||crops[0];
   const x=!r.swapped?across:along;
   const y=!r.swapped?along:across;
   const w=!r.swapped?col.width:row.length;
   const h=!r.swapped?row.length:col.width;
   add('rect',{x,y,width:w,height:h,fill:crop[1],stroke:selected===o.id&&selectedCell?.i===i&&selectedCell?.j===j?'#ff8b00':'#385b39','stroke-width':selected===o.id&&selectedCell?.i===i&&selectedCell?.j===j?'.045':'.012','data-row':i,'data-col':j},shape);
   // Naam en ras blijven ook in smalle stroken leesbaar: draai de tekst
   // wanneer het vak hoger dan breed is. Bij weinig ruimte verklein de tekst.
   const names=(col.varieties||[]).map(v=>v.name).filter(Boolean);
   const customName=String(col.label||'').trim();
   const line1=customName||crop[0];
   const line2=names.length?names.join(', '):'';
   const lines=[line1,...(line2?[line2]:[])];
   const vertical=h>w*1.4;
   const availW=vertical?h:w,availH=vertical?w:h;
   const longest=Math.max(...lines.map(v=>v.length),1);
   const fontSize=Math.max(.045,Math.min(.28,availH/(lines.length*1.4),availW/(longest*.57)));
   const labelGroup=vertical?add('g',{transform:`translate(${x+w/2} ${y+h/2}) rotate(-90)`},shape):add('g',{transform:`translate(${x+w/2} ${y+h/2})`},shape);
   lines.forEach((line,li)=>{
     const text=add('text',{x:0,y:(li-(lines.length-1)/2)*fontSize*1.15,'text-anchor':'middle','dominant-baseline':'middle','font-size':fontSize,'font-weight':'650',fill:'#173924','pointer-events':'none'},labelGroup);
     text.textContent=line;
   });
   across+=col.width;
  });
  along+=row.length;
 });
 add('rect',{x:0,y:0,width:shapeW,height:shapeH,fill:'none',stroke:active?'#215a3e':'#68846a','stroke-width':active?.028:.012},shape);
 const t=add('text',{x:.1,y:.27,'font-size':'.19','font-weight':'400',fill:'#1f432b','pointer-events':'none'},shape);
 t.textContent=`${gardenSection(o)}-S${String(o.id).padStart(2,'0')}`;
}
const objects=activeObjects();
const draggedPath=drag?.path&&drag.plan===state&&drag.original.year===state.year?
 objects.find(o=>o.id===drag.id):null;
// Alleen bij een pad over de grens knippen we de tekening in twee delen.
const pathLayers=gap?[0,gap].map(shift=>{
 const id=shift?'path-clip-b':'path-clip-a';
 const clip=add('clipPath',{id});
 add('rect',{x:pad+(shift?BUFFER_LEFT+gap:0),y:pad,
  width:shift?Math.max(0,state.width-BUFFER_LEFT):BUFFER_LEFT,height:state.length},clip);
 return add('g',{'clip-path':`url(#${id})`});
}):null;
for(const o of objects){
 if(o.type!=='path'||o===draggedPath)continue;
 if(o.parked){
  drawPath(o,svg,BUFFER_LEFT);
  continue;
 }
 const crosses=o.x<BUFFER_LEFT-.00001&&o.x+dims(o).w>BUFFER_LEFT+.00001;
 if(!gap||!crosses){
  drawPath(o,svg,o.x>=BUFFER_LEFT-.00001?gap:0);
  continue;
 }
 drawPath(o,pathLayers[0]);
 drawPath(o,pathLayers[1],gap);
 // Een dunne verbindingslijn toont dat beide stukken bij hetzelfde pad horen.
 const corners=polygon(o),heights=[];
 corners.forEach((p,i)=>{
  const q=corners[(i+1)%corners.length];
  if((p.x<BUFFER_LEFT)===(q.x<BUFFER_LEFT))return;
  heights.push(p.y+(q.y-p.y)*(BUFFER_LEFT-p.x)/(q.x-p.x));
 });
 const y=pad+(Math.min(...heights)+Math.max(...heights))/2;
 add('line',{'data-id':o.id,'data-path-connection':'',x1:pad+BUFFER_LEFT,y1:y,
  x2:pad+BUFFER_LEFT+gap,y2:y,stroke:'#81745f','stroke-width':'.045',
  'stroke-dasharray':'.15 .2',cursor:'grab'});
}
for(const o of objects){
 if(o.type==='path')continue;
 const x=o.parked?BUFFER_LEFT+o.x:o.x+(gardenSection(o)==='B'?gap:0);
 drawObject(o,x);
}
if(draggedPath){
 const preview=add('g',{'data-path-preview':'','pointer-events':'none','opacity':'.8'});
 drawPath(draggedPath,preview,drag.displayOffset);
 drag.preview=preview;
}
renderPlanningControls();
$('areaText').textContent=state.layout==='AB-30x5'?'Teeltgrond: 300 m² · buitenpaden: 30 m² · totaal: 330 m²':`Oppervlakte: ${(state.length*state.width).toLocaleString('nl-NL',{maximumFractionDigits:2})} m²`;renderEditor();renderTotals();renderLibrary();renderRegister();renderCatalog()}
function renderTotals(){
 const sums=new Map();let used=0;
 activeObjects().filter(o=>o.type==='bed').forEach(o=>sections(o).forEach(r=>r.cols.forEach(c=>{
  const area=r.length*c.width;used+=area;
  if(c.crop)sums.set(c.crop,(sums.get(c.crop)||0)+area);
 })));
 $('cropTotals').textContent=`In ${state.year} ingedeeld: ${used.toLocaleString('nl-NL',{maximumFractionDigits:2})} m² · `+(sums.size?[...sums].map(([id,a])=>`${String(id).padStart(2,'0')} ${crops[id]?.[0]||'?'}: ${a.toLocaleString('nl-NL',{maximumFractionDigits:2})} m²`).join(' · '):'nog geen groenten toegewezen');
 const legend=$('cropLegend');legend.replaceChildren();cropNames().forEach(({id:i,name})=>{const color=crops[i]?.[1];const item=document.createElement('span');item.className='legendItem';const sw=document.createElement('i');sw.style.background=color;item.append(sw,document.createTextNode(`${String(i).padStart(2,'0')} ${name}`));legend.append(item)});renderCropManager();
}
$('editSelectedBed').onclick=()=>{
 const o=state.objects.find(x=>x.id===selected&&visible(x));if(!o)return;
 const editor=$('editPanel');
 if(o.type==='path'){
  const area=$('advancedTools');area.hidden=false;
  $('toggleAdvanced').setAttribute('aria-expanded','true');
  $('toggleAdvanced').textContent='⚙ Geavanceerd sluiten';
  editor.scrollIntoView({behavior:'smooth',block:'start'});
  setTimeout(()=>area.scrollIntoView({behavior:'smooth',block:'nearest'}),180);
 }else{
  editor.scrollIntoView({behavior:'smooth',block:'start'});
  const quick=$('quickEdit');if(quick&&!quick.hidden){setTimeout(()=>quick.scrollIntoView({behavior:'smooth',block:'nearest'}),200)}
 }
};
let editorSubsection=null;
function setEditorSubsection(which){
 editorSubsection=editorSubsection===which?null:which;
 const o=state.objects.find(x=>x.id===selected);
 $('sectionsWrap').hidden=!(editorSubsection==='distribution'&&o?.type==='bed');
 $('cultivationWrap').hidden=!(editorSubsection==='cultivation'&&o?.type==='bed');
 for(const [id,value] of [['toggleDistribution','distribution'],['toggleCultivation','cultivation']]){
  $(id).setAttribute('aria-expanded',String(editorSubsection===value));
 }
 if(editorSubsection==='cultivation')renderCultivationPanel();
}
$('toggleDistribution').onclick=()=>setEditorSubsection('distribution');
$('toggleCultivation').onclick=()=>setEditorSubsection('cultivation');
$('saveDistribution').onclick=()=>{save();notify('✓ Verdeling opgeslagen');setEditorSubsection('distribution')};
$('saveCultivation').onclick=()=>{
 const buttons=[...$('cultivationContent').querySelectorAll('.varietyCard button')].filter(b=>b.textContent.includes('Teeltgegevens opslaan'));
 buttons.forEach(b=>b.click());
 save();notify('✓ Teeltgegevens opgeslagen');
};
$('cultivationCell').onchange=()=>{
 const [i,j]=$('cultivationCell').value.split(':').map(Number);
 selectedCell={i,j};renderCultivationPanel();
};
function renderCultivationPanel(){
 const o=state.objects.find(x=>x.id===selected);
 const picker=$('cultivationCell'),root=$('cultivationContent');
 picker.replaceChildren();root.replaceChildren();
 if(!o||o.type!=='bed')return;
 const rows=sections(o);
 rows.forEach((r,i)=>r.cols.forEach((cell,j)=>picker.append(new Option(`Vak ${i+1}.${j+1} · ${crops[cell.crop]?.[0]||'Geen groente'}`,`${i}:${j}`))));
 let i=selectedCell?.i??0,j=selectedCell?.j??0;
 if(!rows[i]?.cols[j]){i=0;j=0}
 picker.value=`${i}:${j}`;
 const cell=rows[i]?.cols[j];if(cell)root.append(renderVarietyEditor(cell,i,j));
}
function renderEditor(){
 const o=state.objects.find(x=>x.id===selected && visible(x));
 $('editor').hidden=!o;$('editorEmpty').hidden=!!o;
 $('editSelectedBed').hidden=!o;
 $('editSelectedBed').textContent=o?.type==='path'?'Bewerken geselecteerd looppad':'Bewerken geselecteerde strook';
 $('editTitle').textContent=o?(o.type==='bed'?`${o.parked?'Verschuifvak':'Tuingedeelte '+gardenSection(o)} · Strook S${String(o.id).padStart(2,'0')}`:`Looppad P${String(o.id).padStart(2,'0')}`):'Selecteer een strook of pad';
 if(!o)return;
 const quick=$('quickEdit');quick.hidden=o.type!=='bed';
 if(o.type==='bed'){
   const loc=selectedCell||{i:0,j:0};
   const cell=sections(o)[loc.i]?.cols[loc.j]||sections(o)[0]?.cols[0];
   $('quickEditHelp').textContent=`Bewerk vak ${loc.i+1}.${loc.j+1} in deze strook. Tik op een ander vakje om dat te kiezen.`;
   $('quickName').value=cell?.label||'';
   const picker=$('quickCrop');picker.replaceChildren();
   crops.map(([name],id)=>({name,id})).filter(v=>!(state.hiddenCropIds||[]).includes(v.id)||v.id===cell?.crop).sort((a,b)=>a.name.localeCompare(b.name,'nl',{sensitivity:'base'})).forEach(({name,id})=>picker.append(new Option(name,String(id))));
   picker.value=String(cell?.crop||0);
   $('quickVariety').value=(cell?.varieties||[]).map(v=>v.name).filter(Boolean).join(', ');
   quickSelectedVarieties=new Set((cell?.varieties||[]).map(v=>v.name).filter(Boolean));
   setQuickRasMode('existing');refreshQuickSuggestions();
 }
 $('perennialEditorRow').hidden=o.type!=='bed';$('objPerennial').checked=!!o.perennial;
 for(const [id,key] of [['objWidth','length'],['objLength','width'],['objX','x'],['objY','y']])$(id).value=o[key];
 for(const id of ['splitTripleAcross','splitTripleAlong','clearBedSplits'])$(id).hidden=o.type!=='bed';
 $('split').hidden=o.type!=='bed';if($('splitWidth'))$('splitWidth').hidden=o.type!=='bed';$('editorSubsectionButtons').hidden=o.type!=='bed';$('sectionsWrap').hidden=!(o.type==='bed'&&editorSubsection==='distribution');$('cultivationWrap').hidden=!(o.type==='bed'&&editorSubsection==='cultivation');
 $('sections').replaceChildren();
  if(o.type==='bed'&&!selectedCell){const tip=document.createElement('p');tip.className='hint';tip.textContent='Kies hieronder bij het juiste vak “Teeltgegevens openen”. Je ziet dan alleen de rassen van dat vak.';$('sections').append(tip)}
 if(o.type!=='bed')return;
 sections(o).forEach((r,i)=>{
  const group=document.createElement('div');group.className='sectionGroup';
  const heading=document.createElement('div');heading.className='sectionHeading';
  const title=document.createElement('strong');title.textContent=`Lengtedeel ${i+1} · ${r.length.toFixed(2)} m`;
  const splitL=document.createElement('button');splitL.className='secondary smallButton';splitL.textContent='✂ Deel deze lengtemaat';
  splitL.onclick=()=>splitLength(i);
  heading.append(title,splitL);if(i<sections(o).length-1){const mergeL=document.createElement('button');mergeL.className='secondary smallButton';mergeL.textContent='↔ Samenvoegen met volgend lengtedeel';mergeL.onclick=()=>mergeLength(i);heading.append(mergeL)}group.append(heading);
  const lengthLabel=document.createElement('label');lengthLabel.textContent='Lengte van dit deel (m)';
  const lengthInput=document.createElement('input');lengthInput.type='number';lengthInput.min='.2';lengthInput.step='.1';lengthInput.value=+r.length.toFixed(2);lengthInput.disabled=i===sections(o).length-1;
  lengthInput.onchange=()=>{
   const next=sections(o)[i+1],v=Number(lengthInput.value);
   if(!next||!Number.isFinite(v)||v<.2||next.length-(v-r.length)<.2){notify('Onvoldoende ruimte voor deze lengte');paint();return}
   checkpoint();next.length-=v-r.length;r.length=v;save();paint();
  };
  lengthLabel.append(lengthInput);group.append(lengthLabel);
  r.cols.forEach((c,j)=>{
   const row=document.createElement('div');row.className='sectionRow';
   const a=document.createElement('label');a.textContent=`Vak ${i+1}.${j+1} · Groente`;
   const select=document.createElement('select');
   cropNames().forEach(({name:n,id:k})=>{const opt=document.createElement('option');opt.value=k;opt.textContent=n;select.append(opt)});
   select.value=c.crop;
   select.onchange=()=>{const newCrop=Number(select.value);if(cellVarieties(c).length&&!confirm('De rassenregistraties in dit vak wissen omdat je het gewas verandert?')){paint();return}checkpoint();c.crop=newCrop;c.varieties=[];save();paint()};a.append(select);
   const b=document.createElement('label');b.textContent='Breedte (m)';
   const inp=document.createElement('input');inp.type='number';inp.min='.2';inp.step='.1';inp.value=+c.width.toFixed(2);inp.disabled=j===r.cols.length-1;
   inp.onchange=()=>{
    const next=r.cols[j+1],v=Number(inp.value);
    if(!next||!Number.isFinite(v)||v<.2||next.width-(v-c.width)<.2){notify('Onvoldoende ruimte voor deze breedte');paint();return}
    checkpoint();next.width-=v-c.width;c.width=v;save();paint();
   };b.append(inp);
   const info=document.createElement('div');info.className='cellInfo';info.textContent=`${(r.length*c.width).toFixed(2)} m²`;
   const splitW=document.createElement('button');splitW.className='secondary smallButton';splitW.textContent='✂ Deel deze breedtemaat';splitW.onclick=()=>splitWidth(i,j);
   const choose=document.createElement('button');choose.className='secondary smallButton';choose.textContent=selectedCell?.i===i&&selectedCell?.j===j?'✓ Gegevens van dit vak geopend':'🌱 Teeltgegevens openen';choose.onclick=()=>{selectedCell={i,j};paint()};row.append(a,b,info,splitW,choose);if(j<r.cols.length-1){const mergeW=document.createElement('button');mergeW.className='secondary smallButton';mergeW.textContent='↔ Samenvoegen met volgend vak';mergeW.onclick=()=>mergeWidth(i,j);row.append(mergeW)}if(selectedCell?.i===i&&selectedCell?.j===j){row.classList.add('selectedCell')}group.append(row);/* Teeltgegevens staan nu in het afzonderlijke paneel. */
  });
  $('sections').append(group);
 });
 if(editorSubsection==='cultivation')renderCultivationPanel();
}
function renderVarietyEditor(c,i,j){
 const wrap=document.createElement('div');wrap.className='varietyEditor';
 const heading=document.createElement('strong');heading.textContent=`${crops[c.crop]?.[0]||'Leeg'} · teeltgegevens vak ${i+1}.${j+1}`;wrap.append(heading);
 const note=document.createElement('p');note.className='hint';note.textContent='Kies een ras uit je centrale moestuinregister. Teeltresultaten blijven per vak afzonderlijk bewerkbaar.';wrap.append(note);
 if(!c.crop){const msg=document.createElement('p');msg.className='hint';msg.textContent='Kies eerst een gewas hierboven.';wrap.append(msg);return wrap}
   const pick=document.createElement('select');pick.style.flex='1';pick.append(new Option('Kies een ras uit moestuinregister…',''));ensureCatalog();state.catalog.filter(e=>Number(e.crop)===Number(c.crop)).forEach(e=>pick.append(new Option(`${e.id} · ${e.name} (${e.shop||'geen winkel'})`,String(e.id))));
  const add=document.createElement('button');add.className='smallButton';add.textContent='+ Toewijzen aan dit vak';add.onclick=()=>{const entry=state.catalog.find(e=>String(e.id)===pick.value);if(!entry){notify('Kies eerst een ras uit de lijst');return}checkpoint();c.varieties??=[];const v=newVariety(c.crop,entry.name);Object.assign(v,{catalogId:entry.id,shop:entry.shop||'',price:entry.price||'',amount:entry.amount||''});c.varieties.push(v);save();paint()};
  const open=document.createElement('button');open.className='secondary smallButton';open.textContent='Moestuinregister';open.onclick=()=>{const panel=$('catalogContent');panel.hidden=false;$('toggleCatalog').setAttribute('aria-expanded','true');$('toggleCatalog').textContent='Moestuinregister';renderCatalog();$('catalogPanel').scrollIntoView({behavior:'smooth'})};
  const actions=document.createElement('div');actions.className='toolbar';actions.append(pick,add,open);wrap.append(actions);
cellVarieties(c).forEach((v,k)=>{
  const item=document.createElement('div');item.className='varietyCard';
  const top=document.createElement('div');top.className='line';const name=document.createElement('strong');name.textContent=v.name;
  const del=document.createElement('button');del.className='danger smallButton';del.textContent='Verwijder ras';del.onclick=()=>{if(!confirm('Dit ras uit dit vak verwijderen?'))return;checkpoint();c.varieties.splice(k,1);save();paint()};top.append(name,del);item.append(top);
  const fields=document.createElement('div');fields.className='varietyFields';
  const draft={...v};
  const specs=[['shop','Gekocht bij','text'],['price','Prijs (€)','number'],['amount','Hoeveelheid / verpakking','text'],['month','Tuinmaand','month'],['planting','Zaai- of pootdatum','date'],['harvestFrom','Oogst vanaf','date'],['harvestTo','Oogst tot','date'],['weather','Weersomstandigheden','text'],['rating','Beoordeling (1–5)','select'],['notes','Oogstresultaat / opmerkingen','text']];
  specs.forEach(([key,label,type])=>{const lab=document.createElement('label');lab.textContent=label;let inp;
   if(type==='month'){inp=document.createElement('select');[['','Niet ingevuld'],...monthNames.map((m,i)=>[String(i+1),m])].forEach(([value,title])=>{const o=document.createElement('option');o.value=value;o.textContent=title;inp.append(o)})}
    else if(type==='select'){inp=document.createElement('select');[['','Nog niet beoordeeld'],['1','1 ster'],['2','2 sterren'],['3','3 sterren'],['4','4 sterren'],['5','5 sterren']].forEach(([value,title])=>{const o=document.createElement('option');o.value=value;o.textContent=title;inp.append(o)})}
   else {inp=document.createElement('input');inp.type=type;if(type==='number'){inp.min='0';inp.step='.01'}}
   inp.value=(key==='harvestFrom'?harvestStart(v):v[key])??'';inp.oninput=()=>{draft[key]=inp.value;status.textContent='Nog niet opgeslagen'};inp.onchange=()=>{draft[key]=inp.value;status.textContent='Nog niet opgeslagen'};lab.append(inp);fields.append(lab)
  });
  const repeat=document.createElement('label');repeat.className='varietyRepeat';const check=document.createElement('input');check.type='checkbox';check.checked=!!v.repeat;check.onchange=()=>{draft.repeat=check.checked;status.textContent='Nog niet opgeslagen'};repeat.append(check,document.createTextNode(' Volgend jaar opnieuw kopen / telen'));fields.append(repeat);
  const status=document.createElement('span');status.className='saveHint';status.textContent='Opgeslagen gegevens';
  const saveButton=document.createElement('button');saveButton.type='button';saveButton.textContent='✓ Teeltgegevens opslaan';saveButton.onclick=()=>{if(draft.price!==''&&(!Number.isFinite(Number(draft.price))||Number(draft.price)<0)){status.textContent='Vul een geldige prijs in';return}checkpoint();Object.assign(v,draft);save();renderLibrary();renderRegister();status.textContent='✓ Opgeslagen (ook online bij verbinding)'};
  const saveBar=document.createElement('div');saveBar.className='toolbar';saveBar.append(saveButton,status);item.append(fields,saveBar);wrap.append(item)
 });
 return wrap;
}
function newVariety(crop,name){return {crop,name,shop:'',price:'',amount:'',planting:'',harvestFrom:'',harvestTo:'',weather:'',rating:'',month:'',repeat:false,notes:''}}
function addVariety(c,name){checkpoint();c.varieties??=[];c.varieties.push(newVariety(c.crop,name));save();paint()}
function renderLibrary(){
 const root=$('varietyLibrary');if(!root)return;root.replaceChildren();ensureLibrary();
 const summary=document.createElement('p');summary.className='hint';summary.textContent='Kies een gewas in een tuinvlak om een ras te registreren. Je eigen rassen worden bewaard in je tuinplan.';root.append(summary);
 const cropSelect=document.createElement('select');cropNames().forEach(({id,name})=>{const o=document.createElement('option');o.value=id;o.textContent=name;cropSelect.append(o)});
 const list=document.createElement('div');list.className='libraryList';
 const update=()=>{list.replaceChildren();const names=availableVarieties(Number(cropSelect.value));list.textContent=names.length?names.join(' · '):'Nog geen rassen in de lijst. Je kunt zelf een ras toevoegen in een tuinvlak.'};
 cropSelect.onchange=update;root.append(cropSelect,list);update();
 const fav=document.createElement('div');fav.className='libraryFavorites';const items=[];
 state.objects.filter(o=>o.type==='bed').forEach(o=>Object.entries(o.sections||{}).forEach(([year,rows])=>rows.forEach(r=>(r.cols||[]).forEach(c=>cellVarieties(c).forEach(v=>{if(v.repeat)items.push(`${year} · ${crops[v.crop]?.[0]||'?'} – ${v.name}${v.shop?' · '+v.shop:''}${v.price?' · € '+v.price:''}`)})))));
 const title=document.createElement('h3');title.textContent='Opnieuw kopen of telen';fav.append(title);
 const p=document.createElement('p');p.textContent=items.length?items.join(' | '):'Nog geen favorieten. Vink bij een ras ‘Volgend jaar opnieuw kopen / telen’ aan.';fav.append(p);root.append(fav)
}
function splitLength(i=0){
 const o=state.objects.find(x=>x.id===selected);if(!o||o.type!=='bed')return;
 const rows=sections(o),r=rows[i];if(!r||r.length<.4){notify('Dit deel is te kort om dwars te splitsen');return}
 checkpoint();const half=r.length/2;r.length=half;
 rows.splice(i+1,0,{length:half,cols:clone(r.cols)});save();paint();
}
function splitWidth(i=0,j=0){
 const o=state.objects.find(x=>x.id===selected);if(!o||o.type!=='bed')return;
 const r=sections(o)[i],c=r?.cols[j];if(!c||c.width<.4){notify('Dit vak is te smal om in de lengte te splitsen');return}
 checkpoint();const half=c.width/2;c.width=half;
 r.cols.splice(j+1,0,{crop:0,width:half,varieties:[]});selectedCell={i,j:j+1};save();paint();
}
// Splits het aangetikte vak in drie gelijke delen; behoud de eerste
// groente/naam, en maak de twee nieuwe vakken leeg.
function splitIntoThree(along){
 const o=state.objects.find(x=>x.id===selected);
 if(!o||o.type!=='bed')return;
 const i=selectedCell?.i??0,j=selectedCell?.j??0;
 const longIsWidth=o.width>o.length;
 const splitVertical=along?!longIsWidth:longIsWidth;
 if(splitVertical){
  const rows=sections(o),r=rows[i];
  if(!r||r.length<.6){alert('Dit vak is te klein om dwars in drie delen van minimaal 20 cm te splitsen.');return}
  checkpoint();
  const part=r.length/3;
  r.length=part;
  rows.splice(i+1,0,
   {length:part,cols:clone(r.cols).map(c=>({...c,crop:0,label:'',varieties:[]}))},
   {length:part,cols:clone(r.cols).map(c=>({...c,crop:0,label:'',varieties:[]}))});
  selectedCell={i,j:0};
 }else{
  const r=sections(o)[i],cell=r?.cols[j];
  if(!cell||cell.width<.6){alert('Dit vak is te klein om in drie delen van minimaal 20 cm te splitsen.');return}
  checkpoint();
  const part=cell.width/3;
  cell.width=part;
  r.cols.splice(j+1,0,
   {crop:0,label:'',width:part,varieties:[]},
   {crop:0,label:'',width:part,varieties:[]});
  selectedCell={i,j};
 }
 save();paint();
}
$('splitTripleAcross').onclick=()=>splitIntoThree(false);
$('splitTripleAlong').onclick=()=>splitIntoThree(true);
$('clearBedSplits').onclick=()=>{
 const o=state.objects.find(x=>x.id===selected);
 if(!o||o.type!=='bed')return;
 const rows=sections(o),first=rows[0]?.cols[0];
 if(!first)return;
 if(rows.length===1&&rows[0].cols.length===1){notify('Dit vak is niet opgesplitst');return}
 if(!confirm('Alle splitsingen in deze strook opheffen? De groente, naam en teeltgegevens van het eerste vak blijven bewaard. Gegevens van de andere vakdelen worden verwijderd.'))return;
 checkpoint();
 const restored=clone(first);
 restored.width=o.width;
 const key=String(o.perennialSource||state.year);
 // Alleen de verdeling van het huidige tuinjaar herstellen.
 o.sections[key]=[{length:o.length,cols:[restored]}];
 selectedCell={i:0,j:0};
 save();paint();notify('Splitsingen opgeheven; gegevens van het eerste vak behouden');
};
function chooseMergedCrop(first,second){
 const options=crops.map(([name],i)=>i+': '+name).join('\n');
 const answer=prompt('Welke groente krijgt het samengevoegde vak? Vul het nummer in.\n'+options,String(first));
 if(answer===null)return null;
 const id=Number(answer.trim());if(!Number.isInteger(id)||id<0||id>=crops.length){notify('Ongeldig groentenummer; niets gewijzigd');return null}
 return id;
}
function mergeWidth(i,j){
 const o=state.objects.find(x=>x.id===selected);if(!o||o.type!=='bed')return;
 const r=sections(o)[i];if(!r||!r.cols[j+1])return;
 const id=chooseMergedCrop(r.cols[j].crop,r.cols[j+1].crop);if(id===null)return;
 if((cellVarieties(r.cols[j]).length||cellVarieties(r.cols[j+1]).length)&&!confirm('Bij samenvoegen worden de rassen van beide vakken samengevoegd. Doorgaan?'))return;checkpoint();r.cols[j].width+=r.cols[j+1].width;r.cols[j].crop=id;r.cols[j].varieties=[...cellVarieties(r.cols[j]),...cellVarieties(r.cols[j+1])].filter(v=>v.crop===id);r.cols.splice(j+1,1);save();paint();
}
function mergeLength(i){
 const o=state.objects.find(x=>x.id===selected);if(!o||o.type!=='bed')return;
 const rows=sections(o),a=rows[i],b=rows[i+1];if(!a||!b)return;
 // Alleen identieke kolomgrenzen kunnen zonder verlies van de geometrie worden samengevoegd.
 if(a.cols.length!==b.cols.length||a.cols.some((c,j)=>Math.abs(c.width-b.cols[j].width)>.00001)){
  notify('Samenvoegen kan alleen bij gelijke breedteverdeling');return;
 }
 const id=chooseMergedCrop(a.cols[0].crop,b.cols[0].crop);if(id===null)return;
 if((a.cols.some(c=>cellVarieties(c).length)||b.cols.some(c=>cellVarieties(c).length))&&!confirm('Rassen uit beide lengtedelen worden samengevoegd voor zover ze bij het gekozen gewas horen. Doorgaan?'))return;checkpoint();a.length+=b.length;a.cols.forEach((c,j)=>{c.varieties=[...cellVarieties(c),...cellVarieties(b.cols[j])].filter(v=>v.crop===id);c.crop=id});rows.splice(i+1,1);save();paint();
}
function updateObj(patch){previousRotation=null;const o=state.objects.find(x=>x.id===selected);if(!o)return;const test={...o,...patch};if(test.length<.2||test.width<.2||!fits(test)){alert('Onvoldoende ruimte: het vak valt buiten de tuin of overlapt een ander object. De wijziging is niet opgeslagen.');paint();return}checkpoint();Object.assign(o,patch);if(o.type==='bed'){Object.values(o.sections||{}).forEach(arr=>{if('length'in patch){const sum=arr.reduce((a,s)=>a+s.length,0);if(sum>0)arr.forEach(s=>s.length*=o.length/sum)}if('width'in patch){arr.forEach(r=>{if(!r.cols)r.cols=[{crop:r.crop||0,width:o.width}];const sum=r.cols.reduce((a,c)=>a+c.width,0);if(sum>0)r.cols.forEach(c=>c.width*=o.width/sum)})}})}save();paint()}
function addObj(type){const obj={id:state.nextId,type,year:type==='bed'?state.year:null,x:.3,y:.3,length:type==='bed'?Math.min(5,state.length):Math.min(4,state.length),width:type==='bed'?Math.min(1.2,state.width):Math.min(.6,state.width),rotation:0};if(type==='bed')obj.sections={2026:[{crop:0,length:obj.length}],2027:[{crop:0,length:obj.length}]};let found=false;for(let y=0;y<=state.length;y+=.25){for(let x=0;x<=state.width;x+=.25){obj.x=+x.toFixed(2);obj.y=+y.toFixed(2);if(fits(obj,null)){found=true;break}}if(found)break}if(!found){notify('Geen vrije ruimte: verklein of verplaats eerst een object');return}checkpoint();state.nextId++;state.objects.push(obj);selected=obj.id;save();paint();$('editPanel').scrollIntoView({behavior:'smooth',block:'nearest'})}
// Eenvoudige invoer: één scherm en automatische plaatsing in A of B.
function refreshSimpleCrops(){
 const select=$('simpleCrop'),chosen=select.value;select.replaceChildren();
 cropNames().forEach(({name,id})=>select.append(new Option(name,String(id))));
 if(chosen&&[...select.options].some(o=>o.value===chosen))select.value=chosen;
}
$('addBed').onclick=()=>{refreshSimpleCrops();$('simpleBedForm').hidden=false;$('simpleBedForm').scrollIntoView({behavior:'smooth',block:'nearest'})};
$('simpleCancel').onclick=()=>{$('simpleBedForm').hidden=true};
$('toggleAdvanced').onclick=()=>{const area=$('advancedTools');area.hidden=!area.hidden;$('toggleAdvanced').setAttribute('aria-expanded',String(!area.hidden));$('toggleAdvanced').textContent=area.hidden?'⚙ Geavanceerd bewerken':'⚙ Geavanceerd sluiten'};
$('simpleCreate').onclick=()=>{
 const part=$('simpleSection').value,crop=Number($('simpleCrop').value),length=Number($('simpleWidth').value),width=Number($('simpleLength').value);
 if(!Number.isFinite(length)||!Number.isFinite(width)||length<.2||width<.2||length>state.length||width>5||!crops[crop]){alert('Controleer de afmetingen en kies een groente. Een vak mag maximaal 5 meter breed zijn.');return}
 const x0=part==='A'?.5:5.5;
 const obj={id:state.nextId,type:'bed',year:state.year,perennial:$('simplePerennial').checked,perennialSource:state.year,x:x0,y:0,length,width,rotation:0,sections:{}};
 const enteredVariety=$('simpleVariety').value.trim();
 const enteredName=$('simpleName').value.trim();
 obj.sections[state.year]=[{length,cols:[{crop,width,label:enteredName,varieties:enteredVariety?[newVariety(crop,enteredVariety)]:[]}]}];
 // Eenjarig: alleen dit jaar; vaste beplanting gebruikt steeds het bronjaar.
 let found=false;
 // Voorspelbaar: probeer eerst direct ONDER het laatste vak in A of B.
 // Als daar geen ruimte is, zoek dan de eerste vrije plek vanaf boven.
 const inPart=activeObjects().filter(o=>o.type==='bed'&&gardenSection(o)===part);
 const after=inPart.length?Math.max(...inPart.map(o=>o.y+dims(o).h))+.02:0;
 let fallback=false;
 for(const startY of [after,0]){
  if(found)break;
  for(let y=startY;y<=state.length-length+.00001&&!found;y+=.1){
   for(let x=x0;x<=x0+5-width+.00001;x+=.1){
    obj.x=+x.toFixed(3);obj.y=+y.toFixed(3);
    if(fits(obj,null)){found=true;fallback=startY===0&&after>0;break}
   }
  }
 }
 if(!found){alert('Geen vrije ruimte gevonden in tuingedeelte '+part+'. Probeer een kleiner vak of verplaats eerst een bestaand vak.');return}
 checkpoint();state.nextId++;state.objects.push(obj);selected=obj.id;selectedCell={i:0,j:0};
 $('simpleBedForm').hidden=true;$('simplePerennial').checked=false;$('simpleName').value='';$('simpleVariety').value='';save();paint();notify('✓ '+crops[crop][0]+' geplaatst '+(fallback?'op de eerste vrije plek':'onder de bestaande vakken')+' in tuin '+part);requestAnimationFrame(()=>{const group=$('map').querySelector('[data-id="'+obj.id+'"]');if(group)group.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'})});
};
function refreshQuickSuggestions(){
 const list=$('quickVarietySuggestions'),box=$('quickVarietyChoices');if(!list||!box)return;
 list.replaceChildren();box.replaceChildren();
 const crop=Number($('quickCrop').value);
 const names=new Set();
 (state.catalog||[]).filter(e=>Number(e.crop)===crop).forEach(e=>names.add(e.name));
 availableVarieties(crop).forEach(n=>names.add(n));
 const chosen=quickSelectedVarieties;
 const sorted=[...names].filter(Boolean).sort((a,b)=>a.localeCompare(b,'nl'));
 const title=document.createElement('p');title.className='hint';title.textContent=sorted.length?'Vink hieronder de gewenste rassen aan:':'Nog geen ras voor dit gewas. Voeg hieronder direct een ras toe.';
 box.append(title);
 sorted.forEach(name=>{
   list.append(new Option(name));
   const label=document.createElement('label');label.className='varietyChoice';
   const cb=document.createElement('input');cb.type='checkbox';cb.checked=chosen.has(name);
   cb.onchange=()=>{
     if(cb.checked)quickSelectedVarieties.add(name);else quickSelectedVarieties.delete(name);
     $('quickVariety').value=[...quickSelectedVarieties].join(', ');
   };
   label.append(cb,document.createTextNode(' '+name));box.append(label);
 });
}
let quickRasMode='existing';
let quickSelectedVarieties=new Set();
let quickPendingRegistration=false;
function setQuickRasMode(mode){
 quickRasMode=mode;
 $('quickExistingPanel').hidden=mode!=='existing';
 $('quickTypingPanel').hidden=mode!=='typing';
 $('quickExistingMode').classList.toggle('active',mode==='existing');
 $('quickTypingMode').classList.toggle('active',mode==='typing');
 $('quickExistingMode').setAttribute('aria-pressed',String(mode==='existing'));
 $('quickTypingMode').setAttribute('aria-pressed',String(mode==='typing'));
}
$('quickExistingMode').onclick=()=>setQuickRasMode('existing');
$('quickTypingMode').onclick=()=>setQuickRasMode('typing');
$('quickCrop').onchange=()=>{
 quickSelectedVarieties.clear();$('quickVariety').value='';
 setQuickRasMode('existing');refreshQuickSuggestions();
};
$('quickAddVariety').onclick=()=>{
 const crop=Number($('quickCrop').value);
 if(!crops[crop]){notify('Kies eerst een gewas');return}
 // Het bestaande centrale invoerformulier wordt gebruikt, zodat het ras
 // in het register terechtkomt en daarna automatisch in de strooklijst.
 quickPendingRegistration=true;
 $('catalogContent').hidden=false;
 $('toggleCatalog').textContent='Moestuinregister';
 $('toggleCatalog').setAttribute('aria-expanded','true');
 $('catalogNewForm').hidden=false;
 fillCropMenus();
 $('catalogCropFilter').value=String(crop);
 $('newCatalogCrop').value=String(crop);
 $('catalogPanel').scrollIntoView({behavior:'smooth',block:'start'});
 $('newCatalogName').focus({preventScroll:true});
 notify('Vul het nieuwe ras in en klik op Ras toevoegen');
};
$('quickSave').onclick=()=>{
 const o=state.objects.find(x=>x.id===selected&&x.type==='bed'&&visible(x));if(!o){notify('Selecteer eerst een groentevak');return}
 const loc=selectedCell||{i:0,j:0};const cell=sections(o)[loc.i]?.cols[loc.j];if(!cell){notify('Selecteer een geldig vakje');return}
 const crop=Number($('quickCrop').value),label=$('quickName').value.trim(),raw=$('quickVariety').value.trim();
 if(!crops[crop]){notify('Kies een groente');return}
 if(Number(cell.crop)!==crop&&(cell.varieties||[]).length&&!confirm('De bestaande rassen van dit vak vervangen?'))return;
 const names=quickRasMode==='existing'?[...quickSelectedVarieties]:raw.split(',').map(x=>x.trim()).filter(Boolean);
 const previous=Number(cell.crop)===crop?(cell.varieties||[]):[];
 checkpoint();cell.crop=crop;cell.label=label;
 cell.varieties=names.map(name=>previous.find(v=>v.name===name&&Number(v.crop)===crop)||newVariety(crop,name));
 save();paint();$('quickEdit').hidden=true;$('openQuickEdit').hidden=false;notify('✓ Opgeslagen. Het invoerblok is gesloten.');
};
$('addPath').onclick=()=>{$('simplePathForm').hidden=false;$('simplePathForm').scrollIntoView({behavior:'smooth',block:'center'})};
$('pathCancel').onclick=()=>{$('simplePathForm').hidden=true};
$('pathCreate').onclick=()=>{
 const length=Number($('pathWidth').value),width=Number($('pathLength').value);
 if(!Number.isFinite(length)||!Number.isFinite(width)||length<.2||width<.2||length>state.length||width>10){notify('Vul geldige afmetingen in (minimaal 0,2 meter)');return}
 const obj={id:state.nextId,type:'path',year:null,x:.5,y:0,length,width,rotation:0};
 let found=false;
 for(let y=0;y<=state.length-length+.00001&&!found;y+=.1){
  for(let x=.5;x<=10.5-width+.00001;x+=.1){obj.x=+x.toFixed(3);obj.y=+y.toFixed(3);if(fits(obj,null)){found=true;break}}
 }
 if(!found){notify('Geen vrije plek voor dit looppad. Probeer kleinere afmetingen.');return}
 checkpoint();state.nextId++;state.objects.push(obj);selected=obj.id;selectedCell=null;
 $('simplePathForm').hidden=true;save();paint();notify('✓ Looppad geplaatst. Selecteer het om te kopiëren.');
};
// Kopieer het geselecteerde groentevak met dezelfde afmetingen en teeltindeling.
$('copyBed').onclick=()=>{
 const source=state.objects.find(o=>o.id===selected&&visible(o));
 if(!source){notify('Selecteer eerst een groentevak of looppad op de plattegrond');return}
 if(source.parked){notify('Sleep dit vak eerst terug naar A of B');return}
 const obj=clone(source);
 obj.id=state.nextId;
 delete obj.hiddenYears;
 // Een kopie hoort bij het huidige tuinjaar. Vaste beplanting wordt bewust
 // niet automatisch overgenomen, zodat kopiëren geen extra vaste plant creëert.
 if(source.type==='bed'){obj.year=state.year;obj.perennial=false;obj.perennialSource=state.year;const sourceRows=clone(sections(source));obj.sections={[state.year]:sourceRows};}
 const d=dims(obj),x0=source.type==='path'?.5:(gardenSection(source)==='A'?.5:5.5),availableWidth=source.type==='path'?10:5;
 const positions=[];
 // Zoek dichtbij het origineel, maar uitsluitend in hetzelfde tuingedeelte.
 for(let y=0;y<=state.length-d.h+.00001;y+=.1){
  for(let x=x0;x<=x0+availableWidth-d.w+.00001;x+=.1){
   positions.push({x:+x.toFixed(3),y:+y.toFixed(3),distance:(x-source.x)**2+(y-source.y)**2});
  }
 }
 positions.sort((a,b)=>a.distance-b.distance);
 let placed=false;
 for(const pos of positions){obj.x=pos.x;obj.y=pos.y;if(fits(obj,null)){placed=true;break}}
 if(!placed){notify('Geen vrije plek voor een kopie. Maak eerst ruimte of verklein het object.');return}
 checkpoint();state.nextId++;state.objects.push(obj);
 selected=obj.id;selectedCell=null;save();paint();
 notify('✓ '+(source.type==='path'?'Looppad':'Groentevak')+' gekopieerd. Sleep de kopie naar de gewenste plaats.');
};

// Draai rond het midden en zoek, indien nodig, een nabije geldige positie.
// Vorige gebruikt dezelfde bewerkingsgeschiedenis als Ongedaan, maximaal 40 stappen.
let previousRotation=null;
function rotateSelected(degrees){
 const o=state.objects.find(x=>x.id===selected);if(!o)return;
 if(o.perennial){notify('Vaste beplanting blijft op haar plek');return}
 const before=clone(o),old=dims(o),cx=o.x+old.w/2,cy=o.y+old.h/2;
 const test={...o,rotation:((Number(o.rotation)||0)+degrees+360)%360};
 const next=dims(test);
 const targetX=cx-next.w/2,targetY=cy-next.h/2;
 // Eerst exact om het midden draaien; daarna in oplopende afstand zoeken.
 let found=null;
 const maxRadius=6,step=.1;
 const consider=(x,y)=>{
   const candidate={...test,x:+x.toFixed(4),y:+y.toFixed(4)};
   if(fits(candidate)){found=candidate;return true}return false;
 };
 if(!consider(targetX,targetY)){
   outer:for(let radius=1;radius<=Math.round(maxRadius/step);radius++){
     // Ringzoektocht voorkomt onnodig grote verplaatsingen.
     for(let dx=-radius;dx<=radius;dx++){
       for(const dy of [-radius,radius]){
         if(consider(targetX+dx*step,targetY+dy*step))break outer;
       }
     }
     for(let dy=-radius+1;dy<radius;dy++){
       for(const dx of [-radius,radius]){
         if(consider(targetX+dx*step,targetY+dy*step))break outer;
       }
     }
   }
 }
 if(!found){notify('Geen ruimte om te draaien, ook niet op een nabije positie. Verplaats of verklein het vak eerst.');return}
 checkpoint();
 previousRotation={id:o.id,original:before};
 Object.assign(o,{rotation:found.rotation,x:found.x,y:found.y});
 save();paint();
 if(Math.hypot(found.x-targetX,found.y-targetY)>.02)notify('Gedraaid en automatisch iets verschoven om binnen de tuin te passen');
}
$('rotate').onclick=()=>rotateSelected(90);
$('rotate45').onclick=()=>rotateSelected(-33);
$('rotate15').onclick=()=>rotateSelected(-15);$('rotate7').onclick=()=>rotateSelected(-7.5);
$('rotatePrevious').onclick=()=>undoGardenStep();
$('objPerennial').onchange=()=>{const o=state.objects.find(x=>x.id===selected);if(!o||o.type!=='bed')return;const before=!!o.perennial,desired=$('objPerennial').checked;if(before===desired)return;if(desired&&o.parked){$('objPerennial').checked=false;notify('Sleep dit vak eerst terug naar A of B');return}const test={...o,perennial:desired};if(desired&&!fits(test)){notify('Kan niet vast worden: dit vak overlapt een vak uit een ander jaar.');$('objPerennial').checked=before;return}checkpoint();o.perennial=desired;if(desired)o.perennialSource=state.year;else{o.year=state.year;const source=String(o.perennialSource||o.year);if(o.sections?.[source]&&!o.sections[state.year])o.sections[state.year]=clone(o.sections[source]);}save();paint();notify(desired?'Vaste beplanting blijft zichtbaar in volgende jaren':'Vak hoort nu alleen bij '+state.year)};
// De betekenis van lengte/dwars volgt de langste fysieke zijde, niet de interne veldnaam.
function splitByDirection(along){
 const o=state.objects.find(x=>x.id===selected);
 if(!o||o.type!=='bed')return;
 // Splits het vak waarop de gebruiker heeft getikt, niet steeds linksboven.
 const i=selectedCell?.i??0,j=selectedCell?.j??0;
 const longIsWidth=o.width>o.length;
 if(along){
   if(longIsWidth)splitLength(i);else splitWidth(i,j);
 }else{
   if(longIsWidth)splitWidth(i,j);else splitLength(i);
 }
}
$('split').onclick=()=>splitByDirection(false);if($('splitWidth'))$('splitWidth').onclick=()=>splitByDirection(true);$('delete').onclick=()=>{const i=state.objects.findIndex(x=>x.id===selected);if(i<0)return;if(!confirm('Dit object verwijderen?'))return;checkpoint();state.objects.splice(i,1);selected=null;selectedCell=null;save();paint()};function undoGardenStep(){
 if(!history.length){notify('Geen eerdere bewerking meer');return}
 state=history.pop();storeHistory();selected=null;selectedCell=null;
 previousRotation=null;loadCustomCrops();applyCropOverrides();
 save();syncInputs();paint();updateUndo();notify('Vorige bewerking hersteld');
}
$('undo').onclick=undoGardenStep;

$('advancedSave').onclick=()=>{
 const o=state.objects.find(x=>x.id===selected);if(!o)return;
 const patch={length:Number($('objWidth').value),width:Number($('objLength').value),x:Number($('objX').value),y:Number($('objY').value)};
 if(Object.values(patch).some(v=>!Number.isFinite(v))){alert('Controleer de ingevoerde getallen. De wijziging is niet opgeslagen.');return}
 if(o.perennial&&(patch.x!==o.x||patch.y!==o.y)){notify('Vaste beplanting blijft op haar plek');return}
 const test={...o,...patch};
 if(patch.length<.2||patch.width<.2||!fits(test)){alert('Onvoldoende ruimte voor deze afmetingen of positie. Het vak valt buiten de tuingrens of overlapt een ander vak of looppad. De wijziging is niet opgeslagen.');return}
 updateObj(patch);$('advancedTools').hidden=true;$('toggleAdvanced').setAttribute('aria-expanded','false');$('toggleAdvanced').textContent='⚙ Geavanceerd bewerken';notify('✓ Wijzigingen opgeslagen');
};
function resizeGarden(){const length=Number($('gardenWidth').value),width=Number($('gardenLength').value);if(!Number.isFinite(length)||!Number.isFinite(width)||length<1||width<1||length>200||width>200){notify('Gebruik afmetingen van 1 tot 200 meter');syncInputs();return}const old=clone(state);state.length=length;state.width=width;if(state.objects.some(o=>!o.registerOnly&&!fits(o))){state=old;notify('Stroken of paden vallen buiten de nieuwe tuingrens');syncInputs();return}checkpoint();history[history.length-1]=old;save();paint()}
function syncInputs(){$('gardenWidth').value=state.length;$('gardenLength').value=state.width;$('year').value=state.year}
$('gardenWidth').onchange=resizeGarden;$('gardenLength').onchange=resizeGarden;$('year').onchange=()=>{state.year=$('year').value;selected=null;selectedCell=null;save();paint()};
const svg=$('map');function point(evt){const p=svg.createSVGPoint();p.x=evt.clientX;p.y=evt.clientY;const matrix=svg.getScreenCTM();if(!matrix)return null;const q=p.matrixTransform(matrix.inverse());return{x:q.x-1,y:q.y-1}}
// Verplaats een strook door een andere strook heen: alle tussenliggende
// vakken schuiven in dezelfde tuinstrook op, zonder hun afmetingen te wijzigen.
// Dit werkt voor niet-gedraaide groentevakken binnen dezelfde A/B-strook.

// Versie 2.1.1: herschikken werkt horizontaal én verticaal.
// Alle betrokken vakken worden als één geheel gevalideerd; de oude
// posities van die vakken mogen de nieuwe posities niet blokkeren.
function reorderBedsDuringDrag(draggedId,desiredX,desiredY,axis){
 const moved=state.objects.find(o=>o.id===draggedId);
 if(!moved||moved.type!=='bed'||moved.perennial||moved.parked||(moved.rotation||0)%180!==0)return false;
 const lane=gardenSection(moved);
 const key=axis==='x'?'x':'y',size=axis==='x'?'width':'length';
 const cross=axis==='x'?'y':'x',crossSize=axis==='x'?'length':'width';
 const sameBand=o=>Math.min(o[cross]+o[crossSize],moved[cross]+moved[crossSize])-Math.max(o[cross],moved[cross])>.05;
 const items=state.objects.filter(o=>o.type==='bed'&&!o.perennial&&!o.parked&&gardenSection(o)===lane&&
  (o.rotation||0)%180===0&&sameBand(o)&&String(o.year)===String(moved.year)&&visible(o))
  .sort((a,b)=>a[key]-b[key]||a.id-b.id);
 const from=items.findIndex(o=>o.id===draggedId);
 if(from<0||items.length<2)return false;
 const others=items.filter(o=>o.id!==draggedId);
 const target=axis==='x'?desiredX:desiredY;
 const at=others.filter(o=>o[key]+o[size]/2<target+moved[size]/2).length;
 if(at===from)return false;
 const ordered=[...others.slice(0,at),moved,...others.slice(at)];
 const originals=items.map(o=>({o,x:o.x,y:o.y}));
 const gap=.01;
 const total=ordered.reduce((n,o)=>n+o[size],0)+gap*(ordered.length-1);
 const lower=axis==='x'?(lane==='A'?.5:5.5):0;
 const upper=axis==='x'?lower+5:state.length;
 if(total>upper-lower+.00001)return false;
 const movingIds=new Set(items.map(o=>o.id));
 const first=Math.min(...items.map(o=>o[key]));
 const starts=[Math.max(lower,Math.min(first,upper-total)),lower,upper-total];
 for(let v=lower;v<=upper-total+.0001;v+=.2)starts.push(v);
 for(const start of starts){
  let pos=start;
  for(const o of ordered){o[key]=Math.round(pos*1000)/1000;pos+=o[size]+gap}
  const valid=items.every(o=>{
   const poly=polygon(o),eps=.00001;
   if(poly.some(q=>q.x<-eps||q.y<-eps||q.x>state.width+eps||q.y>state.length+eps))return false;
   if(![.5,5.5].some(left=>poly.every(q=>q.x>=left-eps&&q.x<=left+5+eps)))return false;
   return !state.objects.some(q=>!movingIds.has(q.id)&&
    samePlacementSpace(o,q)&&polygonsOverlap(poly,polygon(q)));
  });
  if(valid&&items.every((o,i)=>items.slice(i+1).every(q=>!polygonsOverlap(polygon(o),polygon(q)))))return true;
 }
 for(const {o,x,y} of originals){o.x=x;o.y=y}
 return false;
}

// v2.1.3: de vinger/muis bepaalt een DOELPOSITIE. Een looppad of
// strookgrens mag onderweg worden gepasseerd; alleen de eindplek telt.
function dragDestination(d,ev){
 const p=point(ev);if(!p)return;
 const dx=p.x-d.start.x,dy=p.y-d.start.y;
 d.destination=d.open?(p.x<BUFFER_LEFT?'A':p.x<BUFFER_LEFT+BUFFER_WIDTH?'V':'B'):null;
 const offset=d.destination==='V'?BUFFER_LEFT:d.destination==='B'?BUFFER_WIDTH:0;
 // Vertaal de visuele eindpositie naar de gekozen strook.
 d.targetX=Math.round((d.x+d.displayOffset+dx-offset)*100)/100;
 d.targetY=Math.round((d.y+dy)*100)/100;
 if(Math.hypot(dx,dy)>.08)d.moved=true;
 if(d.preview&&d.moved)d.preview.setAttribute('transform',`translate(${dx} ${dy})`);
}
function placeDraggedBed(d){
 const o=state.objects.find(x=>x.id===d.id);
 if(!o||o.perennial||!visible(o))return false;
 if(o.type==='path')return placeDraggedPath(o,d);
 if(d.open&&o.type==='bed')return placeBedWithBuffer(o,d);
 const tx=d.targetX,ty=d.targetY;
 const original={x:o.x,y:o.y};
 // Eerst rechtstreeks naar de eindplek, dus óók over een looppad heen
 // en van strook A naar strook B, als de eindplek vrij is.
 if(fits({...o,x:tx,y:ty})){o.x=tx;o.y=ty;return true}
 // Bij het overzetten naar A/B: zoek in de nieuwe strook naar een
 // vrije positie op de gewenste hoogte. Geen bestaande vakken aanpassen.
 if(o.type==='bed'){
  const centers=[3,8],targetCenter=tx+o.width/2;
  const destinationLane=centers.reduce((best,c,i)=>Math.abs(c-targetCenter)<Math.abs(centers[best]-targetCenter)?i:best,0);
  const left=destinationLane===0?.5:5.5;
  const width=dims(o).w;
  if(width<=5){
   const preferredX=Math.max(left,Math.min(tx,left+5-width));
   const xCandidates=[preferredX,left,left+5-width];
   const yCandidates=[ty];
   for(let distance=.1;distance<=state.length;distance+=.2){
    yCandidates.push(ty-distance,ty+distance);
   }
   for(const y of yCandidates){
    if(y<0||y+dims(o).h>state.length)continue;
    for(const x of xCandidates){
     if(fits({...o,x,y})){o.x=Math.round(x*100)/100;o.y=Math.round(y*100)/100;return true}
    }
   }
  }
  // Als het doel bezet is: de vakken in dezelfde strook herschikken.
  // Een looppad blijft op zijn plaats; een vak kan wel over het pad
  // heen naar een vrije plek worden gezet.
  if(reorderBedsDuringDrag(o.id,tx,ty,Math.abs(tx-d.x)>Math.abs(ty-d.y)?'x':'y'))return true;
 }
 o.x=original.x;o.y=original.y;
 return false;
}
function pathMapX(x,open){
 return open&&x>BUFFER_LEFT?Math.max(BUFFER_LEFT,x-BUFFER_WIDTH):x;
}
function placeDraggedPath(o,d){
 const parked=d.destination==='V';
 const {w,h}=dims(o);
 let left=parked?0:.5;
 let end=parked?BUFFER_WIDTH:Math.min(state.width,10.5);
 if(o.parked&&!parked&&w<=5){
  if(d.destination==='A')end=Math.min(end,BUFFER_LEFT);
  if(d.destination==='B')left=BUFFER_LEFT;
 }
 const right=end-w,bottom=state.length-h;
 if(right<left-.00001||bottom<-.00001)return false;
 const x=Math.max(left,Math.min(d.targetX,right));
 const y=Math.max(0,Math.min(d.targetY,bottom));
 const changedPosition=(x,y)=>parked!==Boolean(o.parked)||Math.hypot(x-o.x,y-o.y)>.00001;
 if(!changedPosition(x,y))return false;
 const place=(x,y)=>{
  if(!fits({...o,x,y,parked}))return false;
  Object.assign(o,{x,y});
  if(parked)o.parked=true;
  else delete o.parked;
  return true;
 };
 if(place(x,y))return true;
 if(parked)return false;
 // Probeer ook de exacte randen en de oorspronkelijke X of Y. Dat is
 // nodig voor een pad dat strak tussen vakken doorloopt.
 const coordinates=(target,min,max,original)=>{
  const values=new Set([target]);
  for(let i=1;i<=15;i++){
   values.add(Math.max(min,target-i/10));
   values.add(Math.min(max,target+i/10));
  }
  if(Math.abs(original-target)<=1.5)values.add(original);
  return [...values];
 };
 const xs=coordinates(x,left,right,o.x);
 const ys=coordinates(y,0,bottom,o.y);
 const candidates=xs.flatMap(x=>ys.map(y=>({x,y})))
  .filter(p=>changedPosition(p.x,p.y))
  .sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y));
 return candidates.some(p=>place(p.x,p.y));
}
function nearbyPath(point,open){
 if(!point)return null;
 const inBuffer=open&&point.x>=BUFFER_LEFT&&point.x<BUFFER_LEFT+BUFFER_WIDTH;
 const matrix=svg.getScreenCTM();
 const tolerance=6/Math.hypot(matrix?.a||1,matrix?.b||0);
 const x=inBuffer?point.x-BUFFER_LEFT:pathMapX(point.x,open);
 let closest=null,distance=tolerance;
 for(const o of activeObjects()){
  if(o.type!=='path'||Boolean(o.parked)!==inBuffer)continue;
  const {w,h}=dims(o);
  const r=rotationInfo(o);
  const angle=-r.localAngle*Math.PI/180;
  const dx=x-o.x-w/2,dy=point.y-o.y-h/2;
  const localX=dx*Math.cos(angle)-dy*Math.sin(angle);
  const localY=dx*Math.sin(angle)+dy*Math.cos(angle);
  const gap=Math.hypot(Math.max(0,Math.abs(localX)-r.w/2),Math.max(0,Math.abs(localY)-r.h/2));
  if(gap<=distance){closest=o;distance=gap}
 }
 return closest;
}
function placeBedWithBuffer(o,d){
 const parked=d.destination==='V';
 const left=parked?0:d.destination==='A'?.5:BUFFER_LEFT;
 const right=parked?BUFFER_WIDTH:Math.min(state.width,left+5);
 const {w,h}=dims(o);
 if(w>right-left+.00001||h>state.length+.00001)return false;
 const x=Math.max(left,Math.min(d.targetX,right-w));
 const y=Math.max(0,Math.min(d.targetY,state.length-h));
 const splitLegacy=parked&&!o.year;
 const candidate={...o,x,y,parked};
 if(splitLegacy)candidate.year=String(state.year);
 const place=(nextX,nextY)=>{
  candidate.x=nextX;candidate.y=nextY;
  if(!fits(candidate))return false;
  if(splitLegacy){
   // Geef een oud gedeeld vak een eigen exemplaar voor dit jaar.
   const year=String(state.year);
   const copy=clone(candidate);
   copy.id=state.nextId++;
   copy.sections={[year]:clone(sections(o))};
   delete copy.hiddenYears;
   o.hiddenYears=[...(o.hiddenYears||[]),year];
   delete o.sections[year];
   state.objects.push(copy);
   selected=copy.id;
  }else{
   o.x=nextX;o.y=nextY;
   if(parked)o.parked=true;
   else delete o.parked;
  }
  return true;
 };
 if(place(x,y))return true;
 // Zelfde vrije-plekzoektocht als bij een gewone verplaatsing tussen A en B.
 const xChoices=[x,left,right-w];
 for(let step=0;step<=state.length*10;step++){
  for(const nextY of step?[y-step/10,y+step/10]:[y]){
   if(nextY<0||nextY+h>state.length+.00001)continue;
   for(const nextX of xChoices)if(place(nextX,nextY))return true;
  }
 }
 return !parked&&!o.parked&&gardenSection(o)===d.destination&&
  reorderBedsDuringDrag(o.id,x,y,Math.abs(x-d.x)>Math.abs(y-d.y)?'x':'y');
}
svg.addEventListener('pointerdown',e=>{
 if(drag)return;
 pathMoveStatus.textContent='';
 const g=e.target.closest('[data-id]');
 const pt=point(e),open=bufferOpen();
 const o=g?state.objects.find(x=>x.id===Number(g.getAttribute('data-id'))):nearbyPath(pt,open);
 if(!o){selected=null;selectedCell=null;paint();return}
 const id=o.id;selected=id;
 const targetCell=e.target.closest('[data-row][data-col]');
 selectedCell=targetCell?{i:Number(targetCell.getAttribute('data-row')),j:Number(targetCell.getAttribute('data-col'))}:null;
 if(pendingAssignment!==null&&o.type==='bed'){
  const cell=selectedCell||{i:0,j:0};assignCatalogToCell(pendingAssignment,o,cell.i,cell.j);return
 }
 if(!pt)return;
 if(o.perennial){paint();return}
 let displayOffset=!open?0:o.parked?BUFFER_LEFT:gardenSection(o)==='B'?BUFFER_WIDTH:0;
 if(o.type==='path'&&!o.parked)displayOffset=pt.x-pathMapX(pt.x,open);
 drag={id,pointerId:e.pointerId,start:pt,x:o.x,y:o.y,open,displayOffset,path:o.type==='path',
  targetX:o.x,targetY:o.y,moved:false,original:clone(state),plan:state};
 try{svg.setPointerCapture(e.pointerId)}catch{}
 paint();
});
svg.addEventListener('pointermove',e=>{
 if(!drag||e.pointerId!==drag.pointerId)return;
 dragDestination(drag,e);
 // Geen blokkering tijdens het slepen; de eindpositie wordt bij loslaten
 // bepaald. Hierdoor werkt slepen op kleine telefoons consistenter.
});
function endDrag(e){
 if(!drag||(e&&e.pointerId!==undefined&&e.pointerId!==drag.pointerId))return;
 const d=drag;drag=null;
 if(e&&e.type==='pointerup')dragDestination(d,e);
 if(e?.type==='pointerup'&&d.moved&&d.plan===state&&d.original.year===state.year){
  // Voorkom dat tussenstappen de plaatsing blokkeren.
  const ok=placeDraggedBed(d);
  if(ok){
   history.push(d.original);if(history.length>40)history.shift();
   storeHistory();updateUndo();save();
  }
  paint();
  if(d.path){
   pathMoveStatus.textContent=d.destination==='V'
    ?(ok?'Looppad staat in het Verschuifvak.':'Geen vrije plek voor dit looppad in het Verschuifvak van 5,20 m breed.')
    :(ok?'Looppad verplaatst.':'Geen vrije plek voor dit looppad. Een gedeeld pad moet in alle tuinjaren vrij liggen.');
  }else if(!ok)notify('Op de gekozen plek is geen ruimte voor dit vak');
 }else if(d.path)paint();
 try{if(svg.hasPointerCapture(d.pointerId))svg.releasePointerCapture(d.pointerId)}catch{}
}
svg.addEventListener('pointerup',endDrag);
svg.addEventListener('pointercancel',endDrag);
window.addEventListener('pointerup',endDrag);
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='mijn-slimme-moestuin-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('import').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const incoming=JSON.parse(await f.text());if(!incoming||!Array.isArray(incoming.objects)||!Number.isFinite(incoming.length)||!Number.isFinite(incoming.width)||incoming.length<1||incoming.width<1||!(Number(incoming.year)>=2026&&Number(incoming.year)<=2035)||!Number.isInteger(incoming.nextId))throw Error('Ongeldig bestand');if(!confirm('Huidige tuin vervangen door deze back-up?'))return;checkpoint();state=incoming;ensureCatalog();loadCustomCrops();applyCropOverrides();selected=null;selectedCell=null;save();syncInputs();paint()}catch{alert('Dit is geen geldige back-up van Mijn Slimme Moestuin.')}finally{e.target.value=''}};
$('reset').onclick=()=>{if(!confirm('Het huidige tuinplan vervangen door de basisindeling A en B (30 × 5 m per strook)? Maak eerst een back-up als je iets wilt bewaren.'))return;checkpoint();state=initial();selected=null;selectedCell=null;save();syncInputs();paint()};

// Versie 1.7.2: overzicht van alle teeltgegevens, onafhankelijk van de geselecteerde strook.
const monthNames=['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];
let registerEditKey=null;
const harvestStart=v=>v.harvestFrom||v.harvest||'';
const harvestEnd=v=>v.harvestTo||'';
function registerEntries(){
 const entries=[];
 state.objects.filter(o=>o.type==='bed').forEach(o=>Object.entries(o.sections||{}).forEach(([year,rows])=>{
  rows.forEach((r,i)=>(r.cols||[]).forEach((cell,j)=>cellVarieties(cell).forEach((v,k)=>entries.push({o,year,i,j,k,cell,v,key:`${o.id}/${year}/${i}/${j}/${k}`}))));
 }));
 return entries.sort((a,b)=>(crops[a.cell.crop]?.[0]||'').localeCompare(crops[b.cell.crop]?.[0]||'','nl',{sensitivity:'base'})||String(a.v.name||'').localeCompare(String(b.v.name||''),'nl',{sensitivity:'base'}));
}
function renderRegister(){
 const root=$('registerList');if(!root)return;
 const year=$('registerYear').value,month=$('registerMonth').value,search=$('registerSearch').value.trim().toLocaleLowerCase('nl');
 root.replaceChildren();
 const entries=registerEntries().filter(e=>{
  if(year!=='all'&&e.year!==year)return false;
  if(month!=='all'){
   const matchingDates=[e.v.planting,harvestStart(e.v),harvestEnd(e.v)].some(d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number(d.slice(5,7))===Number(month));
   if(String(e.v.month||'')!==month&&!matchingDates)return false;
  }
  const hay=[crops[e.cell.crop]?.[0],e.v.name,e.v.shop,e.v.notes].join(' ').toLocaleLowerCase('nl');
  return !search||hay.includes(search);
 });
 entries.sort((a,b)=>(crops[a.cell.crop]?.[0]||'').localeCompare(crops[b.cell.crop]?.[0]||'','nl',{sensitivity:'base'})||String(a.v.name||'').localeCompare(String(b.v.name||''),'nl',{sensitivity:'base'}));
 if(!entries.length){const p=document.createElement('p');p.className='hint';p.textContent='Geen teeltgegevens gevonden voor deze selectie.';root.append(p);return}
 const summary=document.createElement('p');summary.className='hint';summary.textContent=`${entries.length} registratie(s) gevonden`;root.append(summary);
 const wrap=document.createElement('div');wrap.className='registerTableWrap';
 const table=document.createElement('table');table.className='registerTable';
 const headings=['Jaar','Vak','Gewas','Ras','Tuinmaand','Gezaaid/gepoot','Oogst vanaf','Oogst tot','Weersomstandigheden','Winkel','Prijs (€)','Hoeveelheid','Score','Opmerkingen','Actie'];
 const thead=document.createElement('thead');const tr=document.createElement('tr');headings.forEach(h=>{const th=document.createElement('th');th.textContent=h;tr.append(th)});thead.append(tr);table.append(thead);
 const tbody=document.createElement('tbody');
 entries.forEach(e=>{
  const tr=document.createElement('tr');
  const values=[e.year,`${gardenSection(e.o)}-S${String(e.o.id).padStart(2,'0')} / ${e.i+1}.${e.j+1}`,crops[e.cell.crop]?.[0]||'',e.v.name,e.v.month?monthNames[Number(e.v.month)-1]||'':'',e.v.planting||'',harvestStart(e.v),harvestEnd(e.v),e.v.weather||'',e.v.shop||'',e.v.price??'',e.v.amount||'',e.v.rating||'',e.v.notes||''];
  values.forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td)});
  const td=document.createElement('td');const edit=document.createElement('button');edit.type='button';edit.className='secondary smallButton';edit.textContent=registerEditKey===e.key?'Sluiten':'Bewerken';edit.onclick=()=>{registerEditKey=registerEditKey===e.key?null:e.key;renderRegister()};td.append(edit);tr.append(td);tbody.append(tr);
  if(registerEditKey===e.key){
   const detail=document.createElement('tr');const cell=document.createElement('td');cell.colSpan=headings.length;
   const form=document.createElement('div');form.className='registerEdit';
   const draft={...e.v,harvestFrom:harvestStart(e.v),harvestTo:harvestEnd(e.v)};
   const fields=document.createElement('div');fields.className='varietyFields';
   const spec=[['name','Ras','text'],['shop','Gekocht bij','text'],['price','Prijs (€)','number'],['amount','Hoeveelheid / verpakking','text'],['month','Tuinmaand','month'],['planting','Zaai- of pootdatum','date'],['harvestFrom','Oogst vanaf','date'],['harvestTo','Oogst tot','date'],['weather','Weersomstandigheden','text'],['rating','Beoordeling (1–5)','rating'],['notes','Oogstresultaat / opmerkingen','text']];
   spec.forEach(([key,label,type])=>{
    const lab=document.createElement('label');lab.textContent=label;let inp;
    if(type==='month'||type==='rating'){
     inp=document.createElement('select');const options=type==='month'?[['','Niet ingevuld'],...monthNames.map((m,i)=>[String(i+1),m])]:[['','Nog niet beoordeeld'],...[1,2,3,4,5].map(n=>[String(n),n+' sterren'])];
     options.forEach(([value,text])=>{const opt=document.createElement('option');opt.value=value;opt.textContent=text;inp.append(opt)});
    }else{inp=document.createElement('input');inp.type=type;if(type==='number'){inp.min='0';inp.step='.01'}}
    inp.value=draft[key]??'';inp.oninput=()=>{draft[key]=inp.value};inp.onchange=()=>{draft[key]=inp.value};lab.append(inp);fields.append(lab);
   });
   const repeat=document.createElement('label');repeat.className='varietyRepeat';const cb=document.createElement('input');cb.type='checkbox';cb.checked=!!draft.repeat;cb.onchange=()=>{draft.repeat=cb.checked};repeat.append(cb,document.createTextNode(' Volgend jaar opnieuw kopen / telen'));fields.append(repeat);
   const saveButton=document.createElement('button');saveButton.type='button';saveButton.textContent='✓ Wijzigingen opslaan';saveButton.onclick=()=>{
    if(!draft.name?.trim()){alert('Vul een rasnaam in.');return}
    if(draft.price!==''&&(!Number.isFinite(Number(draft.price))||Number(draft.price)<0)){alert('Vul een geldige prijs in.');return}
    if(draft.harvestFrom&&draft.harvestTo&&draft.harvestTo<draft.harvestFrom){alert('Oogst tot moet op of na oogst vanaf liggen.');return}
    checkpoint();Object.assign(e.v,draft,{name:draft.name.trim()});save();registerEditKey=null;paint();notify('✓ Teeltgegevens gewijzigd en opgeslagen');
   };
   form.append(fields,saveButton);cell.append(form);detail.append(cell);tbody.append(detail);
  }
 });
 table.append(tbody);wrap.append(table);root.append(wrap);
}
['registerYear','registerMonth','registerSearch'].forEach(id=>$(id).addEventListener(id==='registerSearch'?'input':'change',()=>{registerEditKey=null;renderRegister()}));
$('registerYear').value=state.year;
$('toggleLegend').onclick=()=>{const content=$('legendContent');content.hidden=!content.hidden;const open=!content.hidden;$('toggleLegend').textContent=open?'✕ Verberg groenten en kleuren':'Groenten en kleuren';$('toggleLegend').setAttribute('aria-expanded',String(open))};

$('exportRegister').onclick=()=>{
 const table=$('registerList').querySelector('table');if(!table){notify('Geen registraties om te exporteren');return}
 const rows=[...table.querySelectorAll('thead tr, tbody tr')].filter(tr=>tr.querySelectorAll('td').length!==1).map(tr=>[...tr.querySelectorAll('th,td')].slice(0,-1).map(c=>c.textContent));
 const esc=value=>'"'+String(value??'').replace(/"/g,'""').replace(/^[=+@-]/,m=>"'"+m)+'"';
 const csv='\uFEFF'+rows.map(r=>r.map(esc).join(';')).join('\r\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='mijn-teeltregister.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};



// Versie 1.8: centrale lijst, onafhankelijk van de plattegrond.
const catalogColumns=[['id','ID'],['crop','Gewas'],['name','Ras'],['shop','Leverancier'],['price','Prijs (€)'],['amount','Hoeveelheid'],['purchase','Aankoopdatum'],['notes','Opmerkingen']];
let catalogEdit=null;
function renderCatalog(){const root=$('catalogList');if(!root)return;ensureCatalog();root.replaceChildren();const filter=$('catalogCropFilter');if(filter.options.length!==crops.length)fillCropMenus();const q=$('catalogSearch').value.trim().toLocaleLowerCase('nl');const rows=state.catalog.filter(e=>(filter.value==='all'||String(e.crop)===filter.value)&&(!q||[crops[e.crop]?.[0],e.name,e.shop,e.notes].join(' ').toLocaleLowerCase('nl').includes(q))).sort((a,b)=>(crops[a.crop]?.[0]||'').localeCompare(crops[b.crop]?.[0]||'','nl',{sensitivity:'base'})||String(a.name||'').localeCompare(String(b.name||''),'nl',{sensitivity:'base'}));const summary=document.createElement('p');summary.className='hint';summary.textContent=`${rows.length} soort(en) gevonden · ${state.catalog.length} totaal`;root.append(summary);const wrap=document.createElement('div');wrap.className='registerTableWrap';const table=document.createElement('table');table.className='registerTable catalogTable';const head=document.createElement('tr');[...catalogColumns.map(x=>x[1]),'Actie'].forEach(h=>{const th=document.createElement('th');th.textContent=h;head.append(th)});const thead=document.createElement('thead');thead.append(head);table.append(thead);const body=document.createElement('tbody');rows.forEach(e=>{const tr=document.createElement('tr');catalogColumns.forEach(([k])=>{const td=document.createElement('td');td.textContent=k==='crop'?(crops[e.crop]?.[0]||''):String(e[k]??'');tr.append(td)});const action=document.createElement('td');const edit=document.createElement('button');edit.className='smallButton secondary';edit.textContent='Bewerken';edit.onclick=()=>{catalogEdit=e.id;renderCatalog()};action.append(edit);const assign=document.createElement('button');assign.className='smallButton assignButton';assign.textContent='Toewijzen aan tuinvlak';assign.onclick=()=>{pendingAssignment=e.id;notify('Klik nu op een vak in de plattegrond');$('mapOuter').scrollIntoView({behavior:'smooth',block:'center'})};action.append(assign);tr.append(action);body.append(tr);if(catalogEdit===e.id){const detail=document.createElement('tr');const td=document.createElement('td');td.colSpan=catalogColumns.length+1;const form=document.createElement('div');form.className='registerEdit';const fields=document.createElement('div');fields.className='varietyFields';const draft={...e};for(const [k,label] of catalogColumns.filter(([k])=>k!=='id')){const lab=document.createElement('label');lab.textContent=label;let input;if(k==='crop'){input=document.createElement('select');cropNames().forEach(c=>input.append(new Option(c.name,String(c.id))))}else{input=document.createElement('input');input.type=k==='purchase'?'date':k==='price'?'number':'text';if(k==='price'){input.min='0';input.step='.01'}}input.value=draft[k]??'';input.oninput=()=>draft[k]=input.value;lab.append(input);fields.append(lab)}const saveBtn=document.createElement('button');saveBtn.textContent='✓ Opslaan';saveBtn.onclick=()=>{if(!draft.name?.trim()){alert('Vul een rasnaam in');return}checkpoint();Object.assign(e,draft,{crop:Number(draft.crop),name:draft.name.trim()});catalogEdit=null;save();paint()};const del=document.createElement('button');del.className='danger';del.textContent='Verwijderen';del.onclick=()=>{if(!confirm('Ras uit centrale lijst verwijderen? Reeds geregistreerde teelten blijven behouden.'))return;checkpoint();state.catalog=state.catalog.filter(x=>x.id!==e.id);catalogEdit=null;save();paint()};const buttons=document.createElement('div');buttons.className='toolbar';buttons.append(saveBtn,del);form.append(fields,buttons);td.append(form);detail.append(td);body.append(detail)}});table.append(body);wrap.append(table);root.append(wrap)}
$('toggleCatalog').onclick=()=>{const c=$('catalogContent');c.hidden=!c.hidden;$('toggleCatalog').textContent=c.hidden?'Moestuinregister':'Moestuinregister';$('toggleCatalog').setAttribute('aria-expanded',String(!c.hidden));if(!c.hidden)renderCatalog()};
$('catalogSearch').oninput=renderCatalog;$('catalogCropFilter').onchange=renderCatalog;
let pendingAssignment=null;
function fillCropMenus(){const filter=$('catalogCropFilter'),picker=$('newCatalogCrop');const old=filter.value;filter.replaceChildren(new Option('Alle gewassen','all'));picker.replaceChildren();cropNames().forEach(c=>{filter.append(new Option(c.name,String(c.id)));picker.append(new Option(c.name,String(c.id)))});filter.value=[...filter.options].some(o=>o.value===old)?old:'all'}
$('catalogAdd').onclick=()=>{const chosen=$('catalogCropFilter').value;$('catalogNewForm').hidden=false;fillCropMenus();if(chosen!=='all'&&[...$('newCatalogCrop').options].some(o=>o.value===chosen))$('newCatalogCrop').value=chosen;$('newCatalogName').focus()};
$('cancelCatalogNew').onclick=()=>{$('catalogNewForm').hidden=true;quickPendingRegistration=false};
$('saveCatalogNew').onclick=()=>{const crop=Number($('newCatalogCrop').value),name=$('newCatalogName').value.trim();if(!crop||!name){alert('Kies een gewas en vul een rasnaam in.');return}checkpoint();ensureCatalog();const entry={id:state.nextCatalogId++,crop,name,shop:'',price:'',amount:'',purchase:'',notes:''};state.catalog.push(entry);catalogEdit=entry.id;$('catalogNewForm').hidden=true;$('newCatalogName').value='';
 addCustomVariety(crop,name);
 const fromQuick=quickPendingRegistration;
 if(quickPendingRegistration){
   quickPendingRegistration=false;
   $('quickCrop').value=String(crop);
   quickSelectedVarieties.add(name);
   setQuickRasMode('existing');
 }
 save();paint();
 if(fromQuick){
   quickSelectedVarieties.add(name);
   $('quickVariety').value=[...quickSelectedVarieties].join(', ');
   setQuickRasMode('existing');refreshQuickSuggestions();
   $('quickEdit').scrollIntoView({behavior:'smooth',block:'center'});
   notify('✓ Nieuw ras geregistreerd en aangevinkt. Klik op Opslaan om het in de strook te zetten.');
 }};
$('addCrop').onclick=()=>createManagedCrop();
function assignCatalogToCell(id,obj,i,j){const e=state.catalog.find(x=>String(x.id)===String(id));if(!e||!obj||obj.type!=='bed')return;const cell=sections(obj)[i]?.cols[j];if(!cell)return;if(cellVarieties(cell).length&&Number(cell.crop)!==Number(e.crop)&&!confirm('Dit vak bevat andere teeltgegevens. Deze vervangen?'))return;checkpoint();if(Number(cell.crop)!==Number(e.crop)){cell.crop=Number(e.crop);cell.varieties=[]}cell.varieties??=[];if(cell.varieties.some(v=>String(v.catalogId)===String(e.id))){notify('Dit ras staat al in dit vak');return}const v=newVariety(e.crop,e.name);Object.assign(v,{catalogId:e.id,shop:e.shop||'',price:e.price||'',amount:e.amount||''});cell.varieties.push(v);pendingAssignment=null;save();paint();notify('✓ Ras aan tuinvlak toegewezen')}
function downloadCsv(rows,filename){const esc=v=>'"'+String(v??'').replace(/"/g,'""').replace(/^[=+@-]/,m=>"'"+m)+'"';const csv='\uFEFF'+rows.map(r=>r.map(esc).join(';')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('catalogExport').onclick=()=>{ensureCatalog();downloadCsv([catalogColumns.map(x=>x[1]),...state.catalog.slice().sort((a,b)=>(crops[a.crop]?.[0]||'').localeCompare(crops[b.crop]?.[0]||'','nl',{sensitivity:'base'})||String(a.name||'').localeCompare(String(b.name||''),'nl',{sensitivity:'base'})).map(e=>catalogColumns.map(([k])=>k==='crop'?crops[e.crop]?.[0]:e[k]))],'mijn-moestuinregister.csv')};
function parseCsv(s){s=s.replace(/^\uFEFF/,'');const first=s.split(/\r?\n/,1)[0];const sep=(first.match(/;/g)||[]).length>=(first.match(/,/g)||[]).length?';':',';const rows=[];let row=[],field='',quoted=false;for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quoted&&s[i+1]==='"'){field+='"';i++}else quoted=!quoted}else if(c===sep&&!quoted){row.push(field);field=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&s[i+1]==='\n')i++;row.push(field);if(row.some(x=>x!==''))rows.push(row);row=[];field=''}else field+=c}if(quoted)throw Error('Onjuist CSV-bestand');row.push(field);if(row.some(x=>x!==''))rows.push(row);return rows}
$('catalogImport').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const rows=parseCsv(await file.text());const expected=catalogColumns.map(x=>x[1]);if(!rows.length||expected.some((h,i)=>rows[0][i]!==h))throw Error('Kolomkoppen komen niet overeen. Exporteer eerst een voorbeeld vanuit de app.');const updates=[];const seen=new Set();for(const row of rows.slice(1)){const rec={};catalogColumns.forEach(([k],i)=>rec[k]=String(row[i]||'').trim());const crop=crops.findIndex(c=>c[0].toLowerCase()===rec.crop.toLowerCase());if(crop<1||!rec.name)throw Error('Ongeldig gewas of lege rasnaam in CSV');rec.crop=crop;rec.id=rec.id?Number(rec.id):null;if(rec.id!==null&&(!Number.isSafeInteger(rec.id)||rec.id<1||seen.has(rec.id)))throw Error('Ongeldig of dubbel ID');if(rec.id)seen.add(rec.id);updates.push(rec)}if(!confirm(`${updates.length} regels importeren? Bestaande ID’s worden bijgewerkt; andere regels worden toegevoegd. Maak eerst een JSON-back-up.`))return;ensureCatalog();checkpoint();for(const rec of updates){let existing=state.catalog.find(x=>x.id===rec.id);if(existing)Object.assign(existing,rec);else{if(!rec.id||state.catalog.some(x=>x.id===rec.id))rec.id=state.nextCatalogId++;else state.nextCatalogId=Math.max(state.nextCatalogId,rec.id+1);state.catalog.push(rec)}}save();paint();notify('✓ Moestuinregister geïmporteerd')}catch(err){alert('Import mislukt: '+err.message)}finally{e.target.value=''}};

const pathMoveStatus=document.createElement('p');
pathMoveStatus.className='hint';
pathMoveStatus.setAttribute('role','status');
$('mapOuter').after(pathMoveStatus);
const activeYearLabel=document.createElement('strong');
activeYearLabel.id='activeGardenYear';
activeYearLabel.setAttribute('aria-live','polite');
activeYearLabel.style.display='block';
activeYearLabel.style.marginBlock='0.5rem';
const planningControls=document.createElement('div');
planningControls.className='toolbar';
const copyYearButton=document.createElement('button');
copyYearButton.type='button';
copyYearButton.textContent='Kopieer gehele tuinjaar';
copyYearButton.onclick=copyGardenYear;
const bufferButton=document.createElement('button');
bufferButton.type='button';
bufferButton.style.backgroundColor='#286646';
bufferButton.style.color='#fff';
bufferButton.setAttribute('aria-controls','map');
bufferButton.onclick=()=>{
 if(parkedObjects().length){
  alert('Sleep eerst alle vakken en looppaden uit het Verschuifvak terug naar A of B.');
  return;
 }
 openBufferYear=bufferOpen()?null:String(state.year);
 paint();
};
planningControls.append(copyYearButton,bufferButton);
$('mapOuter').before(activeYearLabel,planningControls);

function renderPlanningControls(){
 const title=`Tuinjaar ${state.year}`;
 if(activeYearLabel.textContent!==title)activeYearLabel.textContent=title;
 const objects=parkedObjects();
 const count=objects.length;
 if(count)openBufferYear=String(state.year);
 const open=bufferOpen();
 const label=count===1?(objects[0].type==='path'?'1 looppad':'1 vak'):`${count} geparkeerd`;
 bufferButton.textContent=count?`Verschuifvak · ${label}`:
  open?'Verschuifvak sluiten':'Verschuifvak tonen';
 bufferButton.setAttribute('aria-expanded',String(open));
 bufferButton.title=count?'Sleep eerst alle vakken en looppaden terug naar A of B':'';
}

function copyGardenYear(){
 const from=String(state.year);
 if(parkedObjects().length){alert('Maak het Verschuifvak van '+from+' eerst leeg.');return}
 const yearControl=$('year');
 const years=yearControl.options?[...yearControl.options].map(option=>option.value):
  Array.from({length:10},(_,i)=>String(i+2026));
 const targets=years.filter(year=>/^20(2[6-9]|3[0-5])$/.test(year)&&year!==from);
 if(!targets.length){alert('Er is geen ander tuinjaar beschikbaar.');return}
 const answer=prompt(`Kopieer de indeling van ${from} naar welk jaar? Kies ${targets.join(', ')}.`,
  targets.includes(String(Number(from)+1))?String(Number(from)+1):targets[0]);
 if(answer===null)return;
 const to=answer.trim();
 if(!targets.includes(to)){alert('Kies een geldig ander tuinjaar.');return}
 const isAnnual=o=>o.type==='bed'&&!o.perennial;
 const source=state.objects.filter(o=>isAnnual(o)&&isInYear(o,from));
 if(!source.length){alert('In '+from+' staan geen jaargebonden vakken om te kopiëren.');return}
 const existing=state.objects.filter(o=>isAnnual(o)&&isInYear(o,to));
 if(existing.some(o=>o.parked)){alert('Maak het Verschuifvak van '+to+' eerst leeg.');return}
 if(existing.length&&!confirm(`Vervang de ${existing.length} bestaande jaarvakken van ${to}, inclusief hun teeltgegevens? ${from} blijft behouden.`))return;
 let nextId=state.nextId;
 const copied=source.map(bed=>{
  const copy=clone(bed);
  // Normaliseer oudere vakindelingen op de kopie, zodat het bronjaar intact blijft.
  const rows=sections(copy);
  for(const row of rows)for(const cell of row.cols){
   if(!Array.isArray(cell.varieties))continue;
   cell.varieties=cell.varieties.map(v=>{
    const variety=newVariety(cell.crop,v.name);
    for(const key of ['catalogId','shop','price','amount','month','repeat']){
     if(Object.hasOwn(v,key))variety[key]=v[key];
    }
    return variety;
   });
  }
  delete copy.hiddenYears;
  return {...copy,id:nextId++,year:to,perennialSource:to,sections:{[to]:rows}};
 });
 checkpoint();
 const replaced=new Set(existing);
 state.objects=state.objects.flatMap(o=>{
  if(!replaced.has(o))return [o];
  const sections={...o.sections};
  delete sections[to];
  // Behoud registraties uit andere jaren, ook bij oudere gedeelde vakken.
  if(!o.year)return [{...o,sections,hiddenYears:[...(o.hiddenYears||[]),to]}];
  if(Object.keys(sections).length)return [{...o,sections,registerOnly:true}];
  return [];
 });
 state.objects.push(...copied);
 state.nextId=nextId;
 state.year=to;
 selected=null;selectedCell=null;pendingAssignment=null;openBufferYear=null;
 save();syncInputs();paint();
 notify(`✓ Tuinplan van ${from} gekopieerd naar ${to}`);
}
syncInputs();paint();applyZoom();updateUndo();

// Veilige toegang voor Firebase: externe synchronisatie kan alleen via deze twee functies.
window.gardenGetState=()=>clone(state);
window.gardenReceiveCloud=function(incoming){
 if(!incoming||!Array.isArray(incoming.objects)||!Number.isFinite(incoming.length)||!Number.isFinite(incoming.width)||!(Number(incoming.year)>=2026&&Number(incoming.year)<=2035)||!Number.isInteger(incoming.nextId))throw Error('Ongeldig online tuinplan');
 checkpoint();state=clone(incoming);ensureCatalog();loadCustomCrops();applyCropOverrides();selected=null;selectedCell=null;
 localStorage.setItem(KEY,JSON.stringify(state));syncInputs();paint();updateUndo();
};

// Mijn Slimme Moestuin 1.6 - Firebase synchronisatie
(function(){
 const cfg={apiKey:'AIzaSyCWWZakMN0G-r3qbpVcaFscxfeo8AxxXOc',authDomain:'mijn-slimme-moestuin.firebaseapp.com',databaseURL:'https://mijn-slimme-moestuin-default-rtdb.europe-west1.firebasedatabase.app',projectId:'mijn-slimme-moestuin',storageBucket:'mijn-slimme-moestuin.firebasestorage.app',messagingSenderId:'97908641307',appId:'1:97908641307:web:3f59158e8f1c0c84a832be'};
 const $=id=>document.getElementById(id);
 const say=s=>{$('cloudStatus').textContent=s};
 if(!window.firebase){say('Firebase kon niet worden geladen. Controleer je internetverbinding.');return}
 let auth,db,ref,unsubscribe=null,connected=false,writing=false,pending=null,writeQueue=Promise.resolve(),lastRemote=null;
 try{firebase.initializeApp(cfg);auth=firebase.auth();db=firebase.database()}catch(e){say('Firebase initialisatie mislukt: '+e.message);return}
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const valid=s=>s&&Array.isArray(s.objects)&&Number.isFinite(s.length)&&Number.isFinite(s.width)&&['2026','2027'].includes(s.year)&&Number.isInteger(s.nextId);
 function resetConnection(){if(unsubscribe&&ref){ref.off('value',unsubscribe);unsubscribe=null}connected=false;ref=null;pending=null;lastRemote=null;$('cloudChoices').hidden=true;$('cloudConnect').hidden=true}
 function setSignedIn(user){$('cloudLogin').hidden=!!user;$('cloudAccount').hidden=!user;$('cloudEmail').textContent=user?user.email:'';resetConnection();if(user){$('cloudConnect').hidden=false;say('Ingelogd. Kies Verbinden om tuinplannen te vergelijken.')}else say('Niet ingelogd. Je tuinplan blijft lokaal bewaard.')}
 auth.onAuthStateChanged(setSignedIn,e=>say('Inlogcontrole mislukt: '+e.message));
 $('cloudSignIn').onclick=async()=>{const email=$('cloudUser').value.trim(),pass=$('cloudPassword').value;if(!email||!pass){say('Vul e-mailadres en wachtwoord in.');return}try{say('Bezig met inloggen…');await auth.signInWithEmailAndPassword(email,pass);$('cloudPassword').value=''}catch(e){say('Inloggen mislukt: '+e.message)}};
 $('cloudSignOut').onclick=async()=>{try{resetConnection();await auth.signOut()}catch(e){say('Uitloggen mislukt: '+e.message)}};
 function listen(){
   if(unsubscribe)unsubscribe();connected=true;$('cloudChoices').hidden=true;$('cloudConnect').hidden=true;
   unsubscribe=ref.on('value',snap=>{
     const record=snap.val();if(!record||!valid(record.plan))return;
     const remote=record.plan;lastRemote=remote;
     if(writing||pending)return;
     if(!same(remote,window.gardenGetState())){try{window.gardenReceiveCloud(remote);say('✓ Tuinplan bijgewerkt vanaf een ander apparaat.')}catch(e){say('Online gegevens konden niet worden geopend: '+e.message)}}
   },e=>say('Luisteren mislukt: '+e.message));
   say('✓ Verbonden. Wijzigingen worden automatisch gesynchroniseerd.');
 }
 async function uploadFirst(){
  if(!ref)return;
  if(!$('cloudUseOnline').hidden && !confirm('Het online tuinplan wordt vervangen door dat van dit apparaat. Heb je van beide een back-up?'))return;
  try{say('Tuinplan veilig naar Firebase sturen…');const plan=window.gardenGetState();
   const result=await ref.transaction(current=>{
     if(current && valid(current.plan) && $('cloudUseOnline').hidden)return;
     return {plan,updatedAt:firebase.database.ServerValue.TIMESTAMP};
   },undefined,false);
   if(!result.committed){say('Er staat inmiddels een tuinplan online. Vergelijk de plannen opnieuw.');$('cloudConnect').hidden=false;return}
   lastRemote=plan;listen()
  }catch(e){say('Upload mislukt: '+e.message)}
 }
 $('cloudConnect').onclick=async()=>{
   const user=auth.currentUser;if(!user){say('Log eerst in.');return}
   ref=db.ref('tuinplannen/'+user.uid);$('cloudUseOnline').hidden=false;say('Online tuinplan controleren…');
   try{const snap=await ref.once('value');const rec=snap.val();
     if(rec&&valid(rec.plan)){
       if(same(rec.plan,window.gardenGetState())){
         // Ook bij identieke plannen het keuzescherm laten zien.
         // Geen automatische overschrijving of verborgen keuze.
         lastRemote=rec.plan;
         $('cloudChoices').hidden=false;
         $('cloudUseOnline').hidden=false;
         say('Beide tuinplannen zijn gelijk. Je kunt kiezen welk plan je wilt gebruiken of dit venster sluiten.');
         return;
       }
       $('cloudChoices').hidden=false;say('Er staat al een ander tuinplan online. Kies welk plan je wilt gebruiken.');
     }else{$('cloudChoices').hidden=false;$('cloudUseOnline').hidden=true;say('Online staat nog geen tuinplan. Kies “Dit apparaat online zetten”.')}
   }catch(e){say('Online controleren mislukt: '+e.message)}
 };
 $('cloudUseLocal').onclick=uploadFirst;
 $('cloudUseOnline').onclick=async()=>{
   try{const snap=await ref.once('value');const rec=snap.val();if(!rec||!valid(rec.plan))throw Error('Geen geldig online plan');
     if(!confirm('Het tuinplan op dit apparaat vervangen door het online tuinplan? Maak eerst een JSON-back-up van dit apparaat.'))return;
     window.gardenReceiveCloud(rec.plan);lastRemote=rec.plan;listen();
   }catch(e){say('Online plan openen mislukt: '+e.message)}
 };
 window.gardenCloudChanged=plan=>{
   if(!connected||!ref)return;
   pending=plan;writing=true;
   writeQueue=writeQueue.then(async()=>{
     while(pending){const next=pending;pending=null;await ref.set({plan:next,updatedAt:firebase.database.ServerValue.TIMESTAMP});lastRemote=next}
     writing=false;say('✓ Lokaal en online opgeslagen.');
   }).catch(e=>{writing=false;connected=false;if(unsubscribe){ref.off('value',unsubscribe);unsubscribe=null} $('cloudConnect').hidden=false;say('Online opslaan mislukt: '+e.message+'. Lokaal is wel opgeslagen. Verbind opnieuw.')});
 };
})();

// Versie 1.8.1: aankopen en teeltresultaten achter dezelfde knop.
function selectRegisterTab(tab){
 const purchases=tab==='catalog';
 $('catalogTabContent').hidden=!purchases;
 $('registerContent').hidden=purchases;
 $('showCatalogTab').classList.toggle('active',purchases);
 $('showResultsTab').classList.toggle('active',!purchases);
 $('showCatalogTab').setAttribute('aria-pressed',String(purchases));
 $('showResultsTab').setAttribute('aria-pressed',String(!purchases));
 if(purchases)renderCatalog();else renderRegister();
}
$('showCatalogTab').onclick=()=>selectRegisterTab('catalog');
$('showResultsTab').onclick=()=>selectRegisterTab('results');
selectRegisterTab('catalog');
// Versie 1.8.4: alleen-lezen totaaloverzicht, één werkblad van aankoop tot oogst.
// De afzonderlijke Excel-import/export van beide tabbladen blijft ongewijzigd.
$('exportWorkbook').onclick=()=>{
 if(!workbookReady())return;
 ensureCatalog();
 const head=['ID aankoop','Gewas','Ras','Leverancier','Prijs (€)','Hoeveelheid gekocht','Aankoopdatum','Aankoopopmerkingen','Tuinjaar','Tuinvak','Tuinmaand','Zaai- of pootdatum','Oogst vanaf','Oogst tot','Weersomstandigheden','Beoordeling','Opbrengst (kg)','Teeltopmerkingen'];
 const purchases=state.catalog.slice().sort((a,b)=>(crops[a.crop]?.[0]||'').localeCompare(crops[b.crop]?.[0]||'','nl',{sensitivity:'base'})||String(a.name||'').localeCompare(String(b.name||''),'nl',{sensitivity:'base'}));
 const records=registerEntries();
 const rows=[];
 const matched=new Set();
 const toRow=(p,e)=>[
   p?.id??e?.v.catalogId??'',
   p?crops[p.crop]?.[0]||'':crops[e.cell.crop]?.[0]||'',
   p?.name||e?.v.name||'',
   p?.shop||e?.v.shop||'',
   p?.price??e?.v.price??'',
   p?.amount||e?.v.amount||'',
   p?.purchase||'',
   p?.notes||'',
   e?.year||'',
   e?`${gardenSection(e.o)}-S${String(e.o.id).padStart(2,'0')} / ${e.i+1}.${e.j+1}`:'',
   e?.v.month?(monthNames[Number(e.v.month)-1]||''):'',
   e?.v.planting||'',
   e?harvestStart(e.v):'',
   e?harvestEnd(e.v):'',
   e?.v.weather||'',
   e?.v.rating||'',
   e?.v.yieldKg??'',
   e?.v.notes||''
 ];
 purchases.forEach(p=>{
   const linked=records.filter(e=>String(e.v.catalogId||'')===String(p.id));
   if(linked.length){linked.forEach(e=>{matched.add(e.key);rows.push(toRow(p,e))})}
   else rows.push(toRow(p,null));
 });
 // Oudere teeltregistraties zonder aankoop-ID niet laten verdwijnen.
 records.filter(e=>!matched.has(e.key)).forEach(e=>rows.push(toRow(null,e)));
 const wb=XLSX.utils.book_new();
 const ws=XLSX.utils.aoa_to_sheet([head,...rows]);
 ws['!autofilter']={ref:`A1:${XLSX.utils.encode_col(head.length-1)}${Math.max(1,rows.length+1)}`};
 ws['!cols']=head.map((h,i)=>({wch:[12,19,27,23,13,21,17,32,12,20,16,20,17,17,26,15,17,38][i]}));
 XLSX.utils.book_append_sheet(wb,ws,'Aankoop tot oogst');
 XLSX.writeFile(wb,'mijn-moestuin-aankoop-tot-oogst.xlsx');
};

// Versie 1.8.2: echte Excel-downloads en gecontroleerde import.
function workbookReady(){if(typeof XLSX==='undefined'){alert('Excel-ondersteuning is niet geladen. Controleer de internetverbinding.');return false}return true}
function exportXlsx(head,rows,sheet,filename){if(!workbookReady())return;const wb=XLSX.utils.book_new();const ws=XLSX.utils.aoa_to_sheet([head,...rows]);ws['!autofilter']={ref:`A1:${XLSX.utils.encode_col(head.length-1)}${Math.max(2,rows.length+1)}`};ws['!cols']=head.map(h=>({wch:Math.max(14,Math.min(32,String(h).length+7))}));XLSX.utils.book_append_sheet(wb,ws,sheet);XLSX.writeFile(wb,filename)}
$('catalogExport').onclick=()=>{ensureCatalog();exportXlsx(catalogColumns.map(x=>x[1]),state.catalog.slice().sort((a,b)=>(crops[a.crop]?.[0]||'').localeCompare(crops[b.crop]?.[0]||'','nl',{sensitivity:'base'})||String(a.name||'').localeCompare(String(b.name||''),'nl',{sensitivity:'base'})).map(e=>catalogColumns.map(([k])=>k==='crop'?crops[e.crop]?.[0]:e[k])),'Zaden en aankopen','zaden-en-aankopen.xlsx')};
$('exportRegister').onclick=()=>{const head=['Jaar','Vak','ID aankoop','Gewas','Ras','Tuinmaand','Gezaaid gepoot','Oogst vanaf','Oogst tot','Weersomstandigheden','Leverancier','Prijs (€)','Hoeveelheid','Beoordeling','Opbrengst (kg)','Opmerkingen'];const rows=registerEntries().map(e=>[e.year,`${gardenSection(e.o)}-S${String(e.o.id).padStart(2,'0')} / ${e.i+1}.${e.j+1}`,e.v.catalogId||'',crops[e.cell.crop]?.[0]||'',e.v.name||'',e.v.month||'',e.v.planting||'',harvestStart(e.v),harvestEnd(e.v),e.v.weather||'',e.v.shop||'',e.v.price||'',e.v.amount||'',e.v.rating||'',e.v.yieldKg||'',e.v.notes||'']);exportXlsx(head,rows,'Teeltresultaten','teeltresultaten.xlsx')};
async function readXlsx(file){if(!workbookReady())throw Error('Excel-ondersteuning niet beschikbaar');const data=await file.arrayBuffer();const book=XLSX.read(data,{type:'array',cellDates:false});if(!book.SheetNames.length)throw Error('Leeg Excel-bestand');return XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,defval:'',raw:false})}
$('catalogImport').onchange=async ev=>{const file=ev.target.files?.[0];if(!file)return;try{const rows=await readXlsx(file),head=catalogColumns.map(x=>x[1]);if(head.some((h,i)=>rows[0]?.[i]!==h))throw Error('Kolommen komen niet overeen met de Excel-export.');const entries=[];const seen=new Set();for(const row of rows.slice(1)){if(!row.some(v=>String(v).trim()))continue;const rec={};catalogColumns.forEach(([k],i)=>rec[k]=String(row[i]??'').trim());const crop=crops.findIndex(c=>c[0].toLocaleLowerCase('nl')===rec.crop.toLocaleLowerCase('nl'));if(crop<1||!rec.name)throw Error('Onbekend gewas of lege rasnaam');rec.crop=crop;rec.id=rec.id?Number(rec.id):null;if(rec.id!==null&&(!Number.isSafeInteger(rec.id)||rec.id<1||seen.has(rec.id)))throw Error('Dubbel of ongeldig ID');if(rec.id)seen.add(rec.id);entries.push(rec)}if(!confirm(`${entries.length} aankopen importeren? Bestaande ID's worden bijgewerkt. Maak eerst een JSON-back-up.`))return;checkpoint();ensureCatalog();for(const rec of entries){const existing=state.catalog.find(x=>x.id===rec.id);if(existing)Object.assign(existing,rec);else{if(!rec.id||state.catalog.some(x=>x.id===rec.id))rec.id=state.nextCatalogId++;else state.nextCatalogId=Math.max(state.nextCatalogId,rec.id+1);state.catalog.push(rec)}}save();paint();notify('✓ Excel-aankopen geïmporteerd')}catch(e){alert('Excel-import mislukt: '+e.message)}finally{ev.target.value=''}};
$('importRegister').onchange=async ev=>{const file=ev.target.files?.[0];if(!file)return;try{const rows=await readXlsx(file);const head=['Jaar','Vak','ID aankoop','Gewas','Ras','Tuinmaand','Gezaaid gepoot','Oogst vanaf','Oogst tot','Weersomstandigheden','Leverancier','Prijs (€)','Hoeveelheid','Beoordeling','Opbrengst (kg)','Opmerkingen'];if(head.some((h,i)=>rows[0]?.[i]!==h))throw Error('Kolommen komen niet overeen met de teeltresultaten-export.');const lookup=new Map(registerEntries().map(e=>[`${e.year}|${gardenSection(e.o)}-S${String(e.o.id).padStart(2,'0')} / ${e.i+1}.${e.j+1}|${e.v.catalogId||''}|${e.v.name}`,e]));const changes=[];for(const row of rows.slice(1)){if(!row.some(v=>String(v).trim()))continue;const key=`${row[0]}|${row[1]}|${row[2]}|${row[4]}`;const e=lookup.get(key);if(!e)throw Error('Teeltregel niet gevonden: '+key+'. Voeg nieuwe teelten eerst toe via de plattegrond.');changes.push({e,row})}if(!confirm(`${changes.length} bestaande teeltregels bijwerken vanuit Excel? Maak eerst een JSON-back-up.`))return;checkpoint();for(const {e,row} of changes){Object.assign(e.v,{month:String(row[5]||''),planting:String(row[6]||''),harvestFrom:String(row[7]||''),harvestTo:String(row[8]||''),weather:String(row[9]||''),rating:String(row[13]||''),yieldKg:String(row[14]||''),notes:String(row[15]||'')})}save();paint();notify('✓ Teeltresultaten bijgewerkt vanuit Excel')}catch(e){alert('Import mislukt: '+e.message)}finally{ev.target.value=''}};


// Versie 1.8.5: gewassen beheren met stabiele nummers (nooit indexen verschuiven).
function renderCropManager(){
 const sel=$('manageCrop');if(!sel)return;
 const old=managedCropSelection||sel.value;
 sel.replaceChildren();sel.append(new Option('Kies een gewas…',''));
 cropNames().forEach(({id,name})=>sel.append(new Option(String(id).padStart(2,'0')+' · '+name,String(id))));
 sel.value=[...sel.options].some(o=>o.value===old)?old:'';
 managedCropSelection=sel.value;
}
$('manageCrop').onchange=()=>{managedCropSelection=$('manageCrop').value};
// Versie 1.8.8: visuele kleurenkeuze voor toevoegen en wijzigen.
const cropPalette=[
 ['Lichtgroen','#a9c984'],['Grasgroen','#7ebf8e'],['Donkergroen','#387a4b'],
 ['Mintgroen','#9ed2af'],['Saliegroen','#b4d8bd'],['Geelgroen','#c3dda6'],
 ['Zachtgeel','#efd59a'],['Okergeel','#edc27b'],['Oranje','#efa66c'],
 ['Lichtrood','#d6a0a0'],['Roze','#d8a6bb'],['Lila','#d4c7e5'],
 ['Lavendelblauw','#b9c7ec'],['Lichtblauw','#a4c9d4'],['Beige','#e7c7a5'],
 ['Bruin','#ba9776'],['Grijs','#c6c9c5']
];
let cropEditMode='add',cropEditId=null;
const cropPaletteSelect=$('cropEditPalette');
cropPalette.forEach(([name,hex])=>cropPaletteSelect.append(new Option(`${name} — ${hex}`,hex)));
cropPaletteSelect.append(new Option('Eigen kleurcode…','custom'));
function updateCropSwatch(){
 const color=$('cropEditHex').value.trim();
 $('cropEditSwatch').style.background=/^#[0-9a-fA-F]{6}$/.test(color)?color:'#fff';
}
cropPaletteSelect.onchange=()=>{
 if(cropPaletteSelect.value!=='custom')$('cropEditHex').value=cropPaletteSelect.value;
 updateCropSwatch();
};
$('cropEditHex').oninput=()=>{
 const val=$('cropEditHex').value.trim().toLowerCase();
 cropPaletteSelect.value=cropPalette.some(([,hex])=>hex===val)?val:'custom';
 updateCropSwatch();
};
function openCropEditor(mode){
 const id=Number($('manageCrop').value);
 if(mode==='change'&&(!id||!crops[id])){alert('Kies eerst een gewas.');return}
 cropEditMode=mode;cropEditId=mode==='change'?id:null;
 $('cropEditName').value=mode==='change'?crops[id][0]:'';
 const color=mode==='change'?crops[id][1]:'#a9c984';
 $('cropEditHex').value=color;
 cropPaletteSelect.value=cropPalette.some(([,hex])=>hex===color.toLowerCase())?color.toLowerCase():'custom';
 updateCropSwatch();
 $('cropEditForm').hidden=false;
 $('cropEditName').focus();
}
$('cropCreate').onclick=()=>openCropEditor('add');
$('cropChange').onclick=()=>openCropEditor('change');
$('cropEditCancel').onclick=()=>{$('cropEditForm').hidden=true};
$('cropEditSave').onclick=()=>{
 const name=$('cropEditName').value.trim();
 const color=$('cropEditHex').value.trim();
 if(!name){alert('Vul een naam in.');return}
 if(!/^#[0-9a-fA-F]{6}$/.test(color)){alert('Kies een kleur of vul een HEX-kleurcode in, bijvoorbeeld #a9c984.');return}
 if(crops.some((c,i)=>i!==cropEditId&&c[0].toLocaleLowerCase('nl')===name.toLocaleLowerCase('nl'))){alert('Dit gewas bestaat al.');return}
 if(cropEditMode==='add'){
   checkpoint();state.extraCropDefs??=[];state.extraCropDefs.push({name,color});crops.push([name,color]);
   managedCropSelection=String(crops.length-1);
 }else{
   const id=cropEditId,oldName=crops[id][0];
   checkpoint();crops[id]=[name,color];state.cropOverrides??={};state.cropOverrides[String(id)]={name,color};
   if(Array.isArray(state.extraCropDefs)){const def=state.extraCropDefs.find(x=>x.name===oldName);if(def){def.name=name;def.color=color}}
   managedCropSelection=String(id);
 }
 $('cropEditForm').hidden=true;save();fillCropMenus();paint();
 notify(cropEditMode==='add'?'✓ Gewas toegevoegd':'✓ Gewas gewijzigd');
};
$('cropRemove').onclick=()=>{
 const id=Number($('manageCrop').value);if(!id||!crops[id]){alert('Kies eerst een gewas.');return}
 const inCatalog=(state.catalog||[]).some(e=>Number(e.crop)===id);
 const inPlots=state.objects.some(o=>o.type==='bed'&&Object.values(o.sections||{}).some(rows=>rows.some(r=>(r.cols||[]).some(c=>Number(c.crop)===id||cellVarieties(c).some(v=>Number(v.crop)===id)))));
 if(inCatalog||inPlots){alert('Dit gewas wordt nog gebruikt bij aankopen of in een tuinvak. Verwijder eerst die koppelingen. Er is niets gewijzigd.');return}
 if(!confirm(`Gewas ${crops[id][0]} uit de keuzelijsten verwijderen?`))return;
 checkpoint();state.hiddenCropIds??=[];if(!state.hiddenCropIds.includes(id))state.hiddenCropIds.push(id);
 managedCropSelection='';save();fillCropMenus();paint();notify('✓ Gewas verwijderd uit de keuzelijsten');
};
$('exportWorkbookResults').onclick=()=>$('exportWorkbook').click();

// Versie 1.9.7: zichtbare bevestiging van aanrakingen op mobiele apparaten.
document.addEventListener('pointerdown',event=>{const b=event.target.closest('button');if(b&&!b.disabled)b.classList.add('touchPressed')},true);
for(const type of ['pointerup','pointercancel'])document.addEventListener(type,()=>document.querySelectorAll('button.touchPressed').forEach(b=>b.classList.remove('touchPressed')),true);
document.addEventListener('click',event=>{const b=event.target.closest('button');if(!b||b.disabled)return;b.classList.add('buttonAcknowledged');setTimeout(()=>b.classList.remove('buttonAcknowledged'),650)},true);

// Versie 1.9.9: formulier na opslaan sluiten en op verzoek weer openen.
$('openQuickEdit').onclick=()=>{$('quickEdit').hidden=false;$('openQuickEdit').hidden=true;$('quickEdit').scrollIntoView({behavior:'smooth',block:'nearest'})};

// Versie 2.0.0: onafhankelijke navigatie door lange tuinplattegrond.
const gardenScroller=$('mapOuter'),gardenSlider=$('gardenScrollPosition');
function syncGardenSlider(){const range=Math.max(0,gardenScroller.scrollHeight-gardenScroller.clientHeight);gardenSlider.value=range?Math.round(gardenScroller.scrollTop/range*100):0}
gardenScroller.addEventListener('scroll',syncGardenSlider,{passive:true});
gardenSlider.addEventListener('input',()=>{const range=Math.max(0,gardenScroller.scrollHeight-gardenScroller.clientHeight);gardenScroller.scrollTop=range*Number(gardenSlider.value)/100});
$('gardenScrollUp').onclick=()=>gardenScroller.scrollBy({top:-Math.max(150,gardenScroller.clientHeight*.7),behavior:'smooth'});
$('gardenScrollDown').onclick=()=>gardenScroller.scrollBy({top:Math.max(150,gardenScroller.clientHeight*.7),behavior:'smooth'});
const gardenHorizontal=$('gardenScrollHorizontal');
function ensureHorizontalRoom(){
 // De zoom bepaalt de werkelijke SVG-breedte. Geen minimum van 560px:
 // dat blokkeerde het verkleinen van de plattegrond.
 const map=$('map');
 map.style.minWidth='0';
}
function syncHorizontalSlider(){
 ensureHorizontalRoom();
 const range=Math.max(0,gardenScroller.scrollWidth-gardenScroller.clientWidth);
 gardenHorizontal.disabled=false;
 gardenHorizontal.value=range?Math.round(gardenScroller.scrollLeft/range*100):0;
}
gardenHorizontal.oninput=()=>{ensureHorizontalRoom();const range=Math.max(0,gardenScroller.scrollWidth-gardenScroller.clientWidth);gardenScroller.scrollLeft=range*Number(gardenHorizontal.value)/100};
$('gardenScrollLeft').onclick=()=>gardenScroller.scrollBy({left:-Math.max(100,gardenScroller.clientWidth*.65),behavior:'smooth'});
$('gardenScrollRight').onclick=()=>gardenScroller.scrollBy({left:Math.max(100,gardenScroller.clientWidth*.65),behavior:'smooth'});

gardenScroller.addEventListener('scroll',syncHorizontalSlider,{passive:true});
window.addEventListener('resize',syncHorizontalSlider);
if(typeof ResizeObserver!=='undefined')new ResizeObserver(syncHorizontalSlider).observe(gardenScroller);
requestAnimationFrame(syncHorizontalSlider);

// Versie 2.0.2: overzichtelijke, inklapbare onderdelen.
// Bestaande invoervelden en synchronisatiefuncties blijven intact.
for(const [buttonId,panelId,label] of [
 ['toggleMyGarden','myGardenContent','Mijn Tuin'],
 ['toggleCloudPanel','cloudPanelContent','Synchronisatie'],
 ['toggleMeters','meterContent','Ingedeelde meters']
]){
 const button=document.getElementById(buttonId),panel=document.getElementById(panelId);
 if(!button||!panel)continue;
 button.onclick=()=>{
   const opening=panel.hidden;
   panel.hidden=!opening;
   button.setAttribute('aria-expanded',String(opening));
   button.textContent=(opening?'▾ ':'▸ ')+label;
 };
}

// Herbereken de schermvullende zoom na draaien van het toestel.
window.addEventListener('resize',()=>applyZoom());
