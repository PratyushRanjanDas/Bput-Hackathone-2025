import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

function Navbar({ isOnline }) {
  const location = useLocation();

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h2>☀️ Solar Panel Optimizer</h2>
      </div>
      <div className="navbar-links">
        <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
          Home
        </Link>
        <Link to="/live-analysis" className={location.pathname === '/live-analysis' ? 'active' : ''}>
          Live Analysis
        </Link>
        <Link to="/graph" className={location.pathname === '/graph' ? 'active' : ''}>
          Graph
        </Link>
        <Link to="/history" className={location.pathname === '/history' ? 'active' : ''}>
          History
        </Link>
        <Link to="/hardware" className={location.pathname === '/hardware' ? 'active' : ''}>
          Hardware
        </Link>
      </div>
      <div className="navbar-status">
        <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`}>
          <span className="status-dot"></span>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
