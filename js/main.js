/* ================================================================
   ASTRO MAHRI — RELEASE MICROSITE · interactions
   - canvas starfield with parallax depth layers
   - scroll progress beam + element parallax
   - scroll-triggered reveals
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
    w = c.width = window.innerWidth;
    h = c.height = window.innerHeight;
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
