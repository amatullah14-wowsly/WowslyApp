// src/db/schema.ts
export const createEventsTable = `
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER UNIQUE,
    name TEXT,
    meta TEXT
  );
`;

export const createTicketsTable = `
  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eventId INTEGER,
    ticket_id INTEGER,
    ticket_title TEXT,
    tickets_bought INTEGER DEFAULT 0,
    scanned INTEGER DEFAULT 0,
    synced INTEGER DEFAULT 0
  );
`;

/**
 * facility table (confirmed by your screenshot):
 * id, guest_uuid, facilityId, name, availableScans, checkIn, eventId, synced, ticket_id
 */
export const createFacilityTable = `
  CREATE TABLE IF NOT EXISTS facility (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_uuid TEXT,
    facilityId INTEGER,
    name TEXT,
    availableScans INTEGER DEFAULT 0,
    checkIn INTEGER DEFAULT 0,
    eventId INTEGER,
    synced INTEGER DEFAULT 0,
    ticket_id INTEGER DEFAULT 0
  );
`;

/**
 * If you need a table for raw offline checkins (main ticket check-ins)
 * that can be used for main check-ins; keep for compatibility.
 */
export const createCheckinsTable = `
  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    eventId INTEGER,
    qrGuestUuid TEXT,
    ticket_id INTEGER,
    check_in_count INTEGER DEFAULT 0,
    check_in_time TEXT,
    synced INTEGER DEFAULT 0
  );
`;
