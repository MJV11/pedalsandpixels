import React, { useRef, useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceDot } from 'recharts';
import PhotoRenderer from './PhotoRenderer';

const Component = ({ imageUrl = '/image.png', apiKey = '5ce99ffjwrch65awctwoyxikp' }) => {
  const mountRef = useRef(null);
  const rendererRef = useRef(null);
  const [textureLoaded, setTextureLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [powerCurveData, setPowerCurveData] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const athleteId = 'i178902'; // athlete ID
  const timePoints = [1, 5, 10, 20, 30, 60, 120, 180, 300, 600, 1200, 1800, 3600];

  // Fetch power curve data from intervals.icu API
  useEffect(() => {
    const fetchPowerCurve = async () => {
      if (!apiKey) {
        setError("API key is required to fetch power curve data");
        return;
      }

      setIsLoadingData(true);
      try {
        const encodedAuth = btoa(`API_KEY:${apiKey}`);
        const url = `https://intervals.icu/api/v1/athlete/${athleteId}/power-curves?curves=all&type=Ride`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${encodedAuth}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        console.log(data.list[0]);

        if (data) {
          const allTimeCurve = data.list[0];
          const chartData = allTimeCurve.secs.map((sec, index) => ({
            seconds: sec,
            power: allTimeCurve.watts[index],
            isHighlighted: timePoints.includes(sec)
          }));
          console.log(chartData)

          setPowerCurveData(chartData);
        }

      } catch (err) {
        console.error("Error fetching power curve data:", err);
        setError(`Error fetching power curve data: ${err.message}`);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchPowerCurve();
  }, [apiKey, athleteId, timePoints]);

  useEffect(() => {
    if (!mountRef.current) return;

    setTextureLoaded(false);
    setError(null);
    try {
      rendererRef.current = new PhotoRenderer();
      rendererRef.current.init(mountRef.current, "/image.png", true, 5, 34);

      // set up a listener to know when texture is loaded
      const checkLoaded = setInterval(() => {
        if (rendererRef.current.textureLoaded) {
          console.log("Texture loaded successfully");
          setTextureLoaded(true);
          clearInterval(checkLoaded);
        }
      }, 100);

      // timeout after 10 seconds to prevent infinite checking
      const timeout = setTimeout(() => {
        if (!rendererRef.current.textureLoaded) {
          setError("Timeout loading image. Please check the URL and try again.");
          clearInterval(checkLoaded);
        }
      }, 10000);

      return () => {
        console.log("Cleaning up PhotoRenderer");
        clearInterval(checkLoaded);
        clearTimeout(timeout);
        if (rendererRef.current) {
          rendererRef.current.dispose();
          rendererRef.current = null;
        }
      };
    } catch (err) {
      console.error("Error initializing PhotoRenderer:", err);
      setError(`Error: ${err.message}`);
    }
  }, [imageUrl]);

  /** Find highlighted points for reference dots */ 
  const getHighlightedPoints = () => {
    if (!powerCurveData.length) return [];

    return powerCurveData
      .filter(point => point.isHighlighted)
      .map(point => ({
        seconds: point.seconds,
        power: point.power,
        label: formatDuration(point.seconds)
      }));
  };

  /** Format duration for display */
  const formatDuration = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m`;
    }
    const hours = Math.floor(seconds / 3600);
    return `${hours}h`;
  };


  return (
    <div style={{ position: 'relative', width: '100vw', height: '75vh' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }}>
        {!textureLoaded && (
          <div style={{
            height: "100vh",
            width: "100vw",
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'white',
            fontSize: '24px',
            backgroundColor: "white",
            zIndex: "100",
          }}>
            Loading image...
          </div>
        )}
      </div>

      {/* Full Screen Power Curve Overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none'
      }}>
        {isLoadingData ? (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'white',
            textAlign: 'center',
            fontSize: '24px',
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)'
          }}>
            
          </div>
        ) : error ? (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'red',
            textAlign: 'center',
            fontSize: '24px',
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)'
          }}>
            {error}
          </div>
        ) : powerCurveData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={powerCurveData} style={{ background: 'transparent' }}>
                <CartesianGrid strokeOpacity={0} />
                <XAxis
                  dataKey="seconds"
                  scale="log"
                  tick={{ fill: 'white' }}
                  tickFormatter={formatDuration}
                  domain={['auto', 'auto']}
                  label={{ value: 'Duration', position: 'insideBottom', fill: 'white', dy: 20 }}
                  ticks={timePoints}
                />
                <YAxis
                  tick={{ fill: 'white' }}
                  label={{ value: 'Power (watts)', angle: -90, position: 'insideLeft', fill: 'white', dx: -20 }}
                  domain={['auto', 'auto']}
                />
                <Line
                  type="monotone"
                  dataKey="power"
                  name="Power"
                  stroke="#6f03fc"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6 }}
                  animationDuration={4000}
                />

                {/* Reference dots for specific time points */}
                {getHighlightedPoints().map(point => (
                  <ReferenceDot
                    key={point.seconds}
                    x={point.seconds}
                    y={point.power}
                    r={5}
                    fill="#6f03fc"
                    stroke="black"
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
        ) : null}
      </div>

    </div>
  );
};

export default Component;