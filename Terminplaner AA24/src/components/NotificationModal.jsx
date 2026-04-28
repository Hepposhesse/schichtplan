import React, { useState } from 'react';

export function NotificationModal({ slot, onClose }) {
  const [copied, setCopied] = useState(false);
  const freeSpots = slot.capacity - slot.bookings.length;
  const dateStr = new Date(slot.date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
  
  const message = `Für den Slot am ${dateStr} um ${slot.time} fehlen noch ${freeSpots} Personen. Bitte eintragen.`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = message;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("Copy");
      textArea.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>Agenten informieren</h3>
        <p className="modal-desc">Kopiere diese Nachricht, um offene Schichten in anderen Kanälen sofort zu besetzen.</p>
        
        <div className="message-box">
          {message}
        </div>
        
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={handleCopy}>
            {copied ? '✅ Kopiert!' : '📋 Nachricht kopieren'}
          </button>
          
          <a href="slack://open" className="btn btn-secondary slack-btn" target="_blank" rel="noopener noreferrer">
             Slack öffnen
          </a>
          
          <a href={`whatsapp://send?text=${encodeURIComponent(message)}`} className="btn btn-secondary wp-btn" target="_blank" rel="noopener noreferrer">
             WhatsApp
          </a>
        </div>
        
        <button className="btn btn-close" onClick={onClose}>Schließen</button>
      </div>
    </div>
  );
}
