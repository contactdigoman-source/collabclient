# Overnight Shift Calculation Issue

## 🐛 Problem Report

### User Case:
```
Check-in:  Dec 28, 3:30 PM IST
Check-out: Dec 29, 3:00 AM IST
Total Hours: 11 hours
Status Showing: INCOMPLETE (PARTIAL) ❌
Expected Status: PRESENT ✅
```

---

## 🔍 Root Cause Analysis

### Current Grouping Logic (WRONG for Overnight Shifts):

**File**: `src/services/attendance/attendance-utils.ts`

```typescript
records.forEach((record) => {
  // Group by DateOfPunch
  let dateKey: string;
  if (record.DateOfPunch) {
    dateKey = record.DateOfPunch; // ← Problem: Uses punch date directly
  } else {
    dateKey = moment.utc(timestamp).format('YYYY-MM-DD');
  }
  
  groupedByDate.set(dateKey, [...records]);
});
```

### What Happens (WRONG):

```
Database Records:
  Record 1: Check-in  at 2024-12-28T10:00:00Z (3:30 PM IST)
            DateOfPunch: "2024-12-28"
            
  Record 2: Check-out at 2024-12-29T21:30:00Z (3:00 AM IST next day)
            DateOfPunch: "2024-12-29"

Grouping Result:
  Group "2024-12-28": [Check-in]  ← Only check-in, no checkout!
  Group "2024-12-29": [Check-out] ← Only checkout, no check-in!

Status Calculation:
  Dec 28: inCount=1, outCount=0 → isComplete=false → PARTIAL ❌
  Dec 29: inCount=0, outCount=1 → ABSENT or wrong ❌
```

---

## ✅ Correct Solution: Link Overnight Records

### What Should Happen:

```
1. Detect overnight shift:
   - User's shift: 15:30 - 03:00 (IST)
   - isOvernightShift("15:30", "03:00") → TRUE

2. Link checkout back to check-in date:
   - Check-in:  Dec 28, 3:30 PM → Primary date: Dec 28
   - Check-out: Dec 29, 3:00 AM → Link to: Dec 28 (via LinkedEntryDate)

3. Group for calculation:
   Group "2024-12-28": [Check-in, Check-out] ✅

4. Calculate status:
   inCount=1, outCount=1 → isComplete=true
   Duration: 11 hours
   Status: PRESENT ✅
```

---

## 🛠️ Required Fix

### Option 1: Fix at Database Level (When Inserting Checkout)

**File**: `src/screens/attendance/CheckInScreen.tsx`

When user checks out:
1. Get last check-in record
2. Check if shift is overnight using `isOvernightShift(shiftStart, shiftEnd)`
3. If overnight AND checkout time is next day:
   - Set `DateOfPunch` to check-in date (not checkout date)
   - Set `LinkedEntryDate` to actual checkout date
4. Save checkout record with corrected `DateOfPunch`

```typescript
// Pseudo-code for checkout logic:
const checkoutTimestamp = getCurrentTimestamp();
const checkoutDate = moment.utc(checkoutTimestamp).format('YYYY-MM-DD');
const checkInDate = userLastAttendance.DateOfPunch;

// Check if overnight shift
const isOvernight = isOvernightShift(shiftStartTime, shiftEndTime);
const isNextDay = checkoutDate !== checkInDate;

let finalDateOfPunch = checkoutDate;
let linkedEntryDate = null;

if (isOvernight && isNextDay) {
  // For overnight shifts, checkout should be grouped with check-in
  finalDateOfPunch = checkInDate; // Use check-in date!
  linkedEntryDate = checkoutDate; // Store actual checkout date
}

await insertAttendancePunchRecord({
  timestamp: checkoutTimestamp,
  punchDirection: 'OUT',
  dateOfPunch: finalDateOfPunch, // ← Uses check-in date for overnight
  LinkedEntryDate: linkedEntryDate, // ← Stores actual date
  // ... other fields
});
```

---

### Option 2: Fix at Grouping Level (Runtime Calculation)

**File**: `src/services/attendance/attendance-utils.ts`

Modify `groupAttendanceByDate` to detect and link overnight records:

```typescript
// After grouping by date, scan for overnight checkouts
function linkOvernightCheckouts(groupedByDate: Map<string, AttendanceRecord[]>): Map<string, AttendanceRecord[]> {
  const dates = Array.from(groupedByDate.keys()).sort();
  
  for (let i = 0; i < dates.length - 1; i++) {
    const today = dates[i];
    const tomorrow = dates[i + 1];
    
    const todayRecords = groupedByDate.get(today) || [];
    const tomorrowRecords = groupedByDate.get(tomorrow) || [];
    
    // Check if today has check-in without checkout
    const hasCheckIn = todayRecords.some(r => r.PunchDirection === 'IN');
    const hasCheckOut = todayRecords.some(r => r.PunchDirection === 'OUT');
    
    // Check if tomorrow has early morning checkout (before 6 AM)
    const earlyCheckouts = tomorrowRecords.filter(r => {
      if (r.PunchDirection !== 'OUT') return false;
      const timestamp = toNumericTimestamp(r.Timestamp);
      const hour = moment.utc(timestamp).hour();
      return hour < 6; // Early morning checkout
    });
    
    // If today has check-in without checkout, and tomorrow has early checkout
    if (hasCheckIn && !hasCheckOut && earlyCheckouts.length > 0) {
      // Move early checkout from tomorrow to today
      const checkoutToMove = earlyCheckouts[0];
      todayRecords.push(checkoutToMove);
      
      // Remove from tomorrow
      const tomorrowFiltered = tomorrowRecords.filter(r => r !== checkoutToMove);
      groupedByDate.set(tomorrow, tomorrowFiltered);
      groupedByDate.set(today, todayRecords);
      
      logger.debug('[linkOvernightCheckouts] Linked overnight checkout', {
        checkInDate: today,
        checkOutDate: tomorrow,
        checkOutTime: moment.utc(toNumericTimestamp(checkoutToMove.Timestamp)).format('HH:mm'),
      });
    }
  }
  
  return groupedByDate;
}

// In groupAttendanceByDate, after initial grouping:
const groupedByDate = new Map<string, AttendanceRecord[]>();
// ... existing grouping logic ...

// Link overnight checkouts before calculating status
const linkedGroupedByDate = linkOvernightCheckouts(groupedByDate);

// Continue with status calculation using linkedGroupedByDate
linkedGroupedByDate.forEach((dayRecords, dateOfPunch) => {
  // ... rest of calculation
});
```

---

## 🎯 Recommended Approach: **Option 2 (Runtime Fix)**

### Why Runtime Fix is Better:

1. **No Database Changes**: Existing data continues to work
2. **Backward Compatible**: Handles records saved before fix
3. **Flexible**: Can adjust heuristics (e.g., "early morning" threshold)
4. **Easier to Test**: No need to resave all attendance data

### Implementation Steps:

1. ✅ Add `linkOvernightCheckouts` function to `attendance-utils.ts`
2. ✅ Call it after initial date grouping
3. ✅ Test with user's case (Dec 28-29 overnight)
4. ✅ Update tests to verify overnight shift handling

---

## 🧪 Test Cases

### Case 1: User's Overnight Shift
```
Check-in:  Dec 28, 3:30 PM IST
Check-out: Dec 29, 3:00 AM IST
Expected:  Dec 28 shows PRESENT with 11 hours worked
```

### Case 2: Normal Same-Day Shift
```
Check-in:  Dec 28, 9:00 AM
Check-out: Dec 28, 6:00 PM
Expected:  Dec 28 shows PRESENT with 9 hours worked
(Should NOT be affected by overnight logic)
```

### Case 3: Multiple Punches Overnight
```
Check-in:  Dec 28, 3:30 PM
Lunch out: Dec 28, 8:00 PM
Lunch in:  Dec 28, 9:00 PM
Check-out: Dec 29, 2:00 AM
Expected:  Dec 28 shows PRESENT with 9.5 hours worked
```

### Case 4: Two Separate Days (Not Overnight)
```
Check-in:  Dec 28, 9:00 AM
Check-out: Dec 28, 6:00 PM
Check-in:  Dec 29, 9:00 AM (next day's shift)
Check-out: Dec 29, 6:00 PM
Expected:  
  - Dec 28 shows PRESENT
  - Dec 29 shows PRESENT
(Should NOT link these - they're separate shifts)
```

---

## 📊 Detection Heuristics

### How to Identify Overnight Checkout:

1. **Time-based** (Simpler, recommended):
   ```
   If checkout time is before 6:00 AM
   AND previous day has check-in without checkout
   → Link checkout to previous day
   ```

2. **Shift-based** (More accurate, complex):
   ```
   If user's shift crosses midnight (isOvernightShift)
   AND checkout is on next calendar day
   AND checkout time is within shift end + buffer
   → Link checkout to check-in day
   ```

Recommend **Time-based** approach for initial implementation.

---

## ⚠️ Edge Cases to Handle

### 1. Multiple Check-ins on Same Day
```
Check-in:  Dec 28, 9:00 AM
Check-out: Dec 28, 6:00 PM
Check-in:  Dec 28, 10:00 PM (another shift)
Check-out: Dec 29, 2:00 AM

Solution: Link checkout to LAST check-in of previous day
```

### 2. Forgot Checkout, Then Next Day Check-in
```
Check-in:  Dec 28, 3:30 PM
(Forgot checkout)
Check-in:  Dec 29, 9:00 AM (next day's shift)

Solution: Do NOT link - no early morning checkout to link
Dec 28 should show PARTIAL (missing checkout)
```

### 3. Very Late Checkout (10 AM next day)
```
Check-in:  Dec 28, 3:30 PM
Check-out: Dec 29, 10:00 AM (very late)

Solution: This is beyond reasonable shift hours
Treat as separate days (Dec 28 PARTIAL, Dec 29 wrong)
User should use "Forgot Checkout" flow
```

---

## 🚀 Next Steps

1. **Implement `linkOvernightCheckouts` function**
2. **Integrate into `groupAttendanceByDate`**
3. **Add logging for debugging**
4. **Test with user's exact case**
5. **Update documentation**

---

## 📝 Additional Considerations

### UI Display:
- Dec 28 should show: "11:00 hr" (includes overnight portion)
- Optional: Add indicator "↔ Includes checkout on Dec 29" 
- Use `LinkedEntryDate` field if needed for display

### Server Sync:
- Server should accept `DateOfPunch` = check-in date for overnight checkouts
- OR server should have same linking logic

### Approval Workflow:
- Overnight shifts should NOT require approval (they're valid)
- Only forgot checkouts require approval

---

**Status**: 🔴 **Issue Identified, Fix Pending**  
**Priority**: High (Affects overnight shift workers)  
**Estimated Effort**: 2-3 hours  
**Files to Modify**: `attendance-utils.ts`  
**Testing Required**: Comprehensive (multiple scenarios)

---

**Date Identified**: December 28, 2025  
**Reported By**: User (digogeorge)  
**Current Workaround**: None (shows incorrect PARTIAL status)

