let DATA = [];
let TOP20 = [];

async function loadData() {
    console.log(DATA[0])
    const res = await fetch("emdat_data.xlsx");
    const buffer = await res.arrayBuffer();

    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets["EM-DAT Data"];
    const raw = XLSX.utils.sheet_to_json(sheet);

    DATA = raw.map(cleanColumns);
    computeTop20();

    console.log("DATA LOADED:", DATA.length);
    console.log(DATA[0]); 

    return DATA;
}

function computeTop20() {
    TOP20 = [...DATA]
        .filter(d => d.Total_Deaths > 0)
        .sort((a, b) => b.Total_Deaths - a.Total_Deaths)
        .slice(0, 20)
        .map((d, i) => ({ ...d, rank: i + 1 }));
}

function cleanColumns(row) {
    const r = {};
    for (let k in row) {
        const nk = k.trim()
            .replace(/\s+/g, "_")
            .replace(/\./g, "")
            .replace(/\//g, "_");
        r[nk] = row[k];
    }
    return r;
}