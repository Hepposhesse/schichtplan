import React, { useState } from 'react';
import { NotificationModal } from './NotificationModal';

const ROLE_LABELS = {
  multiskill: 'Multiskill',
  email: 'E-Mail',
  telefonie: 'Telefonie',
  chat: 'Chat'
};

const COMP_LABELS = {
  standard: 'Standard',
  special: 'Sondervergütung'
};

export function SlotCard({ 
  slot = {}, 
  onBook = () => {}, 
  onDelete = () => {}, 
  onEdit = () => {}, 
  updateSlot,
  isSelected = false, 
  onToggleSelect = () => {}, 
  compact = false, 
  isAdmin = false,
  users = [],
  filter = 'all',
  selectedUserId,
  unbookSlot,
}) {
  console.log("SLOTCARD RECEIVES:", slot);
  if (!slot || !slot.id) return null;

  console.log("RENDER SLOT:", slot.role, slot.compensation);

  const safeCapacity = Number(slot.capacity) || 0;
  const safeBookings = Array.isArray(slot.bookings) ? slot.bookings : [];
  const safeBookingsLength = safeBookings.length;
  // slot.startTime / endTime mapping fallback request
  const displayTime = slot.time || (slot.startTime ? `${slot.startTime} - ${slot.endTime || '?'}` : '???');

  const [showModal, setShowModal] = useState(false);
  const [showUnbookModal, setShowUnbookModal] = useState(false);
  const [unbookReason, setUnbookReason] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [editData, setEditData] = useState({ date: slot.date || '', time: displayTime, capacity: safeCapacity, role: slot.role, compensation: slot.compensation });

  const isFull = safeBookingsLength >= safeCapacity;
  const isAvailable = !isFull && slot.status === 'active';
  const isBooked = selectedUserId ? safeBookings.some(b => b.user_id === selectedUserId) : false;
  
  const isCritical = slot.isCritical === true;

  const free = Math.max(0, safeCapacity - safeBookingsLength);
  let capacityText = "";
  if (free === 0) {
    capacityText = "Ausgebucht";
  } else if (free === 1) {
    capacityText = "Noch 1 Platz frei";
  } else {
    capacityText = `Noch ${free} Plätze frei`;
  }

  const now = new Date();
  const cleanNow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    now.getMinutes()
  );

  const [h, m] = (slot.start_time || "00:00").split(":").map(Number);
  const [y, mo, d] = (slot.date || "1970-01-01").split("-").map(Number);
  const slotTime = new Date(y, mo - 1, d, h, m);
  const isPast = slotTime < cleanNow;


  if (isEditing) {
    console.log("RENDER SAVE BUTTON");
    return (
      <div className={`slot-card edit-mode ${compact ? 'compact' : ''}`} id={`slot-${slot.id}`} style={{ padding: '20px' }}>
        <div className="admin-form" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.2rem', alignItems: 'stretch' }}>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div className="fab-input-group">
              <span className="fab-label">Datum:</span>
              <input type="date" value={editData.date} onChange={e => setEditData({...editData, date: e.target.value})} required className="input-admin" />
            </div>
            
            <div className="fab-input-group">
              <span className="fab-label">Zeitraum:</span>
              <input type="text" value={editData.time} onChange={e => setEditData({...editData, time: e.target.value})} required className="input-admin" style={{width: '120px'}} />
            </div>

            <div className="fab-input-group">
              <span className="fab-label">Kapazität:</span>
              <input type="number" value={editData.capacity} onChange={e => setEditData({...editData, capacity: e.target.value})} min={safeBookingsLength || 1} required className="input-admin input-admin-num" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="fab-input-group">
              <span className="fab-label">Rolle:</span>
              <select value={editData.role} onChange={e => {
                console.log("ROLE SELECTED:", e.target.value);
                setEditData({...editData, role: e.target.value});
              }} required className="input-admin">
                 <option value="multiskill">Multiskill</option>
                 <option value="email">E-Mail</option>
                 <option value="telefonie">Telefonie</option>
                 <option value="chat">Chat</option>
              </select>
            </div>

            <div className="fab-input-group">
              <span className="fab-label">Vergütung:</span>
              <select value={editData.compensation} onChange={e => {
                console.log("COMPENSATION SELECTED:", e.target.value);
                setEditData({...editData, compensation: e.target.value});
              }} required className="input-admin">
                 <option value="standard">Standard</option>
                 <option value="special">Sondervergütung</option>
              </select>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.8rem', marginTop: '0.5rem' }}>
              <button 
                type="button" 
                className="btn btn-primary btn-sm" 
                title="Änderungen speichern"
                onClick={() => {
                  if (typeof updateSlot === 'function') {
                    updateSlot(slot.id, { ...editData });
                  } else if (typeof onEdit === 'function') {
                    onEdit(slot.id, { ...editData });
                  }
                  setIsEditing(false);
                }}
              >
                Änderungen übernehmen
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsEditing(false)} title="Abbrechen">X</button>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <>
      <div 
        id={`slot-${slot.id}`} 
        className={`slot-card ${compact ? 'compact' : ''} ${isPast ? 'past-slot' : ''} ${isCritical ? 'card-critical' : ''} ${isSelected ? 'selected' : ''} ${isBooked ? 'booked' : ''}`}
        onClick={(e) => {
          if (['BUTTON', 'INPUT', 'LABEL', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
          onToggleSelect();
        }}
        style={{ 
          cursor: 'pointer', 
          padding: '16px', 
          position: 'relative',
          opacity: isPast ? 0.5 : 1,
          backgroundColor: isPast ? "#2a2a2a" : "",
          border: isPast ? "1px solid #555" : ""
        }}
      >
        {isPast && (
          <div style={{ position: 'absolute', top: '8px', right: '8px', fontSize: "12px", color: "#aaa" }}>
            Vergangen
          </div>
        )}
        
        {isSelected && <div className="check-abs">✔</div>}

        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <div className="slot-header">
            <span className="time">
              {displayTime}
            </span>
            <div className="slot-right">
              <span className="slot-availability" style={{ fontWeight: free <= 2 ? 600 : 500 }}>
                {capacityText}
              </span>
              {isBooked && (
                <span className="slot-booked">✔ Eingetragen</span>
              )}
            </div>
          </div>

          {(() => {
            const roleLabel = ROLE_LABELS[slot.role] || slot.role || "FEHLT ROLE";
            const compLabel = COMP_LABELS[slot.compensation] || slot.compensation || "FEHLT COMP";
            return (
              <div className="slot-meta">
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div className="slot-label role">{roleLabel}</div>
                  {isCritical && <div className="slot-label" style={{ color: 'var(--danger-color)' }}>Kritisch</div>}
                  {isFull && <div className="slot-label" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5' }}>Voll</div>}
                </div>
                <div className="slot-label comp">{compLabel}</div>
              </div>
            );
          })()}


          {isAdmin && safeBookingsLength > 0 && (
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '8px' }}>
              {safeBookings.map(b => b.name || 'Unbekannt').join(', ')}
            </div>
          )}

          {isAdmin && !isPast && (
            <div className="slot-admin-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '12px', color: 'var(--danger-color)', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={isCritical} 
                    onChange={(e) => onEdit(slot.id, { isCritical: e.target.checked })} 
                    onClick={e => e.stopPropagation()}
                  /> 
                  Kritisch
                </label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} style={{ fontSize: '14px' }}>✏️</button>
                  {!isFull && <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setShowModal(true); }} style={{ fontSize: '14px' }}>📣</button>}
                  <button className="btn-icon" onClick={(e) => { e.stopPropagation(); if (window.confirm('Slot löschen?')) onDelete(slot.id); }} style={{ fontSize: '14px' }}>🗑️</button>
                </div>
            </div>
          )}
        </div>
      </div>
      {showModal && <NotificationModal slot={slot} onClose={() => setShowModal(false)} />}
      
      {showUnbookModal && (
        <div className="modal-overlay" onClick={(e) => { e.stopPropagation(); setShowUnbookModal(false); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Bitte Grund für Austragung angeben</h2>
              <button className="btn-close" onClick={() => setShowUnbookModal(false)}>✖</button>
            </div>
            <div className="modal-body" style={{ marginTop: '1rem' }}>
              <textarea 
                value={unbookReason} 
                onChange={e => setUnbookReason(e.target.value)} 
                rows={4} 
                placeholder="Grund (z. B. Krankheit, anderer Termin...)"
                style={{width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '1rem', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setShowUnbookModal(false)}>Abbrechen</button>
                <button className="btn btn-danger" onClick={() => {
                   if(!unbookReason.trim()) { alert('Der Input darf NICHT leer sein!'); return; }
                   unbookSlot(slot.id, selectedUserId, unbookReason.trim());
                   setShowUnbookModal(false);
                   setUnbookReason('');
                   showToast("Slot erfolgreich ausgetragen");
                }}>Austragen bestätigen</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
