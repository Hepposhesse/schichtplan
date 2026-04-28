import React from 'react';
import { SlotCard } from './SlotCard';

export const getWeekDates = (dateStr) => {
  if (!dateStr) return [];
  const [y, m, d] = dateStr.split('-');
  const dateObj = new Date(y, m - 1, d);
  const day = dateObj.getDay();
  const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1); 
  const start = new Date(dateObj.setDate(diff));
  
  return Array.from({length: 7}, (_, i) => {
     const nd = new Date(start);
     nd.setDate(nd.getDate() + i);
     const outY = nd.getFullYear();
     const outM = String(nd.getMonth() + 1).padStart(2, '0');
     const outD = String(nd.getDate()).padStart(2, '0');
     return `${outY}-${outM}-${outD}`;
  });
};

export function SlotList({ scopedSlots, allSlots, currentDate, viewMode, onBook, onDelete, onEdit, globalSelection, toggleSelection, isAdmin, users, filter, selectedUserId, unbookSlot, showToast }) {
  if (allSlots.length === 0 || scopedSlots.length === 0 || (viewMode === 'day' && (!Array.isArray(scopedSlots) || scopedSlots.length === 0))) {
    return (
      <div className="empty-state">
        <p>Keine Schichten gefunden.</p>
        <p className="hint">
          Ändere den Filter oder wähle ein anderes Datum.
        </p>
      </div>
    );
  }

  if (viewMode === 'day') {
    const safeScopedSlots = Array.isArray(scopedSlots) ? scopedSlots : [];
    
    return (
      <div className="slot-list">
        {safeScopedSlots.map(slot => {
          if (!slot || !slot.id) return null;
          return (
            <SlotCard 
              key={slot.id} 
              slot={slot} 
              onBook={onBook} 
              onDelete={onDelete} 
              onEdit={onEdit}
              updateSlot={onEdit}
              isSelected={globalSelection.includes(slot.id)}
              onToggleSelect={() => toggleSelection(slot.id)}
              isAdmin={isAdmin}
              users={users}
              filter={filter}
              selectedUserId={selectedUserId}
              unbookSlot={unbookSlot}
              showToast={showToast}
            />
          );
        })}
      </div>
    );
  }

  if (viewMode === 'week') {
    const weekDates = getWeekDates(currentDate);
    const safeWeekDates = Array.isArray(weekDates) ? weekDates : [];
    
    const formatDay = (dStr) => {
      if (!dStr) return '';
      const [y, m, d] = dStr.split('-');
      return new Date(y, m - 1, d).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
    };
    
    const slotsByDay = {};
    safeWeekDates.forEach(date => {
      slotsByDay[date] = [];
    });

    scopedSlots.forEach(slot => {
      if (slot && slotsByDay[slot.date]) {
        slotsByDay[slot.date].push(slot);
      }
    });
    
    return (
      <div className="week-grid">
        {safeWeekDates.map(date => {
          const daySlots = Array.isArray(slotsByDay?.[date]) ? slotsByDay[date] : [];
          
          if (daySlots.length === 0) return null;

          return (
            <div key={date} className="week-column">
              <h4 className="week-col-title">{formatDay(date)}</h4>
              {daySlots.length === 0 ? (
                <div style={{fontSize: '0.8rem', opacity: 0.5, textAlign: 'center', padding: '1rem 0'}}>Frei</div>
              ) : (
                <div className="slot-list">
                {daySlots.map(slot => {
                   if (!slot || !slot.id) return null;
                   return (
                     <SlotCard 
                       key={slot.id} 
                       slot={slot} 
                       onBook={onBook} 
                       onDelete={onDelete} 
                       onEdit={onEdit}
                       updateSlot={onEdit}
                       isSelected={globalSelection.includes(slot.id)}
                       onToggleSelect={() => toggleSelection(slot.id)}
                       compact={true}
                       isAdmin={isAdmin}
                       users={users}
                       filter={filter}
                       selectedUserId={selectedUserId}
                       unbookSlot={unbookSlot}
                       showToast={showToast}
                     />
                   );
                })}
              </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
  return null;
}
