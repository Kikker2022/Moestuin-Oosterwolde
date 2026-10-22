'use strict';
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
const cropNames=()=>crops.map((c,i)=>({id:i,name:c[0]})).filter(c=>c.id>0);
const cellVarieties=c=>Array.isArray(c.varieties)?c.varieties:[];
const varietyLabel=c=>{const v=cellVarieties(c);return v.length===1?v[0].name:v.length>1?v.length+' rassen':(crops[c.crop]?.[0]||'Leeg')};
function ensureLibrary(){if(!Array.isArray(state.customVarieties))state.customVarieties=[]}
function availableVarieties(crop){ensureLibrary();return [...new Set([...(knownVarieties[crop]||[]),...state.customVarieties.filter(v=>v.crop===crop).map(v=>v.name)])].sort((a,b)=>a.localeCompare(b,'nl'))}
function addCustomVariety(crop,name){ensureLibrary();name=String(name||'').trim();if(!name)return false;if(!state.customVarieties.some(v=>v.crop===crop&&v.name.toLowerCase()===name.toLowerCase()))state.customVarieties.push({crop,name});return true}
const $=id=>document.getElementById(id);
const clone=v=>JSON.parse(JSON.stringify(v));
// Basis: 30 m lang; links 0,5 m pad, A 5 m, B 5 m, rechts 0,5 m pad.
const initial=()=>({length:30,width:11,year:'2026',nextId:1,layout:'AB-30x5',objects:[]});
let state;try{state=JSON.parse(localStorage.getItem(KEY))||initial();if(!Array.isArray(state.objects)||!state.length||!state.width)throw Error()}catch{state=initial()}
let selected=null,selectedCell=null,history=[],drag=null;
const HISTORY_KEY=KEY+'-history-v15';
try {const stored=JSON.parse(localStorage.getItem(HISTORY_KEY));if(Array.isArray(stored))history=stored.filter(s=>s&&Array.isArray(s.objects)).slice(-40)}catch{}
function storeHistory(){try{localStorage.setItem(HISTORY_KEY,JSON.stringify(history))}catch{notify('Geschiedenis kon niet worden opgeslagen')}}
function updateUndo(){$('undo').disabled=!history.length}

let mapZoom=100;
function applyZoom(){const map=$('map');map.style.width=mapZoom+'%';$('mapZoom').value=mapZoom;$('zoomValue').textContent=mapZoom+'%'}
$('mapZoom').addEventListener('input',e=>{mapZoom=Number(e.target.value);applyZoom()});
$('zoomOut').onclick=()=>{mapZoom=Math.max(50,mapZoom-25);applyZoom()};
$('zoomReset').onclick=()=>{mapZoom=100;applyZoom();$('mapOuter').scrollTo(0,0)};
$('zoomIn').onclick=()=>{mapZoom=Math.min(400,mapZoom+25);applyZoom()};
const visible=o=>o.type==='path'||!o.year||o.year===state.year;
const activeObjects=()=>state.objects.filter(visible);
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));$('status').textContent='✓ Lokaal opgeslagen';if(window.gardenCloudChanged)window.gardenCloudChanged(clone(state))}catch{$('status').textContent='Opslag niet beschikbaar'}}
function checkpoint(){history.push(clone(state));if(history.length>40)history.shift();storeHistory();updateUndo()}
function notify(s){$('status').textContent=s;setTimeout(()=>{if($('status').textContent===s)$('status').textContent='✓ Opgeslagen'},2600)}
function dims(o){return o.rotation%180===0?{w:o.width,h:o.length}:{w:o.length,h:o.width}}
function fits(o,exclude=o.id){const d=dims(o);if(o.type==='bed' && !( (o.x>=.5-.00001 && o.x+d.w<=5.5+.00001) || (o.x>=5.5-.00001 && o.x+d.w<=10.5+.00001)))return false;if(o.type==='path' && ((o.x<.5 && o.x+d.w>.00001)||(o.x<11 && o.x+d.w>10.5)))return false;if(o.x<0||o.y<0||o.x+d.w>state.width+.00001||o.y+d.h>state.length+.00001)return false;return !state.objects.some(q=>{if(q.id===exclude || (o.type==='bed' && q.type==='bed' && o.year && q.year && o.year!==q.year))return false;const e=dims(q);return o.x<q.x+e.w-.001&&o.x+d.w>q.x+.001&&o.y<q.y+e.h-.001&&o.y+d.h>q.y+.001})}
function sections(o){
 if(!o.sections)o.sections={};
 if(!o.sections[state.year])o.sections[state.year]=[{crop:0,length:o.length}];
 const rows=o.sections[state.year];
 // Migratie: bestaande versie 1.2 gebruikt één gewas per lengtesegment.
 rows.forEach(r=>{if(!Array.isArray(r.cols))r.cols=[{crop:r.crop||0,width:o.width}];});
 return rows;
}
function areaRows(o){return sections(o).reduce((sum,r)=>sum+r.length*r.cols.reduce((s,c)=>s+c.width,0),0)}
function gardenSection(o){const d=dims(o),mid=o.x+d.w/2;return mid<5.5?'A':'B'}
function paint(){const svg=$('map');svg.replaceChildren();const NS='http://www.w3.org/2000/svg';const add=(tag,attrs,parent=svg)=>{const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));parent.appendChild(e);return e};const pad=1;svg.setAttribute('viewBox',`0 0 ${state.width+2*pad} ${state.length+2*pad}`);add('rect',{x:pad,y:pad,width:state.width,height:state.length,fill:'#ded5b9',stroke:'#75866d','stroke-width':'.08'});
if(state.layout==='AB-30x5'){
 for(const [x,w,fill,label] of [[0,.5,'#d1c5a9',''],[.5,5,'#c6dda9','A'],[5.5,5,'#d1e3b5','B'],[10.5,.5,'#d1c5a9','']]){
  add('rect',{x:pad+x,y:pad,width:w,height:state.length,fill,stroke:'#8ca17e','stroke-width':'.045'});
  if(label){const t=add('text',{x:pad+x+w/2,y:pad+state.length/2,'text-anchor':'middle','font-size':'.9','font-weight':'bold',fill:'#416542','pointer-events':'none'});t.textContent=label;}
 }
} for(let x=0;x<=state.width;x++){add('line',{x1:x+pad,y1:pad,x2:x+pad,y2:pad+state.length,stroke:'#ffffff','stroke-opacity':'.4','stroke-width':'.025'})}for(let y=0;y<=state.length;y++){add('line',{x1:pad,y1:y+pad,x2:pad+state.width,y2:y+pad,stroke:'#ffffff','stroke-opacity':'.4','stroke-width':'.025'})}
activeObjects().forEach(o=>{
 const g=add('g',{'data-id':o.id,transform:`translate(${pad+o.x} ${pad+o.y})`});
 const d=dims(o),active=selected===o.id;
 add('rect',{x:0,y:0,width:d.w,height:d.h,rx:.08,fill:o.type==='path'?'#eee8d8':'#a2c98a',stroke:active?'#20583c':'#8e957e','stroke-width':active?.028:.012},g);
 if(o.type==='path'){
  add('line',{x1:d.w/2,y1:.08,x2:d.w/2,y2:d.h-.08,stroke:'#b9b29f','stroke-width':'.045','stroke-dasharray':'.18 .16'},g);
 }else{
  let along=0;
  sections(o).forEach((row,i)=>{
   let across=0;
   row.cols.forEach((col,j)=>{
    const crop=crops[col.crop]||crops[0];
    const x=o.rotation%180===0?across:along;
    const y=o.rotation%180===0?along:across;
    const w=o.rotation%180===0?col.width:row.length;
    const h=o.rotation%180===0?row.length:col.width;
    add('rect',{x,y,width:w,height:h,fill:crop[1],stroke:selected===o.id&&selectedCell?.i===i&&selectedCell?.j===j?'#ff8b00':'#385b39','stroke-width':selected===o.id&&selectedCell?.i===i&&selectedCell?.j===j?'.045':'.012','data-row':i,'data-col':j},g);
    // Versie 1.6.1: toon de volledige groentenaam, passend binnen het vak.
    // Kleine vakjes houden hun kleur; de naam blijft via de editor beschikbaar.
    const name=varietyLabel(col);
    const fontSize=Math.min(.36,h*.48,(w*.88)/(Math.max(name.length,1)*.59));
    if(fontSize>=.105 && h>=.24 && w>=.3){
     const t=add('text',{x:x+w/2,y:y+h/2,'text-anchor':'middle','dominant-baseline':'middle','font-size':fontSize,'font-weight':'600',fill:'#193b28','pointer-events':'none'},g);
     t.textContent=name;
    }
    across+=col.width;
   });
   along+=row.length;
  });
  add('rect',{x:0,y:0,width:d.w,height:d.h,fill:'none',stroke:active?'#215a3e':'#68846a','stroke-width':active?.028:.012},g);
 }
 const t=add('text',{x:.1,y:.27,'font-size':'.19','font-weight':'400',fill:'#1f432b','pointer-events':'none'},g);
 t.textContent=o.type==='bed'?`${gardenSection(o)}-S${String(o.id).padStart(2,'0')}`:`P${String(o.id).padStart(2,'0')}`;
});
$('areaText').textContent=state.layout==='AB-30x5'?'Teeltgrond: 300 m² · buitenpaden: 30 m² · totaal: 330 m²':`Oppervlakte: ${(state.length*state.width).toLocaleString('nl-NL',{maximumFractionDigits:2})} m²`;renderEditor();renderTotals();renderLibrary()}
function renderTotals(){
 const sums=new Map();let used=0;
 activeObjects().filter(o=>o.type==='bed').forEach(o=>sections(o).forEach(r=>r.cols.forEach(c=>{
  const area=r.length*c.width;used+=area;
  if(c.crop)sums.set(c.crop,(sums.get(c.crop)||0)+area);
 })));
 $('cropTotals').textContent=`In ${state.year} ingedeeld: ${used.toLocaleString('nl-NL',{maximumFractionDigits:2})} m² · `+(sums.size?[...sums].map(([id,a])=>`${String(id).padStart(2,'0')} ${crops[id]?.[0]||'?'}: ${a.toLocaleString('nl-NL',{maximumFractionDigits:2})} m²`).join(' · '):'nog geen groenten toegewezen');
 const legend=$('cropLegend');legend.replaceChildren();crops.slice(1).forEach(([name,color],i)=>{const item=document.createElement('span');item.className='legendItem';const sw=document.createElement('i');sw.style.background=color;item.append(sw,document.createTextNode(`${String(i+1).padStart(2,'0')} ${name}`));legend.append(item)});
}
function renderEditor(){
 const o=state.objects.find(x=>x.id===selected && visible(x));
 $('editor').hidden=!o;$('editorEmpty').hidden=!!o;
 $('editTitle').textContent=o?(o.type==='bed'?`Tuingedeelte ${gardenSection(o)} · Strook S${String(o.id).padStart(2,'0')}`:`Looppad P${String(o.id).padStart(2,'0')}`):'Selecteer een strook of pad';
 if(!o)return;
 for(const [id,key] of [['objLength','length'],['objWidth','width'],['objX','x'],['objY','y']])$(id).value=o[key];
 $('split').hidden=o.type!=='bed';if($('splitWidth'))$('splitWidth').hidden=o.type!=='bed';$('sectionsWrap').hidden=o.type!=='bed';
 $('sections').replaceChildren();
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
   crops.forEach(([n],k)=>{const opt=document.createElement('option');opt.value=k;opt.textContent=n;select.append(opt)});
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
   row.append(a,b,info,splitW);if(j<r.cols.length-1){const mergeW=document.createElement('button');mergeW.className='secondary smallButton';mergeW.textContent='↔ Samenvoegen met volgend vak';mergeW.onclick=()=>mergeWidth(i,j);row.append(mergeW)}if(selectedCell?.i===i&&selectedCell?.j===j){row.classList.add('selectedCell')}group.append(row);group.append(renderVarietyEditor(c,i,j));
  });
  $('sections').append(group);
 });
}
function renderVarietyEditor(c,i,j){
 const wrap=document.createElement('div');wrap.className='varietyEditor';
 const heading=document.createElement('strong');heading.textContent=`Rassen in vak ${i+1}.${j+1}`;wrap.append(heading);
 const note=document.createElement('p');note.className='hint';note.textContent='Voeg één of meer rassen toe. Je kunt ze ook over aparte vakken verdelen.';wrap.append(note);
 if(!c.crop){const msg=document.createElement('p');msg.className='hint';msg.textContent='Kies eerst een gewas hierboven.';wrap.append(msg);return wrap}
 const pick=document.createElement('select');const first=document.createElement('option');first.value='';first.textContent='Kies een bestaand ras…';pick.append(first);
 availableVarieties(c.crop).forEach(name=>{const o=document.createElement('option');o.value=name;o.textContent=name;pick.append(o)});
 const add=document.createElement('button');add.className='secondary smallButton';add.textContent='+ Gekozen ras toevoegen';
 add.onclick=()=>{if(!pick.value){notify('Kies eerst een ras');return}addVariety(c,pick.value)};
 const custom=document.createElement('button');custom.className='secondary smallButton';custom.textContent='+ Zelf ras toevoegen';
 custom.onclick=()=>{const name=prompt('Naam van het nieuwe ras:');if(!name?.trim())return;checkpoint();addCustomVariety(c.crop,name);c.varieties??=[];c.varieties.push(newVariety(c.crop,name.trim()));save();paint()};
 const actions=document.createElement('div');actions.className='toolbar';actions.append(pick,add,custom);wrap.append(actions);
 cellVarieties(c).forEach((v,k)=>{
  const item=document.createElement('div');item.className='varietyCard';
  const top=document.createElement('div');top.className='line';const name=document.createElement('strong');name.textContent=v.name;
  const del=document.createElement('button');del.className='danger smallButton';del.textContent='Verwijder ras';del.onclick=()=>{if(!confirm('Dit ras uit dit vak verwijderen?'))return;checkpoint();c.varieties.splice(k,1);save();paint()};top.append(name,del);item.append(top);
  const fields=document.createElement('div');fields.className='varietyFields';
  const specs=[['shop','Gekocht bij','text'],['price','Prijs (€)','number'],['amount','Hoeveelheid / verpakking','text'],['planting','Zaai- of pootdatum','date'],['harvest','Oogstdatum','date'],['rating','Beoordeling (1–5)','select'],['notes','Oogstresultaat / opmerkingen','text']];
  specs.forEach(([key,label,type])=>{const lab=document.createElement('label');lab.textContent=label;let inp;
   if(type==='select'){inp=document.createElement('select');[['','Nog niet beoordeeld'],['1','1 ster'],['2','2 sterren'],['3','3 sterren'],['4','4 sterren'],['5','5 sterren']].forEach(([value,title])=>{const o=document.createElement('option');o.value=value;o.textContent=title;inp.append(o)})}
   else {inp=document.createElement('input');inp.type=type;if(type==='number'){inp.min='0';inp.step='.01'}}
   inp.value=v[key]??'';inp.onchange=()=>{checkpoint();v[key]=inp.value;save();renderLibrary()};lab.append(inp);fields.append(lab)
  });
  const repeat=document.createElement('label');repeat.className='varietyRepeat';const check=document.createElement('input');check.type='checkbox';check.checked=!!v.repeat;check.onchange=()=>{checkpoint();v.repeat=check.checked;save();renderLibrary()};repeat.append(check,document.createTextNode(' Volgend jaar opnieuw kopen / telen'));fields.append(repeat);item.append(fields);wrap.append(item)
 });
 return wrap;
}
function newVariety(crop,name){return {crop,name,shop:'',price:'',amount:'',planting:'',harvest:'',rating:'',repeat:false,notes:''}}
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
 r.cols.splice(j+1,0,{crop:0,width:half,varieties:[]});save();paint();
}
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
function updateObj(patch){const o=state.objects.find(x=>x.id===selected);if(!o)return;const test={...o,...patch};if(test.length<.2||test.width<.2||!fits(test)){notify('Past niet binnen de tuin of overlapt een ander object');paint();return}checkpoint();Object.assign(o,patch);if(o.type==='bed'){Object.values(o.sections||{}).forEach(arr=>{if('length'in patch){const sum=arr.reduce((a,s)=>a+s.length,0);if(sum>0)arr.forEach(s=>s.length*=o.length/sum)}if('width'in patch){arr.forEach(r=>{if(!r.cols)r.cols=[{crop:r.crop||0,width:o.width}];const sum=r.cols.reduce((a,c)=>a+c.width,0);if(sum>0)r.cols.forEach(c=>c.width*=o.width/sum)})}})}save();paint()}
function addObj(type){const obj={id:state.nextId,type,year:type==='bed'?state.year:null,x:.3,y:.3,length:type==='bed'?Math.min(5,state.length):Math.min(4,state.length),width:type==='bed'?Math.min(1.2,state.width):Math.min(.6,state.width),rotation:0};if(type==='bed')obj.sections={2026:[{crop:0,length:obj.length}],2027:[{crop:0,length:obj.length}]};let found=false;for(let y=0;y<=state.length;y+=.25){for(let x=0;x<=state.width;x+=.25){obj.x=+x.toFixed(2);obj.y=+y.toFixed(2);if(fits(obj,null)){found=true;break}}if(found)break}if(!found){notify('Geen vrije ruimte: verklein of verplaats eerst een object');return}checkpoint();state.nextId++;state.objects.push(obj);selected=obj.id;save();paint();$('editPanel').scrollIntoView({behavior:'smooth',block:'nearest'})}
$('addBed').onclick=()=>addObj('bed');$('addPath').onclick=()=>addObj('path');$('rotate').onclick=()=>{const o=state.objects.find(x=>x.id===selected);if(!o)return;updateObj({rotation:(o.rotation+90)%180})};// De betekenis van lengte/dwars volgt de langste fysieke zijde, niet de interne veldnaam.
function splitByDirection(along){const o=state.objects.find(x=>x.id===selected);if(!o||o.type!=='bed')return;const longIsWidth=o.width>o.length;if(along){if(longIsWidth)splitLength(0);else splitWidth(0,0)}else{if(longIsWidth)splitWidth(0,0);else splitLength(0)}}
$('split').onclick=()=>splitByDirection(false);if($('splitWidth'))$('splitWidth').onclick=()=>splitByDirection(true);$('delete').onclick=()=>{const i=state.objects.findIndex(x=>x.id===selected);if(i<0)return;if(!confirm('Dit object verwijderen?'))return;checkpoint();state.objects.splice(i,1);selected=null;selectedCell=null;save();paint()};$('undo').onclick=()=>{if(!history.length)return;state=history.pop();storeHistory();selected=null;selectedCell=null;save();syncInputs();paint();updateUndo()};
for(const [id,key] of [['objLength','length'],['objWidth','width'],['objX','x'],['objY','y']])$(id).addEventListener('change',()=>{const v=Number($(id).value);if(!Number.isFinite(v)){paint();return}updateObj({[key]:v})});
function resizeGarden(){const length=Number($('gardenLength').value),width=Number($('gardenWidth').value);if(!Number.isFinite(length)||!Number.isFinite(width)||length<1||width<1||length>200||width>200){notify('Gebruik afmetingen van 1 tot 200 meter');syncInputs();return}const old=clone(state);state.length=length;state.width=width;if(state.objects.some(o=>!fits(o))){state=old;notify('Stroken of paden vallen buiten de nieuwe tuingrens');syncInputs();return}checkpoint();history[history.length-1]=old;save();paint()}
function syncInputs(){$('gardenLength').value=state.length;$('gardenWidth').value=state.width;$('year').value=state.year}
$('gardenLength').onchange=resizeGarden;$('gardenWidth').onchange=resizeGarden;$('year').onchange=()=>{state.year=$('year').value;selected=null;selectedCell=null;save();paint()};
const svg=$('map');function point(evt){const p=svg.createSVGPoint();p.x=evt.clientX;p.y=evt.clientY;const matrix=svg.getScreenCTM();if(!matrix)return null;const q=p.matrixTransform(matrix.inverse());return{x:q.x-1,y:q.y-1}}
svg.addEventListener('pointerdown',e=>{const g=e.target.closest('[data-id]');if(!g){selected=null;selectedCell=null;paint();return}const id=Number(g.getAttribute('data-id'));selected=id;const targetCell=e.target.closest('[data-row][data-col]');selectedCell=targetCell?{i:Number(targetCell.getAttribute('data-row')),j:Number(targetCell.getAttribute('data-col'))}:null;const o=state.objects.find(x=>x.id===id);const p=point(e);if(!o||!p)return;drag={id,start:p,x:o.x,y:o.y,original:clone(state),moved:false};svg.setPointerCapture(e.pointerId);paint()});svg.addEventListener('pointermove',e=>{if(!drag)return;const p=point(e);const o=state.objects.find(x=>x.id===drag.id);if(!p||!o)return;const dx=p.x-drag.start.x,dy=p.y-drag.start.y;if(Math.abs(dx)+Math.abs(dy)>.08)drag.moved=true;const nx=Math.round((drag.x+dx)*10)/10,ny=Math.round((drag.y+dy)*10)/10;const test={...o,x:nx,y:ny};if(fits(test)){o.x=nx;o.y=ny;paint()}});function endDrag(){if(!drag)return;if(drag.moved && (state.objects.find(o=>o.id===drag.id)?.x!==drag.x || state.objects.find(o=>o.id===drag.id)?.y!==drag.y)){history.push(drag.original);if(history.length>40)history.shift();storeHistory();updateUndo();save()}drag=null}svg.addEventListener('pointerup',endDrag);svg.addEventListener('pointercancel',endDrag);
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='mijn-slimme-moestuin-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('import').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const incoming=JSON.parse(await f.text());if(!incoming||!Array.isArray(incoming.objects)||!Number.isFinite(incoming.length)||!Number.isFinite(incoming.width)||incoming.length<1||incoming.width<1||!['2026','2027'].includes(incoming.year)||!Number.isInteger(incoming.nextId))throw Error('Ongeldig bestand');if(!confirm('Huidige tuin vervangen door deze back-up?'))return;checkpoint();state=incoming;selected=null;selectedCell=null;save();syncInputs();paint()}catch{alert('Dit is geen geldige back-up van Mijn Slimme Moestuin.')}finally{e.target.value=''}};
$('reset').onclick=()=>{if(!confirm('Het huidige tuinplan vervangen door de basisindeling A en B (30 × 5 m per strook)? Maak eerst een back-up als je iets wilt bewaren.'))return;checkpoint();state=initial();selected=null;selectedCell=null;save();syncInputs();paint()};
syncInputs();paint();applyZoom();updateUndo();

// Veilige toegang voor Firebase: externe synchronisatie kan alleen via deze twee functies.
window.gardenGetState=()=>clone(state);
window.gardenReceiveCloud=function(incoming){
 if(!incoming||!Array.isArray(incoming.objects)||!Number.isFinite(incoming.length)||!Number.isFinite(incoming.width)||!['2026','2027'].includes(incoming.year)||!Number.isInteger(incoming.nextId))throw Error('Ongeldig online tuinplan');
 checkpoint();state=clone(incoming);selected=null;selectedCell=null;
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
       if(same(rec.plan,window.gardenGetState())){lastRemote=rec.plan;listen();return}
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
