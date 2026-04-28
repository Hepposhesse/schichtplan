import React, { useState } from 'react';

export function AdminForm({ onAdd, conflictError, currentDate }) {
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [capacity, setCapacity] = useState(1);
  const [role, setRole] = useState('multiskill');
  const [compensation, setCompensation] = useState('standard');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    setIsSubmitting(true);
    setSuccessMessage("");

    if (!onAdd) {
      console.log("onAdd fehlt!");
      setIsSubmitting(false);
      return;
    }

    const result = await onAdd(currentDate, startTime, endTime, capacity, role, compensation);

    setIsSubmitting(false);

    if (result && result.success) {
      setSuccessMessage("Slots erfolgreich erstellt");
      
      setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
    }
  };

  return (
    <div className="admin-box">
      <h3>Neuen Zeitraum erstellen</h3>
      <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem'}}>
        Es werden automatisch 1-Stunden-Slots für den konfigurierten Zeitraum generiert.
      </p>
      {conflictError && <div className="error-banner">Fehler: Konflikt erkannt.</div>}
      {successMessage && (
        <div style={{ padding: '0.8rem', marginBottom: '1rem', background: 'rgba(34, 197, 94, 0.2)', border: '1px solid rgba(34, 197, 94, 0.5)', color: '#4ade80', borderRadius: '8px', textAlign: 'center' }}>
          {successMessage}
        </div>
      )}
      <form className="admin-form" onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>
          Ausgewählter Tag: {currentDate}
        </div>
        <input 
          type="time" 
          value={startTime} 
          onChange={e => setStartTime(e.target.value)} 
          required 
          className="input-admin"
          title="Startzeit"
        />
        <input 
          type="time" 
          value={endTime} 
          onChange={e => setEndTime(e.target.value)} 
          required 
          className="input-admin"
          title="Endzeit"
        />
        <input 
          type="number" 
          value={capacity} 
          onChange={e => setCapacity(Number(e.target.value))} 
          min="1" 
          required 
          className="input-admin input-admin-num"
          title="Mitarbeiter pro Stunde"
        />
        <select 
          value={role} 
          onChange={e => {
            console.log("ROLE SELECTED:", e.target.value);
            setRole(e.target.value);
          }}
          className="input-admin"
          title="Rolle für diesen Zeitraum"
        >
          <option value="multiskill">Multiskill</option>
          <option value="email">E-Mail</option>
          <option value="telefonie">Telefonie</option>
          <option value="chat">Chat</option>
        </select>
        <select 
          value={compensation} 
          onChange={e => {
            console.log("COMPENSATION SELECTED:", e.target.value);
            setCompensation(e.target.value);
          }}
          className="input-admin"
          title="Vergütung"
        >
          <option value="standard">Standard</option>
          <option value="special">Sondervergütung</option>
        </select>
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Erstelle..." : "Slots generieren"}
        </button>
      </form>
    </div>
  );
}
