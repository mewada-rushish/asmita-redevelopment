import styles from './modals.module.css'; 

export default function DuplicateAlertModal({ isOpen, matchedProperty, onContinue }) {
    if (!isOpen || !matchedProperty) return null;

    const handleViewExisting = () => {
        // Opens the existing property edit page in a new window/tab
        window.open(`/dashboard/edit/${matchedProperty.id}`, '_blank');
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
                <div className={styles.modalHeader}>
                    <h2>
                        <i className="fa fa-exclamation-triangle"></i> Similar Property Detected
                    </h2>
                </div>
                
                <div className={styles.modalBody}>
                    <p>A property with a very similar name or address already exists:</p>
                    
                    <div className={styles.propertyCard}>
                        <strong>{matchedProperty.property_name}</strong>
                        <p>{matchedProperty.address}</p>
                    </div>
                    
                    <p className={styles.promptText}>
                        Would you like to check the existing record or continue?
                    </p>
                </div>
                
                <div className={styles.modalFooter}>
                    <button 
                        onClick={handleViewExisting} 
                        className={styles.primaryBtn} 
                    >
                        View Existing
                    </button>
                    <button 
                        onClick={onContinue} 
                        className={styles.secondaryBtn}
                    >
                        Continue
                    </button>
                </div>
            </div>
        </div>
    );
}