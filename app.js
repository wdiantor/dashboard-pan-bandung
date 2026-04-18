<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard Pemenangan PAN - Kabupaten Bandung</title>
    
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">

    <style>
        :root {
            --pan-blue-dark: #004182;
            --pan-blue-main: #0054a6;
            --pan-blue-light: #00a0e9;
            --bg-slate: #0f172a;
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg-slate);
            color: #f8fafc;
            margin: 0;
        }

        .header-gradient {
            background: linear-gradient(135deg, var(--pan-blue-dark) 0%, var(--pan-blue-main) 100%);
            border-bottom: 4px solid var(--pan-blue-light);
        }

        .glass-card {
            background: rgba(30, 41, 59, 0.7);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 1rem;
        }

        #map {
            height: 500px;
            width: 100%;
            border-radius: 1rem;
            z-index: 1;
        }

        .custom-select {
            background-color: #1e293b;
            color: white;
            border: 1px solid #334155;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            width: 100%;
        }

        .stat-value {
            background: linear-gradient(to right, #fff, var(--pan-blue-light));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-weight: 800;
        }

        /* Custom Popup Leaflet */
        .leaflet-popup-content-wrapper {
            background: #1e293b;
            color: white;
            border: 1px solid var(--pan-blue-light);
        }
        .leaflet-popup-tip { background: #1e293b; }
    </style>
</head>
<body>

    <header class="header-gradient p-4 shadow-2xl">
        <div class="container mx-auto flex flex-wrap justify-between items-center gap-4">
            <div class="flex items-center gap-4">
                <img src="https://upload.wikimedia.org/wikipedia/commons/b/b2/Lambang_Kabupaten_Bandung.png" alt="Kab Bandung" class="h-14 w-auto drop-shadow-md">
                <img src="https://upload.wikimedia.org/wikipedia/id/thumb/e/e0/Logo_DPRD_Kabupaten_Bandung.png/200px-Logo_DPRD_Kabupaten_Bandung.png" alt="DPRD" class="h-14 w-auto drop-shadow-md">
            </div>
            
            <div class="text-center flex-1">
                <h1 class="text-2xl md:text-3xl font-bold tracking-tight">DATA PEMENANGAN PARTAI AMANAT NASIONAL</h1>
                <p class="text-blue-200 text-sm md:text-base">Monitoring Kekuatan Kader & DPRT Kabupaten Bandung</p>
            </div>

            <div class="flex items-center">
                <img src="https://upload.wikimedia.org/wikipedia/id/4/47/Partai_Amanat_Nasional_Logo.svg" alt="PAN" class="h-16 w-auto drop-shadow-md">
            </div>
        </div>
    </header>

    <main class="container mx-auto p-4 md:p-6 space-y-6">
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="glass-card p-6 flex flex-col justify-center">
                <label class="block text-sm font-medium mb-2 text-blue-300">PILIH WILAYAH</label>
                <select id="filterKecamatan" class="custom-select" onchange="applyFilter()">
                    <option value="ALL">SEMUA KECAMATAN</option>
                </select>
            </div>
            
            <div class="glass-card p-6 text-center border-l-4 border-blue-500">
                <p class="text-gray-400 text-sm uppercase tracking-wider font-semibold">Total DPRT Aktif</p>
                <h2 id="stat-dprt" class="text-4xl stat-value">0</h2>
            </div>

            <div class="glass-card p-6 text-center border-l-4 border-cyan-400">
                <p class="text-gray-400 text-sm uppercase tracking-wider font-semibold">Total Kader</p>
                <h2 id="stat-kader" class="text-4xl stat-value">0</h2>
            </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="glass-card p-4">
                <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
                    <span class="w-2 h-6 bg-blue-500 rounded-full"></span>
                    Sebaran Wilayah (Kecamatan)
                </h3>
                <div id="map"></div>
            </div>

            <div class="glass-card p-4">
                <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
                    <span class="w-2 h-6 bg-cyan-400 rounded-full"></span>
                    Statistik Perbandingan Kader & DPRT
                </h3>
                <div class="h-[450px]">
                    <canvas id="panChart"></canvas>
                </div>
            </div>
        </div>
    </main>

    <script>
        const API_KEY = 'AIzaSyCYtG_xQDwjzZ2gnlwucGtVWyz9VU51GWs';
        const SPREADSHEET_ID = '1D0H3zZ4meoumKNAwQl8zqfHLUZ2r-KI7KYbfoD-hPz4';
        const RANGE = 'Sheet1!A2:E281'; 

        let allData = [];
        let myChart = null;
        let map = null;
        let geojsonLayer = null;

        const idx = { desa: 1, kec: 2, dprt: 3, kader: 4 };

        async function initDashboard() {
            try {
                const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`);
                const data = await response.json();
                
                if (!data.values) return;
                
                allData = data.values.filter(row => row.length >= 3).map(row => {
                    if(row[idx.kec]) row[idx.kec] = row[idx.kec].trim().toUpperCase();
                    return row;
                });

                const select = document.getElementById('filterKecamatan');
                const kecamatanList = [...new Set(allData.map(row => row[idx.kec]))]
                    .filter(val => val && isNaN(val))
                    .sort();
                
                kecamatanList.forEach(kec => {
                    let opt = document.createElement('option');
                    opt.value = kec;
                    opt.textContent = kec;
                    select.appendChild(opt);
                });

                initMap();
                applyFilter();

            } catch (e) { 
                console.error("Error load data:", e); 
            }
        }

        function applyFilter() {
            const filterValue = document.getElementById('filterKecamatan').value;
            
            const filtered = filterValue === "ALL" 
                ? allData 
                : allData.filter(row => row[idx.kec] === filterValue);

            const totalDPRT = filtered.reduce((acc, row) => acc + (parseInt(row[idx.dprt]) || 0), 0);
            const totalKader = filtered.reduce((acc, row) => acc + (parseInt(row[idx.kader]) || 0), 0);
            
            document.getElementById('stat-dprt').innerText = totalDPRT.toLocaleString('id-ID');
            document.getElementById('stat-kader').innerText = totalKader.toLocaleString('id-ID');

            let labels = [], vDPRT = [], vKader = [];

            if (filterValue === "ALL") {
                const summary = {};
                filtered.forEach(row => {
                    const kec = row[idx.kec];
                    if(kec) {
                        if(!summary[kec]) summary[kec] = { d: 0, k: 0 };
                        summary[kec].d += (parseInt(row[idx.dprt]) || 0);
                        summary[kec].k += (parseInt(row[idx.kader]) || 0);
                    }
                });
                labels = Object.keys(summary);
                vDPRT = labels.map(l => summary[l].d);
                vKader = labels.map(l => summary[l].k);
            } else {
                labels = filtered.map(row => row[idx.desa]);
                vDPRT = filtered.map(row => parseInt(row[idx.dprt]) || 0);
                vKader = filtered.map(row => parseInt(row[idx.kader]) || 0);
            }

            renderChart(labels, vDPRT, vKader);
            if (geojsonLayer) geojsonLayer.resetStyle();
        }

        function renderChart(l, vD, vK) {
            const ctx = document.getElementById('panChart').getContext('2d');
            if (myChart) myChart.destroy();

            myChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: l,
                    datasets: [
                        {
                            label: 'Kader',
                            data: vK,
                            backgroundColor: '#00a0e9',
                            borderRadius: 4,
                            barPercentage: 0.8
                        },
                        {
                            label: 'DPRT Aktif',
                            data: vD,
                            backgroundColor: '#0054a6',
                            borderRadius: 4,
                            barPercentage: 0.8
                        }
                    ]
                },
                options: {
                    indexAxis: 'y',
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { labels: { color: '#94a3b8' } },
                        tooltip: { mode: 'index', intersect: false }
                    },
                    scales: {
                        y: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { display: false } },
                        x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
                    }
                }
            });
        }

        function initMap() {
            if (map) return;
            map = L.map('map').setView([-7.0252, 107.5197], 10);
            
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap'
            }).addTo(map);

            fetch('kab-bandung.json')
                .then(res => res.json())
                .then(geoData => {
                    geojsonLayer = L.geoJson(geoData, {
                        style: styleMap,
                        onEachFeature: (feature, layer) => {
                            let name = (feature.properties.KECAMATAN || feature.properties.name || feature.properties.NAMOBJ || "").toUpperCase().trim();
                            
                            const dataKec = allData.filter(row => row[idx.kec] === name);
                            const tDPRT = dataKec.reduce((acc, row) => acc + (parseInt(row[idx.dprt]) || 0), 0);
                            const tKader = dataKec.reduce((acc, row) => acc + (parseInt(row[idx.kader]) || 0), 0);

                            layer.bindPopup(`
                                <div class="p-2">
                                    <b class="text-blue-400">KECAMATAN ${name}</b><br>
                                    <div class="mt-2 text-sm">
                                        DPRT Aktif: <b>${tDPRT}</b><br>
                                        Total Kader: <b>${tKader}</b>
                                    </div>
                                </div>
                            `);
                            
                            layer.on('click', () => {
                                const select = document.getElementById('filterKecamatan');
                                select.value = name;
                                applyFilter();
                            });
                        }
                    }).addTo(map);
                });
        }

        function styleMap(feature) {
            const name = (feature.properties.KECAMATAN || feature.properties.name || feature.properties.NAMOBJ || "").toUpperCase().trim();
            const dataKec = allData.filter(row => row[idx.kec] === name);
            const total = dataKec.reduce((acc, row) => acc + (parseInt(row[idx.dprt]) || 0), 0);
            return { 
                fillColor: getColor(total), 
                weight: 1, 
                color: '#334155', 
                fillOpacity: 0.7 
            };
        }

        function getColor(d) {
            return d > 1000 ? '#004182' : 
                   d > 500  ? '#0054a6' : 
                   d > 100  ? '#00a0e9' : 
                   d > 10   ? '#7dd3fc' : 
                              '#1e293b'; 
        }

        initDashboard();
    </script>
</body>
</html>
