import React, { useEffect, useRef, useState } from 'react';
import StatusPanel from '../components/StatusPanel';
import RecommendationCard from '../components/RecommendationCard';
import './LiveAnalysisPage.css';

function LiveAnalysisPage({ liveData }) {
  const [showLossToast, setShowLossToast] = useState(false);
  const notifiedRef = useRef(false);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem('alertsMuted') === 'true';
    } catch (e) {
      return false;
    }
  });
  const audioRef = useRef(null);

  // Request notification permission once on mount (silent if already granted/denied)
  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Initialize audio element
  useEffect(() => {
    try {
      const a = new Audio('/alert.wav');
      a.preload = 'auto';
      a.volume = 0.8;
      audioRef.current = a;
    } catch (e) {
      audioRef.current = null;
    }
  }, []);
  useEffect(() => {
    if (liveData?.live_status?.energy_depreciation_percentage >= 10) {
      setShowLossToast(true);

      // Show browser notification once per session when condition becomes true
      if (!notifiedRef.current && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const notif = new Notification('Solar Panel Optimizer', {
            body: 'Energy loss exceeds 10%. Consider taking action.',
            icon: '/favicon.ico'
          });
          // optional: focus app on click
          notif.onclick = () => window.focus();
          notifiedRef.current = true;
        } catch (e) {
          // ignore notification errors
        }
      }

      // Play sound if available and not muted
      try {
        console.debug('Loss alert triggered. muted=', muted, 'audioRef=', !!audioRef.current, 'Notification.permission=', Notification.permission);
        if (!muted) {
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch((err) => console.debug('Audio play failed:', err));
          } else {
            // fallback: use Web Audio API to synthesize a short beep
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              const o = ctx.createOscillator();
              const g = ctx.createGain();
              o.type = 'sine';
              o.frequency.value = 880;
              g.gain.value = 0.0001;
              o.connect(g);
              g.connect(ctx.destination);
              // gradual ramp to avoid click
              g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
              o.start();
              setTimeout(() => {
                g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.02);
                o.stop(ctx.currentTime + 0.03);
                try { ctx.close(); } catch(e) {}
              }, 300);
            } catch (wae) {
              console.debug('WebAudio fallback failed:', wae);
            }
          }
        }
      } catch (e) {
        // ignore
      }

      const t = setTimeout(() => setShowLossToast(false), 6000);
      return () => clearTimeout(t);
    } else {
      // Reset notified flag when condition clears so user can be notified again later
      notifiedRef.current = false;
    }
  }, [liveData]);

  // Persist mute preference
  useEffect(() => {
    try {
      localStorage.setItem('alertsMuted', muted ? 'true' : 'false');
    } catch (e) {}
  }, [muted]);

  if (!liveData) {
    return (
      <div className="live-analysis-page">
        <div className="no-data-message">
          <h2>No Live Data Available</h2>
          <p>Please go to the Home page and run an analysis first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="live-analysis-page">
      {showLossToast && (
        <div className="toast toast-warning" onClick={() => setShowLossToast(false)}>
          ⚠️ Energy loss exceeds 10%. Consider taking action.
        </div>
      )}
      <div className="page-header">
        <h1>Live Analysis</h1>
        <p>Real-time performance monitoring and recommendations</p>
        <div style={{marginLeft: 'auto'}}>
          <button
            className="mute-button"
            onClick={() => setMuted(m => !m)}
            aria-pressed={muted}
            title={muted ? 'Unmute alerts' : 'Mute alerts'}
          >
            {muted ? '🔇 Alerts muted' : '🔔 Alerts on'}
          </button>
        </div>
      </div>

      <div className="analysis-grid">
        <div className="status-section">
          <h2>Current Status</h2>
          <StatusPanel liveData={liveData} />
        </div>

        <div className="recommendation-section">
          <h2>AI Recommendations</h2>
          <RecommendationCard liveData={liveData} />
        </div>
      </div>

      <div className="weather-details">
        <h2>Weather Conditions</h2>
        <div className="weather-grid">
          <div className="weather-card">
            <div className="weather-icon">🌡️</div>
            <div className="weather-label">Temperature</div>
            <div className="weather-value">
              {liveData.live_weather?.temperature_celsius?.toFixed(1) || 'N/A'}°C
            </div>
          </div>
          <div className="weather-card">
            <div className="weather-icon">☁️</div>
            <div className="weather-label">Cloud Cover</div>
            <div className="weather-value">
              {(liveData.live_weather?.cloud_cover_percentage ?? liveData.live_weather?.cloud_cover ?? 'N/A') + (typeof liveData.live_weather?.cloud_cover_percentage === 'number' || typeof liveData.live_weather?.cloud_cover === 'number' ? '%' : '')}
            </div>
          </div>
          <div className="weather-card">
            <div className="weather-icon">☀️</div>
            <div className="weather-label">UV Index</div>
            <div className="weather-value">
              {liveData.live_weather?.uv_index?.toFixed(1) || 'N/A'}
            </div>
          </div>
        </div>
      </div>

      <div className="tilt-details">
        <h2>Orientation & Tilt</h2>
        <div className="tilt-grid">
          <div className="tilt-card">
            <div className="tilt-label">Current Tilt</div>
            <div className="tilt-value">{liveData.live_status?.tilt_angle_deg ?? 'N/A'}°</div>
          </div>
          <div className="tilt-card">
            <div className="tilt-label">Optimal Tilt (Seasonal)</div>
            <div className="tilt-value">{liveData.live_status?.optimal_tilt_angle_deg ?? 'N/A'}°</div>
          </div>
          <div className="tilt-card">
            <div className="tilt-label">Tilt Penalty</div>
            <div className="tilt-value">{typeof liveData.live_status?.tilt_penalty_percentage === 'number' ? `${liveData.live_status.tilt_penalty_percentage}%` : 'N/A'}</div>
          </div>
          <div className="tilt-card">
            <div className="tilt-label">Tilt Loss</div>
            <div className="tilt-value">{typeof liveData.live_status?.tilt_loss_kw === 'number' ? `${liveData.live_status.tilt_loss_kw} kWh/d` : 'N/A'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveAnalysisPage;
