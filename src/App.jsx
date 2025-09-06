import { useEffect, useState } from "react";
import liff from "@line/liff";
import FallbackQR from "./components/FallbackQR.jsx"; // ← 前一步已新增

// TODO: 換成你的 Cloudflare Workers API 網址
const API = "https://voucher-api.lastexile0412.workers.dev";

// 直接用序號領券
async function claimBySerialAPI(serial, lineUserId) {
  const r = await fetch(`${API}/api/v1/coupons/claim`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ serial, line_user_id: lineUserId }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
  return data;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [idToken, setIdToken] = useState("");
  const [scanResult, setScanResult] = useState("");
  const [manualSerial, setManualSerial] = useState("");

  useEffect(() => {
    (async () => {
      try {
        await liff.init({ liffId: import.meta.env.VITE_LIFF_ID });
        if (!liff.isLoggedIn()) liff.login();

        setIdToken(liff.getIDToken() || "");
        const p = await liff.getProfile();
        setProfile(p);
        setReady(true);
      } catch (e) {
        console.error(e);
        alert("LIFF 初始化失敗，請確認 LIFF ID 與 Endpoint URL 已在 LINE 後台設定。");
      }
    })();
  }, []);

  // 原生掃碼：先試 scanCodeV2，失敗就提示改用備用/手動
  const scan = async () => {
    try {
      const inClient = liff.isInClient();
      const apiV2 = liff.isApiAvailable?.("scanCodeV2");
      if (!inClient || !apiV2) throw new Error("not_supported");

      const res = await liff.scanCodeV2();
      const value = res?.value || "";
      setScanResult(value);

      if (value) {
        const go = confirm(`掃到序號：\n${value}\n\n要直接領券嗎？`);
        if (go) {
          const data = await claimBySerialAPI(value, profile.userId);
          alert("領券成功！序號：" + (data?.coupon?.serial || value));
        }
      }
    } catch (e) {
      console.warn("scan error:", e);
      alert("此裝置目前無法使用原生掃碼，請改用下方『拍照辨識 QR（備用掃碼）』或手動輸入序號。");
    }
  };

  // 手動輸入序號→領券
  const claimByManual = async () => {
    const serial = manualSerial.trim();
    if (!serial) return alert("請先輸入序號");
    try {
      const data = await claimBySerialAPI(serial, profile.userId);
      alert("領券成功！序號：" + (data?.coupon?.serial || serial));
      setManualSerial("");
      setScanResult(serial);
    } catch (e) {
      alert("領券失敗：" + e.message);
    }
  };

  if (!ready) return <div className="p-6">啟動中…</div>;

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-2xl font-extrabold">LIFF 測試頁</h1>

      {profile && (
        <div className="flex items-center gap-3">
          {profile.pictureUrl && (
            <img
              src={profile.pictureUrl}
              width={56}
              height={56}
              className="rounded-full"
              alt="avatar"
            />
          )}
          <div className="font-medium">嗨，{profile.displayName}</div>
        </div>
      )}

      {/* 原生掃碼 */}
      <button
        className="px-4 py-2 bg-black text-white rounded w-full sm:w-auto"
        onClick={scan}
      >
        掃碼（scanCodeV2） → 直接領券
      </button>

      {/* 備用掃碼（拍照辨識 QR） */}
      <FallbackQR
        onResult={async (value) => {
          if (!value) return;
          setScanResult(value);
          const go = confirm(`辨識到序號：\n${value}\n\n要直接領券嗎？`);
          if (go) {
            try {
              const data = await claimBySerialAPI(value, profile.userId);
              alert("領券成功！序號：" + (data?.coupon?.serial || value));
            } catch (e) {
              alert("領券失敗：" + e.message);
            }
          }
        }}
      />

      {/* 手動輸入序號 */}
      <div className="space-y-2">
        <label className="block text-sm text-gray-600">或手動輸入序號：</label>
        <div className="flex gap-2">
          <input
            value={manualSerial}
            onChange={(e) => setManualSerial(e.target.value)}
            placeholder="輸入票券序號"
            className="border rounded px-3 py-2 flex-1"
          />
          <button
            className="px-4 py-2 rounded bg-blue-600 text-white"
            onClick={claimByManual}
          >
            使用
          </button>
        </div>
      </div>

      {/* 最近掃到 / 輸入的序號 */}
      <div className="text-sm">
        <div className="font-medium mb-1">最近掃到的序號：</div>
        <div className="break-all text-gray-700">{scanResult || "（尚未掃描）"}</div>
      </div>

      {/* Debug：展示 ID Token（可給後端換 JWT 用） */}
      <details className="mt-4">
        <summary className="cursor-pointer">顯示 ID Token（給後端換 JWT 用）</summary>
        <div className="text-xs break-all mt-2">{idToken || "尚未取得"}</div>
      </details>
    </div>
  );
}
