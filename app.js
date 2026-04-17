const API_KEY = 'AIzaSyCYtG_xQDwjzZ2gnlwucGtVWyz9VU51GWs';
const SPREADSHEET_ID = '1D0H3zZ4meoumKNAwQl8zqfHLUZ2r-KI7KYbfoD-hPz4';
const RANGE = 'Sheet1!B2:E281'; 

let allData = [];
let myChart = null;
let map = null;
let geojsonLayer = null;

async function initDashboard() {
    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`);
        const data = await response.json();
        
        // Filter baris kosong agar tidak error
        allData = data.values.filter(row => row.length >= 3);

        const select = document.getElementById('filterKecamatan');
        // AMBIL KOLOM C (index 2) untuk Kecamatan
        const kecamatanList = [...new Set(allData.map(row => row[2]))].filter(Boolean).sort();
        
        select.innerHTML = '<option value="ALL">SEMUA KECAMATAN</option>';
        kecamatanList.forEach(kec => {
            let opt = document.createElement('option');
            opt.value = kec;
            opt.innerHTML = kec;
            select.appendChild(opt);
        });

        applyFilter();
        initMap();

    } catch (e) {
        console.error("Dashboard Error:", e);
    }
}

function initMap() {
    if (map) return;
    map = L.map('map').setView([-7.0252, 107.5197], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    fetch('kab-bandung.json')
        .then(res => res.json())
        .then(geoData => {
            geojsonLayer = L.geoJson(geoData, {
                style: styleMap,
                onEachFeature: onEachFeature
            }).addTo(map);
        })
        .catch(err => console.warn("GeoJSON tidak ditemukan atau korup"));
}

function styleMap(feature) {
    const kecMap = feature.properties.KECAMATAN || feature.properties.name || feature.properties.NAMOBJ;
    // Kecocokan nama kecamatan (kolom C / index 2)
    const dataKec = allData.filter(row => row[2] && row[2].trim().toUpperCase() === kecMap.toUpperCase());
    const totalDPRT = dataKec.reduce((acc, row) => acc + (parseInt(row[3]) || 0), 0);

    return {
        fillColor: totalDPRT > 1000 ? '#1e3a8a' : totalDPRT > 100 ? '#3b82f6' : '#93c5fd',
        weight: 1.5,
        color: 'white',
        fillOpacity: 0.7
    };
}

function onEachFeature(feature, layer) {
    const name = feature.properties.KECAMATAN || feature.properties.name;
    layer.bindPopup(`<b>Kecamatan: ${name}</b>`);
    layer.on('click', () => {
        document.getElementById('filterKecamatan').value = name;
        applyFilter();
    });
}

function applyFilter() {
    const filterValue = document.getElementById('filterKecamatan').value;
    
    // Filter berdasarkan kolom C (index 2)
    const filtered = filterValue === "ALL" 
        ? allData 
        : allData.filter(row => row[2] && row[2].trim() === filterValue);

    // Update Card (DPRT index 3, Kader index 4)
    const dprt = filtered.reduce((acc, row) => acc + (parseInt(row[3]) || 0), 0);
    const kader = filtered.reduce((acc, row) => acc + (parseInt(row[4]) || 0), 0);
    
    document.getElementById('stat-dprt').innerText = dprt.toLocaleString('id-ID');
    document.getElementById('stat-kader').innerText = kader.toLocaleString('id-ID');

    let labels, vals;
    if (filterValue === "ALL") {
        const sum = {};
        filtered.forEach(row => { 
            if(row[2]) sum[row[2]] = (sum[row[2]] || 0) + (parseInt(row[3]) || 0); 
        });
        labels = Object.keys(sum);
        vals = Object.values(sum);
    } else {
        labels = filtered.map(row => row[1]); // Nama Desa (Kolom B / index 1)
        vals = filtered.map(row => parseInt(row[3]) || 0);
    }
    renderChart(labels, vals);
    if(geojsonLayer) geojsonLayer.resetStyle();
}

function renderChart(l, v) {
    const ctx = document.getElementById('panChart').getContext('2d');
    if (myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: l,
            datasets: [{ label: 'DPRT', data: v, backgroundColor: '#3b82f6' }]
        },
        options: { 
            indexAxis: 'y', 
            maintainAspectRatio: false,
            scales: { y: { ticks: { color: '#fff', font: { size: 10 } } } }
        }
    });
}

initDashboard();
