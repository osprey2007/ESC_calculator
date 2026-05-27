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
const GROQ_API_KEY = ""; 
let library = [];
let currentSelectedFile = null;
let db;

let nameMOSFET_A = "MOSFET A";
let nameMOSFET_B = "MOSFET B";

let dashboardChartInstance = null;
let profileChartInstance = null; 
let chartInstance = null;
let currentModulation = 'FOC'; 

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

// --- GESTION DE LA SELECTION DE MODULATION ---
document.getElementById("btn-mod-foc").addEventListener("click", function() {
    currentModulation = 'FOC';
    document.querySelectorAll(".mod-btn").forEach(b => b.classList.remove("active"));
    this.classList.add("active");
    this.style.background = "#e2e8f0";
    document.getElementById("btn-mod-trapeze").style.background = "var(--secondary)";
    document.getElementById("row-tblock").style.display = "none";
});

document.getElementById("btn-mod-trapeze").addEventListener("click", function() {
    currentModulation = 'TRAPEZE';
    document.querySelectorAll(".mod-btn").forEach(b => b.classList.remove("active"));
    this.classList.add("active");
    this.style.background = "#e2e8f0";
    document.getElementById("btn-mod-foc").style.background = "var(--secondary)";
    document.getElementById("row-tblock").style.display = "table-row";
});

// --- EXTRACTION AVEC PDF.JS + GROQ API ---
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
    let fullText = "";
    const maxPages = Math.min(pdf.numPages, 3);
    for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(" ");
        fullText += pageText + " ";
    }
    return fullText;
}

const systemPrompt = `
Tu es un expert en électronique. Extraits les paramètres du MOSFET depuis le texte.
Renvoie UNIQUEMENT un objet JSON valide, sans markdown. Si non trouvé, mets null.
Clés: vds, id, rdson, vgsth, qg, qgs, qgd, tdon, tr, tdoff, tf, ciss, coss, crss, vsd, trr, qrr, rthjc, rthja, tjmax.
`;

async function runExtractionForTarget(target, btnElement) {
    if (currentSelectedFile === null) return;
    const originalText = btnElement.textContent;
    btnElement.textContent = "Extraction...";
    btnElement.disabled = true;
    
    try {
        const fileItem = library[currentSelectedFile];
        const cleanedName = fileItem.name.replace(/\.[^/.]+$/, ""); 
        if (target === 'A') nameMOSFET_A = cleanedName;
        if (target === 'B') nameMOSFET_B = cleanedName;
        updateNamesInUI(); 
        
        const rawText = await extractTextFromPDF(fileItem.file);
        
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Datasheet : " + rawText }
                ],
                response_format: { type: "json_object" },
                temperature: 0.1
            })
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const extractedData = JSON.parse(data.choices[0].message.content);
        
        Object.keys(extractedData).forEach(key => {
            const inputEl = document.getElementById(`input-${target}-${key}`);
            if (inputEl && extractedData[key] !== null) {
                inputEl.value = extractedData[key];
                inputEl.style.backgroundColor = target === 'A' ? "#dbeafe" : "#fee2e2"; 
                setTimeout(() => inputEl.style.backgroundColor = "transparent", 2000);
            }
        });
        btnElement.textContent = "Réussi !";
    } catch (error) {
        console.error(error);
        alert("Erreur: " + error.message);
        btnElement.textContent = "Erreur !";
    } finally {
        setTimeout(() => {
            btnElement.textContent = originalText;
            btnElement.disabled = false;
        }, 2000);
    }
}

document.getElementById("btn-extract-A").addEventListener("click", function() { runExtractionForTarget('A', this); });
document.getElementById("btn-extract-B").addEventListener("click", function() { runExtractionForTarget('B', this); });

// --- NAVIGATION ET INITIALISATION EXCLUSIVES DU MENU PRINCIPAL ---
window.onload = () => {
    initTable();
    initDB();
};

document.querySelectorAll('.nav-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.nav-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active-content'));
        this.classList.add('active');
        document.getElementById(this.getAttribute('data-tab')).classList.add('active-content');
    });
});

// --- MOTEUR DE CALCUL DES PERTES ACTIVE (SANS FACTEUR DE CYCLE) ---
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
    
    return { t_on, t_off, p_sw, p_cond, p_gate, p_rr, p_oss, p_dt };
}

// --- RENDU ONGLET 1 ---
document.getElementById("btn-calculate").addEventListener("click", function() {
    const rawA = executeLossEngine('A');
    const rawB = executeLossEngine('B');
    
    const factor = (currentModulation === 'TRAPEZE') ? (1 / 3) : 1.0;

    const resA = {
        p_sw: rawA.p_sw * factor, p_cond: rawA.p_cond * factor, p_dt: rawA.p_dt * factor,
        p_gate: rawA.p_gate * factor, p_rr: rawA.p_rr * factor, p_oss: rawA.p_oss * factor
    };
    const resB = {
        p_sw: rawB.p_sw * factor, p_cond: rawB.p_cond * factor, p_dt: rawB.p_dt * factor,
        p_gate: rawB.p_gate * factor, p_rr: rawB.p_rr * factor, p_oss: rawB.p_oss * factor
    };

    const totalA = Object.values(resA).reduce((a, b) => a + b, 0);
    const totalB = Object.values(resB).reduce((a, b) => a + b, 0);

    const tbody = document.getElementById("results-body");
    tbody.innerHTML = `
        <tr>
            <td><strong>Commutation (T_on / T_off)</strong></td>
            <td>$$T_{on} = \\frac{Q_{gs} + Q_{gd}}{I_{on}} \\ | \\ T_{off} = \\frac{Q_{gd} + Q_{gs2}}{I_{off}}$$</td>
            <td style="color: #2563eb;">On: ${(rawA.t_on * 1e9).toFixed(1)} ns<br>Off: ${(rawA.t_off * 1e9).toFixed(1)} ns</td>
            <td style="color: #dc2626;">On: ${(rawB.t_on * 1e9).toFixed(1)} ns<br>Off: ${(rawB.t_off * 1e9).toFixed(1)} ns</td>
        </tr>
        <tr>
            <td><strong>P_sw</strong> (Commutation)</td>
            <td>$$P_{sw} = \\left(\\frac{1}{2} V_{bus} I_D (T_{on} + T_{off}) f_{sw}\\right) ${currentModulation === 'TRAPEZE' ? '\\times \\frac{1}{3}' : ''}$$</td>
            <td>${resA.p_sw.toFixed(3)} W</td>
            <td>${resB.p_sw.toFixed(3)} W</td>
        </tr>
        <tr>
            <td><strong>P_cond_FET</strong> (Conduction)</td>
            <td>$$P_{cond} = \\left(R_{DS(on)} I_{rms}^2 D\\right) ${currentModulation === 'TRAPEZE' ? '\\times \\frac{1}{3}' : ''}$$</td>
            <td>${resA.p_cond.toFixed(3)} W</td>
            <td>${resB.p_cond.toFixed(3)} W</td>
        </tr>
        <tr>
            <td><strong>P_dt</strong> (Temps mort)</td>
            <td>$$P_{dt} = \\left((t_{dt\\_on} + t_{dt\\_off}) \\times V_{SD} \\times I_{out} \\times f_{sw}\\right) ${currentModulation === 'TRAPEZE' ? '\\times \\frac{1}{3}' : ''}$$</td>
            <td>${resA.p_dt.toFixed(3)} W</td>
            <td>${resB.p_dt.toFixed(3)} W</td>
        </tr>
    `;

    document.getElementById("total-loss").innerHTML = `
        <span style="color: #2563eb;">Total ${nameMOSFET_A} : ${totalA.toFixed(2)} W</span><br>
        <span style="color: #dc2626;">Total ${nameMOSFET_B} : ${totalB.toFixed(2)} W</span>
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
                { label: 'Commutation', data: [resA.p_sw, resB.p_sw], backgroundColor: '#3b82f6' },
                { label: 'Conduction', data: [resA.p_cond, resB.p_cond], backgroundColor: '#ef4444' },
                { label: 'Temps mort', data: [resA.p_dt, resB.p_dt], backgroundColor: '#10b981' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { x: { stacked: true }, y: { stacked: true, title: { display: true, text: 'Puissance (W)' } } }
        }
    });
});

// --- BALAYAGE PARAMÉTRIQUE (ONGLET 2) ---
document.getElementById("btn-run-sweep").addEventListener("click", function() {
    const targetParamId = document.getElementById("sweep-param").value;
    const minVal = parseFloat(document.getElementById("sweep-min").value) || 0;
    const maxVal = parseFloat(document.getElementById("sweep-max").value) || 100;
    const steps = parseInt(document.getElementById("sweep-steps").value) || 20;

    const labels = []; const dataTotalA = []; const dataTotalB = [];
    const stepSize = (maxVal - minVal) / (steps - 1);
    const factor = (currentModulation === 'TRAPEZE') ? (1 / 3) : 1.0;

    for (let i = 0; i < steps; i++) {
        const currentValue = minVal + (stepSize * i);
        labels.push(currentValue.toFixed(1));
        const rawA = executeLossEngine('A', targetParamId, currentValue);
        const rawB = executeLossEngine('B', targetParamId, currentValue);
        
        dataTotalA.push((rawA.p_sw + rawA.p_cond + rawA.p_dt) * factor);
        dataTotalB.push((rawB.p_sw + rawB.p_cond + rawB.p_dt) * factor);
    }

    const ctx = document.getElementById('chart-losses').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: `Total ${nameMOSFET_A}`, data: dataTotalA, borderColor: '#2563eb', borderWidth: 3 },
                { label: `Total ${nameMOSFET_B}`, data: dataTotalB, borderColor: '#dc2626', borderWidth: 3 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
});

// --- PROFILEUR DE MISSION GÉOMÉTRIQUE TEMPOREL (ONGLET 3) ---
document.getElementById("btn-run-profile").addEventListener("click", function() {
    const poles = parseFloat(document.getElementById("prof-poles").value) || 10;
    const rpmMin = parseFloat(document.getElementById("prof-rpm-min").value) || 0;
    const rpmMax = parseFloat(document.getElementById("prof-rpm-max").value) || 0;

    const rawA = executeLossEngine('A');
    const rawB = executeLossEngine('B');

    let total_mJ_A = { sw: 0, cond: 0, dt: 0 };
    let total_mJ_B = { sw: 0, cond: 0, dt: 0 };

    const simDuration = 20; 
    const timeStep = 0.1;   
    
    let chartTimelineLabels = [];
    let chartPowerAData = [];
    let chartPowerBData = [];

    for (let t = 0; t <= simDuration; t += timeStep) {
        let currentRpm = 0;
        
        if (t <= 5) {
            currentRpm = rpmMin + ((rpmMax - rpmMin) / 5) * t; 
        } else if (t <= 15) {
            currentRpm = rpmMax;                               
        } else {
            currentRpm = rpmMax - ((rpmMax - rpmMin) / 5) * (t - 15); 
        }

        let fe = (currentRpm * poles) / 120;
        const mJ_factor = timeStep * 1000 * (1 / 3);

        total_mJ_A.sw += rawA.p_sw * mJ_factor;
        total_mJ_A.cond += rawA.p_cond * mJ_factor;
        total_mJ_A.dt += rawA.p_dt * mJ_factor;

        total_mJ_B.sw += rawB.p_sw * mJ_factor;
        total_mJ_B.cond += rawB.p_cond * mJ_factor;
        total_mJ_B.dt += rawB.p_dt * mJ_factor;

        let p_inst_A = (rawA.p_sw + rawA.p_cond + rawA.p_dt) / 3;
        let p_inst_B = (rawB.p_sw + rawB.p_cond + rawB.p_dt) / 3;

        chartTimelineLabels.push(t.toFixed(1) + "s");
        chartPowerAData.push(p_inst_A.toFixed(3));
        chartPowerBData.push(p_inst_B.toFixed(3));
    }

    const sumA_mJ = Object.values(total_mJ_A).reduce((a, b) => a + b, 0);
    const sumB_mJ = Object.values(total_mJ_B).reduce((a, b) => a + b, 0);

    const avgA_W = (sumA_mJ / 1000) / simDuration;
    const avgB_W = (sumB_mJ / 1000) / simDuration;

    const pBody = document.getElementById("profile-results-body");
    pBody.innerHTML = `
        <tr>
            <td><strong>Commutation (E_sw)</strong></td>
            <td>${total_mJ_A.sw.toFixed(1)} mJ</td>
            <td>${(total_mJ_A.sw / 20000).toFixed(3)} W</td>
            <td>${total_mJ_B.sw.toFixed(1)} mJ</td>
            <td>${(total_mJ_B.sw / 20000).toFixed(3)} W</td>
        </tr>
        <tr>
            <td><strong>Conduction (E_cond)</strong></td>
            <td>${total_mJ_A.cond.toFixed(1)} mJ</td>
            <td>${(total_mJ_A.cond / 20000).toFixed(3)} W</td>
            <td>${total_mJ_B.cond.toFixed(1)} mJ</td>
            <td>${(total_mJ_B.cond / 20000).toFixed(3)} W</td>
        </tr>
        <tr>
            <td><strong>Temps Morts (E_dt)</strong></td>
            <td>${total_mJ_A.dt.toFixed(1)} mJ</td>
            <td>${(total_mJ_A.dt / 20000).toFixed(3)} W</td>
            <td>${total_mJ_B.dt.toFixed(1)} mJ</td>
            <td>${(total_mJ_B.dt / 20000).toFixed(3)} W</td>
        </tr>
        <tr style="background: #f1f5f9; font-weight: bold; border-top: 2px solid var(--secondary);">
            <td>⚖️ TOTAL CUMULÉ DU PROFIL</td>
            <td style="color: #2563eb;">${sumA_mJ.toFixed(1)} mJ</td>
            <td style="color: #2563eb;">${avgA_W.toFixed(2)} W</td>
            <td style="color: #dc2626;">${sumB_mJ.toFixed(1)} mJ</td>
            <td style="color: #dc2626;">${avgB_W.toFixed(2)} W</td>
        </tr>
    `;

    document.getElementById("profile-output").style.display = "block";

    const ctxProfile = document.getElementById('chart-profile-timeline').getContext('2d');
    if (profileChartInstance) profileChartInstance.destroy();

    profileChartInstance = new Chart(ctxProfile, {
        type: 'line',
        data: {
            labels: chartTimelineLabels,
            datasets: [
                { label: `P_inst ${nameMOSFET_A} (W)`, data: chartPowerAData, borderColor: '#2563eb', borderWidth: 2, pointRadius: 0, fill: false },
                { label: `P_inst ${nameMOSFET_B} (W)`, data: chartPowerBData, borderColor: '#dc2626', borderWidth: 2, pointRadius: 0, fill: false }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } },
            scales: {
                x: { title: { display: true, text: 'Temps écoulé (s)' } },
                y: { title: { display: true, text: 'Puissance instantanée (W)' }, beginAtZero: true }
            }
        }
    });
});