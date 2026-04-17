const API_KEY = 'AIzaSyCYtG_xQDwjzZ2gnlwucGtVWyz9VU51GWs';
const SPREADSHEET_ID = '1D0H3zZ4meoumKNAwQl8zqfHLUZ2r-KI7KYbfoD-hPz4';
const RANGE = 'Sheet1!A2:E281'; // Kolom A sampai E

let allData = [];
let myChart = null;

async function initDashboard() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        allData = data.values;

        // Isi Dropdown Kecamatan
        const kecamatanList = [...new Set(allData.map(row => row[2]))].sort();
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
    
    // Filter data berdasarkan kecamatan
    const filtered = filterValue === "ALL" 
        ? allData 
        : allData.filter(row => row[2] === filterValue);

    // Jika filter ALL, tampilkan ringkasan per kecamatan
    // Jika filter per Kecamatan, tampilkan detail per desa
    let labels, dprtData, kaderData;

    if (filterValue === "ALL") {
        // Kelompokkan data per kecamatan untuk grafik utama
        const summary = {};
        filtered.forEach(row => {
            const kec = row[2];
            summary[kec] = (summary[kec] || 0) + parseInt(row[3] || 0);
        });
        labels = Object.keys(summary);
        dprtData = Object.values(summary);
    } else {
        // Tampilkan detail Desa
        labels = filtered.map(row => row[1]); // Nama Desa
        dprtData = filtered.map(row => parseInt(row[3] || 0));
        kaderData = filtered.map(row => parseInt(row[4] || 0));
    }

    // Update Statistik
    const totalDPRT = filtered.reduce((acc, row) => acc + parseInt(row[3] || 0), 0);
    const totalKader = filtered.reduce((acc, row) => acc + parseInt(row[4] || 0), 0);
    document.getElementById('stat-dprt').innerText = totalDPRT.toLocaleString('id-ID');
    document.getElementById('stat-kader').innerText = totalKader.toLocaleString('id-ID');

    renderChart(labels, dprtData);
}

function renderChart(labels, dataValues) {
    const ctx = document.getElementById('panChart').getContext('2d');
    if (myChart) myChart.destroy();

    myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'DPRT Aktif',
                data: dataValues,
                backgroundColor: '#3b82f6',
                borderRadius: 5
            }]
        },
        options: {
            maintainAspectRatio: false,
            indexAxis: 'y', // Horizontal bar agar nama desa/kecamatan terbaca jelas
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                y: { ticks: { color: '#94a3b8' } }
            }
        }
    });
}

initDashboard();
