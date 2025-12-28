# Server Data Storage Flow

## ✅ YES: We Extract Individual Records from Grouped Server Response

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ SERVER RESPONSE (Grouped by Date)                            │
│                                                               │
│ [                                                             │
│   {                                                           │
│     "dateOfPunch": "2024-12-28",                             │
│     "attendanceStatus": "PRESENT",                           │
│     "totalDuration": "08:30",                                │
│     "records": [  ← GROUPED DATA                              │
│       { Timestamp: 1735389000000, PunchDirection: "IN" },    │
│       { Timestamp: 1735416000000, PunchDirection: "OUT" }    │
│     ]                                                         │
│   },                                                          │
│   {                                                           │
│     "dateOfPunch": "2024-12-29",                             │
│     "records": [                                              │
│       { Timestamp: 1735475400000, PunchDirection: "IN" }      │
│     ]                                                         │
│   }                                                           │
│ ]                                                             │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        │ mergeAttendanceData()
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ EXTRACTION PROCESS                                           │
│                                                               │
│ for (const day of serverData) {                              │
│   for (const serverRecord of day.records) {  ← EXTRACT       │
│     // Each record is processed individually                 │
│     insertAttendancePunchRecord(serverRecord)                │
│   }                                                           │
│ }                                                             │
└───────────────────────┬───────────────────────────────────────┘
                        │
                        │ insertAttendancePunchRecord()
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ DATABASE STORAGE (Individual Records)                       │
│                                                               │
│ attendance table:                                             │
│ ┌─────────────┬──────────────┬──────────────┐              │
│ │ Timestamp   │ DateOfPunch  │ PunchDirection│              │
│ ├─────────────┼──────────────┼──────────────┤              │
│ │ 1735389000  │ 2024-12-28   │ IN            │  ← Row 1    │
│ │ 1735416000  │ 2024-12-28   │ OUT           │  ← Row 2    │
│ │ 1735475400  │ 2024-12-29   │ IN            │  ← Row 3    │
│ └─────────────┴──────────────┴──────────────┘              │
│                                                               │
│ Each punch = One row in DB                                    │
└─────────────────────────────────────────────────────────────┘
```

## Code Flow

### 1. Server Response (Grouped)
```json
[
  {
    "dateOfPunch": "2024-12-28",
    "attendanceStatus": "PRESENT",
    "totalDuration": "08:30",
    "records": [
      { "Timestamp": 1735389000000, "PunchDirection": "IN" },
      { "Timestamp": 1735416000000, "PunchDirection": "OUT" }
    ]
  }
]
```

### 2. Extraction in `mergeAttendanceData()`

**File**: `attendance-sync-service.ts` (lines 316-379)

```typescript
// Process each day's records from server
for (const day of serverData) {
  if (day.records && Array.isArray(day.records)) {
    for (const serverRecord of day.records) {  // ← EXTRACT EACH RECORD
      // Check if record exists locally
      const localRecord = localRecordsMap.get(serverTimestamp);
      
      if (!localRecord) {
        // Insert as individual record
        await insertAttendancePunchRecord({
          timestamp: serverTimestamp,
          punchDirection: serverRecord.PunchDirection,
          dateOfPunch: day.dateOfPunch,  // From day-level
          shiftStartTime: day.shiftStart,  // From day-level
          shiftEndTime: day.shiftEnd,      // From day-level
          // ... other fields
        });
      }
    }
  }
}
```

### 3. Storage in Database

**File**: `attendance-db-service.ts` (line 354)

```typescript
// Each insert creates ONE row
INSERT INTO attendance 
  (Timestamp, DateOfPunch, PunchDirection, ...)
VALUES 
  (1735389000000, '2024-12-28', 'IN', ...)  // Row 1
```

## Key Points

1. **Server sends grouped data** (days with records array)
2. **We extract individual records** from `day.records` array
3. **Each record becomes one row** in the database
4. **Day-level fields** (shiftStart, shiftEnd, minimumHours) are extracted and stored with each IN record
5. **We don't store the grouped structure** - only individual punch records

## Why This Approach?

✅ **Normalized Storage**: Each punch is independent
✅ **Easy Updates**: Can update individual punches
✅ **Flexible Queries**: Can query by timestamp, date, direction, etc.
✅ **Consistent Structure**: Same structure for local punches and server punches
✅ **No Duplication**: Day-level fields stored once per IN record

## Example

**Server Response:**
```json
{
  "dateOfPunch": "2024-12-28",
  "records": [
    { "Timestamp": 1735389000000, "PunchDirection": "IN" },
    { "Timestamp": 1735416000000, "PunchDirection": "OUT" }
  ]
}
```

**After Storage:**
```sql
-- Row 1
Timestamp: 1735389000000
DateOfPunch: '2024-12-28'
PunchDirection: 'IN'

-- Row 2
Timestamp: 1735416000000
DateOfPunch: '2024-12-28'
PunchDirection: 'OUT'
```

**Result**: 2 separate rows in database, not 1 grouped object.

