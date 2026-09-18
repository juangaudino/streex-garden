(function(){
  const COPY={
    es:{timeline:"Grow Timeline",timelineNote:"Ventanas orientativas desde la siembra. Garden usa rangos, nunca fechas exactas falsas.",start:"Siembra",germ:"Germinación esperada",bloom:"Floración esperada",harvest:"Cosecha esperada",observe:"Observar y decidir",noWindow:"Sin ventana temporal suficientemente respaldada todavía.",quality:"Evidence Health",qualityNote:"Mapa de calidad del conocimiento de esta ficha. Mide respaldo y huecos; no mide la salud de la planta.",backed:"Respaldado",adapted:"Adaptación Garden",pending:"Por validar",sourceCoverage:"Cobertura de fuentes",strong:"Base sólida",mixed:"Base mixta",building:"En construcción",missing:"Huecos prioritarios",overview:"Knowledge Quality Map",overviewNote:"Estado determinístico de la evidencia de la Library actual.",guides:"fichas",sections:"secciones"},
    en:{timeline:"Grow Timeline",timelineNote:"Guidance windows from sowing. Garden uses ranges, never fake exact dates.",start:"Sowing",germ:"Expected germination",bloom:"Expected flowering",harvest:"Expected harvest",observe:"Observe and decide",noWindow:"No sufficiently supported timing window yet.",quality:"Evidence Health",qualityNote:"Knowledge-quality map for this guide. It measures evidence and gaps, not plant health.",backed:"Source-backed",adapted:"Garden adaptation",pending:"Needs validation",sourceCoverage:"Source coverage",strong:"Strong base",mixed:"Mixed base",building:"Building",missing:"Priority gaps",overview:"Knowledge Quality Map",overviewNote:"Deterministic evidence status across the current Library.",guides:"guides",sections:"sections"}
  };
  const dayRange=(value)=>{
    const s=String(value||"").toLowerCase().replace(/[–—]/g,"-");
    let m=s.match(/(\d+)\s*-\s*(\d+)\s*days?/); if(m)return [Number(m[1]),Number(m[2])];
    m=s.match(/~?\s*(\d+)\s*days?/); if(m){const n=Number(m[1]);return [Math.max(1,n-2),n+2];}
    return null;
  };
  const metricWindow=(plant,kind)=>{
    const keys=kind==="germ"?["germination","emergence"]:kind==="bloom"?["bloom","flower"]:["harvest","maturity"];
    for(const m of plant.metrics||[]){const label=String(m.label||"").toLowerCase();if(keys.some(k=>label.includes(k))){const r=dayRange(m.value);if(r)return {range:r,metric:m};}}
    return null;
  };
  const sectionEvidence=(plant,key)=>plant.sections?.[key]?.evidenceType||"needs_validation";
  const timeline=(plant,lang)=>{
    const t=COPY[lang]||COPY.es, items=[];
    const germ=metricWindow(plant,"germ"), bloom=metricWindow(plant,"bloom"), harvest=metricWindow(plant,"harvest");
    items.push({label:t.start,range:"Day 0",evidence:"fact"});
    if(germ)items.push({label:t.germ,range:`Day ${germ.range[0]}–${germ.range[1]}`,evidence:sectionEvidence(plant,"germination")});
    if(bloom)items.push({label:t.bloom,range:`Day ${bloom.range[0]}–${bloom.range[1]}`,evidence:sectionEvidence(plant,"flowering")});
    if(harvest)items.push({label:t.harvest,range:`Day ${harvest.range[0]}–${harvest.range[1]}`,evidence:sectionEvidence(plant,"harvest")});
    const real=items.length>1;
    return `<section class="grow-timeline"><div class="lab-panel-heading"><div><p class="eyebrow">CALENDAR · V0.1</p><h3>${t.timeline}</h3></div><p>${t.timelineNote}</p></div>${real?`<div class="timeline-track">${items.map((x,i)=>`<div class="timeline-step"><span class="timeline-dot"></span><div><strong>${x.label}</strong><span>${x.range}</span>${x.evidence!=="fact"?`<small class="quality-chip ${x.evidence}">${x.evidence==="source_backed"?t.backed:x.evidence==="garden_adaptation"?t.adapted:t.pending}</small>`:""}</div></div>`).join("")}</div><p class="timeline-foot">${t.observe}: ${plant.sections?.harvest?.short||plant.sections?.flowering?.short||plant.sections?.pruning?.short||""}</p>`:`<p class="quality-empty">${t.noWindow}</p>`}</section>`;
  };
  const stats=(plant)=>{
    const sections=Object.values(plant.sections||{}), total=sections.length;
    const backed=sections.filter(s=>s.evidenceType==="source_backed").length;
    const adapted=sections.filter(s=>s.evidenceType==="garden_adaptation").length;
    const pending=sections.filter(s=>s.evidenceType==="needs_validation"||s.confidence==="pending").length;
    const sourced=sections.filter(s=>(s.sourceIds||[]).length>0).length;
    return {total,backed,adapted,pending,sourced,coverage:total?Math.round(sourced/total*100):0};
  };
  const health=(plant,lang)=>{
    const t=COPY[lang]||COPY.es,s=stats(plant);
    const level=s.pending===0&&s.coverage>=85?t.strong:s.pending<=2&&s.coverage>=60?t.mixed:t.building;
    const gaps=Object.entries(plant.sections||{}).filter(([,v])=>v.evidenceType==="needs_validation"||v.confidence==="pending"||!(v.sourceIds||[]).length).map(([k])=>k);
    return `<section class="evidence-health"><div class="lab-panel-heading"><div><p class="eyebrow">KNOWLEDGE · V0.1</p><h3>${t.quality}</h3></div><span class="quality-level">${level}</span></div><p class="quality-note">${t.qualityNote}</p><div class="quality-metrics"><div><strong>${s.backed}</strong><span>${t.backed}</span></div><div><strong>${s.adapted}</strong><span>${t.adapted}</span></div><div><strong>${s.pending}</strong><span>${t.pending}</span></div><div><strong>${s.coverage}%</strong><span>${t.sourceCoverage}</span></div></div>${gaps.length?`<div class="quality-gaps"><strong>${t.missing}</strong><span>${gaps.join(" · ")}</span></div>`:""}</section>`;
  };
  const overview=(plants,lang)=>{
    const t=COPY[lang]||COPY.es, all=plants.map(stats), sections=all.reduce((n,s)=>n+s.total,0),backed=all.reduce((n,s)=>n+s.backed,0),adapted=all.reduce((n,s)=>n+s.adapted,0),pending=all.reduce((n,s)=>n+s.pending,0),sourced=all.reduce((n,s)=>n+s.sourced,0),coverage=sections?Math.round(sourced/sections*100):0;
    return `<div class="quality-overview-copy"><div><p class="eyebrow">EVIDENCE HEALTH · V0.1</p><h3>${t.overview}</h3><p>${t.overviewNote}</p></div><div class="quality-overview-stats"><span><strong>${plants.length}</strong> ${t.guides}</span><span><strong>${backed}</strong> ${t.backed}</span><span><strong>${adapted}</strong> ${t.adapted}</span><span><strong>${pending}</strong> ${t.pending}</span><span><strong>${coverage}%</strong> ${t.sourceCoverage}</span></div></div>`;
  };
  window.GARDEN_KNOWLEDGE={timeline,health,overview,stats};
})();