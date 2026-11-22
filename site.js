'use strict';

const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const hero = document.querySelector('.hero');
const scene = hero.querySelector('.hero-scene');
const slides = [...scene.querySelectorAll('.hero-image')];
const names = ['חלונות ודלתות', 'תריסים ורשתות', 'זכוכית ומראות'];
const caption = document.querySelector('.caption-text');
const counter = document.querySelector('.slide-count b');
let currentSlide = 0;

// Render a reflected edge of glass as the gallery changes. The photographs
// remain ordinary responsive images on devices without a graphics context.
function createReflection(canvas) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, premultipliedAlpha: false });
  if (!gl) return null;
  const program = gl.createProgram();
  const shaders = [
    [gl.VERTEX_SHADER, 'attribute vec2 pos; varying vec2 uv; void main(){uv=(pos+1.)*.5;gl_Position=vec4(pos,0.,1.);}'],
    [gl.FRAGMENT_SHADER, `precision mediump float;
      varying vec2 uv; uniform float progress;
      void main(){
        float edge=uv.x+.11*uv.y-mix(-.24,1.42,progress);
        float ridge=exp(-abs(edge)*65.)*.13 + exp(-abs(edge+.045)*12.)*.035;
        float fade=sin(progress*3.14159);
        gl_FragColor=vec4(.97,.86,.65,ridge*fade);
      }`]
  ];
  for (const [type, source] of shaders) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'pos');
  const progress = gl.getUniformLocation(program, 'progress');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  let animation = 0;
  return function play() {
    cancelAnimationFrame(animation);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * .8));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * .8));
    gl.viewport(0, 0, canvas.width, canvas.height);
    const start = performance.now();
    function draw(now) {
      const t = Math.min(1, (now - start) / 850);
      gl.uniform1f(progress, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (t < 1 && !motion.matches) animation = requestAnimationFrame(draw);
      else gl.clear(gl.COLOR_BUFFER_BIT);
    }
    animation = requestAnimationFrame(draw);
  };
}

let playReflection;
function changeSlide(step) {
  currentSlide = (currentSlide + step + slides.length) % slides.length;
  slides.forEach((slide, index) => slide.classList.toggle('is-active', index === currentSlide));
  counter.textContent = String(currentSlide + 1).padStart(2, '0');
  caption.firstChild.textContent = names[currentSlide] + ' ';
  if (!motion.matches) {
    if (playReflection === undefined) playReflection = createReflection(document.querySelector('.glass-light'));
    playReflection?.();
  }
}
document.querySelector('#prev').addEventListener('click', () => changeSlide(-1));
document.querySelector('#next').addEventListener('click', () => changeSlide(1));
hero.querySelector('.gallery').addEventListener('keydown', event => {
  if (!['ArrowRight', 'ArrowLeft'].includes(event.key)) return;
  event.preventDefault();
  changeSlide(event.key === 'ArrowLeft' ? 1 : -1);
});
let touchStart;
hero.addEventListener('touchstart', event => {
  touchStart = event.touches.length === 1 ? event.touches[0] : null;
}, { passive: true });
hero.addEventListener('touchend', event => {
  if (!touchStart || event.target.closest('a,button')) return;
  const dx = event.changedTouches[0].clientX - touchStart.clientX;
  const dy = event.changedTouches[0].clientY - touchStart.clientY;
  if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.6) changeSlide(dx < 0 ? 1 : -1);
  touchStart = null;
}, { passive: true });

const desktop = window.matchMedia('(min-width: 671px)');
const nav = document.querySelector('.main-nav');
const menu = document.querySelector('.menu-toggle');
function setMenu(open) {
  nav.classList.toggle('is-open', open);
  menu.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-label', open ? 'סגירת תפריט' : 'פתיחת תפריט');
  menu.querySelector('use').setAttribute('href', open ? '#close' : '#menu');
}
menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') === 'false'));
document.addEventListener('click', event => {
  if (event.target.closest('.main-nav a') || !event.target.closest('.site-header')) setMenu(false);
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    menu.focus();
  }
});
desktop.addEventListener('change', () => setMenu(false));

const navLinks = [...nav.querySelectorAll('a')];
const sections = navLinks.map(link => document.querySelector(link.hash));
let updateId = 0;
let pointerOffset = 0;
function updateView() {
  updateId = 0;
  const marker = document.querySelector('.site-header').offsetHeight + 30;
  const atEnd = Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 2;
  let selected = 0;
  sections.forEach((section, index) => {
    if (section.getBoundingClientRect().top <= marker) selected = index;
  });
  if (atEnd) selected = sections.length - 1;
  navLinks.forEach((link, index) => {
    if (index === selected) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  if (desktop.matches && !motion.matches && window.scrollY < hero.offsetHeight) {
    scene.style.setProperty('--pan-x', pointerOffset.toFixed(1) + 'px');
    scene.style.setProperty('--pan-y', Math.min(7, window.scrollY * .035).toFixed(1) + 'px');
  }
}
function scheduleView() {
  if (!updateId) updateId = requestAnimationFrame(updateView);
}
window.addEventListener('scroll', scheduleView, {passive:true});
window.addEventListener('resize', scheduleView);
hero.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse' || motion.matches) return;
  pointerOffset = (event.clientX / window.innerWidth - .5) * 7;
  scheduleView();
});
updateView();

const details = {
  windows: {title:names[0], photo:'house', description:'חלונות ודלתות אלומיניום לבית. ספרו לשליו איזה פתח תרצו לסגור או לחדש, ואם יש לכם מידות או תמונה – אפשר לצרף אותן לשיחה.'},
  shutters: {title:names[1], photo:'shade', description:'תריסים חשמליים ורשתות נגד יתושים, כולל תיקון תריסים ורשתות קיימות. אפשר לשלוח תמונה של התריס או הרשת ולתאר את התקלה.'},
  glass: {title:names[2], photo:'glass', description:'עבודות זכוכית, מראות ומעקות לבית. לבירור לגבי העבודה, ספרו לשליו היכן תותקן הזכוכית ומהן המידות המשוערות.'}
};
const dialog = document.querySelector('.detail-dialog');
const dialogPhoto = dialog.querySelector('.dialog-photo');
const dialogLink = dialog.querySelector('.dialog-link');
function showDetail(key) {
  const entry = details[key];
  const workPhoto = key === 'work';
  dialog.classList.toggle('work-dialog', workPhoto);
  dialogPhoto.src = workPhoto ? 'assets/netanya.webp' : 'assets/' + entry.photo + '.webp';
  dialogPhoto.alt = workPhoto ? document.querySelector('.photo-zoom img').alt : 'הדמיה אדריכלית להמחשת התחום';
  dialog.querySelector('.dialog-kicker').textContent = workPhoto ? 'צילום מעמוד העסק' : 'תחום התמחות · הדמיה להמחשה';
  dialog.querySelector('#dialog-title').textContent = workPhoto ? 'חלונות ודלת במרפסת' : entry.title;
  dialog.querySelector('#dialog-description').textContent = workPhoto ? 'מסגרות אלומיניום שחורות לאורך פינת המרפסת, בשילוב דלת זכוכית.' : entry.description;
  dialogLink.textContent = workPhoto ? 'לעמוד המקורי באיזי' : 'בירור עם שליו בוואטסאפ';
  dialogLink.href = workPhoto ? 'https://easy.co.il/page/10142239' : 'https://wa.me/972533403305?text=' + encodeURIComponent('שלום שליו, אשמח לשמוע על ' + entry.title);
  dialog.showModal();
  document.body.classList.add('dialog-open');
}
document.querySelectorAll('[data-service]').forEach(button => {
  button.addEventListener('click', () => showDetail(button.dataset.service));
});
document.querySelector('.photo-zoom').addEventListener('click', () => showDetail('work'));
dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const box = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
});
dialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
