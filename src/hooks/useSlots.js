import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../supabase';

const STORAGE_KEY = 'terminplaner_slots';
const USERS_KEY = 'terminplaner_users';
const INITIAL_SLOTS = [
  {
    id: uuidv4(),
    date: '2026-04-10',
    time: '08:00 - 12:00',
    capacity: 3,
    status: 'active',
    bookings: []
  },
  {
    id: uuidv4(),
    date: '2026-04-10',
    time: '12:00 - 16:00',
    capacity: 2,
    status: 'active',
    bookings: [
      { id: uuidv4(), slot_id: 'mock', name: 'Max Mustermann', createdAt: new Date().toISOString() }
    ]
  },
  {
    id: uuidv4(),
    date: '2026-04-11',
    time: '09:00 - 17:00',
    capacity: 1,
    status: 'active',
    bookings: [
      { id: uuidv4(), slot_id: 'mock2', name: 'Anna Schmidt', createdAt: new Date().toISOString() }
    ]
  }
];

export function useSlots() {
  const [slots, setSlots] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) || [];
        return parsed.map(slot => {
          const mapped = {
            ...slot,
            role: slot.role,
            compensation: slot.compensation
          };
          console.log("PIPELINE SLOT:", mapped);
          return mapped;
        });
      } catch (e) {
        return [];
      }
    }
    return INITIAL_SLOTS.map(slot => {
      const mapped = {
        ...slot,
        role: slot.role,
        compensation: slot.compensation
      };
      console.log("PIPELINE SLOT:", mapped);
      return mapped;
    });
  });

  const [isAdmin, setIsAdmin] = useState(false);
  
  const DEFAULT_PASSWORD = "admin123";
  const [adminPassword, setAdminPassword] = useState(() => {
    const savedPwd = localStorage.getItem('terminplaner_pwd');
    if (savedPwd) return savedPwd;
    
    // Initial Setup: Speichere das Default-Passwort hart in den LocalStorage
    localStorage.setItem('terminplaner_pwd', DEFAULT_PASSWORD);
    return DEFAULT_PASSWORD;
  });

  const login = (pwd) => {
    if (pwd === adminPassword) {
      setIsAdmin(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAdmin(false);
  };

  const changePassword = (currentPwd, newPwd) => {
    if (!isAdmin) return false;
    if (currentPwd !== adminPassword) return false;
    
    setAdminPassword(newPwd);
    localStorage.setItem('terminplaner_pwd', newPwd);
    return true;
  };

  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem(USERS_KEY);
    if (saved) return JSON.parse(saved);
    return [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
  }, [slots]);

  useEffect(() => {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }, [users]);

  const addUser = (name) => {
    if (!isAdmin) return false;
    const trimmed = name.trim();
    if (!trimmed) return false;
    
    const exists = users.some(u => u.name.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
       alert("Ein User mit diesem Namen existiert bereits!");
       return false;
    }
    
    setUsers(prev => [...prev, { id: uuidv4(), name: trimmed }]);
    
    (async () => {
      try {
        const organization_id = "00000000-0000-0000-0000-000000000001";
        console.log("organization_id", organization_id);
        const { error } = await supabase.from("users").insert({
          organization_id: organization_id,
          name: trimmed,
          role: "user"
        });
        if (error) throw error;
      } catch (error) {
        console.error("Supabase Write Fehler", error);
      }
    })();

    return true;
  };

  const deleteUser = (userId) => {
    if (!isAdmin) return;
    setUsers(prev => prev.filter(u => u.id !== userId));
  };

  const bookSlot = (slotId, userId, employeeName) => {
    let success = false;
    const newSlots = slots.map(slot => {
      if (slot.id === slotId) {
        const safeBookings = slot.bookings || [];
        const alreadyBooked = safeBookings.some(b => b.user_id === userId);
        if (!alreadyBooked && safeBookings.length < slot.capacity && slot.status === 'active') {
          success = true;
          
          (async () => {
            try {
              const { error } = await supabase.from("bookings").insert({
                slot_id: slotId,
                user_id: userId
              });
              if (error) throw error;
              window.dispatchEvent(new Event("slots_updated"));
            } catch (error) {
              console.error("Supabase Write Fehler", error);
            }
          })();

          return {
            ...slot,
            bookings: [
              ...safeBookings,
              { user_id: userId, slot_id: slotId, name: employeeName, createdAt: new Date().toISOString() }
            ]
          };
        }
      }
      return slot;
    });

    if (success) setSlots(newSlots);
    return success;
  };

  const bookMultipleSlots = (slotIds, userId, employeeName) => {
    let bookedCount = 0;
    const newSlots = slots.map(slot => {
      if (slotIds.includes(slot.id)) {
        const safeBookings = slot.bookings || [];
        const alreadyBooked = safeBookings.some(b => b.id === userId);
        if (!alreadyBooked && safeBookings.length < slot.capacity && slot.status === 'active') {
          bookedCount++;
          
          (async () => {
            try {
              const { error } = await supabase.from("bookings").insert({
                slot_id: slot.id,
                user_id: userId
              });
              if (error) throw error;
              window.dispatchEvent(new Event("slots_updated"));
            } catch (error) {
              console.error("Supabase Write Fehler", error);
            }
          })();

          return {
            ...slot,
            bookings: [
              ...safeBookings,
              { id: userId, slot_id: slot.id, name: employeeName, createdAt: new Date().toISOString() }
            ]
          };
        }
      }
      return slot;
    });

    if (bookedCount > 0) setSlots(newSlots);
    return bookedCount > 0;
  };

  const unbookSlot = (slotId, userId, reason) => {
    setSlots(currentSlots => currentSlots.map(slot => {
      if (slot.id === slotId) {
        const safeBookings = slot.bookings || [];
        const isBooked = safeBookings.some(b => b.id === userId);
        if (isBooked) {
          
          (async () => {
            try {
              const { error } = await supabase
                .from("bookings")
                .delete()
                .match({ slot_id: slotId, user_id: userId });
              if (error) throw error;
              window.dispatchEvent(new Event("slots_updated"));
            } catch (error) {
              console.error("Supabase Write Fehler", error);
            }
          })();

          const newBookings = safeBookings.filter(b => b.id !== userId);
          const newCancellations = [
            ...(slot.cancellations || []),
            { userId, reason, timestamp: new Date().toISOString() }
          ];
          return { ...slot, bookings: newBookings, cancellations: newCancellations };
        }
      }
      return slot;
    }));
  };

  const unbookMultipleSlots = (slotIds, userId, reason) => {
    setSlots(currentSlots => currentSlots.map(slot => {
      if (slotIds.includes(slot.id)) {
        const safeBookings = slot.bookings || [];
        const isBooked = safeBookings.some(b => b.id === userId);
        if (isBooked) {

          (async () => {
            try {
              const { error } = await supabase
                .from("bookings")
                .delete()
                .match({ slot_id: slot.id, user_id: userId });
              if (error) throw error;
              window.dispatchEvent(new Event("slots_updated"));
            } catch (error) {
              console.error("Supabase Write Fehler", error);
            }
          })();

          const newBookings = safeBookings.filter(b => b.id !== userId);
          const newCancellations = [
            ...(slot.cancellations || []),
            { userId, reason, timestamp: new Date().toISOString() }
          ];
          return { ...slot, bookings: newBookings, cancellations: newCancellations };
        }
      }
      return slot;
    }));
  };


  const addSlot = async (date, startTime, endTime, capacity, role, compensation) => {
    console.log("CREATE SLOT CALLED");
    console.log("INPUT DATA:", { date, startTime, endTime, capacity, role, compensation });
    if (!isAdmin) return { success: false, error: 'Unauthorized' };

    const organization_id = "00000000-0000-0000-0000-000000000001";
    const newSlotId = uuidv4();

    const slotData = {
      id: newSlotId,
      organization_id: organization_id,
      date: date || "",
      start_time: startTime,
      end_time: endTime,
      capacity: Number(capacity) || 1,
      is_critical: false,
      role: role,
      compensation: compensation
    };

    try {
      console.log("SAVING SLOT:", { role, compensation });
      const { data, error } = await supabase.from("slots").insert([{
        id: slotData.id,
        organization_id: slotData.organization_id,
        date: slotData.date,
        start_time: slotData.start_time,
        end_time: slotData.end_time,
        capacity: slotData.capacity,
        is_critical: slotData.is_critical,
        role: slotData.role,
        compensation: slotData.compensation
      }]).select("id, organization_id, date, start_time, end_time, capacity, is_critical, role, compensation");

      console.log("INSERT RESULT:", data);
      console.log("INSERT ERROR:", error);

      if (error) {
        return { success: false, error };
      }

      console.log("INSERT SUCCESS");
      window.dispatchEvent(new Event("slots_updated"));

      setSlots(current => {
        const exists = current.find(s => s.date === date && s.start_time === startTime && s.end_time === endTime);
        if (!exists) {
          return [...current, {
            ...slotData,
            time: `${startTime} - ${endTime}`,
            status: 'active',
            isCritical: false,
            bookings: []
          }];
        }
        return current;
      });

      return { success: true };
    } catch (error) {
      console.error("Supabase Write Fehler", error);
      return { success: false, error };
    }
  };

  const deleteSlot = (slotId) => {
    if (!isAdmin) return;
    setSlots(current => current.filter(s => s.id !== slotId));
  };

  const deleteMultipleSlots = (slotIds) => {
    if (!isAdmin) return;
    setSlots(current => current.filter(s => !slotIds.includes(s.id)));
  };

  const editSlot = async (slotId, updates) => {
    console.log("UPDATE FUNCTION ENTERED");
    
    try {
      let start_time, end_time;
      if (updates.time) {
        start_time = updates.time.split(" - ")[0];
        end_time = updates.time.split(" - ")[1];
      }

      console.log("UPDATE INPUT RAW:", {
        slotId,
        start_time,
        end_time,
        date: updates.date,
        capacity: updates.capacity,
        role: updates.role,
        compensation: updates.compensation
      });

      const payload = {
        start_time,
        end_time,
        date: updates.date,
        capacity: updates.capacity,
        role: updates.role,
        compensation: updates.compensation
      };

      if (updates.isCritical !== undefined) {
        payload.is_critical = updates.isCritical;
      }

      console.log("UPDATE PAYLOAD FINAL:", payload);

      console.log("UPDATE SLOT ID:", slotId);
      const targetSlot = slots.find(s => s.id === slotId);
      console.log("SLOT OBJECT ID:", targetSlot?.id);

      const updateId = targetSlot?.id || slotId;

      const { data, error } = await supabase
        .from("slots")
        .update(payload)
        .eq("id", updateId)
        .select();

      console.log("UPDATE RESULT:", { data, error });

      if (error) {
        console.error("Supabase Update Fehler:", error);
        return;
      }
    } catch (err) {
      console.error("Update Crash:", err);
      return;
    }

    setSlots(current => current.map(s => s.id === slotId ? { ...s, ...updates } : s));
    window.dispatchEvent(new Event("slots_updated"));
  };

  const updateMultipleCapacities = (slotIds, newCapacity) => {
    if (!isAdmin) return;
    const numCap = parseInt(newCapacity, 10);
    if(isNaN(numCap) || numCap < 1) return;
    setSlots(current => current.map(s => {
      if (slotIds.includes(s.id)) {
        const safeCap = Math.max(s.bookings.length, numCap);
        return { ...s, capacity: safeCap };
      }
      return s;
    }));
  };

  const updateMultipleRoles = (slotIds, newRole) => {
    if (!isAdmin) return;
    setSlots(current => current.map(s => {
      if (slotIds.includes(s.id)) {
        return { ...s, role: newRole };
      }
      return s;
    }));
  };

  const updateMultipleCompensations = (slotIds, newComp) => {
    if (!isAdmin) return;
    setSlots(current => current.map(s => {
      if (slotIds.includes(s.id)) {
        return { ...s, compensation: newComp };
      }
      return s;
    }));
  };

  const updateMultipleSlotData = (slotIds, payload) => {
    if (!isAdmin) return;
    setSlots(current => current.map(s => {
      if (slotIds.includes(s.id)) {
        return { ...s, ...payload };
      }
      return s;
    }));
  };

  // Sort slots by Date and Time ascending automatically
  const sortedSlots = [...slots].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    return a.time.localeCompare(b.time);
  });

  return { slots: sortedSlots, users, isAdmin, login, logout, changePassword, bookSlot, bookMultipleSlots, unbookSlot, unbookMultipleSlots, addSlot, deleteSlot, deleteMultipleSlots, editSlot, updateMultipleCapacities, updateMultipleRoles, updateMultipleCompensations, updateMultipleSlotData, addUser, deleteUser };
}
