// --- Web Serial API for Arduino Communication ---

// This file contains the logic to connect to a serial device (like an Arduino)
// using the Web Serial API, read data from it, and handle the connection lifecycle.

// --- Configuration ---
const VENDOR_ID = 0x2341; // Arduino LLC's Vendor ID

/**
 * Checks if the Web Serial API is supported by the browser.
 * @returns {boolean} True if supported, false otherwise.
 */
export function isWebSerialSupported() {
  return 'serial' in navigator;
}

/**
 * Prompts the user to select a serial port and returns the selected port.
 * This function must be called from a user-initiated event (e.g., a button click).
 * @returns {Promise<SerialPort|null>} A promise that resolves with the selected port, or null if none is selected.
 */
export async function getPort() {
  if (!isWebSerialSupported()) {
    console.error("Web Serial API is not supported in this browser.");
    alert("Web Serial API is not supported by your browser. Please use Chrome, Edge, or Opera.");
    return null;
  }

  try {
    // Request a port, filtering for devices with the Arduino vendor ID
    const port = await navigator.serial.requestPort({
      filters: [{ usbVendorId: VENDOR_ID }]
    });
    return port;
  } catch (error) {
    console.error("No port selected or an error occurred:", error);
    return null;
  }
}

/**
 * Connects to the given serial port and starts reading data from it.
 * @param {SerialPort} port - The port to connect to.
 * @param {function(string): void} onData - A callback function to handle incoming data lines.
 * @returns {Promise<{reader: ReadableStreamDefaultReader, port: SerialPort}>} A promise that resolves with the reader and port.
 */
export async function connectAndRead(port, onData) {
  try {
    // Open the port with a standard baud rate for Arduino
    await port.open({ baudRate: 9600 });
    console.log("Serial port opened successfully.");

    // Set up a text decoder to interpret the incoming data as text
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();

    // Listen for data from the serial port
    (async () => {
      try {
        let lineBuffer = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            // The reader has been closed.
            console.log("Reader has been closed.");
            break;
          }
          // The value is a chunk of text. Process it.
          lineBuffer += value;
          const lines = lineBuffer.split('\\n');
          lineBuffer = lines.pop(); // Keep the last, possibly incomplete, line

          lines.forEach(line => {
            if (line.trim()) {
              onData(line.trim());
            }
          });
        }
      } catch (error) {
        console.error("Error while reading from serial port:", error);
      } finally {
        reader.releaseLock();
      }
    })();
    
    return { reader, port, readableStreamClosed };

  } catch (error) {
    console.error("Failed to open serial port:", error);
    throw error;
  }
}

/**
 * Disconnects from the serial port.
 * @param {ReadableStreamDefaultReader} reader - The stream reader to cancel.
 * @param {SerialPort} port - The port to close.
 */
export async function disconnectPort(reader, port, readableStreamClosed) {
  if (reader) {
    try {
      await reader.cancel();
    } catch (error) {
      console.error("Error cancelling the reader:", error);
    }
  }
  
  if (readableStreamClosed) {
    await readableStreamClosed.catch(() => {}); // Ignore errors on closing
  }

  if (port && port.writable) {
     // We need to close the writer before closing the port
    try {
        const writer = port.writable.getWriter();
        writer.close();
        writer.releaseLock();
    } catch (error) {
        console.error("Error closing the writer:", error);
    }
  }

  if (port) {
    try {
      await port.close();
      console.log("Serial port closed.");
    } catch (error) {
      console.error("Failed to close serial port:", error);
    }
  }
}
