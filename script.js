/* ============================================
   SPENDLITE - Expense Tracking Application
   Educational Version with Comprehensive Comments
   ============================================
   
   FILE PURPOSE:
   This is the main JavaScript file for SpendLite, a web application
   that helps users track their expenses by:
   - Loading transaction data from CSV files
   - Automatically categorizing transactions using rules
   - Providing summaries and exports
   - Filtering by month and category
   
   FOR BEGINNERS:
   JavaScript runs in the web browser and makes web pages interactive.
   This file contains:
   - Variables (data storage)
   - Functions (reusable blocks of code)
   - Event listeners (code that responds to user actions)
   
   ============================================ */


// ============================================
// CONFIGURATION & CONSTANTS
// ============================================

/*
  CONSTANTS are values that don't change. We use UPPERCASE names by convention.
  
  COL defines which columns in the CSV file contain our data.
  Arrays and objects in JavaScript are "zero-indexed", meaning the
  first item is at position 0, not 1.
*/
const COL = {
  DATE: 2,      // Column 3 (index 2) contains the transaction date
  DEBIT: 5,     // Column 6 (index 5) contains the amount
  LONGDESC: 9   // Column 10 (index 9) contains the description
};

/*
  PAGE_SIZE controls how many transactions to show per page.
  Making this a constant means we can easily change it in one place.
*/
const PAGE_SIZE = 10;


// ============================================
// GLOBAL STATE VARIABLES
// ============================================

/*
  These variables store the application's current state.
  We use 'let' instead of 'const' because their values will change.
  
  WHY GLOBAL?
  Multiple functions need to access and modify these, so we declare
  them at the top level (outside any function) to make them global.
*/

// Array of all transaction objects loaded from CSV
let CURRENT_TXNS = [];

// Array of categorization rules parsed from the rules textarea
let CURRENT_RULES = [];

// Currently active category filter (null = show all categories)
let CURRENT_FILTER = null;

// Currently active month filter ('YYYY-MM' format, or '' for all months)
let MONTH_FILTER = "";

// Current page number for transaction pagination
let CURRENT_PAGE = 1;


// ============================================
// LOCAL STORAGE KEYS
// ============================================

/*
  localStorage is a browser feature that lets us save data permanently
  (it persists even when the user closes the browser).
  
  We store our keys in an object to:
  1. Avoid typos (autocomplete helps!)
  2. Make it easy to update version numbers
  3. Document what we're storing
*/
const LS_KEYS = {
  RULES: 'spendlite_rules_v6626',              // User's categorization rules
  FILTER: 'spendlite_filter_v6626',            // Active category filter
  MONTH: 'spendlite_month_v6627',              // Active month filter
  TXNS_COLLAPSED: 'spendlite_txns_collapsed_v7', // Is transaction table hidden?
  TXNS_JSON: 'spendlite_txns_json_v7'          // Cached transaction data
};


// ============================================
// UTILITY FUNCTIONS - Text Formatting
// ============================================

/*
  These small helper functions do one thing well and can be reused.
  This follows the "Single Responsibility Principle" - each function
  has one clear job.
*/

/**
 * Convert a string to Title Case (First Letter Capitalized)
 * 
 * @param {string} str - The string to convert
 * @returns {string} - The title-cased string
 * 
 * Example:  toTitleCase("HELLO_WORLD") → "Hello World"
 * 
 * HOW IT WORKS:
 * 1. Convert entire string to lowercase
 * 2. Replace underscores and dashes with spaces
 * 3. Collapse multiple spaces into one
 * 4. Trim whitespace from start/end
 * 5. Capitalize first letter of each word using regex
 */
function toTitleCase(str) {
  // Guard clause: if str is falsy (null, undefined, ''), return empty string
  if (!str) return '';
  
  return String(str)              // Ensure it's a string
    .toLowerCase()                // "HELLO_WORLD" → "hello_world"
    .replace(/[_-]+/g, ' ')       // "hello_world" → "hello world"
    .replace(/\s+/g, ' ')         // Collapse multiple spaces
    .trim()                       // Remove leading/trailing spaces
    .replace(/\b([a-z])/g, (match, letter) => {
      // REGEX EXPLANATION:
      // \b = word boundary
      // ([a-z]) = capture one lowercase letter
      // g = global flag (replace all matches)
      //
      // The function receives the full match and captured groups
      // We return the uppercased version of the first letter
      return letter.toUpperCase();
    });
}

/**
 * Parse an amount string into a number
 * 
 * @param {string|number} s - Amount to parse (e.g., "$1,234.56")
 * @returns {number} - Numeric value
 * 
 * Example: parseAmount("$1,234.56") → 1234.56
 */
function parseAmount(s) {
  // If null or undefined, return 0
  if (s == null) return 0;
  
  // Remove all non-digit characters except minus sign, decimal point, and commas
  // Then remove commas (thousands separators)
  s = String(s)
    .replace(/[^\d\-,.]/g, '')   // Keep only digits, minus, dot, comma
    .replace(/,/g, '');          // Remove commas: "1,234" → "1234"
  
  // Convert to number, or return 0 if conversion fails
  return Number(s) || 0;
}

/**
 * Format a month code (YYYY-MM) into a readable label
 * 
 * @param {string} ym - Month in YYYY-MM format
 * @returns {string} - Readable month label
 * 
 * Example: formatMonthLabel("2025-03") → "March 2025"
 */
function formatMonthLabel(ym) {
  if (!ym) return 'All months';
  
  // Split "2025-03" into ["2025", "03"] and convert to numbers
  const [y, m] = ym.split('-').map(Number);
  
  // Create a Date object for the first day of that month
  // Note: JavaScript months are 0-indexed (0 = January), so we subtract 1
  const date = new Date(y, m - 1, 1);
  
  // Use toLocaleString to format in user's locale
  // This automatically handles different languages and formats
  return date.toLocaleString(undefined, { 
    month: 'long',   // "March" instead of "Mar" or "3"
    year: 'numeric'  // "2025" instead of "'25"
  });
}

/**
 * Get a friendly label for a month filter (or "All months" if none)
 * 
 * @param {string} label - Month code or empty string
 * @returns {string} - User-friendly label
 */
function friendlyMonthOrAll(label) {
  if (!label) return 'All months';
  
  // Check if it's in YYYY-MM format using a regular expression
  // \d{4} = exactly 4 digits
  // \d{2} = exactly 2 digits
  if (/^\d{4}-\d{2}$/.test(label)) {
    return formatMonthLabel(label);
  }
  
  return String(label);
}

/**
 * Convert a label into a safe filename
 * 
 * @param {string} label - Original label
 * @returns {string} - Filename-safe version
 * 
 * Example: forFilename("March 2025") → "March_2025"
 */
function forFilename(label) {
  // Replace any whitespace (spaces, tabs, newlines) with underscores
  // \s+ means "one or more whitespace characters"
  // g flag means "replace all occurrences"
  return String(label).replace(/\s+/g, '_');
}

/**
 * Escape HTML special characters to prevent XSS attacks
 * 
 * @param {string} s - String that might contain HTML
 * @returns {string} - Safe HTML string
 * 
 * SECURITY IMPORTANCE:
 * If we insert user data directly into HTML without escaping,
 * malicious users could inject scripts. For example:
 * "<script>alert('hacked')</script>" would execute!
 * 
 * After escaping: "&lt;script&gt;alert('hacked')&lt;/script&gt;"
 * This displays as text instead of executing.
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')    // Must be first! & → &amp;
    .replace(/</g, '&lt;')     // < → &lt;
    .replace(/>/g, '&gt;')     // > → &gt;
    .replace(/"/g, '&quot;')   // " → &quot;
    .replace(/'/g, '&#039;');  // ' → &#039;
}


// ============================================
// DATE PARSING & FORMATTING
// ============================================

/*
  Dates are tricky because different countries use different formats:
  - US: MM/DD/YYYY (3/15/2025 = March 15)
  - AU: DD/MM/YYYY (15/3/2025 = March 15)
  - ISO: YYYY-MM-DD (2025-03-15)
  
  This application is configured for Australian date formats.
*/

/**
 * Parse a date string intelligently, handling multiple formats
 * 
 * @param {string} s - Date string to parse
 * @returns {Date|null} - Date object or null if can't parse
 * 
 * SUPPORTED FORMATS:
 * - ISO: "2025-03-15" or "2025/03/15"
 * - Australian: "15/03/2025" or "15-03-2025"
 * - Month names: "15 March 2025" or "Mon 15 March, 2025"
 */
function parseDateSmart(s) {
  if (!s) return null;
  
  const str = String(s).trim();
  let m; // Will hold regex match results
  
  // === FORMAT 1: ISO (Unambiguous) ===
  // Pattern: YYYY-MM-DD or YYYY/MM/DD
  // Example: "2025-03-15" or "2025/03/15"
  m = str.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (m) {
    // m[0] = full match, m[1] = year, m[2] = month, m[3] = day
    return new Date(+m[1], +m[2] - 1, +m[3]);
    // The + converts string to number: +"2025" → 2025
    // We subtract 1 from month because JavaScript months are 0-indexed
  }
  
  // === FORMAT 2: Australian DD/MM/YYYY ===
  // Pattern: DD-MM-YYYY or DD/MM/YYYY
  // Example: "15/03/2025" means March 15, 2025
  m = str.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) {
    // m[1] = day, m[2] = month, m[3] = year
    return new Date(+m[3], +m[2] - 1, +m[1]);
  }
  
  // === FORMAT 3: Month Names ===
  // Pattern: "15 March 2025" or "Mon 15 March, 2025"
  
  // First, strip any leading time if present: "2:30pm 15 March 2025"
  const s2 = str.replace(/^\d{1,2}:\d{2}\s*(am|pm)\s*/i, '');
  
  // Complex regex to match month names
  m = s2.match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?\s*(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December),?\s+(\d{4})/i);
  
  if (m) {
    const day = +m[1];           // Day number
    const monthName = m[2].toLowerCase(); // "march"
    const year = +m[3];          // Year number
    
    // Map month names to numbers (0-indexed for JavaScript)
    const monthMap = {
      january: 0, february: 1, march: 2, april: 3,
      may: 4, june: 5, july: 6, august: 7,
      september: 8, october: 9, november: 10, december: 11
    };
    
    const monthIndex = monthMap[monthName];
    if (monthIndex != null) {
      return new Date(year, monthIndex, day);
    }
  }
  
  // === FORMAT 4: Give up ===
  // We couldn't parse it with any of our patterns
  // Returning null signals "invalid date" to calling code
  return null;
}

/**
 * Convert a Date object to YYYY-MM format
 * 
 * @param {Date} d - Date object
 * @returns {string} - Month code like "2025-03"
 * 
 * Example: yyyymm(new Date(2025, 2, 15)) → "2025-03"
 */
function yyyymm(d) {
  const year = d.getFullYear();           // 2025
  const month = d.getMonth() + 1;         // 3 (add 1 because getMonth() is 0-indexed)
  const monthStr = String(month).padStart(2, '0'); // "3" → "03"
  
  return `${year}-${monthStr}`;
}

/**
 * Get the month code of the first transaction
 * 
 * @param {Array} txns - Array of transactions (defaults to global)
 * @returns {string|null} - Month code or null
 */
function getFirstTxnMonth(txns = CURRENT_TXNS) {
  if (!txns.length) return null;
  
  const d = parseDateSmart(txns[0].date);
  if (!d || isNaN(d)) return null; // isNaN checks if date is invalid
  
  return yyyymm(d);
}


// ============================================
// CSV LOADING & PARSING
// ============================================

/**
 * Load and parse CSV text into transaction objects
 * 
 * @param {string} csvText - Raw CSV file content
 * @returns {Array} - Array of transaction objects
 * 
 * WHAT THIS DOES:
 * 1. Uses PapaParse library to convert CSV text to arrays
 * 2. Skips the header row if present
 * 3. Validates and filters rows
 * 4. Creates transaction objects with date, amount, description
 * 5. Saves to localStorage and updates the UI
 */
function loadCsvText(csvText) {
  // Parse CSV using the PapaParse library (loaded from CDN)
  // .parse() converts "row1,row2\ndata1,data2" into [[row1,row2],[data1,data2]]
  const rows = Papa.parse(csvText.trim(), { 
    skipEmptyLines: true  // Ignore blank rows
  }).data;
  
  // Determine if first row is a header
  // If the DEBIT column contains non-numeric data, it's probably a header
  const startIdx = rows.length && isNaN(parseAmount(rows[0][COL.DEBIT])) ? 1 : 0;
  
  // Array to store our transaction objects
  const txns = [];
  
  // Loop through each row (starting after header if present)
  for (let i = startIdx; i < rows.length; i++) {
    const r = rows[i];  // Current row array
    
    // Skip invalid rows
    if (!r || r.length < 10) continue;
    
    // Extract data from specific columns
    const effectiveDate = r[COL.DATE] || '';
    const debit = parseAmount(r[COL.DEBIT]);
    const longDesc = (r[COL.LONGDESC] || '').trim();
    
    // Validate the row:
    // - Must have either a date or description
    // - Amount must be a valid finite number
    // - Amount must not be zero
    if ((effectiveDate || longDesc) && Number.isFinite(debit) && debit !== 0) {
      // Create a transaction object
      txns.push({
        date: effectiveDate,
        amount: debit,
        description: longDesc
        // Note: category will be added later by categorize()
      });
    }
  }
  
  // Update global state
  CURRENT_TXNS = txns;
  
  // Save to localStorage for persistence
  saveTxnsToLocalStorage();
  
  // Update UI components
  try { updateMonthBanner(); } catch(e) { /* Ignore errors */ }
  rebuildMonthDropdown();
  applyRulesAndRender();
  
  return txns;
}


// ============================================
// MONTH FILTERING
// ============================================

/**
 * Build the month filter dropdown with available months
 * 
 * This function:
 * 1. Scans all transactions to find which months have data
 * 2. Populates the dropdown with those months
 * 3. Preserves the currently selected month if still valid
 */
function rebuildMonthDropdown() {
  const sel = document.getElementById('monthFilter');
  
  // Use a Set to automatically remove duplicates
  const months = new Set();
  
  // Check each transaction's date
  for (const t of CURRENT_TXNS) {
    const d = parseDateSmart(t.date);
    if (d) months.add(yyyymm(d)); // Add "2025-03" format
  }
  
  // Convert Set to Array and sort chronologically
  const list = Array.from(months).sort();
  
  const current = MONTH_FILTER;
  
  // Build the <option> elements
  // .map() transforms each month into HTML
  // .join('') combines them into one string
  sel.innerHTML = `<option value="">All months</option>` + 
    list.map(m => `<option value="${m}">${formatMonthLabel(m)}</option>`).join('');
  
  // Restore the previously selected month if it still exists
  sel.value = current && list.includes(current) ? current : "";
  
  updateMonthBanner();
}

/**
 * Get transactions filtered by the selected month
 * 
 * @returns {Array} - Filtered array of transactions
 * 
 * FILTER EXPLANATION:
 * .filter() creates a new array containing only items that pass a test.
 * The test function returns true/false for each item.
 */
function monthFilteredTxns() {
  // If no month filter is active, return all transactions
  if (!MONTH_FILTER) return CURRENT_TXNS;
  
  // Return only transactions from the selected month
  return CURRENT_TXNS.filter(t => {
    const d = parseDateSmart(t.date);
    return d && yyyymm(d) === MONTH_FILTER;
  });
}


// ============================================
// CATEGORIZATION RULES
// ============================================

/**
 * Parse the rules text into an array of rule objects
 * 
 * @param {string} text - Multi-line rules text
 * @returns {Array} - Array of {keyword, category} objects
 * 
 * RULE FORMAT:
 * Each line should be: KEYWORD => CATEGORY
 * Example: "woolworths => GROCERIES"
 * 
 * Lines starting with # are comments and are ignored.
 */
function parseRules(text) {
  // Split text into individual lines
  // \r?\n matches both Windows (\r\n) and Unix (\n) line endings
  const lines = String(text || "").split(/\r?\n/);
  
  const rules = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Split on => (case insensitive)
    // /=>/i means: match => with i flag (case insensitive)
    const parts = trimmed.split(/=>/i);
    
    // Valid rule must have both keyword and category
    if (parts.length >= 2) {
      const keyword = parts[0].trim().toLowerCase();
      const category = parts[1].trim().toUpperCase();
      
      if (keyword && category) {
        rules.push({ keyword, category });
      }
    }
  }
  
  return rules;
}

/**
 * Check if a description matches a keyword pattern
 * 
 * @param {string} descLower - Transaction description (lowercase)
 * @param {string} keywordLower - Keyword to match (lowercase)
 * @returns {boolean} - True if matches
 * 
 * ADVANCED MATCHING:
 * This supports multi-word keywords like "paypal pypl"
 * Both "paypal" AND "pypl" must appear in the description
 * 
 * Uses word boundaries to avoid partial matches:
 * "woolworths" matches "at woolworths" but not "woolworthsextra"
 */
function matchesKeyword(descLower, keywordLower) {
  if (!keywordLower) return false;
  
  const text = String(descLower || '').toLowerCase();
  
  // Split keyword into individual tokens (words)
  // "paypal pypl" → ["paypal", "pypl"]
  const tokens = String(keywordLower).toLowerCase().split(/\s+/).filter(Boolean);
  
  if (!tokens.length) return false;
  
  // Word boundary definition: letters, digits, &, ., _
  // Anything else is considered a boundary
  const delim = '[^A-Za-z0-9&._]';
  
  // Check that ALL tokens match (using .every())
  return tokens.every(tok => {
    // Escape special regex characters in the token
    // This prevents "." from matching any character, etc.
    const safe = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Build regex pattern with word boundaries
    // (?:^|delim) = start of string OR a delimiter
    // (?:delim|$) = delimiter OR end of string
    // i flag = case insensitive
    const re = new RegExp(`(?:^|${delim})${safe}(?:${delim}|$)`, 'i');
    
    return re.test(text);
  });
}

/**
 * Apply categorization rules to transactions
 * 
 * @param {Array} txns - Transactions to categorize
 * @param {Array} rules - Rules to apply
 * 
 * SIDE EFFECTS:
 * This function modifies the transaction objects directly,
 * adding a 'category' property to each one.
 * 
 * SPECIAL RULES:
 * - First matching rule wins (order matters!)
 * - Petrol purchases under $2 are recategorized as COFFEE
 *   (assumption: small petrol station purchases are snacks)
 */
function categorise(txns, rules) {
  for (const t of txns) {
    const descLower = String(t.desc || t.description || "").toLowerCase();
    const amount = Math.abs(Number(t.amount || t.debit || 0));
    
    // === Step 1: Find matching rule ===
    let matched = null;
    for (const r of rules) {
      if (matchesKeyword(descLower, r.keyword)) {
        matched = r.category;
        break; // First match wins, stop looking
      }
    }
    
    // === Step 2: Apply special business rules ===
    // Small purchases at petrol stations are likely snacks/coffee, not fuel
    if (matched && String(matched).toUpperCase() === "PETROL" && amount <= 2) {
      matched = "COFFEE";
    }
    
    // === Step 3: Assign category ===
    t.category = matched || "UNCATEGORISED";
  }
}


// ============================================
// CATEGORY TOTALS CALCULATION
// ============================================

/**
 * Calculate total spending per category
 * 
 * @param {Array} txns - Transactions to analyze
 * @returns {Object} - {rows: [[cat, total], ...], grand: totalAmount}
 * 
 * USES A MAP:
 * Maps are like objects but better for grouping/counting
 * They maintain insertion order and can use any value as a key
 */
function computeCategoryTotals(txns) {
  // Map to accumulate totals per category
  const byCat = new Map();
  
  for (const t of txns) {
    const cat = (t.category || 'UNCATEGORISED').toUpperCase();
    
    // Get current total for this category (or 0 if first time)
    // Add this transaction's amount
    // Store back in the map
    byCat.set(cat, (byCat.get(cat) || 0) + t.amount);
  }
  
  // Convert Map to array of [category, total] pairs
  // Sort by total (highest first)
  // b[1] - a[1] means: sort by second element (total) descending
  const rows = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
  
  // Calculate grand total using .reduce()
  // .reduce() accumulates a single value from an array
  // acc = accumulator (running total), v = current value
  const grand = rows.reduce((acc, [, v]) => acc + v, 0);
  
  return { rows, grand };
}


// ============================================
// RENDERING FUNCTIONS
// ============================================

/**
 * Render the category totals table
 * 
 * @param {Array} txns - Transactions to summarize
 * 
 * This creates an HTML table showing:
 * - Each category with its total and percentage
 * - Grand total at the bottom
 * - Clickable category names for filtering
 */
function renderCategoryTotals(txns) {
  const { rows, grand } = computeCategoryTotals(txns);
  const totalsDiv = document.getElementById('categoryTotals');
  
  // Build HTML string
  // Using template literals for multi-line strings
  let html = `
    <table class="cats">
      <colgroup>
        <col class="col-cat">
        <col class="col-total">
        <col class="col-pct">
      </colgroup>
      <thead>
        <tr>
          <th>Category</th>
          <th class="num">Total</th>
          <th class="num">%</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  // Add a row for each category
  for (const [cat, total] of rows) {
    const percentage = grand ? (total / grand * 100) : 0;
    
    // escapeHtml() prevents XSS attacks from malicious category names
    html += `
      <tr>
        <td>
          <a class="catlink" data-cat="${escapeHtml(cat)}">
            <span class="category-name">${escapeHtml(toTitleCase(cat))}</span>
          </a>
        </td>
        <td class="num">${total.toFixed(2)}</td>
        <td class="num">${percentage.toFixed(1)}%</td>
      </tr>
    `;
  }
  
  // Add footer with grand total
  html += `
      </tbody>
      <tfoot>
        <tr>
          <td>Total</td>
          <td class="num">${grand.toFixed(2)}</td>
          <td class="num">100%</td>
        </tr>
      </tfoot>
    </table>
  `;
  
  // Insert HTML into the page
  totalsDiv.innerHTML = html;
  
  // Add click handlers to category links
  // querySelectorAll returns all matching elements
  totalsDiv.querySelectorAll('a.catlink').forEach(a => {
    a.addEventListener('click', () => {
      // Get category from data attribute
      CURRENT_FILTER = a.getAttribute('data-cat');
      
      // Save to localStorage
      try { 
        localStorage.setItem(LS_KEYS.FILTER, CURRENT_FILTER || ''); 
      } catch(e) {
        // localStorage might be disabled or full
      }
      
      // Update UI
      updateFilterUI();
      CURRENT_PAGE = 1;  // Reset to first page when filtering
      renderTransactionsTable();
    });
  });
}

/**
 * Render the month totals summary bar
 * 
 * Shows count, debit, credit, and net for filtered transactions
 */
function renderMonthTotals() {
  // Get transactions after applying both month and category filters
  const txns = getFilteredTxns(monthFilteredTxns());
  
  let debit = 0, credit = 0, count = 0;
  
  // Accumulate totals
  for (const t of txns) {
    const amt = Number(t.amount) || 0;
    
    if (amt > 0) {
      debit += amt;       // Positive = money out (expense)
    } else {
      credit += Math.abs(amt); // Negative = money in (income)
    }
    
    count++;
  }
  
  const net = debit - credit; // Net spending
  
  const el = document.getElementById('monthTotals');
  if (!el) return;
  
  // Build label showing active filters
  const label = friendlyMonthOrAll(MONTH_FILTER);
  const cat = CURRENT_FILTER ? ` + category "${CURRENT_FILTER}"` : "";
  
  // Update HTML
  el.innerHTML = `
    Showing <span class="badge">${count}</span> transactions for 
    <strong>${label}${cat}</strong> · 
    Debit: <strong>$${debit.toFixed(2)}</strong> · 
    Credit: <strong>$${credit.toFixed(2)}</strong> · 
    Net: <strong>$${net.toFixed(2)}</strong>
  `;
}

/**
 * Master function: apply rules and re-render everything
 * 
 * @param {Object} options - Configuration
 * @param {boolean} options.keepPage - Don't reset to page 1
 * 
 * This is called whenever rules change or data is loaded.
 * It re-categorizes everything and updates all displays.
 */
function applyRulesAndRender({keepPage = false} = {}) {
  // Reset pagination unless specifically told not to
  if (!keepPage) CURRENT_PAGE = 1;
  
  // Parse rules from textarea
  CURRENT_RULES = parseRules(document.getElementById('rulesBox').value);
  
  // Save rules to localStorage
  try { 
    localStorage.setItem(LS_KEYS.RULES, document.getElementById('rulesBox').value); 
  } catch(e) {}
  
  // Get transactions for current month
  const txns = monthFilteredTxns();
  
  // Apply categorization rules
  categorise(txns, CURRENT_RULES);
  
  // Update all displays
  renderMonthTotals();
  renderCategoryTotals(txns);
  renderTransactionsTable(txns);
  
  // Save updated transactions
  saveTxnsToLocalStorage();
  
  // Update month banner
  try { updateMonthBanner(); } catch(e) {}
}


// ============================================
// TRANSACTION TABLE WITH PAGINATION
// ============================================

/**
 * Render the transactions table with pagination
 * 
 * @param {Array} txns - Transactions to display
 * 
 * This function:
 * 1. Applies category filter
 * 2. Calculates pagination
 * 3. Renders table rows for current page
 * 4. Adds "+ button to assign categories
 */
function renderTransactionsTable(txns = monthFilteredTxns()) {
  // Apply category filter
  const filtered = getFilteredTxns(txns);
  
  // Calculate pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  
  // Keep current page within valid range
  if (CURRENT_PAGE > totalPages) CURRENT_PAGE = totalPages;
  if (CURRENT_PAGE < 1) CURRENT_PAGE = 1;
  
  // Calculate which transactions to show
  const start = (CURRENT_PAGE - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);
  
  const table = document.getElementById('transactionsTable');
  
  // Build table HTML
  let html = `
    <tr>
      <th>Date</th>
      <th>Amount</th>
      <th>Category</th>
      <th>Description</th>
      <th></th>
    </tr>
  `;
  
  // Add row for each transaction
  pageItems.forEach((t) => {
    // Find index in original array (needed for assignCategory)
    const idx = CURRENT_TXNS.indexOf(t);
    
    const cat = (t.category || 'UNCATEGORISED').toUpperCase();
    const displayCat = toTitleCase(cat);
    
    html += `
      <tr>
        <td>${escapeHtml(t.date)}</td>
        <td>${t.amount.toFixed(2)}</td>
        <td><span class="category-name">${escapeHtml(displayCat)}</span></td>
        <td>${escapeHtml(t.description)}</td>
        <td>
          <button class="rule-btn" onclick="assignCategory(${idx})">+</button>
        </td>
      </tr>
    `;
  });
  
  table.innerHTML = html;
  
  // Render pagination controls
  renderPager(totalPages);
}

/**
 * Render pagination controls (First, Prev, page numbers, Next, Last)
 * 
 * @param {number} totalPages - Total number of pages
 * 
 * PAGINATION STRATEGY:
 * - Show window of 5 page numbers around current page
 * - Always show First/Last buttons
 * - Disable Prev on first page, Next on last page
 */
function renderPager(totalPages) {
  const pager = document.getElementById('pager');
  if (!pager) return;
  
  const pages = totalPages || 1;
  const cur = CURRENT_PAGE;
  
  // Helper function to create a button
  function pageButton(label, page, disabled = false, isActive = false) {
    const disAttr = disabled ? ' disabled' : '';
    const activeClass = isActive ? ' active' : '';
    return `<button class="page-btn${activeClass}" data-page="${page}"${disAttr}>${label}</button>`;
  }
  
  // Calculate window of page numbers to show
  const windowSize = 5;
  let start = Math.max(1, cur - Math.floor(windowSize / 2));
  let end = Math.min(pages, start + windowSize - 1);
  
  // Adjust start if we're near the end
  start = Math.max(1, Math.min(start, end - windowSize + 1));
  
  // Build HTML
  let html = '';
  
  html += pageButton('First', 1, cur === 1);
  html += pageButton('Prev', Math.max(1, cur - 1), cur === 1);
  
  // Add numbered page buttons
  for (let p = start; p <= end; p++) {
    html += pageButton(String(p), p, false, p === cur);
  }
  
  html += pageButton('Next', Math.min(pages, cur + 1), cur === pages);
  html += pageButton('Last', pages, cur === pages);
  html += `<span style="margin-left:8px">Page ${cur} / ${pages}</span>`;
  
  pager.innerHTML = html;
  
  // Add click handlers to all buttons
  pager.querySelectorAll('button.page-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const page = Number(e.currentTarget.getAttribute('data-page'));
      
      if (!page || page === CURRENT_PAGE) return;
      
      CURRENT_PAGE = page;
      renderTransactionsTable();
    });
  });
  
  // Bonus feature: Mouse wheel to flip pages
  const table = document.getElementById('transactionsTable');
  if (table && !table._wheelBound) {
    table.addEventListener('wheel', (e) => {
      if (pages <= 1) return;
      
      if (e.deltaY > 0 && CURRENT_PAGE < pages) {
        // Scrolling down = next page
        CURRENT_PAGE++;
        renderTransactionsTable();
      } else if (e.deltaY < 0 && CURRENT_PAGE > 1) {
        // Scrolling up = previous page
        CURRENT_PAGE--;
        renderTransactionsTable();
      }
    }, { passive: true });
    
    table._wheelBound = true; // Prevent adding listener multiple times
  }
}


// ============================================
// FILTERING FUNCTIONS
// ============================================

/**
 * Get transactions filtered by category (if filter active)
 * 
 * @param {Array} txns - Transactions to filter
 * @returns {Array} - Filtered transactions
 */
function getFilteredTxns(txns) {
  if (!CURRENT_FILTER) return txns;
  
  return txns.filter(t => {
    const cat = (t.category || 'UNCATEGORISED').toUpperCase();
    return cat === CURRENT_FILTER;
  });
}

/**
 * Update the filter UI (label and clear button)
 */
function updateFilterUI() {
  const label = document.getElementById('activeFilter');
  const btn = document.getElementById('clearFilterBtn');
  
  if (CURRENT_FILTER) {
    label.textContent = `— filtered by "${CURRENT_FILTER}"`;
    btn.style.display = ''; // Show button
  } else {
    label.textContent = '';
    btn.style.display = 'none'; // Hide button
  }
}

/**
 * Update the month banner label
 */
function updateMonthBanner() {
  const banner = document.getElementById('monthBanner');
  const label = friendlyMonthOrAll(MONTH_FILTER);
  banner.textContent = `— ${label}`;
}


// ============================================
// EXPORT FUNCTIONS
// ============================================

/**
 * Export category totals to a text file
 * 
 * Creates a nicely formatted text file with:
 * - Header with month name
 * - Category totals in columns
 * - Grand total
 */
function exportTotals() {
  const txns = monthFilteredTxns();
  const { rows, grand } = computeCategoryTotals(txns);
  
  const label = friendlyMonthOrAll(MONTH_FILTER || getFirstTxnMonth(txns) || new Date());
  const header = `SpendLite Category Totals (${label})`;
  
  // Calculate column widths for alignment
  const catWidth = Math.max(8, ...rows.map(([cat]) => toTitleCase(cat).length), 'Category'.length);
  const amtWidth = 12;
  const pctWidth = 6;
  
  const lines = [];
  lines.push(header);
  lines.push('='.repeat(header.length));
  
  // Header row
  lines.push(
    'Category'.padEnd(catWidth) + ' ' +
    'Amount'.padStart(amtWidth) + ' ' +
    '%'.padStart(pctWidth)
  );
  
  // Data rows
  for (const [cat, total] of rows) {
    const pct = grand ? (total / grand * 100) : 0;
    lines.push(
      toTitleCase(cat).padEnd(catWidth) + ' ' +
      total.toFixed(2).padStart(amtWidth) + ' ' +
      (pct.toFixed(1) + '%').padStart(pctWidth)
    );
  }
  
  // Total row
  lines.push('');
  lines.push(
    'TOTAL'.padEnd(catWidth) + ' ' +
    grand.toFixed(2).padStart(amtWidth) + ' ' +
    '100%'.padStart(pctWidth)
  );
  
  // Create and download file
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `category_totals_${forFilename(label)}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Export rules to a text file
 */
function exportRules() {
  const text = document.getElementById('rulesBox').value || '';
  const blob = new Blob([text], {type: 'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rules_export.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Import rules from a text file
 * 
 * @param {File} file - File object from input element
 */
function importRulesFromFile(file) {
  const reader = new FileReader();
  
  reader.onload = () => {
    const text = reader.result || '';
    document.getElementById('rulesBox').value = text;
    applyRulesAndRender();
  };
  
  reader.readAsText(file);
}


// ============================================
// CATEGORY ASSIGNMENT WITH MODAL PICKER
// ============================================

/**
 * Open category picker modal for a transaction
 * 
 * @param {number} idx - Index of transaction in CURRENT_TXNS
 * 
 * This function:
 * 1. Collects all available categories
 * 2. Sorts them alphabetically
 * 3. Opens the category picker modal
 * 4. Handles the user's selection
 */
function assignCategory(idx) {
  // Collect categories from transactions
  const fromTxns = (Array.isArray(CURRENT_TXNS) ? CURRENT_TXNS : [])
    .map(x => (x.category || '').trim());
  
  // Collect categories from rules
  const fromRules = (Array.isArray(CURRENT_RULES) ? CURRENT_RULES : [])
    .map(r => (r.category || '').trim ? r.category : (r.category || ''));
  
  // Merge and remove duplicates
  const merged = Array.from(
    new Set([...fromTxns, ...fromRules].map(c => (c || '').trim()).filter(Boolean))
  );
  
  // Build list with special items first
  let base = Array.from(new Set(merged));
  
  // Normalize "Uncategorised" to title case
  base = base.map(c => 
    (c.toUpperCase() === 'UNCATEGORISED' ? 'Uncategorised' : c)
  );
  
  // Ensure Uncategorised is in the list
  if (!base.includes('Uncategorised')) base.unshift('Uncategorised');
  
  // Add "Add new category" option
  base.unshift('+ Add new category...');
  
  // Sort the rest alphabetically (case-insensitive)
  const specials = new Set(['+ Add new category...', 'Uncategorised']);
  const rest = base.filter(c => !specials.has(c)).sort((a, b) => {
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });
  
  const categories = ['+ Add new category...', 'Uncategorised', ...rest];
  
  // Get current category
  const current = ((CURRENT_TXNS && CURRENT_TXNS[idx] && CURRENT_TXNS[idx].category) || '').trim() || 'Uncategorised';
  
  // Open the picker modal (defined in catpicker-modal.js)
  SL_CatPicker.openCategoryPicker({
    categories,
    current,
    onChoose: (chosen) => {
      if (chosen) {
        const ch = String(chosen).trim();
        const lo = ch.toLowerCase();
        
        // Check if user chose "Add new category"
        const isAdd = ch.startsWith('➕') || 
                     ch.startsWith('+') || 
                     lo.indexOf('add new category') !== -1;
        
        if (isAdd) {
          // Close modal and use old prompt-based method
          try { 
            document.getElementById('catpickerBackdrop').classList.remove('show'); 
          } catch(e) {}
          return assignCategory_OLD(idx);
        }
      }
      
      // Normalize selection
      const norm = (chosen === 'Uncategorised') ? '' : String(chosen).trim().toUpperCase();
      
      // Update transaction
      if (CURRENT_TXNS && CURRENT_TXNS[idx]) {
        CURRENT_TXNS[idx].category = norm;
      }
      
      // Re-render UI
      try { renderMonthTotals(); } catch(e) {}
      try { renderTransactionsTable(); } catch(e) {}
    }
  });
}

/**
 * OLD METHOD: Assign category using prompts and rules
 * 
 * This is the fallback when user chooses "Add new category"
 * It uses browser prompt() dialogs and creates a new rule.
 * 
 * @param {number} idx - Transaction index
 */
function assignCategory_OLD(idx) {
  const txn = CURRENT_TXNS[idx];
  if (!txn) return;
  
  const desc = txn.description || "";
  const up = desc.toUpperCase();
  
  // === BUILD SUGGESTED KEYWORD ===
  
  let suggestedKeyword = "";
  
  // Special handling for PayPal transactions
  if (/\bPAYPAL\b/.test(up)) {
    const nxt = nextWordAfter('paypal', desc);
    suggestedKeyword = ('PAYPAL' + (nxt ? ' ' + nxt : '')).toUpperCase();
  } 
  // Special handling for VISA- prefixed descriptions
  else {
    const visaPos = up.indexOf("VISA-");
    if (visaPos !== -1) {
      const after = desc.substring(visaPos + 5).trim();
      suggestedKeyword = (after.split(/\s+/)[0] || "").toUpperCase();
    } else {
      // Default: use first word
      suggestedKeyword = (desc.split(/\s+/)[0] || "").toUpperCase();
    }
  }
  
  // === GET KEYWORD FROM USER ===
  
  const keywordInput = prompt("Enter keyword to match:", suggestedKeyword);
  if (!keywordInput) return;
  const keyword = keywordInput.trim().toUpperCase();
  
  // === GET CATEGORY FROM USER ===
  
  const defaultCat = (txn.category || "UNCATEGORISED").toUpperCase();
  const catInput = prompt("Enter category name:", defaultCat);
  if (!catInput) return;
  const category = catInput.trim().toUpperCase();
  
  // === UPSERT RULE ===
  
  const box = document.getElementById('rulesBox');
  const lines = String(box.value || "").split(/\r?\n/);
  let updated = false;
  
  // Check if rule already exists
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] || "").trim();
    if (!line || line.startsWith('#')) continue;
    
    const parts = line.split(/=>/i);
    if (parts.length >= 2) {
      const k = parts[0].trim().toUpperCase();
      if (k === keyword) {
        // Update existing rule
        lines[i] = `${keyword} => ${category}`;
        updated = true;
        break;
      }
    }
  }
  
  // Add new rule if not found
  if (!updated) lines.push(`${keyword} => ${category}`);
  
  box.value = lines.join("\n");
  
  // Save and re-render
  try { localStorage.setItem(LS_KEYS.RULES, box.value); } catch(e) {}
  if (typeof applyRulesAndRender === 'function') {
    applyRulesAndRender({keepPage: true});
  }
}

/**
 * Helper: Extract next word after a marker in a description
 * 
 * @param {string} marker - Word to find
 * @param {string} desc - Description to search
 * @returns {string} - Next word after marker
 * 
 * Example: nextWordAfter("paypal", "PAYPAL PYPL*UBER") → "PYPL"
 */
function nextWordAfter(marker, desc) {
  const lower = (desc || '').toLowerCase();
  const i = lower.indexOf(String(marker).toLowerCase());
  if (i === -1) return '';
  
  // Get substring after the marker
  let after = (desc || '').slice(i + String(marker).length);
  
  // Remove leading separators
  after = after.replace(/^[\s\-:\/*]+/, '');
  
  // Extract merchant-like token (letters, digits, &, ., _)
  const m = after.match(/^([A-Za-z0-9&._]+)/);
  return m ? m[1] : '';
}


// ============================================
// TRANSACTION LIST TOGGLE (Show/Hide)
// ============================================

/**
 * Check if transactions list should be collapsed
 * 
 * @returns {boolean} - True if collapsed
 */
function isTxnsCollapsed() {
  try {
    return localStorage.getItem(LS_KEYS.TXNS_COLLAPSED) !== 'false';
  } catch(e) {
    return true; // Default to collapsed
  }
}

/**
 * Save collapsed state to localStorage
 * 
 * @param {boolean} v - True if collapsed
 */
function setTxnsCollapsed(v) {
  try {
    localStorage.setItem(LS_KEYS.TXNS_COLLAPSED, v ? 'true' : 'false');
  } catch(e) {}
}

/**
 * Apply the collapsed state to the UI
 */
function applyTxnsCollapsedUI() {
  const body = document.getElementById('transactionsBody');
  const toggle = document.getElementById('txnsToggleBtn');
  const collapsed = isTxnsCollapsed();
  
  if (body) body.style.display = collapsed ? 'none' : '';
  if (toggle) toggle.textContent = collapsed ? 'Show transactions' : 'Hide transactions';
}

/**
 * Toggle transactions list visibility
 * 
 * This is called when user clicks the Show/Hide button
 */
function toggleTransactions() {
  const collapsed = isTxnsCollapsed();
  setTxnsCollapsed(!collapsed);
  applyTxnsCollapsedUI();
}


// ============================================
// LOCALSTORAGE PERSISTENCE
// ============================================

/**
 * Save transactions to localStorage
 * 
 * This allows transactions to persist across page reloads
 */
function saveTxnsToLocalStorage() {
  try {
    const data = JSON.stringify(CURRENT_TXNS || []);
    localStorage.setItem(LS_KEYS.TXNS_JSON, data);
    
    // Mirror-save to standard keys for compatibility
    localStorage.setItem('spendlite_txns_json_v7', data);
    localStorage.setItem('spendlite_txns_json', data);
  } catch(e) {
    // localStorage might be disabled or full
  }
}


// ============================================
// EVENT LISTENERS - Wiring up the UI
// ============================================

/*
  EVENT LISTENERS connect HTML elements to JavaScript functions.
  When a user interacts with an element (click, type, etc.),
  the browser fires an event, and our listener functions run.
  
  PATTERN:
  element.addEventListener('eventName', functionToRun)
*/

// === CSV File Upload ===
document.getElementById('csvFile').addEventListener('change', (e) => {
  // e.target.files is an array-like object of selected files
  // ?.[0] safely gets the first file (won't error if undefined)
  const file = e.target.files?.[0];
  if (!file) return;
  
  // FileReader is a browser API for reading files
  const reader = new FileReader();
  
  // Set up what happens when file is loaded
  reader.onload = () => {
    loadCsvText(reader.result); // reader.result contains file contents
  };
  
  // Start reading the file as text
  reader.readAsText(file);
});

// === Recalculate Button ===
document.getElementById('recalculateBtn').addEventListener('click', applyRulesAndRender);

// === Export Buttons ===
document.getElementById('exportRulesBtn').addEventListener('click', exportRules);
document.getElementById('exportTotalsBtn').addEventListener('click', exportTotals);

// === Import Rules ===
// When import button is clicked, trigger the hidden file input
document.getElementById('importRulesBtn').addEventListener('click', () => {
  document.getElementById('importRulesInput').click();
});

// When file is selected, import it
document.getElementById('importRulesInput').addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  if (f) importRulesFromFile(f);
});

// === Clear Category Filter ===
document.getElementById('clearFilterBtn').addEventListener('click', () => {
  CURRENT_FILTER = null;
  try { localStorage.removeItem(LS_KEYS.FILTER); } catch(e) {}
  updateFilterUI();
  CURRENT_PAGE = 1;
  renderTransactionsTable();
  renderMonthTotals(monthFilteredTxns());
});

// === Clear Month Filter ===
document.getElementById('clearMonthBtn').addEventListener('click', () => {
  MONTH_FILTER = "";
  try { localStorage.removeItem(LS_KEYS.MONTH); } catch(e) {}
  document.getElementById('monthFilter').value = "";
  updateMonthBanner();
  CURRENT_PAGE = 1;
  applyRulesAndRender();
});

// === Month Filter Dropdown ===
document.getElementById('monthFilter').addEventListener('change', (e) => {
  MONTH_FILTER = e.target.value || "";
  try { localStorage.setItem(LS_KEYS.MONTH, MONTH_FILTER); } catch(e) {}
  updateMonthBanner();
  CURRENT_PAGE = 1;
  applyRulesAndRender();
});


// ============================================
// PAGE INITIALIZATION
// ============================================

/*
  DOMContentLoaded event fires when the HTML is fully loaded
  and parsed, but before images/stylesheets finish loading.
  
  This is the perfect time to initialize our application!
*/
window.addEventListener('DOMContentLoaded', async () => {
  // === RESTORE RULES FROM LOCALSTORAGE ===
  
  let restored = false;
  
  // Try localStorage first
  try {
    const saved = localStorage.getItem(LS_KEYS.RULES);
    if (saved && saved.trim()) {
      document.getElementById('rulesBox').value = saved;
      restored = true;
    }
  } catch(e) {}
  
  // If not in localStorage, try loading from server
  if (!restored) {
    try {
      const res = await fetch('rules.txt');
      const text = await res.text();
      document.getElementById('rulesBox').value = text;
      restored = true;
    } catch(e) {}
  }
  
  // If still not restored, use default sample rules
  if (!restored) {
    document.getElementById('rulesBox').value = SAMPLE_RULES;
  }
  
  // === RESTORE FILTERS ===
  
  try {
    const savedFilter = localStorage.getItem(LS_KEYS.FILTER);
    CURRENT_FILTER = savedFilter && savedFilter.trim() ? savedFilter.toUpperCase() : null;
  } catch(e) {}
  
  try {
    const savedMonth = localStorage.getItem(LS_KEYS.MONTH);
    MONTH_FILTER = savedMonth || "";
  } catch(e) {}
  
  // === INITIALIZE UI ===
  
  updateFilterUI();
  CURRENT_PAGE = 1;
  updateMonthBanner();
  applyTxnsCollapsedUI();
});

// Apply collapsed state when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  applyTxnsCollapsedUI();
});


// ============================================
// DEFAULT SAMPLE RULES
// ============================================

const SAMPLE_RULES = `# Rules format: KEYWORD => CATEGORY
# Lines starting with # are comments
# Example:
# woolworths => GROCERIES
# coles => GROCERIES
# shell => PETROL
`;


// ============================================
// END OF SPENDLITE MAIN SCRIPT
// ============================================

/*
  CONGRATULATIONS!
  
  If you've read this far, you now understand:
  - How to structure a JavaScript application
  - Working with arrays, objects, and Maps
  - DOM manipulation and event handling
  - Regular expressions for text matching
  - localStorage for data persistence
  - File reading and CSV parsing
  - Creating and exporting files
  - Pagination and filtering logic
  
  Keep learning and building! 🚀
*/
