const API_KEY = 'AIzaSyCYtG_xQDwjzZ2gnlwucGtVWyz9VU51GWs';
const SPREADSHEET_ID = '1D0H3zZ4meoumKNAwQl8zqfHLUZ2r-KI7KYbfoD-hPz4';
const RANGE = 'Sheet1!A2:E281'; 

let allData = [];
let myChart = null;
let map = null;
let geojsonLayer = null;

const idx = { desa: 1, kec: 2, dprt: 3, kader: 4 };

// Pastikan skrip jalan setelah HTML siap
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

async function initDashboard() {
    try {
        console.log("Memulai loading data...");
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`);
        const data = await response.json();
        
        if (!data.values) {
            console.error("Data tidak ditemukan di Google Sheets!");
            return;
        }
        
        allData = data.values.filter(row => row.length >= 3).map(row => ({
            desa: (row[idx.desa] || "").trim().toUpperCase(),
            kec: (row[idx.kec] || "").trim().toUpperCase(),
            dprt: parseInt(row[idx.dprt]) || 0,
            kader: parseInt(row[idx.kader]) || 0
        }));

        const select = document.getElementById('filterKecamatan');
        const kecamatanList = [...new Set(allData.map(d => d.kec))].filter(val => val && isNaN(val)).sort();
        
        select.innerHTML = '<option value="ALL">KABUPATEN BANDUNG (SEMUA)</option>';
        kecamatanList.forEach(kec => {
            let opt = document.createElement('option');
            opt.value = kec;
            opt.textContent = kec;
            select.appendChild(opt);
        });

        // Inisialisasi Peta
        initMap();
        // Jalankan filter pertama kali untuk mengisi angka & chart
        applyFilter();

    } catch (e) { 
        console.error("Gagal inisialisasi dashboard:", e); 
    }
}

function initMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer || map) return;

    map = L.map('map', { zoomControl: true }).setView([-7.0252, 107.5197], 10);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    fetch('kab-bandung.json')
        .then(res => res.json())
        .then(geoData => {
            geojsonLayer = L.geoJson(geoData, {
                style: styleMap,
                onEachFeature: (feature, layer) => {
                    const props = feature.properties;
                    const name = (props.KECAMATAN || props.name || props.NAMOBJ || "").toUpperCase().trim();
                    
                    const dataKec = allData.filter(d => d.kec === name);
                    const totalD = dataKec.reduce((acc, d) => acc + d.dprt, 0);
                    const totalK = dataKec.reduce((acc, d) => acc + d.kader, 0);

                    layer.bindPopup(`<b>KEC. ${name}</b><br>DPRT: ${totalD}<br>Kader: ${totalK}`);
                    layer.on('click', () => {
                        document.getElementById('filterKecamatan').value = name;
                        applyFilter();
                    });
                }
            }).addTo(map);
        })
        .catch(err => console.warn("File kab-bandung.json tidak ditemukan, peta tidak akan muncul."));
}

function applyFilter() {
    const filterValue = document.getElementById('filterKecamatan').value;
    const filtered = filterValue === "ALL" ? allData : allData.filter(d => d.kec === filterValue);

    // Update Angka Statistik
    document.getElementById('stat-dprt').innerText = filtered.reduce((acc, d) => acc + d.dprt, 0).toLocaleString('id-ID');
    document.getElementById('stat-kader').innerText = filtered.reduce((acc, d) => acc + d.kader, 0).toLocaleString('id-ID');

    // Update Highlight Peta
    if (geojsonLayer) {
        geojsonLayer.eachLayer(layer => {
            const props = layer.feature.properties;
            const name = (props.KECAMATAN || props.name || props.NAMOBJ || "").toUpperCase().trim();
            
            if (filterValue === "ALL") {
                geojsonLayer.resetStyle(layer);
            } else if (name === filterValue) {
                layer.setStyle({ fillColor: '#0054a6', fillOpacity: 0.9, weight: 3, color: 'white' });
                layer.bringToFront();
                map.fitBounds(layer.getBounds(), { padding: [20, 20] });
            } else {
                layer.setStyle({ fillOpacity: 0.1, weight: 1, color: '#cbd5e1' });
            }
        });
    }

    // Update Grafik
    updateChartUI(filterValue, filtered);
}

function updateChartUI(filterValue, filteredData) {
    const ctx = document.getElementById('panChart').getContext('2d');
    if (myChart) myChart.destroy();

    let labels, dprtVals, kaderVals;
    if (filterValue === "ALL") {
        const summary = {};
        allData.forEach(d => {
            if(!summary[d.kec]) summary[d.kec] = { d: 0, k: 0 };
            summary[d.kec].d += d.dprt;
            summary[d.kec].k += d.kader;
        });
        labels = Object.keys(summary);
        dprtVals = labels.map(l => summary[l].d);
        kaderVals = labels.map(l => summary[l].k);
    } else {
        labels = filteredData.map(d => d.desa);
        dprtVals = filteredData.map(d => d.dprt);
        kaderVals = filteredData.map(d => d.kader);
    }

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Kader', data: kaderVals, backgroundColor: '#f97316', borderRadius: 4 },
                { label: 'DPRT', data: dprtVals, backgroundColor: '#0054a6', borderRadius: 4 }
            ]
        },
        options: {
            indexAxis: 'y',
            maintainAspectRatio: false,
            scales: {
                y: { ticks: { color: '#1e293b', font: { size: 9 } } },
                x: { ticks: { color: '#1e293b' } }
            }
        }
    });
}

function styleMap(feature) {
    const props = feature.properties;
    const name = (props.KECAMATAN || props.name || props.NAMOBJ || "").toUpperCase().trim();
    const dataKec = allData.filter(d => d.kec === name);
    const total = dataKec.reduce((acc, d) => acc + d.dprt, 0);
    return { fillColor: getColor(total), weight: 1.5, color: 'white', fillOpacity: 0.7 };
}

function getColor(d) {
    return d > 1000 ? '#003366' : d > 500 ? '#0054a6' : d > 100 ? '#3b82f6' : d > 0 ? '#93c5fd' : '#e2e8f0';
}
