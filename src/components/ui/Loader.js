import React from 'react';
import styles from './Loader.module.css';

export default function Loader({ size, inline = false, color, style = {}, className = '' }) {
  const spinnerStyle = {};
  if (size) {
    spinnerStyle.width = typeof size === 'number' ? `${size}px` : size;
    spinnerStyle.height = typeof size === 'number' ? `${size}px` : size;
    spinnerStyle.borderWidth = typeof size === 'number' && size < 24 ? '2.5px' : '3px';
  }
  if (color) {
    spinnerStyle.borderTopColor = color;
  }

  if (inline) {
    return (
      <span className={`${styles.inlineLoader} ${className}`} style={style}>
        <span className={styles.spinner} style={spinnerStyle}></span>
      </span>
    );
  }

  return (
    <div className={`${styles.loaderContainer} ${className}`} style={style}>
      <div className={styles.spinner} style={spinnerStyle}></div>
    </div>
  );
}
