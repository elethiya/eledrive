import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import ConfirmModal from '../components/Modals/ConfirmModal';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [config, setConfig] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setConfig({
        isOpen: true,
        title: options.title || 'Confirm Action',
        message: options.message || 'Are you sure you want to proceed?',
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'danger',
        icon: options.icon,
        itemHighlight: options.itemHighlight,
        subMessage: options.subMessage,
      });
    });
  }, []);

  const handleConfirm = () => {
    setConfig(null);
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  };

  const handleCancel = () => {
    setConfig(null);
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {config && (
        <ConfirmModal
          isOpen={config.isOpen}
          title={config.title}
          message={config.message}
          confirmText={config.confirmText}
          cancelText={config.cancelText}
          variant={config.variant}
          icon={config.icon}
          itemHighlight={config.itemHighlight}
          subMessage={config.subMessage}
          onConfirm={handleConfirm}
          onClose={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}
