import React, { useRef, useEffect, useState } from 'react';
import PhotoRenderer from './PhotoRenderer';

const Component = ({ imageUrl = '/image7.png' }) => {
    const mountRef = useRef(null);
    const rendererRef = useRef(null);
    const [textureLoaded, setTextureLoaded] = useState(false);
    const [error, setError] = useState(null);
  
    useEffect(() => {
      if (!mountRef.current) return;
      
      // Reset state
      setTextureLoaded(false);
      setError(null);
      
      console.log("Initializing PhotoRenderer with image:", imageUrl);
      
      try {
        // Create renderer instance
        rendererRef.current = new PhotoRenderer();
        
        // Initialize with mount element and image URL
        // comp1 = rendererRef.current.init(mountRef.current, "/image7.png", true, 3, 0);
        rendererRef.current.init(mountRef.current, "/image.png", true, 5, 34);
        
        // Set up a listener to know when texture is loaded
        const checkLoaded = setInterval(() => {
          if (rendererRef.current.textureLoaded) {
            console.log("Texture loaded successfully");
            setTextureLoaded(true);
            clearInterval(checkLoaded);
          }
        }, 100);
  
        // Timeout after 10 seconds to prevent infinite checking
        const timeout = setTimeout(() => {
          if (!rendererRef.current.textureLoaded) {
            setError("Timeout loading image. Please check the URL and try again.");
            clearInterval(checkLoaded);
          }
        }, 10000);
  
        // Cleanup function
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

  return (
    <div ref={mountRef} style={{ width: '100vw', height: '100vh' }}>
      {!textureLoaded && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          fontSize: '24px'
        }}>
          Loading image...
        </div>
      )}
    </div>
  );
};

export default Component;