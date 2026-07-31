'use client';
import React, { useState, useRef, useEffect, Children, isValidElement } from 'react';
import styles from './CustomSelect.module.css';

export default function CustomSelect({ value, onChange, options, children, placeholder = "-- Select --", disabled = false, required = false, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  let formattedOptions = [];
  
  if (options) {
    formattedOptions = options.map(opt => {
      if (typeof opt === 'string' || typeof opt === 'number') {
        return { label: String(opt), value: String(opt) };
      }
      return opt;
    });
  } else if (children) {
    Children.forEach(children, child => {
      if (isValidElement(child) && child.type === 'option') {
        const val = child.props.value !== undefined ? String(child.props.value) : child.props.children;
        // Ignore the empty placeholder option commonly used like <option value="">-- Select --</option>
        if (val === "" && String(child.props.children).includes("--")) return;
        formattedOptions.push({
          label: child.props.children,
          value: val
        });
      }
    });
  }

  const selectedOption = formattedOptions.find(o => String(o.value) === String(value)) || { label: placeholder, value: '' };

  return (
    <div className={`${styles.container} ${isOpen ? styles.open : ''} ${disabled ? styles.disabled : ''} ${className}`} ref={containerRef}>
      <div 
        className={styles.toggle} 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!disabled) setIsOpen(!isOpen);
          }
        }}
      >
        <span className={styles.label} style={{ color: selectedOption.value === '' ? '#9ca3af' : 'inherit' }}>
          {selectedOption.label}
        </span>
        <i className={`fa fa-chevron-${isOpen ? 'up' : 'down'}`} style={{ fontSize: '10px', color: '#9ca3af' }}></i>
      </div>
      
      {isOpen && !disabled && (
        <div className={styles.menu}>
          {formattedOptions.map(opt => (
            <div 
              key={opt.value} 
              className={`${styles.item} ${String(value) === String(opt.value) ? styles.active : ''}`}
              onClick={() => {
                onChange({ target: { value: opt.value } });
                setIsOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
