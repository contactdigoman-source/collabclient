# AttendanceStatus in Database: Storage and Recalculation

## 🎯 Quick Answer

### Q1: Is `attendanceStatus` properly saved in DB?
**Answer**: `attendanceStatus` is saved in the DB, but **NOT** for day-level status (PRESENT/HOURS_DEFICIT). It's only used for **break status** (LUNCH, SHORTBREAK, etc.) or **correction reasons** (EARLY_CHECKOUT).

### Q2: If once set as deficit, will it correct after proper checkout?
**Answer**: **YES!** The day-level status (PRESENT/HOURS_DEFICIT/PARTIAL) is **calculated dynamically** from the punch records, **not stored in DB**. It auto-corrects when you add a proper checkout.

### Q3: What will be the POST body of punch in and punch out?
**Answer**: See detailed examples below. Key point: `attendanceStatus` field in POST body is for **break types**, not day status.

---

## 📊 How AttendanceStatus Works

### **Two Different Concepts:**

1. **Per-Punch `attendanceStatus`** (Stored in DB per record):
   - Stored in database for **each punch record**
   - Used for: Break status (LUNCH, SHORTBREAK, EARLY_CHECKOUT)
   - Set at punch time (check-in/out)
   - **Persisted permanently**

2. **Per-Day `attendanceStatus`** (Calculated dynamically):
   - **NOT stored in database**
   - Calculated by `groupAttendanceByDate()` → `calculateAttendanceStatus()`
   - Values: PRESENT, ABSENT, PARTIAL, HOURS_DEFICIT
   - **Recalculated every time UI loads**

---

## 🗄️ Database Storage

### **Schema:**

```sql
CREATE TABLE attendance (
  Timestamp BIGINT PRIMARY KEY,
  PunchDirection TEXT,     -- 'IN' or 'OUT'
  AttendanceStatus TEXT,   -- Break status only (LUNCH, SHORTBREAK, etc.)
  DateOfPunch TEXT,
  LatLon TEXT,
  Address TEXT,
  ShiftStartTime TEXT,     -- Captured at check-in
  ShiftEndTime TEXT,       -- Captured at check-in
  MinimumHoursRequired REAL, -- Captured at check-in
  -- ... other fields
);
```

### **What's Stored:**

```
Example Day with Lunch Break:

Record 1: Check-In
  Timestamp: 1735372800000 (9:00 AM)
  PunchDirection: 'IN'
  AttendanceStatus: ''        ← Empty (normal check-in)
  ShiftStartTime: '09:00'
  ShiftEndTime: '18:00'
  MinimumHoursRequired: 8

Record 2: Lunch Out
  Timestamp: 1735387200000 (1:00 PM)
  PunchDirection: 'OUT'
  AttendanceStatus: 'LUNCH'  ← Break type stored!
  ShiftStartTime: null
  ShiftEndTime: null
  MinimumHoursRequired: null

Record 3: Lunch In
  Timestamp: 1735390800000 (2:00 PM)
  PunchDirection: 'IN'
  AttendanceStatus: ''        ← Empty (return from lunch)
  ShiftStartTime: null
  ShiftEndTime: null
  MinimumHoursRequired: null

Record 4: Final Checkout
  Timestamp: 1735405200000 (6:00 PM)
  PunchDirection: 'OUT'
  AttendanceStatus: ''        ← Empty (normal checkout)
  ShiftStartTime: null
  ShiftEndTime: null
  MinimumHoursRequired: null
```

### **Day Status Calculation (Runtime):**

```javascript
// When UI loads, this function runs:
function calculateAttendanceStatus(records) {
  // 1. Check if complete (IN-OUT pairs match)
  // 2. Calculate total duration (Last OUT - First IN)
  // 3. Get minimumHours from first check-in record
  // 4. Compare total duration with minimum
  
  if (totalMinutes >= minimumMinutes) {
    return 'PRESENT';      // ✅ Meets requirement
  } else {
    return 'HOURS_DEFICIT'; // ⚠️ Insufficient hours
  }
}
```

**Result**: Day status = `'PRESENT'` (9 hours worked, 8 hours required)

---

## 🔄 Dynamic Recalculation Example

### **Scenario: User Leaves Early**

#### **Step 1: Early Checkout (3:00 PM)**

```
DB Records:
  Check-In:  9:00 AM
  Check-Out: 3:00 PM (6 hours worked, 8 hours required)

Calculation:
  totalMinutes = 360 (6 hours)
  minimumMinutes = 480 (8 hours)
  360 < 480 ✅
  
Result: attendanceStatus = 'HOURS_DEFICIT' ⚠️ (RED badge)
```

#### **Step 2: Forgot! Return and Checkout Properly (6:00 PM)**

User realizes mistake, goes back, and checks out at proper time.

**Option A: Admin/Manager corrects the DB record:**

```sql
-- Update the early checkout time
UPDATE attendance 
SET Timestamp = 1735405200000  -- 6:00 PM instead of 3:00 PM
WHERE Timestamp = 1735394400000; -- Old 3:00 PM record
```

**Option B: User creates new checkout record with approval:**

```
New DB Record:
  Check-Out: 6:00 PM
  ApprovalRequired: 'Y'
  Reason: 'MANUAL_TIME_SELECTION'
  CorrectionType: 'MANUAL_TIME'
  ManualCheckoutTime: 1735405200000
```

#### **Step 3: UI Refreshes (Automatic Recalculation)**

```
DB Records:
  Check-In:  9:00 AM
  Check-Out: 6:00 PM (9 hours worked, 8 hours required)

Calculation:
  totalMinutes = 540 (9 hours)
  minimumMinutes = 480 (8 hours)
  540 >= 480 ✅
  
Result: attendanceStatus = 'PRESENT' ✅ (GREEN bar)
```

**✅ Status auto-corrected!** No manual flag update needed.

---

## 📤 POST Body for Punch In/Out

### **1. Normal Check-In**

```http
POST /api/attendance/punch-in
Content-Type: application/json

{
  "timestamp": 1735372800000,
  "orgID": "123",
  "userID": "user@example.com",
  "punchType": "CHECK",
  "punchDirection": "IN",
  "latLon": "22.5726,88.3639",
  "address": "Office Building, 123 Main St, Kolkata",
  "createdOn": 1735372800000,
  "isSynced": "N",
  "dateOfPunch": "2024-12-28",
  "attendanceStatus": "",              ← Empty (normal)
  "moduleID": "",
  "tripType": "",
  "passengerID": "",
  "allowanceData": "[]",
  "isCheckoutQrScan": 0,
  "travelerName": "",
  "phoneNumber": "",
  "ApprovalRequired": "N",
  "Reason": null,
  "OriginalCheckoutTime": null,
  "CorrectedCheckoutTime": null,
  "WorkedHours": null,
  "MinimumHoursRequired": 8,           ← Captured at check-in!
  "LinkedEntryDate": null,
  "CorrectionType": null,
  "ManualCheckoutTime": null,
  "ShiftStartTime": "09:00",           ← Captured at check-in!
  "ShiftEndTime": "18:00"              ← Captured at check-in!
}
```

**Key Points**:
- ✅ `attendanceStatus`: Empty string (normal check-in)
- ✅ `ShiftStartTime`, `ShiftEndTime`, `MinimumHoursRequired`: Captured from user profile
- ✅ `timestamp`: UTC milliseconds (2024-12-28T09:00:00.000Z)
- ✅ `dateOfPunch`: UTC date string (YYYY-MM-DD)

---

### **2. Normal Check-Out**

```http
POST /api/attendance/punch-out
Content-Type: application/json

{
  "timestamp": 1735405200000,
  "orgID": "123",
  "userID": "user@example.com",
  "punchType": "CHECK",
  "punchDirection": "OUT",
  "latLon": "22.5726,88.3639",
  "address": "Office Building, 123 Main St, Kolkata",
  "createdOn": 1735405200000,
  "isSynced": "N",
  "dateOfPunch": "2024-12-28",
  "attendanceStatus": "",              ← Empty (normal)
  "moduleID": "",
  "tripType": "",
  "passengerID": "",
  "allowanceData": "[]",
  "isCheckoutQrScan": 0,
  "travelerName": "",
  "phoneNumber": "",
  "ApprovalRequired": "N",
  "Reason": null,
  "OriginalCheckoutTime": null,
  "CorrectedCheckoutTime": null,
  "WorkedHours": null,
  "MinimumHoursRequired": null,        ← null at checkout
  "LinkedEntryDate": null,
  "CorrectionType": null,
  "ManualCheckoutTime": null,
  "ShiftStartTime": null,              ← null at checkout
  "ShiftEndTime": null                 ← null at checkout
}
```

**Key Points**:
- ✅ `attendanceStatus`: Empty string (normal checkout)
- ✅ Shift fields are `null` (only captured at check-in)
- ✅ `timestamp`: 2024-12-28T18:00:00.000Z (6:00 PM UTC)

---

### **3. Lunch Break (Check-Out)**

```http
POST /api/attendance/punch-out
Content-Type: application/json

{
  "timestamp": 1735387200000,
  "orgID": "123",
  "userID": "user@example.com",
  "punchType": "CHECK",
  "punchDirection": "OUT",
  "latLon": "22.5726,88.3639",
  "address": "Office Building, 123 Main St, Kolkata",
  "createdOn": 1735387200000,
  "isSynced": "N",
  "dateOfPunch": "2024-12-28",
  "attendanceStatus": "LUNCH",         ← Break type!
  "moduleID": "",
  "tripType": "",
  "passengerID": "",
  "allowanceData": "[]",
  "isCheckoutQrScan": 0,
  "travelerName": "",
  "phoneNumber": "",
  "ApprovalRequired": "N",
  "Reason": null,
  "OriginalCheckoutTime": null,
  "CorrectedCheckoutTime": null,
  "WorkedHours": null,
  "MinimumHoursRequired": null,
  "LinkedEntryDate": null,
  "CorrectionType": null,
  "ManualCheckoutTime": null,
  "ShiftStartTime": null,
  "ShiftEndTime": null
}
```

**Key Points**:
- ✅ `attendanceStatus`: "LUNCH" (break type stored in DB)
- ✅ `timestamp`: 2024-12-28T13:00:00.000Z (1:00 PM UTC)

**Available Break Types**:
- `"LUNCH"` - Lunch break
- `"SHORTBREAK"` - Short break
- `"COMMUTING"` - Commuting
- `"PERSONALTIMEOUT"` - Personal time out
- `"OUTFORDINNER"` - Out for dinner
- `"EARLY_CHECKOUT"` - Early checkout (before shift end)

---

### **4. Return from Lunch (Check-In)**

```http
POST /api/attendance/punch-in
Content-Type: application/json

{
  "timestamp": 1735390800000,
  "orgID": "123",
  "userID": "user@example.com",
  "punchType": "CHECK",
  "punchDirection": "IN",
  "latLon": "22.5726,88.3639",
  "address": "Office Building, 123 Main St, Kolkata",
  "createdOn": 1735390800000,
  "isSynced": "N",
  "dateOfPunch": "2024-12-28",
  "attendanceStatus": "",              ← Empty (return from break)
  "moduleID": "",
  "tripType": "",
  "passengerID": "",
  "allowanceData": "[]",
  "isCheckoutQrScan": 0,
  "travelerName": "",
  "phoneNumber": "",
  "ApprovalRequired": "N",
  "Reason": null,
  "OriginalCheckoutTime": null,
  "CorrectedCheckoutTime": null,
  "WorkedHours": null,
  "MinimumHoursRequired": null,        ← null (not first check-in)
  "LinkedEntryDate": null,
  "CorrectionType": null,
  "ManualCheckoutTime": null,
  "ShiftStartTime": null,              ← null (not first check-in)
  "ShiftEndTime": null                 ← null (not first check-in)
}
```

**Key Points**:
- ✅ `attendanceStatus`: Empty (normal return)
- ✅ Shift fields are `null` (only set on FIRST check-in of the day)
- ✅ `timestamp`: 2024-12-28T14:00:00.000Z (2:00 PM UTC)

---

### **5. Forgot to Check-Out (Next Day Correction)**

```http
POST /api/attendance/punch-out
Content-Type: application/json

{
  "timestamp": 1735405200000,
  "orgID": "123",
  "userID": "user@example.com",
  "punchType": "CHECK",
  "punchDirection": "OUT",
  "latLon": "22.5726,88.3639",
  "address": "Home Address, 456 Park Ave, Kolkata",
  "createdOn": 1735459200000,
  "isSynced": "N",
  "dateOfPunch": "2024-12-28",
  "attendanceStatus": "",
  "moduleID": "",
  "tripType": "",
  "passengerID": "",
  "allowanceData": "[]",
  "isCheckoutQrScan": 0,
  "travelerName": "",
  "phoneNumber": "",
  "ApprovalRequired": "Y",             ← Requires approval!
  "Reason": "FORGOT_TO_CHECKOUT",      ← Reason for correction
  "OriginalCheckoutTime": null,
  "CorrectedCheckoutTime": 1735405200000,
  "WorkedHours": null,
  "MinimumHoursRequired": null,
  "LinkedEntryDate": null,
  "CorrectionType": "FORGOT_CHECKOUT", ← Correction type
  "ManualCheckoutTime": null,
  "ShiftStartTime": null,
  "ShiftEndTime": null
}
```

**Key Points**:
- ✅ `ApprovalRequired`: "Y" (triggers approval workflow)
- ✅ `Reason`: "FORGOT_TO_CHECKOUT" (explains correction)
- ✅ `CorrectionType`: "FORGOT_CHECKOUT" (type of correction)
- ✅ `timestamp`: 2024-12-28T18:00:00.000Z (shift end time)
- ✅ `createdOn`: 2024-12-29T09:00:00.000Z (next day, when correction made)

---

### **6. Manual Checkout Time Selection**

```http
POST /api/attendance/punch-out
Content-Type: application/json

{
  "timestamp": 1735401600000,
  "orgID": "123",
  "userID": "user@example.com",
  "punchType": "CHECK",
  "punchDirection": "OUT",
  "latLon": "22.5726,88.3639",
  "address": "Home Address, 456 Park Ave, Kolkata",
  "createdOn": 1735459200000,
  "isSynced": "N",
  "dateOfPunch": "2024-12-28",
  "attendanceStatus": "",
  "moduleID": "",
  "tripType": "",
  "passengerID": "",
  "allowanceData": "[]",
  "isCheckoutQrScan": 0,
  "travelerName": "",
  "phoneNumber": "",
  "ApprovalRequired": "Y",                    ← Requires approval!
  "Reason": "MANUAL_TIME_SELECTION",          ← Reason
  "OriginalCheckoutTime": null,
  "CorrectedCheckoutTime": 1735401600000,
  "WorkedHours": null,
  "MinimumHoursRequired": null,
  "LinkedEntryDate": null,
  "CorrectionType": "MANUAL_TIME",            ← Manual time selection
  "ManualCheckoutTime": 1735401600000,        ← User-selected time
  "ShiftStartTime": null,
  "ShiftEndTime": null
}
```

**Key Points**:
- ✅ `ApprovalRequired`: "Y" (requires approval)
- ✅ `CorrectionType`: "MANUAL_TIME" (manual selection)
- ✅ `ManualCheckoutTime`: User-selected time (5:00 PM)
- ✅ `timestamp`: 2024-12-28T17:00:00.000Z (manually selected, 5:00 PM UTC)

---

## 🔄 Complete Flow for "My Days" Display

### **Backend (Server) Response: GET /api/attendance/days**

```json
{
  "success": true,
  "data": [
    {
      "dateOfPunch": "2024-12-28",
      "records": [
        {
          "Timestamp": 1735372800000,
          "PunchDirection": "IN",
          "AttendanceStatus": null,
          "LatLon": "22.5726,88.3639",
          "Address": "Office Building, 123 Main St",
          "DateOfPunch": "2024-12-28",
          "ShiftStartTime": "09:00",
          "ShiftEndTime": "18:00",
          "MinimumHoursRequired": 8
        },
        {
          "Timestamp": 1735405200000,
          "PunchDirection": "OUT",
          "AttendanceStatus": null,
          "LatLon": "22.5726,88.3639",
          "Address": "Office Building, 123 Main St",
          "DateOfPunch": "2024-12-28"
        }
      ]
    }
  ]
}
```

### **Client Processing**

```javascript
// 1. Receive from server → Save to SQLite
await syncAttendanceFromServer(userID);

// 2. Read from SQLite → Calculate day status
const attendanceData = await getAttendanceData(userID);

// 3. Group by date and calculate status
const groupedDays = groupAttendanceByDate(attendanceData);

// Result for 2024-12-28:
{
  dateOfPunch: "2024-12-28",
  records: [ /* 2 records: IN and OUT */ ],
  attendanceStatus: "PRESENT",    // ← Calculated, not from DB!
  totalDuration: "09:00",         // ← Calculated (6PM - 9AM)
  breakDuration: "00:00",         // ← Calculated
  workedHours: 9,                 // ← Calculated
  requiresApproval: false         // ← Check if any record has ApprovalRequired='Y'
}

// 4. Display in UI
<DayAttendanceItem
  date="2024-12-28"
  records={records}
  attendanceStatus="PRESENT"      // ← Shows green bar, no badge
  totalDuration="09:00"
  requiresApproval={false}
/>
```

---

## ✅ Summary Table

| Concept | Stored in DB? | When Set? | Auto-Corrects? |
|---------|---------------|-----------|----------------|
| **Per-Punch `attendanceStatus`** (Break type) | ✅ YES | At punch time | ❌ NO (permanent) |
| **Per-Day `attendanceStatus`** (PRESENT/DEFICIT) | ❌ NO | Calculated on load | ✅ YES (auto) |
| `ShiftStartTime` | ✅ YES | First check-in only | ❌ NO (immutable) |
| `ShiftEndTime` | ✅ YES | First check-in only | ❌ NO (immutable) |
| `MinimumHoursRequired` | ✅ YES | First check-in only | ❌ NO (immutable) |
| `ApprovalRequired` | ✅ YES | Manual corrections | ❌ NO (set explicitly) |

---

## 🎯 Key Takeaways

1. **Day Status is Dynamic**: `attendanceStatus` (PRESENT/HOURS_DEFICIT/etc.) is **calculated** from punch records, not stored
2. **Break Status is Stored**: `attendanceStatus` field in DB stores **break types** (LUNCH, SHORTBREAK), not day status
3. **Auto-Correction Works**: Adding/updating checkout records automatically recalculates the day status
4. **Shift Data is Immutable**: Captured at first check-in, never changes for that day
5. **POST Body Format**: Use empty `attendanceStatus` for normal punches, specific values for breaks
6. **Server Response**: Server returns punch records, client calculates day status

---

**Date**: December 28, 2025  
**Status**: ✅ Complete  
**Related Docs**: `ATTENDANCE_PUNCH_API_REQUEST_BODY.md`, `STATUS_DISPLAY_FIX.md`

