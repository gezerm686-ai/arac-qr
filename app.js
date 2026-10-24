// Kurulumdan sonra aşağıdaki iki değeri Supabase projenle doldur.
const SUPABASE_URL = "https://ytspqisvcbkvdxekkyhi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_f3vcSGan4HJGKUetlO5-sQ_5Vx19KBw";
const configured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("SUPABASE_PROJECT_URL") && !SUPABASE_ANON_KEY.includes("SUPABASE_ANON_PUBLIC_KEY");
const sb = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = id => document.getElementById(id);
let currentProfile = null;

function status(id, message, error=false){const el=$(id);el.textContent=message;el.classList.toggle("error",error)}
function show(id, yes){$(id).classList.toggle("hidden",!yes)}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function getPath(){return location.pathname}
function isAdminRoute(){return new URLSearchParams(location.search).get("admin")==="1" || location.hash==="#admin"}
function displayPublic(p){
 currentProfile=p;
 const on=p?.profile_visible===true;
 show("profileOff",!on);show("profileContent",on);
 if(!on)return;
 $("publicName").textContent=p.show_name && p.display_name ? p.display_name : "Araç sahibi";
 $("publicVehicle").textContent=p.show_vehicle && p.vehicle_info ? p.vehicle_info : "";
 const details=[];
 if(p.show_phone && p.phone)details.push(`<div class="detail"><span>Telefon</span><strong>${esc(p.phone)}</strong></div>`);
 if(p.show_plate && p.plate)details.push(`<div class="detail"><span>Plaka</span><strong>${esc(p.plate)}</strong></div>`);
 $("publicDetails").innerHTML=details.join("");
 const actions=[];
 if(p.show_phone && p.phone){const tel=p.phone.replace(/[^\d+]/g,"");actions.push(`<a class="action" href="tel:${esc(tel)}">☎ Ara</a>`)}
 if(p.show_whatsapp && p.whatsapp){const wa=p.whatsapp.replace(/\D/g,"");actions.push(`<a class="action" target="_blank" rel="noopener" href="https://wa.me/${esc(wa)}">WhatsApp'tan yaz</a>`)}
 $("publicActions").innerHTML=actions.join("");
 show("noteForm",p.show_notes===true);
}
async function loadPublic(){
 if(!sb){show("profileOff",true);show("profileContent",false);$("profileOff").innerHTML="<h1>Kurulum gerekiyor</h1><p>Site yöneticisi Supabase bağlantısını henüz tamamlamamış.</p>";return}
 const {data,error}=await sb.from("public_profile").select("id,profile_visible,display_name,show_name,vehicle_info,show_vehicle,phone,show_phone,whatsapp,show_whatsapp,plate,show_plate,show_notes").eq("id",1).maybeSingle();
 if(error){show("profileOff",true);show("profileContent",false);$("profileOff").innerHTML="<h1>Bilgiler yüklenemedi</h1><p>Yapılandırma veya veri tabanı ayarlarını kontrol edin.</p>";return}
 displayPublic(data || {profile_visible:false});
}
async function loadAdmin(){
 if(!sb){show("adminLogin",true);status("loginStatus","Önce README dosyasındaki Supabase kurulumunu tamamla.",true);return}
 const {data:{session}}=await sb.auth.getSession();
 show("adminLogin",!session);show("adminPanel",!!session);show("publicPage",false);
 if(session){await loadPrivateProfile();await loadNotes();renderQR()}
}
async function loadPrivateProfile(){
 const {data,error}=await sb.from("private_profile").select("*").eq("id",1).single();
 if(error){status("saveStatus","Profil kaydı okunamadı. SQL kurulumunu ve yönetici yetkisini kontrol et.",true);return}
 $("fName").value=data.display_name||"";$("fVehicle").value=data.vehicle_info||"";$("fPhone").value=data.phone||"";$("fWhatsapp").value=data.whatsapp||"";$("fPlate").value=data.plate||"";
 $("vProfile").checked=!!data.profile_visible;$("vName").checked=!!data.show_name;$("vVehicle").checked=!!data.show_vehicle;$("vPhone").checked=!!data.show_phone;$("vWhatsapp").checked=!!data.show_whatsapp;$("vPlate").checked=!!data.show_plate;$("vNotes").checked=!!data.show_notes;
}
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();if(!sb)return;status("loginStatus","Giriş yapılıyor…");const {error}=await sb.auth.signInWithPassword({email:$("loginEmail").value,password:$("loginPassword").value});if(error){status("loginStatus","Giriş başarısız: "+error.message,true);return}await loadAdmin()});
$("logoutBtn").addEventListener("click",async()=>{await sb.auth.signOut();location.href=location.pathname});
$("profileForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!sb)return;status("saveStatus","Kaydediliyor…");
 const p={id:1,display_name:$("fName").value.trim(),vehicle_info:$("fVehicle").value.trim(),phone:$("fPhone").value.trim(),whatsapp:$("fWhatsapp").value.trim(),plate:$("fPlate").value.trim(),profile_visible:$("vProfile").checked,show_name:$("vName").checked,show_vehicle:$("vVehicle").checked,show_phone:$("vPhone").checked,show_whatsapp:$("vWhatsapp").checked,show_plate:$("vPlate").checked,show_notes:$("vNotes").checked,updated_at:new Date().toISOString()};
 const {error}=await sb.from("private_profile").upsert(p);
 if(error){status("saveStatus","Kaydedilemedi: "+error.message,true);return}
 status("saveStatus","Kaydedildi. Ziyaretçi sayfası güncellendi.");await loadPublic();
});
async function loadNotes(){
 if(!sb)return;const box=$("notesList");box.innerHTML="<p class='muted'>Notlar yükleniyor…</p>";
 const {data,error}=await sb.from("visitor_notes").select("id,message,sender_name,sender_contact,created_at").order("created_at",{ascending:false}).limit(100);
 if(error){box.innerHTML="<p class='status error'>Notlar yüklenemedi. Veri tabanı politikalarını kontrol et.</p>";return}
 if(!data?.length){box.innerHTML="<p class='muted'>Henüz not yok.</p>";return}
 box.innerHTML=data.map(n=>`<article class="note-card"><div class="note-meta">${esc(new Date(n.created_at).toLocaleString("tr-TR"))} · ${esc(n.sender_name||"İsimsiz")}</div><p>${esc(n.message)}</p>${n.sender_contact?`<p><strong>İletişim:</strong> ${esc(n.sender_contact)}</p>`:""}<button class="secondary" data-delete="${esc(n.id)}">Notu sil</button></article>`).join("");
 box.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("Bu not kalıcı olarak silinsin mi?"))return;const {error}=await sb.from("visitor_notes").delete().eq("id",b.dataset.delete);if(error){alert("Silinemedi: "+error.message);return}await loadNotes()}));
}
$("refreshNotes").addEventListener("click",loadNotes);
$("noteForm").addEventListener("submit",async e=>{
 e.preventDefault();if(!sb)return;const button=$("noteForm").querySelector("button");button.disabled=true;status("noteStatus","Gönderiliyor…");
 const payload={message:$("noteText").value.trim(),sender_name:$("senderName").value.trim()||null,sender_contact:$("senderContact").value.trim()||null};
 const {error}=await sb.from("visitor_notes").insert(payload);
 button.disabled=false;if(error){status("noteStatus","Not gönderilemedi. Biraz sonra tekrar dene.",true);return}
 $("noteForm").reset();status("noteStatus","Notun iletildi. Teşekkürler.");
});
function renderQR(){
 const box=$("qrBox");box.innerHTML="";$("siteUrl").textContent=location.origin+location.pathname;
 if(!window.QRCode){box.textContent="QR kütüphanesi yüklenemedi.";return}
 new QRCode(box,{text:location.origin+location.pathname,width:220,height:220,colorDark:"#101820",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.H});
}
$("downloadQr").addEventListener("click",()=>{
 const canvas=$("qrBox").querySelector("canvas");const img=$("qrBox").querySelector("img");let url;
 if(canvas)url=canvas.toDataURL("image/png");else if(img)url=img.src;else return alert("Önce QR kodu oluşturulmalı.");
 const a=document.createElement("a");a.href=url;a.download="arac-qr-kodu.png";a.click();
});
(async()=>{
 if(!configured){if(isAdminRoute()){show("publicPage",false);show("adminLogin",true);status("loginStatus","Supabase bağlantısı yapılandırılmamış. README dosyasını izleyin.",true)}else await loadPublic();return}
 if(isAdminRoute())await loadAdmin();else await loadPublic();
})();