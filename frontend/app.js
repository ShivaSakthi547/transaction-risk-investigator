document.addEventListener('DOMContentLoaded', async function() {

  /* DOM refs */
  var commandCenter    = document.getElementById('command-center');
  var investigationView = document.getElementById('investigation-view');
  var backBtn          = document.getElementById('back-btn');
  var loadingState     = document.getElementById('loading-state');
  var reportContainer  = document.getElementById('report-container');

  /* Hero scroll */
  function scrollToDashboard() {
    var el = document.getElementById('dashboard-root');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  var si = document.getElementById('scroll-indicator');
  if (si) si.addEventListener('click', scrollToDashboard);
  var cta = document.getElementById('hero-cta-btn');
  if (cta) cta.addEventListener('click', scrollToDashboard);

  /* Boot */
  loadCommandCenter();

  /* ── loadCommandCenter ── */
  async function loadCommandCenter() {
    try {
      var res = await fetch('/api/investigations/overview');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();

      setNum('stat-reviewed', data.metrics.customers_reviewed);
      setNum('stat-attention', data.metrics.attention_required);
      setNum('stat-clean',    data.metrics.no_attention_required);
      setNum('stat-flagged',  data.metrics.flagged_transactions);

      var ab = document.getElementById('attention-body');
      ab.innerHTML = '';
      if (!data.attention_queue || data.attention_queue.length === 0) {
        ab.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:#7a9abf">No cases require attention.</td></tr>';
      } else {
        data.attention_queue.forEach(function(item, i) {
          var tr = document.createElement('tr');
          tr.innerHTML =
            '<td><strong>' + esc(item.customer_name) + '</strong> <span style="color:#7a9abf;font-size:.82rem;">(' + esc(item.customer_id) + ')</span></td>' +
            '<td><span style="color:#ef4444;font-weight:700;">' + item.transactions_count + '</span></td>' +
            '<td style="font-size:.85rem;">' + esc(item.signal) + '</td>' +
            '<td><span style="color:#f59e0b;font-weight:600;">' + esc(item.deviation) + '</span></td>' +
            '<td><button class="small-btn investigate-btn" data-id="' + esc(item.customer_id) + '">View Investigation</button></td>';
          ab.appendChild(tr);
        });
      }

      var cb = document.getElementById('clean-body');
      cb.innerHTML = '';
      if (!data.clean_queue || data.clean_queue.length === 0) {
        cb.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:24px;color:#7a9abf">No clean cases.</td></tr>';
      } else {
        data.clean_queue.forEach(function(item) {
          var tr = document.createElement('tr');
          tr.innerHTML =
            '<td><strong>' + esc(item.customer_name) + '</strong> <span style="color:#7a9abf;font-size:.82rem;">(' + esc(item.customer_id) + ')</span></td>' +
            '<td><span style="color:#10b981;font-weight:600;">&#10003; Clean</span></td>' +
            '<td><button class="small-btn secondary-btn investigate-btn" data-id="' + esc(item.customer_id) + '" style="margin:0">View Details</button></td>';
          cb.appendChild(tr);
        });
      }

      document.querySelectorAll('.investigate-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          startInvestigation(this.getAttribute('data-id'));
        });
      });

    } catch (err) {
      console.error('Overview fetch failed:', err);
      ['stat-reviewed','stat-attention','stat-clean','stat-flagged'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.textContent = 'ERR';
      });
    }
  }

  /* ── Back button ── */
  if (backBtn) {
    backBtn.addEventListener('click', function() {
      investigationView.classList.add('hidden');
      commandCenter.classList.remove('hidden');
      var dr = document.getElementById('dashboard-root');
      if (dr) dr.scrollIntoView({ behavior: 'smooth' });
    });
  }

  /* ── startInvestigation ── */
  async function startInvestigation(customerId) {
    commandCenter.classList.add('hidden');
    investigationView.classList.remove('hidden');
    document.getElementById('investigation-title').textContent = 'Investigating Customer ' + customerId;
    reportContainer.classList.add('hidden');
    loadingState.classList.remove('hidden');
    investigationView.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
      var res = await fetch('/api/investigate/' + customerId);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      renderReport(data);
    } catch (err) {
      console.error('Investigation failed:', err);
      loadingState.innerHTML = '<p style="color:#ef4444">Failed to load investigation. Please try again.</p>';
    }
  }

  /* ── renderReport ── */
  function renderReport(data) {
    loadingState.classList.add('hidden');
    reportContainer.classList.remove('hidden');

    /* Status badge */
    var badge = document.getElementById('status-badge');
    badge.className = 'badge';
    if (data.status === 'no_attention') {
      badge.textContent = '&#10003; No Attention Required';
      badge.classList.add('success');
      document.getElementById('llm-card').style.display = 'none';
    } else {
      badge.textContent = '&#9888; Attention Required - ' + data.findings.length + ' finding' + (data.findings.length !== 1 ? 's' : '');
      badge.classList.add('warning');
      document.getElementById('llm-card').style.display = '';
    }

    /* Fingerprint */
    if (data.fingerprint) {
      var fp = data.fingerprint;
      setText('fp-typical-tx', fp.typical_transaction  || '-');
      setText('fp-transfer',   fp.typical_transfer      || '-');
      setText('fp-hours',      fp.typical_active_hours  || '-');
      setText('fp-payees',     fp.known_payees_count != null ? fp.known_payees_count + ' payees' : '-');
      setText('fp-avg-tx',     fp.avg_tx_per_week     != null ? fp.avg_tx_per_week + ' / week' : '-');
      setText('fp-channel',    fp.preferred_channel     || '-');
    }

    /* Baseline */
    setText('base-transfer', data.baseline.typical_transfer      || '-');
    setText('base-hours',    data.baseline.typical_active_hours  || '-');
    setText('base-channel',  data.baseline.typical_channel       || '-');

    /* LLM */
    if (data.status !== 'no_attention') {
      setText('narrative-text',   data.investigation_narrative || 'No narrative available.');
      setText('check-first-text', data.check_first             || '-');
    }

    /* Findings */
    var fs = document.getElementById('findings-section');
    fs.innerHTML = '';
    if (data.findings && data.findings.length > 0) {
      var h = document.createElement('h3');
      h.textContent = 'Deterministic Rule Findings';
      fs.appendChild(h);
      data.findings.forEach(function(f, i) {
        var card = document.createElement('div');
        card.className = 'finding-card';
        card.style.animationDelay = (0.1 + i * 0.1) + 's';
        var tags = (f.transaction_ids || []).map(function(id) {
          return '<span class="tx-tag highlight-trigger" data-txid="' + esc(id) + '" tabindex="0">' + esc(id) + '</span>';
        }).join('');
        var devHtml = f.deviation_label ? '<div class="deviation-label">&#8593; ' + esc(f.deviation_label) + '</div>' : '';
        card.innerHTML =
          '<div class="finding-header"><div class="finding-rule">' + esc(f.rule_name) + '</div></div>' +
          devHtml +
          '<div class="finding-desc">' + esc(f.observed_vs_baseline) + '</div>' +
          '<div class="tx-tags">' + tags + '</div>';
        fs.appendChild(card);
      });
    }

    /* Connections */
    var cs = document.getElementById('connections-section');
    cs.innerHTML = '';
    if (data.connections && data.connections.length > 0) {
      var h2 = document.createElement('h3');
      h2.textContent = 'Connection Analysis';
      cs.appendChild(h2);
      data.connections.forEach(function(c, i) {
        var item = document.createElement('div');
        item.className = 'connection-item';
        item.style.animationDelay = (0.1 + i * 0.1) + 's';
        item.innerHTML =
          '<div class="connection-icon" aria-hidden="true">&#128279;</div>' +
          '<div><div style="font-size:.92rem;margin-bottom:5px;font-weight:500;">' + esc(c.narrative) + '</div>' +
          '<div style="font-size:.78rem;color:#7a9abf;font-family:monospace;">Linked IDs: ' + (c.transaction_ids || []).map(esc).join(', ') + '</div></div>';
        cs.appendChild(item);
      });
    }

    /* Timeline */
    renderTimeline(data);

    /* Raw transactions */
    var rb = document.getElementById('raw-tx-body');
    rb.innerHTML = '';
    var flaggedSet = new Set();
    (data.findings || []).forEach(function(f) {
      (f.transaction_ids || []).forEach(function(id) { flaggedSet.add(id); });
    });
    (data.raw_transactions || []).forEach(function(tx) {
      var tr = document.createElement('tr');
      tr.id = 'tx-row-' + tx.transaction_id;
      if (flaggedSet.has(tx.transaction_id)) tr.style.borderLeft = '3px solid #ef4444';
      tr.innerHTML =
        '<td style="font-family:monospace;font-size:.82rem;color:#3b82f6;">' + esc(tx.transaction_id) + '</td>' +
        '<td style="font-size:.88rem;">' + esc(String(tx.datetime)) + '</td>' +
        '<td style="font-weight:600;">&#8377;' + Number(tx.amount).toLocaleString('en-IN', {maximumFractionDigits:2}) + '</td>' +
        '<td>' + esc(tx.payee) + '</td>' +
        '<td><span style="background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.2);border-radius:4px;padding:2px 8px;font-size:.8rem;">' + esc(tx.channel) + '</span></td>';
      rb.appendChild(tr);
    });

    attachHighlights();
  }

  /* ── Timeline ── */
  function renderTimeline(data) {
    var container = document.getElementById('timeline-container');
    container.innerHTML = '';
    var txs = (data.raw_transactions || []).slice().sort(function(a,b) {
      return new Date(a.datetime) - new Date(b.datetime);
    });
    if (txs.length === 0) return;

    var flaggedIds  = new Set();
    var newPayeeIds = new Set();
    var ruleByTx   = {};
    (data.findings || []).forEach(function(f) {
      (f.transaction_ids || []).forEach(function(id) {
        flaggedIds.add(id);
        if (!ruleByTx[id]) ruleByTx[id] = [];
        ruleByTx[id].push(f.rule_name);
        if (f.id === 'rule_new_payee_burst') newPayeeIds.add(id);
      });
    });

    var MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    function fmtDate(dt) { var d=new Date(dt); return MONTHS[d.getMonth()]+' '+String(d.getDate()).padStart(2,'0'); }
    function fmtTime(dt) { var d=new Date(dt); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }

    var lastDate = null, nodeIdx = 0;
    txs.forEach(function(tx) {
      var ds = fmtDate(tx.datetime), ts = fmtTime(tx.datetime);
      if (ds !== lastDate) {
        lastDate = ds;
        var lbl = document.createElement('div');
        lbl.className = 'tl-date-label'; lbl.textContent = ds;
        container.appendChild(lbl);
      }
      var isFlagged  = flaggedIds.has(tx.transaction_id);
      var isNewPayee = newPayeeIds.has(tx.transaction_id);
      var rules = ruleByTx[tx.transaction_id] || [];
      var cls = 'tl-node' + (isFlagged ? ' flagged' : isNewPayee ? ' warning' : '');
      var title = rules.length > 0 ? rules.join(' + ') : 'Normal transaction';
      var badges = (isFlagged ? '<span class="tl-badge flagged">Flagged</span>' : '') +
                   (isNewPayee && !isFlagged ? '<span class="tl-badge new-payee">New Payee</span>' : '');
      var amt = '&#8377;' + Number(tx.amount).toLocaleString('en-IN', {maximumFractionDigits:2});
      var node = document.createElement('div');
      node.className = cls;
      node.style.animationDelay = (0.05 + nodeIdx * 0.06) + 's';
      node.innerHTML =
        '<div class="tl-dot"></div>' +
        '<div class="tl-content">' +
          '<div class="tl-time">' + ds + '&nbsp;&nbsp;' + ts + '</div>' +
          '<div class="tl-title">' + esc(title) + badges + '</div>' +
          '<div class="tl-meta"><span>' + amt + '</span><span>' + esc(tx.payee) + '</span><span>' + esc(tx.channel) + '</span></div>' +
          '<span class="tl-tx-link highlight-trigger" data-txid="' + esc(tx.transaction_id) + '" tabindex="0">' + esc(tx.transaction_id) + '</span>' +
        '</div>';
      container.appendChild(node);
      nodeIdx++;
    });

    var isAttn = data.status === 'attention_required';
    var term = document.createElement('div');
    term.className = 'tl-terminus';
    term.innerHTML = '<div class="tl-terminus-arrow"></div><div class="tl-terminus-badge ' + (isAttn ? 'danger' : 'success') + '">' + (isAttn ? '&#9888; Attention Required' : '&#10003; No Attention Required') + '</div>';
    container.appendChild(term);

    container.querySelectorAll('.tl-tx-link').forEach(function(link) {
      link.addEventListener('click', function() { hlRow(this.getAttribute('data-txid')); });
    });
  }

  /* ── Helpers ── */
  function attachHighlights() {
    document.querySelectorAll('.highlight-trigger').forEach(function(el) {
      el.addEventListener('click', function() { hlRow(this.getAttribute('data-txid')); });
    });
  }
  function hlRow(txid) {
    var row = document.getElementById('tx-row-' + txid);
    if (!row) return;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.add('tx-highlight');
    setTimeout(function() { row.classList.remove('tx-highlight'); }, 2200);
  }
  function setText(id, val) { var e=document.getElementById(id); if(e) e.textContent=val; }
  function setNum(id, val) { var e=document.getElementById(id); if(e) e.textContent=val; }
  function esc(s) {
    if (s==null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
});