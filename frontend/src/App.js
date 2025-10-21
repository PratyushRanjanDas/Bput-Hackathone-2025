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
  const queryParams = `?lat=${lat}&lon=${lon}&panel_age_in_days=${panelAge}&days_since_cleaning=${daysSinceCleaning}&num_panels=${numPanels}&ideal_panel_generation_kw=${idealPanelGeneration}&tilt_angle=${tiltAngle}`;
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
  const queryParams = `?panel_age_in_days=${panelAge}&days_since_cleaning=${daysSinceCleaning}&num_panels=${numPanels}&ideal_panel_generation_kw=${idealPanelGeneration}&tilt_angle=${tiltAngle}&lat=${lat}&lon=${lon}`;
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

  // --- Data Loading Logic ---
  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    // Heuristic: Convert dust density (mg/m^3) to an effective "days since cleaning"
    // This is a simple linear conversion for demonstration. A real model would be more complex.
    // Assumes 0.01 mg/m^3 is 1 day and 0.5 mg/m^3 is ~30 days.
    const effectiveDaysSinceCleaning = Math.max(1, Math.round(parseFloat(dustDensity) * 60));

    const params = { panelAge, dustDensity, numPanels, idealPanelGeneration, tiltAngle };
    const panelAgeInDays = Math.round(parseFloat(panelAge) * 365);
    const daysClean = effectiveDaysSinceCleaning;
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
        cacheData(live, history, params);
        
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
      const currentConditions = {
        panel_age_in_days: panelAgeInDays,
        days_since_cleaning: daysClean,
        temperature_celsius: offlineTemp,
        cloud_cover_percentage: offlineCloud,
      };

      const [offlineLive, offlineHistory] = await Promise.all([
        generateOfflineRecommendation(currentConditions),
        generateOfflineHistory(panelAgeInDays, daysClean, offlineTemp, offlineCloud)
      ]);

      // Calculate total system loss for offline mode
      const singlePanelLoss = offlineLive.predicted_loss_kw || 0;
      const totalSystemLoss = singlePanelLoss * panels;
      const idealOutput = idealGen * panels;

      // Tilt penalty in offline mode
      const now = new Date();
      const month = now.getMonth() + 1;
      const optimalTilt = seasonalOptimalTilt(location.lat ?? DEFAULT_LOCATION.lat, month);
      const tiltPenaltyPct = computeTiltPenaltyPct(parseFloat(tiltAngle), optimalTilt);
      const tiltLossKw = (tiltPenaltyPct / 100) * idealOutput;

      const combinedTotalLoss = totalSystemLoss + tiltLossKw;
      const energyDepreciation = idealOutput > 0 ? (combinedTotalLoss / idealOutput) * 100 : 0;

      // Format data to match online structure
      const offlineLiveData = {
        live_status: {
          predicted_hourly_loss_kw: singlePanelLoss,
          total_system_loss_kw: combinedTotalLoss,
          action_required: offlineLive.action_required,
          recommendation_message: offlineLive.recommendation_message,
          estimated_daily_financial_loss: combinedTotalLoss * 24 * 8, // Assuming ₹8/kWh
          energy_depreciation_percentage: energyDepreciation,
          dust_level_days: daysClean,
          tilt_angle_deg: parseFloat(tiltAngle),
          optimal_tilt_angle_deg: Math.round(optimalTilt * 10) / 10,
          tilt_penalty_percentage: Math.round(tiltPenaltyPct * 100) / 100,
          tilt_loss_kw: Math.round(tiltLossKw * 10000) / 10000,
        },
        live_weather: {
          temperature_celsius: offlineTemp,
          cloud_cover_percentage: offlineCloud,
          cloud_cover: offlineCloud,
          uv_index: 0, // Not available in offline mode
        }
      };
      setLiveData(offlineLiveData);
      setHistoryData(offlineHistory);
      cacheData(offlineLiveData, offlineHistory, params);
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
            // If we just came back online, restore last saved data
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
                onAnalyze={handleAnalyze}
                isLoading={loading}
                error={error}
              />
            } 
          />
//...
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