import { useState, useEffect } from 'react';

export const useZoom = () => {
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    const detectZoom = () => {
      // Method 1: Using window.devicePixelRatio (most reliable)
      const zoom = window.devicePixelRatio || 1;
      
      // Method 2: Using visual viewport (more accurate for pinch zoom)
      let visualZoom = 1;
      if (window.visualViewport) {
        visualZoom = window.visualViewport.scale;
      }
      
      // Use the larger of the two for more accurate detection
      const effectiveZoom = Math.max(zoom, visualZoom);
      setZoomLevel(effectiveZoom);
    };

    // Initial detection
    detectZoom();

    // Listen for zoom changes
    window.addEventListener('resize', detectZoom);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', detectZoom);
    }

    return () => {
      window.removeEventListener('resize', detectZoom);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', detectZoom);
      }
    };
  }, []);

  return {
    zoomLevel,
    isZoomedIn: zoomLevel > 1,
    isZoomedOut: zoomLevel < 1,
    zoomPercentage: Math.round(zoomLevel * 100)
  };
};