(function () {
  "use strict";

  const PREFIX="la-muni-rag:procedure-case:";
  const MAX_CASES=200;
  const MAX_STEPS=100;
  const MAX_DOCUMENTS=200;
  const MAX_AUDIT_EVENTS=300;
  const asArray=(value)=>Array.isArray(value)?value:[];

  const validate=(value)=>{
    if(!value||value.schemaVersion!==1||!value.workflowSnapshot) return null;
    if(!Array.isArray(value.steps)||value.steps.length>MAX_STEPS) return null;
    if(!Array.isArray(value.auditLog)||value.auditLog.length>MAX_AUDIT_EVENTS) return null;
    for(const step of value.steps){
      if(!Array.isArray(step?.documents)||step.documents.length>MAX_DOCUMENTS) return null;
    }
    return value;
  };

  const load=()=>{
    const records=[];
    for(let index=0;index<localStorage.length&&records.length<MAX_CASES;index+=1){
      const key=localStorage.key(index);
      if(!key||!key.startsWith(PREFIX)) continue;
      try{
        const value=validate(JSON.parse(localStorage.getItem(key)||"null"));
        if(value) records.push({key,value});
      }catch{}
    }
    return records;
  };

  const summarize=({key,value})=>{
    const steps=asArray(value.steps);
    const documents=steps.flatMap((step)=>asArray(step.documents));
    const total=steps.length;
    const completed=steps.filter((step)=>step.status==="completed").length;
    const audit=asArray(value.auditLog);
    return {
      key,
      value,
      title:value.workflowSnapshot.title||"Caso sin título",
      type:value.workflowSnapshot.procedureType||"unknown",
      query:value.workflowSnapshot.query||"",
      updatedAt:value.updatedAt||value.createdAt||"",
      total,
      completed,
      blocked:steps.filter((step)=>step.status==="blocked").length,
      ready:steps.filter((step)=>step.status==="ready_for_review").length,
      missing:documents.filter((document)=>document.state==="missing").length,
      requested:documents.filter((document)=>document.state==="requested").length,
      received:documents.filter((document)=>document.state==="received").length,
      reviewed:documents.filter((document)=>document.state==="reviewed").length,
      lastActivity:audit.at(-1)?.at||value.updatedAt||value.createdAt||"",
      progressPct:total?Math.round((completed/total)*100):0,
      assignees:[...new Set(steps.map((step)=>step.operationalAssignee).filter(Boolean))],
    };
  };

  const exportSnapshot=(cases)=>({
    portfolioSchemaVersion:1,
    exportedAt:new Date().toISOString(),
    caseCount:cases.length,
    cases:cases.map(({key,value})=>({key,workspace:value})),
  });

  window.ProcedureCasePortfolio=Object.freeze({PREFIX,load,summarize,exportSnapshot});
})();
