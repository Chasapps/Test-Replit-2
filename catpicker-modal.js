/* ============================================
   CATEGORY PICKER MODAL - Educational Version with Pagination
   ============================================
   
   WHAT THIS FILE DOES:
   This file creates a reusable modal (popup window) that helps users
   pick a category for their transactions. It includes:
   - Search functionality to filter categories
   - Pagination to navigate through many categories
   - Click-to-select interface
   - "Add new category" option
   
   KEY CONCEPTS FOR BEGINNERS:
   - IIFE (Immediately Invoked Function Expression): The (function(){...})() pattern
     keeps our code private and doesn't pollute the global scope
   - Template literals: The `backtick strings` that can span multiple lines
   - Event listeners: Functions that run when users click, type, etc.
   - DOM manipulation: Creating and modifying HTML elements with JavaScript
   
   ============================================ */

(function(){
  
  // ============================================
  // CONFIGURATION - Adjust these to change behavior
  // ============================================
  
  // How many categories to show per page
  const ITEMS_PER_PAGE = 10;
  
  
  // ============================================
  // HTML TEMPLATE - The modal structure
  // ============================================
  
  /*
    This is the HTML structure for our modal, stored as a string.
    We use a template literal (backticks) so it can span multiple lines.
    
    ACCESSIBILITY FEATURES:
    - role="dialog" tells screen readers this is a modal
    - aria-modal="true" indicates it's a modal dialog
    - aria-labelledby links to the title for screen readers
    - role="listbox" makes the category list accessible
  */
  const tpl = `
  <div class="catpicker-backdrop" id="catpickerBackdrop" role="dialog" aria-modal="true" aria-labelledby="catpickerTitle">
    <div class="catpicker-dialog">
      
      <!-- Header section with title -->
      <div class="catpicker-header">
        <h2 class="catpicker-title" id="catpickerTitle">Pick a category</h2>
      </div>
      
      <!-- Body section with search and list -->
      <div class="catpicker-body">
        <!-- Search input to filter categories -->
        <input id="catpickerSearch" class="catpicker-search" type="text" placeholder="Search categories…" />
        
        <!-- Container where category items will be displayed -->
        <div id="catpickerList" class="catpicker-list" role="listbox" aria-label="Categories"></div>
      </div>
      
      <!-- NEW: Pagination controls -->
      <div class="catpicker-pagination" id="catpickerPagination">
        <!-- Buttons will be inserted here by JavaScript -->
      </div>
      
      <!-- Footer section with action buttons -->
      <div class="catpicker-actions">
        <button class="catpicker-btn" id="catpickerCancel">Cancel</button>
        <button class="catpicker-btn primary" id="catpickerUse">Use category</button>
      </div>
      
    </div>
  </div>`;
  
  
  // ============================================
  // HELPER FUNCTION: Ensure modal exists in the page
  // ============================================
  
  /*
    This function checks if the modal HTML already exists in the page.
    If not, it creates it. This is called "lazy initialization" - we only
    create the modal when it's first needed, not when the page loads.
    
    HOW IT WORKS:
    1. Check if backdrop element already exists using getElementById
    2. If it exists, return early (do nothing)
    3. If not, create a temporary div wrapper
    4. Set its innerHTML to our template
    5. Append the first child (the backdrop) to the document body
  */
  function ensureModal(){
    // getElementById returns null if element doesn't exist
    if(document.getElementById('catpickerBackdrop')) return;
    
    // Create a temporary wrapper element
    const wrap = document.createElement('div');
    
    // Set its HTML content to our template
    wrap.innerHTML = tpl;
    
    // Append the first element child (the backdrop div) to the page body
    document.body.appendChild(wrap.firstElementChild);
  }
  
  
  // ============================================
  // STATE MANAGEMENT: Track current page
  // ============================================
  
  /*
    These variables keep track of the current state of our modal.
    They're declared with 'let' (not 'const') because we'll change
    them as the user navigates between pages.
  */
  let currentPage = 1;           // Which page we're currently on (starts at 1)
  let currentCategories = [];    // The full list of categories to display
  let currentSelected = null;    // The currently selected category name
  
  
  // ============================================
  // CORE FUNCTION: Build the category list
  // ============================================
  
  /*
    This function creates the HTML elements for each category and
    adds them to the list container. It's the heart of the modal!
    
    PARAMETERS:
    - el: The DOM element where we'll add the categories
    - cats: Array of category names to display
    - picked: The currently selected category (to highlight it)
    - page: Which page to show (default: 1)
    
    PAGINATION LOGIC:
    - Calculate start and end indexes based on page number
    - Only show a subset of categories (one page worth)
  */
  function buildList(el, cats, picked, page = 1){
    // Clear any existing content in the list
    el.innerHTML = '';
    
    // ===== PAGINATION CALCULATION =====
    
    // Calculate how many pages we need total
    // Math.ceil rounds UP (e.g., 25 items ÷ 10 per page = 3 pages)
    const totalPages = Math.max(1, Math.ceil(cats.length / ITEMS_PER_PAGE));
    
    // Make sure we don't go beyond available pages
    if (page > totalPages) page = totalPages;
    if (page < 1) page = 1;
    
    // Calculate which categories to show
    // Example: Page 2 with 10 items per page starts at index 10
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    
    // Get just the categories for this page using array.slice()
    // slice(10, 20) gets items from index 10 to 19 (20 is not included)
    const pageCategories = cats.slice(startIndex, endIndex);
    
    
    // ===== CREATE CATEGORY ELEMENTS =====
    
    /*
      This inner function creates one category item element.
      We define it inside buildList so it has access to 'picked'
      and can update the selected state.
      
      ARROW FUNCTION SYNTAX:
      const mk = (name) => {...}
      is the same as:
      function mk(name) {...}
      But arrow functions are more concise!
    */
    const mk = (name) => {
      // Create a new div element for this category
      const div = document.createElement('div');
      
      // Add CSS class for styling
      div.className = 'catpicker-item';
      
      // Add ARIA role for accessibility
      div.setAttribute('role', 'option');
      
      // Store the category name in a data attribute for easy retrieval
      // data-* attributes let us store custom data on elements
      div.dataset.name = name;
      
      // If this category is the currently selected one, mark it
      if(name === picked) div.setAttribute('aria-selected', 'true');
      
      // Create a span for the category name text
      const span = document.createElement('span');
      span.textContent = name;
      
      // Create a badge element (currently empty, but could show counts)
      const badge = document.createElement('span');
      badge.className = 'catpicker-badge';
      badge.textContent = '';
      
      // Add both elements to the div
      div.appendChild(span);
      div.appendChild(badge);
      
      
      // ===== ADD CLICK HANDLER =====
      
      /*
        When user clicks this category item, this function runs.
        
        EVENT LISTENERS:
        addEventListener('click', function) tells the browser:
        "When this element is clicked, run this function"
      */
      div.addEventListener('click', () => {
        // Get the category name, convert to lowercase and trim whitespace
        const nm = (div.dataset.name || '').toLowerCase().trim();
        
        // Check if this is the special "Add new category" option
        // We check for multiple patterns users might use
        const isAdd = nm.startsWith('+') || 
                      nm.startsWith('➕') || 
                      nm.indexOf('add new category') !== -1;
        
        if (isAdd) {
          // If it's "add new", mark it as selected and auto-click "Use"
          div.setAttribute('aria-selected', 'true');
          try { 
            document.getElementById('catpickerUse').click(); 
          } catch(e) {
            // If something goes wrong, fail silently
          }
          return; // Exit early, don't do the normal selection logic
        }
        
        // DESELECT ALL OTHER ITEMS FIRST
        // querySelectorAll finds all matching elements
        // forEach loops through them
        document.querySelectorAll('.catpicker-item[aria-selected="true"]').forEach(x => {
          x.removeAttribute('aria-selected');
        });
        
        // SELECT THIS ITEM
        div.setAttribute('aria-selected', 'true');
      });
      
      // Return the completed div element
      return div;
    };
    
    // ===== ADD ALL CATEGORY ITEMS TO THE LIST =====
    
    /*
      forEach is an array method that runs a function for each item.
      For each category name, we create an element and append it.
      
      WHAT append() DOES:
      appendChild() adds an element as the last child of a parent.
      It physically moves the element into the DOM tree.
    */
    pageCategories.forEach(c => el.appendChild(mk(c)));
    
    
    // ===== RENDER PAGINATION CONTROLS =====
    renderPagination(totalPages, page, cats, picked);
  }
  
  
  // ============================================
  // PAGINATION: Render page navigation controls
  // ============================================
  
  /*
    This function creates the Previous/Next buttons and page numbers
    at the bottom of the modal.
    
    PARAMETERS:
    - totalPages: How many pages exist total
    - currentPage: Which page we're on now
    - allCategories: Full array of categories
    - selectedCat: Currently selected category name
  */
  function renderPagination(totalPages, currentPage, allCategories, selectedCat) {
    // Get the pagination container element
    const paginationEl = document.getElementById('catpickerPagination');
    if (!paginationEl) return; // Exit if element doesn't exist
    
    // If there's only 1 page (or no categories), hide pagination
    if (totalPages <= 1) {
      paginationEl.innerHTML = '';
      paginationEl.style.display = 'none';
      return;
    }
    
    // Show pagination (it might have been hidden before)
    paginationEl.style.display = '';
    
    
    // ===== BUILD PAGINATION HTML =====
    
    let html = '';
    
    // PREVIOUS BUTTON
    // disabled attribute prevents clicking if we're on first page
    // We store the page number in data-page for the click handler
    const prevDisabled = currentPage === 1 ? 'disabled' : '';
    html += `<button data-page="${currentPage - 1}" ${prevDisabled}>Previous</button>`;
    
    
    // PAGE NUMBER BUTTONS
    /*
      We show up to 5 page numbers at a time, centered around current page.
      Example: If on page 7 of 20, we might show: 5 6 [7] 8 9
      
      This prevents having too many buttons when there are 100s of pages.
    */
    const maxButtons = 5; // Maximum page buttons to show
    
    // Calculate the range of pages to show
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    
    // Adjust start if we're near the end
    // This keeps 5 buttons visible when possible
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }
    
    // Create a button for each page number
    for (let p = startPage; p <= endPage; p++) {
      // Add 'active' class to highlight the current page
      const activeClass = p === currentPage ? 'active' : '';
      html += `<button class="${activeClass}" data-page="${p}">${p}</button>`;
    }
    
    
    // NEXT BUTTON
    const nextDisabled = currentPage === totalPages ? 'disabled' : '';
    html += `<button data-page="${currentPage + 1}" ${nextDisabled}>Next</button>`;
    
    
    // PAGE INFO TEXT
    // Shows "Page 2 of 5" for context
    html += `<span class="catpicker-page-info">Page ${currentPage} of ${totalPages}</span>`;
    
    
    // Insert the HTML into the pagination container
    paginationEl.innerHTML = html;
    
    
    // ===== ADD CLICK HANDLERS TO ALL BUTTONS =====
    
    /*
      We need to add event listeners to each button we just created.
      querySelectorAll gets all buttons inside the pagination element.
      
      EVENT DELEGATION ALTERNATIVE:
      We could also use event delegation (one listener on the parent),
      but individual listeners are clearer for learning.
    */
    paginationEl.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        // Get the target page number from data-page attribute
        const targetPage = Number(e.currentTarget.dataset.page);
        
        // Ignore clicks on disabled buttons or invalid pages
        if (!targetPage || targetPage < 1 || targetPage > totalPages) return;
        
        // Get references to the list container and search input
        const list = document.getElementById('catpickerList');
        const search = document.getElementById('catpickerSearch');
        
        // Filter categories by current search query
        const query = search ? search.value.toLowerCase().trim() : '';
        const filtered = query 
          ? allCategories.filter(c => c.toLowerCase().includes(query))
          : allCategories;
        
        // Rebuild the list with the new page
        buildList(list, filtered, selectedCat, targetPage);
      });
    });
  }
  
  
  // ============================================
  // MAIN FUNCTION: Open the category picker modal
  // ============================================
  
  /*
    This is the main function that external code calls to show the modal.
    It's exposed at the end via window.SL_CatPicker
    
    PARAMETERS (passed as an object for clarity):
    - categories: Array of category names to choose from
    - current: The currently selected category (to highlight it)
    - onChoose: Callback function to run when user picks a category
    
    CALLBACK PATTERN:
    onChoose is a function passed as a parameter. When the user confirms
    their choice, we call onChoose(selectedCategory). This is called a
    "callback" because we call it back to notify the caller.
  */
  function openCategoryPicker({categories, current, onChoose}){
    // Make sure the modal HTML exists in the page
    ensureModal();
    
    
    // ===== GET REFERENCES TO DOM ELEMENTS =====
    
    /*
      getElementById is the fastest way to get an element.
      We store references in variables so we don't have to keep
      calling getElementById repeatedly.
    */
    const backdrop = document.getElementById('catpickerBackdrop');
    const search = document.getElementById('catpickerSearch');
    const list = document.getElementById('catpickerList');
    const btnUse = document.getElementById('catpickerUse');
    const btnCancel = document.getElementById('catpickerCancel');
    
    
    // ===== PREPARE CATEGORY LIST =====
    
    /*
      REMOVE DUPLICATES:
      new Set() creates a Set, which automatically removes duplicates
      Array.from() converts it back to an array
      
      CLEAN UP DATA:
      .map(c => (c||'').trim()) ensures each item is a string and trimmed
      .filter(Boolean) removes empty strings
      
      CHAINING:
      These methods are chained together. The output of one becomes
      the input of the next. This is a common pattern in JavaScript!
    */
    const uniq = Array.from(
      new Set(
        categories.map(c => (c || '').trim()).filter(Boolean)
      )
    );
    
    // Store in module-level variable so pagination can access it
    currentCategories = uniq;
    currentSelected = current;
    currentPage = 1; // Reset to first page when opening
    
    
    // ===== BUILD INITIAL CATEGORY LIST =====
    
    // Start on page 1
    buildList(list, uniq, current, 1);
    
    
    // ===== SEARCH/FILTER FUNCTIONALITY =====
    
    /*
      This function runs every time the user types in the search box.
      It filters the categories and rebuilds the list.
      
      REAL-TIME FILTERING:
      The 'oninput' event fires as the user types, giving instant feedback.
      Modern websites use this pattern extensively!
    */
    const filter = () => {
      // Get the search query and normalize it (lowercase, trimmed)
      const q = search.value.toLowerCase().trim();
      
      // Filter the categories: keep only ones that include the search term
      // .includes() checks if a string contains another string
      const filtered = uniq.filter(c => c.toLowerCase().includes(q));
      
      // Get the currently selected category (might have changed since opening)
      const currentlySelected = (
        document.querySelector('.catpicker-item[aria-selected="true"]')?.dataset.name
      ) || current;
      
      // Rebuild list with filtered categories, starting at page 1
      buildList(list, filtered, currentlySelected, 1);
    };
    
    // Attach the filter function to the search input
    // Every time user types, filter() runs
    search.oninput = filter;
    
    
    // ===== CLOSE MODAL FUNCTION =====
    
    /*
      This helper function closes the modal and cleans up.
      We define it here so both Cancel button and backdrop can use it.
      
      CLEANUP:
      It's important to reset the search box so the modal starts
      fresh next time it opens.
    */
    const close = () => {
      // Remove 'show' class to hide the modal (CSS handles the hiding)
      backdrop.classList.remove('show');
      
      // Clear the search box
      search.value = '';
      
      // Reset pagination state
      currentPage = 1;
    };
    
    
    // ===== CANCEL BUTTON =====
    
    // When Cancel is clicked, just close the modal without doing anything
    btnCancel.onclick = close;
    
    
    // ===== CLICK OUTSIDE TO CLOSE =====
    
    /*
      This allows users to close the modal by clicking the dark backdrop
      behind it. This is a common UX pattern.
      
      e.target is the element that was actually clicked.
      If user clicks the backdrop itself (not the dialog), close.
    */
    backdrop.onclick = (e) => {
      if(e.target === backdrop) close();
    };
    
    
    // ===== USE CATEGORY BUTTON =====
    
    /*
      When user clicks "Use category", we:
      1. Find which category is selected
      2. Call the onChoose callback with that category
      3. Close the modal
    */
    btnUse.onclick = () => {
      // Find the selected category element
      // querySelector returns the first match (there should only be one)
      // ?. is optional chaining - safely access dataset.name even if element doesn't exist
      const selected = (
        document.querySelector('.catpicker-item[aria-selected="true"]')?.dataset.name
      ) || current;
      
      // Call the callback function if it exists
      // && is short-circuit evaluation: only call if onChoose is truthy
      onChoose && onChoose(selected);
      
      // Close the modal
      close();
    };
    
    
    // ===== SHOW THE MODAL =====
    
    // Add 'show' class to make modal visible (CSS transition handles animation)
    backdrop.classList.add('show');
    
    
    // ===== AUTO-FOCUS SEARCH BOX =====
    
    /*
      setTimeout delays the focus slightly to ensure the modal is fully rendered.
      This provides better UX - user can immediately start typing to search.
      
      50 milliseconds is barely noticeable but ensures the element is ready.
    */
    setTimeout(() => search.focus(), 50);
  }
  
  
  // ============================================
  // EXPORT THE PUBLIC API
  // ============================================
  
  /*
    We attach our function to the window object to make it globally accessible.
    
    window.SL_CatPicker creates a namespace (SL_CatPicker) to avoid conflicts.
    Other code can now call: window.SL_CatPicker.openCategoryPicker(...)
    
    NAMESPACE PATTERN:
    This prevents our function from conflicting with other code that might
    also have a function called "openCategoryPicker".
  */
  window.SL_CatPicker = { 
    openCategoryPicker 
    // This is shorthand for: openCategoryPicker: openCategoryPicker
  };
  
  
// ===== END OF IIFE =====
})(); // The () at the end immediately invokes the function

/*
  WHY USE AN IIFE?
  
  By wrapping all our code in (function(){...})(), we create a private scope.
  Variables like currentPage, ensureModal, etc. are NOT accessible from outside.
  Only what we explicitly export (window.SL_CatPicker) is public.
  
  This prevents naming conflicts and keeps the global scope clean!
*/
