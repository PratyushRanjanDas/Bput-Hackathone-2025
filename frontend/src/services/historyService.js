import Dexie from 'dexie';

const db = new Dexie('SolarPanelOptimizer');
db.version(1).stores({
  history: '++id, timestamp, panel_age, last_cleaned_days, efficiency_loss, recommendation',
});

const API_URL = 'http://127.0.0.1:5000'; // Adjust if your backend runs elsewhere

/**
 * Saves a prediction record to the local database and tries to sync with the backend.
 * @param {object} record - The prediction record to save.
 * @returns {Promise<number>} The ID of the newly created local record.
 */
export const savePrediction = async (record) => {
  const recordWithTimestamp = { ...record, timestamp: new Date().toISOString() };
  
  // Save to local DB first for offline-first approach
  const localId = await db.history.add(recordWithTimestamp);
  
  // Try to sync with the backend in the background
  syncWithBackend().catch(err => console.error("Background sync failed:", err));
  
  return localId;
};

/**
 * Fetches all history from the local database.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of history records.
 */
export const getLocalHistory = () => {
  return db.history.orderBy('timestamp').toArray();
};

/**
 * Syncs the local database with the backend server.
 * Fetches new records from the server and pushes unsynced local records.
 * @returns {Promise<void>}
 */
export const syncWithBackend = async () => {
  if (!navigator.onLine) {
    console.log("Offline. Skipping backend sync.");
    return;
  }

  try {
    // 1. Fetch latest records from the backend
    const response = await fetch(`${API_URL}/history`);
    if (!response.ok) throw new Error('Failed to fetch history from server');
    
    const serverHistory = await response.json();
    
    // A simple sync: add server records to local DB if they don't exist.
    // A more robust solution would handle conflicts and use last-sync timestamps.
    await db.transaction('rw', db.history, async () => {
      for (const record of serverHistory) {
        // Assuming a unique combination of timestamp and recommendation can identify a record
        const existing = await db.history.where({ timestamp: record.timestamp, recommendation: record.recommendation }).first();
        if (!existing) {
          await db.history.add(record);
        }
      }
    });

    // 2. Push local-only records to the backend (simplified)
    // In a real app, you'd track which records are "dirty" or "unsynced".
    // For this project, we'll just POST all local records. The backend should be idempotent.
    const localRecords = await db.history.toArray();
    await fetch(`${API_URL}/history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(localRecords),
    });

    console.log("Backend sync completed successfully.");

  } catch (error) {
    console.error("Error during backend sync:", error);
    // The app will continue to function with local data.
  }
};
