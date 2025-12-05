import client from "./client";

/* ---------------------- OTP APIs ---------------------- */

export const sendOTP = async (dialing_code, mobile, otpMethod = "whatsapp") => {
  try {
    const response = await client.post("/send-one-time-pass", {
      dialing_code,
      g_recaptcha_response: "fG9xL3bV7pKzW1qR8dTy",
      mobile,
      otp: "",
      otp_method: otpMethod,
      platform: "fG9xL3bV7pKzW1qR8dTy"
    });
    return response.data;
  } catch (error) {
    console.log("SEND OTP ERROR:", error.response?.data || error.message);
    return { status: false, message: "OTP API failed" };
  }
};

export const verifyOTP = async (dialing_code, mobile, otp) => {
  try {
    const response = await client.post("/login-app", {
      dialing_code,
      mobile,
      otp,
    });
    return response.data;
  } catch (error) {
    console.log("VERIFY OTP ERROR:", error.response?.data || error.message);
    return { status: false, message: "Verify API failed" };
  }
};

/* ---------------------- QR CODE (ONLINE) ---------------------- */

export const verifyQRCode = async (eventId, qrGuestUuid) => {
  try {
    const response = await client.post(
      `/events/${eventId}/eventuser/verifyqrcode`,
      { qrGuestUuid }
    );

    return response.data;
  } catch (error) {
    console.log(
      "VERIFY QR CODE ERROR:",
      error.response?.data || error.message
    );
    return { status: false, message: "Invalid QR Code" };
  }
};

/* ---------------------- CHECK-IN GUEST ---------------------- */

export const checkInGuest = async (eventId, payload) => {
  try {
    const response = await client.post(
      `/events/${eventId}/eventuser/checkin`,
      payload
    );

    return response.data;
  } catch (error) {
    console.log(
      "CHECK-IN ERROR:",
      error.response?.data || error.message
    );
    return { success: false, message: "Check-in failed" };
  }
};

/* ---------------------- GET FULL GUEST DETAILS ---------------------- */

export const getGuestDetails = async (eventId, eventUserId) => {
  try {
    const response = await client.get(
      `/events/${eventId}/eventuser/getguestdetails`,
      {
        params: { event_user_id: eventUserId }
      }
    );

    return response.data;
  } catch (error) {
    console.log(
      "GET GUEST DETAILS ERROR:",
      error.response?.data || error.message
    );
    return { success: false, message: "Failed to load guest details" };
  }
};

/* ---------------------- SYNC OFFLINE CHECK-INS ---------------------- */

export const syncOfflineCheckinsAPI = async (eventId, checkins) => {
  try {
    const response = await client.post(
      `/events/${eventId}/eventuser/verifyqrandcheckin`,
      checkins
    );

    return response.data;
  } catch (error) {
    console.log(
      "SYNC OFFLINE ERROR:",
      error.response?.data || error.message
    );
    return { success: false, message: error.message };
  }
};
