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
    tbody.innerHTML = ""; 
    
    mosfetParameters.forEach(param => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong>${param.symbol}</strong></td>
            <td>${param.desc}</td>
            <td><input type="number" id="input-${param.id}" step="any" placeholder="Ex: 2.5"></td>
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
    document.getElementById("btn-simulate-extract").disabled = false;
    initTable(); 
}

// --- EXTRACTION AVEC PDF.JS + GROQ API ---

// Configuration de PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// Fonction pour extraire le texte brut du PDF
async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
    let fullText = "";
    
    // On lit les 3 premières pages (largement suffisant pour les paramètres)
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
Tu es un expert en électronique. 
Ton travail consiste à extraire les paramètres d'un MOSFET depuis un texte brut issu d'une datasheet PDF.
Tu DOIS renvoyer UNIQUEMENT un objet JSON valide. Ne fais aucune phrase. Ne mets pas de balises markdown.
Si une valeur n'est pas trouvée, mets null. Les valeurs doivent être des nombres.
Utilise exactement ces clés:
vds, id, rdson, vgsth, qg, qgs, qgd, tdon, tr, tdoff, tf, ciss, coss, crss, vsd, trr, qrr, rthjc, rthja, tjmax.
`;

document.getElementById("btn-simulate-extract").addEventListener("click", async function() {
    if (currentSelectedFile === null) return;
    
    if (GROQ_API_KEY === "TA_CLE_GROQ_ICI") {
        alert("Tu dois d'abord configurer ta clé API Groq dans le code !");
        return;
    }

    const btn = this;
    btn.textContent = "Extraction PDF & IA en cours...";
    btn.disabled = true;
    
    try {
        const fileItem = library[currentSelectedFile];
        
        console.log("🛠️ Étape 1: Extraction du texte via PDF.js...");
        const rawText = await extractTextFromPDF(fileItem.file);
        console.log("Texte extrait (aperçu):", rawText.substring(0, 200) + "...");
        
        console.log("🛠️ Étape 2: Envoi à l'API Groq (Llama 3)...");
        const url = "https://api.groq.com/openai/v1/chat/completions";
        
        const payload = {
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Voici le texte de la datasheet : " + rawText }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1
        };

        const response = await fetch(url, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Authorization": `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.error) throw new Error(data.error.message);

        console.log("🛠️ Étape 3: Réponse reçue !");
        let responseText = data.choices[0].message.content;
        
        const extractedData = JSON.parse(responseText);
        
        console.log("Données extraites:", extractedData);
        
        Object.keys(extractedData).forEach(key => {
            const inputEl = document.getElementById(`input-${key}`);
            if (inputEl && extractedData[key] !== null) {
                inputEl.value = extractedData[key];
                inputEl.style.backgroundColor = "#dcfce7"; 
                setTimeout(() => inputEl.style.backgroundColor = "transparent", 2000);
            }
        });

        btn.textContent = "Extraction réussie !";
        
    } catch (error) {
        console.error("❌ Erreur API:", error);
        alert("Erreur lors de l'extraction : " + error.message);
        btn.textContent = "Erreur !";
    } finally {
        setTimeout(() => {
            btn.textContent = "Extraire les données du PDF";
            btn.disabled = false;
        }, 3000);
    }
});

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
        const targetTab = this.getAttribute('data-tab');
        document.getElementById(targetTab).classList.add('active-content');
    });
});


// --- MOTEUR DE CALCUL CENTRALISÉ ---
// Permet de calculer les pertes à la volée, optionnellement en écrasant une valeur (utile pour le Sweep)
function executeLossEngine(overrideId = null, overrideValue = null) {
    const getVal = (id) => {
        if (overrideId && overrideId === id) return overrideValue;
        return parseFloat(document.getElementById(id)?.value) || 0;
    };

    // 1. Données Composant
    const rdson = getVal("input-rdson") * 1e-3; 
    const qg = getVal("input-qg") * 1e-9;
    const qgs = getVal("input-qgs") * 1e-9;
    const qgd = getVal("input-qgd") * 1e-9;
    const qrr = getVal("input-qrr") * 1e-9;
    const coss = getVal("input-coss") * 1e-12;

    // 2. Données Application
    const fsw = getVal("sys-fsw") * 1e3; 
    const vbus = getVal("sys-vbus");
    const irms = getVal("sys-irms");
    const d = getVal("sys-d");
    const vdriver = getVal("sys-vdriver");
    const vlow = getVal("sys-vlow");
    const rgate = getVal("sys-rgate");
    const vplateau = getVal("sys-vplateau");
    const qgs2 = getVal("sys-qgs2") * 1e-9;

    // 3. Calculs intermédiaires
    const i_gate_on = (vdriver - vplateau) / rgate;
    const i_gate_off = (vplateau - vlow) / rgate;

    let t_on = 0, t_off = 0;
    if (i_gate_on > 0) t_on = (qgs + qgd) / i_gate_on;
    if (i_gate_off > 0) t_off = (qgd + qgs2) / i_gate_off;

    const i_sw = irms * Math.SQRT2; 

    // 4. Dispatch des pertes individuelles (En Watts)
    const p_sw = 0.5 * vbus * i_sw * (t_on + t_off) * fsw;
    const p_cond = rdson * Math.pow(irms, 2) * d;
    const p_gate = qg * vdriver * fsw;
    const p_rr = qrr * vbus * fsw;
    const p_oss = 0.5 * coss * Math.pow(vbus, 2) * fsw;
    const p_total = p_sw + p_cond + p_gate + p_rr + p_oss;

    return { t_on, t_off, p_sw, p_cond, p_gate, p_rr, p_oss, p_total };
}


// --- INJECTION DES RÉSULTATS (PAGE 1) ---
document.getElementById("btn-calculate").addEventListener("click", function() {
    const res = executeLossEngine();

    const tbody = document.getElementById("results-body");
    tbody.innerHTML = `
        <tr>
            <td><strong>Temps de commutation calculés</strong><br><small>T_on et T_off</small></td>
            <td>
                $$I_{gate\\_on} = \\frac{V_{driver} - V_{plateau}}{R_{gate\\_total}}$$
                $$I_{gate\\_off} = \\frac{V_{plateau} - V_{low}}{R_{gate\\_total}}$$
                $$T_{on} = \\frac{Q_{gs} + Q_{gd}}{I_{gate\\_on}} \\quad | \\quad T_{off} = \\frac{Q_{gd} + Q_{gs2}}{I_{gate\\_off}}$$
            </td>
            <td>
                T_on = ${(res.t_on * 1e9).toFixed(1)} ns<br>
                T_off = ${(res.t_off * 1e9).toFixed(1)} ns
            </td>
        </tr>
        <tr>
            <td><strong>P_sw</strong><br><small>Pertes de commutation</small></td>
            <td>$$P_{sw} = \\frac{1}{2} \\times V_{bus} \\times I_D \\times (T_{on} + T_{off}) \\times f_{sw}$$</td>
            <td>${res.p_sw.toFixed(3)} W</td>
        </tr>
        <tr>
            <td><strong>P_cond_FET</strong><br><small>Pertes de conduction</small></td>
            <td>$$P_{cond\\_FET} = R_{DS(on)} \\times I_{rms}^2 \\times D$$</td>
            <td>${res.p_cond.toFixed(3)} W</td>
        </tr>
        <tr>
            <td><strong>P_gate</strong><br><small>Pertes de charge de grille</small></td>
            <td>$$P_{gate} = Q_{g(tot)} \\times V_{driver} \\times f_{sw}$$</td>
            <td>${res.p_gate.toFixed(3)} W</td>
        </tr>
        <tr>
            <td><strong>P_rr</strong><br><small>Pertes recouvrement inverse</small></td>
            <td>$$P_{rr} = Q_{rr} \\times V_{bus} \\times f_{sw}$$</td>
            <td>${res.p_rr.toFixed(3)} W</td>
        </tr>
        <tr>
            <td><strong>P_oss</strong><br><small>Pertes de capacité de sortie</small></td>
            <td>$$P_{oss} = \\frac{1}{2} \\cdot C_{oss} \\cdot V_{bus}^2 \\cdot f_{sw}$$</td>
            <td>${res.p_oss.toFixed(3)} W</td>
        </tr>
    `;

    document.getElementById("total-loss").innerHTML = `🔥 Puissance dissipée totale (estimation) : ${res.p_total.toFixed(2)} W`;
    document.getElementById("results-output").style.display = "block";

    if (window.MathJax) {
        MathJax.typesetPromise();
    }
});


// --- GENERATION DU BALAYAGE PARAMÉTRIQUE & CHART (PAGE 2) ---
let chartInstance = null; // Stockage de l'instance Chart.js pour pouvoir la détruire/recréer proprement

document.getElementById("btn-run-sweep").addEventListener("click", function() {
    const targetParamId = document.getElementById("sweep-param").value;
    const minVal = parseFloat(document.getElementById("sweep-min").value) || 0;
    const maxVal = parseFloat(document.getElementById("sweep-max").value) || 100;
    const steps = parseInt(document.getElementById("sweep-steps").value) || 20;

    if (minVal >= maxVal) {
        alert("La valeur minimale doit être inférieure à la valeur maximale.");
        return;
    }

    // Génération des tableaux de données pour Chart.js
    const labels = [];
    const dataConduction = [];
    const dataSwitching = [];
    const dataGate = [];
    const dataReverseRecovery = [];
    const dataOss = [];

    const stepSize = (maxVal - minVal) / (steps - 1);

    for (let i = 0; i < steps; i++) {
        const currentValue = minVal + (stepSize * i);
        labels.push(currentValue.toFixed(1));

        // On appelle le moteur de calcul en forçant la valeur du paramètre courant
        const res = executeLossEngine(targetParamId, currentValue);

        dataConduction.push(res.p_cond);
        dataSwitching.push(res.p_sw);
        dataGate.push(res.p_gate);
        dataReverseRecovery.push(res.p_rr);
        dataOss.push(res.p_oss);
    }

    // Récupération de l'élément Canvas
    const ctx = document.getElementById('chart-losses').getContext('2d');

    // Si un graphique existait déjà, on le détruit pour éviter les bugs de superposition visuelle
    if (chartInstance) {
        chartInstance.destroy();
    }

    // Initialisation du nouveau graphique Chart.js (Style aires empilées pour voir la proportion de chaque perte)
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Conduction (P_cond)', data: dataConduction, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.15)', fill: true, tension: 0.1 },
                { label: 'Commutation (P_sw)', data: dataSwitching, borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.15)', fill: true, tension: 0.1 },
                { label: 'Grille (P_gate)', data: dataGate, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.15)', fill: true, tension: 0.1 },
                { label: 'Recouvrement (P_rr)', data: dataReverseRecovery, borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.15)', fill: true, tension: 0.1 },
                { label: 'Capacité Sortie (P_oss)', data: dataOss, borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.15)', fill: true, tension: 0.1 }
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
                x: {
                    title: { display: true, text: `Valeur du paramètre sélectionné` }
                },
                y: {
                    stacked: true, // Empilement des pertes pour voir directement le total dissipé graphiquement
                    title: { display: true, text: 'Pertes dissipées totales (W)' },
                    beginAtZero: true
                }
            }
        }
    });
});