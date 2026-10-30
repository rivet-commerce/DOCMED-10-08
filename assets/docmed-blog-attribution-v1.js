/* DocMed blog-to-order evidence v1 (consent-gated; no remote transmission) */
(function () {
  "use strict";
  function allowed() {
    try { return Boolean(window.Shopify && Shopify.customerPrivacy && Shopify.customerPrivacy.analyticsProcessingAllowed()); }
    catch (e) { return false; }
  }
  var qp = new URLSearchParams(location.search);
  var blog = qp.get("dm_blog");
  var click = qp.get("dm_click");
  var product = qp.get("dm_product");
  function stamp(form) {
    if (!allowed() || !blog || !click || !product || !location.pathname.startsWith("/products/")) return;
    if (location.pathname.split("/products/")[1].split("/")[0] !== product) return;
    if (!form || !form.action || !/\/cart\/add(?:\.js)?(?:\?|$)/.test(form.action)) return;
    [["properties[_docmed_blog]",blog],["properties[_docmed_blog_click]",click],["properties[_docmed_blog_product]",product]].forEach(function(pair) {
      var field=Array.from(form.querySelectorAll("input")).find(function(n){return n.name===pair[0];});
      if (!field) {field=document.createElement("input");field.type="hidden";field.name=pair[0];form.appendChild(field);}
      field.value=pair[1];
    });
  }
  function allForms(){Array.from(document.querySelectorAll("form[action*='/cart/add']")).forEach(stamp);}
  document.addEventListener("click",function(e){
    if (!allowed()) return;
    var a=e.target.closest && e.target.closest("a[href]");
    if (!a || !location.pathname.includes("/blogs/")) return;
    var dest;
    try {dest=new URL(a.href,location.origin);} catch (_){return;}
    if (dest.origin!==location.origin || !dest.pathname.startsWith("/products/")) return;
    dest.searchParams.set("dm_blog",location.pathname.split("/").filter(Boolean).pop());
    dest.searchParams.set("dm_product",dest.pathname.split("/products/")[1].split("/")[0]);
    dest.searchParams.set("dm_click",window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+"-"+Math.random().toString(36).slice(2));
    a.href=dest.toString();
  },true);
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",allForms); else allForms();
  new MutationObserver(allForms).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener("submit",function(e){stamp(e.target);},true);
})();