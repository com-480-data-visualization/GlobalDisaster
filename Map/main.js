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
let dominantDisasterTypeByCountry = null;
let selectedId = null;
let selectedFeature = null;
let _hoveredMapContinent = null; 

let globalPanelStateBeforeCountryPanel = null;
let activeCountryPanel = null;
let selectedDisasterTypes = new Set();
let allDisasterTypes = [];

let minTimelineYear = null;
let maxTimelineYear = null;

let timeLowerBound = null;
let timeUpperBound = null;


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
    'average-affected'
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
};



function getDatasetMinYear() {
    const years = getAllDisasters()
        .map(getDisasterStartYear)
        .map(Number)
        .filter(y => Number.isFinite(y));

    return Math.min(...years);
}

function getDatasetMaxYear() {
    const years = getAllDisasters()
        .map(getDisasterEndYear)
        .map(Number)
        .filter(y => Number.isFinite(y));

    return Math.max(...years);
}

function setupTimeline() {

    minTimelineYear = getDatasetMinYear();
    maxTimelineYear = getDatasetMaxYear();

    timeLowerBound = minTimelineYear;
    timeUpperBound = maxTimelineYear;

    const lower = document.getElementById('timeline-lower');
    const upper = document.getElementById('timeline-upper');

    lower.min = minTimelineYear;
    lower.max = maxTimelineYear;
    lower.value = minTimelineYear;

    upper.min = minTimelineYear;
    upper.max = maxTimelineYear;
    upper.value = maxTimelineYear;

    document.getElementById('timeline-min-label').innerText = minTimelineYear;
    document.getElementById('timeline-max-label').innerText = maxTimelineYear;

    function refreshTimelineLabel() {
        document.getElementById('timeline-range-label').innerText =
            `${timeLowerBound} - ${timeUpperBound}`;
    }

    lower.addEventListener('input', () => {

        const value = Number(lower.value);

        timeLowerBound = Math.min(value, timeUpperBound);

        lower.value = timeLowerBound;

        refreshTimelineLabel();

        invalidateFeatureCaches();

        updateMap();
        refreshOpenCountryPanel();
    });

    upper.addEventListener('input', () => {

        const value = Number(upper.value);

        timeUpperBound = Math.max(value, timeLowerBound);

        upper.value = timeUpperBound;

        refreshTimelineLabel();

        invalidateFeatureCaches();

        updateMap();
        refreshOpenCountryPanel();
    });

    refreshTimelineLabel();
}








const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [5, 25],
    zoom: 1.75
});


map.on('load', async () => {
    setupFeaturePanel();
    refreshFeatureTags();
    try {
        await loadData();
    } catch (err) {
        console.error(err);
        showMissingDataOverlay();
        return;
    }
    renderGlobalPanel();
    setupDisasterTypeFilter();
    setupTimeline();
    //await fetchWorldGeoJSON();

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
    // Continent hover in bubble mode
    if (globeActive && distortFeature) {
        const iso3 = e.features[0].properties.iso_3166_1_alpha_3;
        const continent = ContinentPanel.CONTINENT_BY_ISO3[iso3];
        if (continent && continent !== _hoveredMapContinent) {
            if (_hoveredMapContinent) ContinentPanel.setHover(_hoveredMapContinent, false);
            _hoveredMapContinent = continent;
            ContinentPanel.setHover(_hoveredMapContinent, true);
        }
        map.getCanvas().style.cursor = 'pointer';
        return;
    }
    if (!countryActive) return;
    map.getCanvas().style.cursor = 'pointer';
    const newId = e.features[0].id;
    if (hoveredId !== null && hoveredId !== newId) {
        map.setFeatureState(
            { source: 'country-source', sourceLayer: 'country_boundaries', id: hoveredId },
            { hover: false }
        );
    }
    hoveredId = newId;
    map.setFeatureState(
        { source: 'country-source', sourceLayer: 'country_boundaries', id: hoveredId },
        { hover: true }
    );
});

map.on('mouseleave', 'countries', () => {
    if (_hoveredMapContinent) {
        ContinentPanel.setHover(_hoveredMapContinent, false);
        _hoveredMapContinent = null;
    }
    map.getCanvas().style.cursor = '';
    if (hoveredId !== null) {
        map.setFeatureState(
            { source: 'country-source', sourceLayer: 'country_boundaries', id: hoveredId },
            { hover: false }
        );
    }
    hoveredId = null;
});

map.on('click', 'countries', (e) => {
    // Continent click in bubble mode
    if (globeActive && distortFeature) {
        const iso3 = e.features[0].properties.iso_3166_1_alpha_3;
        const continent = ContinentPanel.CONTINENT_BY_ISO3[iso3];
        if (continent) ContinentPanel.open(continent);
        return;
    }
    if (!countryActive) return;
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

BubbleOverlay.init(map);
ContinentPanel.init(map);

updateMap();
await fetchWorldGeoJSON();

});


function collapseGlobalPanel() {
    document.getElementById('global-panel')?.classList.add('collapsed');
    document.getElementById('global-panel-open-button')?.classList.remove('hidden');
}

function expandGlobalPanel() {
    document.getElementById('global-panel')?.classList.remove('collapsed');
    document.getElementById('global-panel-open-button')?.classList.add('hidden');
}

function hideGlobalPanelWhileCountryPanelIsOpen() {
    const globalPanel = document.getElementById('global-panel');
    const openButton = document.getElementById('global-panel-open-button');

    if (!globalPanel || !openButton) return;

    if (globalPanelStateBeforeCountryPanel === null) {
        globalPanelStateBeforeCountryPanel = {
            wasCollapsed: globalPanel.classList.contains('collapsed')
        };
    }

    globalPanel.classList.add('hidden');
    openButton.classList.add('hidden');
}

function restoreGlobalPanelAfterCountryPanelClose() {
    const globalPanel = document.getElementById('global-panel');
    const openButton = document.getElementById('global-panel-open-button');

    if (!globalPanel || !openButton || globalPanelStateBeforeCountryPanel === null) return;

    globalPanel.classList.remove('hidden');

    if (globalPanelStateBeforeCountryPanel.wasCollapsed) {
        globalPanel.classList.add('collapsed');
        openButton.classList.remove('hidden');
    } else {
        globalPanel.classList.remove('collapsed');
        openButton.classList.add('hidden');
    }

    globalPanelStateBeforeCountryPanel = null;
}

function renderGlobalPanel() {
    const summary = getGlobalSummary();
    if (!summary) return;

    document.getElementById('global-total-events').textContent =
        formatCompactNumber(summary.total_events);

    document.getElementById('global-country-count').textContent =
        formatCompactNumber(summary.country_count);

    document.getElementById('global-avg-events').textContent =
        `~${formatCompactNumber(summary.avg_events_per_year)}`;

    document.getElementById('global-data-range').textContent =
        summary.data_range_label;

    document.getElementById('global-source').textContent =
        summary.source;

    renderGlobalDeadliest(summary.deadliest_events_all_time || []);
    renderGlobalYearBars(summary.events_per_year || []);
    renderGlobalCommonTypes(summary.most_common_types || []);
    renderGlobalRegions(summary.top_regions_by_event_count || []);
}

function renderGlobalDeadliest(events) {
    const container = document.getElementById('global-deadliest-list');
    const topEvents = events.slice(0, 5);

    container.innerHTML = topEvents.map((event, index) => {
        const label = event.subtype && event.subtype !== event.type
            ? `${event.type}: ${event.subtype}`
            : event.type;

        return `
            <div class="global-deadliest-row">
                <span class="global-deadliest-rank">${index + 1}.</span>
                <span class="global-deadliest-name" title="${label}">
                    ${label} <span class="global-deadliest-year">${event.start_year}</span>
                </span>
                <span class="global-deadliest-deaths">${formatCompactNumber(event.total_deaths)}</span>
            </div>
        `;
    }).join('');
}

function renderGlobalYearBars(eventsPerYear) {
    const container = document.getElementById('global-year-bars');

    if (!eventsPerYear.length) {
        container.innerHTML = '';
        return;
    }

    const bucketCount = 8;
    const firstYear = eventsPerYear[0].year;
    const lastYear = eventsPerYear[eventsPerYear.length - 1].year;
    const bucketSize = Math.ceil((lastYear - firstYear + 1) / bucketCount);
    const buckets = Array.from({ length: bucketCount }, () => 0);

    eventsPerYear.forEach(item => {
        const index = Math.min(
            bucketCount - 1,
            Math.floor((item.year - firstYear) / bucketSize)
        );

        buckets[index] += item.count;
    });

    const maxBucket = Math.max(...buckets, 1);

    container.innerHTML = buckets.map((count, index) => {
        const height = Math.max(12, Math.round((count / maxBucket) * 90));
        const opacity = 0.25 + (index / Math.max(1, bucketCount - 1)) * 0.75;

        return `
            <div 
                class="global-year-bar" 
                title="${count} events" 
                style="height:${height}px; opacity:${opacity}">
            </div>
        `;
    }).join('');

    document.getElementById('global-year-start').textContent = firstYear;
    document.getElementById('global-year-end').textContent = lastYear;
}

function renderGlobalCommonTypes(types) {
    const container = document.getElementById('global-common-types');
    const colors = ['#1f3b73', '#2c5aa0', '#5d7fbf', '#8faadc', '#b3c9f0'];

    container.innerHTML = types.slice(0, 4).map((item, index) => `
        <div class="global-type-row">
            <span>${item.type}</span>
            <div class="global-type-track">
                <div 
                    class="global-type-fill" 
                    style="width:${item.percentage}%; background:${colors[index % colors.length]}">
                </div>
            </div>
            <span class="global-type-percent">${Math.round(item.percentage)}%</span>
        </div>
    `).join('');
}

function renderGlobalRegions(regions) {
    const container = document.getElementById('global-top-regions');

    container.innerHTML = regions.slice(0, 4).map(region => `
        <div class="global-region-row">
            <span>${region.region}</span>
            <strong>${Math.round(region.percentage)}%</strong>
        </div>
    `).join('');
}

function formatCompactNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';

    if (Math.abs(number) >= 1_000_000) {
        return `${(number / 1_000_000).toFixed(1).replace('.0', '')}M`;
    }

    if (Math.abs(number) >= 1_000) {
        return `${Math.round(number / 1_000)}K`;
    }

    return number.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

// ─── Feature panel: dual-selection logic ───────────────────────────────────
function setupDisasterTypeFilter() {
    const list = document.getElementById('disaster-type-checkbox-list');
    if (!list) return;

    allDisasterTypes = getAllDisasterTypes();
    selectedDisasterTypes = new Set(allDisasterTypes);

    list.innerHTML = allDisasterTypes.map(type => `
        <label class="disaster-type-checkbox-option">
            <input type="checkbox" name="disaster-type" value="${type}" checked>
            <span>${type}</span>
        </label>
    `).join('');

    list.querySelectorAll('input[name="disaster-type"]').forEach(input => {
        input.addEventListener('change', () => {
            if (input.checked) {
                selectedDisasterTypes.add(input.value);
            } else {
                selectedDisasterTypes.delete(input.value);
            }

            applyDisasterTypeFilterChange();
        });
    });

    updateDisasterTypeFilterSummary();
    handleDominantTypeWhenFiltered();
    refreshFeatureTags();
}

function toggleDisasterTypeFilterPanel() {
    document.getElementById('disaster-type-checkbox-panel')?.classList.toggle('hidden');
}

function selectAllDisasterTypes() {
    document.querySelectorAll('input[name="disaster-type"]').forEach(input => {
        input.checked = true;
        selectedDisasterTypes.add(input.value);
    });

    applyDisasterTypeFilterChange();
}

function deselectAllDisasterTypes() {
    document.querySelectorAll('input[name="disaster-type"]').forEach(input => {
        input.checked = false;
    });

    selectedDisasterTypes.clear();
    applyDisasterTypeFilterChange();
}

function applyDisasterTypeFilterChange() {
    handleDominantTypeWhenFiltered();
    updateDisasterTypeFilterSummary();
    refreshFeatureTags();
    invalidateFeatureCaches();
    updateMap();
    refreshOpenCountryPanel();
}

function updateDisasterTypeFilterSummary() {
    const summary = document.getElementById('disaster-type-filter-summary');
    if (!summary) return;

    const selectedCount = selectedDisasterTypes.size;
    const totalCount = allDisasterTypes.length;

    if (selectedCount === totalCount) {
        summary.textContent = 'All';
    } else {
        summary.textContent = `${selectedCount} selected`;
    }
}

function hasActiveDisasterTypeFilter() {
    return selectedDisasterTypes.size < allDisasterTypes.length;
}

function handleDominantTypeWhenFiltered() {
    const dominantInput = document.querySelector('input[name="feature"][value="dominant-disaster-type"]');
    if (!dominantInput) return;

    if (!hasActiveDisasterTypeFilter()) {
        dominantInput.disabled = false;
        dominantInput.closest('.feature-option')?.classList.remove('disabled-by-filter');
        return;
    }

    if (colorFeature === 'dominant-disaster-type') {
        colorFeature = 'disaster-number';
        dominantInput.checked = false;

        const disasterNumberInput = document.querySelector('input[name="feature"][value="disaster-number"]');
        if (disasterNumberInput) disasterNumberInput.checked = true;
    }

    if (distortFeature === 'dominant-disaster-type') {
        distortFeature = null;
        dominantInput.checked = false;
    }
}

function getSelectedDisasterTypeLabel() {
    if (!hasActiveDisasterTypeFilter()) return 'all disaster types';
    return `${selectedDisasterTypes.size} disaster types selected`;
}

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
                        
                    } else {
                        colorFeature = null;
                    }
                } else if (distortFeature === value) {
                    distortFeature = null;
                }
                refreshFeatureTags();
                updateMap();
                refreshOpenCountryPanel();
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
            refreshOpenCountryPanel();
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

        const disabledByTypeFilter = hasActiveDisasterTypeFilter() && input.value === 'dominant-disaster-type';

        input.disabled = disabledByTypeFilter;
        label.classList.toggle('disabled-by-filter', disabledByTypeFilter);

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
        worldGeoJSON = window.worldGeoJSON = await res.json();
        ContinentPanel.buildLayers();
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
    const logMin = Math.log10(minVal);
    const logMax = Math.log10(maxVal);

    // Scale factor range: 0.15 (no data / zero) to 2.2 (max)
    const MIN_SCALE = 0.15;
    const MAX_SCALE = 1;

    // For color lookup (may be categorical or numeric)
    const colorExpression = colorData
        ? precomputeCountryColors(colorData)
        : null;

    const features = [];

    for (const feature of worldGeoJSON.features) {
        const props = feature.properties;

        const iso3 = [
            props.ISO_A3,
            props.ADM0_A3,
            props.ISO_A3_EH,
            props.iso_a3,
        ].find(v => v && v !== '-99' && v.length === 3) || '';

        if (iso3 === 'ATA') continue;
        const value = distortValues[iso3];

        let scaleFactor = MIN_SCALE;
        
        if (value > 0) {
            const logVal = Math.log10(value);
            const t = logMax === logMin
                ? 1
                : (logVal - logMin) / (logMax - logMin);
            scaleFactor = MIN_SCALE + t * (MAX_SCALE - MIN_SCALE);
        }

        const centroid = geometryCentroid(feature.geometry);
        const scaled = turf.transformScale(
            feature,
            scaleFactor,
            {
                mutate: false,
                origin: [centroid[0], centroid[1]] 
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
    const distortData  = getDistortFeatureData();
 
    // Always keep the Mapbox globe visible
    map.setLayoutProperty('countries',        'visibility', 'visible');
    map.setLayoutProperty('countries-border', 'visibility', 'visible');
 
    // Keep old cartogram source empty
    const cartogramSource = map.getSource('cartogram-source');
    if (cartogramSource) {
        cartogramSource.setData({ type: 'FeatureCollection', features: [] });
    }
    map.setLayoutProperty('cartogram-fill',   'visibility', 'none');
    map.setLayoutProperty('cartogram-border', 'visibility', 'none');
 
    if (!globeActive || !featureData) {
        BubbleOverlay.hide();
        updateLegend(null);
        clearHover();
        map.setPaintProperty('countries', 'fill-color', [
            'case',
            ['boolean', ['feature-state', 'hover'],    false], '#aaaaaa',
            ['boolean', ['feature-state', 'selected'], false], '#e3bb80',
            '#ffffff'
        ]);
        return;
    }
 
    if (distortData && worldGeoJSON) {
        // Bubbles active — countries go neutral, bubbles carry the color
        map.setPaintProperty('countries', 'fill-color', [
            'case',
            ['boolean', ['feature-state', 'hover'],    false], '#aaaaaa',
            ['boolean', ['feature-state', 'selected'], false], '#e3bb80',
            '#e8e8e8'
        ]);
        const colorMap = precomputeCountryColors(featureData);
        BubbleOverlay.show(worldGeoJSON, distortData.values, colorMap, ContinentPanel.CONTINENT_BY_ISO3);
    } else {
        // No bubbles — choropleth on countries
        const choropleth = featureData.legendType === 'categorical'
            ? createCategoricalExpression(featureData)
            : createHeatmapExpression(featureData);
        map.setPaintProperty('countries', 'fill-color', [
            'case',
            ['boolean', ['feature-state', 'hover'],    false], '#aaaaaa',
            ['boolean', ['feature-state', 'selected'], false], '#e3bb80',
            choropleth
        ]);
        BubbleOverlay.hide();
    }
 
    updateLegend(featureData, distortData);
    ContinentPanel.setVisible(true);
    if (ContinentPanel.isOpen()) ContinentPanel.refresh();
}

// ─── Panel & interaction helpers (unchanged from original) ─────────────────

function openPanel(country, geometry) {
    const panel = document.getElementById('panel');
    const margin = 20;
    panel.style.left = '';
    panel.style.right = margin + 'px';
    panel.style.top = '50%';
    panel.style.transform = 'translateY(-50%)';
    panel.classList.remove('hidden');

    hideGlobalPanelWhileCountryPanelIsOpen();

    const iso2 = country.iso_3166_1.toLowerCase();
    const iso3 = country.iso_3166_1_alpha_3;

    document.getElementById('country-name').innerText = country.name_en;
    document.getElementById('country-flag').src = `https://flagcdn.com/w80/${iso2}.png`;

    activeCountryPanel = {
        iso3,
        fallbackName: country.name_en
    };
    renderCountryPanelContent(iso3, country.name_en, getFilteredData());
}

function openPanelFromCartogram(feature) {

    const props = feature.properties;

    const panel = document.getElementById('panel');

    const margin = 20;

    panel.style.left = '';
    panel.style.right = margin + 'px';
    panel.style.top = '50%';
    panel.style.transform = 'translateY(-50%)';
    panel.classList.remove('hidden');

    hideGlobalPanelWhileCountryPanelIsOpen();

    const iso2 = props.ISO_A2.toLowerCase();
    const iso3 = props._iso3;

    document.getElementById('country-name').innerText =
        props.ADMIN || props.NAME || iso3;

    document.getElementById('country-flag').src =
        `https://flagcdn.com/w80/${iso2}.png`;

    activeCountryPanel = {
        iso3,
        fallbackName: props.ADMIN || props.NAME || iso3
    };
    renderCountryPanelContent(iso3, props.ADMIN || props.NAME || iso3, getFilteredData());
}

function refreshOpenCountryPanel() {
    const panel = document.getElementById('panel');

    if (!panel || panel.classList.contains('hidden') || !activeCountryPanel) {
        return;
    }

    renderCountryPanelContent(
        activeCountryPanel.iso3,
        activeCountryPanel.fallbackName,
        getFilteredData()
    );
}

function renderCountryPanelContent(iso3, fallbackName, disasters) {
    const container = document.getElementById('worst-by-country-container');
    const summary = getCountrySummary(iso3, disasters);

    if (!summary) {
        container.innerHTML = `
            <div class="country-panel-subtitle">
                ${getSelectedDisasterTypeLabel()}
            </div>

            <section class="country-overview-card">
                <div class="country-section-title">No recorded data</div>
                <div class="country-empty-chart">
                    No disasters match the selected year range and disaster type filters for this country.
                </div>
            </section>
        `;
        return;
    }

    const deadliest = summary.deadliest_disaster;
    const costliest = summary.costliest_disaster;
    const yearly = getCountryYearlySeries(iso3, disasters);
    const types = getCountryDisasterTypes(iso3, disasters);
    const countryName = summary.country || fallbackName;
    const regionText = [summary.region, summary.subregion].filter(Boolean).join(' | ');

    container.innerHTML = `
        <div class="country-panel-subtitle">
            ${regionText || 'Region unavailable'} · ${getSelectedDisasterTypeLabel()}
        </div>

        <section class="country-overview-card">
            <div class="country-section-title">Overview</div>
            ${renderCountryMetricRow('Total disasters', formatCompactNumber(summary.total_disasters))}
            ${renderCountryMetricRow('Total deaths', formatCompactNumber(summary.total_deaths))}
            ${renderCountryMetricRow('Total affected', formatCompactNumber(summary.total_affected))}
            ${renderCountryMetricRow('Avg. disasters / year', summary.avg_disasters_per_year.toFixed(1))}
            ${renderCountryMetricRow('Economic damage', formatMoneyFromUsdThousands(summary.total_damage_usd_000))}
        </section>

        ${deadliest ? renderCountryEventCard('Deadliest disaster recorded', deadliest, `${formatCompactNumber(getDisasterDeaths(deadliest))} deaths`) : ''}
        ${costliest ? renderCountryEventCard('Costliest disaster recorded', costliest, `${formatMoneyFromUsdThousands(getDisasterDamage(costliest))} damage`) : ''}

        <section class="country-chart-card">
            <div class="country-section-title">Disasters over time</div>
            ${renderCountryTimeline(yearly)}
        </section>

        <section class="country-chart-card">
            <div class="country-section-title">By disaster type</div>
            ${renderCountryTypeBars(types)}
        </section>
    `;
}

function renderCountryMetricRow(label, value) {
    return `
        <div class="country-metric-row">
            <span>${label}</span>
            <strong>${value}</strong>
        </div>
    `;
}

function renderCountryEventCard(title, disaster, valueLabel) {
    return `
        <section class="country-event-card">
            <div class="country-event-title">${title}: ${getDisasterStartYear(disaster)} ${getDisasterType(disaster) || 'Disaster'}</div>
            <div class="country-event-detail">
                <span>${valueLabel}</span>
                <span>${getDisasterSubtype(disaster) || getDisasterLocation(disaster) || ''}</span>
            </div>
        </section>
    `;
}

function renderCountryTimeline(yearly) {
    if (!yearly.length) return '<div class="country-empty-chart">No yearly data</div>';

    const width = 240;
    const height = 96;
    const padding = 14;
    const maxCount = Math.max(...yearly.map(d => d.count), 1);
    const minYear = yearly[0].year;
    const maxYear = yearly[yearly.length - 1].year;
    const yearSpan = Math.max(1, maxYear - minYear);

    const points = yearly.map(item => {
        const x = padding + ((item.year - minYear) / yearSpan) * (width - padding * 2);
        const y = height - padding - (item.count / maxCount) * (height - padding * 2);
        return `${x},${y}`;
    }).join(' ');

    return `
        <svg class="country-timeline-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
            <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="country-chart-axis" />
            <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" class="country-chart-axis" />
            <polyline points="${points}" class="country-timeline-line" />
        </svg>
        <div class="country-chart-labels">
            <span>${minYear}</span>
            <span>${maxYear}</span>
        </div>
    `;
}

function renderCountryTypeBars(types) {
    if (!types.length) return '<div class="country-empty-chart">No type data</div>';

    const colors = ['#1f3b73', '#2c5aa0', '#5d7fbf', '#8faadc', '#b3c9f0', '#d9e4f7'];
    const maxCount = Math.max(...types.map(d => d.count), 1);

    return types.slice(0, 6).map((item, index) => `
        <div class="country-type-row">
            <span>${item.type}</span>
            <div class="country-type-track">
                <div class="country-type-fill" style="width:${(item.count / maxCount) * 100}%; background:${colors[index % colors.length]}"></div>
            </div>
            <strong>${formatCompactNumber(item.count)}</strong>
        </div>
    `).join('');
}

function formatMoneyFromUsdThousands(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return '—';

    const usd = number * 1000;

    if (usd >= 1_000_000_000_000) {
        return `$${(usd / 1_000_000_000_000).toFixed(1).replace('.0', '')}T`;
    }

    if (usd >= 1_000_000_000) {
        return `$${(usd / 1_000_000_000).toFixed(1).replace('.0', '')}B`;
    }

    if (usd >= 1_000_000) {
        return `$${(usd / 1_000_000).toFixed(1).replace('.0', '')}M`;
    }

    return `$${formatCompactNumber(usd)}`;
}

function closePanel() {
    document.getElementById('panel').classList.add('hidden');
    activeCountryPanel = null;
    restoreGlobalPanelAfterCountryPanelClose();
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
        el.style.transform = 'none';
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
    if (!globeActive) BubbleOverlay.hide();
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
function invalidateFeatureCaches() {
    countryCounts = null;
    averageDeathsByCountry = null;
    averageDamageByCountry = null;
    averageAffectedByCountry = null;
    dominantDisasterTypeByCountry = null;
}


function getFilteredData() {
    let disasters = getDisastersInYearRange(
        timeLowerBound,
        timeUpperBound,
        getAllDisasters()
    );

    if (hasActiveDisasterTypeFilter()) {
        disasters = disasters.filter(disaster =>
            selectedDisasterTypes.has(getDisasterType(disaster))
        );
    }

    return disasters;
}




function isNaturalDisaster(disaster) {
    return true;
}

function getNumericValue(disaster, columns) {
    for (const column of columns) {
        let value = null;

        if (column === 'total_deaths') value = getDisasterDeaths(disaster);
        else if (column === 'total_affected') value = getDisasterAffected(disaster);
        else if (column === 'total_damage_usd_000') value = getDisasterDamage(disaster);
        else value = disaster[column];

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
    const metricGetter = disaster => getNumericValue(disaster, columns);
    return getAverageMetricByCountryFromJSON(metricGetter, decimals, getFilteredData());
}

function getCountryDisasterCounts() {
    if (countryCounts) return countryCounts;
    countryCounts = getCountryDisasterCountsFromJSON(getFilteredData());
    return countryCounts;
}

function getAverageDeathsByCountry() {
    if (averageDeathsByCountry) return averageDeathsByCountry;
    averageDeathsByCountry = getAverageDeathsByCountryFromJSON(getFilteredData());
    return averageDeathsByCountry;
}

function getAverageDamageByCountry() {
    if (averageDamageByCountry) return averageDamageByCountry;
    averageDamageByCountry = getAverageDamageByCountryFromJSON(getFilteredData());
    return averageDamageByCountry;
}

function getAverageAffectedByCountry() {
    if (averageAffectedByCountry) return averageAffectedByCountry;
    averageAffectedByCountry = getAverageAffectedByCountryFromJSON(getFilteredData());
    return averageAffectedByCountry;
}

function getDominantDisasterTypeByCountry() {
    if (dominantDisasterTypeByCountry) return dominantDisasterTypeByCountry;
    dominantDisasterTypeByCountry = getDominantDisasterTypeByCountryFromJSON(getFilteredData());
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
    if (hasActiveDisasterTypeFilter()) {
        legendTitle.innerText += ` · ${getSelectedDisasterTypeLabel()}`;
    }

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

    if (hasActiveDisasterTypeFilter()) {
        legendTitle.innerText += ` · ${getSelectedDisasterTypeLabel()}`;
    }

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