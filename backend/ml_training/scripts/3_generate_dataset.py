"""Generate a realistic PV dataset for a location (default: Bhubaneswar, Odisha).
Writes to canonical `backend/data/historical_loss_data.csv` so downstream code doesn't change.
"""
import numpy as np
import pandas as pd
from pathlib import Path
import pvlib
from pvlib.location import Location
from datetime import datetime, timedelta

OUT = Path(__file__).resolve().parents[2] / 'data' / 'historical_loss_data.csv'

# default site location: Bhubaneswar, Odisha
LAT, LON, TZ = 20.2961, 85.8245, 'Asia/Kolkata'

def generate_dataset(start='2023-01-01', end='2024-12-31', freq='1h', lat=LAT, lon=LON, tz=TZ):
    loc = Location(lat, lon, tz)
    times = pd.date_range(start=start, end=end, freq=freq, tz=tz)

    # clear-sky model (ineichen)
    cs = loc.get_clearsky(times, model='ineichen')
    ghi = cs['ghi']

    # simple ambient temperature
    np.random.seed(42)
    temp = 20 + 10 * np.sin(2 * np.pi * (times.dayofyear / 365.0)) + np.random.normal(0, 2, len(times))

    # cloud cover proxy: AR(1)
    cc = np.zeros(len(times))
    cc[0] = 20 + 10 * np.random.randn()
    for i in range(1, len(times)):
        cc[i] = 0.7*cc[i-1] + 0.3*(30 + 30*np.random.randn())
    cc = np.clip(cc, 0, 100)

    # PV geometry & POA
    surface_tilt = lat
    surface_azimuth = 180
    solar_position = pvlib.solarposition.get_solarposition(times, lat, lon)
    poa = pvlib.irradiance.get_total_irradiance(surface_tilt,
                                               surface_azimuth,
                                               solar_position['zenith'],
                                               solar_position['azimuth'],
                                               ghi,
                                               cs['dhi'],
                                               cs['dni'])['poa_global']

    # system spec & ideal power
    system = {'pdc0_kw': 5.0}
    clear_ref = poa.max() if poa.max() > 0 else 1000
    ideal_kw = system['pdc0_kw'] * (poa / clear_ref)
    ideal_kw = np.clip(ideal_kw, 0, None)

    # rain/soiling model
    rain_prob = np.clip(cc / 100.0 * 0.02, 0, 1)
    is_rain = np.random.rand(len(times)) < rain_prob

    days_since_clean = np.zeros(len(times))
    ds = 0.0
    soiling_pct = np.zeros(len(times))
    soiling_rate_daily = 0.0008
    seasonal_amp = 1 + 0.5*np.sin(2*np.pi*(times.dayofyear/365.0))
    for i in range(len(times)):
        if is_rain[i]:
            if np.random.rand() < 0.8:
                ds = 0.0
        else:
            ds += 1/24.0
        days_since_clean[i] = ds
        soiling_pct[i] = np.clip(soiling_rate_daily * ds * seasonal_amp[i], 0, 0.30)

    # cloud attenuation and soiling
    actual_kw = ideal_kw * (1 - (cc/100.0)*0.7)
    actual_kw = actual_kw * (1 - soiling_pct)
    actual_kw *= (1 - np.clip(np.random.normal(0.01, 0.01, len(actual_kw)), 0, 0.05))

    energy_loss_kw = ideal_kw - actual_kw

    df = pd.DataFrame({
        'timestamp': times.tz_convert('UTC').tz_localize(None),
        'temperature_celsius': temp,
        'cloud_cover_percentage': cc,
        'panel_age_in_days': ((times - times[0]).days).astype(int),
        'days_since_cleaning': days_since_clean,
        'ideal_power_kw': ideal_kw,
        'actual_power_kw': actual_kw,
        'energy_loss_kw': energy_loss_kw,
    })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUT, index=False)
    print('Wrote', OUT)
    return df

if __name__ == '__main__':
    df = generate_dataset()
    print(df.head())
