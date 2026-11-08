const $=s=>document.querySelector(s);
async function api(url,body){const r=await fetch(url,{method:body?"POST":"GET",headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok)throw new Error(d.error||"Request failed");return d;}
$("#login").addEventListener("submit",async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));try{await api("/api/admin/login",d);$("#loginPanel").hidden=true;$("#dashboard").hidden=false;load();}catch(x){$("#loginMsg").textContent=x.message;}});
async function load(){try{$("#shipments").textContent=JSON.stringify(await api("/api/admin/shipments"),null,2);}catch(e){$("#shipments").textContent=e.message;}}
$("#create").addEventListener("submit",async e=>{e.preventDefault();try{const d=await api("/api/admin/shipments",Object.fromEntries(new FormData(e.currentTarget)));$("#createMsg").textContent=d.message;e.currentTarget.reset();load();}catch(x){$("#createMsg").textContent=x.message;}});
$("#event").addEventListener("submit",async e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));try{const r=await api("/api/admin/shipments/"+encodeURIComponent(d.trackingNumber)+"/events",d);$("#eventMsg").textContent=r.message;e.currentTarget.reset();load();}catch(x){$("#eventMsg").textContent=x.message;}});
$("#refresh").addEventListener("click",load);
$("#logout").addEventListener("click",async()=>{try{await api("/api/admin/logout",{});}finally{location.reload();}});
