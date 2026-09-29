(() => {
  'use strict';
  // Keep the published artwork fixed while preserving the complete exploration UI below.
  // Remove hidden from .wordmark-controls in index.html to re-enable saved choices.
  if (document.querySelector('.wordmark-controls').hidden) return;
  const mark = document.querySelector('.mark');
  const letters = '<span>Q</span><span>u</span><span>a</span><span>l</span><span>i</span><span>a</span>';
  const select = document.getElementById('wordmark-select');
  const status = document.getElementById('wordmark-status');
  const outlineToggle = document.getElementById('wordmark-outline');
  const images = ['01-sculptural','02-calligraphic','03-humanist','04-perceptual','05-fluid','10-poetic','14-closure-stencil-roman','16-interpenetrating-contour','20-scissor-cut-letters'];
  const fonts = {
    baskerville: {family: '"Qualia Baskerville PT", "Libre Baskerville", serif', weight: 400},
  };
  let request = 0;
  let outlined = false;
  try { outlined = localStorage.getItem('qualia-wordmark-outline') === 'true'; } catch {}
  outlineToggle.setAttribute('aria-pressed', String(outlined));
  const outlines = new Map();
  // Keep original artwork intact. The same filtered image drives the sky mark and water reflection.
  async function outlineSource(value, originalImage) {
    if (value === '16-interpenetrating-contour') return originalImage.src;
    if (!outlines.has(value)) outlines.set(value, (async () => {
      const response = await fetch(originalImage.src);
      if (!response.ok) throw new Error('Artwork unavailable');
      const blob = await response.blob();
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const width = originalImage.naturalWidth, height = originalImage.naturalHeight;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><filter id="edge" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="erode" radius="${width * .0035}" result="inside"/><feComposite in="SourceGraphic" in2="inside" operator="out"/></filter></defs><image width="${width}" height="${height}" href="${data}" filter="url(#edge)"/></svg>`;
      return URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
    })().catch(error => { outlines.delete(value); throw error; }));
    return outlines.get(value);
  }
  const exactBaskerville = new FontFace('Qualia Baskerville PT', 'local("Baskerville PT"), local("BaskervillePT-Regular")').load().then(font => {
    document.fonts.add(font); return true;
  }).catch(() => false);
  async function choose(value) {
    const ticket = ++request;
    const outlineMode = outlined;
    select.value = value;
    status.textContent = 'Loading…';
    try {
      let image, font = fonts[value], note = '';
      if (images.includes(value)) {
        image = new Image();
        image.alt = ''; image.setAttribute('aria-hidden', 'true');
        image.src = 'assets/wordmarks/' + value + '.png';
        await image.decode();
        if (outlineMode) {
          image.src = await outlineSource(value, image);
          await image.decode();
        }
      } else {
        if (!font) throw new Error('Unknown wordmark');
        if (value === 'baskerville' && !await exactBaskerville) note = 'Libre Baskerville preview · PT font needed';
        const family = value === 'baskerville' && note ? '"Libre Baskerville"' : font.family.split(',')[0];
        const loaded = await document.fonts.load(`${font.weight} 64px ${family}`, 'Qualia');
        if (!loaded.length) throw new Error('Font unavailable');
      }
      if (ticket !== request) return;
      mark.classList.toggle('image-mark', !!image);
      mark.classList.toggle('alternate-font', !!font);
      if (image) mark.replaceChildren(image);
      else {
        mark.innerHTML = letters;
        mark.style.fontFamily = font.family;
        mark.style.fontWeight = font.weight;
      }
      mark.dataset.wordmark = value;
      mark.dataset.outline = String(outlineMode);
      status.textContent = note;
      try {
        localStorage.setItem('qualia-wordmark', value);
        localStorage.setItem('qualia-wordmark-outline', String(outlineMode));
      } catch {}
      document.dispatchEvent(new Event('qualia:wordmark-change'));
    } catch {
      if (ticket !== request) return;
      select.value = mark.dataset.wordmark || '01-sculptural';
      outlined = mark.dataset.outline === 'true';
      outlineToggle.setAttribute('aria-pressed', String(outlined));
      status.textContent = 'Could not load that style. Please try again.';
    }
  }
  select.addEventListener('change', () => choose(select.value));
  outlineToggle.addEventListener('click', () => {
    outlined = !outlined;
    outlineToggle.setAttribute('aria-pressed', String(outlined));
    choose(select.value);
  });
  for (const button of document.querySelectorAll('[data-wordmark-step]')) button.addEventListener('click', () => {
    const index = (select.selectedIndex + Number(button.dataset.wordmarkStep) + select.options.length) % select.options.length;
    choose(select.options[index].value);
  });
  let saved;
  try { saved = localStorage.getItem('qualia-wordmark'); } catch {}
  choose(saved && (fonts[saved] || images.includes(saved)) ? saved : '01-sculptural');
})();
