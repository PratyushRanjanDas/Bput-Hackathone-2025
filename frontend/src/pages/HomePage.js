import React from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';

function HomePage({
    panelAge,
    setPanelAge,
    dustDensity,
    setDustDensity,
    numPanels,
    setNumPanels,
    idealPanelGeneration,
    setIdealPanelGeneration,
    tiltAngle,
    setTiltAngle,
    lastCleanDate, 
    setLastCleanDate, 
    onAnalyze,
    isLoading,
    error
}) {
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        onAnalyze().then(() => {
            navigate('/live-analysis');
        });
    };

    // Calculate years from installation date
    const handleInstallDateChange = (e) => {
        const installDate = new Date(e.target.value);
        const today = new Date();
        const ageInYears = (today - installDate) / (1000 * 60 * 60 * 24 * 365);
        setPanelAge(ageInYears.toFixed(2));
    };

    // Calculate date from years (for default value)
    const getInstallDate = () => {
        const today = new Date();
        const installDate = new Date(today - parseFloat(panelAge || 0) * 365 * 24 * 60 * 60 * 1000);
        return installDate.toISOString().split('T')[0];
    };

    // Handle last clean date change
    const handleLastCleanDateChange = (e) => {
        setLastCleanDate(e.target.value);
    };

    // Default value for last clean date (today if not set)
    const getLastCleanDate = () => {
        return lastCleanDate || new Date().toISOString().split('T')[0];
    };

    return (
        <div className="home-page">
            <div className="home-hero">
                <h1>Welcome to Solar Panel Optimizer</h1>
                <p>Optimize your solar panel performance with real-time analysis and AI-powered recommendations</p>
            </div>

            <div className="home-form-container">
                <h2>System Configuration</h2>
                <form onSubmit={handleSubmit} className="config-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="installDate">
                                <span className="label-icon">📅</span>
                                Panel Installation Date
                            </label>
                            <input
                                id="installDate"
                                type="date"
                                defaultValue={getInstallDate()}
                                onChange={handleInstallDateChange}
                                max={new Date().toISOString().split('T')[0]}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="lastCleanDate">
                                <span className="label-icon">🧹</span>
                                Last Clean Date
                            </label>
                            <input
                                id="lastCleanDate"
                                type="date"
                                value={getLastCleanDate()}
                                onChange={handleLastCleanDateChange}
                                max={new Date().toISOString().split('T')[0]}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="dustDensity">
                                <span className="label-icon">💨</span>
                                Dust Density (mg/m³)
                            </label>
                            <input
                                id="dustDensity"
                                type="number"
                                value={dustDensity}
                                onChange={(e) => setDustDensity(e.target.value)}
                                min="0"
                                step="0.01"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="numPanels">
                                <span className="label-icon">⚡</span>
                                Number of Panels
                            </label>
                            <input
                                id="numPanels"
                                type="number"
                                value={numPanels}
                                onChange={(e) => setNumPanels(e.target.value)}
                                min="1"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="idealGeneration">
                                <span className="label-icon">🔋</span>
                                Ideal Panel Generation (kWh/d per panel)
                            </label>
                            <input
                                id="idealGeneration"
                                type="number"
                                value={idealPanelGeneration}
                                onChange={(e) => setIdealPanelGeneration(e.target.value)}
                                min="0.1"
                                step="0.01"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="tiltAngle">
                                <span className="label-icon">📐</span>
                                Panel Tilt Angle (degrees)
                            </label>
                            <input
                                id="tiltAngle"
                                type="number"
                                value={tiltAngle}
                                onChange={(e) => setTiltAngle(e.target.value)}
                                min="0"
                                max="90"
                                step="1"
                                required
                            />
                        </div>
                    </div>


                    {error && (
                        <div className="error-message">
                            ⚠️ {error}
                        </div>
                    )}

                    <button type="submit" className="analyze-button" disabled={isLoading}>
                        {isLoading ? (
                            <>
                                <span className="spinner"></span>
                                Analyzing...
                            </>
                        ) : (
                            <>
                                <span>🔍</span>
                                Start Analysis
                            </>
                        )}
                    </button>
                </form>

                <div className="info-cards">
                    <div className="info-card">
                        <div className="info-icon">🌍</div>
                        <h3>Location-Based</h3>
                        <p>Uses your current location for accurate weather data</p>
                    </div>
                    <div className="info-card">
                        <div className="info-icon">🤖</div>
                        <h3>AI-Powered</h3>
                        <p>Machine learning models predict panel performance</p>
                    </div>
                    <div className="info-card">
                        <div className="info-icon">📊</div>
                        <h3>Real-Time Data</h3>
                        <p>Live weather and performance monitoring</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default HomePage;
// ...existing code...