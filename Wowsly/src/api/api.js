import client from "./client";

export const sendOTP = async (dialing_code, mobile) => {
  try {
    const response = await client.post("/send-one-time-pass", {
      dialing_code,
      mobile,
      otp_method: "whatsapp",
      platform: "app",
      g_recaptcha_response: "mobile_app_bypass", // ✅ ADD THIS
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
