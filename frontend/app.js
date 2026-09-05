document.addEventListener('DOMContentLoaded', async () => {
    const customerSelect = document.getElementById('customer-select');
    const investigateBtn = document.getElementById('investigate-btn');
    const loadingState = document.getElementById('loading-state');
    const reportContainer = document.getElementById('report-container');

    // Fetch customers
    try {
        const res = await fetch('/api/customers');
        const data = await res.json();
        data.customers.forEach(c => {
            const option = document.createElement('option');
            option.value = c.customer_id;
            option.textContent = `${c.name} (${c.customer_id})`;
            customerSelect.appendChild(option);
        });
    } catch (e) {
        console.error("Failed to load customers", e);
    }

    customerSelect.addEventListener('change', () => {
        investigateBtn.disabled = !customerSelect.value;
    });

    investigateBtn.addEventListener('click', async () => {
        const customerId = customerSelect.value;
        if (!customerId) return;

        // Reset UI
        reportContainer.classList.add('hidden');
        loadingState.classList.remove('hidden');
        investigateBtn.disabled = true;
        customerSelect.disabled = true;

        try {
            const res = await fetch(`/api/investigate/${customerId}`);
            const data = await res.json();
            renderReport(data);
        } catch (e) {
            console.error("Investigation failed", e);
            alert("Failed to run investigation.");
            loadingState.classList.add('hidden');
            investigateBtn.disabled = false;
            customerSelect.disabled = false;
        }
    });

    function renderReport(data) {
        loadingState.classList.add('hidden');
        reportContainer.classList.remove('hidden');
        investigateBtn.disabled = false;
        customerSelect.disabled = false;

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
                
                const tags = f.transaction_ids.map(id => `<span class="tx-tag" onclick="alert('Raw ID: ${id}')">${id}</span>`).join('');
                
                card.innerHTML = `
                    <div class="finding-header">
                        <div class="finding-rule">${f.rule_name}</div>
                    </div>
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
    }
});
