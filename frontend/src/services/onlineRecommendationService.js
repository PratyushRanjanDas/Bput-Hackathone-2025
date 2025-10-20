// filepath: src/services/onlineRecommendationService.js

const API_URL = 'http://127.0.0.1:5000'; // Your backend API URL

/**
 * Fetches a recommendation from the live backend server.
 * @param {object} currentConditions - The current panel conditions.
 *   Expected format: {
 *     installation_date: "YYYY-MM-DD",
 *     last_cleaned_date: "YYYY-MM-DD",
 *     temperature_celsius: number,
 *     cloud_cover_percentage: number
 *   }
 * @returns {Promise<object>} A promise that resolves to the recommendation result from the backend.
 */
export async function generateOnlineRecommendation(currentConditions) {
  try {
    const response = await fetch(`${API_URL}/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(currentConditions),
    });

    if (!response.ok) {
      // Try to parse the error message from the backend if available
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.error || `Server responded with status: ${response.status}`;
      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result;

  } catch (error) {
    console.error('Error fetching online recommendation:', error);
    // Return a structured error that the UI can understand
    return { 
      error: `Could not connect to the server. ${error.message}` 
    };
  }
}
