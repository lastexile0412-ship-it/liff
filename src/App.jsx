import { useEffect, useState } from "react";
import liff from "@line/liff";
import FallbackQR from "./components/FallbackQR.jsx";
import LiveQRScanner from "./components/LiveQRScanner.jsx";

// === 必改：你的 LIFF 深連結（用你的 LIFF ID） ===
const LIFF_LINK = "https://liff.line.me/2008067145-eY14D1Dq";

// === 必改：你的 Cloudflare Workers API 網址 ===
const API = "https://你的-worker.workers.dev";

// 呼叫後端：用序號領券
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
  const [showLiveScanner, setShowLiveScanner] = useState(false);
  const [notInLine, setNotInLine] = useState(false);

  useEffect(() => {
    // 先處理「不是用 LIFF 深連結打開」的情況：在 LINE 內則自動導回 LIFF 深連結
    const ua = navigator.userAgent?.toLowerCase?.() || "";
    const isLineInApp = ua.includes("line"); // in-app browser
    const isDeepLink = location.href.startsWith("https://liff.line.me/");
    if (isLineInApp && !isDeepLink) {
      location.replace(LIFF_LINK + location.search);
      return; // 讓瀏覽器跳轉，不要往下跑 liff.init
    }
    if (!isLineInApp) {
      setNotInLine(true); // 顯示提示：請用 LINE 開啟
    }

    // 到這裡就是在 LIFF 深連結頁，開始初始化
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
        alert("LIFF 初始化失敗，請確認 LIFF ID 與 Endpoint URL 已設定正確。");
      }
    })();
  }, []);

  // 1) 原生掃碼：能用就用，失敗則改成自建即時掃碼
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
      setShowLiveScanner(true); // 切到自建即時掃碼
    }
  };

  // 2) 手動輸入序號→領券
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

  // 若使用者不是用 LINE 開啟，給一個引導畫面
  if (notInLine && !ready) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-xl font-bold mb-2">請在 LINE 中開啟</h1>
        <p className="text-gray-600 mb-4">
          目前偵測到不是在 LINE App 內。若要使用掃碼與領券功能，請改用 LINE 開啟。
        </p>
        <a
          href={LIFF_LINK + location.search}
          className="px-4 py-2 rounded bg-green-600 text-white"
        >
          在 LINE 中開啟
        </a>
      </div>
    );
  }

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

      {/* 原生掃碼（優先） */}
      <button
        className="px-4 py-2 bg-black text-white rounded w-full sm:w-auto"
        onClick={scan}
      >
        掃碼（scanCodeV2） → 直接領券
      </button>

      {/* 即時相機掃碼（自建，不靠 LIFF API） */}
      <button
        className="px-4 py-2 bg-emerald-600 text-white rounded w-full sm:w-auto"
        onClick={() => setShowLiveScanner(true)}
      >
        即時掃碼（相機）
      </button>

      {/* 拍照辨識（備用） */}
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
        </div>
        <button
          className="px-4 py-2 rounded bg-blue-600 text-white w-full sm:w-auto"
          onClick={claimByManual}
        >
          使用
        </button>
      </div>

      {/* 最近掃到 / 輸入的序號 */}
      <div className="text-sm">
        <div className="font-medium mb-1">最近掃到的序號：</div>
        <div className="break-all text-gray-700">{scanResult || "（尚未掃描）"}</div>
      </div>

      {/* Debug：ID Token */}
      <details className="mt-4">
        <summary className="cursor-pointer">顯示 ID Token（給後端換 JWT 用）</summary>
        <div className="text-xs break-all mt-2">{idToken || "尚未取得"}</div>
      </details>

      {/* Overlay：即時掃碼 */}
      {showLiveScanner && (
        <LiveQRScanner
          onResult={async (value) => {
            setScanResult(value || "");
            if (value) {
              const go = confirm(`掃到序號：\n${value}\n\n要直接領券嗎？`);
              if (go) {
                try {
                  const data = await claimBySerialAPI(value, profile.userId);
                  alert("領券成功！序號：" + (data?.coupon?.serial || value));
                } catch (e) {
                  alert("領券失敗：" + e.message);
                }
              }
            }
          }}
          onClose={() => setShowLiveScanner(false)}
        />
      )}
    </div>
  );
}
