import { supabase } from './supabase';
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

  // Authentication State
  const [authorized, setAuthorized] = useState(false);
  const PASSWORD = "123456"; // später ändern

  useEffect(() => {
    const saved = localStorage.getItem("auth");
    if (saved === "true") setAuthorized(true);
  }, []);

  const handleAuthLogin = () => {
    const input = prompt("Passwort:");
    if (input === PASSWORD) {
      localStorage.setItem("auth", "true");
      setAuthorized(true);
    } else {
      alert("Falsch");
    }
  };

  const slots = supabaseSlots;
  const users = supabaseUsers;

  console.log("SLOTS RAW:", slots);

  const fetchSlots = async () => {
    try {
      const { data, error } = await supabase
        .from("slots")
        .select("id, organization_id, date, start_time, end_time, capacity, is_critical");

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

      const formattedSlots = (data || []).map(slot => ({
        ...slot,
        date: slot.date?.slice(0, 10),
        bookings: (bookingsData || []).filter(b => b.slot_id === slot.id).map(b => ({
          ...b,
          name: usersMap[b.user_id] || "Unbekannt"
        })),
        time: `${slot.start_time} - ${slot.end_time}`
      }));

      const mergedSlots = Object.values(
        (formattedSlots || []).reduce((acc, slot) => {
          const key = `${slot.date}_${slot.start_time}_${slot.end_time}_${slot.role}_${slot.compensation}`;

          if (!acc[key]) {
            acc[key] = { ...slot };
          } else {
            acc[key].capacity = (acc[key].capacity || 1) + (slot.capacity || 1);
            acc[key].bookings = [...(acc[key].bookings || []), ...(slot.bookings || [])];
          }

          return acc;
        }, {})
      );

      console.log("FORMATTED SLOTS:", formattedSlots);
      console.log("SUPABASE SLOTS FINAL:", mergedSlots);
      setSupabaseSlots(mergedSlots);

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
    fetchSlots();
    fetchUsers();
  }, []);

  useEffect(() => {
    const handler = () => {
      console.log("REFETCH TRIGGERED");
      fetchSlots();
    };

    window.addEventListener("slots_updated", handler);
    return () => window.removeEventListener("slots_updated", handler);
  }, []);

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

  const formatSlotDate = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const weekday = d.toLocaleDateString("de-DE", { weekday: "short" });
    return `${weekday} ${day}.${month}.`;
  };

  const getToday = () => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  };

  const [currentDate, setCurrentDate] = useState(getToday());

  useEffect(() => {
    if (!currentDate) {
      setCurrentDate(getToday());
    }
  }, []);

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

  const dateStripDays = getDateStripDays(currentDate || getToday());
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
    if (filterFirstRender.current) {
      filterFirstRender.current = false;
      return;
    }
    if (isLoaded && listRef.current) {
      const y = listRef.current.getBoundingClientRect().top + window.scrollY - 20;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }, [filter, isLoaded]);

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

  const handleBatchBook = () => {
    const user = users.find(u => u.id === selectedUserId);
    if (user && globalSelection.length > 0) {
      if (bookMultipleSlots(globalSelection, user.id, user.name)) {
         setGlobalSelection([]);
         showToast("Slots erfolgreich eingebucht!");
      } else {
         showToast("Ausgewählte Slots sind bereits voll oder nicht verfügbar.", true);
      }
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
    const { data, error } = await supabase
      .from("slots")
      .insert([
        {
          start_time: startTime,
          end_time: endTime,
          date: date,
          capacity: capacity,
          role: role,
          compensation: compensation
        }
      ])
      .select();

    if (error) {
      console.error("REAL INSERT ERROR:", error);
      alert(error.message || "Fehler beim Erstellen des Slots");
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

  const scopedAllSlots = viewMode === "day"
    ? sortedSlots.filter(slot => {
        if (!slot.date || !slot.start_time) return false;

        // Build full datetime from slot
        const slotDateTime = new Date(`${slot.date}T${slot.start_time}`);

        // Only allow future slots
        if (slotDateTime < now) return false;

        // Then apply date filter
        const slotDate = String(slot.date).slice(0, 10);
        return slotDate === selectedDate;
      })
    : sortedSlots;

  const daySlots = scopedAllSlots.filter(slot => {
    const isBooked = selectedUserId ? slot.bookings?.some(b => b.user_id === selectedUserId) : false;
    const hasCapacity = (slot.capacity || 0) - (slot.bookings?.length || 0) > 0;

    let passesFilter = true;
    if (filter === "mine") {
      passesFilter = isBooked;
    } else if (filter === "open") {
      passesFilter = hasCapacity && !isBooked;
    } else if (filter === "critical") {
      passesFilter = slot.isCritical && hasCapacity && !isBooked;
    }

    return passesFilter;
  });

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
    if (filter === "mine") {
      handleBatchUnbook();
    } else {
      handleBatchBook();
    }
  };

  const handleReset = () => {
    setCurrentDate(getToday());
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



      <div className="header">
        <div className="header-container">
          <div className="container-header">
          {!isAdmin ? (
            <button className="btn btn-sm btn-secondary admin-button" onClick={handleLoginClick}>Admin-Modus</button>
          ) : (
            <button className="btn btn-sm btn-danger admin-button" onClick={logout}>Admin beenden</button>
          )}
          <h1 style={{ marginTop: 0 }}>Schichtplanung</h1>
          {!isAdmin && <p style={{ margin: 0 }}>Trage dich für verfügbare Schichten ein.</p>}
        </div>
        
        <div className="employee-select-wrapper" style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--primary-color)', display: 'inline-flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem', alignItems: 'flex-start', minWidth: '250px', maxWidth: '100%' }}>
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
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>ℹ️ Du siehst nur verfügbare oder deine eigenen Schichten</span>
          )}
        </div>
        </div>
      </div>
      
      <div className="app-wrapper">
      <main>
        
        {isAdmin && (
          <div className="display-row" style={{ marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
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
            
        <div className="view-controls-column" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '1rem', width: '100%' }}>
        <div className="week-header">
          <div className="week-nav">
            {dateStripDays.map((d) => (
              <button
                key={d.date}
                onClick={() => setCurrentDate(d.date)}
                className={`btn btn-sm ${currentDate === d.date ? "btn-primary active-day" : "btn-secondary"}`}
              >
                {d.label} {d.day}
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
                      <button className="btn btn-secondary" onClick={handleBatchUpdate}>Änderungen übernehmen</button>
                      <button className="btn btn-danger" onClick={handleBatchDelete} title="Löschen">🗑️</button>
                    </div>
                  </div>
                </div>
            </div>
          </div>
        )}

        <div className="slots-container">
          <div className="slot-date-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div />
            <button className="filter-btn" onClick={() => setShowFilterModal(true)}>
              ⚙ Filter
            </button>
          </div>
          <div className="date-divider" />
          <div className="slots-container">

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
          </>
        )}
          </>
        )}
      </main>
      </div>

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
                  <Dashboard scopedSlots={scopedAllSlots} filter={filter} setFilter={setFilter} isAdmin={isAdmin} selectedUserId={selectedUserId} />
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
            onClick={handleBatchAction}
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
