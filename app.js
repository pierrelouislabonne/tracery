(function(){
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const bgCanvas = document.getElementById('bg');
  const bgCtx = bgCanvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const TAU = Math.PI*2;

  // ---------- Seeded PRNG ----------
  function mulberry32(a){
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  let seed = (Math.random()*1e9)|0;
  let rnd = mulberry32(seed);
  const R  = (a,b)=> a + rnd()*(b-a);
  const RI = (a,b)=> Math.floor(R(a,b+1));
  const pick = arr => arr[RI(0, arr.length-1)];

  // ---------- Primitives ----------
  const circle = (cx,cy,r) => ({kind:'ellipse', cx, cy, rx:r, ry:r});
  const ellipse = (cx,cy,rx,ry) => ({kind:'ellipse', cx, cy, rx, ry});
  const arc = (cx,cy,r,a0,a1) => ({kind:'arc', cx, cy, r, a0, a1});
  function regPoly(cx,cy,r,sides,rot){
    const pts = [];
    for(let i=0;i<sides;i++){
      const a = rot + i/sides*TAU;
      pts.push([cx + Math.cos(a)*r, cy + Math.sin(a)*r]);
    }
    return {kind:'poly', pts};
  }
  // triangle point up, square flat, diamond, pentagon, hexagon
  const BASE_ROT = {3:-Math.PI/2, 4:Math.PI/4, 5:-Math.PI/2, 6:0, 8:Math.PI/8};
  const line = (x1,y1,x2,y2) => ({kind:'line', x1, y1, x2, y2});
  const capsule = (cx,cy,r,w) => ({kind:'capsule', cx, cy, r, w}); // horizontal capsule
  function shapeAt(kind, x, y, r){
    if(kind==='circle') return circle(x,y,r);
    if(kind==='diamond') return regPoly(x,y,r,4,-Math.PI/2);
    if(kind==='halfCircle') return arc(x,y,r,Math.PI,TAU);
    if(kind==='capsule') return capsule(x,y,r*0.55,r*0.6);
    return regPoly(x,y,r, kind, BASE_ROT[kind]);
  }

  // Vertical extent of a shape built at (0,0) — used by the stack rule
  function vExtent(kind, r){
    if(kind==='circle') return {top:-r, bot:r};
    if(kind==='diamond') return {top:-r, bot:r};
    if(kind==='halfCircle') return {top:-r, bot:0};
    if(kind==='capsule') return {top:-r*0.55, bot:r*0.55};
    if(kind===4) return {top:-r*Math.SQRT1_2, bot:r*Math.SQRT1_2};
    if(kind===3) return {top:-r, bot:r*0.5};
    if(kind===6) return {top:-r*Math.sin(Math.PI/3), bot:r*Math.sin(Math.PI/3)};
    if(kind===8) return {top:-r*Math.cos(Math.PI/8), bot:r*Math.cos(Math.PI/8)};
    if(kind===5) return {top:-r, bot:r*Math.cos(Math.PI/5)};
    return {top:-r, bot:r};
  }

  // ---------- Composition rules ----------

  // Tangent: shrinking shapes aligned on a shared tangency line
  function ruleTangent(n){
    const kind = pick(['circle','circle','circle',4,3,6,5,'diamond','capsule']);
    const r0 = R(300, 380), k = R(0.76, 0.86);
    const bottom = rnd() < 0.7;
    const yT = bottom ? r0 : -r0;
    const out = []; let r = r0;
    for(let i=0;i<n;i++){
      const e = vExtent(kind, r);
      // the shape meets line yT with its bottom (or top) edge
      out.push(shapeAt(kind, 0, yT - (bottom ? e.bot : e.top), r));
      r *= k;
    }
    return out;
  }

  function ruleConcentric(n){
    const kind = pick(['circle','circle',4,3,5,6,8,'diamond']);
    const r0 = R(320, 400);
    const inner = R(0.22, 0.4);
    const geo = rnd() < 0.5;
    const out = [];
    for(let i=0;i<n;i++){
      const t = n===1 ? 0 : i/(n-1);
      const r = geo ? r0*Math.pow(inner, t) : r0*(1 - t*(1-inner));
      out.push(shapeAt(kind, 0, 0, r));
    }
    return out;
  }

  function ruleClover(){
    const k = pick([2,3,4,4,4,5]);
    const r = R(230, 280);
    const d = r * R(0.5, 0.72);
    const phase = -Math.PI/2 + (rnd()<0.5 ? 0 : Math.PI/k);
    const out = [];
    for(let i=0;i<k;i++){
      const a = phase + i/k*TAU;
      out.push(circle(Math.cos(a)*d, Math.sin(a)*d, r));
    }
    return out;
  }

  // Trail: total length is bounded -> proportions stay compact.
  // The shape count drives repetition density, not stretch.
  function ruleTrail(n){
    const kind = pick(['circle','circle','circle',4,3,'diamond','capsule',5]);
    const isCircle = kind === 'circle';
    const r = R(170, 230);
    // Circles: dense repetition (extrusion effect). Other shapes:
    // fewer copies and no wider, so the edges stay readable.
    const nT = isCircle ? 5 + Math.round((n-3)/4 * 6) : RI(3, 5);
    const A = pick([-Math.PI/3, -Math.PI/4, -Math.PI*0.36]) * (rnd()<0.5 ? 1 : -1);
    const total = isCircle ? r * R(1.2, 1.8) : r * R(1.6, 2.3);
    const step = total/(nT-1);
    const out = [];
    for(let i=0;i<nT;i++)
      out.push(shapeAt(kind, Math.cos(A)*step*i, Math.sin(A)*step*i, r));
    return out;
  }

  function ruleRotation(n){
    const sides = pick([3,4,4,5,6]);
    // Guaranteed minimum angular gap: the more sides a shape has,
    // the fewer copies allowed (otherwise they blur into a ring)
    const maxCopies = {3:5, 4:3, 5:3, 6:2}[sides];
    const r = R(280, 340);
    const nR = Math.max(2, Math.min(maxCopies, n-1));
    const period = TAU/sides;
    const out = [];
    for(let i=0;i<nR;i++)
      out.push(regPoly(0, 0, r, sides, BASE_ROT[sides] + i*period/nR));
    return out;
  }

  function ruleInscribed(n){
    const out = [];
    let r = R(320, 400);
    let isCircle = rnd() < 0.7;
    for(let i=0;i<n;i++){
      if(isCircle){
        out.push(circle(0,0,r));
      } else {
        const s = pick([3,4,4,5,6]);
        out.push(regPoly(0,0,r,s,BASE_ROT[s]));
        r = r * Math.cos(Math.PI/s);
      }
      isCircle = !isCircle;
    }
    return out;
  }

  // Satellites: small shapes sitting on a large circle
  function ruleOrbit(){
    const r0 = R(270, 330);
    const k = pick([3,4,5,6,8]);
    const rs = r0 * R(0.13, 0.2);
    // Satellites may differ in kind from the orbit itself,
    // but are all identical to each other (one shape per role)
    const satKind = pick(['circle','circle',4,3,'diamond']);
    const out = [circle(0,0,r0)];
    for(let i=0;i<k;i++){
      const a = -Math.PI/2 + i/k*TAU;
      out.push(shapeAt(satKind, Math.cos(a)*r0, Math.sin(a)*r0, rs));
    }
    return out;
  }

  // Vertical stack: different shapes resting on one another
  function ruleStack(n){
    const count = Math.max(2, Math.min(4, Math.round(n*0.6)));
    const kinds = [];
    for(let i=0;i<count;i++){
      let k;
      do { k = pick(['circle',4,3,'diamond','halfCircle',6,'capsule',5]); } while(k === kinds[i-1]);
      kinds.push(k);
    }
    const out = [];
    let cursor = 0;
    for(const k of kinds){
      const r = R(130, 200);
      const e = vExtent(k, r);
      const cy = cursor - e.top;      // this shape's top meets the previous one's bottom
      out.push(shapeAt(k, 0, cy, r));
      cursor = cy + e.bot;
    }
    return out;
  }

  // Arches: concentric half-shapes on a shared baseline (arch / sunset)
  function ruleArches(n){
    const kind = pick(['circle','circle',4,3,6,'capsule']);
    const r0 = R(320, 400);
    const inner = R(0.3, 0.5);
    const up = rnd() < 0.7;
    const flip = s => {
      if(s.kind==='arc') return arc(0, 0, s.r, 0, Math.PI);
      return {kind:'poly', open:true, pts:s.pts.map(([x,y])=>[x,-y])};
    };
    const out = [];
    for(let i=0;i<n;i++){
      const t = n===1 ? 0 : i/(n-1);
      const r = r0*(1 - t*(1-inner));
      const s = halfTop(kind, r);
      out.push(up ? s : flip(s));
    }
    return out;
  }

  // k x k grid of a single shape, overlap allowed
  function ruleGrid(){
    const k = pick([2,2,2,3]);
    const kind = pick(['circle','circle',4,3,'diamond',6]);
    const s = R(150, 210);
    const gap = s*2 * R(0.55, 0.85);   // <2s -> Venn-style interlocking
    const out = [];
    for(let i=0;i<k;i++)
      for(let j=0;j<k;j++)
        out.push(shapeAt(kind, (j-(k-1)/2)*gap, (i-(k-1)/2)*gap, s));
    return out;
  }

  function ruleEllipses(n){
    const r0 = R(320, 400);
    const out = [circle(0,0,r0)];
    for(let i=1;i<n;i++){
      const t = i/(n-1);
      out.push(ellipse(0, 0, r0, r0*(1 - t*R(0.82,0.92))));
    }
    return out;
  }

  // Phases: identical shapes offset along the vertical axis
  function rulePhases(n){
    const kind = pick(['circle','circle','circle',4,3,6,'diamond','capsule']);
    const isCircle = kind === 'circle';
    const r = R(280, 340);
    // As with trail: angular shapes read poorly when tightly
    // overlapped -> fewer of them, spaced further apart
    const nP = isCircle ? n : Math.min(n, RI(3, 4));
    const spread = r * (isCircle ? R(0.5, 0.95) : R(0.95, 1.3));
    const out = [];
    for(let i=0;i<nP;i++){
      const t = nP===1 ? 0.5 : i/(nP-1);
      out.push(shapeAt(kind, 0, -spread/2 + t*spread, r));
    }
    return out;
  }

  // Rays: a central shape + evenly spaced segments on a circular ring
  function ruleRays(){
    const kind = pick(['circle','circle',4,3,6,5,8,'diamond','capsule']);
    const r0 = R(240, 300);
    const k = pick([8, 12, 16]);
    // rays stay laid out in a circle, clear of the shape's footprint
    const g1 = r0 * R(1.3, 1.42);
    const g2 = g1 + r0 * R(0.14, 0.24);
    const out = [shapeAt(kind, 0, 0, r0)];
    for(let i=0;i<k;i++){
      const a = -Math.PI/2 + i/k*TAU;
      out.push(line(Math.cos(a)*g1, Math.sin(a)*g1, Math.cos(a)*g2, Math.sin(a)*g2));
    }
    return out;
  }

  // Horizontal half-width of a shape's envelope at a given height y
  function halfWidthAt(s, y){
    if(s.kind==='ellipse'){
      const k = 1 - (y/s.ry)*(y/s.ry);
      return k <= 0 ? 0 : s.rx*Math.sqrt(k);
    }
    if(s.kind==='capsule'){
      const k = s.r*s.r - y*y;
      return k <= 0 ? 0 : s.w + Math.sqrt(k);
    }
    // polygon: intersections of the horizontal line with the edges
    let lo = Infinity, hi = -Infinity;
    for(let i=0;i<s.pts.length;i++){
      const [x1,y1] = s.pts[i], [x2,y2] = s.pts[(i+1)%s.pts.length];
      if((y1 <= y && y2 >= y) || (y2 <= y && y1 >= y)){
        const x = (y2 - y1) === 0 ? x1 : x1 + (x2-x1)*(y-y1)/(y2-y1);
        lo = Math.min(lo, x); hi = Math.max(hi, x);
      }
    }
    return hi > lo ? (hi - lo)/2 : 0;
  }

  // Hatching: horizontal chords of a shape (striped disc) or parallel bands
  function ruleHatching(){
    const r0 = R(280, 360);
    const nL = RI(5, 11);
    const out = [];
    if(rnd() < 0.65){
      // striped shape: lines follow the chosen shape's envelope
      const kind = pick(['circle','circle',3,6,5,'diamond','capsule']);
      const env = shapeAt(kind, 0, 0, r0);
      const e = vExtent(kind, r0);
      const span = e.bot - e.top;
      for(let i=0;i<nL;i++){
        const y = e.top + span*(i+0.5)/nL;
        const half = halfWidthAt(env, y);
        if(half < 8) continue;               // tip too narrow: skip
        out.push(line(-half, y, half, y));
      }
    } else {
      // evenly spaced parallel bands, horizontal or vertical
      const vertical = rnd() < 0.4;
      const len = R(420, 560);
      const gap = R(46, 78);
      for(let i=0;i<nL;i++){
        const off = (i - (nL-1)/2) * gap;
        out.push(vertical ? line(off, -len/2, off, len/2)
                          : line(-len/2, off, len/2, off));
      }
    }
    return out;
  }

  // Chevrons: a pure stack, or combined with a shape (vertical or lateral)
  function ruleChevrons(){
    const variant = rnd();

    // Variant 1 — pure stack of Vs (the original)
    if(variant < 0.4){
      const w = R(220, 300);
      const h = w * R(0.45, 0.7);
      const nC = RI(3, 7);
      const gap = h * R(0.7, 1.1);
      const dh = rnd() < 0.5 ? h : -h;
      const out = [];
      for(let i=0;i<nC;i++){
        const y0 = i * gap;
        out.push(line(-w, y0 + dh, 0, y0));
        out.push(line(0, y0, w, y0 + dh));
      }
      return out;
    }

    const kind = pick(['circle','circle',4,'diamond',3]);
    const rS = R(150, 200);

    // Variant 2 — shape + chevrons stacked below/above ("scroll" motif)
    if(variant < 0.75){
      const w = rS * R(0.9, 1.15);
      const h = w * R(0.5, 0.65);
      const nC = RI(2, 4);
      const below = rnd() < 0.6;
      const e = vExtent(kind, rS);
      const gap0 = rS * R(0.3, 0.45);
      const step = h * R(1.15, 1.45);
      const out = [shapeAt(kind, 0, 0, rS)];
      for(let i=0;i<nC;i++){
        if(below){
          const y0 = e.bot + gap0 + i*step;        // pointing down
          out.push(line(-w, y0, 0, y0 + h));
          out.push(line(0, y0 + h, w, y0));
        } else {
          const y0 = e.top - gap0 - i*step;        // pointing up
          out.push(line(-w, y0, 0, y0 - h));
          out.push(line(0, y0 - h, w, y0));
        }
      }
      return out;
    }

    // Variant 3 — shape flanked by lateral chevrons pointing outward
    const w2 = rS * R(0.7, 0.9);
    const h2 = w2 * R(0.5, 0.7);
    const nS = RI(2, 3);
    const x0 = rS * R(1.25, 1.45);
    const step2 = h2 * R(1.3, 1.6);
    const out = [shapeAt(kind, 0, 0, rS)];
    for(let i=0;i<nS;i++){
      const xr = x0 + i*step2;                     // right side: points right
      out.push(line(xr, -w2, xr + h2, 0));
      out.push(line(xr + h2, 0, xr, w2));
      const xl = -x0 - i*step2;                    // left side: points left
      out.push(line(xl, -w2, xl - h2, 0));
      out.push(line(xl - h2, 0, xl, w2));
    }
    return out;
  }

  // Fan: segments converging on a single point
  function ruleFan(){
    const r1 = R(90, 140);
    const r2 = r1 + R(260, 340);
    const k = RI(5, 9);
    const spread = R(Math.PI*0.45, Math.PI*0.8);
    const base = pick([-Math.PI/2, Math.PI/2, 0, Math.PI]);
    const out = [];
    // sometimes a circle at the convergence point, inside the central gap
    if(rnd() < 0.45) out.push(circle(0, 0, r1 * R(0.55, 0.8)));
    for(let i=0;i<k;i++){
      const a = base - spread/2 + spread * (k===1 ? 0.5 : i/(k-1));
      out.push(line(Math.cos(a)*r1, Math.sin(a)*r1, Math.cos(a)*r2, Math.sin(a)*r2));
    }
    return out;
  }

  // Open upper outline of a shape, resting on the horizon line (y=0)
  function halfTop(kind, r){
    if(kind==='circle') return arc(0, 0, r, Math.PI, TAU);
    if(kind===4){
      const w = r*0.8;
      return {kind:'poly', open:true, pts:[[-w,0],[-w,-w],[w,-w],[w,0]]};
    }
    if(kind===3){
      const w = r*0.95, h = r*0.85;
      return {kind:'poly', open:true, pts:[[-w,0],[0,-h],[w,0]]};
    }
    if(kind===6){
      const h = r*Math.sin(Math.PI/3);
      return {kind:'poly', open:true, pts:[[-r,0],[-r/2,-h],[r/2,-h],[r,0]]};
    }
    // capsule: two quarter circles joined by a flat
    const rr = r*0.6, w = r*0.55;
    const pts = [];
    for(let k=0;k<=8;k++){ const a = Math.PI + k/8*(Math.PI/2); pts.push([-w + Math.cos(a)*rr, Math.sin(a)*rr]); }
    for(let k=0;k<=8;k++){ const a = Math.PI*1.5 + k/8*(Math.PI/2); pts.push([ w + Math.cos(a)*rr, Math.sin(a)*rr]); }
    return {kind:'poly', open:true, pts};
  }

  // Horizon: a half-shape over receding lines (sun on water)
  function ruleHorizon(){
    const kind = pick(['circle','circle',4,3,6,'capsule']);
    const r0 = R(240, 300);
    const nL = RI(3, 6);
    const gap = r0 * R(0.18, 0.28);
    const out = [halfTop(kind, r0)];
    for(let i=0;i<nL;i++){
      const y = gap * (i+1);
      const half = r0 * 1.1 * (1 - i/(nL+1));
      out.push(line(-half, y, half, y));
    }
    return out;
  }

  const RULES = {
    tangent: ruleTangent,
    concentric: ruleConcentric,
    clover: ruleClover,
    trail: ruleTrail,
    rotation: ruleRotation,
    inscribed: ruleInscribed,
    orbit: ruleOrbit,
    stack: ruleStack,
    arches: ruleArches,
    grid: ruleGrid,
    rays: ruleRays,
    hatching: ruleHatching,
    chevrons: ruleChevrons,
    fan: ruleFan,
    horizon: ruleHorizon,
    ellipses: ruleEllipses,
    phases: rulePhases
  };
  const RULE_KEYS = Object.keys(RULES);

  // ---------- Rendering ----------
  const $ = id => document.getElementById(id);
  let lastGeometry = null;

  function params(){
    return {
      fade: $('fade').checked ? 1 : 0,  // opacity fade: full or none
      weight: 1,   // stroke weight pinned to maximum (lw = 4.4)
      dark: $('dark').checked,
      grid: $('grid').checked,
      rule: $('rule').value
    };
  }

  function theme(P){
    return P.dark
      ? { bg:'#0e0e10', dot:'rgba(255,255,255,0.20)', stroke: a => `rgba(248,248,246,${a.toFixed(3)})` }
      : { bg:'#fcfbf9', dot:'#c2bfb5', stroke: a => `rgba(46,46,51,${a.toFixed(3)})` };
  }

  function arcPoints(s, N){
    const pts = [];
    for(let i=0;i<=N;i++){
      const a = s.a0 + (s.a1-s.a0)*i/N;
      pts.push([s.cx + Math.cos(a)*s.r, s.cy + Math.sin(a)*s.r]);
    }
    return pts;
  }

  function bbox(shapes){
    let xMin=Infinity,xMax=-Infinity,yMin=Infinity,yMax=-Infinity;
    const feed = (x,y)=>{
      xMin=Math.min(xMin,x); xMax=Math.max(xMax,x);
      yMin=Math.min(yMin,y); yMax=Math.max(yMax,y);
    };
    for(const s of shapes){
      if(s.kind==='ellipse'){ feed(s.cx-s.rx,s.cy-s.ry); feed(s.cx+s.rx,s.cy+s.ry); }
      else if(s.kind==='arc') for(const [x,y] of arcPoints(s,24)) feed(x,y);
      else if(s.kind==='line'){ feed(s.x1,s.y1); feed(s.x2,s.y2); }
      else if(s.kind==='capsule'){ feed(s.cx-s.w-s.r, s.cy-s.r); feed(s.cx+s.w+s.r, s.cy+s.r); }
      else for(const [x,y] of s.pts) feed(x,y);
    }
    return {xMin,xMax,yMin,yMax};
  }

  // Stroke the shapes onto a given 2D context
  function paintStrokes(c, shapes, alphas, dashes, lw, T){
    c.lineWidth = lw;
    c.lineJoin = 'miter';
    c.lineCap = 'butt';
    shapes.forEach((s, i)=>{
      c.strokeStyle = T.stroke(alphas[i]);
      c.setLineDash(dashes[i] || []);
      c.beginPath();
      if(s.kind==='ellipse'){
        c.ellipse(s.cx, s.cy, s.rx, s.ry, 0, 0, TAU);
      } else if(s.kind==='arc'){
        c.arc(s.cx, s.cy, s.r, s.a0, s.a1);
      } else if(s.kind==='line'){
        c.moveTo(s.x1, s.y1); c.lineTo(s.x2, s.y2);
      } else if(s.kind==='capsule'){
        c.moveTo(s.cx-s.w, s.cy-s.r);
        c.lineTo(s.cx+s.w, s.cy-s.r);
        c.arc(s.cx+s.w, s.cy, s.r, -Math.PI/2, Math.PI/2);
        c.lineTo(s.cx-s.w, s.cy+s.r);
        c.arc(s.cx-s.w, s.cy, s.r, Math.PI/2, Math.PI*1.5);
        c.closePath();
      } else {
        c.moveTo(s.pts[0][0], s.pts[0][1]);
        for(let k=1;k<s.pts.length;k++) c.lineTo(s.pts[k][0], s.pts[k][1]);
        if(!s.open) c.closePath();
      }
      c.stroke();
    });
    c.setLineDash([]);
  }

  function pop(){
    canvas.classList.remove('pop');
    void canvas.offsetWidth;          // force reflow to replay the animation
    canvas.classList.add('pop');
  }

  function render(newSeed){
    if(newSeed !== undefined){ seed = newSeed; pop(); }
    rnd = mulberry32(seed);
    const P = params();
    const T = theme(P);

    $('stage').style.background = T.bg;
    $('stage').classList.toggle('theme-dark', P.dark);
    bgCtx.fillStyle = T.bg;
    bgCtx.fillRect(0,0,W,H);
    if(P.grid){
      const step = 36;
      bgCtx.fillStyle = T.dot;
      for(let y=step; y<H; y+=step)
        for(let x=step; x<W; x+=step){
          bgCtx.beginPath(); bgCtx.arc(x,y,1.2,0,TAU); bgCtx.fill();
        }
    }
    ctx.clearRect(0,0,W,H);

    // Shape count: drawn at random on each generation (seed-driven)
    const n = RI(3, 7);
    const ruleKey = P.rule==='auto' ? pick(RULE_KEYS) : P.rule;
    const shapes = RULES[ruleKey](n);

    // Progressive opacity gradient along the stroke sequence.
    // Fade direction is drawn on each generation (ascending or descending).
    const fadeDir = rnd() < 0.5;
    const alphas = shapes.map((_,i)=>{
      let t = shapes.length > 1 ? i/(shapes.length-1) : 0;
      if(fadeDir) t = 1 - t;
      return 0.95 - P.fade*0.8*t;
    });

    // Dashes: at most one stroke of the composition, picked at random.
    const dashes = (()=>{
      const none = shapes.map(()=> null);
      if(rnd() > 0.34) return none;
      const dash = [R(7, 13), R(7, 15)].map(v=>+v.toFixed(1));
      none[RI(0, shapes.length-1)] = dash;
      return none;
    })();
    const b = bbox(shapes);
    const margin = 160;
    const fit = Math.min(1, (W-2*margin)/(b.xMax-b.xMin), (H-2*margin)/(b.yMax-b.yMin));
    let aSum=0, cxW=0, cyW=0;
    for(const s of shapes){
      let a, scx, scy;
      if(s.kind==='ellipse'){
        a = Math.PI*s.rx*s.ry; scx = s.cx; scy = s.cy;
      } else if(s.kind==='arc'){
        const span = s.a1 - s.a0, m = (s.a0+s.a1)/2;
        a = s.r*s.r*span*0.5;
        scx = s.cx + Math.cos(m)*s.r*0.5;
        scy = s.cy + Math.sin(m)*s.r*0.5;
      } else if(s.kind==='line'){
        a = Math.hypot(s.x2-s.x1, s.y2-s.y1) * 30;
        scx = (s.x1+s.x2)/2; scy = (s.y1+s.y2)/2;
      } else if(s.kind==='capsule'){
        a = 4*s.w*s.r + Math.PI*s.r*s.r;
        scx = s.cx; scy = s.cy;
      } else {
        a = 0; scx = 0; scy = 0;
        for(let i=0;i<s.pts.length;i++){
          const [x1,y1] = s.pts[i], [x2,y2] = s.pts[(i+1)%s.pts.length];
          a += x1*y2 - x2*y1;
          scx += x1; scy += y1;
        }
        a = Math.abs(a)/2;
        scx /= s.pts.length; scy /= s.pts.length;
      }
      aSum += a; cxW += scx*a; cyW += scy*a;
    }
    const cx0 = cxW/aSum, cy0 = cyW/aSum;
    const remap = s => {
      if(s.kind==='ellipse'){
        s.cx = W/2 + (s.cx-cx0)*fit; s.cy = H/2 + (s.cy-cy0)*fit;
        s.rx *= fit; s.ry *= fit;
      } else if(s.kind==='arc'){
        s.cx = W/2 + (s.cx-cx0)*fit; s.cy = H/2 + (s.cy-cy0)*fit;
        s.r *= fit;
      } else if(s.kind==='line'){
        s.x1 = W/2 + (s.x1-cx0)*fit; s.y1 = H/2 + (s.y1-cy0)*fit;
        s.x2 = W/2 + (s.x2-cx0)*fit; s.y2 = H/2 + (s.y2-cy0)*fit;
      } else if(s.kind==='capsule'){
        s.cx = W/2 + (s.cx-cx0)*fit; s.cy = H/2 + (s.cy-cy0)*fit;
        s.r *= fit; s.w *= fit;
      } else {
        s.pts = s.pts.map(([x,y]) => [W/2 + (x-cx0)*fit, H/2 + (y-cy0)*fit]);
      }
    };
    shapes.forEach(remap);
    // Guard: pull back into frame if optical centring overflows
    const b2 = bbox(shapes);
    let dx = 0, dy = 0;
    if(b2.xMin < margin) dx = margin - b2.xMin;
    else if(b2.xMax > W-margin) dx = (W-margin) - b2.xMax;
    if(b2.yMin < margin) dy = margin - b2.yMin;
    else if(b2.yMax > H-margin) dy = (H-margin) - b2.yMax;
    if(dx || dy){
      for(const s of shapes){
        if(s.kind==='poly') s.pts = s.pts.map(([x,y]) => [x+dx, y+dy]);
        else if(s.kind==='line'){ s.x1+=dx; s.y1+=dy; s.x2+=dx; s.y2+=dy; }
        else { s.cx += dx; s.cy += dy; }
      }
    }

    const lw = 1.2 + P.weight*3.2;
    paintStrokes(ctx, shapes, alphas, dashes, lw, T);

    lastGeometry = {shapes, alphas, dashes, lw, T, grid:P.grid, rule:ruleKey};
    $('seedLine').textContent = `seed ${seed} · ${ruleKey}`;
  }

  // ---------- Export SVG ----------
  function toSVG(){
    if(!lastGeometry) return '';
    const {shapes, alphas, dashes, lw, T, grid} = lastGeometry;
    const parts = [];
    parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`);
    if(grid){
      const step = 36, dots = [];
      for(let y=step; y<H; y+=step)
        for(let x=step; x<W; x+=step)
          dots.push(`M${x} ${y}m-1.2 0a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0 -2.4 0`);
      parts.push(`<path d="${dots.join('')}" fill="${T.dot}"/>`);
    }
    shapes.forEach((s, i)=>{
      const dash = dashes[i] ? ` stroke-dasharray="${dashes[i].join(' ')}"` : '';
      const stroke = `fill="none" stroke="${T.stroke(alphas[i])}" stroke-width="${lw.toFixed(2)}"${dash}`;
      if(s.kind==='ellipse'){
        if(Math.abs(s.rx - s.ry) < 0.01)
          parts.push(`<circle cx="${s.cx.toFixed(1)}" cy="${s.cy.toFixed(1)}" r="${s.rx.toFixed(1)}" ${stroke}/>`);
        else
          parts.push(`<ellipse cx="${s.cx.toFixed(1)}" cy="${s.cy.toFixed(1)}" rx="${s.rx.toFixed(1)}" ry="${s.ry.toFixed(1)}" ${stroke}/>`);
      } else if(s.kind==='arc'){
        const x0 = s.cx + Math.cos(s.a0)*s.r, y0 = s.cy + Math.sin(s.a0)*s.r;
        const x1 = s.cx + Math.cos(s.a1)*s.r, y1 = s.cy + Math.sin(s.a1)*s.r;
        const large = (s.a1 - s.a0) > Math.PI ? 1 : 0;
        parts.push(`<path d="M${x0.toFixed(1)} ${y0.toFixed(1)}A${s.r.toFixed(1)} ${s.r.toFixed(1)} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" ${stroke}/>`);
      } else if(s.kind==='line'){
        parts.push(`<line x1="${s.x1.toFixed(1)}" y1="${s.y1.toFixed(1)}" x2="${s.x2.toFixed(1)}" y2="${s.y2.toFixed(1)}" ${stroke}/>`);
      } else if(s.kind==='capsule'){
        const r = s.r.toFixed(1);
        parts.push(`<path d="M${(s.cx-s.w).toFixed(1)} ${(s.cy-s.r).toFixed(1)}L${(s.cx+s.w).toFixed(1)} ${(s.cy-s.r).toFixed(1)}A${r} ${r} 0 0 1 ${(s.cx+s.w).toFixed(1)} ${(s.cy+s.r).toFixed(1)}L${(s.cx-s.w).toFixed(1)} ${(s.cy+s.r).toFixed(1)}A${r} ${r} 0 0 1 ${(s.cx-s.w).toFixed(1)} ${(s.cy-s.r).toFixed(1)}Z" ${stroke}/>`);
      } else {
        const pts = s.pts.map(p=>`${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        parts.push(s.open ? `<polyline points="${pts}" ${stroke}/>`
                          : `<polygon points="${pts}" ${stroke}/>`);
      }
    });
    parts.push('</svg>');
    return parts.join('\n');
  }

  // ---------- UI ----------
  $('rule').addEventListener('change', ()=> render((Math.random()*1e9)|0));
  $('dark').addEventListener('change', ()=> render(seed));
  $('grid').addEventListener('change', ()=> render(seed));
  $('fade').addEventListener('change', ()=> render(seed));
  $('regen').addEventListener('click', ()=> render((Math.random()*1e9)|0));
  canvas.addEventListener('click', ()=>{
    render((Math.random()*1e9)|0);
  });
  $('dlsvg').addEventListener('click', ()=>{
    const blob = new Blob([toSVG()], {type:'image/svg+xml'});
    const a = document.createElement('a');
    a.download = `tracery-${seed}.svg`;
    a.href = URL.createObjectURL(blob);
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // ---------- Programmatic API ----------
  // Automation surface: URL parameters and window.tracery. Every generation
  // goes through the DOM controls and then render(), so the screen always
  // reflects exactly what was produced — one source of truth, no parallel path.

  function applyOptions(o){
    if(!o) return;
    if(o.rule !== undefined){
      const r = String(o.rule).trim().toLowerCase();
      if(r !== 'auto' && !RULES[r])
        throw new Error(`tracery: unknown rule "${o.rule}" — expected auto, ${RULE_KEYS.join(', ')}`);
      $('rule').value = r;
    }
    if(o.dark !== undefined) $('dark').checked = !!o.dark;
    if(o.grid !== undefined) $('grid').checked = !!o.grid;
    if(o.fade !== undefined) $('fade').checked = !!o.fade;
  }

  // URL that reproduces the current mark exactly. Note it carries the rule as
  // selected, not as resolved: with rule=auto the seed also drives the pick,
  // so replaying "auto" is what reproduces the composition.
  function permalink(){
    const base = location.href.split('?')[0].split('#')[0];
    return base + '?' + new URLSearchParams({
      seed: String(seed),
      rule: $('rule').value,
      dark: $('dark').checked ? '1' : '0',
      grid: $('grid').checked ? '1' : '0',
      fade: $('fade').checked ? '1' : '0'
    });
  }

  function readURL(){
    const q = new URLSearchParams(location.search);
    const o = {};
    if(q.get('rule')) o.rule = q.get('rule');
    for(const k of ['dark','grid','fade']){
      const v = q.get(k);
      if(v !== null) o[k] = (v !== '0' && v !== 'false' && v !== 'no');
    }
    const s = q.get('seed');
    if(s !== null && s.trim() !== '' && Number.isFinite(+s)) o.seed = +s | 0;
    return o;
  }

  window.tracery = {
    version: 1,
    // Render a mark. Omit seed for a random one; the seed used is returned.
    generate(o){
      applyOptions(o);
      const wants = o && o.seed !== undefined && o.seed !== null && Number.isFinite(+o.seed);
      render(wants ? (+o.seed | 0) : (Math.random()*1e9)|0);
      return window.tracery.state();
    },
    // Serialised SVG of the current mark: native primitives, transparent background.
    toSVG(){ return toSVG(); },
    // Everything needed to describe or reproduce the current mark.
    state(){
      return {
        seed,
        rule: lastGeometry ? lastGeometry.rule : null,   // resolved rule
        ruleInput: $('rule').value,                      // 'auto' or a rule key
        dark: $('dark').checked,
        grid: $('grid').checked,
        fade: $('fade').checked,
        url: permalink()
      };
    },
    rules(){ return RULE_KEYS.slice(); },
    // Raw geometry, for re-rendering or animating elsewhere.
    geometry(){
      if(!lastGeometry) return null;
      const {shapes, alphas, dashes, lw, rule} = lastGeometry;
      return JSON.parse(JSON.stringify({
        rule, width:W, height:H, lineWidth:lw, shapes, alphas, dashes
      }));
    },
    // Trigger the browser download, as the SVG button does.
    download(){ $('dlsvg').click(); }
  };

  // A malformed URL must not leave a blank page: warn and fall back to defaults.
  const boot = readURL();
  try { applyOptions(boot); }
  catch(e){ console.warn(e.message); }
  render(boot.seed !== undefined ? boot.seed : seed);

  // Automation signal: the first mark is drawn and window.tracery is callable.
  // Agents and screenshot pipelines wait on this instead of polling for the API.
  document.documentElement.dataset.traceryReady = '1';
})();
