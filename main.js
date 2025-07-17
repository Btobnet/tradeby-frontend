/*************************
 *  scripts/main.js
 *************************/

/* ---------- 0. Fallback search URLs ------------------- */
const STORE_SEARCH_URL = {
  Tesco:      "https://www.tesco.com/groceries/en-GB/search?query=",
  Asda:       "https://groceries.asda.com/search/",
  Amazon:     "https://www.amazon.co.uk/s?k=",
  Sainsburys: "https://www.sainsburys.co.uk/gol-ui/SearchResults/",
  Iceland:    "https://www.iceland.co.uk/search?q=",

  /* New stores */
  Next:       "https://www.next.co.uk/search?w=",
  McDonalds:  "https://www.mcdonalds.com/gb/en-gb/search?q="
};

/* ---------- Map common variants → canonical key -------- */
const SHOP_ALIAS = {
  McDonalds: "McDonalds",   // covers “McDonalds”
  Mcdonalds: "McDonalds",   // covers “Mcdonalds” (lower‑case d)
  Mcdonald:  "McDonalds",   // covers “Mcdonald”
  "MCDONALDS":"McDonalds",  // just in case all‑caps appear

  Next:      "Next",        // covers plain “Next”
  Nextplc:   "Next",        // covers “NextPlc” / “Next PLC”
  Nextjpg:   "Next"         // covers “Next jpg”
};

/* Return first word, stripped of punctuation, mapped via alias table */
function canonicalShop(name){
  const first = name.split(" ")[0].replace(/[^A-Za-z0-9]/g, "");
  return SHOP_ALIAS[first] || first;
}

/* ---------- 1. Globals -------------------------------- */
let allProducts   = [];
let prices        = [];
let activeCategory = "All";
let searchQuery    = "";

let modeFilter  = "all";   // all | nearby | online
let priceOrder  = "none";  // none | asc | desc
let panelOpen   = false;   // dropdown visibility
let userLocation = null;   // {lat,lng}

/* ---------- 2. Bootstrap ------------------------------ */
loadData();

/* 2 A. Fetch JSON + geolocate */
async function loadData() {
  try {
    const prodRes = await fetch("https://c5742a9cf296.ngrok-free.app/api/products");
const priceRes = await fetch("https://c5742a9cf296.ngrok-free.app/api/prices");


    allProducts = await prodRes.json();
    prices = await priceRes.json();

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          initUI();
        },
        () => initUI()
      );
    } else {
      initUI();
    }
  } catch (err) {
    console.error("Data load error:", err);
  }
}


/* 2 B. Build controls & listeners */
function initUI() {
  /* --- 1. Build category options ----------------------------------------- */
  const catSel = document.getElementById("categorySelect");
  catSel.innerHTML = "";
  ["All", ...new Set(allProducts.map(p => p.category).sort())]
    .forEach(c => {
      const o = document.createElement("option");
      o.value = o.textContent = c;
      catSel.appendChild(o);
    });

  /* Category change listener */
  catSel.onchange = e => {
    activeCategory = e.target.value;
    refresh();
  };

  /* --- 2. Cache other controls ------------------------------------------- */
  const searchInput = document.getElementById("searchInput");
  const modeSel     = document.getElementById("modeSelect");
  const priceSel    = document.getElementById("priceSelect");
  const sortBtn     = document.getElementById("sortBtn");
  const sortPanel   = document.getElementById("sortPanel");
  const barcodeBtn  = document.getElementById("barcodeBtn");

  /* --- 3. Listeners ------------------------------------------------------- */
  searchInput.oninput = e => {
    searchQuery = e.target.value.toLowerCase();
    refresh();
  };

  modeSel.onchange  = e => { modeFilter = e.target.value;  refresh(); };
  priceSel.onchange = e => { priceOrder = e.target.value; refresh(); };

  // Toggle sort panel
  sortBtn.onclick = () => {
    panelOpen = !panelOpen;
    sortPanel.classList.toggle("hidden", !panelOpen);
  };

  // Close panel when clicking outside
  document.addEventListener("click", e => {
    if (panelOpen && !sortPanel.contains(e.target) && e.target !== sortBtn) {
      panelOpen = false;
      sortPanel.classList.add("hidden");
    }
  });

  // Barcode scanner
  barcodeBtn.onclick = startScanner;

  /* --- 4. Initial render -------------------------------------------------- */
  refresh();
}

/* ---------- 3. Helper maps & math --------------------- */
const priceMap = () =>
  prices.reduce((m,p)=>((m[p.product_id]??=[]).push(p),m),{});

const miles = (aLat,aLng,bLat,bLng)=>{
  const R=3958.8,rad=x=>x*Math.PI/180;
  const dLat=rad(bLat-aLat), dLon=rad(bLng-aLng);
  const h=Math.sin(dLat/2)**2 + Math.cos(rad(aLat))*Math.cos(rad(bLat))*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
};
function nearestStore(id){
  if(!userLocation) return null;
  const rows=(priceMap()[id]||[]).filter(r=>r.lat&&r.lng);
  if(!rows.length) return null;
  rows.sort((a,b)=>a.price-b.price);
  const best=rows[0];
  best.mile=miles(userLocation.lat,userLocation.lng,best.lat,best.lng);
  return best;
}

/* ---------- 4. Refresh pipeline ----------------------- */
function refresh(){
  const pMap = priceMap();
  let list = allProducts.filter(p =>
    (activeCategory==="All" || p.category===activeCategory) &&
    (searchQuery===""       || p.name.toLowerCase().includes(searchQuery))
  );

  /* filter by mode */
  if(modeFilter==="online") list = list.filter(p => (pMap[p.id]||[]).some(r=>!r.lat&&!r.lng));
  if(modeFilter==="nearby") list = list.filter(p => (pMap[p.id]||[]).some(r=> r.lat&&r.lng));

  /* ordering */
  if(priceOrder==="asc"||priceOrder==="desc"){
    list.sort((a,b)=>{
      const aLow=Math.min(...(pMap[a.id]||[]).map(r=>r.price));
      const bLow=Math.min(...(pMap[b.id]||[]).map(r=>r.price));
      return priceOrder==="asc" ? aLow-bLow : bLow-aLow;
    });
  } else if(modeFilter==="nearby" && userLocation){
    list.sort((a,b)=>{
      const na=nearestStore(a.id), nb=nearestStore(b.id);
      if(!na&&!nb) return 0; if(!na) return 1; if(!nb) return -1;
      return na.mile - nb.mile;
    });
  }

  renderCards(list, pMap);
}

/* ---------- 5. Render products ------------------------ */
function renderCards(arr, pMap) {
  const root = document.getElementById("productList");
  root.innerHTML = "";

  arr.forEach(prod => {
    const rows = pMap[prod.id] || [];
    if (!rows.length) return;

    const low  = Math.min(...rows.map(r => r.price));
    const phys = nearestStore(prod.id);
    console.log('phys:', phys);


    /* detect single‑shop product (exclusive) */
    const uniqueShops = [...new Set(rows.map(r => r.shop))];
    console.log('uniqueShops:', uniqueShops);
console.log('Canonical:', canonicalShop(uniqueShops[0]));
    const isExclusive = uniqueShops.length === 1;

    /* clean product name of any breaks */
    const cleanName = prod.name
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/\\n/g, " ")
      .replace(/[\u2028\u2029]/g, " ")
      .replace(/[\r\n]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    const card = document.createElement("div");
    card.className = "relative bg-white shadow rounded-lg p-3 sm:p-4";
    card.innerHTML = `
      <div class="flex items-start">
        <!-- image -->
        <img src="${prod.image_url}" alt="${cleanName}"
             class="w-28 h-28 mr-4 rounded object-cover">

        <!-- text column -->
        <div class="flex-1">
          <h2 class="font-semibold text-base sm:text-lg break-words">
            ${cleanName}
          </h2>

          ${
  isExclusive && phys && phys.price
    ? `<div class="mt-3">
         <a href="https://www.google.com/maps?q=${phys.lat},${phys.lng}" target="_blank" class="block">
           <p class="text-sm text-green-600 font-semibold underline">
             Nearby: ${phys.mile.toFixed(1)} mi
           </p>
         </a>
         <a href="${(STORE_SEARCH_URL[canonicalShop(uniqueShops[0])] || '#') + encodeURIComponent(cleanName)}" target="_blank" class="block">
           <p class="text-sm text-gray-500 mt-0.5 no-underline hover:text-blue-600 cursor-pointer">
             ${uniqueShops[0]}
           </p>
         </a>
       </div>`
    : (phys && modeFilter !== "online" && phys.lat && phys.lng)
      ? `<a href="https://www.google.com/maps?q=${phys.lat},${phys.lng}" target="_blank" class="block">
           <p class="text-sm text-green-600 font-semibold mt-3">
             Nearby: £${phys.price.toFixed(2)} • ${phys.mile.toFixed(1)} mi
           </p>
           <p class="text-sm text-gray-500 mt-0.5 no-underline">
             ${phys.shop}
           </p>
         </a>`
      : ""
}

        </div>

        ${!isExclusive ? `
  <p class="absolute right-3 top-16 text-lg sm:text-xl
     text-green-600 font-bold whitespace-nowrap">
    £${low.toFixed(2)}
  </p>
` : ""}

      </div>
    `;

    /* ---------------------------------------------------- */
    /* Compare/Hide button – only for non‑exclusive items   */
    /* ---------------------------------------------------- */
    if (!isExclusive) {
      const btnWrapper = document.createElement("div");
      btnWrapper.className = "flex justify-end";

      const btn = document.createElement("button");
      btn.textContent = "Compare Prices";
      btn.className   = "mt-3 text-blue-600 text-sm";
      btnWrapper.appendChild(btn);
      card.appendChild(btnWrapper);

      const detail = document.createElement("div");
      detail.className = "hidden mt-2 space-y-1";
      card.appendChild(detail);

      btn.onclick = () => {
        if (detail.classList.toggle("hidden")) {
          btn.textContent = "Compare Prices";
        } else {
          detail.innerHTML = "";
          rows
            .sort((a, b) => a.price - b.price)
            .forEach(r => {
              if (modeFilter === "online" && r.lat)  return;
              if (modeFilter === "nearby" && !r.lat) return;

              const link = r.url ||
  (STORE_SEARCH_URL[canonicalShop(r.shop)] || "#") +
  encodeURIComponent(cleanName);


              const mi = r.lat
                ? `<span class="ml-4 text-sm text-blue-600">
                     ${miles(
                       userLocation?.lat || 0,
                       userLocation?.lng || 0,
                       r.lat, r.lng
                     ).toFixed(1)} mi
                   </span>` : "";

              detail.insertAdjacentHTML("beforeend", `
                <div class="flex justify-between items-center text-sm ${
                   r.price === low ? "bg-green-50 font-semibold" : ""}">
                  <span class="flex items-center">
                    ${r.price === low ? "✅ " : ""}
                    <a href="${link}" target="_blank" class="hover:underline">
                      ${r.shop}
                    </a>${mi}
                  </span>
                  <span>£${r.price.toFixed(2)}</span>
                </div>`);
            });
          btn.textContent = "Hide Prices";
        }
      };
    }

    root.appendChild(card);
  });
}


/* ---------- 6. Barcode scanner (QuaggaJS) ------------- */
async function startScanner(){
  const overlay=document.createElement("div");
  overlay.className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center";
  overlay.innerHTML=`<div class="bg-white p-4 rounded-lg w-11/12 max-w-sm relative">
      <video id="scanVid" playsinline autoplay muted class="w-full h-64 object-cover bg-black"></video>
      <button id="closeScan" class="absolute top-2 right-2 text-gray-500 hover:text-red-500 text-xl">&times;</button>
      <p class="text-center text-sm text-gray-600 mt-2">Point camera at barcode</p>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector("#closeScan").onclick=cleanup;

  let stream;
  try{
    try{ stream=await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ exact:"environment" }, width:{ideal:640}, height:{ideal:480}}, audio:false }); }
    catch{ stream=await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"environment" }, audio:false }); }
    const vid=overlay.querySelector("#scanVid"); vid.srcObject=stream; await vid.play();
  }catch(e){ alert("Camera unavailable"); cleanup(); return; }

  Quagga.init({
    inputStream:{ type:"VideoStream", frameSource:overlay.querySelector("#scanVid") },
    decoder:{ readers:["ean_reader","upc_reader"] },
    locator:{ patchSize:"medium", halfSample:true }
  }, err=>{
    if(err){ console.error(err); cleanup(); }
    else Quagga.start();
  });

  Quagga.onDetected(det=>{
    const code=det.codeResult.code;
    cleanup();
    document.getElementById("searchInput").value=code;
    searchQuery=code.toLowerCase();
    refresh();
  });

  function cleanup(){
    Quagga.stop();
    stream?.getTracks().forEach(t=>t.stop());
    overlay.remove();
  }
}


