const $ = s => document.querySelector(s);
$("#year").textContent = new Date().getFullYear();
let config = {};
fetch("/api/config").then(r=>r.json()).then(c=>{
  config=c;
  if(c.supportEmail){$("#emailLink").href="mailto:"+c.supportEmail;$("#emailText").textContent=c.supportEmail;}
  if(c.whatsappNumber){$("#waLink").href="https://wa.me/"+c.whatsappNumber;}
  if(c.liveChatScriptUrl){const s=document.createElement("script");s.src=c.liveChatScriptUrl;s.async=true;document.body.appendChild(s);}
});
$("#trackForm").addEventListener("submit",async e=>{
  e.preventDefault(); const n=$("#trackingNumber").value.trim(); const box=$("#trackResult");
  box.textContent="Checking shipment records…";
  try{
    const r=await fetch("/api/track/"+encodeURIComponent(n)); const d=await r.json();
    if(!r.ok) throw new Error(d.error);
    box.innerHTML=`<div class="resultbox"><b>${escapeHtml(d.tracking_number)}</b><p>${escapeHtml(d.status)}</p><p>Recipient: ${escapeHtml(d.recipient)} · Destination: ${escapeHtml(d.destination)}</p><small>Last updated: ${new Date(d.updated_at).toLocaleString()}</small><hr>${d.events.map(ev=>`<div class="event"><b>${escapeHtml(ev.status)}</b><br>${escapeHtml(ev.location)}<br><small>${new Date(ev.timestamp).toLocaleString()} · ${escapeHtml(ev.note||"")}</small></div>`).join("")}</div>`;
  }catch(err){box.innerHTML=`<div class="resultbox">${escapeHtml(err.message)}</div>`;}
});
function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function submitEnquiry(form,kind){
  const data=Object.fromEntries(new FormData(form)); const msg=form.querySelector(".formmsg");
  if(msg) msg.textContent="Sending…";
  try{const r=await fetch("/api/enquiry",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...data,kind})});const d=await r.json();if(!r.ok)throw new Error(d.error);if(msg)msg.textContent=d.message;form.reset();}
  catch(e){if(msg)msg.textContent=e.message;}
}
$("#quoteForm").addEventListener("submit",e=>{e.preventDefault();submitEnquiry(e.currentTarget,"quote")});
$("#chatButton").addEventListener("click",()=>{if(window.Tawk_API&&window.Tawk_API.maximize)window.Tawk_API.maximize();else alert("Live chat will be available once your live-chat provider is connected. Please use email or WhatsApp in the meantime.");});
