// BasketWise — shared chrome + helpers for the 3 Browse page variants.

function fmt(n){ return "$" + n.toFixed(2); }

function checkIconSvg(cls){
  return `<svg class="${cls||''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
}

function renderVariantBanner(current){
  const variants = [
    { key:'a', label:'A — The Ledger Grid', href:'variant-a.html' },
    { key:'b', label:'B — The Scan List', href:'variant-b.html' },
    { key:'c', label:'C — The Split Aisle', href:'variant-c.html' },
  ];
  const links = variants.map(v =>
    `<a href="${v.href}" class="${v.key === current ? 'current' : ''}">${v.label}</a>`
  ).join('');
  return `
    <div class="variant-banner">
      <div class="variant-banner-inner">
        <span><strong>Browse page — 3 directions.</strong> Same brief, same tokens, different structure.</span>
        <nav class="variant-links"><a href="index.html">All variants</a>${links}</nav>
      </div>
    </div>
  `;
}

function renderOptionABanner(current){
  const variants = [
    { key:'a1', label:'A1 — Toolbar Grid', href:'variant-a1.html' },
    { key:'a2', label:'A2 — Compact Bar', href:'variant-a2.html' },
    { key:'a3', label:'A3 — Category-Led', href:'variant-a3.html' },
  ];
  const links = variants.map(v =>
    `<a href="${v.href}" class="${v.key === current ? 'current' : ''}">${v.label}</a>`
  ).join('');
  return `
    <div class="variant-banner">
      <div class="variant-banner-inner">
        <span><strong>Browse page — Option A, 3 executions.</strong> Category + subcategory dropdown, preferred-store filter, sort dropdown.</span>
        <nav class="variant-links"><a href="index-a.html">All 3</a>${links}</nav>
      </div>
    </div>
  `;
}

function renderHeader(){
  return `
    <header class="site-header">
      <div class="site-header-inner">
        <div class="brand">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 8h16l-1.5 11a2 2 0 0 1-2 1.7H7.5a2 2 0 0 1-2-1.7L4 8Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></svg>
          BasketWise
        </div>
        <nav class="site-nav" aria-label="Section navigation">
          <a href="#">Groceries</a>
          <a href="#">Meals</a>
          <a href="#" class="active">Compare</a>
          <a href="#">Help</a>
        </nav>
        <div class="header-right">
          <button class="icon-btn" aria-label="Search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
          <button class="icon-btn" aria-label="Account"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></button>
          <button class="basket-btn" aria-label="Open basket">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8h16l-1.5 11a2 2 0 0 1-2 1.7H7.5a2 2 0 0 1-2-1.7L4 8Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></svg>
            Basket <span class="basket-count" id="basket-count" aria-live="polite">0</span>
          </button>
        </div>
      </div>
    </header>
  `;
}

function renderFooter(){
  return `
    <footer class="site-footer">
      <div class="container">
        <p class="footer-brand serif">BasketWise</p>
        <p class="footer-note">Independent grocery price tracking across Australia. We don't take a cut from any retailer.</p>
        <div class="footer-bottom">© 2026 BasketWise Pty Ltd</div>
      </div>
    </footer>
  `;
}

function bindAddButtons(root){
  root.querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const already = btn.classList.contains('added');
      btn.classList.toggle('added');
      btn.textContent = already ? (btn.dataset.label || 'Add to cart') : 'In basket ✓';
      const countEl = document.getElementById('basket-count');
      let n = parseInt(countEl.textContent, 10);
      countEl.textContent = already ? Math.max(0, n - 1) : n + 1;
    });
  });
}

function passesSubFilter(p, sub){
  if(!sub || sub === 'All') return true;
  return p.sub === sub;
}

function passesStoreFilter(p, store){
  if(store === 'coles') return p.coles != null;
  if(store === 'woolworths') return p.woolworths != null;
  return true;
}

// "Preferred store" filter: Coles-only / Woolworths-only hides items where that
// store isn't the cheaper (or only) option, not just items it doesn't stock.
// A tie counts as preferred on both sides.
function passesPreferredStore(p, store){
  if(store === 'both') return true;
  if(store === 'coles') return p.coles != null && (p.woolworths == null || p.coles <= p.woolworths);
  if(store === 'woolworths') return p.woolworths != null && (p.coles == null || p.woolworths <= p.coles);
  return true;
}

function bestPrice(p){
  return Math.min(...[p.coles, p.woolworths].filter(v => v != null));
}

const SORT_OPTIONS = [
  { value:'name-asc', label:'Name: A–Z' },
  { value:'name-desc', label:'Name: Z–A' },
  { value:'price-asc', label:'Price: Low to High' },
  { value:'price-desc', label:'Price: High to Low' },
  { value:'savings-desc', label:'Savings: High to Low' },
  { value:'savings-asc', label:'Savings: Low to High' },
];

function savingsOf(p){
  return (p.coles != null && p.woolworths != null) ? Math.abs(p.coles - p.woolworths) : 0;
}

function sortProducts(list, sort){
  const arr = [...list];
  if(sort === 'name-desc'){
    arr.sort((a,b) => b.name.localeCompare(a.name));
  } else if(sort === 'price-asc'){
    arr.sort((a,b) => bestPrice(a) - bestPrice(b));
  } else if(sort === 'price-desc'){
    arr.sort((a,b) => bestPrice(b) - bestPrice(a));
  } else if(sort === 'savings-desc'){
    arr.sort((a,b) => savingsOf(b) - savingsOf(a));
  } else if(sort === 'savings-asc'){
    arr.sort((a,b) => savingsOf(a) - savingsOf(b));
  } else {
    // default / 'name-asc'
    arr.sort((a,b) => a.name.localeCompare(b.name));
  }
  return arr;
}

// Shared category + subcategory picker: a trigger button that opens an accordion
// panel (one category expanded at a time). Selecting a category shows all its
// items; selecting a subcategory row refines further and closes the panel.
function setupCategoryDropdown({ triggerId, panelId, labelId, getState, onSelect }){
  const trigger = document.getElementById(triggerId);
  const panel = document.getElementById(panelId);
  const label = document.getElementById(labelId);
  let expandedCat = getState().category;

  function close(){
    panel.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
  }
  function open(){
    panel.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
  }

  function renderPanel(){
    const state = getState();
    label.textContent = state.category;
    panel.innerHTML = "";
    CATEGORIES.forEach(cat => {
      const isExpanded = cat === expandedCat;
      const isActive = cat === state.category;
      const item = document.createElement('div');
      item.className = 'cat-accordion-item';

      const header = document.createElement('button');
      header.type = 'button';
      header.className = 'cat-accordion-header' + (isExpanded ? ' expanded' : '') + (isActive && !isExpanded ? ' selected' : '');
      header.innerHTML = `<span>${cat}</span>` + checkChevronSvg(isExpanded);
      header.addEventListener('click', () => {
        expandedCat = isExpanded ? null : cat;
        onSelect({ category: cat, sub: 'All' });
        renderPanel();
      });
      item.appendChild(header);

      if(isExpanded){
        const body = document.createElement('div');
        body.className = 'cat-accordion-body';
        (SUBCATEGORIES[cat] || []).forEach(sub => {
          const row = document.createElement('button');
          row.type = 'button';
          row.className = 'cat-sub-row' + (state.sub === sub && state.category === cat ? ' active' : '');
          row.textContent = sub;
          row.addEventListener('click', () => {
            onSelect({ category: cat, sub });
            close();
          });
          body.appendChild(row);
        });
        item.appendChild(body);
      }
      panel.appendChild(item);
    });
  }

  trigger.addEventListener('click', () => {
    if(panel.classList.contains('open')){ close(); } else { renderPanel(); open(); }
  });
  document.addEventListener('click', (e) => {
    if(!panel.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)){
      close();
    }
  });

  return { refreshLabel(){ label.textContent = getState().category; }, syncExpanded(){ expandedCat = getState().category; } };
}

// Permanent category + subcategory sidebar — no trigger, no popup, always rendered.
// Clicking a category header selects it and expands/collapses its subcategory
// accordion in place; clicking a subcategory row refines and stays open.
function setupCategorySidebar({ containerId, getState, onSelect }){
  const container = document.getElementById(containerId);
  let expandedCat = getState().category;

  function render(){
    const state = getState();
    container.innerHTML = "";
    CATEGORIES.forEach(cat => {
      const isExpanded = cat === expandedCat;
      const isActive = cat === state.category;
      const itemCount = (PRODUCTS[cat] || []).length;
      const isEmpty = itemCount === 0;
      const item = document.createElement('div');
      item.className = 'cat-accordion-item';

      const header = document.createElement('button');
      header.type = 'button';
      header.className = 'cat-accordion-header'
        + (isExpanded ? ' expanded' : '')
        + (isActive && !isExpanded ? ' selected' : '')
        + (isEmpty ? ' empty' : '');
      header.setAttribute('aria-expanded', String(isExpanded));
      header.setAttribute('aria-selected', String(isActive));
      const countBadge = isEmpty ? `<span class="cat-count">No items yet</span>` : '';
      header.innerHTML = `<span class="cat-label-row"><span>${cat}</span>${countBadge}</span>` + checkChevronSvg(isExpanded);
      header.addEventListener('click', () => {
        const current = getState();
        const switchingCategory = cat !== current.category;
        expandedCat = isExpanded ? null : cat;
        if(switchingCategory){
          onSelect({ category: cat, sub: 'All' });
        }
        render();
      });
      item.appendChild(header);

      if(isExpanded){
        const body = document.createElement('div');
        body.className = 'cat-accordion-body';
        (SUBCATEGORIES[cat] || []).forEach(sub => {
          const row = document.createElement('button');
          row.type = 'button';
          row.className = 'cat-sub-row' + (state.sub === sub && state.category === cat ? ' active' : '');
          row.textContent = sub;
          row.addEventListener('click', () => {
            onSelect({ category: cat, sub });
            render();
          });
          body.appendChild(row);
        });
        item.appendChild(body);
      }
      container.appendChild(item);
    });
  }

  render();
  return { refresh: render };
}

function checkChevronSvg(expanded){
  return `<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transform:rotate(${expanded ? 180 : 0}deg)"><path d="M6 9l6 6 6-6"/></svg>`;
}

function setupSortDropdown({ triggerId, panelId, labelId, getState, onSelect }){
  const trigger = document.getElementById(triggerId);
  const panel = document.getElementById(panelId);
  const label = document.getElementById(labelId);

  function close(){ panel.classList.remove('open'); trigger.setAttribute('aria-expanded', 'false'); }
  function open(){ panel.classList.add('open'); trigger.setAttribute('aria-expanded', 'true'); }

  function renderPanel(){
    const state = getState();
    const current = SORT_OPTIONS.find(o => o.value === state.sort);
    label.textContent = current ? current.label : SORT_OPTIONS[0].label;
    panel.innerHTML = "";
    SORT_OPTIONS.forEach(opt => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'sort-option-row' + (opt.value === state.sort ? ' active' : '');
      row.textContent = opt.label;
      row.addEventListener('click', () => { onSelect(opt.value); close(); renderPanel(); });
      panel.appendChild(row);
    });
  }

  trigger.addEventListener('click', () => {
    if(panel.classList.contains('open')){ close(); } else { renderPanel(); open(); }
  });
  document.addEventListener('click', (e) => {
    if(!panel.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)){
      close();
    }
  });

  renderPanel();
  return { refresh: renderPanel };
}
