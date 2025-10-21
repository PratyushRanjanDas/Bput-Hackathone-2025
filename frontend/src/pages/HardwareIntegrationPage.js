import React, { useState, useRef, useEffect } from 'react';
import { isWebSerialSupported, getPort, connectAndRead, disconnectPort } from '../services/arduinoService';
import './HardwareIntegrationPage.css';

function HardwareIntegrationPage({ dustDensity, setDustDensity }) {
  const [supported, setSupported] = useState(false);
  const [connected, setConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Ready to connect.');

  // Refs to hold the port, reader, and stream instances
  const portRef = useRef(null);
  const readerRef = useRef(null);
  const readableStreamClosedRef = useRef(null);

  useEffect(() => {
    setSupported(isWebSerialSupported());
    if (!isWebSerialSupported()) {
      setStatusMessage('Web Serial API is not supported by your browser. Please use a compatible browser like Chrome or Edge.');
    }
  }, []);

  const handleConnect = async () => {
    if (!supported) return;

    try {
      setStatusMessage('Please select the Arduino port from the popup...');
      const port = await getPort();
      if (!port) {
        setStatusMessage('No port selected. Ready to connect.');
        return;
      }
      portRef.current = port;

      setStatusMessage('Connecting to device...');
      const { reader, readableStreamClosed } = await connectAndRead(port, (line) => {
        try {
          // The Arduino sends JSON, so we parse it
          const data = JSON.parse(line);
          if (data.dustDensity_mg_m3 !== undefined) {
            setDustDensity(data.dustDensity_mg_m3);
            setStatusMessage('Receiving data...');
          }
        } catch (error) {
          console.warn('Received non-JSON data from serial:', line);
        }
      });
      
      readerRef.current = reader;
      readableStreamClosedRef.current = readableStreamClosed;
      setConnected(true);
      setStatusMessage('Connected and listening for data.');

    } catch (error) {
      setStatusMessage(`Connection failed: ${error.message}`);
      setConnected(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connected) return;

    await disconnectPort(readerRef.current, portRef.current, readableStreamClosedRef.current);
    
    setConnected(false);
    // Don't clear the dust density on disconnect, so it persists
    setStatusMessage('Disconnected. Ready to connect.');
    portRef.current = null;
    readerRef.current = null;
    readableStreamClosedRef.current = null;
  };
  
  // Ensure disconnection on component unmount
  useEffect(() => {
    return () => {
      if (connected) {
        handleDisconnect();
      }
    };
  }, [connected]);

  return (
    <div className="hardware-page">
      <div className="page-header">
        <h1>Hardware Integration</h1>
        <p>Live Dust Sensor Reading via Web Serial API</p>
      </div>

      <div className="hardware-container">
        <div className="connection-controls">
          <h2>Connection Status: <span className={connected ? 'status-connected' : 'status-disconnected'}>{connected ? 'Connected' : 'Disconnected'}</span></h2>
          <p className="status-message">{statusMessage}</p>
          {!connected ? (
            <button onClick={handleConnect} disabled={!supported} className="connect-btn">
              Connect to Arduino
            </button>
          ) : (
            <button onClick={handleDisconnect} className="disconnect-btn">
              Disconnect
            </button>
          )}
        </div>

        <div className="data-display">
          <h2>Live Dust Density</h2>
          <div className="density-value-wrapper">
            {dustDensity !== null && dustDensity !== '' ? (
              <span className="density-value">{parseFloat(dustDensity).toFixed(2)}</span>
            ) : (
              <span className="density-value-placeholder">--.--</span>
            )}
            <span className="density-unit">mg/m³</span>
          </div>
          <p className="data-description">This value represents the density of dust particles in the air, read from the sensor.</p>
        </div>

        <div className="explanation-box">
          <h3>How This Works (For the Jury)</h3>
          <p>
            This page demonstrates direct communication between a web browser and a microcontroller (like an Arduino) using the <strong>Web Serial API</strong>.
          </p>
          <ol>
            <li><strong>Arduino Code:</strong> An Arduino is running a sketch (<code>dust_sensor_simulation.ino</code>) that simulates reading from an optical dust sensor (like the Sharp GP2Y1010AU0F). It sends the data as a JSON string over its USB serial port every few seconds.</li>
            <li><strong>Connect Button:</strong> Clicking the "Connect" button uses the Web Serial API (<code>navigator.serial.requestPort()</code>) to ask you to select the connected Arduino from a list of serial devices.</li>
            <li><strong>Live Data Stream:</strong> Once connected, the browser opens the serial port and listens for incoming data. The JavaScript code reads the stream, decodes the text, parses the JSON, and updates the "Live Dust Density" value on this page in real-time.</li>
            <li><strong>Real-World Application:</strong> In the full system, this live dust value would be used to automatically update the "Days Since Cleaning" parameter, providing a more accurate and automated recommendation for when the solar panels need to be cleaned.</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default HardwareIntegrationPage;
