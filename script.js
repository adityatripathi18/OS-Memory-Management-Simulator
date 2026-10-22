/* ============================================================
   MemoryOS® — script.js
   Memory Management Simulator — All application logic
   ============================================================ */

'use strict';

// ── DEFAULT DEMO DATA ──────────────────────────────────────
const DEFAULT_BLOCKS    = [200, 150, 100, 300, 250];
const DEFAULT_PROCESSES = [110, 220, 75, 180, 50];

// ── STATE ──────────────────────────────────────────────────
let blocks    = [...DEFAULT_BLOCKS];
let processes = [...DEFAULT_PROCESSES];
let simSteps  = [];
let currentStep = -1;
let playInterval = null;
let isPlaying    = false;

// Settings (read from DOM)
function getPlaySpeed()    { return parseInt(document.getElementById('playSpeedSelect').value, 10); }
function getHighlight()    { return document.getElementById('highlightToggle').checked; }
function getShowLog()      { return document.getElementById('showLogToggle').checked; }


// ══════════════════════════════════════════════════════════
//  ALLOCATION ALGORITHMS
// ══════════════════════════════════════════════════════════

function runFirstFit(blockSizes, processSizes) {
  const free = blockSizes.map((s, i) => ({ id: i + 1, size: s, remaining: s }));
  const alloc = [];
  const steps = [];
  const log   = [];

  log.push({ type: 'info', text: '── First Fit Algorithm ──' });

  for (let pi = 0; pi < processSizes.length; pi++) {
    const pSize = processSizes[pi];
    const pid   = `P${pi + 1}`;
    let allocated = false;

    for (let bi = 0; bi < free.length; bi++) {
      if (free[bi].remaining >= pSize) {
        const chosen = free[bi];
        const before = chosen.remaining;
        chosen.remaining -= pSize;

        alloc.push({ pid, size: pSize, blockId: chosen.id, status: 'ok', freeAfter: chosen.remaining });
        log.push({ type: 'success', text: `${pid} (${pSize} KB) → Block ${chosen.id} [${before} KB → ${chosen.remaining} KB free]` });

        steps.push({
          pid, size: pSize,
          blockId: chosen.id,
          status: 'ok',
          freeSnapshot: free.map(f => ({ ...f })),
          allocSnapshot: alloc.map(a => ({ ...a })),
          log: `Allocating ${pid} (${pSize} KB) to Block ${chosen.id}. Remaining free: ${chosen.remaining} KB.`
        });

        allocated = true;
        break;
      }
    }

    if (!allocated) {
      alloc.push({ pid, size: pSize, blockId: null, status: 'fail', freeAfter: null });
      log.push({ type: 'fail', text: `${pid} (${pSize} KB) → No suitable block found. Allocation failed.` });

      steps.push({
        pid, size: pSize,
        blockId: null,
        status: 'fail',
        freeSnapshot: free.map(f => ({ ...f })),
        allocSnapshot: alloc.map(a => ({ ...a })),
        log: `${pid} (${pSize} KB) could not be allocated — no block is large enough.`
      });
    }
  }

  const totalFree  = free.reduce((s, b) => s + b.remaining, 0);
  const succeeded  = alloc.filter(a => a.status === 'ok').length;
  const failed     = alloc.filter(a => a.status === 'fail').length;

  return { alloc, steps, log, totalFree, succeeded, failed, free };
}

function runBestFit(blockSizes, processSizes) {
  const free = blockSizes.map((s, i) => ({ id: i + 1, size: s, remaining: s }));
  const alloc = [];
  const steps = [];
  const log   = [];

  log.push({ type: 'info', text: '── Best Fit Algorithm ──' });

  for (let pi = 0; pi < processSizes.length; pi++) {
    const pSize = processSizes[pi];
    const pid   = `P${pi + 1}`;
    let bestIdx = -1;
    let bestRem = Infinity;

    for (let bi = 0; bi < free.length; bi++) {
      if (free[bi].remaining >= pSize && free[bi].remaining < bestRem) {
        bestRem = free[bi].remaining;
        bestIdx = bi;
      }
    }

    if (bestIdx !== -1) {
      const chosen = free[bestIdx];
      const before = chosen.remaining;
      chosen.remaining -= pSize;

      alloc.push({ pid, size: pSize, blockId: chosen.id, status: 'ok', freeAfter: chosen.remaining });
      log.push({ type: 'success', text: `${pid} (${pSize} KB) → Block ${chosen.id} [${before} KB → ${chosen.remaining} KB free]` });

      steps.push({
        pid, size: pSize,
        blockId: chosen.id,
        status: 'ok',
        freeSnapshot: free.map(f => ({ ...f })),
        allocSnapshot: alloc.map(a => ({ ...a })),
        log: `Allocating ${pid} (${pSize} KB) to Block ${chosen.id} (best fit, ${before} KB). Remaining: ${chosen.remaining} KB.`
      });
    } else {
      alloc.push({ pid, size: pSize, blockId: null, status: 'fail', freeAfter: null });
      log.push({ type: 'fail', text: `${pid} (${pSize} KB) → No suitable block found. Allocation failed.` });

      steps.push({
        pid, size: pSize,
        blockId: null,
        status: 'fail',
        freeSnapshot: free.map(f => ({ ...f })),
        allocSnapshot: alloc.map(a => ({ ...a })),
        log: `${pid} (${pSize} KB) could not be allocated — no block is large enough.`
      });
    }
  }

  const totalFree = free.reduce((s, b) => s + b.remaining, 0);
  const succeeded = alloc.filter(a => a.status === 'ok').length;
  const failed    = alloc.filter(a => a.status === 'fail').length;

  return { alloc, steps, log, totalFree, succeeded, failed, free };
}

function runWorstFit(blockSizes, processSizes) {
  const free = blockSizes.map((s, i) => ({ id: i + 1, size: s, remaining: s }));
  const alloc = [];
  const steps = [];
  const log   = [];

  log.push({ type: 'info', text: '── Worst Fit Algorithm ──' });

  for (let pi = 0; pi < processSizes.length; pi++) {
    const pSize = processSizes[pi];
    const pid   = `P${pi + 1}`;
    let worstIdx = -1;
    let worstRem = -1;

    for (let bi = 0; bi < free.length; bi++) {
      if (free[bi].remaining >= pSize && free[bi].remaining > worstRem) {
        worstRem = free[bi].remaining;
        worstIdx = bi;
      }
    }

    if (worstIdx !== -1) {
      const chosen = free[worstIdx];
      const before = chosen.remaining;
      chosen.remaining -= pSize;

      alloc.push({ pid, size: pSize, blockId: chosen.id, status: 'ok', freeAfter: chosen.remaining });
      log.push({ type: 'success', text: `${pid} (${pSize} KB) → Block ${chosen.id} [${before} KB → ${chosen.remaining} KB free]` });

      steps.push({
        pid, size: pSize,
        blockId: chosen.id,
        status: 'ok',
        freeSnapshot: free.map(f => ({ ...f })),
        allocSnapshot: alloc.map(a => ({ ...a })),
        log: `Allocating ${pid} (${pSize} KB) to Block ${chosen.id} (worst fit, ${before} KB). Remaining: ${chosen.remaining} KB.`
      });
    } else {
      alloc.push({ pid, size: pSize, blockId: null, status: 'fail', freeAfter: null });
      log.push({ type: 'fail', text: `${pid} (${pSize} KB) → No suitable block found. Allocation failed.` });

      steps.push({
        pid, size: pSize,
        blockId: null,
        status: 'fail',
        freeSnapshot: free.map(f => ({ ...f })),
        allocSnapshot: alloc.map(a => ({ ...a })),
        log: `${pid} (${pSize} KB) could not be allocated — no block is large enough.`
      });
    }
  }

  const totalFree = free.reduce((s, b) => s + b.remaining, 0);
  const succeeded = alloc.filter(a => a.status === 'ok').length;
  const failed    = alloc.filter(a => a.status === 'fail').length;

  return { alloc, steps, log, totalFree, succeeded, failed, free };
}


// ══════════════════════════════════════════════════════════
//  DOM HELPERS
// ══════════════════════════════════════════════════════════

function $(id) { return document.getElementById(id); }

function show(el) { el.style.display = ''; }
function hide(el) { el.style.display = 'none'; }

function setError(el, msg) { el.textContent = msg; }
function clearError(el)    { el.textContent = ''; }


// ══════════════════════════════════════════════════════════
//  BLOCK / PROCESS LIST RENDERING
// ══════════════════════════════════════════════════════════

function renderBlockList() {
  const list = $('blockList');
  list.innerHTML = '';
  blocks.forEach((size, idx) => {
    const item = document.createElement('div');
    item.className = 'block-item';
    item.setAttribute('role', 'listitem');
    item.innerHTML = `
      <span class="block-item-label">B${idx + 1}</span>
      <input class="block-item-input" type="number" min="1" value="${size}"
             aria-label="Block ${idx + 1} size in KB"
             id="block-input-${idx}" />
      <span class="block-item-unit">KB</span>
      <button class="block-remove-btn" aria-label="Remove block ${idx + 1}" data-idx="${idx}">&#215;</button>
    `;
    list.appendChild(item);

    item.querySelector('.block-item-input').addEventListener('change', e => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val) && val > 0) {
        blocks[idx] = val;
        clearError($('simError'));
      } else {
        e.target.value = blocks[idx];
        setError($('simError'), `Block ${idx + 1}: size must be a positive integer.`);
      }
    });

    item.querySelector('.block-remove-btn').addEventListener('click', () => {
      blocks.splice(idx, 1);
      renderBlockList();
    });
  });
}

function renderProcessList() {
  const list = $('processList');
  list.innerHTML = '';
  processes.forEach((size, idx) => {
    const item = document.createElement('div');
    item.className = 'block-item';
    item.setAttribute('role', 'listitem');
    item.innerHTML = `
      <span class="block-item-label">P${idx + 1}</span>
      <input class="block-item-input" type="number" min="1" value="${size}"
             aria-label="Process ${idx + 1} size in KB"
             id="process-input-${idx}" />
      <span class="block-item-unit">KB</span>
      <button class="block-remove-btn" aria-label="Remove process ${idx + 1}" data-idx="${idx}">&#215;</button>
    `;
    list.appendChild(item);

    item.querySelector('.block-item-input').addEventListener('change', e => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val) && val > 0) {
        processes[idx] = val;
        clearError($('simError'));
      } else {
        e.target.value = processes[idx];
        setError($('simError'), `Process ${idx + 1}: size must be a positive integer.`);
      }
    });

    item.querySelector('.block-remove-btn').addEventListener('click', () => {
      processes.splice(idx, 1);
      renderProcessList();
    });
  });
}


// ══════════════════════════════════════════════════════════
//  SIMULATION RUNNER
// ══════════════════════════════════════════════════════════

function readInputValues() {
  // Flush any in-progress input values
  document.querySelectorAll('.block-item-input').forEach(inp => {
    const val = parseInt(inp.value, 10);
    if (!isNaN(val) && val > 0) {
      const idx = parseInt(inp.id.replace('block-input-', '').replace('process-input-', ''), 10);
      if (inp.id.startsWith('block-input-')) blocks[idx] = val;
      else processes[idx] = val;
    }
  });
}

function validateInputs() {
  if (blocks.length === 0)    return 'Add at least one memory block.';
  if (processes.length === 0) return 'Add at least one process.';
  for (let i = 0; i < blocks.length; i++) {
    if (!Number.isInteger(blocks[i]) || blocks[i] <= 0)
      return `Block ${i + 1} has an invalid size. Use positive integers only.`;
  }
  for (let i = 0; i < processes.length; i++) {
    if (!Number.isInteger(processes[i]) || processes[i] <= 0)
      return `Process ${i + 1} has an invalid size. Use positive integers only.`;
  }
  return null;
}

function runSimulation() {
  readInputValues();
  clearError($('simError'));
  const err = validateInputs();
  if (err) { setError($('simError'), err); return; }

  const algo = $('algorithmSelect').value;
  stopPlay();

  if (algo === 'comparison') {
    runComparisonMode();
    return;
  }

  let result;
  if (algo === 'firstFit')  result = runFirstFit(blocks, processes);
  if (algo === 'bestFit')   result = runBestFit(blocks, processes);
  if (algo === 'worstFit')  result = runWorstFit(blocks, processes);

  simSteps    = result.steps;
  currentStep = -1;

  hide($('comparisonSection'));
  show($('stepControls'));
  show($('memMapSection'));
  show($('allocTableSection'));
  show($('resultsSummary'));
  show($('logSection'));

  renderAllocTable(result.alloc, null);
  renderResults(result.succeeded, result.failed, result.totalFree, blocks.reduce((s, b) => s + b, 0));
  renderExecLog(result.log);

  // Show full final memory map initially
  renderMemMap(blocks, result.alloc, result.free, null);
  updateStepUI();
}

function runComparisonMode() {
  const ff = runFirstFit(blocks, processes);
  const bf = runBestFit(blocks, processes);
  const wf = runWorstFit(blocks, processes);

  hide($('stepControls'));
  hide($('memMapSection'));
  hide($('allocTableSection'));
  hide($('resultsSummary'));
  show($('comparisonSection'));
  show($('logSection'));

  const tbody = $('compTableBody');
  tbody.innerHTML = '';
  const rows = [
    { name: 'First Fit',  cls: 'comp-dot-ff', r: ff },
    { name: 'Best Fit',   cls: 'comp-dot-bf', r: bf },
    { name: 'Worst Fit',  cls: 'comp-dot-wf', r: wf }
  ];
  rows.forEach(({ name, cls, r }) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="comp-dot ${cls}" style="margin-right:8px;"></span>${name}</td>
      <td><span class="status-badge status-ok">${r.succeeded}</span></td>
      <td><span class="status-badge status-fail">${r.failed}</span></td>
      <td>${r.totalFree} KB</td>
    `;
    tbody.appendChild(tr);
  });

  // Detailed per-algorithm breakdown
  const details = $('compDetails');
  details.innerHTML = '';
  rows.forEach(({ name, cls, r }) => {
    const card = document.createElement('div');
    card.className = 'comp-detail-card';
    const rows2 = r.alloc.map(a => `
      <div class="comp-row">
        <span class="comp-row-label">${a.pid} (${a.size} KB)</span>
        <span class="comp-row-val ${a.status === 'ok' ? '' : 'status-fail'}">
          ${a.status === 'ok' ? `Block ${a.blockId}` : 'Not Allocated'}
        </span>
      </div>`).join('');
    card.innerHTML = `
      <div class="comp-detail-title">
        <span class="comp-dot ${cls}"></span>${name}
      </div>
      ${rows2}
      <div class="comp-row" style="margin-top:6px;border-top:1.5px solid var(--slate-200);padding-top:6px">
        <span class="comp-row-label" style="font-weight:600">Free Remaining</span>
        <span class="comp-row-val">${r.totalFree} KB</span>
      </div>`;
    details.appendChild(card);
  });

  // Combined log
  const combined = [
    ...ff.log,
    { type: 'sep', text: '────────────────────────' },
    ...bf.log,
    { type: 'sep', text: '────────────────────────' },
    ...wf.log
  ];
  renderExecLog(combined);
}


// ══════════════════════════════════════════════════════════
//  RENDER HELPERS
// ══════════════════════════════════════════════════════════

function renderMemMap(blockSizes, alloc, freeBlocks, activeBlockId) {
  const wrap = $('memMapWrap');
  wrap.innerHTML = '';

  const total = blockSizes.reduce((s, b) => s + b, 0);
  const row   = document.createElement('div');
  row.className = 'mem-map-row';

  blockSizes.forEach((origSize, idx) => {
    const bid    = idx + 1;
    const freeRec = freeBlocks ? freeBlocks.find(f => f.id === bid) : null;
    const remaining = freeRec ? freeRec.remaining : 0;
    const used = origSize - remaining;
    const pct  = (origSize / total) * 100;

    // One cell per block, show used + free portions
    const cell = document.createElement('div');
    cell.className = 'mem-block';
    cell.style.flex = `0 0 ${pct}%`;
    if (activeBlockId === bid && getHighlight()) cell.classList.add('block-active');

    // Determine how much is used and by whom
    const allocsInBlock = alloc ? alloc.filter(a => a.blockId === bid) : [];

    if (allocsInBlock.length > 0) {
      cell.classList.add('block-alloc');
      const pNames = allocsInBlock.map(a => a.pid).join(', ');
      cell.innerHTML = `
        <span class="mem-block-name">B${bid}</span>
        <span class="mem-block-size">${pNames}</span>
        <span class="mem-block-size">${used}/${origSize} KB</span>
      `;
    } else {
      cell.classList.add('block-free');
      cell.innerHTML = `
        <span class="mem-block-name">B${bid}</span>
        <span class="mem-block-size">${origSize} KB</span>
        <span class="mem-block-size">Free</span>
      `;
    }
    row.appendChild(cell);
  });

  wrap.appendChild(row);
}

function renderAllocTable(alloc, activeIdx) {
  const tbody = $('allocTableBody');
  tbody.innerHTML = '';
  alloc.forEach((a, idx) => {
    const tr = document.createElement('tr');
    if (idx === activeIdx) tr.classList.add('row-active');
    tr.innerHTML = `
      <td>${a.pid}</td>
      <td>${a.size} KB</td>
      <td>${a.blockId !== null ? `Block ${a.blockId}` : '—'}</td>
      <td>
        <span class="status-badge ${a.status === 'ok' ? 'status-ok' : 'status-fail'}">
          ${a.status === 'ok' ? '&#10003; Allocated' : '&#10007; Failed'}
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderResults(succeeded, failed, totalFree, totalMemory) {
  const grid = $('resultsGrid');
  grid.innerHTML = '';

  const cards = [
    { label: 'Total Memory',    value: `${totalMemory} KB`,  cls: '' },
    { label: 'Allocated',       value: succeeded,             cls: 'result-success' },
    { label: 'Failed',          value: failed,                cls: failed > 0 ? 'result-danger' : '' },
    { label: 'Free Remaining',  value: `${totalFree} KB`,     cls: 'result-accent' }
  ];

  cards.forEach(c => {
    const card = document.createElement('div');
    card.className = `result-card ${c.cls}`;
    card.innerHTML = `
      <div class="result-value">${c.value}</div>
      <div class="result-label">${c.label}</div>
    `;
    grid.appendChild(card);
  });
}

function renderExecLog(logLines) {
  const log = $('execLog');
  log.innerHTML = '';
  logLines.forEach(l => {
    const div = document.createElement('div');
    div.className = `log-line log-${l.type || 'info'}`;
    div.textContent = l.text;
    log.appendChild(div);
  });
  log.scrollTop = log.scrollHeight;

  // Honor show log toggle
  const logSec = $('logSection');
  if (getShowLog()) show(logSec);
  else hide(logSec);
}


// ══════════════════════════════════════════════════════════
//  STEP-BY-STEP NAVIGATION
// ══════════════════════════════════════════════════════════

function updateStepUI() {
  const total = simSteps.length;
  $('stepInfo').textContent = `Step ${currentStep + 1} / ${total}`;
  $('stepPrevBtn').disabled = currentStep <= 0;
  $('stepNextBtn').disabled = currentStep >= total - 1;

  if (currentStep < 0) {
    $('stepDetail').textContent = 'Click Next or Play to begin step-by-step walkthrough.';
    return;
  }

  const step = simSteps[currentStep];
  $('stepDetail').textContent = step.log;

  renderMemMap(blocks, step.allocSnapshot, step.freeSnapshot, step.blockId);
  renderAllocTable(step.allocSnapshot, currentStep);
}

function stepNext() {
  if (currentStep < simSteps.length - 1) {
    currentStep++;
    updateStepUI();
  } else {
    stopPlay();
  }
}

function stepPrev() {
  if (currentStep > 0) {
    currentStep--;
    updateStepUI();
  }
}

function startPlay() {
  if (isPlaying) return;
  isPlaying = true;

  const icon = $('stepPlayIcon');
  icon.innerHTML = `<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`;
  $('stepPlayBtn').setAttribute('aria-label', 'Pause simulation');

  if (currentStep >= simSteps.length - 1) currentStep = -1;

  playInterval = setInterval(() => {
    if (currentStep < simSteps.length - 1) {
      currentStep++;
      updateStepUI();
    } else {
      stopPlay();
    }
  }, getPlaySpeed());
}

function stopPlay() {
  if (!isPlaying) return;
  isPlaying = false;
  clearInterval(playInterval);
  playInterval = null;

  const icon = $('stepPlayIcon');
  icon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"/>`;
  $('stepPlayBtn').setAttribute('aria-label', 'Play simulation');
}

function togglePlay() {
  if (isPlaying) stopPlay();
  else startPlay();
}


// ══════════════════════════════════════════════════════════
//  FILE IMPORT (JSON / CSV)
// ══════════════════════════════════════════════════════════

function parseJSON(text) {
  let data;
  try { data = JSON.parse(text); } catch {
    throw new Error('Invalid JSON syntax. Please check your file.');
  }
  if (!Array.isArray(data.blocks) || !Array.isArray(data.processes))
    throw new Error('JSON must have "blocks" and "processes" arrays, e.g. {"blocks":[100,200],"processes":[50,80]}');
  if (data.blocks.length === 0 || data.processes.length === 0)
    throw new Error('blocks and processes arrays must not be empty.');
  const b = data.blocks.map(Number);
  const p = data.processes.map(Number);
  if (b.some(v => isNaN(v) || v <= 0)) throw new Error('All block sizes must be positive integers.');
  if (p.some(v => isNaN(v) || v <= 0)) throw new Error('All process sizes must be positive integers.');
  return { blocks: b, processes: p };
}

function parseCSV(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2)
    throw new Error('CSV must have at least 2 rows: Row 1 = block sizes, Row 2 = process sizes.');
  const b = lines[0].split(',').map(v => parseInt(v.trim(), 10));
  const p = lines[1].split(',').map(v => parseInt(v.trim(), 10));
  if (b.some(v => isNaN(v) || v <= 0)) throw new Error('Row 1 (blocks): all values must be positive integers.');
  if (p.some(v => isNaN(v) || v <= 0)) throw new Error('Row 2 (processes): all values must be positive integers.');
  return { blocks: b, processes: p };
}

function handleFile(file) {
  const errEl = $('importError');
  const label = $('importDropLabel');
  clearError(errEl);

  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['json', 'csv'].includes(ext)) {
    setError(errEl, 'Only .json and .csv files are accepted.');
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    const text = e.target.result;
    try {
      const data = ext === 'json' ? parseJSON(text) : parseCSV(text);
      blocks    = data.blocks;
      processes = data.processes;
      renderBlockList();
      renderProcessList();
      label.innerHTML = `<span style="color:var(--green);font-weight:600">&#10003; Loaded: ${file.name}</span>`;
    } catch (err) {
      setError(errEl, err.message);
      label.innerHTML = 'Drop file here or <u>click to browse</u>';
    }
  };
  reader.onerror = () => setError(errEl, 'Could not read file. Please try again.');
  reader.readAsText(file);
}

function setupFileImport() {
  const zone  = $('importDropzone');
  const input = $('importFileInput');

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') input.click(); });
  input.addEventListener('change', e => handleFile(e.target.files[0]));

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    handleFile(e.dataTransfer.files[0]);
  });
}


// ══════════════════════════════════════════════════════════
//  THREE-DOT MENU
// ══════════════════════════════════════════════════════════

function setupThreeDotMenu() {
  const btn      = $('threeDotBtn');
  const dropdown = $('threeDotDropdown');

  function openMenu() {
    dropdown.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    dropdown.setAttribute('aria-hidden', 'false');
  }
  function closeMenu() {
    dropdown.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    dropdown.setAttribute('aria-hidden', 'true');
  }

  btn.addEventListener('click', e => {
    e.stopPropagation();
    dropdown.classList.contains('open') ? closeMenu() : openMenu();
  });

  document.addEventListener('click', e => {
    if (!$('threeDotWrapper').contains(e.target)) closeMenu();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeMenu();
  });

  // Profile item
  $('menuProfile').addEventListener('click', e => {
    e.preventDefault();
    closeMenu();
    show($('profileModal'));
  });

  // Settings item
  $('menuSettings').addEventListener('click', e => {
    e.preventDefault();
    closeMenu();
    show($('settingsModal'));
  });

  // Logout = reset demo session
  $('menuLogout').addEventListener('click', e => {
    e.preventDefault();
    closeMenu();
    resetSession();
  });
}

function setupModals() {
  $('settingsClose').addEventListener('click', () => hide($('settingsModal')));
  $('profileClose').addEventListener('click',  () => hide($('profileModal')));

  [$('settingsModal'), $('profileModal')].forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) hide(modal);
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      hide($('settingsModal'));
      hide($('profileModal'));
    }
  });
}


// ══════════════════════════════════════════════════════════
//  NAVBAR & SCROLL EFFECTS
// ══════════════════════════════════════════════════════════

function setupNavbar() {
  const navbar = $('navbar');
  const sections = document.querySelectorAll('section[id]');
  const navLinks  = document.querySelectorAll('.nav-link');

  // Scrolled state
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
    highlightActiveNav(sections, navLinks);
  }, { passive: true });

  // Smooth scroll for pill/nav links
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

function highlightActiveNav(sections, navLinks) {
  let current = '';
  sections.forEach(sec => {
    const top = sec.offsetTop - 100;
    if (window.scrollY >= top) current = sec.id;
  });
  navLinks.forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
  });
}


// ══════════════════════════════════════════════════════════
//  SCROLL-TRIGGERED ANIMATIONS
// ══════════════════════════════════════════════════════════

function setupScrollAnimations() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.animate-on-scroll').forEach(el => obs.observe(el));
}


// ══════════════════════════════════════════════════════════
//  RESET / CLEAR
// ══════════════════════════════════════════════════════════

function resetSimulator() {
  stopPlay();
  simSteps    = [];
  currentStep = -1;
  hide($('stepControls'));
  hide($('memMapSection'));
  hide($('allocTableSection'));
  hide($('resultsSummary'));
  hide($('comparisonSection'));
  hide($('logSection'));
  clearError($('simError'));
}

function resetSession() {
  blocks    = [...DEFAULT_BLOCKS];
  processes = [...DEFAULT_PROCESSES];
  renderBlockList();
  renderProcessList();
  resetSimulator();
  $('algorithmSelect').value = 'firstFit';
  clearError($('importError'));
  $('importDropLabel').innerHTML = 'Drop file here or <u>click to browse</u>';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearAll() {
  blocks    = [];
  processes = [];
  renderBlockList();
  renderProcessList();
  resetSimulator();
}


// ══════════════════════════════════════════════════════════
//  VIDEO FALLBACK
// ══════════════════════════════════════════════════════════

function setupVideoFallback() {
  const video = $('heroVideo');
  if (!video) return;
  video.addEventListener('error', () => {
    const wrap = video.closest('.hero-video-wrap');
    if (wrap) {
      wrap.style.background = 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)';
      video.style.display = 'none';
    }
  });
}


// ══════════════════════════════════════════════════════════
//  SHOW LOG TOGGLE
// ══════════════════════════════════════════════════════════

function setupShowLogToggle() {
  $('showLogToggle').addEventListener('change', () => {
    const logSec = $('logSection');
    if (logSec.style.display !== 'none') {
      if (!getShowLog()) hide(logSec);
      else show(logSec);
    }
  });
}


// ══════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════

function init() {
  // Render initial lists
  renderBlockList();
  renderProcessList();

  // Wire controls
  $('addBlockBtn').addEventListener('click', () => {
    blocks.push(100);
    renderBlockList();
  });

  $('addProcessBtn').addEventListener('click', () => {
    processes.push(50);
    renderProcessList();
  });

  $('runBtn').addEventListener('click', runSimulation);
  $('resetBtn').addEventListener('click', resetSimulator);
  $('clearBtn').addEventListener('click', clearAll);

  // Step controls
  $('stepNextBtn').addEventListener('click', stepNext);
  $('stepPrevBtn').addEventListener('click', stepPrev);
  $('stepPlayBtn').addEventListener('click', togglePlay);

  // Keyboard: arrow keys for step navigation
  document.addEventListener('keydown', e => {
    if (simSteps.length === 0) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 'ArrowRight') { e.preventDefault(); stepNext(); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); stepPrev(); }
    if (e.key === ' ')          { e.preventDefault(); togglePlay(); }
  });

  setupFileImport();
  setupThreeDotMenu();
  setupModals();
  setupNavbar();
  setupScrollAnimations();
  setupVideoFallback();
  setupShowLogToggle();
}

document.addEventListener('DOMContentLoaded', init);
