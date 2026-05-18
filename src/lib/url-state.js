const VERSION = '1';

export function encodeStateToUrl(state) {
  try {
    const payload = { v: VERSION, s: state };
    const json = JSON.stringify(payload);
    const b64 = typeof btoa !== 'undefined' ? btoa(unescape(encodeURIComponent(json))) : '';
    const url = new URL(window.location.href);
    url.searchParams.set('s', b64);
    window.history.replaceState({}, '', url.toString());
  } catch (err) {
    console.warn('Failed to encode state to URL:', err);
  }
}

export function decodeStateFromUrl() {
  try {
    const url = new URL(window.location.href);
    const b64 = url.searchParams.get('s');
    if (!b64) return null;
    const json = decodeURIComponent(escape(atob(b64)));
    const payload = JSON.parse(json);
    if (!payload || payload.v !== VERSION) return null;
    return payload.s;
  } catch (err) {
    console.warn('Failed to decode state from URL:', err);
    return null;
  }
}

export function clearUrlState() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('s');
    window.history.replaceState({}, '', url.toString());
  } catch (_) {}
}
