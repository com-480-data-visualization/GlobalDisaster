let DATA = [];
let WORST_BY_COUNTRY = [];
let GLOBAL_SUMMARY = null;

async function loadData() {
    return loadPreprocessedData();
}

async function loadPreprocessedData() {
    const [disasters, globalSummary] = await Promise.all([
        fetchJSON('data/disasters_clean.json'),
        fetchJSON('data/global_summary.json')
    ]);

    DATA = disasters;
    GLOBAL_SUMMARY = globalSummary;
    WORST_BY_COUNTRY = getDeadliestDisastersByCountry(DATA);

    console.log('JSON DATA LOADED:', DATA.length);
    return DATA;
}

async function fetchJSON(path) {
    const res = await fetch(path);
    if (!res.ok) {
        throw new Error(`Missing preprocessed data file: ${path}`);
    }
    return res.json();
}

function showMissingDataOverlay() {
    const overlay = document.getElementById('data-missing-overlay');
    if (overlay) overlay.classList.remove('hidden');
}

function getAllDisasters() {
    return DATA;
}

function getGlobalSummary() {
    return GLOBAL_SUMMARY;
}

function getDisasterISO(disaster) {
    return disaster.iso3;
}

function getDisasterCountry(disaster) {
    return disaster.country;
}

function getDisasterRegion(disaster) {
    return disaster.region;
}

function getDisasterSubregion(disaster) {
    return disaster.subregion;
}

function getDisasterGroup(disaster) {
    return disaster.disaster_group;
}

function getDisasterType(disaster) {
    return disaster.disaster_type;
}

function getDisasterSubtype(disaster) {
    return disaster.disaster_subtype;
}

function getDisasterLocation(disaster) {
    return disaster.location;
}

function getDisasterStartYear(disaster) {
    return disaster.start_year;
}

function getDisasterEndYear(disaster) {
    return disaster.end_year;
}

function getDisasterStartMonth(disaster) {
    return disaster.start_month;
}

function getDisasterEndMonth(disaster) {
    return disaster.end_month;
}

function getDisasterDeaths(disaster) {
    return disaster.total_deaths;
}

function getDisasterAffected(disaster) {
    return disaster.total_affected;
}

function getDisasterDamage(disaster) {
    return disaster.total_damage_usd_000;
}

function getDisasterLabel(disaster) {
    const type = getDisasterType(disaster);
    const subtype = getDisasterSubtype(disaster);

    if (type && subtype && type !== subtype) {
        return `${type}: ${subtype}`;
    }

    return type || subtype || 'Unknown disaster';
}

function getDisastersInYearRange(startYear, endYear, disasters = DATA) {
    return disasters.filter(disaster => {
        const start = Number(getDisasterStartYear(disaster));
        const end = Number(getDisasterEndYear(disaster));

        if (!Number.isFinite(start) || !Number.isFinite(end)) return false;

        return end >= startYear && start <= endYear;
    });
}

function getDeadliestDisastersByCountry(disasters = DATA) {
    const byCountry = {};

    disasters.forEach(disaster => {
        const iso = getDisasterISO(disaster);
        const deaths = getDisasterDeaths(disaster);

        if (!iso || deaths === null || deaths === undefined || deaths <= 0) return;

        if (!byCountry[iso] || deaths > getDisasterDeaths(byCountry[iso])) {
            byCountry[iso] = disaster;
        }
    });

    return Object.values(byCountry);
}


function getDeadliestDisasterForCountry(iso3, disasters = DATA) {
    return getDeadliestDisastersByCountry(disasters)
        .find(disaster => getDisasterISO(disaster) === iso3) || null;
}

function getCountryDisasters(iso3, disasters = DATA) {
    return disasters.filter(disaster => getDisasterISO(disaster) === iso3);
}

function sumKnownValues(disasters, valueGetter) {
    return disasters.reduce((total, disaster) => {
        const value = valueGetter(disaster);
        const numberValue = Number(value);

        if (value === null || value === undefined || !Number.isFinite(numberValue)) {
            return total;
        }

        return total + numberValue;
    }, 0);
}

function getTopDisasterByMetric(iso3, metricGetter, disasters = DATA) {
    const countryDisasters = getCountryDisasters(iso3, disasters);
    let topDisaster = null;
    let topValue = -Infinity;

    countryDisasters.forEach(disaster => {
        const value = metricGetter(disaster);
        const numberValue = Number(value);

        if (value === null || value === undefined || !Number.isFinite(numberValue) || numberValue <= 0) {
            return;
        }

        if (numberValue > topValue) {
            topValue = numberValue;
            topDisaster = disaster;
        }
    });

    return topDisaster;
}

function getCostliestDisasterForCountry(iso3, disasters = DATA) {
    return getTopDisasterByMetric(iso3, getDisasterDamage, disasters);
}

function getCountrySummary(iso3, disasters = DATA) {
    const countryDisasters = getCountryDisasters(iso3, disasters);
    if (!countryDisasters.length) return null;

    const first = countryDisasters[0];
    const years = countryDisasters
        .map(getDisasterStartYear)
        .map(Number)
        .filter(Number.isFinite);

    const firstYear = Math.min(...years);
    const lastYear = Math.max(...years);
    const yearSpan = Math.max(1, lastYear - firstYear + 1);

    return {
        iso3,
        country: getDisasterCountry(first),
        region: getDisasterRegion(first),
        subregion: getDisasterSubregion(first),
        total_disasters: countryDisasters.length,
        total_deaths: sumKnownValues(countryDisasters, getDisasterDeaths),
        total_affected: sumKnownValues(countryDisasters, getDisasterAffected),
        total_damage_usd_000: sumKnownValues(countryDisasters, getDisasterDamage),
        first_year: firstYear,
        last_year: lastYear,
        avg_disasters_per_year: countryDisasters.length / yearSpan,
        deadliest_disaster: getDeadliestDisasterForCountry(iso3, disasters),
        costliest_disaster: getCostliestDisasterForCountry(iso3, disasters)
    };
}

function getCountryYearlySeries(iso3, disasters = DATA) {
    const byYear = {};

    getCountryDisasters(iso3, disasters).forEach(disaster => {
        const year = Number(getDisasterStartYear(disaster));
        if (!Number.isFinite(year)) return;

        byYear[year] = (byYear[year] || 0) + 1;
    });

    return Object.entries(byYear)
        .map(([year, count]) => ({ year: Number(year), count }))
        .sort((a, b) => a.year - b.year);
}

function getCountryDisasterTypes(iso3, disasters = DATA) {
    const counts = {};

    getCountryDisasters(iso3, disasters).forEach(disaster => {
        const type = getDisasterType(disaster) || 'Unknown';
        counts[type] = (counts[type] || 0) + 1;
    });

    return Object.entries(counts)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);
}

function getCountryDisasterCountsFromJSON(disasters = DATA) {
    const counts = {};

    disasters.forEach(disaster => {
        const iso = getDisasterISO(disaster);
        if (!iso) return;
        counts[iso] = (counts[iso] || 0) + 1;
    });

    return counts;
}

function getAverageMetricByCountryFromJSON(metricGetter, decimals = 0, disasters = DATA) {
    const totals = {};
    const counts = {};

    disasters.forEach(disaster => {
        const iso = getDisasterISO(disaster);
        const value = metricGetter(disaster);

        if (!iso || value === null || value === undefined || value === '') return;

        const numberValue = Number(value);
        if (!Number.isFinite(numberValue)) return;

        totals[iso] = (totals[iso] || 0) + numberValue;
        counts[iso] = (counts[iso] || 0) + 1;
    });

    const averages = {};
    const factor = 10 ** decimals;

    Object.entries(totals).forEach(([iso, total]) => {
        averages[iso] = Math.round((total / counts[iso]) * factor) / factor;
    });

    return averages;
}

function getAverageDeathsByCountryFromJSON(disasters = DATA) {
    return getAverageMetricByCountryFromJSON(getDisasterDeaths, 1, disasters);
}

function getAverageAffectedByCountryFromJSON(disasters = DATA) {
    return getAverageMetricByCountryFromJSON(getDisasterAffected, 0, disasters);
}

function getAverageDamageByCountryFromJSON(disasters = DATA) {
    return getAverageMetricByCountryFromJSON(getDisasterDamage, 0, disasters);
}

function getDominantDisasterTypeByCountryFromJSON(disasters = DATA) {
    const typeCountsByCountry = {};

    disasters.forEach(disaster => {
        const iso = getDisasterISO(disaster);
        const type = getDisasterType(disaster);

        if (!iso || !type) return;

        if (!typeCountsByCountry[iso]) typeCountsByCountry[iso] = {};
        typeCountsByCountry[iso][type] = (typeCountsByCountry[iso][type] || 0) + 1;
    });

    const result = {};

    Object.entries(typeCountsByCountry).forEach(([iso, counts]) => {
        result[iso] = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])[0][0];
    });

    return result;
}