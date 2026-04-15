'use client';
import { useState } from 'react';
import styles from './Accordion.module.css';

export default function Accordion({ title, icon, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={styles.premiumWrapper}>
      <button 
        type="button" 
        className={`${styles.premiumHeader} ${isOpen ? styles.premiumHeaderOpen : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className={styles.premiumTitleArea}>
          {icon && <i className={`fa ${icon} ${styles.premiumIcon}`}></i>}
          <span>{title}</span>
        </div>
        <i className={`fa fa-chevron-${isOpen ? 'up' : 'down'} ${styles.premiumChevron}`}></i>
      </button>
      {isOpen && <div className={styles.premiumContent}>{children}</div>}
    </div>
  );
}