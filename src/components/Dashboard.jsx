import React from 'react';

export function Dashboard({ scopedSlots, filter, setFilter, isAdmin, selectedUserId }) {
  const now = new Date();

  // ONLY count future slots for actionable stats
  const futureSlots = (scopedSlots || []).filter(slot => {
    if (!slot.date || !slot.start_time) return false;
    const slotDateTime = new Date(`${slot.date}T${slot.start_time}`);
    return slotDateTime >= now;
  });

  const open = futureSlots.filter(slot => {
    const caps = slot.capacity || 0;
    const booked = slot.bookings?.length || 0;
    return (caps - booked > 0) && (!selectedUserId || !slot.bookings?.some(b => b.user_id === selectedUserId));
  }).length;

  const mine = futureSlots.filter(slot => {
    return selectedUserId ? slot.bookings?.some(b => b.user_id === selectedUserId) : false;
  }).length;
  
  const pastCount = (scopedSlots || []).filter(slot => {
    if (!slot.date || !slot.start_time) return false;
    const slotDateTime = new Date(`${slot.date}T${slot.start_time}`);
    return slotDateTime < now;
  }).length;

  const critical = futureSlots.filter(slot => {
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
