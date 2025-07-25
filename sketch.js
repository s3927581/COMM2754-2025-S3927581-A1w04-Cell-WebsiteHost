//Chat GPT support and optimized


// BG + FG //

// 1) control when the flow runs (in seconds)
const flowStartSec    = 28;
const flowEndSec      = 50;

// 2) control when clusters & all jitter appear/disappear
const clusterStartSec = 25;  // clusters + jitters begin at 10s
const clusterEndSec   = 35;  // clusters + jitters end   at 25s

// 3) colour palettes
const healthyPalette = [
  '#437770','#1E8B7C','#3A2C5B','#6F4C8B','#14202E'
];
const cancerPalette = [
  '#8B0000','#FF3B00','#FF7000','#E91E63','#FF0000'
];

// 4) flow‐field particles
let particles = [];
const num        = 8000;
const noiseScale = 0.006;

// 5) offscreen buffers
let healthyFg, clusterFg;

// 6) dot data + clusters
let healthyDots = [];
let cancerDots  = [];
let clusters    = [];

// ────────────────────────────────────────────────
//                    Dot class
// ────────────────────────────────────────────────
class Dot {
  constructor(x, y, w, h, col, intensity = 1) {
    this.origX     = x;
    this.origY     = y;
    this.w         = w;
    this.h         = h;
    this.col       = col;
    this.x         = x;
    this.y         = y;
    this.intensity = intensity;   // fixed shake strength
  }
  vibrate() {
    const maxJitter = 2;
    this.x = this.origX + random(-1, 1) * maxJitter * this.intensity;
    this.y = this.origY + random(-1, 1) * maxJitter * this.intensity;
  }
  display() {
    fill(this.col);
    ellipse(this.x, this.y, this.w, this.h);
  }
}

// ────────────────────────────────────────────────
//               p5.js lifecycle
// ────────────────────────────────────────────────
function setup() {
  const canvas = createCanvas(1920, 1080);   // giữ nguyên kích thước
  canvas.parent(document.querySelector('.v1_17')); // ⚡ gắn vào div
  canvas.style('position', 'absolute');              // ⚡ phủ khít div


  frameRate(60);
  ellipseMode(CENTER);

  // draw the static background
  background('#D747F8');
  background('#C8F847');

  // ── 1) static healthy cells ──
  healthyFg = createGraphics(width, height);
  healthyFg.noStroke();
  healthyFg.background(0, 0);  // fully transparent
  for (let i = 0; i < 3000; i++) {
    let x = random(width),
        y = random(height),
        r = random(1, 15),
        w = r * random(0.5, 1.5),
        h = r * random(0.5, 1.5),
        col = color(random(healthyPalette));
    col.setAlpha(180);

    // store for later jitter
    healthyDots.push(new Dot(x, y, w, h, col));
    healthyFg.fill(col);
    healthyFg.ellipse(x, y, w, h);
  }

  // ── 2) static cancer clusters ──
  clusterFg = createGraphics(width, height);
  clusterFg.noStroke();
  clusterFg.background(0, 0);
  for (let j = 0; j < 10; j++) {
    let cx = random(width),
        cy = random(height);
    clusters.push({ x: cx, y: cy, r: 150 });

    clusterFg.push();
    for (let i = 0; i < 200; i++) {
      let ang  = random(TWO_PI),
          dist = random(10, 250),
          x2   = cx + cos(ang) * dist,
          y2   = cy + sin(ang) * dist,
          r    = random(10, 30),
          w2   = r * random(0.7, 1.3),
          h2   = r * random(0.3, 1.7),
          col2 = color(random(cancerPalette));
      col2.setAlpha(200);

      // fixed shake = 2.5
      cancerDots.push(new Dot(x2, y2, w2, h2, col2, 2.5));

      clusterFg.fill(col2);
      clusterFg.ellipse(x2, y2, w2, h2);
    }
    clusterFg.pop();
  }

  // ── 3) compute healthy-dot shake strengths once ──
  assignHealthyIntensities();

  // ── 4) init flow‐field particles ──
  for (let i = 0; i < num; i++) {
    particles.push(createVector(random(width), random(height)));
  }

  // keep flow points visible
  stroke(0);
  strokeWeight(4);
}

function draw() {
  const t = millis() / 1000;
  const finalEnd = max(flowEndSec, clusterEndSec);

  // ── always show static healthy cells ──
  image(healthyFg, 0, 0);

  // ── flow‐field ──
  if (t >= flowStartSec && t <= flowEndSec) {
    updateParticles();
    drawParticles();
  }

  // ── static clusters + jitter ──
  if (t >= clusterStartSec && t <= clusterEndSec) {
    // draw the cluster‐only buffer
    image(clusterFg, 0, 0);

    // overlay all jittering dots
    noStroke();
    for (let d of healthyDots) { d.vibrate(); d.display(); }
    for (let d of cancerDots)  { d.vibrate(); d.display(); }
  }

  // ── once everything’s done, stop at the latest end time ──
  if (t > finalEnd) {
    noLoop();
  }
}

// ────────────────────────────────────────────────
//            helper & utility funcs
// ────────────────────────────────────────────────
function updateParticles() {
  for (let p of particles) {
    let n = noise(p.x * noiseScale, p.y * noiseScale),
        a = TAU * n;
    p.x += cos(a);
    p.y += sin(a);
    if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
      p.x = random(width);
      p.y = random(height);
    }
  }
}

function drawParticles() {
  stroke(0);
  beginShape(POINTS);
  for (let p of particles) vertex(p.x, p.y);
  endShape();
}

// Compute each healthy dot’s intensity from its distance to nearest cluster
function assignHealthyIntensities() {
  for (let d of healthyDots) {
    let best = clusters.reduce((b, c) => {
      let dd = dist(d.origX, d.origY, c.x, c.y);
      return dd < b.d ? { c, d: dd } : b;
    }, { c: null, d: Infinity });

    // inside cluster → up to 3; outside → gentle 1
    d.intensity = best.d <= best.c.r
      ? 3 - (best.d / best.c.r)
      : 1;
  }
}
