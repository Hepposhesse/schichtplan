import React from 'react';

export function Dashboard({ scopedSlots, filter, setFilter, isAdmin, selectedUserId }) {
  const open = (scopedSlots || []).filter(slot => {
    if (isAdmin && slot.isPastSlot) return false;
    const caps = slot.capacity || 0;
    const booked = slot.bookings?.length || 0;
    return (caps - booked > 0) && (!selectedUserId || !slot.bookings?.some(b => b.user_id === selectedUserId));
  }).length;

  const mine = (scopedSlots || []).filter(slot => {
    return selectedUserId ? slot.bookings?.some(b => b.user_id === selectedUserId) : false;
  }).length;
  
  const pastCount = (scopedSlots || []).filter(slot => slot.isPastSlot).length;

  const critical = (scopedSlots || []).filter(slot => {
    if (isAdmin && slot.isPastSlot) {
      return slot.isCritical === true; 
    }
    const caps = slot.capacity || 0;
    const booked = slot.bookings?.length || 0;
    const isBookedByMe = selectedUserId ? slot.bookings?.some(b => b.user_id === selectedUserId) : false;
    return slot.isCritical === true && (caps - booked > 0) && !isBookedByMe;
  }).length;

  return (
    <div className="stats-grid">
      <div className={`stat-card stat-open ${filter === 'open' ? 'active-filter' : ''}`} onClick={() => setFilter('open')}>
        <span className="stat-value">{open}</span>
        <span className="stat-label">Offene Slots</span>
      </div>
      <div className={`stat-card stat-critical ${filter === 'critical' ? 'active-filter' : ''}`} onClick={() => setFilter('critical')}>
        <span className="stat-value">{critical}</span>
        <span className="stat-label">Kritische Slots</span>
      </div>
      {isAdmin ? (
        <div className={`stat-card full stat-full ${filter === 'past' ? 'active-filter' : ''}`} onClick={() => setFilter('past')}>
          <span className="stat-value">{pastCount}</span>
          <span className="stat-label">Vergangene Slots</span>
        </div>
      ) : (
        <div className={`stat-card full stat-full ${filter === 'mine' ? 'active-filter' : ''}`} onClick={() => setFilter('mine')}>
          <span className="stat-value">{mine}</span>
          <span className="stat-label">Meine Slots</span>
        </div>
      )}
    </div>
  );
}
