/* Système B : application (JavaScript simple, sans framework) */
(() => {
  'use strict';

  // ---------------------------------------------------------------
  // Types d'éléments. Pour en ajouter un : ajoute simplement une ligne ici.
  // ---------------------------------------------------------------
  const TYPES = {
    note:      { label: 'Note',      statuses: [] },
    savoir:    { label: 'Savoir',    statuses: [] },
    recette:   { label: 'Recette',   statuses: ['À essayer', 'Testée', 'Favorite'] },
    film:      { label: 'Film',      statuses: ['À voir', 'Vu'],              rated: true },
    serie:     { label: 'Série',     statuses: ['À voir', 'En cours', 'Vue'], rated: true },
    livre:     { label: 'Livre',     statuses: ['À lire', 'En cours', 'Lu'],  rated: true },
    cadeau:    { label: 'Cadeau',    statuses: ['Idée', 'Acheté', 'Offert'] },
    tache:     { label: 'Tâche',     statuses: ['À faire', 'En cours', 'Fait'] },
    objectif:  { label: 'Objectif',  statuses: ['En cours', 'Atteint', 'Abandonné'] },
    evenement: { label: 'Événement', statuses: [] },
  };
  // Statuts « terminés » : pas de compte à rebours pour ces éléments.
  const DONE = new Set(['Vu', 'Vue', 'Lu', 'Fait', 'Atteint', 'Offert', 'Abandonné', 'Testée', 'Favorite']);

  const BUCKET = 'images';
  const CACHE_KEY = 'systeme-b-items-v1';

  // ---------------------------------------------------------------
  // Utilitaires
  // ---------------------------------------------------------------
  const $ = (sel) => document.querySelector(sel);

  function el(tag, props = {}, ...kids) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v === false || v == null) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null) node.append(kid);
    return node;
  }

  const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const parseTags = (s) => [...new Set(
    s.split(',').map((t) => t.trim().replace(/^#/, '').toLowerCase()).filter(Boolean)
  )];
  const typeLabel = (t) => (TYPES[t] ? TYPES[t].label : t);

  let toastTimer;
  function toast(message, bad = false) {
    const t = $('#toast');
    t.textContent = message;
    t.className = bad ? 'bad' : '';
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, bad ? 4500 : 2200);
  }
  const errMsg = (e) => (e && (e.message || e.error_description)) || 'Une erreur est survenue';

  function daysUntil(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + 'T00:00:00');
    return Math.round((target - today) / 86400000);
  }
  function countdownLabel(item) {
    if (!item.event_date || DONE.has(item.status)) return null;
    const d = daysUntil(item.event_date);
    if (d === 0) return "Aujourd'hui";
    if (d > 0) return 'J-' + d;
    return 'Il y a ' + Math.abs(d) + ' j';
  }
  const formatDate = (d) =>
    new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

  // ---------------------------------------------------------------
  // État
  // ---------------------------------------------------------------
  const cfg = window.SB_CONFIG || {};
  let sb = null;
  let userId = null;
  let items = [];
  let filterType = 'all';
  let filterTag = null;
  let query = '';
  const imgCache = new Map(); // chemin -> URL signée

  // Fiche
  let editing = null;
  let formRating = null;
  let pendingImage = null;
  let removeImage = false;
  let previewObjectUrl = null;

  // ---------------------------------------------------------------
  // Démarrage
  // ---------------------------------------------------------------
  async function boot() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }

    const configured = cfg.url && cfg.anonKey && !/COLLE_ICI/.test(cfg.url + cfg.anonKey);
    if (!configured || !window.supabase) {
      $('#setup').hidden = false;
      return;
    }

    sb = window.supabase.createClient(cfg.url, cfg.anonKey);
    bindUi();

    const { data } = await sb.auth.getSession();
    if (data.session) startApp(data.session);
    else showAuth();

    sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') showAuth();
    });
  }

  function showAuth() {
    userId = null;
    items = [];
    $('#app').hidden = true;
    $('#auth').hidden = false;
  }

  async function startApp(session) {
    userId = session.user.id;
    $('#auth').hidden = true;
    $('#app').hidden = false;

    // Affichage immédiat depuis le cache, puis rafraîchissement
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached && cached.userId === userId) { items = cached.items; render(); }
    } catch (_) { /* cache illisible : on l'ignore */ }

    await loadItems();
  }

  async function loadItems() {
    const { data, error } = await sb
      .from('items')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error) {
      toast(items.length ? 'Hors ligne : données en cache' : errMsg(error), true);
      return;
    }
    items = data;
    cacheItems();
    render();
  }

  function cacheItems() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ userId, items })); } catch (_) { /* quota */ }
  }

  // ---------------------------------------------------------------
  // Affichage
  // ---------------------------------------------------------------
  function visibleItems() {
    const words = norm(query).trim().split(/\s+/).filter(Boolean);
    return items.filter((it) => {
      if (filterType !== 'all' && it.type !== filterType) return false;
      if (filterTag && !(it.tags || []).includes(filterTag)) return false;
      if (!words.length) return true;
      const hay = norm([it.title, it.content, it.url, it.status, (it.tags || []).join(' ')].join(' '));
      return words.every((w) => hay.includes(w));
    });
  }

  function render() {
    renderTypeChips();
    renderTagChips();
    renderList();
  }

  function renderTypeChips() {
    const counts = {};
    for (const it of items) counts[it.type] = (counts[it.type] || 0) + 1;
    const nav = $('#types');
    nav.replaceChildren(
      chip('Tout', items.length, filterType === 'all', () => { filterType = 'all'; filterTag = null; render(); }),
      ...Object.keys(counts)
        .sort((a, b) => typeLabel(a).localeCompare(typeLabel(b), 'fr'))
        .map((t) => chip(typeLabel(t), counts[t], filterType === t, () => {
          filterType = t; filterTag = null; render();
        }))
    );
  }

  function renderTagChips() {
    const counts = {};
    for (const it of items) {
      if (filterType !== 'all' && it.type !== filterType) continue;
      for (const t of it.tags || []) counts[t] = (counts[t] || 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr')).slice(0, 40);
    $('#tags').replaceChildren(
      ...top.map(([t, n]) => chip('#' + t, n, filterTag === t, () => {
        filterTag = filterTag === t ? null : t;
        render();
      }))
    );
  }

  function chip(label, count, active, onclick) {
    return el('button', { type: 'button', class: 'chip' + (active ? ' active' : ''), onclick },
      label, el('span', { class: 'count', text: String(count) }));
  }

  function renderList() {
    const list = $('#list');
    const shown = visibleItems();
    if (!shown.length) {
      list.replaceChildren(el('p', {
        class: 'empty',
        text: items.length ? 'Aucun résultat.' : 'Rien ici pour l’instant. Appuie sur + pour ajouter ton premier élément.',
      }));
      return;
    }
    list.replaceChildren(...shown.map(cardFor));
    hydrateImages(shown);
  }

  function cardFor(it) {
    const countdown = countdownLabel(it);
    const meta = [
      el('span', { text: typeLabel(it.type) }),
      it.status ? el('span', { text: it.status }) : null,
      it.event_date ? el('span', { text: formatDate(it.event_date) }) : null,
      countdown ? el('span', { class: 'badge', text: countdown }) : null,
      it.rating ? el('span', { class: 'stars-inline', text: '★'.repeat(it.rating) }) : null,
    ];
    const excerpt = (it.content || '').trim();
    const body = el('div', { class: 'card-body' },
      el('div', { class: 'card-title', text: it.title }),
      el('div', { class: 'card-meta' }, meta),
      excerpt ? el('div', { class: 'card-excerpt', text: excerpt.length > 140 ? excerpt.slice(0, 140) + '…' : excerpt }) : null,
      (it.tags || []).length
        ? el('div', { class: 'card-tags' }, it.tags.map((t) => el('span', { class: 'tag', text: '#' + t })))
        : null
    );
    const thumb = it.image_path ? el('img', { class: 'card-thumb', alt: '', 'data-path': it.image_path, loading: 'lazy' }) : null;
    return el('button', { type: 'button', class: 'card', onclick: () => openSheet(it) }, body, thumb);
  }

  async function signedUrls(paths) {
    const missing = paths.filter((p) => !imgCache.has(p));
    if (missing.length) {
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(missing, 6 * 3600);
      if (!error && data) for (const d of data) if (d.signedUrl) imgCache.set(d.path, d.signedUrl);
    }
  }

  async function hydrateImages(shown) {
    const paths = [...new Set(shown.map((i) => i.image_path).filter(Boolean))];
    if (!paths.length) return;
    await signedUrls(paths);
    document.querySelectorAll('img[data-path]').forEach((img) => {
      const url = imgCache.get(img.getAttribute('data-path'));
      if (url) img.src = url;
    });
  }

  // ---------------------------------------------------------------
  // Fiche (ajout / modification)
  // ---------------------------------------------------------------
  function fillStatusOptions(type, current) {
    const sel = $('#f-status');
    const statuses = (TYPES[type] && TYPES[type].statuses) || [];
    sel.replaceChildren(el('option', { value: '', text: '—' }),
      ...statuses.map((s) => el('option', { value: s, text: s })));
    sel.value = statuses.includes(current) ? current : '';
    $('#f-status-wrap').hidden = !statuses.length;
  }

  function renderStars() {
    const box = $('#f-rating');
    box.replaceChildren(...[1, 2, 3, 4, 5].map((n) =>
      el('button', {
        type: 'button',
        class: n <= (formRating || 0) ? 'on' : '',
        'aria-label': n + ' sur 5',
        text: '★',
        onclick: () => { formRating = formRating === n ? null : n; renderStars(); },
      })));
  }

  function updateTypeDependentFields() {
    const type = $('#f-type').value;
    fillStatusOptions(type, $('#f-status').value);
    $('#f-rating-wrap').hidden = !(TYPES[type] && TYPES[type].rated);
  }

  function showImagePreview(url) {
    const box = $('#f-image-preview');
    if (!url) { box.hidden = true; return; }
    $('#f-image-img').src = url;
    box.hidden = false;
  }

  async function openSheet(item) {
    editing = item || null;
    pendingImage = null;
    removeImage = false;
    if (previewObjectUrl) { URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = null; }

    $('#sheet-title').textContent = item ? 'Modifier' : 'Nouvel élément';
    $('#f-delete').hidden = !item;

    const typeSel = $('#f-type');
    typeSel.replaceChildren(...Object.entries(TYPES).map(([k, v]) => el('option', { value: k, text: v.label })));
    // Un type inconnu (ajouté plus tard à la base) reste modifiable
    if (item && !TYPES[item.type]) typeSel.append(el('option', { value: item.type, text: item.type }));
    typeSel.value = item ? item.type : (filterType !== 'all' && TYPES[filterType] ? filterType : 'note');

    fillStatusOptions(typeSel.value, item && item.status);
    $('#f-rating-wrap').hidden = !(TYPES[typeSel.value] && TYPES[typeSel.value].rated);
    formRating = item ? item.rating : null;
    renderStars();

    $('#f-title').value = item ? item.title : '';
    $('#f-tags').value = item ? (item.tags || []).join(', ') : (filterTag || '');
    $('#f-content').value = item ? (item.content || '') : '';
    $('#f-date').value = item && item.event_date ? item.event_date : '';
    $('#f-url').value = item ? (item.url || '') : '';
    $('#f-image').value = '';

    const allTags = [...new Set(items.flatMap((i) => i.tags || []))].sort((a, b) => a.localeCompare(b, 'fr'));
    $('#tag-suggestions').replaceChildren(...allTags.map((t) => el('option', { value: t })));

    showImagePreview(null);
    $('#sheet-backdrop').hidden = false;
    document.body.style.overflow = 'hidden';

    if (item && item.image_path) {
      await signedUrls([item.image_path]);
      if (editing === item && !pendingImage && !removeImage) showImagePreview(imgCache.get(item.image_path));
    }
    if (!item) $('#f-title').focus();
  }

  function closeSheet() {
    $('#sheet-backdrop').hidden = true;
    document.body.style.overflow = '';
    editing = null;
    if (previewObjectUrl) { URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = null; }
  }

  async function shrinkImage(file, max = 1600) {
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
      return blob || file;
    } catch (_) {
      return file; // format non lisible par le navigateur : on envoie tel quel
    }
  }

  function setBusy(busy) {
    const btn = $('#f-save');
    btn.disabled = busy;
    btn.textContent = busy ? 'Enregistrement…' : 'Enregistrer';
  }

  async function saveItem(ev) {
    ev.preventDefault();
    const title = $('#f-title').value.trim();
    if (!title) return;

    setBusy(true);
    try {
      const oldPath = editing ? editing.image_path : null;
      let imagePath = removeImage ? null : oldPath;

      if (pendingImage) {
        const isJpeg = pendingImage.type === 'image/jpeg';
        const path = userId + '/' + crypto.randomUUID() + (isJpeg ? '.jpg' : '.bin');
        const { error } = await sb.storage.from(BUCKET).upload(path, pendingImage, {
          contentType: pendingImage.type || 'application/octet-stream',
        });
        if (error) throw error;
        imagePath = path;
      }

      const type = $('#f-type').value;
      const rated = TYPES[type] && TYPES[type].rated;
      const payload = {
        type,
        title,
        content: $('#f-content').value.trim() || null,
        url: $('#f-url').value.trim() || null,
        status: $('#f-status').value || null,
        rating: rated ? formRating : null,
        event_date: $('#f-date').value || null,
        tags: parseTags($('#f-tags').value),
        image_path: imagePath,
      };

      const q = sb.from('items');
      const { data, error } = editing
        ? await q.update(payload).eq('id', editing.id).select().single()
        : await q.insert(payload).select().single();
      if (error) throw error;

      if (oldPath && oldPath !== imagePath) sb.storage.from(BUCKET).remove([oldPath]);

      const idx = items.findIndex((i) => i.id === data.id);
      if (idx >= 0) items[idx] = data; else items.unshift(data);
      cacheItems();
      closeSheet();
      render();
      toast('Enregistré');
    } catch (e) {
      toast(errMsg(e), true);
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem() {
    if (!editing) return;
    if (!confirm('Supprimer « ' + editing.title + ' » ? Cette action est définitive.')) return;
    const target = editing;
    const { error } = await sb.from('items').delete().eq('id', target.id);
    if (error) { toast(errMsg(error), true); return; }
    if (target.image_path) sb.storage.from(BUCKET).remove([target.image_path]);
    items = items.filter((i) => i.id !== target.id);
    cacheItems();
    closeSheet();
    render();
    toast('Supprimé');
  }

  // ---------------------------------------------------------------
  // Branchements
  // ---------------------------------------------------------------
  function bindUi() {
    $('#auth-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const err = $('#auth-error');
      err.hidden = true;
      const { data, error } = await sb.auth.signInWithPassword({
        email: $('#auth-email').value.trim(),
        password: $('#auth-password').value,
      });
      if (error) {
        err.textContent = 'Connexion impossible : ' + errMsg(error);
        err.hidden = false;
        return;
      }
      $('#auth-password').value = '';
      startApp(data.session);
    });

    $('#btn-logout').addEventListener('click', () => sb.auth.signOut());

    $('#q').addEventListener('input', (ev) => { query = ev.target.value; renderList(); });
    $('#fab').addEventListener('click', () => openSheet(null));

    $('#sheet').addEventListener('submit', saveItem);
    $('#sheet-close').addEventListener('click', closeSheet);
    $('#sheet-backdrop').addEventListener('click', (ev) => { if (ev.target.id === 'sheet-backdrop') closeSheet(); });
    $('#f-delete').addEventListener('click', deleteItem);
    $('#f-type').addEventListener('change', updateTypeDependentFields);

    $('#f-image').addEventListener('change', async (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      pendingImage = await shrinkImage(file);
      removeImage = false;
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = URL.createObjectURL(pendingImage);
      showImagePreview(previewObjectUrl);
    });
    $('#f-image-remove').addEventListener('click', () => {
      pendingImage = null;
      removeImage = true;
      $('#f-image').value = '';
      showImagePreview(null);
    });

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !$('#sheet-backdrop').hidden) closeSheet();
    });
  }

  boot();
})();
