// CatPicker Modal — drop-in module with pagination
(function(){
  const PAGE_SIZE = 15; // Categories per page
  let currentPage = 1;
  let allCategories = [];
  let filteredCategories = [];
  
  const tpl = `
  <div class="catpicker-backdrop" id="catpickerBackdrop" role="dialog" aria-modal="true" aria-labelledby="catpickerTitle">
    <div class="catpicker-dialog">
      <div class="catpicker-header"><h2 class="catpicker-title" id="catpickerTitle">Pick a category</h2></div>
      <div class="catpicker-body">
        <input id="catpickerSearch" class="catpicker-search" type="text" placeholder="Search categories…" />
        <div id="catpickerList" class="catpicker-list" role="listbox" aria-label="Categories"></div>
        <div id="catpickerPager" class="catpicker-pager"></div>
      </div>
      <div class="catpicker-actions">
        <button class="catpicker-btn" id="catpickerCancel">Cancel</button>
        <button class="catpicker-btn primary" id="catpickerUse">Use category</button>
      </div>
    </div>
  </div>`;

  function ensureModal(){
    if(document.getElementById('catpickerBackdrop')) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = tpl;
    document.body.appendChild(wrap.firstElementChild);
  }

  function buildList(el, cats, picked){
    el.innerHTML = '';
    const mk = (name)=>{
      const div = document.createElement('div');
      div.className = 'catpicker-item';
      div.setAttribute('role','option');
      div.dataset.name = name;
      if(name === picked) div.setAttribute('aria-selected','true');
      const span = document.createElement('span'); span.textContent = name;
      const badge = document.createElement('span'); badge.className = 'catpicker-badge'; badge.textContent = '';
      div.appendChild(span); div.appendChild(badge);
      div.addEventListener('click', ()=>{
        const nm = (div.dataset.name||'').toLowerCase().trim();
        const isAdd = nm.startsWith('+') || nm.startsWith('➕') || nm.indexOf('add new category') !== -1;
        if (isAdd) { div.setAttribute('aria-selected','true'); try { document.getElementById('catpickerUse').click(); } catch(e) {} return; }
        document.querySelectorAll('.catpicker-item[aria-selected="true"]').forEach(x=>x.removeAttribute('aria-selected'));
        div.setAttribute('aria-selected','true');
      });
      return div;
    };
    cats.forEach(c=> el.appendChild(mk(c)));
  }

  function renderPage(page, categories, picked){
    const totalPages = Math.max(1, Math.ceil(categories.length / PAGE_SIZE));
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    currentPage = page;
    
    const start = (page - 1) * PAGE_SIZE;
    const pageItems = categories.slice(start, start + PAGE_SIZE);
    
    const list = document.getElementById('catpickerList');
    buildList(list, pageItems, picked);
    
    renderPager(totalPages, categories.length);
  }

  function renderPager(totalPages, totalItems){
    const pager = document.getElementById('catpickerPager');
    if (!pager) return;
    
    if (totalPages <= 1) {
      pager.innerHTML = '';
      return;
    }
    
    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, totalItems);
    
    let html = '<div style="display:flex;gap:8px;align-items:center;justify-content:center;margin-top:10px;">';
    html += `<button class="catpicker-page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>Prev</button>`;
    html += `<span style="font-size:14px;color:#666;">Page ${currentPage} of ${totalPages} (${start}-${end} of ${totalItems})</span>`;
    html += `<button class="catpicker-page-btn" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>`;
    html += '</div>';
    
    pager.innerHTML = html;
    
    pager.querySelectorAll('button.catpicker-page-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const page = Number(e.currentTarget.getAttribute('data-page'));
        const picked = document.querySelector('.catpicker-item[aria-selected="true"]')?.dataset.name;
        renderPage(page, filteredCategories, picked);
      });
    });
  }

  function openCategoryPicker({categories, current, onChoose}){
    ensureModal();
    const backdrop = document.getElementById('catpickerBackdrop');
    const search = document.getElementById('catpickerSearch');
    const list = document.getElementById('catpickerList');
    const btnUse = document.getElementById('catpickerUse');
    const btnCancel = document.getElementById('catpickerCancel');

    allCategories = Array.from(new Set(categories.map(c=> (c||'').trim()).filter(Boolean)));
    filteredCategories = allCategories;
    currentPage = 1;
    
    renderPage(currentPage, filteredCategories, current);

    const filter = ()=>{
      const q = search.value.toLowerCase().trim();
      filteredCategories = allCategories.filter(c=> c.toLowerCase().includes(q));
      currentPage = 1;
      const picked = document.querySelector('.catpicker-item[aria-selected="true"]')?.dataset.name || current;
      renderPage(currentPage, filteredCategories, picked);
    };
    search.oninput = filter;

    const close = ()=>{ backdrop.classList.remove('show'); search.value=''; currentPage = 1; };
    btnCancel.onclick = close;
    backdrop.onclick = (e)=>{ if(e.target===backdrop) close(); };

    btnUse.onclick = ()=>{
      const selected = (document.querySelector('.catpicker-item[aria-selected="true"]')?.dataset.name) || current;
      onChoose && onChoose(selected);
      close();
    };

    backdrop.classList.add('show');
    setTimeout(()=> search.focus(), 50);
  }

  window.SL_CatPicker = { openCategoryPicker };
})();
