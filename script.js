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
const GROQ_API_KEY = ""; // ⚠️ Remplace par ta clé gsk_...
let library = [];
let currentSelectedFile = null;
let db;

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
            document.getElementById("btn-simulate-extract").disabled = false;
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
        document.getElementById("btn-simulate-extract").disabled = true;
        initTable();
        loadLibraryFromDB();
    };
}

// --- INTERFACE ET LOGIQUE ---

function initTable() {
    const tbody = document.getElementById("table-body");
    if (tbody.children.length > 0) return; // Évite de réinitialiser et d'effacer les données existantes
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

// Upload
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
    if (GROQ_API_KEY === "" || GROQ_API_KEY.includes("METTRE")) {
        alert("Configure ta clé API Groq dans le code !");
        return;
    }

    const originalText = btnElement.textContent;
    btnElement.textContent = "Extraction...";
    btnElement.disabled = true;
    
    try {
        const fileItem = library[currentSelectedFile];
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

// Initialisation
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

// --- MOTEUR DE CALCUL COUPLÉ ---
function executeLossEngine(target, overrideId = null, overrideValue = null) {
    const getVal = (id) => {
        if (overrideId && overrideId === id) return overrideValue;
        let finalId = id;
        if (id.startsWith("input-")) {
            finalId = id.replace("input-", `input-${target}-`);
        }
        return parseFloat(document.getElementById(finalId)?.value) || 0;
    };

    const rdson = getVal("input-rdson") * 1e-3; 
    const qg = getVal("input-qg") * 1e-9;
    const qgs = getVal("input-qgs") * 1e-9;
    const qgd = getVal("input-qgd") * 1e-9;
    const qrr = getVal("input-qrr") * 1e-9;
    const coss = getVal("input-coss") * 1e-12;

    const fsw = getVal("sys-fsw") * 1e3; 
    const vbus = getVal("sys-vbus");
    const irms = getVal("sys-irms");
    const d = getVal("sys-d");
    const vdriver = getVal("sys-vdriver");
    const vlow = getVal("sys-vlow");
    const rgate = getVal("sys-rgate");
    const vplateau = getVal("sys-vplateau");
    const qgs2 = getVal("sys-qgs2") * 1e-9;

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
    const p_total = p_sw + p_cond + p_gate + p_rr + p_oss;

    return { t_on, t_off, p_sw, p_cond, p_gate, p_rr, p_oss, p_total };
}

// --- AFFICHAGE COMPARATIF (PAGE 1) ---
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
        <span style="color: #2563eb;">Total MOSFET A : ${resA.p_total.toFixed(2)} W</span><br>
        <span style="color: #dc2626;">Total MOSFET B : ${resB.p_total.toFixed(2)} W</span>
    `;
    
    document.getElementById("results-output").style.display = "block";
    if (window.MathJax) MathJax.typesetPromise();
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
                { label: 'Total MOSFET A', data: dataTotalA, borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.05)', borderWidth: 3, tension: 0.1 },
                { label: 'Total MOSFET B', data: dataTotalB, borderColor: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.05)', borderWidth: 3, tension: 0.1 }
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