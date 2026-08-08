import React from 'react';

export const MobileFrame = ({ children, isFullScreen }) => {
  return (
    <div className={`app-container ${isFullScreen ? 'full-screen' : ''}`}>
      {/* Screen Viewport */}
      {children}
    </div>
  );
};
