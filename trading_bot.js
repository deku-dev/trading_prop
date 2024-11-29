class CalculationDatabase {
    constructor() {
        this.risks = JSON.parse(localStorage.getItem('risks') || '{}');
        this.calculationHistory = JSON.parse(localStorage.getItem('calculationHistory') || '[]');
    }

    setRisk(riskName, value) {
        this.risks[riskName] = value;
        localStorage.setItem('risks', JSON.stringify(this.risks));
        this.renderRisks();
    }

    getRisks() {
        return this.risks;
    }

    deleteRisk(riskName) {
        delete this.risks[riskName];
        localStorage.setItem('risks', JSON.stringify(this.risks));
        this.renderRisks();
    }

    addCalculationToHistory(calculation) {
        const historyEntry = {
            ...calculation,
            timestamp: new Date().toISOString()
        };
        this.calculationHistory.unshift(historyEntry);
        
        // Limit history to last 10 entries
        if (this.calculationHistory.length > 10) {
            this.calculationHistory = this.calculationHistory.slice(0, 10);
        }
        
        localStorage.setItem('calculationHistory', JSON.stringify(this.calculationHistory));
        this.renderCalculationHistory();
    }

    renderRisks() {
        const risksTableBody = document.getElementById('risksTableBody');
        const risksTable = document.getElementById('risksTable');
        const noRisksMessage = document.getElementById('noRisksMessage');

        risksTableBody.innerHTML = '';

        if (Object.keys(this.risks).length === 0) {
            risksTable.classList.add('hidden');
            noRisksMessage.classList.remove('hidden');
        } else {
            risksTable.classList.remove('hidden');
            noRisksMessage.classList.add('hidden');

            Object.entries(this.risks).forEach(([riskName, value]) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="py-1">${riskName}</td>
                    <td class="text-right">${value}</td>
                    <td class="text-right">
                        <button 
                            onclick="db.deleteRisk('${riskName}')" 
                            class="text-red-500 hover:text-red-700"
                        >
                            Delete
                        </button>
                    </td>
                `;
                risksTableBody.appendChild(row);
            });
        }
    }

    renderCalculationHistory() {
        const historyTableBody = document.getElementById('calculationHistoryTableBody');
        const historyTable = document.getElementById('calculationHistoryTable');
        const noHistoryMessage = document.getElementById('noHistoryMessage');

        historyTableBody.innerHTML = '';

        if (this.calculationHistory.length === 0) {
            historyTable.classList.add('hidden');
            noHistoryMessage.classList.remove('hidden');
        } else {
            historyTable.classList.remove('hidden');
            noHistoryMessage.classList.add('hidden');

            this.calculationHistory.forEach((calc, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="py-1">${calc.ticker}</td>
                    <td class="text-right">${new Date(calc.timestamp).toLocaleString()}</td>
                    <td class="text-right">
                        <button 
                            onclick="showCalculationDetails(${index})" 
                            class="text-blue-500 hover:text-blue-700"
                        >
                            View
                        </button>
                    </td>
                `;
                historyTableBody.appendChild(row);
            });
        }
    }
}

const db = new CalculationDatabase();
db.renderRisks();
db.renderCalculationHistory();

function showCalculationDetails(index) {
    const calculation = db.calculationHistory[index];
    const resultsContainer = document.getElementById('resultsContainer');

    const html = `
        <div class="bg-blue-50 p-4 rounded">
            <h3 class="font-bold">#${calculation.ticker}</h3>
            <div class="mt-2">
                <p>Size для каждого риска:</p>
                <pre class="text-sm">${calculation.sizeResponse}</pre>
                <p class="mt-2">Range: ${calculation.rangeValue.toFixed(2)}</p>
                <p>Тейк: ${calculation.takeProfit.toFixed(4)}</p>
                <p>Шорт - Stop: ${calculation.shortHigh.toFixed(4)}, Limit: ${calculation.shortLow.toFixed(4)}</p>
                <p>Лонг - Stop: ${calculation.longHigh.toFixed(4)}, Limit: ${calculation.longLow.toFixed(4)}</p>
                <p class="mt-2 text-gray-500">Calculated on: ${new Date(calculation.timestamp).toLocaleString()}</p>
            </div>
        </div>
    `;

    resultsContainer.innerHTML = html;
}

function roundToNearest100(value) {
    return Math.ceil(value / 100) * 100;
}

function calculateValues(high, low, risk = null) {
    const rangeValue = (high - low) * 100;
    const sizeValue = risk ? (risk / rangeValue) * 100 : null;
    return [rangeValue, sizeValue];
}

function calculateShortPositions(high, low, rangeValue) {
    const shortHigh = low > 1 ? low - 0.01 : low - 0.001;
    const shortLow = 
        (shortHigh - (shortHigh - (rangeValue / 2)) * 0.01) > high * 0.09
        ? low * 0.91
        : shortHigh - (rangeValue / 2) * 0.01;
    return [shortHigh, shortLow];
}

function calculateLongPositions(high) {
    const longHigh = high > 1 ? high + 0.01 : high + 0.0001;
    const longLow = longHigh * 1.09;
    return [longHigh, longLow];
}

function calculateTakeProfit(low, rangeValue) {
    return low - (rangeValue * 0.01) * 4;
}

function setRisk() {
    const riskNameInput = document.getElementById('riskNameInput');
    const riskValueInput = document.getElementById('riskValueInput');
    
    if (riskNameInput.value && riskValueInput.value) {
        db.setRisk(riskNameInput.value, Number(riskValueInput.value));
        riskNameInput.value = '';
        riskValueInput.value = '';
    }
}

function calculateTrade() {
    const tickerInput = document.getElementById('tickerInput');
    const resultsContainer = document.getElementById('resultsContainer');
    
    const match = tickerInput.value.match(/([A-Z]+)\.([A-Z]+)\s+([-+]?\d*\.\d+|\d+)\s+([-+]?\d*\.\d+|\d+)/);
    
    if (!match) {
        resultsContainer.innerHTML = '<p class="text-red-500">Invalid input format</p>';
        return;
    }

    const [_a, ticker, exchange, highStr, lowStr] = match;
    const high = parseFloat(highStr);
    const low = parseFloat(lowStr);
    
    const risks = db.getRisks();
    if (Object.keys(risks).length === 0) {
        resultsContainer.innerHTML = '<p class="text-red-500">No risk data available</p>';
        return;
    }

    const [rangeValue, _] = calculateValues(high, low);
    const [shortHigh, shortLow] = calculateShortPositions(high, low, rangeValue);
    const [longHigh, longLow] = calculateLongPositions(high);
    const takeProfit = calculateTakeProfit(low, rangeValue);

    const sizeValues = {};
    const sizeResponse = Object.entries(risks).map(([riskName, riskValue]) => {
        const [_, sizeValue] = calculateValues(high, low, riskValue);
        const roundedSize = roundToNearest100(sizeValue);
        sizeValues[riskName] = roundedSize;
        return `Риск: ${riskName}\nSize: <span class="font-bold">${Math.round(sizeValue)}</span>`;
    }).join('\n');

    const html = `
        <div class="bg-blue-50 p-4 rounded">
            <h3 class="font-bold">#<span class="copyable cursor-copy" onclick="copyToClipboard('${ticker}.${exchange}')">${ticker}.${exchange}</span></h3>
            <div class="mt-2">
                <p>Size для каждого риска:</p>
                <pre class="text-sm">${sizeResponse}</pre>
                <p class="mt-2">Range: <span class="copyable font-bold cursor-copy" onclick="copyToClipboard('${rangeValue.toFixed(2)}')">${rangeValue.toFixed(2)}</span></p>
                <p>Тейк: <span class="copyable font-bold cursor-copy" onclick="copyToClipboard('${takeProfit.toFixed(4)}')">${takeProfit.toFixed(4)}</span></p>
                <p>Шорт - Stop: <span class="copyable font-bold cursor-copy" onclick="copyToClipboard('${shortHigh.toFixed(4)}')">${shortHigh.toFixed(4)}</span>, 
                Limit: <span class="copyable font-bold cursor-copy" onclick="copyToClipboard('${shortLow.toFixed(4)}')">${shortLow.toFixed(4)}</span></p>
                <p>Лонг - Stop: <span class="copyable font-bold cursor-copy" onclick="copyToClipboard('${longHigh.toFixed(4)}')">${longHigh.toFixed(4)}</span>, 
                Limit: <span class="copyable font-bold cursor-copy" onclick="copyToClipboard('${longLow.toFixed(4)}')">${longLow.toFixed(4)}</span></p>
            </div>
        </div>
    `;

    resultsContainer.innerHTML = html;

    // Save to history
    db.addCalculationToHistory({
        ticker: `${ticker}.${exchange}`,
        high,
        low,
        rangeValue,
        shortHigh,
        shortLow,
        longHigh,
        longLow,
        takeProfit,
        sizeResponse
    });
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        VanillaToasts.create({
            title: 'Copied',
            type: 'info', 
            text: `Cкопировано: ${text}`,
            timeout: 2000,
            positionClass: 'bottomRight'
          });
    }).catch(err => {
        console.error('Ошибка копирования: ', err);
    });

}
