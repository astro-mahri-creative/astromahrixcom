/* ================================================================
   ASTRO MAHRI — RELEASE MICROSITE · interactions
   - canvas starfield with parallax depth layers
   - scroll progress beam + element parallax
   - scroll-triggered reveals
   - merch slideshow
   ================================================================ */

/* ---------- CANVAS STARFIELD w/ parallax depth ---------- */
(function(){
  const c = document.getElementById('stars');
  if(!c) return;
  const ctx = c.getContext('2d');
  let w, h, stars = [];
  const LAYERS = [
    {count: 90, speed: 0.04, size: [0.4,1],   color: 'rgba(255,255,255,'},
    {count: 55, speed: 0.10, size: [0.7,1.6], color: 'rgba(255,200,87,'},
    {count: 28, speed: 0.20, size: [1,2.4],   color: 'rgba(91,233,255,'}
  ];
  function resize(){
    // clientWidth, not innerWidth: innerWidth counts the scrollbar, which
    // made the canvas wider than the area it covers.
    w = c.width = document.documentElement.clientWidth || window.innerWidth;
    h = c.height = document.documentElement.clientHeight || window.innerHeight;
    stars = [];
    LAYERS.forEach((L,li)=>{
      for(let i=0;i<L.count;i++){
        stars.push({
          x: Math.random()*w, y: Math.random()*h*2,
          r: L.size[0] + Math.random()*(L.size[1]-L.size[0]),
          tw: Math.random()*Math.PI*2,
          layer: li
        });
      }
    });
  }
  let scrollY = window.scrollY;
  function draw(){
    ctx.clearRect(0,0,w,h);
    for(const s of stars){
      const L = LAYERS[s.layer];
      const y = (s.y - scrollY*L.speed) % (h*2);
      const yy = y < 0 ? y + h*2 : y;
      s.tw += 0.02;
      const a = 0.4 + Math.sin(s.tw)*0.35;
      ctx.beginPath();
      ctx.fillStyle = L.color + a.toFixed(2) + ')';
      ctx.arc(s.x, yy, s.r, 0, Math.PI*2);
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize', resize, {passive:true});
  window.addEventListener('scroll', ()=>{ scrollY = window.scrollY; }, {passive:true});
  resize(); draw();
})();

/* ---------- SCROLL PROGRESS + PARALLAX ELEMENTS ---------- */
(function(){
  const bar = document.getElementById('progress');
  const px = [...document.querySelectorAll('[data-parallax]')];
  function onScroll(){
    const st = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if(bar) bar.style.width = (max>0 ? (st/max*100) : 0) + '%';
    px.forEach(el=>{
      const speed = parseFloat(el.dataset.parallax);
      const rect = el.getBoundingClientRect();
      const offset = (rect.top + rect.height/2 - window.innerHeight/2) * speed;
      el.style.transform = 'translateY('+(-offset).toFixed(1)+'px)';
    });
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('resize', onScroll, {passive:true});
  onScroll();
})();

/* ---------- REVEAL ON SCROLL ---------- */
(function(){
  const els = document.querySelectorAll('.reveal');
  if(!('IntersectionObserver' in window)){ els.forEach(e=>e.classList.add('in')); return; }
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target);} });
  }, {threshold:0.18, rootMargin:'0px 0px -8% 0px'});
  els.forEach(e=>io.observe(e));
})();

/* ---------- SHOOTING STAR (section-break.style-1) — random 5-10s between shots ---------- */
(function(){
  const el = document.querySelector('.section-break.style-1');
  if(!el) return;
  function fire(){
    el.classList.remove('shooting');
    /* force reflow so re-adding the class restarts the animation */
    void el.offsetWidth;
    el.classList.add('shooting');
    const next = 5000 + Math.random() * 5000;  /* 5-10 seconds */
    setTimeout(fire, next);
  }
  /* small initial delay so the first shot doesn't fire instantly on page load */
  setTimeout(fire, 1500 + Math.random() * 2000);
})();

/* ---------- SLIDESHOW (.slideshow) — one control per .slide, auto-cycles while on screen ---------- */
(function(){
  document.querySelectorAll('.slideshow').forEach(show=>{
    const slides = [...show.querySelectorAll('.slide')];
    if(slides.length < 2) return;
    const interval = parseInt(show.dataset.interval, 10) || 4500;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const nav = document.createElement('div');
    nav.className = 'slide-nav';
    nav.setAttribute('aria-label', 'Product photos');
    const buttons = slides.map((s,i)=>{
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = s.dataset.label || String(i+1);
      b.addEventListener('click', ()=>{ go(i); restart(); });
      nav.appendChild(b);
      return b;
    });
    show.appendChild(nav);

    let current = Math.max(0, slides.findIndex(s=>s.classList.contains('is-active')));
    function go(i){
      current = (i + slides.length) % slides.length;
      slides.forEach((s,j)=>{
        s.classList.toggle('is-active', j===current);
        s.setAttribute('aria-hidden', j===current ? 'false' : 'true');
      });
      buttons.forEach((b,j)=>b.setAttribute('aria-current', j===current ? 'true' : 'false'));
    }
    go(current);
    /* reduced motion: the controls still work, nothing moves on its own */
    if(still) return;

    let timer = null, visible = false, held = false;
    function stop(){ clearInterval(timer); timer = null; }
    function restart(){
      stop();
      if(visible && !held && !document.hidden) timer = setInterval(()=>go(current+1), interval);
    }
    /* hold still while someone is looking closely or using the controls */
    show.addEventListener('mouseenter', ()=>{ held = true; restart(); });
    show.addEventListener('mouseleave', ()=>{ held = false; restart(); });
    show.addEventListener('focusin', ()=>{ held = true; restart(); });
    show.addEventListener('focusout', ()=>{ held = false; restart(); });
    document.addEventListener('visibilitychange', restart);
    if('IntersectionObserver' in window){
      new IntersectionObserver(entries=>{ visible = entries[0].isIntersecting; restart(); }, {threshold:0.3}).observe(show);
    } else { visible = true; restart(); }
  });
})();
