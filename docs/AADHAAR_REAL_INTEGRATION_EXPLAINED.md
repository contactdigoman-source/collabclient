# Real Aadhaar Integration - What You Need

## ⚠️ Current Status: NOT REAL AADHAAR INTEGRATION

**What you have now:**
- ✅ UI for Aadhaar input
- ✅ UI for OTP entry
- ✅ Flow logic (Face RD → OTP fallback)
- ❌ **NO actual connection to UIDAI servers**
- ❌ **NO license/credentials**
- ❌ **NO backend API integration**

**This is currently a MOCK/SIMULATION** - it won't actually verify Aadhaar numbers.

---

## 🔴 What's Missing for REAL Aadhaar Integration

### 1. **License/Authorization (REQUIRED)**

You **MUST** have one of these:

#### Option A: Direct UIDAI License
- **Who**: UIDAI (Unique Identification Authority of India)
- **What**: Official license to use Aadhaar authentication
- **How to Get**:
  1. Register as an Authentication User Agency (AUA)
  2. Complete KYC and compliance requirements
  3. Get license key/credentials
  4. **Cost**: High compliance costs, annual fees
  5. **Time**: 3-6 months approval process

#### Option B: Third-Party Provider License (EASIER)
- **Who**: Authorized Aadhaar service providers
- **Examples**:
  - **eMudhra** - https://www.emudhra.com/
  - **Signzy** - https://signzy.com/
  - **Digio** - https://www.digio.in/
  - **IDfy** - https://www.idfy.com/
  - **Karza** - https://karza.in/
  
- **What You Get**:
  - API credentials (API key, secret)
  - SDK (if needed)
  - Documentation
  - Support
  
- **How to Get**:
  1. Sign up on their website
  2. Complete business verification
  3. Pay setup fees (if any)
  4. Get API credentials
  - **Cost**: ₹2-10 per authentication + setup fees
  - **Time**: 1-2 weeks

---

### 2. **Backend API Integration (REQUIRED)**

Your backend **MUST** call UIDAI or third-party APIs. **You CANNOT do this from React Native directly.**

#### Current Code (What You Have):
```typescript
// src/services/aadhaar/otp-service.ts
// This calls YOUR backend API
const response = await axios.post(
  `${API_BASE_URL}/api/aadhaar/request-otp`,  // ← Your backend
  { aadhaarNumber, emailID }
);
```

#### What Your Backend Must Do:

**Step 1: Request OTP**
```javascript
// Backend: POST /api/aadhaar/request-otp
// Your backend calls UIDAI/third-party API

// Example with third-party (eMudhra):
const eMudhraResponse = await axios.post(
  'https://api.emudhra.com/aadhaar/otp/request',
  {
    aadhaarNumber: req.body.aadhaarNumber,
    emailID: req.body.emailID,
  },
  {
    headers: {
      'Authorization': `Bearer ${process.env.EMUDHRA_API_KEY}`,
      'X-API-Secret': process.env.EMUDHRA_API_SECRET,
    }
  }
);

// UIDAI/Provider sends OTP to user's registered email/phone
// Your backend returns success to React Native
res.json({ success: true });
```

**Step 2: Verify OTP**
```javascript
// Backend: POST /api/aadhaar/verify-otp
// Your backend verifies OTP with UIDAI/third-party

const eMudhraResponse = await axios.post(
  'https://api.emudhra.com/aadhaar/otp/verify',
  {
    aadhaarNumber: req.body.aadhaarNumber,
    otp: req.body.otp,
  },
  {
    headers: {
      'Authorization': `Bearer ${process.env.EMUDHRA_API_KEY}`,
    }
  }
);

if (eMudhraResponse.data.verified) {
  // Aadhaar verified successfully
  res.json({ success: true, verified: true });
} else {
  res.json({ success: false, verified: false });
}
```

---

### 3. **UIDAI RD Service Integration (For Face RD)**

**What You Need:**
- Native Android module (not implemented yet)
- UIDAI RD Service app installed on user's device
- License key from UIDAI or vendor

**Current Code:**
```typescript
// This calls a native module that DOESN'T EXIST yet
FaceAuth.startFaceAuth(aadhaarNo, licenseKey);
```

**What's Missing:**
- `FaceAuthModule.kt` - Native Android module
- Actual license key (currently placeholder)
- Integration with UIDAI RD Service

**See**: `docs/AADHAAR_NATIVE_MODULE_TEMPLATE.md` for implementation template

---

## 📋 Step-by-Step: How to Get Real Aadhaar Integration

### Step 1: Choose Provider

**Recommended: Third-Party Provider (Easier)**
- Sign up with eMudhra, Signzy, or Digio
- Faster setup (1-2 weeks vs 3-6 months)
- Better documentation and support

**Alternative: Direct UIDAI**
- Only if you need official UIDAI partnership
- Longer process, higher compliance costs

### Step 2: Get Credentials

**From Third-Party Provider:**
1. Sign up on their website
2. Complete business verification
3. Get API credentials:
   - API Key
   - API Secret
   - Base URL
   - Documentation

**Store in Backend Environment Variables:**
```bash
# Backend .env
EMUDHRA_API_KEY=your_api_key_here
EMUDHRA_API_SECRET=your_api_secret_here
EMUDHRA_BASE_URL=https://api.emudhra.com
```

### Step 3: Implement Backend APIs

**Create Backend Endpoints:**

```javascript
// routes/aadhaar.js (Node.js/Express example)

const axios = require('axios');
const express = require('express');
const router = express.Router();

// Request OTP
router.post('/request-otp', async (req, res) => {
  try {
    const { aadhaarNumber, emailID } = req.body;
    
    // Call third-party API
    const response = await axios.post(
      `${process.env.EMUDHRA_BASE_URL}/aadhaar/otp/request`,
      {
        aadhaarNumber: aadhaarNumber,
        emailID: emailID,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.EMUDHRA_API_KEY}`,
          'X-API-Secret': process.env.EMUDHRA_API_SECRET,
        }
      }
    );
    
    // UIDAI/Provider sends OTP to user's email/phone
    res.json({
      success: true,
      message: 'OTP sent successfully',
    });
  } catch (error) {
    console.error('OTP request failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP',
    });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { aadhaarNumber, otp, emailID } = req.body;
    
    // Call third-party API to verify
    const response = await axios.post(
      `${process.env.EMUDHRA_BASE_URL}/aadhaar/otp/verify`,
      {
        aadhaarNumber: aadhaarNumber,
        otp: otp,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.EMUDHRA_API_KEY}`,
        }
      }
    );
    
    if (response.data.verified) {
      res.json({
        success: true,
        verified: true,
        message: 'Aadhaar verified successfully',
      });
    } else {
      res.json({
        success: false,
        verified: false,
        message: 'Invalid OTP',
      });
    }
  } catch (error) {
    console.error('OTP verification failed:', error);
    res.status(500).json({
      success: false,
      verified: false,
      message: 'OTP verification failed',
    });
  }
});

module.exports = router;
```

### Step 4: Update React Native Config

**Add API Base URL to `.env`:**
```bash
API_BASE_URL=https://your-backend-api.com
```

**The React Native code is already set up** - it will call your backend APIs.

### Step 5: Test Integration

1. **Test OTP Request:**
   - Enter Aadhaar number
   - Should receive OTP on registered email/phone
   - Check backend logs for API calls

2. **Test OTP Verification:**
   - Enter OTP
   - Should verify successfully
   - Aadhaar should be marked as validated

---

## 🔗 How OTP Linking Works

### Flow Diagram:

```
React Native App
    ↓ (Calls your backend)
Your Backend API
    ↓ (Calls with credentials)
Third-Party Provider (eMudhra/Signzy/etc.)
    ↓ (Calls UIDAI)
UIDAI Servers
    ↓ (Sends OTP)
User's Registered Email/Phone
    ↓ (User enters OTP)
React Native App
    ↓ (Calls your backend)
Your Backend API
    ↓ (Verifies with provider)
Third-Party Provider
    ↓ (Verifies with UIDAI)
UIDAI Servers
    ↓ (Returns verification result)
Your Backend → React Native App
```

### Key Points:

1. **React Native CANNOT directly call UIDAI** - must go through backend
2. **Your backend MUST have credentials** - API keys from provider
3. **Provider handles UIDAI communication** - you don't need direct UIDAI access
4. **OTP is sent by UIDAI** - to user's registered email/phone
5. **Verification happens server-side** - for security

---

## 💰 Cost Breakdown

### Third-Party Provider (Recommended):
- **Setup Fee**: ₹0 - ₹50,000 (one-time)
- **Per Authentication**: ₹2 - ₹10
- **Monthly Minimum**: Usually ₹5,000 - ₹10,000
- **Support**: Usually included

### Direct UIDAI:
- **Registration**: ₹10,000 - ₹50,000
- **Annual Compliance**: ₹50,000 - ₹2,00,000
- **Per Authentication**: Lower (but higher overhead)
- **Setup Time**: 3-6 months

---

## ✅ Checklist for Real Integration

- [ ] Choose provider (eMudhra/Signzy/etc. or UIDAI direct)
- [ ] Sign up and complete verification
- [ ] Get API credentials (API key, secret)
- [ ] Implement backend API endpoints:
  - [ ] `/api/aadhaar/request-otp`
  - [ ] `/api/aadhaar/verify-otp`
- [ ] Add `API_BASE_URL` to React Native `.env`
- [ ] Test OTP request flow
- [ ] Test OTP verification flow
- [ ] (Optional) Implement Face RD native module
- [ ] (Optional) Get Face RD license key

---

## 🚨 Important Notes

1. **You CANNOT test without credentials** - Need real API keys
2. **Backend is REQUIRED** - Cannot do this client-side only
3. **Compliance is MANDATORY** - Must follow Aadhaar Act 2016
4. **Data Security** - Never store full Aadhaar numbers
5. **User Consent** - Must get explicit consent

---

## 📞 Next Steps

1. **Sign up with a provider** (eMudhra recommended for ease)
2. **Get API credentials**
3. **Implement backend APIs** (use code examples above)
4. **Update `.env` with `API_BASE_URL`**
5. **Test the integration**

The React Native code is **already ready** - you just need to:
- Get credentials
- Implement backend APIs
- Connect them together

---

## 🔍 Current Code Status

**What Works:**
- ✅ UI flows
- ✅ Error handling
- ✅ State management
- ✅ Navigation

**What Needs Backend:**
- ❌ OTP request (needs real API)
- ❌ OTP verification (needs real API)
- ❌ Face RD (needs native module + license)

**Ready to Connect:**
- ✅ All React Native code is ready
- ✅ Just needs backend APIs with real credentials

