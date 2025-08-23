 // Auto update year
    document.getElementById('year').textContent = new Date().getFullYear();

    // --- Utilities ---
    const $ = (sel) => document.querySelector(sel);
    const statusBox = $('#status');
    function setStatus(msg, type='info'){
      statusBox.classList.remove('hidden');
      statusBox.className = "mb-4 text-sm rounded-lg px-3 py-2 " + 
        (type==='error' ? 'bg-red-500/20 border border-red-400/40' : 'bg-white/10 border border-white/20');
      statusBox.textContent = msg;
    }
    function clearStatus(){ statusBox.classList.add('hidden'); }

    // Weather code to icon
    const icons = {
      0:'img/summer-sun-warm.svg', 1:'img/weather.svg', 2:'img/weather-color-sun-cloud.svg', 3:'img/cloud-cloudy-forecast.svg', 45:'img/weather-windy.svg', 48:'img/weather-windy.svg',
      51:'img/sunBehindRainCloud.svg',53:'img/sunBehindRainCloud.svg',55:'img/sunBehindRainCloud.svg', 61:'img/climate-cloud-forecast-2.svg',63:'img/climate-cloud-forecast-2.svg',65:'img/climate-cloud-forecast-2.svg',
      71:'img/snowing-forecast.svg',73:'img/snowing-forecast.svg',75:'img/snowing-forecast.svg', 80:'img/climate-cloud-forecast-2.svg',81:'img/climate-cloud-forecast-2.svg',82:'img/climate-cloud-forecast-2.svg', 95:'img/storm-forecast.svg',96:'img/storm-forecast.svg',99:'img/storm-forecast.svg'
    };
    const wmoDesc = {
      0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
      45:'Fog',48:'Depositing rime fog',
      51:'Light drizzle',53:'Drizzle',55:'Dense drizzle',
      61:'Light rain',63:'Rain',65:'Heavy rain',
      71:'Light snow',73:'Snow',75:'Heavy snow',
      80:'Rain showers',81:'Rain showers',82:'Heavy showers',
      95:'Thunderstorm',96:'Thunderstorm',99:'Thunderstorm'
    };

    function renderIcon(el, code, size=56){
      el.innerHTML = `<div class="flex items-center justify-center w-[${size}px] h-[${size}px] text-4xl"><img src=${icons[code]}></div>`;
      el.title = wmoDesc[code] || 'Weather';
    }

    // --- Geocoding + Weather fetchers ---
    async function geocodeCity(q){
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`;
      const r = await fetch(url); if(!r.ok) throw new Error('Geocoding failed');
      const data = await r.json();
      return data.results || [];
    }
    async function getWeather(lat, lon, tz){
      const params = new URLSearchParams({
        latitude: lat, longitude: lon, timezone: tz || 'auto',
        current: 'temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min'
      });
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if(!r.ok) throw new Error('Weather fetch failed');
      return r.json();
    }

    // --- Autosuggest ---
    const input = document.getElementById('cityInput');
    const suggestBox = document.getElementById('suggestBox');
    let suggestTimer;

    input.addEventListener('input', async () => {
      const q = input.value.trim();
      if(!q){ suggestBox.classList.add('hidden'); suggestBox.innerHTML=''; return; }
      clearTimeout(suggestTimer);
      suggestTimer = setTimeout(async () => {
        try{
          const results = await geocodeCity(q);
          if(results.length === 0){ suggestBox.classList.add('hidden'); suggestBox.innerHTML=''; return; }
          suggestBox.innerHTML = results.map(r => {
            const name = [r.name, r.admin1, r.country].filter(Boolean).join(', ');
            return `<button class="w-full text-left px-3 py-2 hover:bg-slate-200" data-lat="${r.latitude}" data-lon="${r.longitude}" data-tz="${r.timezone}" data-name="${name}">${name}</button>`;
          }).join('');
          suggestBox.classList.remove('hidden');
        }catch(e){
          suggestBox.classList.add('hidden');
        }
      }, 250);
    });

    suggestBox.addEventListener('click', async (e) => {
      const btn = e.target.closest('button'); if(!btn) return;
      suggestBox.classList.add('hidden');
      input.value = btn.dataset.name;
      await loadWeather(+btn.dataset.lat, +btn.dataset.lon, btn.dataset.tz, btn.dataset.name);
    });

    // --- Location button ---
    document.getElementById('locBtn').addEventListener('click', () => {
      if(!navigator.geolocation) return setStatus('Geolocation not supported in this browser.', 'error');
      setStatus('Getting your location…');
      navigator.geolocation.getCurrentPosition(async pos => {
        clearStatus();
        const {latitude: lat, longitude: lon} = pos.coords;
        // Reverse geocode (simple): use lat/lon as name fallback
        await loadWeather(lat, lon, 'auto', 'My Location');
      }, err => {
        setStatus('Could not get your location. Please allow permission or search by city.', 'error');
      }, {enableHighAccuracy:true, timeout:8000});
    });

    // --- Load & render ---
    async function loadWeather(lat, lon, tz, label){
      try{
        setStatus('Loading weather…');
        const data = await getWeather(lat, lon, tz);
        clearStatus();
        // Current
        const c = data.current;
        renderIcon(document.getElementById('currentIcon'), c.weather_code);
        document.getElementById('place').textContent = label || 'Selected place';
        document.getElementById('localTime').textContent = new Date().toLocaleString('en-GB', { timeZone: data.timezone });
        document.getElementById('temp').textContent = `${Math.round(c.temperature_2m)}°C`;
        document.getElementById('apparent').textContent = `${Math.round(c.apparent_temperature)}°C`;
        document.getElementById('humidity').textContent = `${c.relative_humidity_2m}%`;
        document.getElementById('wind').textContent = `${Math.round(c.wind_speed_10m)} km/h`;

        document.getElementById('current').classList.remove('hidden');

        // Forecast (next 6 days)
        const days = document.getElementById('days');
        days.innerHTML = '';
        const d = data.daily;
        for(let i=1;i<Math.min(7, d.time.length);i++){
          const date = new Date(d.time[i]);
          const code = d.weather_code[i];
          const hi = Math.round(d.temperature_2m_max[i]);
          const lo = Math.round(d.temperature_2m_min[i]);
          const dayName = date.toLocaleDateString('en-GB', {weekday:'short'});
          const item = document.createElement('div');
          item.className = 'rounded-lg bg-white/5 border border-white/10 p-4 text-center items-center';
          item.innerHTML = `
            <div class="text-cyan-50 font-medium">${dayName}</div>
            <div class="my-2"><img class="max-w-[80px] m-auto" src=${icons[code]}></div>
            <div class="text-sm text-white/80">${wmoDesc[code] || ''}</div>
            <div class="mt-2 text-sm"><span class="font-semibold">${hi}°</span> / <span class="text-white/70">${lo}°</span></div>
          `;
          days.appendChild(item);
        }
        document.getElementById('forecast').classList.remove('hidden');
      }catch(e){
        setStatus('Failed to load weather. Try another city.', 'error');
      }
    }

    // Initial: try a default city to show UI
    (async () => {
      try {
        const results = await geocodeCity('Kenitra');
        if(results[0]){
          const r = results[0];
          await loadWeather(r.latitude, r.longitude, r.timezone, [r.name, r.admin1, r.country].filter(Boolean).join(', '));
        }
      } catch(e){}
    })();