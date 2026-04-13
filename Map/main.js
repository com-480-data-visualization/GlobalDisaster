mapboxgl.accessToken = MAPBOX_TOKEN;

let globeActive = false;
let countryActive = false;
let hoveredId = null;
let countryCounts = null;

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

        clearHover();
        openPanel(e.features[0].properties, e.features[0].geometry);
    });

    makeDraggable(document.getElementById('panel'));
    updateMap();


});


//panel functions
function openPanel(country, geometry) {
    //console.log(country);
    const panel = document.getElementById('panel');

    const coords = geometry.type === 'MultiPolygon' //get country coordinates foor panel pos
        ? geometry.coordinates.flat(2)
        : geometry.coordinates.flat(1);

    const lngs = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);

    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const midLat = (minLat + maxLat) / 2;  

    const point = map.project([maxLng, midLat]);

    panel.style.left = (point.x + 20) + 'px';
    panel.style.top = (point.y - 100) + 'px'; //move the panel a bit to the top to align with country

    const iso2 = country.iso_3166_1.toLowerCase(); //for country flag
    document.getElementById('country-name').innerText = country.name_en;
    document.getElementById('country-flag').src = `https://flagcdn.com/w80/${iso2}.png`;
    panel.classList.remove('hidden');
}

function closePanel() {
    document.getElementById('panel').classList.add('hidden');
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

        choropleth
    ]);
}