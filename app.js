const API_KEY = 'AIzaSyCYtG_xQDwjzZ2gnlwucGtVWyz9VU51GWs';
const SPREADSHEET_ID = '1D0H3zZ4meoumKNAwQl8zqfHLUZ2r-KI7KYbfoD-hPz4';
const RANGE = 'Sheet1!A2:E281'; 

let allData = [];
let myChart = null;
let map = null;
let geojsonLayer = null;

// Indeks Kolom: 1:Desa, 2:Kecamatan, 3:DPRT, 4:Kader
const idx = { desa: 1, kec: 2, dprt: 3, kader: 4 };

async function initDashboard() {
    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`);
        const data = await response.json();
        allData = data.values.filter(row => row.length >= 3);

        const select = document.getElementById('filterKecamatan');
        const kecamatanList = [...new Set(allData.map(row => row[idx.kec]))].filter(val => val && isNaN(val)).sort();
        
        select.innerHTML = '<option value="ALL">SEMUA KECAMATAN</option>';
        kecamatanList.forEach(kec => {
            let opt = document.createElement('option');
            opt.value = kec;
            opt.textContent = kec;
            select.appendChild(opt);
        });

        applyFilter();
        initMap();

    } catch (e) { console.error("Error load data:", e); }
}

function applyFilter() {
    const filterValue = document.getElementById('filterKecamatan').value;
    const filtered = filterValue === "ALL" ? allData : allData.filter(row => row[idx.kec] === filterValue);

    // Update Statistik
    const totalDPRT = filtered.reduce((acc, row) => acc + (parseInt(row[idx.dprt]) || 0), 0);
    const totalKader = filtered.reduce((acc, row) => acc + (parseInt(row[idx.kader]) || 0), 0);
    document.getElementById('stat-dprt').innerText = totalDPRT.toLocaleString('id-ID');
    document.getElementById('stat-kader').innerText = totalKader.toLocaleString('id-ID');

    let labels, vals;
    if (filterValue === "ALL") {
        const summary = {};
        filtered.forEach(row => {
            const kec = row[idx.kec];
            if(kec && isNaN(kec)) summary[kec] = (summary[kec] || 0) + (parseInt(row[idx.dprt]) || 0);
        });
        labels = Object.keys(summary);
        vals = Object.values(summary);
    } else {
        labels = filtered.map(row => row[idx.desa]);
        vals = filtered.map(row => parseInt(row[idx.dprt]) || 0);
    }

    renderChart(labels, vals);
    
    // Sinkronisasi warna peta
    if (geojsonLayer) geojsonLayer.resetStyle();
}

function renderChart(l, v) {
    const ctx = document.getElementById('panChart').getContext('2d');
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: l,
            datasets: [{
                label: 'DPRT Aktif',
                data: v,
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { 
                    ticks: { 
                        color: '#94a3b8', 
                        autoSkip: false, // PAKSA SEMUA NAMA MUNCUL
                        font: { size: 9 } 
                    } 
                },
                x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
            }
        }
    });
}

function initMap() {
    if (map) return;
    map = L.map('map').setView([-7.0252, 107.5197], 10);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    fetch('kab-bandung.json')
        .then(res => res.json())
        .then(geoData => {
            geojsonLayer = L.geoJson(geoData, {
                style: styleMap,
                onEachFeature: (feature, layer) => {
                    const name = feature.properties.KECAMATAN || feature.properties.name || feature.properties.NAMOBJ;
                    
                    // Hitung total DPRT untuk popup
                    const dataKec = allData.filter(row => row[idx.kec] && row[idx.kec].trim().toUpperCase() === name.toUpperCase());
                    const total = dataKec.reduce((acc, row) => acc + (parseInt(row[idx.dprt]) || 0), 0);

                    layer.bindPopup(`<b>Kecamatan: ${name}</b><br>DPRT Aktif: ${total}`);
                    layer.on('click', () => {
                        document.getElementById('filterKecamatan').value = name;
                        applyFilter();
                    });
                }
            }).addTo(map);
        });
}

function styleMap(feature) {
    const name = feature.properties.KECAMATAN || feature.properties.name || feature.properties.NAMOBJ;
    const dataKec = allData.filter(row => row[idx.kec] && row[idx.kec].trim().toUpperCase() === name.toUpperCase());
    const total = dataKec.reduce((acc, row) => acc + (parseInt(row[idx.dprt]) || 0), 0);

    return {
        fillColor: getColor(total),
        weight: 1.5,
        color: 'white',
        fillOpacity: 0.7
    };
}

function getColor(d) {
    return d > 2000 ? '#1e3a8a' : // Biru sangat gelap
           d > 1000 ? '#1d4ed8' : // Biru gelap
           d > 500  ? '#3b82f6' : // Biru sedang
           d > 100  ? '#93c5fd' : // Biru muda
                      '#334155';  // Abu-abu jika sedikit/kosong
}

initDashboard();
