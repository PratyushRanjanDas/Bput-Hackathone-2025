import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import { generateOfflineRecommendation, generateOfflineHistory } from './services/offlineRecommendationService';
import HistoryGraph from './components/HistoryGraph';

// --- Configuration ---
const DEFAULT_LOCATION = { lat: 20.2961, lon: 85.8245 }; // Bhubaneswar
const API_URL = 'http://127.0.0.1:5001';
const REFRESH_INTERVAL_MS = 60 * 1000;
const DEBOUNCE_DELAY_MS = 500; // 0.5 second delay
const LOCAL_STORAGE_KEY = 'solarOptimizerCache';

// --- LocalStorage Helper ---
const getCachedData = () => {
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      const { liveData, historyData, timestamp } = JSON.parse(cached);
      // Cache is valid for 1 hour
      if (Date.now() - timestamp < 3600 * 1000) {
        return { liveData, historyData };
      }
    }
  } catch (error) {
    console.error("Failed to read from localStorage", error);
  }
  return { liveData: null, historyData: null };
};

const cacheData = (liveData, historyData) => {
  try {
    const dataToCache = {
      liveData,
      historyData,
      timestamp: Date.now(),
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToCache));
  } catch (error) {
    console.error("Failed to write to localStorage", error);
  }
};


// --- API Helper Functions ---
const fetchOnlineData = async (location, panelAge, daysSinceCleaning) => {
  const { lat, lon } = location;
  const queryParams = `?lat=${lat}&lon=${lon}&panel_age_in_days=${panelAge}&days_since_cleaning=${daysSinceCleaning}`;
  const response = await fetch(`${API_URL}/api/live_status${queryParams}`);
  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.error || `HTTP error! status: ${response.status}`);
  }
  return await response.json();
};

const fetchHistoryData = async (panelAge, daysSinceCleaning) => {
  const queryParams = `?panel_age_in_days=${panelAge}&days_since_cleaning=${daysSinceCleaning}`;
  const response = await fetch(`${API_URL}/api/history${queryParams}`);
  if (!response.ok) {
    throw new Error('Failed to fetch history data');
  }
  return await response.json();
};


function App() {
  const [liveData, setLiveData] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [location, setLocation] = useState(DEFAULT_LOCATION);
  const [isLocationLive, setIsLocationLive] = useState(false);

  // State for user-editable parameters, initialized from cache or defaults
  const [panelAge, setPanelAge] = useState(1095);
  const [daysSinceCleaning, setDaysSinceCleaning] = useState(30);
  const [offlineTemp, setOfflineTemp] = useState(28);
  const [offlineCloud, setOfflineCloud] = useState(40);

  // Debounced values for API calls in ONLINE mode
  const [debouncedPanelAge, setDebouncedPanelAge] = useState(panelAge);
  const [debouncedDaysSinceCleaning, setDebouncedDaysSinceCleaning] = useState(daysSinceCleaning);

  // --- Effects ---

  // Debounce effects for online parameters
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedPanelAge(panelAge), DEBOUNCE_DELAY_MS);
    return () => clearTimeout(handler);
  }, [panelAge]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedDaysSinceCleaning(daysSinceCleaning), DEBOUNCE_DELAY_MS);
    return () => clearTimeout(handler);
  }, [daysSinceCleaning]);


  // Get user's live location on initial load
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ lat: latitude, lon: longitude });
        setIsLocationLive(true);
      },
      () => setIsLocationLive(false)
    );
  }, []);

  // --- Data Loading Logic ---

  // 1. Function to load ONLINE data from the API
  const loadOnlineData = useCallback(async () => {
    if (!isOnline) return; // Safety check

    setLoading(true);
    setError(null);
    try {
      const [live, history] = await Promise.all([
        fetchOnlineData(location, debouncedPanelAge, debouncedDaysSinceCleaning),
        fetchHistoryData(debouncedPanelAge, debouncedDaysSinceCleaning)
      ]);
      setLiveData(live);
      setHistoryData(history);
      cacheData(live, history); // Cache the successful online data
      // Update offline defaults from live data
      setOfflineTemp(live.live_weather.temperature_celsius);
      setOfflineCloud(live.live_weather.cloud_cover_percentage);
    } catch (e) {
      console.error("Failed to load online data:", e);
      setError(e.message);
      setIsOnline(false); // Switch to offline on error
    } finally {
      setLoading(false);
    }
  }, [isOnline, location, debouncedPanelAge, debouncedDaysSinceCleaning]);


  // 2. Function to run the OFFLINE simulation
  const runOfflineSimulation = async () => {
    setLoading(true);
    setError(null);
    try {
      // This object now matches the parameter for generateOfflineRecommendation
      const currentConditions = {
        panel_age_in_days: panelAge,
        days_since_cleaning: daysSinceCleaning,
        temperature_celsius: offlineTemp,
        cloud_cover_percentage: offlineCloud,
      };

      // Await both promises together for efficiency
      const [offlineLive, offlineHistory] = await Promise.all([
        generateOfflineRecommendation(currentConditions),
        generateOfflineHistory(panelAge, daysSinceCleaning, offlineTemp, offlineCloud)
      ]);

      // The live data for the card needs to match the online structure
      setLiveData({
        live_status: offlineLive,
        live_weather: {
          temperature_celsius: offlineTemp,
          cloud_cover_percentage: offlineCloud,
        }
      });
      setHistoryData(offlineHistory);

    } catch (e) {
      console.error("Failed to run offline simulation:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Effect for INITIAL load and handling mode switches
  useEffect(() => {
    const { liveData: cachedLive, historyData: cachedHistory } = getCachedData();
    if (cachedLive && cachedHistory) {
      setLiveData(cachedLive);
      setHistoryData(cachedHistory);
      setOfflineTemp(cachedLive.live_weather.temperature_celsius);
      setOfflineCloud(cachedLive.live_weather.cloud_cover_percentage);
      setLoading(false);
    } else if (isOnline) {
      // If no cache, and we are online, load fresh data.
      loadOnlineData();
    } else {
      // If no cache and we start offline, just stop loading.
      setLoading(false);
    }
  }, []); // Runs only ONCE on initial mount

  // 4. Effect for ONLINE data fetching (and background refresh)
  useEffect(() => {
    if (!isOnline) return;

    // Fetch data immediately when dependencies change
    loadOnlineData();

    // Set up the interval for background refresh
    const intervalId = setInterval(loadOnlineData, REFRESH_INTERVAL_MS);

    // Cleanup interval on unmount or when dependencies change
    return () => clearInterval(intervalId);

  }, [isOnline, location, debouncedPanelAge, debouncedDaysSinceCleaning]); // Re-runs when these change


  const getRecommendationCardClassName = () => {
    if (error) return 'recommendation-card error';
    if (!liveData) return 'recommendation-card';
    const actionRequired = isOnline ? liveData.action_required : liveData.live_status?.action_required;
    return `recommendation-card ${actionRequired ? 'action-needed' : ''}`;
  };

  const renderContent = () => {
    if (loading && !liveData) { // Only show full loading screen on initial load
      return (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>{isOnline ? 'Fetching live data...' : 'Running offline simulation...'}</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className={getRecommendationCardClassName()}>
          <div className="card-header"><h3>{isOnline ? 'Connection Error' : 'Offline Error'}</h3></div>
          <div className="card-content">
            <p className="recommendation-message">{error}</p>
            <p>Please ensure the backend server is running and check the browser console for more details.</p>
          </div>
        </div>
      );
    }

    if (liveData && liveData.live_weather) {
      const recommendation = isOnline ? liveData.recommendation_message : liveData.live_status?.recommendation_message;
      const loss = isOnline ? liveData.predicted_loss_kw : liveData.live_status?.predicted_loss_kw;

      return (
        <>
          <div className={getRecommendationCardClassName()}>
            <div className="card-header">
              <h3>{isOnline ? 'Live Analysis' : 'Offline Simulation'} & Recommendation</h3>
            </div>
            <div className="card-content">
              <p className="recommendation-message">{recommendation}</p>
              <div className="details">
                <div className="detail-item">
                  <span className="detail-label">Temperature</span>
                  <span className="detail-value">{liveData.live_weather.temperature_celsius?.toFixed(1)} °C</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Cloud Cover</span>
                  <span className="detail-value">{liveData.live_weather.cloud_cover_percentage} %</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Predicted Loss</span>
                  <span className="detail-value">{loss?.toFixed(4)} kW</span>
                </div>
              </div>
            </div>
          </div>
          {historyData && (
            <div className="history-card">
              <HistoryGraph data={historyData} />
            </div>
          )}
        </>
      );
    }
    // Fallback content when not loading, no error, and no data yet
    return (
      <div className="recommendation-card">
        <div className="card-header"><h3>{isOnline ? 'Live Analysis' : 'Offline Simulation'}</h3></div>
        <div className="card-content">
          <p className="recommendation-message">
            {isOnline ? 'Ready to fetch live data.' : 'Set parameters and click "Run Simulation" to begin.'}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Solar Panel Optimizer</h1>
        <div className="header-controls">
          {isLocationLive && (
            <span className="location-indicator live">
              ● Live Location
            </span>
          )}
          <button
            className={`status-indicator ${isOnline && !error ? 'online' : 'offline'}`}
            onClick={() => setIsOnline(!isOnline)}
          >
            {isOnline && !error ? 'Online Mode' : 'Offline Mode'}
          </button>
        </div>
      </header>
      <main className="main-content">
        <div className="settings-card">
          <div className="card-header">
            <h3>System Parameters</h3>
          </div>
          <div className="card-content">
            <div className="details">
              <div className="detail-item">
                <label htmlFor="panelAge" className="detail-label">Panel Age (days)</label>
                <input
                  type="number"
                  id="panelAge"
                  className="detail-input"
                  value={panelAge}
                  onChange={(e) => setPanelAge(parseInt(e.target.value, 10))}
                />
              </div>
              <div className="detail-item">
                <label htmlFor="daysSinceCleaning" className="detail-label">Days Since Last Cleaning</label>
                <input
                  type="number"
                  id="daysSinceCleaning"
                  className="detail-input"
                  value={daysSinceCleaning}
                  onChange={(e) => setDaysSinceCleaning(parseInt(e.target.value, 10))}
                />
              </div>
              <div className="detail-item">
                <label htmlFor="offlineTemp" className="detail-label">Temperature (°C)</label>
                <input
                  type="number"
                  id="offlineTemp"
                  step="0.1"
                  className="detail-input"
                  value={offlineTemp}
                  onChange={(e) => setOfflineTemp(parseFloat(e.target.value))}
                  disabled={isOnline}
                />
              </div>
              <div className="detail-item">
                <label htmlFor="offlineCloud" className="detail-label">Cloud Cover (%)</label>
                <input
                  type="number"
                  id="offlineCloud"
                  className="detail-input"
                  value={offlineCloud}
                  onChange={(e) => setOfflineCloud(parseInt(e.target.value, 10))}
                  disabled={isOnline}
                />
              </div>
            </div>
            {!isOnline && (
              <button className="simulate-button" onClick={runOfflineSimulation} disabled={loading}>
                {loading ? 'Simulating...' : 'Run Simulation'}
              </button>
            )}
          </div>
        </div>
        {renderContent()}
      </main>
    </div>
  );
}

export default App;