mapboxgl.accessToken = MAPBOX_TOKEN;

let globeActive = false;
let countryActive = false;
let hoveredId = null;
let countryCounts = null;
let selectedId = null;

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [0, 40],
    zoom: 2.5
});

map.on('load', async () => {

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


// get the countries from data 
function getCountryCounts() {

    if (countryCounts) return countryCounts;  // use cache for performance
    countryCounts = {};
    DATA.forEach(d => {
        if (!d.ISO) return;
        countryCounts[d.ISO] = (countryCounts[d.ISO] || 0) + 1;
    });
    return countryCounts;
}

//choropleth map for global disaster view
function updateMap() {

    if (!globeActive) {
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

    const counts = getCountryCounts();
    const max = Math.max(...Object.values(counts), 1);

    const valueExpression = [
        'match',
        ['get', 'iso_3166_1_alpha_3']
    ];

    for (const [iso, count] of Object.entries(counts)) {
        valueExpression.push(iso, count);
    }

    valueExpression.push(0);

    const choropleth = [
        'interpolate',
        ['linear'],
        ['/', valueExpression, max],

        0.0, '#ffffff',
        0.2, '#c6dbef',
        0.4, '#6baed6',
        0.6, '#4292c6',
        0.8, '#2171b5',
        1.0, '#08306b'
    ];

    map.setPaintProperty('countries', 'fill-color', [
        'case',

        ['boolean', ['feature-state', 'hover'], false],
        '#aaaaaa',
        ['boolean', ['feature-state', 'selected'], false], '#e3bb80',
        choropleth
    ]);
}