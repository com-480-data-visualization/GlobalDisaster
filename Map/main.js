mapboxgl.accessToken = MAPBOX_TOKEN;

let globeActive = false;
let countryActive = false;
let hoveredId = null;
let hoveredCartogramIso = null;
let selectedCartogramIso = null;
let countryCounts = null;
let averageDeathsByCountry = null;
let averageDamageByCountry = null;
let averageAffectedByCountry = null;
let averageAidByCountry = null;
let dominantDisasterTypeByCountry = null;
let selectedId = null;
let selectedFeature = null;

// --- Dual-selection state ---
// colorFeature: the feature driving choropleth color
// distortFeature: the feature driving cartogram distortion (null if none)
let colorFeature = 'disaster-number';
let distortFeature = null;

// Raw world GeoJSON for cartogram distortion
let worldGeoJSON = null;

const disasterTypeOrder = [
    'Wildfire',
    'Mass movement (wet)',
    'Flood',
    'Storm',
    'Earthquake',
    'Drought',
    'Epidemic',
    'Volcanic activity',
    'Glacial lake outburst flood',
    'Extreme temperature',
    'Mass movement (dry)',
    'Infestation',
    'Animal incident',
    'Impact',
    'Fog'
];

const disasterTypeColors = {
    'Wildfire': '#d95f02',
    'Mass movement (wet)': '#8c6d31',
    'Flood': '#1f78b4',
    'Storm': '#6a3d9a',
    'Earthquake': '#7f3b08',
    'Drought': '#e6ab02',
    'Epidemic': '#1b9e77',
    'Volcanic activity': '#b2182b',
    'Glacial lake outburst flood': '#56b4e9',
    'Extreme temperature': '#e7298a',
    'Mass movement (dry)': '#a6761d',
    'Infestation': '#66a61e',
    'Animal incident': '#7570b3',
    'Impact': '#4d4d4d',
    'Fog': '#bdbdbd'
};

// Which features can be used as distortion (must be numeric, not categorical)
const DISTORTABLE_FEATURES = new Set([
    'disaster-number',
    'average-deaths',
    'average-damage',
    'average-affected',
    'average-aid'
]);

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
        legendNoDataLabel: 'No registered deaths data',
        legendFormatter: formatLegendNumber
    }),
    'average-damage': () => ({
        values: getAverageDamageByCountry(),
        colors: ['#ffffff', '#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'],
        scale: 'log',
        legendTitle: 'Avg losses / disaster (log scale)',
        legendNoDataLabel: 'No registered loss data',
        legendFormatter: formatLegendNumber
    }),
    'dominant-disaster-type': () => ({
        values: getDominantDisasterTypeByCountry(),
        colorsByValue: disasterTypeColors,
        typeOrder: disasterTypeOrder,
        legendTitle: 'Most represented type',
        legendNoDataLabel: 'No data',
        legendType: 'categorical'
    }),
    'average-affected': () => ({
        values: getAverageAffectedByCountry(),
        colors: ['#ffffff', '#f2f0f7', '#cbc9e2', '#9e9ac8', '#756bb1', '#54278f'],
        scale: 'log',
        legendTitle: 'Avg affected / disaster (log scale)',
        legendNoDataLabel: 'No registered affected data',
        legendFormatter: formatLegendNumber
    }),
    'average-aid': () => ({
        values: getAverageAidByCountry(),
        colors: ['#ffffff', '#e0f7fa', '#b2ebf2', '#80deea', '#26c6da', '#00838f'],
        scale: 'log',
        legendTitle: 'Avg aid / disaster (log scale)',
        legendNoDataLabel: 'No registered aid data',
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
    refreshFeatureTags();
    await loadData();
    await fetchWorldGeoJSON();

    // Base Mapbox vector tile layer (always present, used for interaction)
    map.addSource('country-source', {
        type: 'vector',
        url: 'mapbox://mapbox.country-boundaries-v1'
    });

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

    // Cartogram distorted layer (GeoJSON, drawn on top)
    map.addSource('cartogram-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
    
        promoteId: '_iso3'
    });

    map.addLayer({
        id: 'cartogram-fill',
        type: 'fill',
        source: 'cartogram-source',
        paint: {
            'fill-color': [
                'case',
        
                ['boolean', ['feature-state', 'hover'], false],
                '#aaaaaa',
        
                ['boolean', ['feature-state', 'selected'], false],
                '#e3bb80',
        
                ['get', '_color']
            ],
        
            'fill-opacity': 0.78
        }
    });

    map.addLayer({
        id: 'cartogram-border',
        type: 'line',
        source: 'cartogram-source',
        paint: {
            'line-color': '#555555',
            'line-width': 0.8
        }
    });

 // ─────────────────────────────────────────────────────────────
// COUNTRY VECTOR INTERACTION
// ─────────────────────────────────────────────────────────────

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
            {
                hover: false
            }
        );
    }

    hoveredId = newId;

    map.setFeatureState(
        {
            source: 'country-source',
            sourceLayer: 'country_boundaries',
            id: hoveredId
        },
        {
            hover: true
        }
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
            {
                hover: false
            }
        );
    }

    hoveredId = null;
});

map.on('click', 'countries', (e) => {

    if (!countryActive) return;

    if (selectedId !== null) {

        map.setFeatureState(
            {
                source: 'country-source',
                sourceLayer: 'country_boundaries',
                id: selectedId
            },
            {
                selected: false
            }
        );
    }

    selectedId = e.features[0].id;

    map.setFeatureState(
        {
            source: 'country-source',
            sourceLayer: 'country_boundaries',
            id: selectedId
        },
        {
            selected: true
        }
    );

    clearHover();

    openPanel(
        e.features[0].properties,
        e.features[0].geometry
    );
});


// ─────────────────────────────────────────────────────────────
// CARTOGRAM INTERACTION
// ─────────────────────────────────────────────────────────────

map.on('click', 'cartogram-fill', (e) => {

    if (!countryActive) return;

    const feature = e.features[0];
    const iso = feature.id;

    // remove old selected
    if (selectedCartogramIso) {

        map.setFeatureState(
            {
                source: 'cartogram-source',
                id: selectedCartogramIso
            },
            {
                selected: false
            }
        );
    }

    selectedCartogramIso = iso;

    // set selected
    map.setFeatureState(
        {
            source: 'cartogram-source',
            id: selectedCartogramIso
        },
        {
            selected: true
        }
    );

    openPanelFromCartogram(feature);
});


map.on('mousemove', 'cartogram-fill', (e) => {

    if (!countryActive) return;

    map.getCanvas().style.cursor = 'pointer';

    const iso = e.features[0].id;

    // remove previous hover
    if (hoveredCartogramIso &&
        hoveredCartogramIso !== iso) {

        map.setFeatureState(
            {
                source: 'cartogram-source',
                id: hoveredCartogramIso
            },
            {
                hover: false
            }
        );
    }

    hoveredCartogramIso = iso;

    // set hover
    map.setFeatureState(
        {
            source: 'cartogram-source',
            id: hoveredCartogramIso
        },
        {
            hover: true
        }
    );
});


map.on('mouseleave', 'cartogram-fill', () => {

    map.getCanvas().style.cursor = '';

    if (hoveredCartogramIso) {

        map.setFeatureState(
            {
                source: 'cartogram-source',
                id: hoveredCartogramIso
            },
            {
                hover: false
            }
        );
    }

    hoveredCartogramIso = null;
});


// ─────────────────────────────────────────────────────────────
// FINAL INIT
// ─────────────────────────────────────────────────────────────

makeDraggable(document.getElementById('panel'));

updateMap();

});

// ─── Feature panel: dual-selection logic ───────────────────────────────────

function setupFeaturePanel() {
    const featureInputs = document.querySelectorAll('input[name="feature"]');

    featureInputs.forEach(input => {
        input.addEventListener('change', () => {
            const value = input.value;
            const isCategorical = value === 'dominant-disaster-type';

            if (!input.checked) {
                // Unchecking
                if (colorFeature === value) {
                    // If distort was set, promote it to color
                    if (distortFeature) {
                        colorFeature = distortFeature;
                        distortFeature = null;
                        // Update the UI tags
                        refreshFeatureTags();
                    } else {
                        colorFeature = null;
                    }
                } else if (distortFeature === value) {
                    distortFeature = null;
                }
                updateMap();
                return;
            }

            // Checking a new feature
            if (colorFeature === null) {
                colorFeature = value;
                distortFeature = null;
            } else if (distortFeature === null && !isCategorical && DISTORTABLE_FEATURES.has(value) && colorFeature !== value) {
                // Second check → distortion (only if not categorical, not same as color)
                distortFeature = value;
            } else {
                // Third+ check or categorical as second: replace color, drop distort
                colorFeature = value;
                distortFeature = null;
                // Uncheck everything else
                featureInputs.forEach(other => {
                    if (other !== input) other.checked = false;
                });
            }

            refreshFeatureTags();
            updateMap();
        });
    });
}

function refreshFeatureTags() {

    document.querySelectorAll('input[name="feature"]').forEach(input => {

        const label = input.closest('.feature-option');

        let tag = label.querySelector('.role-tag');

        // role tags
        if (input.value === colorFeature) {

            if (!tag) {
                tag = document.createElement('span');
                tag.className = 'role-tag';
                label.appendChild(tag);
            }

            tag.textContent = 'color';
            tag.dataset.role = 'color';

        } else if (input.value === distortFeature) {

            if (!tag) {
                tag = document.createElement('span');
                tag.className = 'role-tag';
                label.appendChild(tag);
            }

            tag.textContent = 'shape';
            tag.dataset.role = 'distort';

        } else {
            if (tag) tag.remove();
        }

        // visual dimming for non-distortable options
        if (
            colorFeature &&
            !DISTORTABLE_FEATURES.has(input.value) &&
            input.value !== colorFeature
        ) {
            label.classList.add('no-distort-hint');
        } else {
            label.classList.remove('no-distort-hint');
        }
    });
}

function getSelectedFeatureData() {
    if (!colorFeature) return null;
    const compute = featureComputers[colorFeature];
    return compute ? compute() : null;
}

function getDistortFeatureData() {
    if (!distortFeature) return null;
    const compute = featureComputers[distortFeature];
    return compute ? compute() : null;
}

// ─── World GeoJSON fetch & cartogram ───────────────────────────────────────

async function fetchWorldGeoJSON() {
    // Natural Earth countries at 110m from a reliable CDN
    const url = './countries.geojson';
    try {
        const res = await fetch(url);
        worldGeoJSON = await res.json();
    } catch (err) {
        console.warn('Could not fetch world GeoJSON for cartogram:', err);
        worldGeoJSON = null;
    }
}

// Compute centroid of a flat ring of [lng, lat] pairs
function ringCentroid(ring) {
    let x = 0, y = 0;
    for (const [lng, lat] of ring) { x += lng; y += lat; }
    return [x / ring.length, y / ring.length];
}

// Compute centroid of a GeoJSON geometry
function geometryCentroid(geometry) {
    let allPoints = [];
    if (geometry.type === 'Polygon') {
        allPoints = geometry.coordinates[0];
    } else if (geometry.type === 'MultiPolygon') {
        // Use the largest polygon
        let biggest = [];
        for (const poly of geometry.coordinates) {
            if (poly[0].length > biggest.length) biggest = poly[0];
        }
        allPoints = biggest;
    }
    return ringCentroid(allPoints);
}

// Scale a single ring around a centroid by factor
function scaleRing(ring, cx, cy, factor) {
    return ring.map(([lng, lat]) => [
        cx + (lng - cx) * factor,
        cy + (lat - cy) * factor
    ]);
}

// Scale all rings of a geometry
function scaleGeometry(geometry, cx, cy, factor) {
    factor *= 0.92;
    if (geometry.type === 'Polygon') {
        return {
            type: 'Polygon',
            coordinates: geometry.coordinates.map(ring => scaleRing(ring, cx, cy, factor))
        };
    } else if (geometry.type === 'MultiPolygon') {
        return {
            type: 'MultiPolygon',
            coordinates: geometry.coordinates.map(poly =>
                poly.map(ring => scaleRing(ring, cx, cy, factor))
            )
        };
    }
    return geometry;
}

// Build a distorted GeoJSON FeatureCollection
function buildCartogramGeoJSON(distortData, colorData) {
    if (!worldGeoJSON) return { type: 'FeatureCollection', features: [] };

    const distortValues = distortData.values;
    const numericValues = Object.values(distortValues).filter(v => v > 0);
    if (numericValues.length === 0) return { type: 'FeatureCollection', features: [] };

    const maxVal = Math.max(...numericValues);
    const minVal = Math.min(...numericValues);

    // Scale factor range: 0.15 (no data / zero) to 2.2 (max)
    const MIN_SCALE = 0.55;
    const MAX_SCALE = 1.35;

    // For color lookup (may be categorical or numeric)
    const colorExpression = colorData
        ? precomputeCountryColors(colorData)
        : null;

    const features = [];

    for (const feature of worldGeoJSON.features) {
        const props = feature.properties;

        const iso3 =
            props.ISO_A3 ||
            props.ADM0_A3 ||
            props.iso_a3 ||
            '';

        if (iso3 === 'ATA') continue;
        const value = distortValues[iso3];

        let scaleFactor = MIN_SCALE;
        
        if (value > 0) {
            const t = Math.sqrt(value / maxVal);
            scaleFactor = MIN_SCALE + t * (MAX_SCALE - MIN_SCALE);
        }

        const centroid = geometryCentroid(feature.geometry);
        const scaled = turf.transformScale(
            feature,
            scaleFactor,
            {
                mutate: false
            }
        );

        const color = colorExpression ? colorExpression[iso3] || '#e0e0e0' : '#9bd4d0';

        features.push({
            type: 'Feature',
            id: iso3,
            geometry: scaled.geometry,
            properties: {
                ...props,
                _iso3: iso3,
                _scaleFactor: scaleFactor,
                _color: color
            }
        });
    }

    return { type: 'FeatureCollection', features };
}

// Precompute a {iso3 -> color} map from featureData (works for both numeric and categorical)
function precomputeCountryColors(featureData) {
    const result = {};

    if (featureData.legendType === 'categorical') {
        for (const [iso, type] of Object.entries(featureData.values)) {
            result[iso] = featureData.colorsByValue[type] || '#9e9e9e';
        }
        return result;
    }

    const stops = createHeatmapStops(featureData);
    const colors = featureData.colors;

    for (const [iso, value] of Object.entries(featureData.values)) {
        if (!value || value <= 0) {
            result[iso] = colors[0];
            continue;
        }
        let assignedColor = colors[0];
        for (const stop of stops) {
            if (value >= stop.threshold) {
                assignedColor = stop.color;
            }
        }
        result[iso] = assignedColor;
    }

    return result;
}

// ─── Map update ────────────────────────────────────────────────────────────

function updateMap() {
    if (!map.getLayer('countries')) return;

    const featureData = getSelectedFeatureData();
    const distortData = getDistortFeatureData();

    const cartogramSource = map.getSource('cartogram-source');
    const showCartogram = globeActive && distortData && cartogramSource;

    if (!globeActive || !featureData) {
        updateLegend(null);
        clearHover();

        // Hide cartogram
        if (cartogramSource) {
            cartogramSource.setData({ type: 'FeatureCollection', features: [] });
        }
        map.setLayoutProperty('cartogram-fill', 'visibility', 'none');
        map.setLayoutProperty('cartogram-border', 'visibility', 'none');
        map.setLayoutProperty('countries', 'visibility', 'visible');
        map.setLayoutProperty('countries-border', 'visibility', 'visible');

        map.setPaintProperty('countries', 'fill-color', [
            'case',
            ['boolean', ['feature-state', 'hover'], false], '#aaaaaa',
            ['boolean', ['feature-state', 'selected'], false], '#e3bb80',
            '#ffffff'
        ]);
        return;
    }

    if (showCartogram) {
        // Build and show cartogram layer; hide the vector tile fill
        const cartogramData = buildCartogramGeoJSON(distortData, featureData);
        cartogramSource.setData(cartogramData);
        map.setLayoutProperty('cartogram-fill', 'visibility', 'visible');
        map.setLayoutProperty('cartogram-border', 'visibility', 'visible');
        // Keep base vector layer hidden so cartogram polygons show cleanly
        map.setLayoutProperty('countries', 'visibility', 'none');
        map.setLayoutProperty('countries-border', 'visibility', 'none');
    } else {
        // Normal choropleth
        if (cartogramSource) {
            cartogramSource.setData({ type: 'FeatureCollection', features: [] });
        }
        map.setLayoutProperty('cartogram-fill', 'visibility', 'none');
        map.setLayoutProperty('cartogram-border', 'visibility', 'none');
        map.setLayoutProperty('countries', 'visibility', 'visible');
        map.setLayoutProperty('countries-border', 'visibility', 'visible');

        const choropleth = featureData.legendType === 'categorical'
            ? createCategoricalExpression(featureData)
            : createHeatmapExpression(featureData);

        map.setPaintProperty('countries', 'fill-color', [
            'case',
            ['boolean', ['feature-state', 'hover'], false], '#aaaaaa',
            ['boolean', ['feature-state', 'selected'], false], '#e3bb80',
            choropleth
        ]);
    }

    updateLegend(featureData, distortData);
}

// ─── Panel & interaction helpers (unchanged from original) ─────────────────

function openPanel(country, geometry) {
    const panel = document.getElementById('panel');
    const margin = 20;
    panel.style.left = '';
    panel.style.right = margin + 'px';
    panel.style.top = margin + 'px';
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
                <span class="badge-deaths">${hit.Total_Deaths.toLocaleString()} deaths</span>
                <div class="badge-bottom-row">
                    <span class="badge-type">${hit.Disaster_Subtype}</span>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = '<div class="worst-by-country-section-title">No recorded data</div>';
    }
}

function openPanelFromCartogram(feature) {

    const props = feature.properties;

    const panel = document.getElementById('panel');

    const margin = 20;

    panel.style.left = '';
    panel.style.right = margin + 'px';
    panel.style.top = margin + 'px';

    panel.classList.remove('hidden');

    const iso2 = props.ISO_A2.toLowerCase();
    const iso3 = props._iso3;

    document.getElementById('country-name').innerText =
        props.ADMIN || props.NAME || iso3;

    document.getElementById('country-flag').src =
        `https://flagcdn.com/w80/${iso2}.png`;

    const hit = WORST_BY_COUNTRY.find(d => d.ISO === iso3);

    const container = document.getElementById('worst-by-country-container');

    if (hit) {

        const name = hit.Event_Name || hit.Disaster_Type;

        container.innerHTML = `
            <div class="worst-by-country-section-title">
                Deadliest Disaster Recorded
            </div>

            <div class="worst-by-country-badge">

                <div class="badge-top-row">

                    <div class="badge-name">${name}</div>

                    <span class="badge-year">
                        ${hit.Start_Year}
                    </span>

                </div>

                <span class="badge-deaths">
                    ${hit.Total_Deaths.toLocaleString()} deaths
                </span>

                <div class="badge-bottom-row">

                    <span class="badge-type">
                        ${hit.Disaster_Subtype}
                    </span>

                </div>

            </div>
        `;

    } else {

        container.innerHTML =
            '<div class="worst-by-country-section-title">No recorded data</div>';
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
    document.getElementById('btn-globe').classList.toggle('active', globeActive);
    updateMap();
}

function toggleCountry() {
    countryActive = !countryActive;
    document.getElementById('btn-country').classList.toggle('active', countryActive);
    if (!countryActive) {
        closePanel();
        clearHover();
        map.getCanvas().style.cursor = '';
    }
}

function clearHover() {
    if (hoveredId !== null) {
        map.setFeatureState(
            { source: 'country-source', sourceLayer: 'country_boundaries', id: hoveredId },
            { hover: false }
        );
    }
    hoveredId = null;
}

// ─── Data helpers (unchanged) ──────────────────────────────────────────────

function isNaturalDisaster(disaster) {
    if (!disaster.Disaster_Group) return true;
    return String(disaster.Disaster_Group).trim().toLowerCase() === 'natural';
}

function getNumericValue(disaster, columns) {
    for (const column of columns) {
        const value = disaster[column];
        if (value !== undefined && value !== null && value !== '') {
            const numberValue = Number(value);
            if (Number.isFinite(numberValue)) return numberValue;
        }
    }
    return null;
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
        const value = getNumericValue(disaster, columns);
        if (value === null) return;
        totals[disaster.ISO] = (totals[disaster.ISO] || 0) + value;
        counts[disaster.ISO] = (counts[disaster.ISO] || 0) + 1;
    });
    const averages = {};
    for (const [iso, total] of Object.entries(totals)) {
        averages[iso] = roundMetricValue(total / counts[iso], decimals);
    }
    return averages;
}

function getCountryDisasterCounts() {
    if (countryCounts) return countryCounts;
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
        'Total_Damage', "Total_Damage_('000_US$)", 'Total_Damage_000_US$'
    ]);
    return averageDamageByCountry;
}

function getAverageAffectedByCountry() {
    if (averageAffectedByCountry) return averageAffectedByCountry;
    averageAffectedByCountry = getAverageMetricByCountry(['Total_Affected'], 0);
    return averageAffectedByCountry;
}

function getAverageAidByCountry() {
    if (averageAidByCountry) return averageAidByCountry;
    averageAidByCountry = getAverageMetricByCountry([
        "AID_Contribution_('000_US$)", "AID_Contribution_000_US$", "Aid_Contribution"
    ], 0);
    return averageAidByCountry;
}

function getDominantDisasterTypeByCountry() {
    if (dominantDisasterTypeByCountry) return dominantDisasterTypeByCountry;
    const typeCountsByCountry = {};
    DATA.filter(isNaturalDisaster).forEach(disaster => {
        if (!disaster.ISO || !disaster.Disaster_Type) return;
        const disasterType = String(disaster.Disaster_Type).trim();
        if (!disasterType) return;
        if (!typeCountsByCountry[disaster.ISO]) typeCountsByCountry[disaster.ISO] = {};
        typeCountsByCountry[disaster.ISO][disasterType] = (typeCountsByCountry[disaster.ISO][disasterType] || 0) + 1;
    });
    dominantDisasterTypeByCountry = {};
    Object.entries(typeCountsByCountry).forEach(([iso, counts]) => {
        const dominantType = Object.entries(counts)
            .sort((a, b) => {
                const diff = b[1] - a[1];
                if (diff !== 0) return diff;
                return getDisasterTypeOrder(a[0]) - getDisasterTypeOrder(b[0]);
            })[0][0];
        dominantDisasterTypeByCountry[iso] = dominantType;
    });
    return dominantDisasterTypeByCountry;
}

function getDisasterTypeOrder(disasterType) {
    const index = disasterTypeOrder.indexOf(disasterType);
    return index === -1 ? disasterTypeOrder.length : index;
}

// ─── Choropleth helpers (unchanged) ───────────────────────────────────────

function createCountryValueExpression(values) {
    const entries = Object.entries(values);
    if (entries.length === 0) return 0;
    const expression = ['match', ['get', 'iso_3166_1_alpha_3']];
    for (const [iso, value] of entries) expression.push(iso, value);
    expression.push(0);
    return expression;
}

function createHeatmapExpression(featureData) {
    const valueExpression = createCountryValueExpression(featureData.values);
    const stops = createHeatmapStops(featureData);
    const choropleth = ['step', valueExpression, featureData.colors[0]];
    stops.forEach(stop => choropleth.push(stop.threshold, stop.color));
    return choropleth;
}

function createCategoricalExpression(featureData) {
    const entries = Object.entries(featureData.values);
    if (entries.length === 0) return featureData.colorsByValue.default || '#ffffff';
    const expression = ['match', ['get', 'iso_3166_1_alpha_3']];
    for (const [iso, value] of entries) {
        expression.push(iso, featureData.colorsByValue[value] || '#9e9e9e');
    }
    expression.push('#ffffff');
    return expression;
}

function createHeatmapStops(featureData) {
    const values = Object.values(featureData.values);
    const max = Math.max(...values, 0);
    const positiveValues = values.filter(v => v > 0);
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

    const sortedThresholds = thresholds.filter(t => t > 0).sort((a, b) => a - b);
    const stops = [];
    sortedThresholds.forEach(threshold => {
        if (!stops.some(s => s.threshold === threshold) && stops.length < colors.length - 1) {
            stops.push({ threshold, color: colors[stops.length + 1] });
        }
    });
    return stops;
}

function createLogThresholds(min, max, count, roundThreshold) {
    if (min === max) return [min];
    const logMin = Math.log10(min);
    const logMax = Math.log10(max);
    const thresholds = [];
    for (let i = 0; i < count; i++) {
        const position = i / count;
        const raw = 10 ** (logMin + (logMax - logMin) * position);
        thresholds.push(i === 0 ? min : roundThreshold(raw));
    }
    return thresholds;
}

function formatLegendNumber(value) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

// ─── Legend ────────────────────────────────────────────────────────────────

function updateLegend(featureData, distortData) {
    const legend = document.getElementById('heatmap-legend');
    const legendTitle = legend.querySelector('h2');
    const legendItems = document.getElementById('heatmap-legend-items');
    const distortNote = document.getElementById('legend-distort-note');

    if (!featureData || !globeActive) {
        legend.classList.add('hidden');
        legendItems.innerHTML = '';
        if (distortNote) distortNote.textContent = '';
        return;
    }

    // Distortion note
    if (distortNote && distortData) {
        distortNote.textContent = `Shape size → ${distortData.legendTitle}`;
    } else if (distortNote) {
        distortNote.textContent = '';
    }

    if (featureData.legendType === 'categorical') {
        updateCategoricalLegend(featureData, legend, legendTitle, legendItems);
        return;
    }

    const stops = createHeatmapStops(featureData);
    const formatValue = featureData.legendFormatter || formatLegendNumber;
    legendTitle.innerText = featureData.legendTitle || 'Heatmap';

    const legendRows = [{ color: featureData.colors[0], label: featureData.legendNoDataLabel || 'No data' }];
    stops.forEach((stop, i) => {
        const next = stops[i + 1];
        const label = next
            ? `${formatValue(stop.threshold)} to < ${formatValue(next.threshold)}`
            : `${formatValue(stop.threshold)}+`;
        legendRows.push({ color: stop.color, label });
    });

    legendItems.innerHTML = legendRows.map(row => `
        <div class="legend-item">
            <span class="legend-swatch" style="background:${row.color}"></span>
            <span>${row.label}</span>
        </div>
    `).join('');

    legend.classList.remove('hidden');
}

function updateCategoricalLegend(featureData, legend, legendTitle, legendItems) {
    const presentTypes = [...new Set(Object.values(featureData.values))]
        .sort((a, b) => getDisasterTypeOrder(a) - getDisasterTypeOrder(b));

    legendTitle.innerText = featureData.legendTitle || 'Categories';

    const legendRows = presentTypes.length
        ? presentTypes.map(t => ({ color: featureData.colorsByValue[t] || '#9e9e9e', label: t }))
        : [{ color: '#ffffff', label: featureData.legendNoDataLabel || 'No data' }];

    legendItems.innerHTML = legendRows.map(row => `
        <div class="legend-item">
            <span class="legend-swatch" style="background:${row.color}"></span>
            <span>${row.label}</span>
        </div>
    `).join('');

    legend.classList.remove('hidden');
}