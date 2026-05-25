// Base de données exhaustive des paramètres d'un MOSFET
const mosfetParameters = [
    { id: "vds", symbol: "V_DS", desc: "Tension Drain-Source maximale", unit: "V" },
    { id: "id", symbol: "I_D", desc: "Courant de Drain continu", unit: "A" },
    { id: "rdson", symbol: "R_DS(on)", desc: "Résistance à l'état passant", unit: "mΩ" },
    { id: "vgsth", symbol: "V_GS(th)", desc: "Tension de seuil Grille", unit: "V" },
    { id: "qg", symbol: "Q_g", desc: "Charge totale de grille", unit: "nC" },
    { id: "qgs", symbol: "Q_gs", desc: "Charge Grille-Source", unit: "nC" },
    { id: "qgd", symbol: "Q_gd", desc: "Charge Grille-Drain (Miller)", unit: "nC" },
    { id: "tdon", symbol: "t_d(on)", desc: "Temps de retard à l'allumage", unit: "ns" },
    { id: "tr", symbol: "t_r", desc: "Temps de montée", unit: "ns" },
    { id: "tdoff", symbol: "t_d(off)", desc: "Temps de retard à l'extinction", unit: "ns" },
    { id: "tf", symbol: "t_f", desc: "Temps de descente", unit: "ns" },
    { id: "ciss", symbol: "C_iss", desc: "Capacité d'entrée", unit: "pF" },
    { id: "coss", symbol: "C_oss", desc: "Capacité de sortie", unit: "pF" },
    { id: "crss", symbol: "C_rss", desc: "Capacité de transfert inverse", unit: "pF" },
    { id: "vsd", symbol: "V_SD", desc: "Tension directe de la diode (Body Diode)", unit: "V" },
    { id: "trr", symbol: "t_rr", desc: "Temps de recouvrement inverse", unit: "ns" },
    { id: "qrr", symbol: "Q_rr", desc: "Charge de recouvrement inverse", unit: "nC" },
    { id: "rthjc", symbol: "R_θJC", desc: "Résistance thermique Jonction-Boîtier", unit: "°C/W" },
    { id: "rthja", symbol: "R_θJA", desc: "Résistance thermique Jonction-Ambiant", unit: "°C/W" },
    { id: "tjmax", symbol: "T_J(max)", desc: "Température de jonction maximale", unit: "°C" }
];

// État de l'application
let library = [];
let currentSelectedFile = null;
let db;

let nameMOSFET_A = "MOSFET A";
let nameMOSFET_B = "MOSFET B";
let dashboardChartInstance = null;

// --- GESTION DE LA BASE DE DONNÉES (IndexedDB) ---

function initDB() {
    const request = indexedDB.open("ESC_Datasheets_DB", 1);
    
    request.onupgradeneeded = function(event) {
        db = event.target.result;
        if (!db.objectStoreNames.contains("pdfs")) {
            db.createObjectStore("pdfs", { keyPath: "id", autoIncrement: true });
        }
    };
    
    request.onsuccess = function(event) {
        db = event.target.result;
        loadLibraryFromDB();
    };
    
    request.onerror = function(event) {
        console.error("Erreur d'ouverture IndexedDB", event);
    };
}

function loadLibraryFromDB(selectLast = false) {
    const transaction = db.transaction(["pdfs"], "readonly");
    const store = transaction.objectStore("pdfs");
    const request = store.getAll();
    
    request.onsuccess = function() {
        library = request.result;
        
        if (selectLast && library.length > 0) {
            currentSelectedFile = library.length - 1;
            document.getElementById("btn-extract-A").disabled = false;
            document.getElementById("btn-extract-B").disabled = false;
            initTable();
        }
        renderLibrary();
    };
}

function deleteFile(id, event) {
    event.stopPropagation();
    const transaction = db.transaction(["pdfs"], "readwrite");
    const store = transaction.objectStore("pdfs");
    store.delete(id);
    
    transaction.oncomplete = function() {
        currentSelectedFile = null;
        document.getElementById("btn-extract-A").disabled = true;
        document.getElementById("btn-extract-B").disabled = true;
        initTable();
        loadLibraryFromDB();
    };
}

// --- INTERFACE ET LOGIQUE ---

function initTable() {
    const tbody = document.getElementById("table-body");
    if (tbody.children.length > 0) return;
    tbody.innerHTML = ""; 
    
    mosfetParameters.forEach(param => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong>${param.symbol}</strong></td>
            <td>${param.desc}</td>
            <td><input type="number" id="input-A-${param.id}" step="any" placeholder="Ex: 2.5"></td>
            <td><input type="number" id="input-B-${param.id}" step="any" placeholder="Ex: 1.8"></td>
            <td>${param.unit}</td>
        `;
        tbody.appendChild(row);
    });
}

function updateNamesInUI() {
    document.querySelectorAll(".name-A").forEach(el => el.textContent = nameMOSFET_A);
    document.querySelectorAll(".name-B").forEach(el => el.textContent = nameMOSFET_B);
}

document.getElementById("pdf-upload").addEventListener("change", function(event) {
    const files = event.target.files;
    let addedFiles = 0;
    
    const transaction = db.transaction(["pdfs"], "readwrite");
    const store = transaction.objectStore("pdfs");
    
    for (let file of files) {
        if (file.type === "application/pdf") {
            store.add({ name: file.name, file: file, date: new Date().getTime() });
            addedFiles++;
        }
    }
    
    transaction.oncomplete = function() {
        if (addedFiles > 0) {
            showConfirmation(`${addedFiles} datasheet(s) sauvegardée(s) définitivement !`);
            loadLibraryFromDB(true);
        }
    };
    event.target.value = ""; 
});

function showConfirmation(message) {
    const confDiv = document.getElementById("upload-confirmation");
    confDiv.textContent = "✅ " + message;
    confDiv.style.display = "block";
    setTimeout(() => confDiv.style.display = "none", 3000);
}

function renderLibrary() {
    const tbody = document.getElementById("pdf-list-body");
    tbody.innerHTML = "";
    
    if (library.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:#94a3b8;">Aucun PDF stocké</td></tr>`;
        return;
    }

    library.forEach((item, index) => {
        const tr = document.createElement("tr");
        if (currentSelectedFile === index) tr.classList.add("selected");
        const shortName = item.name.length > 20 ? item.name.substring(0, 17) + "..." : item.name;
        
        tr.innerHTML = `
            <td title="${item.name}">📄 ${shortName}</td>
            <td style="white-space: nowrap;">
                <button class="btn-small" onclick="selectFile(${index})">Voir</button>
                <button class="btn-danger" onclick="deleteFile(${item.id}, event)">X</button>
            </td>
        `;
        tr.addEventListener("click", () => selectFile(index));
        tbody.appendChild(tr);
    });
}

function selectFile(index) {
    currentSelectedFile = index;
    renderLibrary();
    document.getElementById("btn-extract-A").disabled = false;
    document.getElementById("btn-extract-B").disabled = false;
}

// --- PARSER GÉOMÉTRIQUE ROBUSTE LINE-BY-LINE ---

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
    let structuredText = "";
    
    const maxPages = Math.min(pdf.numPages, 4); 
    for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        let lines = {};
        const yTolerance = 4; 
        
        textContent.items.forEach(item => {
            if (!item.str.trim()) return;
            
            const x = item.transform[4]; 
            const y = item.transform[5]; 
            
            let foundY = Object.keys(lines).find(existingY => Math.abs(existingY - y) <= yTolerance);
            
            if (!foundY) {
                lines[y] = [{ x: x, str: item.str }];
            } else {
                lines[foundY].push({ x: x, str: item.str });
            }
        });
        
        let pageText = Object.keys(lines)
            .sort((a, b) => b - a) 
            .map(y => {
                return lines[y]
                    .sort((a, b) => a.x - b.x) 
                    .map(item => item.str)
                    .join("\t"); 
            })
            .join("\n");
            
        structuredText += pageText + "\n";
    }
    return structuredText;
}

function localRegexExtractor(matrixText) {
    const lines = matrixText.split('\n');
    const extracted = {};
    
    mosfetParameters.forEach(p => extracted[p.id] = null);

    const patterns = {
        vds: /(?:V_\(BR\)DSS|V_?DS|Drain-to-source voltage)/i,
        id: /(?:I_?D|Continuous drain current)/i,
        rdson: /(?:R_?DS\s*\(on\)|RDS\(on\)|On Resistance)/i,
        vgsth: /(?:V_?GS\s*\(th\)|VGS\(th\)|Gate-to-source threshold)/i,
        qg: /(?:Q_?g|Total gate charge)/i,
        qgs: /(?:Q_?gs|Gate-to-source charge)/i,
        qgd: /(?:Q_?gd|Gate-to-drain charge)/i,
        tdon: /(?:t_?d\s*\(on\)|turn-on delay)/i,
        tr: /(?:t_?r|rise time)/i,
        tdoff: /(?:t_?d\s*\(off\)|turn-off delay)/i,
        tf: /(?:t_?f|fall time)/i,
        ciss: /(?:C_?iss|Input capacitance)/i,
        coss: /(?:C_?oss|Output capacitance)/i,
        crss: /(?:C_?rss|Reverse transfer capacitance)/i,
        vsd: /(?:V_?SD|Source-drain forward|Diode forward)/i,
        trr: /(?:t_?rr|Reverse recovery time)/i,
        qrr: /(?:Q_?rr|Reverse recovery charge)/i
    };

    lines.forEach(line => {
        Object.keys(patterns).forEach(key => {
            if (extracted[key] !== null) return;

            if (patterns[key].test(line)) {
                const numbers = line.match(/[0-9]+[.,][0-9]+|[0-9]+/g);
                if (numbers) {
                    let selectedValue = null;
                    for (let i = numbers.length - 1; i >= 0; i--) {
                        let val = parseFloat(numbers[i].replace(',', '.'));
                        
                        if ((key === 'rdson' && val > 100) || val === 20 || val === 30) {
                            if (numbers.length > 1) continue; 
                        }
                        selectedValue = val;
                        break;
                    }
                    if (selectedValue !== null) extracted[key] = selectedValue;
                }
            }
        });
    });

    return extracted;
}

async function runExtractionForTarget(target, btnElement) {
    if (currentSelectedFile === null) return;

    const originalText = btnElement.textContent;
    btnElement.textContent = "Scanning...";
    btnElement.disabled = true;
    
    try {
        const fileItem = library[currentSelectedFile];
        const cleanedName = fileItem.name.replace(/\.[^/.]+$/, ""); 
        if (target === 'A') nameMOSFET_A = cleanedName;
        if (target === 'B') nameMOSFET_B = cleanedName;
        updateNamesInUI(); 
        
        const rawStructuredText = await extractTextFromPDF(fileItem.file);
        const extractedData = localRegexExtractor(rawStructuredText);
        
        Object.keys(extractedData).forEach(key => {
            const inputEl = document.getElementById(`input-${target}-${key}`);
            if (inputEl) {
                if (extractedData[key] !== null) {
                    inputEl.value = extractedData[key];
                    inputEl.style.backgroundColor = target === 'A' ? "#dbeafe" : "#fee2e2"; 
                    setTimeout(() => inputEl.style.backgroundColor = "transparent", 2000);
                } else {
                    inputEl.placeholder = "Non trouvé";
                }
            }
        });
        btnElement.textContent = "Terminé !";
    } catch (error) {
        console.error(error);
        alert("Erreur lors du scan : " + error.message);
        btnElement.textContent = "Erreur !";
    } finally {
        setTimeout(() => {
            btnElement.textContent = originalText;
            btnElement.disabled = false;
        }, 1500);
    }
}

document.getElementById("btn-extract-A").addEventListener("click", function() { runExtractionForTarget('A', this); });
document.getElementById("btn-extract-B").addEventListener("click", function() { runExtractionForTarget('B', this); });

// --- INITIALISATION AU CHARGEMENT DE LA PAGE (REMISE EN PLACE) ---
window.onload = () => {
    initTable();
    initDB();
};

// --- SYSTÈME DE NAVIGATION PAR ONGLETS ---
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active-content'));
        this.classList.add('active');
        document.getElementById(this.getAttribute('data-tab')).classList.add('active-content');
    });
});

// --- MOTEUR DE CALCUL INTERCEPTANT L'ID TRANSISTOR ---
function executeLossEngine(target, overrideId = null, overrideValue = null) {
    const getVal = (id) => {
        if (overrideId && overrideId === id) return overrideValue;
        
        let finalId = id;
        if (id.startsWith("input-")) {
            finalId = id.replace("input-", `input-${target}-`);
        } else if (id.startsWith("sys-")) {
            finalId = id.replace("sys-", `sys-${target}-`);
        }
        return parseFloat(document.getElementById(finalId)?.value) || 0;
    };

    const rdson = getVal("input-rdson") * 1e-3; 
    const qg = getVal("input-qg") * 1e-9;
    const qgs = getVal("input-qgs") * 1e-9;
    const qgd = getVal("input-qgd") * 1e-9;
    const coss = getVal("input-coss") * 1e-12;
    const vsd = getVal("input-vsd");
    const qrr = getVal("input-qrr") * 1e-9;

    const fsw = getVal("sys-fsw") * 1e3; 
    const vbus = getVal("sys-vbus");
    const irms = getVal("sys-irms");
    const d = getVal("sys-d");
    const vdriver = getVal("sys-vdriver");
    const vlow = getVal("sys-vlow");
    const rgate = getVal("sys-rgate");
    const vplateau = getVal("sys-vplateau");
    const qgs2 = getVal("sys-qgs2") * 1e-9;
    
    const tdton = getVal("sys-tdton") * 1e-9;
    const tdtoff = getVal("sys-tdtoff") * 1e-9;

    const i_gate_on = (vdriver - vplateau) / rgate;
    const i_gate_off = (vplateau - vlow) / rgate;

    let t_on = 0, t_off = 0;
    if (i_gate_on > 0) t_on = (qgs + qgd) / i_gate_on;
    if (i_gate_off > 0) t_off = (qgd + qgs2) / i_gate_off;

    const i_sw = irms * Math.SQRT2; 
    
    const p_sw = 0.5 * vbus * i_sw * (t_on + t_off) * fsw;
    const p_cond = rdson * Math.pow(irms, 2) * d;
    const p_gate = qg * vdriver * fsw;
    const p_rr = qrr * vbus * fsw;
    const p_oss = 0.5 * coss * Math.pow(vbus, 2) * fsw;
    const p_dt = (tdton + tdtoff) * vsd * i_sw * fsw;
    
    const p_total = p_sw + p_cond + p_gate + p_rr + p_oss + p_dt;

    return { t_on, t_off, p_sw, p_cond, p_gate, p_rr, p_oss, p_dt, p_total };
}

// --- AFFICHAGE COMPARATIF (PAGE 1) + CONFIGURATION HISTOGRAMME ---
document.getElementById("btn-calculate").addEventListener("click", function() {
    const resA = executeLossEngine('A');
    const resB = executeLossEngine('B');
    
    const tbody = document.getElementById("results-body");
    tbody.innerHTML = `
        <tr>
            <td><strong>Commutation (T_on / T_off)</strong></td>
            <td>$$T_{on} = \\frac{Q_{gs} + Q_{gd}}{I_{on}} \\ | \\ T_{off} = \\frac{Q_{gd} + Q_{gs2}}{I_{off}}$$</td>
            <td style="color: #2563eb;">On: ${(resA.t_on * 1e9).toFixed(1)} ns<br>Off: ${(resA.t_off * 1e9).toFixed(1)} ns</td>
            <td style="color: #dc2626;">On: ${(resB.t_on * 1e9).toFixed(1)} ns<br>Off: ${(resB.t_off * 1e9).toFixed(1)} ns</td>
        </tr>
        <tr>
            <td><strong>P_sw</strong> (Commutation)</td>
            <td>$$P_{sw} = \\frac{1}{2} V_{bus} I_D (T_{on} + T_{off}) f_{sw}$$</td>
            <td>${resA.p_sw.toFixed(3)} W</td>
            <td>${resB.p_sw.toFixed(3)} W</td>
        </tr>
        <tr>
            <td><strong>P_cond_FET</strong> (Conduction)</td>
            <td>$$P_{cond} = R_{DS(on)} I_{rms}^2 D$$</td>
            <td>${resA.p_cond.toFixed(3)} W</td>
            <td>${resB.p_cond.toFixed(3)} W</td>
        </tr>
        <tr>
            <td><strong>P_dt</strong> (Temps mort)</td>
            <td>$$P_{dt} = (t_{dt\\_on} + t_{dt\\_off}) \\times V_{SD} \\times I_{out} \\times f_{sw}$$</td>
            <td>${resA.p_dt.toFixed(3)} W</td>
            <td>${resB.p_dt.toFixed(3)} W</td>
        </tr>
        <tr>
            <td><strong>P_gate</strong> (Driver)</td>
            <td>$$P_{gate} = Q_{g} V_{driver} f_{sw}$$</td>
            <td>${resA.p_gate.toFixed(3)} W</td>
            <td>${resB.p_gate.toFixed(3)} W</td>
        </tr>
        <tr>
            <td><strong>P_rr</strong> (Recouvrement)</td>
            <td>$$P_{rr} = Q_{rr} V_{bus} f_{sw}$$</td>
            <td>${resA.p_rr.toFixed(3)} W</td>
            <td>${resB.p_rr.toFixed(3)} W</td>
        </tr>
        <tr>
            <td><strong>P_oss</strong> (C_oss)</td>
            <td>$$P_{oss} = \\frac{1}{2} C_{oss} V_{bus}^2 f_{sw}$$</td>
            <td>${resA.p_oss.toFixed(3)} W</td>
            <td>${resB.p_oss.toFixed(3)} W</td>
        </tr>
    `;

    document.getElementById("total-loss").innerHTML = `
        <span style="color: #2563eb;">Total ${nameMOSFET_A} : ${resA.p_total.toFixed(2)} W</span><br>
        <span style="color: #dc2626;">Total ${nameMOSFET_B} : ${resB.p_total.toFixed(2)} W</span>
    `;
    
    document.getElementById("results-output").style.display = "block";
    if (window.MathJax) MathJax.typesetPromise();

    const ctxDash = document.getElementById('chart-dashboard-losses').getContext('2d');
    if (dashboardChartInstance) dashboardChartInstance.destroy();

    dashboardChartInstance = new Chart(ctxDash, {
        type: 'bar',
        data: {
            labels: [nameMOSFET_A, nameMOSFET_B],
            datasets: [
                { label: 'Commutation (P_sw)', data: [resA.p_sw, resB.p_sw], backgroundColor: '#3b82f6' },
                { label: 'Conduction (P_cond)', data: [resA.p_cond, resB.p_cond], backgroundColor: '#ef4444' },
                { label: 'Temps mort (P_dt)', data: [resA.p_dt, resB.p_dt], backgroundColor: '#10b981' },
                { label: 'Grille (P_gate)', data: [resA.p_gate, resB.p_gate], backgroundColor: '#f59e0b' },
                { label: 'Recouvrement (P_rr)', data: [resA.p_rr, resB.p_rr], backgroundColor: '#8b5cf6' },
                { label: 'Capacité Sortie (P_oss)', data: [resA.p_oss, resB.p_oss], backgroundColor: '#06b6d4' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                x: { stacked: true },
                y: { stacked: true, title: { display: true, text: 'Puissance dissipée totale (W)' }, beginAtZero: true }
            }
        }
    });
});

// --- BALAYAGE COMPARATIF DE DEUX COURBES (PAGE 2) ---
let chartInstance = null;

document.getElementById("btn-run-sweep").addEventListener("click", function() {
    const targetParamId = document.getElementById("sweep-param").value;
    const minVal = parseFloat(document.getElementById("sweep-min").value) || 0;
    const maxVal = parseFloat(document.getElementById("sweep-max").value) || 100;
    const steps = parseInt(document.getElementById("sweep-steps").value) || 20;

    if (minVal >= maxVal) {
        alert("Min doit être inférieur à Max.");
        return;
    }

    const labels = [];
    const dataTotalA = [];
    const dataTotalB = [];
    const stepSize = (maxVal - minVal) / (steps - 1);

    for (let i = 0; i < steps; i++) {
        const currentValue = minVal + (stepSize * i);
        labels.push(currentValue.toFixed(1));

        const resA = executeLossEngine('A', targetParamId, currentValue);
        const resB = executeLossEngine('B', targetParamId, currentValue);

        dataTotalA.push(resA.p_total);
        dataTotalB.push(resB.p_total);
    }

    const ctx = document.getElementById('chart-losses').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: `Total ${nameMOSFET_A}`, data: dataTotalA, borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.05)', borderWidth: 3, tension: 0.1 },
                { label: `Total ${nameMOSFET_B}`, data: dataTotalB, borderColor: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.05)', borderWidth: 3, tension: 0.1 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { tooltip: { mode: 'index', intersect: false } },
            scales: {
                x: { title: { display: true, text: 'Variation du paramètre système' } },
                y: { stacked: false, title: { display: true, text: 'Pertes totales cumulées (W)' }, beginAtZero: true }
            }
        }
    });
});