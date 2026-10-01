(function () {
  'use strict';
  const api=window.appleExperience;
  const submit=document.getElementById('submit-response');
  const status=document.getElementById('survey-status');
  const results=document.getElementById('survey-results');
  const canvas=document.getElementById('apple');
  const chart=document.getElementById('results-chart');
  const identityKey='awf-anonymous-response-id';
  const endpoint=window.location?.hostname==='ornish.org'?'https://aphantasia-minds-eye.andreinbali.chatgpt.site/api/responses':'/api/responses';
  let identity=null,saving=false,savedValue=null;
  api.subscribe(()=>{submit.disabled=!api.ready||saving;});
  api.onSelection(()=>{
    results.hidden=true;canvas.hidden=false;api.setResultsVisible(false);
    submit.textContent=savedValue===null?'Submit':'Update response';
    if(!saving)status.textContent='';
  });
  function browserIdentity() {
    // This browser-only key is a deduplication token, never the tally itself.
    // Refuse to send if persistence is unavailable, avoiding accidental duplicates.
    if(identity)return identity;
    let id=localStorage.getItem(identityKey);
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id||''))id=crypto.randomUUID();
    localStorage.setItem(identityKey,id);
    if(localStorage.getItem(identityKey)!==id)throw new Error('storage');
    identity=id;return id;
  }
  function showResults(data,value) {
    if(!Number.isInteger(data.total)||data.total<1||!Array.isArray(data.bins)||data.bins.length!==10||data.bins.some(n=>!Number.isInteger(n)||n<0)||data.bins.reduce((sum,n)=>sum+n,0)!==data.total)throw new Error('response');
    const max=Math.max(...data.bins,1);
    chart.replaceChildren();
    data.bins.forEach((count,index)=>{
      const bar=document.createElement('span');bar.className='result-bin';bar.style.height=`${count/max*100}%`;bar.setAttribute('aria-hidden','true');
      bar.title=`${index*10}–${(index+1)*10}%: ${count}`;chart.appendChild(bar);
    });
    const marker=document.createElement('span');marker.className='result-marker';marker.style.left=`${value/10}%`;marker.setAttribute('aria-hidden','true');chart.appendChild(marker);
    chart.setAttribute('aria-label',`Responses from nothing to vivid, in ten equal intervals: ${data.bins.join(', ')}. Your response: ${value/10} percent.`);
    document.getElementById('results-total').textContent=`${data.total.toLocaleString()} ${data.total===1?'response':'responses'}`;
    document.getElementById('result-value').textContent=value===0?'Nothing':value===1000?'Vivid':`${value/10}%`;
    canvas.hidden=true;results.hidden=false;api.setResultsVisible(true);
  }
  submit.addEventListener('click',async()=>{
    if(saving||!api.ready)return;
    let id;
    try{id=browserIdentity();}catch{status.textContent='Allow browser storage to submit one anonymous response. Your selection is still here.';return;}
    const value=api.value;
    saving=true;submit.disabled=true;submit.textContent='Submitting…';status.textContent='Saving your response.';
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await fetch(endpoint,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,value}),signal:controller.signal});
      if(!response.ok)throw new Error('request');
      const data=await response.json();
      savedValue=value;
      // A user may keep dragging during the request: never conceal a newer choice.
      if(api.value===value)showResults(data,value);
      status.textContent=api.value===value?'Response saved. Move the slider to change it.':'Response saved. Submit again to save your new position.';
    } catch {status.textContent='Could not save your response. Your selection is still here. Please try again.';}
    finally{clearTimeout(timeout);saving=false;submit.disabled=!api.ready;submit.textContent=savedValue===null?'Submit':'Update response';}
  });
})();
