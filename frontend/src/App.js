import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import LiveAnalysisPage from './pages/LiveAnalysisPage';
import GraphPage from './pages/GraphPage';
import HistoryPage from './pages/HistoryPage';
import HardwareIntegrationPage from './pages/HardwareIntegrationPage';
import { generateOfflineRecommendation, generateOfflineHistory } from './services/offlineRecommendationService';

// --- Configuration ---
const DEFAULT_LOCATION = { lat: 20.2961, lon: 85.8245 }; // Bhubaneswar
const API_URL = 'http://localhost:5001';
const REFRESH_INTERVAL_MS = 60 * 1000;
const DEBOUNCE_DELAY_MS = 500; // 0.5 second delay
const LOCAL_STORAGE_KEY_DATA = 'solarOptimizerData';
const LOCAL_STORAGE_KEY_PARAMS = 'solarOptimizerParams';

// --- LocalStorage Helper ---
const getCachedData = () => {
  try {
    const cachedData = localStorage.getItem(LOCAL_STORAGE_KEY_DATA);
    const cachedParams = localStorage.getItem(LOCAL_STORAGE_KEY_PARAMS);
    
    const liveData = cachedData ? JSON.parse(cachedData).liveData : null;
    const historyData = cachedData ? JSON.parse(cachedData).historyData : null;
    const params = cachedParams ? JSON.parse(cachedParams) : null;

    return { liveData, historyData, params };
  } catch (error) {
    console.error("Failed to read from localStorage", error);
  }
  return { liveData: null, historyData: null, params: null };
};

const cacheData = (liveData, historyData, params) => {
  try {
    const dataToCache = { liveData, historyData, timestamp: Date.now() };
    localStorage.setItem(LOCAL_STORAGE_KEY_DATA, JSON.stringify(dataToCache));
    localStorage.setItem(LOCAL_STORAGE_KEY_PARAMS, JSON.stringify(params));
  } catch (error) {
    console.error("Failed to write to localStorage", error);
  }
};

// --- Tilt Helpers (match backend heuristics) ---
const seasonalOptimalTilt = (latitudeDeg, month) => {
  const lat = Math.abs(latitudeDeg);
  const optimal = (month >= 4 && month <= 9) ? (lat - 15) : (lat + 15);
  return Math.min(90, Math.max(0, optimal));
};

const computeTiltPenaltyPct = (tiltAngle, optimalTilt) => {
  const delta = Math.abs(tiltAngle - optimalTilt);
  return Math.min(25, 0.6 * delta);
};


// --- API Helper Functions ---
const fetchOnlineData = async (location, panelAge, daysSinceCleaning, numPanels, idealPanelGeneration, tiltAngle) => {
  const { lat, lon } = location;
  // Treat the user-entered value as kWh/day per panel (matches the form label).
  // Convert to instantaneous kW for the backend by dividing by 24.
  const idealPanelGenerationNum = parseFloat(idealPanelGeneration);
  const ideal_panel_generation_kw = idealPanelGenerationNum / 24.0;
  const queryParams = `?lat=${lat}&lon=${lon}&panel_age_in_days=${panelAge}&days_since_cleaning=${daysSinceCleaning}&num_panels=${numPanels}&ideal_panel_generation_kw=${ideal_panel_generation_kw}&tilt_angle=${tiltAngle}`;
  const response = await fetch(`${API_URL}/api/live_status${queryParams}`);
  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error || `HTTP error! status: ${response.status}`);
  }
  return await response.json();
};

const fetchHistoryData = async (panelAge, daysSinceCleaning, numPanels, idealPanelGeneration, tiltAngle, location) => {
  const lat = location?.lat ?? DEFAULT_LOCATION.lat;
  const lon = location?.lon ?? DEFAULT_LOCATION.lon;
  // Treat frontend input as kWh/day per panel; convert to instantaneous kW for backend calls.
  const idealPanelGenerationNum = parseFloat(idealPanelGeneration);
  const ideal_panel_generation_kw = idealPanelGenerationNum / 24.0;
  const queryParams = `?panel_age_in_days=${panelAge}&days_since_cleaning=${daysSinceCleaning}&num_panels=${numPanels}&ideal_panel_generation_kw=${ideal_panel_generation_kw}&tilt_angle=${tiltAngle}&lat=${lat}&lon=${lon}`;
  const response = await fetch(`${API_URL}/api/history${queryParams}`);
  if (!response.ok) {
    throw new Error('Failed to fetch history data');
  }
  return await response.json();
};


function App() {
  const [liveData, setLiveData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [isOnline, setIsOnline] = useState(true); // Track online/offline mode

  // State for user-editable parameters
  const [panelAge, setPanelAge] = useState('3');
  const [dustDensity, setDustDensity] = useState('0.15'); // New state for dust density
  const [numPanels, setNumPanels] = useState('10');
  const [idealPanelGeneration, setIdealPanelGeneration] = useState('0.45');
  const [tiltAngle, setTiltAngle] = useState('25');
  // Last clean date state (ISO date string)
  const [lastCleanDate, setLastCleanDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Offline mode parameters (weather conditions when offline)
  const [offlineTemp, setOfflineTemp] = useState(25);
  const [offlineCloud, setOfflineCloud] = useState(20);

  // --- Effects ---

  // Get user's live location on initial load & load cached data
  useEffect(() => {
    const { liveData, historyData, params } = getCachedData();
    if (liveData && historyData) {
      setLiveData(liveData);
      setHistoryData(historyData);
    }
    if (params) {
      setPanelAge(params.panelAge || '3');
      setDustDensity(params.dustDensity || '0.15');
      setNumPanels(params.numPanels || '10');
      setIdealPanelGeneration(params.idealPanelGeneration || '0.45');
      setTiltAngle(params.tiltAngle || '25');
      setLastCleanDate(params.lastCleanDate || new Date().toISOString().split('T')[0]);
    }

    navigator.geolocation?.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ lat: latitude, lon: longitude });
      },
      (error) => {
        console.log('Location access denied, using default location');
      }
    );
  }, []);

  // Register service worker and subscribe to push notifications (if available)
  useEffect(() => {
    const registerPush = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        // get public key from server
        const resp = await fetch(`${API_URL}/api/vapid_public`);
        if (!resp.ok) return;
        const { publicKey } = await resp.json();
        if (!publicKey) return;
        const urlBase64ToUint8Array = (base64String) => {
          const padding = '='.repeat((4 - base64String.length % 4) % 4);
          const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
          const rawData = window.atob(base64);
          const outputArray = new Uint8Array(rawData.length);
          for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
          }
          return outputArray;
        };

        const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        // send subscription to backend
        await fetch(`${API_URL}/api/save-subscription`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sub)
        });
      } catch (e) {
        console.debug('Push registration failed:', e);
      }
    };

    registerPush();
  }, []);

  // --- Data Loading Logic ---
  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    // Heuristic: Convert dust density (mg/m^3) to an effective "days since cleaning"
    // This is a simple linear conversion for demonstration. A real model would be more complex.
    // Assumes 0.01 mg/m^3 is 1 day and 0.5 mg/m^3 is ~30 days.
    const effectiveDaysSinceCleaning = Math.max(1, Math.round(parseFloat(dustDensity) * 60));

    // Prefer explicit lastCleanDate (user input) to compute days since cleaning.
    // If lastCleanDate is provided and valid, use the date difference (min 1 day),
    // otherwise fall back to the dustDensity heuristic.
    let daysFromLastClean = null;
    if (lastCleanDate) {
      try {
        const last = new Date(lastCleanDate);
        const today = new Date();
        const diffMs = today - last;
        const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
        daysFromLastClean = diffDays;
      } catch (err) {
        daysFromLastClean = null;
      }
    }

    const params = { panelAge, dustDensity, numPanels, idealPanelGeneration, tiltAngle };
    // include lastCleanDate in saved params
    const paramsToCache = { ...params, lastCleanDate };
    const panelAgeInDays = Math.round(parseFloat(panelAge) * 365);
    const daysClean = (typeof daysFromLastClean === 'number' && !isNaN(daysFromLastClean)) ? daysFromLastClean : effectiveDaysSinceCleaning;
    const panels = parseInt(numPanels);
    const idealGen = parseFloat(idealPanelGeneration);

    // Try online mode first
    if (isOnline) {
      try {
        const [live, history] = await Promise.all([
          fetchOnlineData(location, panelAgeInDays, daysClean, panels, idealGen, parseFloat(tiltAngle)),
          fetchHistoryData(panelAgeInDays, daysClean, panels, idealGen, parseFloat(tiltAngle), location)
        ]);
        
        setLiveData(live);
        setHistoryData(history);
        cacheData(live, history, paramsToCache);
        
        // Update offline defaults from live weather data
        if (live.live_weather) {
          setOfflineTemp(live.live_weather.temperature_celsius);
          setOfflineCloud(live.live_weather.cloud_cover_percentage || live.live_weather.cloud_cover);
        }
        
        setLoading(false);
        return;
      } catch (e) {
        console.error("Backend failed, switching to offline mode:", e);
        setIsOnline(false);
        setError('Backend unavailable - switching to offline mode');
      }
    }
    
    // Offline mode
    try {
        // Defensive handling of the ideal generation input:
        // - If the user entered a small number (<= 3), it's likely the per-panel power rating in kW (e.g. 0.45 kW).
        //   Convert that to kWh/day by multiplying by 24.
        // - If the user entered a larger number (> 3), assume it's already kWh/day per panel.
        const idealDailyPerPanelFromInput = (idealGen <= 3) ? (idealGen * 24) : idealGen;

        const currentConditions = {
          panel_age_in_days: panelAgeInDays,
          days_since_cleaning: daysClean,
          temperature_celsius: offlineTemp,
          cloud_cover_percentage: offlineCloud,
          ideal_daily_kwh_per_panel: idealDailyPerPanelFromInput, // kWh/day per panel
          num_panels: panels,
        };

      const [offlineLive, offlineHistory] = await Promise.all([
        generateOfflineRecommendation(currentConditions),
        generateOfflineHistory(panelAgeInDays, daysClean, offlineTemp, offlineCloud)
      ]);

      const singlePanelLossKw = offlineLive.predicted_loss_kw || 0;

      // --- START: CORRECTED OFFLINE CALCULATION LOGIC ---

      // 1. Calculate Tilt Penalty
      const now = new Date();
      const month = now.getMonth() + 1;
      const optimalTilt = seasonalOptimalTilt(location.lat ?? DEFAULT_LOCATION.lat, month);
      const tiltPenaltyPct = computeTiltPenaltyPct(parseFloat(tiltAngle), optimalTilt);
      const tiltLossKw = (tiltPenaltyPct / 100) * (idealGen * panels);
      const tilt_loss_kwh_per_day = Math.round((tiltLossKw * 24) * 10000) / 10000;

      // 2. Get base system loss from offline service
      const predicted_daily_loss_kwh_per_panel_base = offlineLive.predicted_daily_loss_kwh_per_panel ?? Math.round(singlePanelLossKw * 24 * 10000) / 10000;
      const base_system_daily_loss_kwh = offlineLive.total_system_daily_loss_kwh ?? Math.round((predicted_daily_loss_kwh_per_panel_base * panels) * 10000) / 10000;

      // 3. Combine base loss and tilt loss to get total uncapped loss
      let total_system_daily_loss_with_tilt = Math.round((base_system_daily_loss_kwh + tilt_loss_kwh_per_day) * 10000) / 10000;

      // 4. Calculate the ideal total daily generation
      const idealTotalDailyKwh = idealDailyPerPanelFromInput * panels;

      // 5. CRITICAL: Cap the total loss at the ideal generation to prevent impossible values
      total_system_daily_loss_with_tilt = Math.min(total_system_daily_loss_with_tilt, idealTotalDailyKwh);

      // 6. NOW, calculate the final energy depreciation percentage from the capped total
      let energyDepreciation = (idealTotalDailyKwh > 0) 
          ? (total_system_daily_loss_with_tilt / idealTotalDailyKwh * 100) 
          : 0;
      energyDepreciation = Math.max(0, Math.min(100, energyDepreciation)); // Clamp to [0, 100]

      // 7. Ensure the per-panel loss shown in the UI is consistent with the final capped total
      const final_predicted_daily_loss_kwh_per_panel = total_system_daily_loss_with_tilt / panels;

      // --- END: CORRECTED OFFLINE CALCULATION LOGIC ---

      const combinedTotalLossKw = (singlePanelLossKw * panels) + tiltLossKw;

      // Build percent-based recommendation messages using the corrected energyDepreciation
      const MODERATE_PCT = 5;
      const HIGH_PCT = 10;
      const CRITICAL_PCT = 20;

      let action_required = false;
      let recommendation_message = 'No immediate action required. System performing within expected parameters.';

      if (energyDepreciation >= CRITICAL_PCT) {
        action_required = true;
        recommendation_message = `CRITICAL: Immediate action required. Estimated energy depreciation is ${energyDepreciation.toFixed(1)}% (${total_system_daily_loss_with_tilt.toFixed(2)} kWh/day system loss). Schedule immediate cleaning and inspection.`;
      } else if (energyDepreciation >= HIGH_PCT) {
        action_required = true;
        recommendation_message = `High Priority: Estimated energy depreciation is ${energyDepreciation.toFixed(1)}% (${total_system_daily_loss_with_tilt.toFixed(2)} kWh/day system loss). Consider scheduling panel cleaning soon.`;
      } else if (energyDepreciation >= MODERATE_PCT) {
        recommendation_message = `Moderate Priority: Estimated energy depreciation is ${energyDepreciation.toFixed(1)}% (${total_system_daily_loss_with_tilt.toFixed(2)} kWh/day system loss). Plan to clean panels in the near future.`;
      }

      // Debug logs to help trace values
      try {
        console.debug('offlineLive (raw):', offlineLive);
        console.debug('computed: total_with_tilt=', total_system_daily_loss_with_tilt, 'idealTotalDailyKwh=', idealTotalDailyKwh, 'energyDepreciation=', energyDepreciation);
      } catch (e) {}

      // Build the final liveData object with the corrected values
      const offlineLiveData = {
        live_status: {
          predicted_hourly_loss_kw: singlePanelLossKw,
          predicted_daily_loss_kwh_per_panel: final_predicted_daily_loss_kwh_per_panel,
          total_system_daily_loss_kwh: total_system_daily_loss_with_tilt,
          total_system_loss_kw: combinedTotalLossKw,
          action_required: action_required,
          recommendation_message: recommendation_message,
          estimated_daily_financial_loss: total_system_daily_loss_with_tilt * 8, // Assuming ₹8/kWh
          energy_depreciation_percentage: energyDepreciation,
          dust_level_days: daysClean,
          tilt_angle_deg: parseFloat(tiltAngle),
          optimal_tilt_angle_deg: Math.round(optimalTilt * 10) / 10,
          tilt_penalty_percentage: Math.round(tiltPenaltyPct * 100) / 100,
          tilt_loss_kw: Math.round(tiltLossKw * 10000) / 10000,
          tilt_loss_kwh_per_day: tilt_loss_kwh_per_day,
        },
        live_weather: {
          temperature_celsius: offlineTemp,
          cloud_cover_percentage: offlineCloud,
          cloud_cover: offlineCloud,
          uv_index: (() => {
            try {
              const h = new Date().getHours();
              if (h < 6 || h > 18) return 0.0;
              return Math.max(0, 8 * Math.cos((h - 13) * (Math.PI / 12)));
            } catch (e) {
              return 0.0;
            }
          })(),
        }
      };

      setLiveData(offlineLiveData);
      setHistoryData(offlineHistory);
      cacheData(offlineLiveData, offlineHistory, paramsToCache);
    } catch (e) {
      console.error("Offline mode failed:", e);
      setError(`Offline analysis failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [isOnline, location, panelAge, dustDensity, numPanels, idealPanelGeneration, tiltAngle, offlineTemp, offlineCloud]);

  useEffect(() => {
    const checkBackendStatus = async () => {
      if (!navigator.onLine) {
        setIsOnline(false);
        return;
      }
      try {
        const response = await fetch(`${API_URL}/api/health`);
        if (response.ok) {
          const lastStatus = isOnline;
          if (!lastStatus) {
            const { liveData, historyData } = getCachedData();
            if (liveData && historyData) {
              setLiveData(liveData);
              setHistoryData(historyData);
              setError('Backend is back online. Restored last analysis.');
            } else {
              setError('Backend is online.');
            }
          }
          setIsOnline(true);
        } else {
          setIsOnline(false);
        }
      } catch (error) {
        setIsOnline(false);
      }
    };

    checkBackendStatus(); // Initial check on load
    const intervalId = setInterval(checkBackendStatus, 15000); // Check every 15 seconds

    return () => clearInterval(intervalId); // Cleanup on component unmount
  }, [isOnline]);

  return (
    <Router>
      <div className="App">
        <Navbar isOnline={isOnline} />
        <Routes>
                    <Route 
            path="/" 
            element={
              <HomePage 
                panelAge={panelAge}
                setPanelAge={setPanelAge}
                dustDensity={dustDensity}
                setDustDensity={setDustDensity}
                numPanels={numPanels}
                setNumPanels={setNumPanels}
                idealPanelGeneration={idealPanelGeneration}
                setIdealPanelGeneration={setIdealPanelGeneration}
                tiltAngle={tiltAngle}
                setTiltAngle={setTiltAngle}
                lastCleanDate={lastCleanDate}
                setLastCleanDate={setLastCleanDate}
                onAnalyze={handleAnalyze}
                isLoading={loading}
                error={error}
              />
            } 
          />
          <Route 
            path="/hardware"
            element={<HardwareIntegrationPage dustDensity={dustDensity} setDustDensity={setDustDensity} />}
          />
          <Route 
            path="/live-analysis" 
            element={<LiveAnalysisPage liveData={liveData} />} 
          />
          <Route 
            path="/graph" 
            element={<GraphPage historyData={historyData} />} 
          />
          <Route 
            path="/history" 
            element={<HistoryPage historyData={historyData} />} 
          />
          <Route 
            path="/hardware-integration" 
            element={<HardwareIntegrationPage />} 
          />
          <Route 
            path="/hardware"
            element={<HardwareIntegrationPage />}
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;