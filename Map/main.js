mapboxgl.accessToken = MAPBOX_TOKEN;

let globeActive = false;
let countryActive = false;
let hoveredId = null;
let countryCounts = null;
let averageDeathsByCountry = null;
let averageDamageByCountry = null;
let selectedId = null;
let selectedFeature = null;

const featureComputers = {
    'disaster-number': () => ({
        values: getCountryDisasterCounts(),
        colors: ['#ffffff', '#d7f0f0', '#9bd4d0', '#58aaa7', '#197f83', '#00555f'],
        scale: 'linear',
        legendTitle: 'Natural disasters',
        legendNoDataLabel: 'No data',
        legendFormatter: formatLegendNumber
    }),
    'average-deaths': () => ({
        values: getAverageDeathsByCountry(),
        colors: ['#ffffff', '#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'],
        scale: 'log',
        legendTitle: 'Avg deaths / disaster (log scale)',
        legendNoDataLabel: 'No deaths recorded',
        legendFormatter: formatLegendNumber
    }),
    'average-damage': () => ({
        values: getAverageDamageByCountry(),
        colors: ['#ffffff', '#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'],
        scale: 'log',
        legendTitle: 'Avg losses / disaster (log scale)',
        legendNoDataLabel: 'No losses recorded',
        legendFormatter: formatLegendNumber
    }),
};

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [0, 40],
    zoom: 2.5
});

map.on('load', async () => {

    setupFeaturePanel();
    await loadData();

    //get Mapbox country boundaries
    map.addSource('country-source', {
        type: 'vector',
        url: 'mapbox://mapbox.country-boundaries-v1'
    });

    // country layer
    map.addLayer({
        id: 'countries',
        type: 'fill',
        source: 'country-source',
        'source-layer': 'country_boundaries',
        paint: {
            'fill-color': '#ffffff',
            'fill-opacity': 1
        }
    });

    // country border
    map.addLayer({
        id: 'countries-border',
        type: 'line',
        source: 'country-source',
        'source-layer': 'country_boundaries',
        paint: {
            'line-color': '#888888',
            'line-width': 0.5
        }
    });

   // hovering 
    map.on('mousemove', 'countries', (e) => {

        if (!countryActive) return;

        map.getCanvas().style.cursor = 'pointer';

        const newId = e.features[0].id;

        if (hoveredId !== null && hoveredId !== newId) {
            map.setFeatureState(
                {
                    source: 'country-source',
                    sourceLayer: 'country_boundaries',
                    id: hoveredId
                },
                { hover: false }
            );
        }

        hoveredId = newId;

        map.setFeatureState(
            {
                source: 'country-source',
                sourceLayer: 'country_boundaries',
                id: hoveredId
            },
            { hover: true }
        );
    });

    map.on('mouseleave', 'countries', () => {

        map.getCanvas().style.cursor = '';

        if (hoveredId !== null) {
            map.setFeatureState(
                {
                    source: 'country-source',
                    sourceLayer: 'country_boundaries',
                    id: hoveredId
                },
                { hover: false }
            );
        }

        hoveredId = null;
    });

    //click for panel, get properties for pop up at the right of country 
    map.on('click', 'countries', (e) => {

        if (!countryActive) return;

        //color only clicked country
        if (selectedId !== null) { 
        map.setFeatureState(
            { source: 'country-source', sourceLayer: 'country_boundaries', id: selectedId },
            { selected: false }
        );
    }

    selectedId = e.features[0].id;
    map.setFeatureState(
        { source: 'country-source', sourceLayer: 'country_boundaries', id: selectedId },
        { selected: true }
    );

        clearHover();
        openPanel(e.features[0].properties, e.features[0].geometry);
    });

    makeDraggable(document.getElementById('panel'));
    updateMap();


});

function setupFeaturePanel() {
    const featureInputs = document.querySelectorAll('input[name="feature"]');
    const checkedFeature = document.querySelector('input[name="feature"]:checked');

    selectedFeature = checkedFeature ? checkedFeature.value : null;

    featureInputs.forEach(input => {
        input.addEventListener('change', () => {
            selectedFeature = input.checked ? input.value : null;

            featureInputs.forEach(otherInput => {
                if (otherInput !== input) {
                    otherInput.checked = false;
                }
            });

            updateMap();
        });
    });
}

function getSelectedFeatureData() {
    if (!selectedFeature) return null;

    const computeFeatureData = featureComputers[selectedFeature];

    return computeFeatureData ? computeFeatureData() : null;
}


//panel functions
function openPanel(country, geometry) {
    const panel = document.getElementById('panel');

    const margin = 20;
    panel.style.left  = '';
    panel.style.right = margin + 'px';
    panel.style.top   = margin + 'px';

    panel.classList.remove('hidden');

    const iso2 = country.iso_3166_1.toLowerCase();
    const iso3 = country.iso_3166_1_alpha_3;

    document.getElementById('country-name').innerText = country.name_en;
    document.getElementById('country-flag').src = `https://flagcdn.com/w80/${iso2}.png`;


    const hit = WORST_BY_COUNTRY.find(d => d.ISO === iso3);
    const container = document.getElementById('worst-by-country-container');

    if (hit) {
        const name = hit.Event_Name || hit.Disaster_Type;
        container.innerHTML = `
            <div class="worst-by-country-section-title">Deadliest Disaster Recorded</div>
            <div class="worst-by-country-badge" style="animation-delay:0s">
                <div class="badge-top-row">
                    <div class="badge-name">${name}</div>
                    <span class="badge-year">${hit.Start_Year}</span>  
                </div>
                <span class="badge-deaths"> ${hit.Total_Deaths.toLocaleString()} deaths</span>
                <div class="badge-bottom-row">
                    <span class="badge-type">${hit.Disaster_Subtype}</span>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = '<div class="worst-by-country-section-title">No recorded data</div>';
    }
}

function closePanel() {
    document.getElementById('panel').classList.add('hidden');

    if (selectedId !== null) {
        map.setFeatureState(
            { source: 'country-source', sourceLayer: 'country_boundaries', id: selectedId },
            { selected: false }
        );
        selectedId = null;
    }
}

//make the panel draggable
function makeDraggable(el) {
    let startX, startY, startLeft, startTop;

    el.addEventListener('mousedown', (e) => {

        if (e.target.tagName === 'BUTTON') return;
        e.stopPropagation();

        startX = e.clientX;
        startY = e.clientY;
        startLeft = el.offsetLeft;
        startTop = el.offsetTop;

        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
    });

    //limit the drag to window boundaries 
    function onDrag(e) {
    const newLeft = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, startLeft + e.clientX - startX));
    const newTop = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, startTop + e.clientY - startY));
    el.style.left = newLeft + 'px';
    el.style.top = newTop + 'px';
}

    function stopDrag() {
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
    }
}



function toggleGlobe() {

    globeActive = !globeActive;

    clearHover();

    document.getElementById("btn-globe")
        .classList.toggle("active", globeActive);

    updateMap();
}

function toggleCountry() {

    countryActive = !countryActive;

    document.getElementById("btn-country")
        .classList.toggle("active", countryActive);

    if (!countryActive) {
        closePanel();
        clearHover();
        map.getCanvas().style.cursor = '';
    }
}

// helper for hover
function clearHover() {

    if (hoveredId !== null) {
        map.setFeatureState(
            {
                source: 'country-source',
                sourceLayer: 'country_boundaries',
                id: hoveredId
            },
            { hover: false }
        );
    }

    hoveredId = null;
}


function isNaturalDisaster(disaster) {
    if (!disaster.Disaster_Group) return true;
    return String(disaster.Disaster_Group).trim().toLowerCase() === 'natural';
}

function getNumericValue(disaster, columns) {
    for (const column of columns) {
        const value = disaster[column];

        if (value !== undefined && value !== null && value !== '') {
            const numberValue = Number(value);
            return Number.isFinite(numberValue) ? numberValue : 0;
        }
    }

    return 0;
}

function roundMetricValue(value, decimals) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

function getAverageMetricByCountry(columns, decimals = 0) {
    const totals = {};
    const counts = {};

    DATA.filter(isNaturalDisaster).forEach(disaster => {
        if (!disaster.ISO) return;

        totals[disaster.ISO] = (totals[disaster.ISO] || 0) + getNumericValue(disaster, columns);
        counts[disaster.ISO] = (counts[disaster.ISO] || 0) + 1;
    });

    const averages = {};

    for (const [iso, total] of Object.entries(totals)) {
        averages[iso] = roundMetricValue(total / counts[iso], decimals);
    }

    return averages;
}

// get the number of natural disasters from data for each country
function getCountryDisasterCounts() {

    if (countryCounts) return countryCounts;  // use cache for performance
    countryCounts = {};
    DATA.filter(isNaturalDisaster).forEach(d => {
        if (!d.ISO) return;
        countryCounts[d.ISO] = (countryCounts[d.ISO] || 0) + 1;
    });

    if (Object.keys(countryCounts).length === 0) {
        DATA.forEach(d => {
            if (!d.ISO) return;
            countryCounts[d.ISO] = (countryCounts[d.ISO] || 0) + 1;
        });
    }

    return countryCounts;
}

function getAverageDeathsByCountry() {
    if (averageDeathsByCountry) return averageDeathsByCountry;

    averageDeathsByCountry = getAverageMetricByCountry(['Total_Deaths'], 1);

    return averageDeathsByCountry;
}

function getAverageDamageByCountry() {
    if (averageDamageByCountry) return averageDamageByCountry;

    averageDamageByCountry = getAverageMetricByCountry([
        'Total_Damage',
        "Total_Damage_('000_US$)",
        'Total_Damage_000_US$'
    ]);

    return averageDamageByCountry;
}

function createCountryValueExpression(values) {
    const entries = Object.entries(values);

    if (entries.length === 0) return 0;

    const valueExpression = [
        'match',
        ['get', 'iso_3166_1_alpha_3']
    ];

    for (const [iso, value] of entries) {
        valueExpression.push(iso, value);
    }

    valueExpression.push(0);

    return valueExpression;
}

function createHeatmapExpression(featureData) {
    const valueExpression = createCountryValueExpression(featureData.values);
    const stops = createHeatmapStops(featureData);
    const choropleth = ['step', valueExpression, featureData.colors[0]];

    stops.forEach(stop => {
        choropleth.push(stop.threshold, stop.color);
    });

    return choropleth;
}

function createHeatmapStops(featureData) {
    const values = Object.values(featureData.values);
    const max = Math.max(...values, 0);
    const positiveValues = values.filter(value => value > 0);

    if (positiveValues.length === 0) return [];

    const minPositive = Math.min(...positiveValues);
    const colors = featureData.colors;
    const roundThreshold = value => max >= 10 ? Math.ceil(value) : roundMetricValue(value, 1);
    const thresholds = featureData.scale === 'log'
        ? createLogThresholds(minPositive, max, colors.length - 1, roundThreshold)
        : [
            minPositive,
            roundThreshold(max * 0.2),
            roundThreshold(max * 0.4),
            roundThreshold(max * 0.6),
            roundThreshold(max * 0.8)
        ];

    const sortedThresholds = thresholds
        .filter(threshold => threshold > 0)
        .sort((a, b) => a - b);
    const stops = [];

    sortedThresholds.forEach(threshold => {
        if (!stops.some(stop => stop.threshold === threshold) && stops.length < colors.length - 1) {
            stops.push({
                threshold,
                color: colors[stops.length + 1]
            });
        }
    });

    return stops;
}

function createLogThresholds(min, max, count, roundThreshold) {
    if (min === max) return [min];

    const logMin = Math.log10(min);
    const logMax = Math.log10(max);
    const thresholds = [];

    for (let index = 0; index < count; index++) {
        const position = index / count;
        const rawThreshold = 10 ** (logMin + (logMax - logMin) * position);
        thresholds.push(index === 0 ? min : roundThreshold(rawThreshold));
    }

    return thresholds;
}

function formatLegendNumber(value) {
    return value.toLocaleString(undefined, {
        maximumFractionDigits: 1
    });
}

function updateLegend(featureData) {
    const legend = document.getElementById('heatmap-legend');
    const legendTitle = legend.querySelector('h2');
    const legendItems = document.getElementById('heatmap-legend-items');

    if (!featureData || !globeActive) {
        legend.classList.add('hidden');
        legendItems.innerHTML = '';
        return;
    }

    const stops = createHeatmapStops(featureData);
    const values = Object.values(featureData.values);
    const max = Math.max(...values, 0);
    const formatValue = featureData.legendFormatter || formatLegendNumber;
    legendTitle.innerText = featureData.legendTitle || 'Heatmap';

    const legendRows = [
        {
            color: featureData.colors[0],
            label: featureData.legendNoDataLabel || 'No data'
        }
    ];

    stops.forEach((stop, index) => {
        const nextStop = stops[index + 1];
        const label = nextStop
            ? `${formatValue(stop.threshold)} to < ${formatValue(nextStop.threshold)}`
            : `${formatValue(stop.threshold)}+`;

        legendRows.push({
            color: stop.color,
            label
        });
    });

    legendItems.innerHTML = legendRows.map(row => `
        <div class="legend-item">
            <span class="legend-swatch" style="background:${row.color}"></span>
            <span>${row.label}</span>
        </div>
    `).join('');

    legend.classList.remove('hidden');
}

//choropleth map for global disaster view
function updateMap() {
    if (!map.getLayer('countries')) return;

    const featureData = getSelectedFeatureData();

    if (!globeActive || !featureData) {
        updateLegend(null);
        clearHover();
    
        map.setPaintProperty('countries', 'fill-color', [
            'case',
            ['boolean', ['feature-state', 'hover'], false],
            '#aaaaaa',
            ['boolean', ['feature-state', 'selected'], false], '#e3bb80',
            '#ffffff'
        ]);
    
        return;
    }

    const choropleth = createHeatmapExpression(featureData);
    updateLegend(featureData);

    map.setPaintProperty('countries', 'fill-color', [
        'case',

        ['boolean', ['feature-state', 'hover'], false],
        '#aaaaaa',
        ['boolean', ['feature-state', 'selected'], false], '#e3bb80',
        choropleth
    ]);
}
