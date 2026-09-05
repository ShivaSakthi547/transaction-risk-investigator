document.addEventListener('DOMContentLoaded', async () => {
    const commandCenter = document.getElementById('command-center');
    const investigationView = document.getElementById('investigation-view');
    const backBtn = document.getElementById('back-btn');
    
    const loadingState = document.getElementById('loading-state');
    const reportContainer = document.getElementById('report-container');

    // Load Command Center data
    await loadCommandCenter();

    async function loadCommandCenter() {
        try {
            const res = await fetch('/api/investigations/overview');
            const data = await res.json();
            
            // Populate metrics
            document.getElementById('stat-reviewed').textContent = data.metrics.customers_reviewed;
            document.getElementById('stat-attention').textContent = data.metrics.attention_required;
            document.getElementById('stat-clean').textContent = data.metrics.no_attention_required;
            document.getElementById('stat-flagged').textContent = data.metrics.flagged_transactions;

            // Populate Attention Queue
            const attentionBody = document.getElementById('attention-body');
            attentionBody.innerHTML = '';
            
            if (!data.attention_queue || data.attention_queue.length === 0) {
                attentionBody.innerHTML = '<tr><td colspan="5" style="text-align:center">No cases require attention.</td></tr>';
            } else {
                data.attention_queue.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${item.customer_name} (${item.customer_id})</td>
                        <td>${item.transactions_count}</td>
                        <td>${item.signal}</td>
                        <td>${item.deviation}</td>
                        <td><button class="small-btn investigate-btn" data-id="${item.customer_id}">View Investigation</button></td>
                    `;
                    attentionBody.appendChild(tr);
                });
            }

            // Populate Clean Queue
            const cleanBody = document.getElementById('clean-body');
            cleanBody.innerHTML = '';
            
            if (!data.clean_queue || data.clean_queue.length === 0) {
                cleanBody.innerHTML = '<tr><td colspan="3" style="text-align:center">No clean cases.</td></tr>';
            } else {
                data.clean_queue.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${item.customer_name} (${item.customer_id})</td>
                        <td><span style="color: var(--success)">Clean</span></td>
                        <td><button class="small-btn secondary-btn investigate-btn" data-id="${item.customer_id}" style="margin:0">View Details</button></td>
                    `;
                    cleanBody.appendChild(tr);
                });
            }

            // Attach event listeners to new buttons
            document.querySelectorAll('.investigate-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const customerId = e.target.getAttribute('data-id');
                    startInvestigation(customerId);
                });
            });

        } catch (e) {
            console.error("Failed to load overview", e);
        }
    }

    backBtn.addEventListener('click', () => {
        investigationView.classList.add('hidden');
        commandCenter.classList.remove('hidden');
    });

    async function startInvestigation(customerId) {
        commandCenter.classList.add('hidden');
        investigationView.classList.remove('hidden');
        
        document.getElementById('investigation-title').textContent = `Investigating Customer ${customerId}`;
        
        // Reset UI
        reportContainer.classList.add('hidden');
        loadingState.classList.remove('hidden');

        try {
            const res = await fetch(`/api/investigate/${customerId}`);
            const data = await res.json();
            renderReport(data);
        } catch (e) {
            console.error("Investigation failed", e);
            alert("Failed to run investigation.");
            loadingState.classList.add('hidden');
        }
    }

    function renderReport(data) {
        loadingState.classList.add('hidden');
        reportContainer.classList.remove('hidden');

        // Status Badge
        const badge = document.getElementById('status-badge');
        badge.className = 'badge'; // reset
        if (data.status === 'no_attention') {
            badge.textContent = '✓ No Attention Required';
            badge.classList.add('success');
            document.getElementById('llm-card').style.display = 'none';
        } else {
            badge.textContent = `⚠ Attention Required (${data.findings.length} findings)`;
            badge.classList.add('warning');
            document.getElementById('llm-card').style.display = 'block';
        }

        // Behavioral Fingerprint
        if (data.fingerprint) {
            const fp = data.fingerprint;
            document.getElementById('fp-typical-tx').textContent  = fp.typical_transaction  || '—';
            document.getElementById('fp-transfer').textContent    = fp.typical_transfer      || '—';
            document.getElementById('fp-hours').textContent       = fp.typical_active_hours  || '—';
            document.getElementById('fp-payees').textContent      = fp.known_payees_count    != null ? fp.known_payees_count : '—';
            document.getElementById('fp-avg-tx').textContent      = fp.avg_tx_per_week       != null ? fp.avg_tx_per_week   : '—';
            document.getElementById('fp-channel').textContent     = fp.preferred_channel     || '—';
            document.getElementById('fingerprint-card').style.animation = 'fadeInUp 0.6s forwards 0.1s';
        }

        // Baseline Card
        document.getElementById('base-transfer').textContent = data.baseline.typical_transfer;
        document.getElementById('base-hours').textContent = data.baseline.typical_active_hours;
        document.getElementById('base-channel').textContent = data.baseline.typical_channel;

        const baselineCard = document.getElementById('baseline-card');
        baselineCard.style.animation = 'fadeInUp 0.6s forwards 0.2s';

        // LLM Card
        if (data.status !== 'no_attention') {
            document.getElementById('narrative-text').textContent = data.investigation_narrative;
            document.getElementById('check-first-text').textContent = data.check_first;
            const llmCard = document.getElementById('llm-card');
            llmCard.style.animation = 'fadeInUp 0.6s forwards 0.4s';
        }

        // Findings
        const findingsSection = document.getElementById('findings-section');
        findingsSection.innerHTML = '';
        if (data.findings && data.findings.length > 0) {
            const title = document.createElement('h3');
            title.textContent = 'Deterministic Rule Findings';
            title.style.opacity = '0';
            title.style.animation = 'fadeIn 0.5s forwards 0.6s';
            findingsSection.appendChild(title);

            data.findings.forEach((f, i) => {
                const card = document.createElement('div');
                card.className = 'finding-card';
                card.style.animation = `fadeInLeft 0.5s forwards ${0.7 + (i * 0.1)}s`;
                
                const tags = f.transaction_ids.map(id => `<span class="tx-tag highlight-trigger" data-txid="${id}">${id}</span>`).join('');
                const deviationHtml = f.deviation_label
                    ? `<div class="deviation-label">↑ ${f.deviation_label}</div>`
                    : '';
                
                card.innerHTML = `
                    <div class="finding-header">
                        <div class="finding-rule">${f.rule_name}</div>
                    </div>
                    ${deviationHtml}
                    <div class="finding-desc">${f.observed_vs_baseline}</div>
                    <div class="tx-tags">${tags}</div>
                `;
                findingsSection.appendChild(card);
            });
        }

        // Connections
        const connectionsSection = document.getElementById('connections-section');
        connectionsSection.innerHTML = '';
        if (data.connections && data.connections.length > 0) {
            const title = document.createElement('h3');
            title.textContent = 'Connection Analysis';
            title.style.opacity = '0';
            title.style.animation = 'fadeIn 0.5s forwards 1.0s';
            connectionsSection.appendChild(title);

            data.connections.forEach((c, i) => {
                const item = document.createElement('div');
                item.className = 'connection-item';
                item.style.animation = `fadeIn 0.5s forwards ${1.1 + (i * 0.1)}s`;
                
                item.innerHTML = `
                    <div class="connection-icon"></div>
                    <div>
                        <div style="font-size: 0.95rem; margin-bottom: 4px;">${c.narrative}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary); font-family: monospace;">Linked IDs: ${c.transaction_ids.join(', ')}</div>
                    </div>
                `;
                connectionsSection.appendChild(item);
            });
        }

        // Investigation Timeline
        renderTimeline(data);

        // Raw Transactions Table
        const rawTxBody = document.getElementById('raw-tx-body');
        rawTxBody.innerHTML = '';
        if (data.raw_transactions && data.raw_transactions.length > 0) {
            data.raw_transactions.forEach(tx => {
                const tr = document.createElement('tr');
                tr.id = `tx-row-${tx.transaction_id}`;
                tr.innerHTML = `
                    <td style="font-family: monospace;">${tx.transaction_id}</td>
                    <td>${tx.datetime}</td>
                    <td>₹${Number(tx.amount).toLocaleString('en-IN')}</td>
                    <td>${tx.payee}</td>
                    <td>${tx.channel}</td>
                `;
                rawTxBody.appendChild(tr);
            });
        }

        // Attach click handlers to tx tags to scroll & highlight
        document.querySelectorAll('.highlight-trigger').forEach(tag => {
            tag.addEventListener('click', (e) => {
                const txid = e.target.getAttribute('data-txid');
                const row = document.getElementById(`tx-row-${txid}`);
                if (row) {
                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    row.style.transition = "background-color 0.5s ease";
                    row.style.backgroundColor = "rgba(239, 68, 68, 0.3)"; // highlight red briefly
                    setTimeout(() => {
                        row.style.backgroundColor = "transparent";
                    }, 2000);
                }
            });
        });
    }

    function renderTimeline(data) {
        const container = document.getElementById('timeline-container');
        container.innerHTML = '';

        const txs = (data.raw_transactions || []).slice().sort(
            (a, b) => new Date(a.datetime) - new Date(b.datetime)
        );

        if (txs.length === 0) return;

        // Build a set of all flagged transaction IDs from findings
        const flaggedIds   = new Set();
        const newPayeeIds  = new Set();
        const ruleByTx     = {};          // txid -> [rule_name, ...]
        (data.findings || []).forEach(f => {
            f.transaction_ids.forEach(id => {
                flaggedIds.add(id);
                if (!ruleByTx[id]) ruleByTx[id] = [];
                ruleByTx[id].push(f.rule_name);
                if (f.id === 'rule_new_payee_burst') newPayeeIds.add(id);
            });
        });

        const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

        function fmtDate(dt) {
            const d = new Date(dt);
            return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2,'0')}`;
        }

        function fmtTime(dt) {
            const d = new Date(dt);
            return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        }

        let lastDate = null;
        let nodeIndex = 0;

        txs.forEach(tx => {
            const dateStr = fmtDate(tx.datetime);
            const timeStr = fmtTime(tx.datetime);

            // Date separator
            if (dateStr !== lastDate) {
                lastDate = dateStr;
                const dateLbl = document.createElement('div');
                dateLbl.className = 'tl-date-label';
                dateLbl.textContent = dateStr;
                container.appendChild(dateLbl);
            }

            const isFlagged  = flaggedIds.has(tx.transaction_id);
            const isNewPayee = newPayeeIds.has(tx.transaction_id);
            const rules = ruleByTx[tx.transaction_id] || [];

            // Determine node class
            let nodeClass = 'tl-node';
            if (isFlagged)        nodeClass += ' flagged';
            else if (isNewPayee)  nodeClass += ' warning';

            // Determine title
            let title = 'Normal transaction';
            if (rules.length > 0) title = rules.join(' + ');

            // Badges
            let badgesHtml = '';
            if (isFlagged)  badgesHtml += `<span class="tl-badge flagged">Flagged</span>`;
            if (isNewPayee && !isFlagged) badgesHtml += `<span class="tl-badge new-payee">New Payee</span>`;

            const amountFmt = `₹${Number(tx.amount).toLocaleString('en-IN')}`;

            const delay = 0.05 + nodeIndex * 0.06;
            const node = document.createElement('div');
            node.className = nodeClass;
            node.style.animationDelay = `${delay}s`;

            node.innerHTML = `
                <div class="tl-dot"></div>
                <div class="tl-content">
                    <div class="tl-time">${dateStr} &nbsp;${timeStr}</div>
                    <div class="tl-title">${title}${badgesHtml}</div>
                    <div class="tl-meta">
                        <span>${amountFmt}</span>
                        <span>${tx.payee}</span>
                        <span>${tx.channel}</span>
                    </div>
                    <span class="tl-tx-link highlight-trigger" data-txid="${tx.transaction_id}">${tx.transaction_id}</span>
                </div>
            `;
            container.appendChild(node);
            nodeIndex++;
        });

        // Terminal node
        const isAttention = data.status === 'attention_required';
        const terminus = document.createElement('div');
        terminus.className = 'tl-terminus';
        terminus.innerHTML = `
            <div class="tl-terminus-arrow"></div>
            <div class="tl-terminus-badge ${isAttention ? 'danger' : 'success'}">
                ${isAttention ? 'Attention Required' : 'No Attention Required'}
            </div>
        `;
        container.appendChild(terminus);

        // Wire up click-to-highlight for tl-tx-link nodes (re-use existing handler logic)
        container.querySelectorAll('.tl-tx-link').forEach(link => {
            link.addEventListener('click', e => {
                const txid = e.target.getAttribute('data-txid');
                const row  = document.getElementById(`tx-row-${txid}`);
                if (row) {
                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    row.style.transition = 'background-color 0.5s ease';
                    row.style.backgroundColor = 'rgba(239, 68, 68, 0.3)';
                    setTimeout(() => { row.style.backgroundColor = 'transparent'; }, 2000);
                }
            });
        });
    }
});
