const API_KEY = 'AIzaSyCYtG_xQDwjzZ2gnlwucGtVWyz9VU51GWs';
const SPREADSHEET_ID = '1D0H3zZ4meoumKNAwQl8zqfHLUZ2r-KI7KYbfoD-hPz4';
const RANGE = 'Sheet1!A2:E281'; // Sesuaikan: Kolom A=Kecamatan, B=Jumlah

const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${API_KEY}`;

async function loadDashboardData() {
    try {
        const response = await fetch(url);
        const data = await response.json();
        const rows = data.values;

        if (!rows) return;

        const labels = rows.map(row => row[0]); // Ambil Kecamatan
        const values = rows.map(row => parseInt(row[1])); // Ambil Jumlah
        
        // Update Total di Header
        const total = values.reduce((a, b) => a + b, 0);
        document.getElementById('total-stats').innerText = total.toLocaleString('id-ID');

        renderChart(labels, values);
    } catch (error) {
        console.error("Gagal mengambil data:", error);
    }
}

function renderChart(labels, values) {
    const ctx = document.getElementById('panChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Jumlah DPD',
                data: values,
                backgroundColor: '#3b82f6',
                borderRadius: 10,
                hoverBackgroundColor: '#f97316'
            }]
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

loadDashboardData();