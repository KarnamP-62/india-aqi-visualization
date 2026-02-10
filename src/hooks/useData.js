import { useState, useEffect } from "react";
import { loadAQIData, processAQIData } from "../utils/dataProcessing";

/**
 * Custom hook to load and manage AQI data
 * @param {string} dataPath - Path to data file
 * @returns {Object} { data, loading, error }
 */
export function useData(dataPath = "/data/AQI.csv") {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        setLoading(true);
        const rawData = await loadAQIData(dataPath);
        const processedData = processAQIData(rawData);

        if (isMounted) {
          setData(processedData);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [dataPath]);

  return { data, loading, error };
}
