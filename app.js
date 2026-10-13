const CFG = window.MINIMODA_CONFIG || {};
const API = (CFG.API_BASE || "").replace(/\/$/, "");
const money = n => `${Number(n || 0).toFixed(2)} ₼`;
const $ = id => document.getElementById(id);
let products = [], cart = [], adminToken = sessionStorage.getItem("minimoda_admin_token") || "";
let ordersCache = [];

function toast(msg) { const el=$("toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2600); }
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
async function api(path, options={}) {
  if (!API || API.includes("PUT-YOUR-WORKER")) throw new Error("Əvvəl public/config.js faylında API_BASE dəyərini təyin edin.");
  const headers = {"Content-Type":"application/json", ...(options.headers||{})};
  if (options.admin) headers["X-Admin-Token"] = adminToken;
  const res = await fetch(API + path, {...options, headers});
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || "Sorğu uğursuz oldu.");
  return data;
}
function imageMarkup(p) {
  if (p.image && /^https?:\/\//i.test(p.image)) return `<img loading="lazy" src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><div class="product-placeholder" style="display:none">m.</div>`;
  return `<div class="product-placeholder">m.</div>`;
}
function renderProducts() {
  const term=$("search").value.toLocaleLowerCase("az"), cat=$("category").value, sort=$("sort").value;
  let list=products.filter(p=>(!cat||p.category===cat)&&(`${p.name} ${p.description} ${p.category}`).toLocaleLowerCase("az").includes(term));
  if(sort==="price-up") list.sort((a,b)=>a.price-b.price);
  if(sort==="price-down") list.sort((a,b)=>b.price-a.price);
  $("product-count").textContent=`${list.length} məhsul`;
  if(!list.length){$("products").innerHTML='<div class="empty">Axtarışa uyğun məhsul tapılmadı.</div>';return;}
  $("products").innerHTML=list.map(p=>`<article class="product-card">
    <div class="product-image">${imageMarkup(p)}${p.old_price && p.old_price>p.price?'<span class="sale-tag">ENDİRİM</span>':''}</div>
    <div class="product-info"><div class="product-category">${escapeHtml(p.category)}</div><div class="product-name">${escapeHtml(p.name)}</div><div class="product-description">${escapeHtml(p.description||"Gündəlik stil üçün seçim")}</div>
    <div class="price-line"><b>${money(p.price)}</b>${p.old_price&&p.old_price>p.price?`<del>${money(p.old_price)}</del>`:""}</div>
    <button class="add-button" data-add="${p.id}">Səbətə əlavə et +</button></div></article>`).join("");
  document.querySelectorAll("[data-add]").forEach(b=>b.addEventListener("click",()=>chooseVariant(Number(b.dataset.add))));
}
function chooseVariant(id) {
  const p=products.find(x=>Number(x.id)===id); if(!p)return;
  const sizes=String(p.sizes||"").split(",").map(x=>x.trim()).filter(Boolean);
  const colors=String(p.colors||"").split(",").map(x=>x.trim()).filter(Boolean);
  const size=sizes.length?prompt("Ölçünü seç: "+sizes.join(", "),sizes[0]):"";
  if(sizes.length && (size===null||!sizes.includes(size.trim()))) return;
  const color=colors.length?prompt("Rəngi seç: "+colors.join(", "),colors[0]):"";
  if(colors.length && (color===null||!colors.includes(color.trim()))) return;
  if(Number(p.stock)<=0){toast("Bu məhsul hazırda stokda yoxdur.");return;}
  const key=`${id}|${size||""}|${color||""}`, found=cart.find(x=>x.key===key);
  if(found) found.quantity=Math.min(20,found.quantity+1); else cart.push({key,id:Number(id),name:p.name,price:Number(p.price),quantity:1,size:size||"",color:color||""});
  renderCart(); toast("Məhsul səbətə əlavə edildi.");
}
function renderCart() {
  $("cart-count").textContent=cart.reduce((s,x)=>s+x.quantity,0);
  $("cart-total").textContent=money(cart.reduce((s,x)=>s+x.price*x.quantity,0));
  $("cart-lines").innerHTML=cart.length?cart.map(x=>`<div class="cart-line"><div><b>${escapeHtml(x.name)}</b><small>${x.size?`Ölçü: ${escapeHtml(x.size)} · `:""}${x.color?`Rəng: ${escapeHtml(x.color)} · `:""}${money(x.price)}</small></div><div class="qty-control"><button data-minus="${x.key}">−</button><span>${x.quantity}</span><button data-plus="${x.key}">+</button><button data-remove="${x.key}" aria-label="Sil">×</button></div></div>`).join(""):'<div class="empty">Səbət hələ boşdur.</div>';
  document.querySelectorAll("[data-minus]").forEach(b=>b.onclick=()=>changeQty(b.dataset.minus,-1));
  document.querySelectorAll("[data-plus]").forEach(b=>b.onclick=()=>changeQty(b.dataset.plus,1));
  document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{cart=cart.filter(x=>x.key!==b.dataset.remove);renderCart();});
}
function changeQty(key,delta){const x=cart.find(i=>i.key===key);if(!x)return;x.quantity+=delta;if(x.quantity<1)cart=cart.filter(i=>i.key!==key);if(x.quantity>20)x.quantity=20;renderCart();}
function openModal(id){$(id).hidden=false;document.body.style.overflow="hidden";}
function closeModal(id){$(id).hidden=true;document.body.style.overflow="";}
async function loadProducts(){
  try{
    const data=await api("/api/products"); products=data.products||[];
    const cats=[...new Set(products.map(p=>p.category).filter(Boolean))].sort();
    $("category").innerHTML='<option value="">Bütün kateqoriyalar</option>'+cats.map(c=>`<option>${escapeHtml(c)}</option>`).join("");
    renderProducts();
  }catch(e){$("products").innerHTML=`<div class="empty">${escapeHtml(e.message)}<br><br>API quraşdırıldıqdan sonra məhsullar görünəcək.</div>`;$("product-count").textContent="API bağlantısı yoxdur";}
}
function whatsappUrl(orderId,total,customer,phone){
  const num=String(CFG.WHATSAPP_NUMBER||"").replace(/\D/g,"");
  const items=cart.map(x=>`• ${x.name} × ${x.quantity}${x.size?` (${x.size})`:""}${x.color?` / ${x.color}`:""} — ${money(x.price*x.quantity)}`).join("\n");
  const msg=`MiniModa life — yeni sifariş #${orderId}\nMüştəri: ${customer}\nTelefon: ${phone}\n${items}\nCəmi: ${money(total)}`;
  return num?`https://wa.me/${num}?text=${encodeURIComponent(msg)}`:`https://wa.me/?text=${encodeURIComponent(msg)}`;
}
$("checkout-form").addEventListener("submit",async e=>{
  e.preventDefault();if(!cart.length){toast("Səbət boşdur.");return;}
  const f=new FormData(e.currentTarget), body={customer_name:f.get("customer_name"),phone:f.get("phone"),delivery_method:f.get("delivery_method"),address:f.get("address"),note:f.get("note"),items:cart.map(x=>({id:x.id,quantity:x.quantity,size:x.size,color:x.color}))};
  const btn=e.currentTarget.querySelector("button[type=submit]");btn.disabled=true;btn.textContent="Göndərilir...";
  try{
    const result=await api("/api/orders",{method:"POST",body:JSON.stringify(body)});
    const url=whatsappUrl(result.order_id,result.total,body.customer_name,body.phone);
    $("checkout-result").innerHTML=`<div class="empty"><h3>Sifariş qəbul edildi!</h3><p>Sifariş nömrəsi: <b>#${result.order_id}</b></p><p>Cəmi: <b>${money(result.total)}</b></p><a class="primary-button full" href="${url}" target="_blank" rel="noopener">WhatsApp-da bildiriş göndər</a><p class="fineprint">WhatsApp düyməsi mağazaya mesaj pəncərəsi açır. Mesajı göndərmək üçün WhatsApp-da özün təsdiqləməlisən.</p></div>`;
    cart=[];renderCart();e.currentTarget.reset();$("address-label").hidden=false;
  }catch(err){toast(err.message);}
  finally{btn.disabled=false;btn.textContent="Sifarişi göndər";}
});
$("delivery-method").addEventListener("change",e=>{$("address-label").hidden=e.target.value==="pickup";$("address").required=e.target.value==="delivery";});
$("address").required=true;
$("cart-open").onclick=()=>{renderCart();$("checkout-result").innerHTML="";openModal("cart-modal");};
$("admin-open").onclick=()=>{openModal("admin-modal");$("admin-login").hidden=!!adminToken;$("admin-app").hidden=!adminToken;if(adminToken)loadAdmin();};
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
document.querySelectorAll(".overlay").forEach(o=>o.addEventListener("click",e=>{if(e.target===o)closeModal(o.id)}));
$("search").addEventListener("input",renderProducts);$("category").addEventListener("change",renderProducts);$("sort").addEventListener("change",renderProducts);
$("admin-login-button").onclick=async()=>{
  adminToken=$("admin-token").value.trim();if(!adminToken){toast("Tokeni daxil et.");return;}
  try{await api("/api/admin/orders",{admin:true});sessionStorage.setItem("minimoda_admin_token",adminToken);$("admin-login").hidden=true;$("admin-app").hidden=false;loadAdmin();toast("Admin panelinə daxil oldun.");}
  catch(e){adminToken="";toast("Token yanlışdır və ya API hazır deyil.");}
};
$("admin-logout").onclick=()=>{adminToken="";sessionStorage.removeItem("minimoda_admin_token");$("admin-login").hidden=false;$("admin-app").hidden=true;$("admin-token").value="";};
document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===b));document.querySelectorAll(".admin-pane").forEach(x=>x.hidden=x.id!==b.dataset.tab);});
$("product-form").onsubmit=async e=>{
  e.preventDefault();const f=new FormData(e.currentTarget);const body=Object.fromEntries(f.entries());body.price=Number(body.price);body.old_price=body.old_price?Number(body.old_price):null;body.stock=Number(body.stock);
  try{await api("/api/admin/products",{method:"POST",body:JSON.stringify(body),admin:true});toast("Məhsul əlavə edildi.");e.currentTarget.reset();e.currentTarget.elements.category.value="Geyim";e.currentTarget.elements.stock.value="1";await loadAdmin();await loadProducts();}
  catch(err){toast(err.message);}
};
async function loadAdmin(){
  try{
    const [pData,oData]=await Promise.all([api("/api/admin/products",{admin:true}),api("/api/admin/orders",{admin:true})]);
    $("admin-product-list").innerHTML=`<h3>Məhsullar (${pData.products.length})</h3>`+pData.products.slice(0,100).map(p=>`<div class="admin-product-row"><span><b>${escapeHtml(p.name)}</b><br><small>${money(p.price)} · Stok: ${p.stock} · ${escapeHtml(p.category)}</small></span><button data-delete-product="${p.id}">Sil</button></div>`).join("")+(pData.products.length>100?'<p class="fineprint">İlk 100 məhsul göstərilir.</p>':"");
    document.querySelectorAll("[data-delete-product]").forEach(b=>b.onclick=async()=>{if(!confirm("Bu məhsul silinsin?"))return;try{await api("/api/admin/products/"+b.dataset.deleteProduct,{method:"DELETE",admin:true});await loadAdmin();await loadProducts();toast("Məhsul silindi.");}catch(e){toast(e.message);}});
    ordersCache=oData.orders||[];
    $("admin-order-list").innerHTML=ordersCache.length?ordersCache.map(o=>`<div class="admin-order"><div class="admin-order-head"><span>Sifariş #${o.id}</span><span>${money(o.total)}</span></div><div>${escapeHtml(o.customer_name)} · ${escapeHtml(o.phone)}</div><div>${o.delivery_method==="pickup"?"Mağazadan götürmə":"Çatdırılma"} ${o.address?"· "+escapeHtml(o.address):""}</div><div class="admin-order-items">${(o.items||[]).map(i=>`${escapeHtml(i.name)} × ${i.quantity}${i.size?" / "+escapeHtml(i.size):""}${i.color?" / "+escapeHtml(i.color):""}`).join("<br>")}</div><small class="muted">${escapeHtml(o.created_at||"")}</small><label>Status<select data-order-status="${o.id}">${["Yeni","Təsdiqləndi","Hazırlanır","Yoldadır","Tamamlandı","Ləğv edildi"].map(s=>`<option ${s===o.status?"selected":""}>${s}</option>`).join("")}</select></label></div>`).join(""):'<div class="empty">Hələ sifariş yoxdur.</div>';
    document.querySelectorAll("[data-order-status]").forEach(s=>s.onchange=async()=>{try{await api("/api/admin/orders/"+s.dataset.orderStatus,{method:"PATCH",body:JSON.stringify({status:s.value}),admin:true});toast("Sifariş statusu dəyişdi.");}catch(e){toast(e.message);}});
  }catch(e){toast(e.message);}
}
$("year").textContent=new Date().getFullYear();
loadProducts();
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
