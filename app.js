// 1. KONFIGURASI
const API_KEY = 'AIzaSyCYtG_xQDwjzZ2gnlwucGtVWyz9VU51GWs';
const SPREADSHEET_ID = '1D0H3zZ4meoumKNAwQl8zqfHLUZ2r-KI7KYbfoD-hPz4';
// Pastikan RANGE mengambil dari kolom A agar ID masuk sebagai row[0]
const RANGE = 'Sheet1!A2:E281'; 

let allData = [];
let myChart = null;
let map = null;
let geojsonLayer = null;

async function initDashboard() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        allData = data.values;

        // Inisialisasi Peta
        initMap();

        // Isi Dropdown Kecamatan (Ambil dari row[2])
        const kecamatanList = [...new Set(allData.map(row => row[2]))].filter(Boolean).sort();
        const select = document.getElementById('filterKecamatan');
        kecamatanList.forEach(kec => {
            let opt = document.createElement('option');
            opt.value = kec;
            opt.innerHTML = kec;
            select.appendChild(opt);
        });

        applyFilter();
    } catch (e) { console.error("Error:", e); }
}

function applyFilter() {
    const filterValue = document.getElementById('filterKecamatan').value;
    
    // Filter data berdasarkan kecamatan (row[2])
    const filtered = filterValue === "ALL" 
        ? allData 
        : allData.filter(row => row[2] === filterValue);

    let labels, dprtData;

    if (filterValue === "ALL") {
        // Ringkasan per Kecamatan (row[2]) mengambil nilai dari row[3]
        const summary = {};
        filtered.forEach(row => {
            const kec = row[2];
            if(kec) summary[kec] = (summary[kec] || 0) + parseInt(row[3] || 0);
        });
        labels = Object.keys(summary);
        dprtData = Object.values(summary);
    } else {
        // Detail per Desa (row[1]) mengambil nilai dari row[3]
        labels = filtered.map(row => row[1]); 
        dprtData = filtered.map(row => parseInt(row[3] || 0));
    }

    // Statistik Utama (DPRT di row[3], Kader di row[4])
    const totalDPRT = filtered.reduce((acc, row) => acc + parseInt(row[3] || 0), 0);
    const totalKader = filtered.reduce((acc, row) => acc + parseInt(row[4] || 0), 0);
    
    document.getElementById('stat-dprt').innerText = totalDPRT.toLocaleString('id-ID');
    document.getElementById('stat-kader').innerText = totalKader.toLocaleString('id-ID');

    renderChart(labels, dprtData, filterValue === "ALL" ? "Total DPRT per Kec" : "DPRT per Desa");
    if(geojsonLayer) geojsonLayer.resetStyle();
}

function renderChart(labels, dataValues, title) {
    const ctx = document.getElementById('panChart').getContext('2d');
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: title,
                data: dataValues,
                backgroundColor: '#3b82f6',
                borderRadius: 5
            }]
        },
        options: {
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                y: { ticks: { color: '#94a3b8' } }
            }
        }
    });
}

function initMap() {
    map = L.map('map').setView([-7.0252, 107.5197], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    fetch('kab-bandung.json')
        .then(res => res.json())
        .then(geoData => {
            geojsonLayer = L.geoJson(geoData, {
                style: styleMap,
                onEachFeature: onEachFeature
            }).addTo(map);
        });
}

function styleMap(feature) {
    const kecMap = feature.properties.KECAMATAN || feature.properties.name || feature.properties.NAMOBJ;
    const dataKec = allData.filter(row => row[2] && row[2].trim().toUpperCase() === kecMap.toUpperCase());
    const total = dataKec.reduce((acc, row) => acc + parseInt(row[3] || 0), 0);

    return {
        fillColor: getColor(total),
        weight: 1,
        color: 'white',
        fillOpacity: 0.7
    };
}

function getColor(d) {
    return d > 1000 ? '#1e3a8a' : d > 500 ? '#1d4ed8' : d > 100 ? '#3b82f6' : d > 0 ? '#93c5fd' : '#334155';
}

function onEachFeature(feature, layer) {
    const name = feature.properties.KECAMATAN || feature.properties.name;
    layer.bindPopup(`<b>Kecamatan: ${name}</b>`);
    layer.on('click', () => {
        document.getElementById('filterKecamatan').value = name; // Ini harus cocok persis dengan teks di dropdown
        applyFilter();
    });
}

initDashboard();
