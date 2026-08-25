const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();
const db = admin.firestore();

// আপনার টেলিগ্রাম বোটের টোকেন
const BOT_TOKEN = "8895211701:AAGo31P6oWpyhM7KX2D-atbWxWAojIqZtVU";

// ৪টি চ্যানেলের ইউজারনেম
const REQUIRED_CHANNELS = [
  "@rdx_signel_gurup",
  "@the_earning_1122",
  "@mining_the_gorup",
  "@easy_income_cenel"
];

// ১. টেলিগ্রাম ইনিট ডেটা পার্সার
function verifyTelegramWebAppData(initData) {
  try {
    const urlParams = new URLSearchParams(initData);
    const userStr = urlParams.get('user');
    if (!userStr) return null;
    return JSON.parse(userStr);
  } catch (e) {
    return null;
  }
}

// ২. চ্যানেল জয়েন ভেরিফিকেশন API
exports.verifyUserChannels = onCall(async (request) => {
  const initData = request.data?.initData;
  const user = verifyTelegramWebAppData(initData);

  if (!user || !user.id) {
    throw new HttpsError("unauthenticated", "Unauthorized user");
  }

  const userId = user.id;

  try {
    for (const channel of REQUIRED_CHANNELS) {
      const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember`, {
        params: { chat_id: channel, user_id: userId }
      });

      const status = response.data?.result?.status;
      if (status === "left" || status === "kicked" || !status) {
        return { success: false, message: `Not joined in ${channel}` };
      }
    }

    await db.collection("users").doc(String(userId)).set({
      channelVerified: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { success: true };
  } catch (error) {
    console.error("Error verifying channels:", error?.response?.data || error.message);
    return { success: false, message: "Verification error. Make sure bot is admin in channels." };
  }
});

// ৩. রেফারেল প্রসেসিং API
exports.processReferral = onCall(async (request) => {
  const { initData, referralId } = request.data || {};
  const user = verifyTelegramWebAppData(initData);

  if (!user || !user.id) return { success: false };

  const userId = String(user.id);
  const refId = String(referralId);

  if (userId === refId) return { success: false };

  const userDocRef = db.collection("users").doc(userId);
  const userSnapshot = await userDocRef.get();

  if (!userSnapshot.exists) {
    const refDocRef = db.collection("users").doc(refId);

    await db.runTransaction(async (transaction) => {
      transaction.set(userDocRef, {
        balance: 0,
        referrals: 0,
        dailyAds: 0,
        invitedBy: refId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      const refSnap = await transaction.get(refDocRef);
      const currentRefs = refSnap.exists ? (refSnap.data().referrals || 0) : 0;
      const currentBal = refSnap.exists ? (refSnap.data().balance || 0) : 0;

      transaction.set(refDocRef, {
        referrals: currentRefs + 1,
        balance: currentBal + 300
      }, { merge: true });
    });
  }
  return { success: true };
});

// ৪. মাইনিং কমপ্লিট API
exports.completeMining = onCall(async (request) => {
  const { rate, initData } = request.data || {};
  const user = verifyTelegramWebAppData(initData);
  if (!user || !user.id) throw new HttpsError("unauthenticated", "Unauthorized");

  const userRef = db.collection("users").doc(String(user.id));
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(userRef);
    const currentBalance = doc.exists ? (doc.data().balance || 0) : 0;
    transaction.set(userRef, { balance: currentBalance + (rate || 0) }, { merge: true });
  });

  return { success: true };
});

// ৫. স্পিন রিওয়ার্ড API
exports.rewardSpin = onCall(async (request) => {
  const { amount, initData } = request.data || {};
  const user = verifyTelegramWebAppData(initData);
  if (!user || !user.id) throw new HttpsError("unauthenticated", "Unauthorized");

  const userRef = db.collection("users").doc(String(user.id));
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(userRef);
    const currentBalance = doc.exists ? (doc.data().balance || 0) : 0;
    transaction.set(userRef, { balance: currentBalance + (amount || 0) }, { merge: true });
  });

  return { success: true };
});

// ৬. ডেইলি টাস্ক API
exports.completeTask = onCall(async (request) => {
  const { initData } = request.data || {};
  const user = verifyTelegramWebAppData(initData);
  if (!user || !user.id) throw new HttpsError("unauthenticated", "Unauthorized");

  const userRef = db.collection("users").doc(String(user.id));
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(userRef);
    const data = doc.exists ? doc.data() : {};
    const dailyAds = (data.dailyAds || 0) + 1;
    const balance = (data.balance || 0) + 50;

    if (dailyAds > 30) throw new HttpsError("resource-exhausted", "Daily limit reached");

    transaction.set(userRef, { balance, dailyAds }, { merge: true });
  });

  return { success: true };
});

// ৭. উইথড্রল রিকোয়েস্ট API
exports.requestWithdrawal = onCall(async (request) => {
  const { wallet, network, initData } = request.data || {};
  const user = verifyTelegramWebAppData(initData);
  if (!user || !user.id) throw new HttpsError("unauthenticated", "Unauthorized");

  const userId = String(user.id);
  const userRef = db.collection("users").doc(userId);
  const doc = await userRef.get();

  if (!doc.exists) throw new HttpsError("not-found", "User not found");
  const data = doc.data();

  if ((data.balance || 0) < 100000) throw new HttpsError("failed-precondition", "Minimum withdrawal is 100,000 ATF");
  if ((data.referrals || 0) < 10) throw new HttpsError("failed-precondition", "Minimum 10 referrals required");

  await db.collection("withdrawals").add({
    userId,
    wallet,
    network,
    amount: data.balance,
    status: "pending",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  await userRef.update({ balance: 0 });

  return { success: true, message: "Withdrawal request submitted successfully!" };
});