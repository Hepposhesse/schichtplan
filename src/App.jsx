import { supabase } from './supabase';
import { LOGIN_PASSWORD } from './config/auth';
import { useSlots } from './hooks/useSlots';
import { SlotList, getWeekDates } from './components/SlotList';
import { AdminForm } from './components/AdminForm';
import { Dashboard } from './components/Dashboard';
import { useState, useRef, useEffect, Component } from 'react';
import { createPortal } from 'react-dom';
import './index.css';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Crash intercepted:", error);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding: '2rem', textAlign: 'center', color: 'var(--danger-color)', border: '2px solid red', margin: '1rem'}}>
          <h3>Fehler beim Laden der Slots</h3>
          <p style={{fontWeight: 'bold'}}>{this.state.error && this.state.error.message}</p>
          <pre style={{textAlign: 'left', background: '#333', color: '#fff', padding: '1rem', overflowX: 'auto'}}>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}


function App() {
  const { slots: localSlots, users: localUsers, isAdmin, login, logout, changePassword, bookSlot, bookMultipleSlots, unbookSlot, unbookMultipleSlots, addSlot, deleteSlot, deleteMultipleSlots, editSlot, updateMultipleCapacities, updateMultipleRoles, updateMultipleCompensations, updateMultipleSlotData, addUser, deleteUser } = useSlots();
  
  const [supabaseSlots, setSupabaseSlots] = useState([]);
  const [supabaseUsers, setSupabaseUsers] = useState([]);
  const [showPastSlots, setShowPastSlots] = useState(false);

  const [currentDate, setCurrentDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // Authentication State
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("auth");
    if (saved === "true") setAuthorized(true);
  }, []);

  const handleAuthLogin = () => {
    const input = prompt("Passwort:");
    if (input === LOGIN_PASSWORD) {
      localStorage.setItem("auth", "true");
      setAuthorized(true);
    } else {
      alert("Falsch");
    }
  };

  const slots = supabaseSlots;
  const users = supabaseUsers;

  console.log("SLOTS RAW:", slots);

  const getWeekRange = (selectedDate) => {
    const date = new Date(selectedDate);
    const day = date.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;

    const monday = new Date(date);
    monday.setDate(date.getDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const start = monday.toISOString().slice(0, 10);
    const end = sunday.toISOString().slice(0, 10);

    console.log("WEEK RANGE:", { start, end });

    return { start, end };
  };

  const fetchSlots = async (start = null, end = null) => {
    try {
      let startDate = start;
      let endDate = end;
      
      if (!startDate || !endDate) {
        const range = getWeekRange(currentDate);
        startDate = range.start;
        endDate = range.end;
      }

      const formatDate = (d) => {
        return new Date(d).toISOString().slice(0, 10);
      };

      startDate = formatDate(startDate);
      endDate = formatDate(endDate);

      console.log("FETCH RANGE:", { startDate, endDate });

      const { data, error } = await supabase
        .from("slots")
        .select("id, organization_id, date, start_time, end_time, capacity, is_critical, role, compensation")
        .gte("date", startDate)
        .lte("date", endDate);

      console.log("FETCH RESULT:", data);

      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select("slot_id, user_id");

      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, name");

      console.log("RAW SLOTS FROM SUPABASE:", data);
      console.log("RAW BOOKINGS:", bookingsData);

      if (error || bookingsError || usersError) {
        console.error("Supabase Fehler Slots/Bookings/Users", error || bookingsError || usersError);
        return;
      }

      const usersMap = Object.fromEntries(
        (usersData || []).map(u => [u.id, u.name])
      );

      const formattedSlots = (data || []).map(slot => {
        const slotBookings = (bookingsData || []).filter(b => b.slot_id === slot.id).map(b => ({
          ...b,
          name: usersMap[b.user_id] || "Unbekannt"
        }));

        const mapped = {
          ...slot,
          time: slot.time ?? `${slot.start_time} - ${slot.end_time}`,
          status: 'active',
          bookings: slotBookings,
          date: slot.date?.slice(0, 10),
          role: slot.role ?? null,
          compensation: slot.compensation ?? null
        };
        
        console.log("SLOT BOOKINGS COUNT:", {
          slotId: mapped.id,
          bookings: mapped.bookings.length,
          capacity: mapped.capacity
        });
        
        console.log("FINAL SLOT OBJECT:", mapped);
        return mapped;
      });

      console.log("FORMATTED SLOTS:", formattedSlots);
      console.log("SUPABASE SLOTS FINAL:", formattedSlots);
      setSupabaseSlots(formattedSlots);

    } catch (err) {
      console.error("Fetch Slots Crash", err);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data: usersData, error: usersError } = await supabase.from('users').select('*');
      if (usersError) {
        console.error("Supabase Fehler beim Laden der Users", usersError);
      } else {
        console.log("Supabase verbunden (Users)");
        setSupabaseUsers(usersData || []);
      }
    } catch (err) {
      console.error("Fetch Users Crash", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!currentDate) return;
    const { start, end } = getWeekRange(currentDate);
    fetchSlots(start, end);
  }, [currentDate]);

  useEffect(() => {
    const handler = () => {
      console.log("REFETCH TRIGGERED");
      const { start, end } = getWeekRange(currentDate);
      fetchSlots(start, end);
    };

    window.addEventListener("slots_updated", handler);
    return () => window.removeEventListener("slots_updated", handler);
  }, [currentDate]);

  useEffect(() => {
    console.log("Datenquelle Slots:", supabaseSlots.length > 0 ? "Supabase" : "Local");
    console.log("Datenquelle Users:", supabaseUsers.length > 0 ? "Supabase" : "Local");
  }, [supabaseSlots, supabaseUsers]);

  const [isLoaded, setIsLoaded] = useState(false);
  const [filter, setFilter] = useState('open');
  const [viewMode, setViewMode] = useState('week');
  const [adminTab, setAdminTab] = useState('slots');
  const formatDate = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const formatDateDE = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  const formatDisplayDate = (dateString) => {
    if (!dateString) return "";
    const [year, month, day] = dateString.slice(0, 10).split("-");
    return `${day}.${month}`;
  };

  const getDateStripDays = (baseDate) => {
    const base = new Date(baseDate);

    return Array.from({ length: 21 }).map((_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i - 10);

      return {
        label: d.toLocaleDateString("de-DE", { weekday: "short" }),
        date: d.toISOString().split("T")[0],
        day: d.getDate()
      };
    });
  };

  const dateStripDays = getDateStripDays(currentDate || new Date().toISOString().slice(0, 10));
  const [showFilterModal, setShowFilterModal] = useState(false);

  const [globalSelection, setGlobalSelection] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [batchCapacity, setBatchCapacity] = useState(1);
  const [batchRole, setBatchRole] = useState('multiskill');
  const [batchCompensation, setBatchCompensation] = useState('standard');

  useEffect(() => {
    const storedUser = localStorage.getItem('terminplaner_selected_user');
    if (storedUser && users.some(u => u.id === storedUser)) {
      setSelectedUserId(storedUser);
    } else {
      setSelectedUserId("");
    }
  }, [users]);



  const [newUserName, setNewUserName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  
  const [showBatchUnbookModal, setShowBatchUnbookModal] = useState(false);
  const [batchUnbookReason, setBatchUnbookReason] = useState('');

  const [appToast, setAppToast] = useState(null);
  const showToast = (message, isError = false) => {
    setAppToast({ message, isError });
    setTimeout(() => setAppToast(null), 2500);
  };

  const filterFirstRender = useRef(true);
  const listRef = useRef(null);
  const slotsRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 150);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const centerActive = () => {
      const active = document.querySelector(".week-nav .active-day");
      if (active) {
        active.scrollIntoView({
          behavior: "auto",
          inline: "center",
          block: "nearest"
        });
      } else {
        setTimeout(centerActive, 50);
      }
    };
    centerActive();
  }, []);

  useEffect(() => {
    const active = document.querySelector(".week-nav .active-day");
    if (active) {
      active.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest"
      });
    }
  }, [currentDate]);
  useEffect(() => {
    const handleWheel = (e) => {
      const slots = slotsRef.current;
      if (!slots) return;

      // detect open dropdown
      const dropdown = document.querySelector('.custom-user-select-dropdown');

      if (dropdown) {
        const canScrollDropdown =
          dropdown.scrollHeight > dropdown.clientHeight;

        if (canScrollDropdown) {
          // check if mouse is inside dropdown
          const rect = dropdown.getBoundingClientRect();

          const isInside =
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom;

          if (isInside) {
            // allow native dropdown scroll
            return;
          }
        }
      }

      // fallback → scroll slots container
      const canScrollSlots =
        slots.scrollHeight > slots.clientHeight;

      if (!canScrollSlots) return;

      e.preventDefault();
      slots.scrollTop += e.deltaY;
    };

    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleWheel);
    };
  }, []);




  // Temporary logging for bugfixing to see if slots are correctly evaluated
  /*
  useEffect(() => {
    console.log('--- SYSTEM STATE UPDATED ---');
    console.log('Total Slots in System:', slots.length, slots);
    console.log('Currently Scoped Slots (Date/Week):', scopedSlots.length, scopedSlots);
    console.log('Filtered Slots (Current View):', filteredSlots.length, filteredSlots);
  });
  */

  const handleLoginClick = () => {
    const pwd = window.prompt("Admin-Passwort eingeben:");
    if (pwd) {
      if (!login(pwd)) {
        alert("Falsches Passwort!");
      }
    }
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    
    const newPwdTrim = pwdNew.trim();
    const confirmTrim = pwdConfirm.trim();
    
    if (newPwdTrim !== confirmTrim) {
      alert("Passwörter stimmen nicht überein.");
      return;
    }

    const hasUpper = /[A-Z]/.test(newPwdTrim);
    const hasLower = /[a-z]/.test(newPwdTrim);
    const hasNum = /[0-9]/.test(newPwdTrim);
    const hasSpecial = /[^A-Za-z0-9]/.test(newPwdTrim);

    if (newPwdTrim.length < 10 || !hasUpper || !hasLower || !hasNum || !hasSpecial) {
      alert("Das Passwort erfüllt nicht die Anforderungen.\nBitte verwende mindestens 10 Zeichen sowie:\n- Groß- und Kleinbuchstaben\n- mindestens eine Zahl\n- mindestens ein Sonderzeichen");
      return;
    }

    const success = changePassword(pwdCurrent.trim(), newPwdTrim);
    if (success) {
      alert("Passwort erfolgreich geändert!");
      setPwdCurrent('');
      setPwdNew('');
      setPwdConfirm('');
    } else {
      alert("Fehler: Das aktuelle Passwort ist falsch.");
    }
  };

  const toggleSelection = (id) => {
    setGlobalSelection(prev => prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]);
  };

  const handleBatchBook = async () => {
    const user = users.find(u => u.id === selectedUserId);
    if (user && globalSelection.length > 0) {
      const selectedSlots = globalSelection.map(id => sortedSlots.find(s => s.id === id)).filter(Boolean);
      
      console.log("BOOKING VALIDATION DEBUG:",
        selectedSlots.map(slot => ({
          id: slot.id,
          capacity: slot.capacity,
          bookings: (slot.bookings || []).length
        }))
      );

      const isSlotFull = (slot) => {
        return (slot.bookings || []).length >= slot.capacity;
      };

      if (selectedSlots.some(slot => isSlotFull(slot))) {
        showToast("Ausgewählte Slots sind bereits voll oder nicht verfügbar.", true);
        return;
      }

      console.log("BOOKING START", { selectedSlots, selectedUser: user.id });

      const inserts = selectedSlots.map(slot => ({
        slot_id: slot.id,
        user_id: user.id
      }));

      console.log("BOOKING PAYLOAD:", inserts);

      const { data, error } = await supabase
        .from("bookings")
        .insert(inserts)
        .select();

      console.log("BOOKING RESULT:", { data, error });

      if (error) {
        console.error("BOOKING ERROR:", error);
        alert("Fehler beim Buchen: " + error.message);
        return;
      }

      if (!data || data.length === 0) {
        console.error("BOOKING FAILED: no rows inserted");
        alert("Buchung fehlgeschlagen.");
        return;
      }

      console.log("BOOKING SUCCESS");
      await fetchSlots();
      setGlobalSelection([]);
      showToast("Slots erfolgreich eingebucht!");
    }
  };

  const handleBatchUnbook = () => {
    setShowBatchUnbookModal(true);
  };

  const confirmBatchUnbook = () => {
    if (batchUnbookReason.trim() === '') {
      alert("Eine Begründung ist erforderlich!");
      return;
    }
    unbookMultipleSlots(globalSelection, selectedUserId, batchUnbookReason.trim());
    setGlobalSelection([]);
    setShowBatchUnbookModal(false);
    setBatchUnbookReason('');
    showToast("Erfolgreich ausgetragen");
  };

  const handleAddUser = (e) => {
    e.preventDefault();
    if (addUser(newUserName)) {
      setNewUserName('');
    }
  };

  const handleAddSlot = async (date, startTime, endTime, capacity, role, compensation) => {
    const slotsToInsert = [];

    let current = new Date(`${date}T${startTime}`);
    const endDate = new Date(`${date}T${endTime}`);

    while (current < endDate) {
      const next = new Date(current);
      next.setHours(current.getHours() + 1);

      slotsToInsert.push({
        date: date,
        start_time: current.toTimeString().slice(0, 5),
        end_time: next.toTimeString().slice(0, 5),
        capacity: capacity,
        role: role,
        compensation: compensation
      });

      current = next;
    }

    console.log("SAVING SLOT:", { role, compensation });
    const { data, error } = await supabase
      .from("slots")
      .insert(slotsToInsert)
      .select("id, organization_id, date, start_time, end_time, capacity, is_critical, role, compensation");

    if (error) {
      console.error("REAL INSERT ERROR:", error);
      alert(error.message || "Fehler beim Erstellen der Slots");
      return;
    }

    console.log("SLOT CREATE SUCCESS - no error:", error, data);
    await fetchSlots();
    setShowCreateModal(false);
    return { success: true };
  };

  const handleBatchDelete = async () => {
    if (window.confirm(`Möchtest du ${globalSelection.length} Slots wirklich löschen?`)) {
      const { error } = await supabase.from("slots").delete().in("id", globalSelection);
      if (error) {
        console.error(error);
        alert("Fehler beim Löschen der Slots");
      } else {
        fetchSlots();
      }
      setGlobalSelection([]);
    }
  };

  const handleSingleDelete = async (id) => {
    const { error } = await supabase.from("slots").delete().eq("id", id);
    if (error) {
      console.error(error);
      alert("Fehler beim Löschen des Slots");
    } else {
      fetchSlots();
    }
  };

  const handleBatchUpdate = () => {
    updateMultipleSlotData(globalSelection, {
       role: batchRole,
       compensation: batchCompensation,
       capacity: Number(batchCapacity)
    });
    setGlobalSelection([]);
  };

  const safeSlots = Array.isArray(slots) ? slots : [];

  const sortedSlots = [...safeSlots].sort((a, b) => {
    const [aH, aM] = (a.start_time || "00:00").split(":").map(Number);
    const [bH, bM] = (b.start_time || "00:00").split(":").map(Number);

    return (aH * 60 + aM) - (bH * 60 + bM);
  });

  console.log("SLOTS BEFORE FILTER:", slots);

  const selectedDate = currentDate?.slice(0, 10);

  console.log("FILTER DEBUG:", {
    selectedDate,
    slotDates: sortedSlots.map(s => s.date)
  });

  const now = new Date();
  const showPast = showPastSlots;

  console.log("ALL SLOTS BEFORE FILTER:", sortedSlots);

  const isBookedBySelectedUser = (slot) => {
    return slot.bookings?.some(b => b.user_id === selectedUserId);
  };

  const hasFreeCapacity = (slot) => {
    return (slot.bookings?.length || 0) < slot.capacity;
  };

  const { start, end } = getWeekRange(currentDate);

  const daySlotsUnfiltered = sortedSlots.filter(slot => {
    if (!slot.date) return false;
    return slot.date === currentDate?.slice(0, 10);
  });

  const weekSlotsUnfiltered = sortedSlots.filter(slot => {
    if (!slot.date) return false;
    return slot.date >= start && slot.date <= end;
  });

  const visibleSlotsUnfiltered = viewMode === "week" ? weekSlotsUnfiltered : daySlotsUnfiltered;

  const filteredSlots = visibleSlotsUnfiltered.filter(slot => {
    if (filter === "mine") {
      return isBookedBySelectedUser(slot);
    }
    
    if (filter === "open") {
      return hasFreeCapacity(slot) && !isBookedBySelectedUser(slot);
    }
    
    if (filter === "critical") {
      return slot.is_critical === true;
    }

    return true;
  });

  console.log("VIEW DEBUG:", {
    viewMode,
    daySlots: daySlotsUnfiltered.length,
    weekSlots: weekSlotsUnfiltered.length
  });

  const scopedAllSlots = filteredSlots;
  const daySlots = filteredSlots;

  const todayStr = formatDate(now);
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();

  const selectableSlots = daySlots;
  const selectableIds = selectableSlots.map(s => s.id);
  const isAllSelected = selectableIds.length > 0 && selectableIds.every(id => globalSelection.includes(id));
  const onlyPastVisible = false;

  const handleSelectAll = () => {
    if (isAllSelected) {
       setGlobalSelection(prev => prev.filter(id => !selectableIds.includes(id)));
    } else {
       setGlobalSelection(prev => [...new Set([...prev, ...selectableIds])]);
    }
  };

  console.log("ALL SLOTS:", slots);
  console.log("FILTERED SLOTS:", daySlots);
  console.log("SELECTED DATE:", currentDate);
  console.log("globalSelection:", globalSelection);

  const handleBatchAction = () => {
    console.log("BOOKING FUNCTION ENTERED");
    console.log("SELECTED SLOTS:", globalSelection);
    if (filter === "mine") {
      handleBatchUnbook();
    } else {
      handleBatchBook();
    }
  };

  const handleReset = () => {
    setCurrentDate(new Date().toISOString().slice(0, 10));
    setFilter("open");
    setShowPastSlots(false);
  };

  if (!isLoaded) {
    return (
      <div className="app-container">
        <header className="app-header">
          <h1>Schichtplanung</h1>
        </header>
        <div className="loading-spinner">Wird geladen...</div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <button className="primary-btn" onClick={handleAuthLogin} style={{ padding: '12px 24px', borderRadius: '12px', fontSize: '16px' }}>
          Zugang öffnen
        </button>
      </div>
    );
  }

  return (
    <>
    <div className="app-container">



      <div className="header sticky-header">
        <div className="header-container">
          <div className="container-header">
          {!isAdmin ? (
            <button className="btn btn-sm btn-secondary admin-button" onClick={handleLoginClick}>Admin-Modus</button>
          ) : (
            <button className="btn btn-sm btn-danger admin-button" onClick={logout}>Admin beenden</button>
          )}
          <h1 style={{ marginTop: 0 }}>Schichtplanung</h1>
          {!isAdmin && <p className="subtitle" style={{ margin: 0 }}>Trage dich für verfügbare Schichten ein.</p>}
        </div>
        
        <div className="employee-select-wrapper employee-box" style={{ background: 'var(--bg-surface)', border: '1px solid var(--primary-color)', display: 'inline-flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'flex-start', minWidth: '250px', maxWidth: '100%' }}>
          <span className="fab-label" style={{ color: 'var(--primary-color)' }}>Mitarbeiter auswählen:</span>
          {console.log("USERS ARRAY:", users)}
          <div className="custom-user-select-container" style={{ width: '100%' }}>
            <div
              className={`custom-user-select-trigger`}
              onClick={(e) => { 
                console.log("CLICK DROPDOWN TRIGGERED - Users:", users.length);
                e.stopPropagation();
                setIsUserDropdownOpen(prev => !prev); 
              }}
            >
              <div className="custom-user-select-value">
                {users.find(u => u.id === selectedUserId)?.name || "Bitte auswählen..."}
              </div>
              <span style={{ fontSize: '0.8rem' }}>{isUserDropdownOpen ? '▲' : '▼'}</span>
            </div>

            {isUserDropdownOpen && (
              <>
                <div className="custom-select-backdrop" onClick={() => setIsUserDropdownOpen(false)}></div>
                <div className="custom-user-select-dropdown">
                  {(() => {
                    const safeUsers = Array.isArray(users) ? users : [];
                    if (safeUsers.length === 0) {
                      return <div className="custom-user-select-option" style={{ fontStyle: 'italic', color: 'var(--text-secondary)', cursor: 'default' }} onClick={(e) => e.stopPropagation()}>Keine Nutzer vorhanden</div>;
                    }
                    return safeUsers.map(user => (
                      <div
                        key={user.id}
                        className={`custom-user-select-option ${user.id === selectedUserId ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedUserId(user.id);
                          localStorage.setItem('terminplaner_selected_user', user.id);
                          setIsUserDropdownOpen(false);
                        }}
                      >
                        {user.name}
                      </div>
                    ));
                  })()}
                </div>
              </>
            )}
          </div>
          {selectedUserId && (
            <span className="hint" style={{ marginTop: '0.25rem' }}>ℹ️ Du siehst nur verfügbare oder deine eigenen Schichten</span>
          )}
        </div>
        </div>
      </div>
      

        
        <div className="content-wrapper">
        {isAdmin && (
          <div className="display-row" style={{ marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
            <div className="left-controls">
              <button 
                className="btn btn-sm btn-primary" 
                onClick={() => setShowCreateModal(true)}
                style={{ marginRight: '12px' }}
              >
                Neu
              </button>
            </div>
            <div className="right-controls admin-tabs" style={{ overflowX: 'auto', flexWrap: 'wrap' }}>
              <button 
                onClick={() => setAdminTab('slots')} 
                className={`btn btn-sm ${adminTab === 'slots' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                📅 Slots
              </button>
              <button 
                onClick={() => setAdminTab('users')} 
                className={`btn btn-sm ${adminTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                👤 User
              </button>
              <button 
                onClick={() => setAdminTab('password')} 
                className={`btn btn-sm ${adminTab === 'password' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                🔒 Passwort
              </button>
            </div>
          </div>
        )}

        {/* --- TAB: PASSWORD --- */}
        {isAdmin && adminTab === 'password' && (
          <section className="admin-section">
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>Passwort ändern</h3>
            <div style={{ background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <form className="admin-form" style={{ alignItems: 'flex-start', flexDirection: 'column' }} onSubmit={handlePasswordChange}>
                <div className="fab-input-group">
                  <span className="fab-label">Aktuelles Passwort:</span>
                  <input type="password" value={pwdCurrent} onChange={e => setPwdCurrent(e.target.value)} required className="input-admin" />
                </div>
                <div className="fab-input-group">
                  <span className="fab-label">Neues Passwort ({'>'}10 Zeichen, Groß/Klein, Zahlen, Sonderzeichen):</span>
                  <input type="password" value={pwdNew} onChange={e => setPwdNew(e.target.value)} required className="input-admin" />
                </div>
                <div className="fab-input-group">
                  <span className="fab-label">Neues Passwort bestätigen:</span>
                  <input type="password" value={pwdConfirm} onChange={e => setPwdConfirm(e.target.value)} required className="input-admin" />
                </div>
                <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>Speichern</button>
              </form>
            </div>
          </section>
        )}

        {/* --- TAB: USER --- */}
        {isAdmin && adminTab === 'users' && (
          <section className="admin-section">
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>User verwalten</h3>
            <div style={{ background: 'var(--bg-surface)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <form className="admin-form" style={{ alignItems: 'flex-end', marginBottom: '2rem' }} onSubmit={handleAddUser}>
                <div className="fab-input-group">
                  <span className="fab-label">Neuer User Name:</span>
                  <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} required className="input-admin" style={{minWidth: '200px'}} />
                </div>
                <button type="submit" className="btn btn-primary">Hinzufügen</button>
              </form>
              
              <h4 style={{ margin: '0', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aktuelle Benutzer</h4>
              {users.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {users.map(u => (
                    <li key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontSize: '1rem', color: '#fff', fontWeight: '500' }}>{u.name}</span>
                      <button className="btn btn-danger btn-sm" onClick={async () => {
                        if(window.confirm(`User "${u.name}" wirklich entfernen?`)) {
                          const { error } = await supabase.from("users").delete().eq("id", u.id);
                          if (error) {
                            console.error(error);
                            alert("Fehler beim Löschen");
                          } else {
                            fetchUsers();
                          }
                        }
                      }}>🗑️ Entfernen</button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', fontStyle: 'italic', color: 'var(--text-secondary)' }}>Noch keine User angelegt.</div>
              )}
            </div>
          </section>
        )}
        </div>

        {/* --- IDENTITY RENDER GATE --- */}
        {!selectedUserId && !isAdmin ? (
          <div className="empty-state" style={{ marginTop: '2rem', padding: '3rem', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
             <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>Bitte wähle oben einen Mitarbeiter aus</h3>
             <p style={{color: 'var(--text-secondary)'}}>Um verfügbare Schichten zu sehen und dich einzutragen, musst du dich zunächst über das Dropdown identifizieren.</p>
          </div>
        ) : (
          <>
            {/* --- TAB: SLOTS (STANDARD) --- */}
            {(!isAdmin || adminTab === 'slots') && (
              <>
          {/* Dashboard und Toggles wurden in den Filter-Modal ausgelagert */}
          {console.log("COUNT SOURCE:", slots)}
          {console.log("RENDER SOURCE:", daySlots)}
            
        <div className="view-controls-column">
        <div className="week-header">
          <div className="week-nav">
            {dateStripDays.map((d) => (
              <button
                key={d.date}
                onClick={() => setCurrentDate(d.date)}
                className={`btn btn-sm ${currentDate === d.date ? "btn-primary active-day" : "btn-secondary"}`}
              >
                {formatDisplayDate(d.date)}
              </button>
            ))}
          </div>
        </div>

        <div ref={listRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          {isAdmin && daySlots.length > 0 && !onlyPastVisible && (
            <button 
              className={`btn btn-sm ${isAllSelected ? 'btn-secondary' : 'btn-primary'}`} 
              onClick={handleSelectAll}
            >
              {isAllSelected ? "Auswahl aufheben" : "Alle auswählen"}
            </button>
          )}
        </div>
      </div>



        {globalSelection.length > 0 && isAdmin && (
          <div className="booking-bar" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <div className="fab-actions" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Slots aktualisieren ({globalSelection.length} ausgewählt)</h3>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div className="fab-input-group">
                      <span className="fab-label">Rolle:</span>
                      <select value={batchRole} onChange={e => setBatchRole(e.target.value)} className="input-batch">
                        <option value="multiskill">Multiskill</option>
                        <option value="email">E-Mail</option>
                        <option value="telefonie">Telefonie</option>
                        <option value="chat">Chat</option>
                      </select>
                    </div>

                    <div className="fab-input-group">
                      <span className="fab-label">Vergütung:</span>
                      <select value={batchCompensation} onChange={e => setBatchCompensation(e.target.value)} className="input-batch">
                        <option value="standard">Standard</option>
                        <option value="special">Sondervergütung</option>
                      </select>
                    </div>

                    <div className="fab-input-group">
                      <span className="fab-label">Kapazität:</span>
                      <input type="number" className="input-admin input-admin-num" style={{width: '70px', padding: '0.4rem'}} value={batchCapacity} onChange={e => setBatchCapacity(e.target.value)} min="1" title="Kapazität" />
                    </div>

                    <div className="fab-input-group" style={{ flexDirection: 'row', marginLeft: 'auto', gap: '0.5rem', marginBottom: '1px' }}>
                      <button className="btn btn-secondary" onClick={async () => {
                        console.log("BULK SAVE CLICKED");
                        
                        const selectedSlots = globalSelection.map(id => sortedSlots.find(s => s.id === id)).filter(Boolean);

                        console.log("SELECTED SLOTS:", selectedSlots);
                        console.log("NEW VALUES:", {
                          role: batchRole,
                          compensation: batchCompensation,
                          capacity: batchCapacity
                        });

                        for (const slot of selectedSlots) {
                          const { data, error } = await supabase
                            .from("slots")
                            .update({
                              role: batchRole,
                              compensation: batchCompensation,
                              capacity: batchCapacity
                            })
                            .eq("id", slot.id)
                            .select();

                          console.log("UPDATE RESULT:", { data, error });
                        }

                        console.log("BULK UPDATE DONE");
                        await fetchSlots();
                        setGlobalSelection([]);
                      }}>Änderungen übernehmen</button>
                      <button className="btn btn-danger" onClick={handleBatchDelete} title="Löschen">🗑️</button>
                    </div>
                  </div>
                </div>
            </div>
          </div>
        )}

        <div className="slots-container" ref={slotsRef}>
          <div className="content-wrapper">
          <div className="slot-date-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div />
            <button className="filter-btn" onClick={() => setShowFilterModal(true)}>
              ⚙ Filter
            </button>
          </div>
          <div className="date-divider" />
          <div>

            <ErrorBoundary>
              <SlotList 
                allSlots={sortedSlots}
                scopedSlots={daySlots} 
                users={users}
                filter={filter}
                currentDate={currentDate}
                viewMode={viewMode}
                onBook={bookSlot} 
                onDelete={handleSingleDelete} 
                onEdit={editSlot}
                globalSelection={globalSelection}
                toggleSelection={toggleSelection}
                isAdmin={isAdmin}
                selectedUserId={selectedUserId}
                unbookSlot={unbookSlot}
                showToast={showToast}
              />
            </ErrorBoundary>
          </div>
          </div>
        </div>
          </>
        )}
          </>
        )}


      {showBatchUnbookModal && (
        <div className="modal-overlay" onClick={(e) => { e.stopPropagation(); setShowBatchUnbookModal(false); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Grund für Austragung aus {globalSelection.length} Slots</h2>
              <button className="btn-close" onClick={() => setShowBatchUnbookModal(false)}>✖</button>
            </div>
            <div className="modal-body" style={{ marginTop: '1rem' }}>
              <textarea 
                value={batchUnbookReason} 
                onChange={e => setBatchUnbookReason(e.target.value)} 
                rows={4} 
                placeholder="Grund (z. B. Krankheit, anderer Termin...)"
                style={{width: '100%', padding: '0.8rem', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '1rem', resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setShowBatchUnbookModal(false)}>Abbrechen</button>
                <button className="btn btn-danger" onClick={confirmBatchUnbook}>Austragen bestätigen</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {appToast && (
        <div className="app-toast-overlay">
          <div className={`app-toast ${appToast.isError ? 'error' : ''}`}>
            <span>{appToast.isError ? '⚠️' : '✅'}</span>
            <span>{appToast.message}</span>
          </div>
        </div>
      )}

      {showFilterModal && (
        <div className="modal-overlay" onClick={() => setShowFilterModal(false)}>
          <div className="filter-modal" onClick={(e) => e.stopPropagation()}>
            <div className="filter-header" style={{ justifyContent: 'center', position: 'relative' }}>
              <h2 style={{width: '100%', textAlign: 'center', margin: 0, fontSize: '1.2rem'}}>Filter & Ansicht</h2>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setShowFilterModal(false)}
                style={{ position: 'absolute', right: 0, padding: '0.2rem 0.6rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.2rem'}}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column' }}>
               <div className="view-switch">
                  <button className={`btn btn-sm ${viewMode === 'day' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('day')}>Tagesansicht</button>
                  <button className={`btn btn-sm ${viewMode === 'week' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('week')}>Wochenansicht</button>
               </div>
               <button
                 className="btn btn-sm btn-secondary secondary-toggle"
                 onClick={() => setShowPastSlots(prev => !prev)}
               >
                 {showPastSlots ? "Vergangene ausblenden" : "Vergangene anzeigen"}
               </button>
               <div>
                  <h4 style={{marginTop: 0, marginBottom: '1rem', color: 'var(--text-primary)', textAlign: 'center'}}>Statistiken</h4>
                  <Dashboard scopedSlots={scopedAllSlots} allSlots={visibleSlotsUnfiltered} filter={filter} setFilter={setFilter} isAdmin={isAdmin} selectedUserId={selectedUserId} />
               </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary reset-btn" onClick={handleReset}>Zurücksetzen</button>
                  <button className="btn btn-primary primary-btn" onClick={() => setShowFilterModal(false)}>Fertig</button>
                </div>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Neuen Zeitraum erstellen</h3>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setShowCreateModal(false)} 
                style={{ padding: '0.2rem 0.6rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '1.2rem'}}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <AdminForm onAdd={handleAddSlot} conflictError={false} currentDate={currentDate} />
            </div>
          </div>
        </div>
      )}
    </div>

      {globalSelection.length > 0 && (
        <div className="cta-floating">
          <button
            className="primary-btn"
            onClick={(e) => {
              console.log("BOOKING CLICKED");
              handleBatchAction();
            }}
            disabled={!selectedUserId || users.length === 0}
          >
            {filter === "mine"
              ? `Slots absagen (${globalSelection.length})`
              : `Slots buchen (${globalSelection.length})`}
          </button>
        </div>
      )}
    </>
  );
}

export default App;
