<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard DPD PAN Kab. Bandung</title>
    
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

    <style>
        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background-color: #0f172a; /* Warna background gelap sesuai gambar */
            color: #f8fafc;
        }

        .card-main {
            background-color: #1e293b;
            border-radius: 1rem;
            border: 1px solid #334155;
            padding: 1.5rem;
            height: 100%;
        }

        .stat-card {
            background-color: #1e293b;
            border-radius: 12px;
            padding: 1.5rem;
            border: 1px solid #334155;
            display: flex;
            align-items: center;
            gap: 1rem;
        }

        .icon-box {
            width: 50px;
            height: 50px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(59, 130, 246, 0.1);
            color: #3b82f6;
            font-size: 1.2rem;
        }

        #map {
            height: 500px;
            border-radius: 0.75rem;
            filter: grayscale(1) invert(1) contrast(0.9); /* Dark mode map effect */
        }

        select {
            background-color: #0f172a !important;
            border: 1px solid #334155 !important;
            color: white !important;
        }

        .header-logo { height: 50px; object-fit: contain; }
    </style>
</head>
<body class="p-6">

    <div class="flex flex-wrap justify-between items-center mb-8 gap-4">
        <div>
            <h1 class="text-3xl font-extrabold text-blue-500 tracking-tight">DASHBOARD DPD PAN</h1>
            <p class="text-slate-400 font-medium">Monitoring Sebaran DPRT & Kader Kab. Bandung</p>
        </div>
        <div class="flex gap-4 items-center">
            <img src="https://upload.wikimedia.org/wikipedia/commons/b/b2/Lambang_Kabupaten_Bandung.png" class="header-logo" alt="Kab Bandung">
            <img src="https://upload.wikimedia.org/wikipedia/id/4/47/Partai_Amanat_Nasional_Logo.svg" class="header-logo" alt="PAN">
            <div class="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 text-xs">
                Data Terakhir: <span class="text-blue-400 font-bold">Real-time (Sheets)</span>
            </div>
        </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="card-main">
            <p class="text-xs font-bold text-slate-500 uppercase mb-3 tracking-widest">Filter Wilayah</p>
            <select id="filterKecamatan" class="w-full p-3 rounded-xl outline-none" onchange="applyFilter()">
                <option value="ALL">SEMUA KECAMATAN</option>
            </select>
        </div>

        <div class="stat-card">
            <div class="icon-box"><i class="fa-solid fa-users-viewfinder"></i></div>
            <div>
                <p class="text-xs font-bold text-slate-500 uppercase tracking-widest">DPRT Aktif</p>
                <h2 id="stat-dprt" class="text-3xl font-extrabold">0</h2>
            </div>
        </div>

        <div class="stat-card">
            <div class="icon-box text-orange-500 bg-orange-500/10"><i class="fa-solid fa-id-card-clip"></i></div>
            <div>
                <p class="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Kader</p>
                <h2 id="stat-kader" class="text-3xl font-extrabold text-white">0</h2>
            </div>
        </div>

        <div class="stat-card">
            <div class="icon-box text-emerald-500 bg-emerald-500/10"><i class="fa-solid fa-chart-line"></i></div>
            <div>
                <p class="text-xs font-bold text-slate-500 uppercase tracking-widest">Target Tercapai</p>
                <h2 class="text-3xl font-extrabold text-white">100%</h2>
            </div>
        </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-span-5 card-main">
            <div class="flex justify-between items-center mb-6">
                <h3 class="font-bold text-lg">Grafik Sebaran Data</h3>
                <span class="text-[10px] bg-blue-600 px-2 py-1 rounded text-white font-bold">BAR CHART</span>
            </div>
            <div class="h-[450px]">
                <canvas id="panChart"></canvas>
            </div>
        </div>

        <div class="lg:col-span-7 card-main">
            <div class="flex justify-between items-center mb-6">
                <h3 class="font-bold text-lg">Peta Wilayah Kerja</h3>
                <span class="text-[10px] bg-slate-700 px-2 py-1 rounded text-slate-300 font-bold tracking-widest">KAB. BANDUNG</span>
            </div>
            <div id="map"></div>
        </div>
    </div>

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
            } catch (e) { console.error("Error load data:", e); }
        }

        function applyFilter() {
            const filterValue = document.getElementById('filterKecamatan').value;
            const filtered = filterValue === "ALL" ? allData : allData.filter(row => row[idx.kec] === filterValue);

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
                            backgroundColor: '#3b82f6', // Biru Solid
                            borderRadius: 6,
                            barThickness: 12
                        },
                        {
                            label: 'DPRT',
                            data: vD,
                            backgroundColor: '#1d4ed8', // Biru Gelap
                            borderRadius: 6,
                            barThickness: 12
                        }
                    ]
                },
                options: {
                    indexAxis: 'y',
                    maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: false },
                        tooltip: { backgroundColor: '#1e293b' }
                    },
                    scales: {
                        y: { ticks: { color: '#64748b', font: { size: 10, weight: '600' } }, grid: { display: false } },
                        x: { ticks: { color: '#64748b' }, grid: { color: '#334155' } }
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
                        style: (f) => ({ fillColor: '#3b82f6', weight: 1.5, color: '#1e293b', fillOpacity: 0.3 }),
                        onEachFeature: (feature, layer) => {
                            let name = (feature.properties.KECAMATAN || feature.properties.name || "").toUpperCase().trim();
                            layer.on('click', () => {
                                document.getElementById('filterKecamatan').value = name;
                                applyFilter();
                            });
                        }
                    }).addTo(map);
                });
        }

        initDashboard();
    </script>
</body>
</html>
