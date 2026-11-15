// Two image layers only while changing posters. Videos keep their native TV plane.
const TRANSITION_MS = 800;

export function createPosterTransitions({stage}) {
  let request = 0, active = null, loading = null, preloaded = null;
  let outgoing = null, cleanupTimer = null;

  function finishTransition() {
    clearTimeout(cleanupTimer);
    cleanupTimer = null;
    if (outgoing) outgoing.remove();
    outgoing = null;
    if (active) active.classList.remove('tv-poster-entering', 'tv-poster-visible');
  }

  function cancelLoading() {
    if (!loading) return;
    loading.onload = loading.onerror = null;
    loading.removeAttribute('src');
    loading.remove();
    loading = null;
  }

  function preload(url) {
    if (url && url === preloaded?.getAttribute('src')) return;
    if (preloaded) preloaded.removeAttribute('src');
    preloaded = null;
    if (!url || url === active?.getAttribute('src')) return;
    preloaded = new Image();
    preloaded.decoding = 'async';
    preloaded.src = url;
  }

  function reset() {
    request++;
    cancelLoading();
    finishTransition();
    if (active) active.remove();
    active = null;
    preload(null);
  }

  function show(url, {onReady = () => {}, onError = () => {}} = {}) {
    const mine = ++request;
    cancelLoading();
    finishTransition();
    if (active && !stage.contains(active)) active = null;
    // Manifest refreshes and one-poster playlists should stay perfectly still.
    if (active?.getAttribute('src') === url) {onReady(); return;}
    const img = preloaded?.getAttribute('src') === url ? preloaded : new Image();
    if (img === preloaded) preloaded = null;
    img.className = 'tv-media tv-poster';
    img.alt = '';
    img.decoding = 'async';
    loading = img;
    const valid = () => mine === request && loading === img;
    const fail = () => {
      if (!valid()) return;
      img.onload = img.onerror = null;
      loading = null;
      img.remove();
      onError();
    };
    const ready = async () => {
      if (!valid()) return;
      img.onload = img.onerror = null;
      // Keep the old poster visible until the next image has actually decoded.
      if (typeof img.decode === 'function') {
        try {await img.decode();}
        catch {if (!img.complete || !img.naturalWidth) {fail(); return;}}
      }
      if (!valid()) return;
      loading = null;
      const previous = active && stage.contains(active) ? active : null;
      active = img;
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (previous && !reducedMotion) {
        outgoing = previous;
        img.classList.add('tv-poster-entering');
        stage.appendChild(img);
        // Establish the start frame even when both images came from local cache.
        img.getBoundingClientRect();
        img.classList.add('tv-poster-visible');
        cleanupTimer = setTimeout(finishTransition, TRANSITION_MS + 80);
      } else {
        stage.innerHTML = '';
        stage.appendChild(img);
      }
      onReady();
    };
    img.onload = ready;
    img.onerror = fail;
    if (img.getAttribute('src') !== url) img.src = url;
    if (img.complete) {
      if (img.naturalWidth) ready();
      else fail();
    }
  }

  return {show, preload, reset, isLoading: () => Boolean(loading)};
}
