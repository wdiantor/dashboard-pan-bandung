const API_KEY = 'AIzaSyCYtG_xQDwjzZ2gnlwucGtVWyz9VU51GWs';
const SPREADSHEET_ID = '1D0H3zZ4meoumKNAwQl8zqfHLUZ2r-KI7KYbfoD-hPz4';
const RANGE = 'Sheet1!A1:E281'; // Kita ambil dari A1 untuk deteksi header

let allData = [];
let myChart = null;
let map = null;
let geojsonLayer = null;
let colIndex = { desa: 1, kec: 2, dprt: 3, kader: 4 };

async function initDashboard() {
    try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`);
        const data = await response.json();
        
        if (!data.values) return;

        // Ambil baris pertama sebagai Header untuk deteksi kolom
        const header = data.values[0];
        allData = data.values.slice(1); // Data asli mulai baris ke-2

        // OTOMATIS CARI KOLOM (Agar tidak ngaco angka lagi)
        header.forEach((h, i) => {
            const head = h.toLowerCase();
            if (head.includes('kecamatan')) colIndex.kec = i;
            if (head.includes('desa') || head.includes('kelurahan')) colIndex.desa = i;
            if (head.includes('aktif') || head.includes('dprt')) colIndex.dprt = i;
            if (head.includes('kader') || head.includes('total')) colIndex.kader = i;
        });

        const select = document.getElementById('filterKecamatan');
        const kecamatanList = [...new Set(allData.map(row => row[colIndex.kec]))]
                                .filter(val => val && isNaN(val)) 
                                .sort();
        
        select.innerHTML = '<option value="ALL">SEMUA KECAMATAN</option>';
        kecamatanList.forEach(kec => {
            let opt = document.createElement('option');
            opt.value = kec;
            opt.textContent = kec;
            select.appendChild(opt);
        });

        applyFilter();
        initMap();

    } catch (e) { console.error("Error:", e); }
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
                    layer.bindPopup(`<b>Kecamatan: ${name}</b>`);
                    layer.on('click', () => {
                        document.getElementById('filterKecamatan').value = name;
                        applyFilter();
                    });
                }
            }).addTo(map);
        }).catch(err => console.warn("File JSON peta tidak ditemukan."));
}

function styleMap(feature) {
    const kecMap = feature.properties.KECAMATAN || feature.properties.name || feature.properties.NAMOBJ;
    const dataKec = allData.filter(row => row[colIndex.kec] && row[colIndex.kec].trim().toUpperCase() === kecMap.toUpperCase());
    const total = dataKec.reduce((acc, row) => acc + (parseInt(row[colIndex.dprt]) || 0), 0);
    return {
        fillColor: total > 500 ? '#1e3a8a' : total > 0 ? '#3b82f6' : '#334155',
        weight: 1, color: 'white', fillOpacity: 0.7
    };
}

function applyFilter() {
    const filterValue = document.getElementById('filterKecamatan').value;
    const filtered = filterValue === "ALL" ? allData : allData.filter(row => row[colIndex.kec] === filterValue);

    const dprt = filtered.reduce((acc, row) => acc + (parseInt(row[colIndex.dprt]) || 0), 0);
    const kader = filtered.reduce((acc, row) => acc + (parseInt(row[colIndex.kader]) || 0), 0);
    document.getElementById('stat-dprt').innerText = dprt.toLocaleString('id-ID');
    document.getElementById('stat-kader').innerText = kader.toLocaleString('id-ID');

    let labels, vals;
    if (filterValue === "ALL") {
        const sum = {};
        filtered.forEach(row => { 
            const k = row[colIndex.kec]; 
            if(k && isNaN(k)) sum[k] = (sum[k] || 0) + (parseInt(row[colIndex.dprt]) || 0); 
        });
        labels = Object.keys(sum);
        vals = Object.values(sum);
    } else {
        labels = filtered.map(row => row[colIndex.desa]);
        vals = filtered.map(row => parseInt(row[colIndex.dprt]) || 0);
    }
    renderChart(labels, vals);
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
        options: { indexAxis: 'y', maintainAspectRatio: false }
    });
}

initDashboard();
