const [scanResult, setScanResult] = useState("");
const [manual, setManual] = useState("");

// 取代原本的 scan 按鈕 handler
const scan = async () => {
  try {
    // 先檢查 API 是否可用
    if (!liff.isApiAvailable || !liff.isApiAvailable("scanCodeV2")) {
      alert("此裝置或目前設定不支援掃碼。請確認：1) LIFF 的 Scan QR 已開啟；2) LINE App 為最新版；3) 已授權相機。");
      return;
    }
    const res = await liff.scanCodeV2();
    setScanResult(res?.value || "");
  } catch (e) {
    alert("掃碼失敗（請確認在 LINE App 內開啟，且已授權相機）。");
  }
};
import { useEffect, useState } from "react";
import liff from "@line/liff";

const API = "https://voucher-api.lastexile0412.workers.dev";

async function exchange(idToken) {
  const r = await fetch(`${API}/api/v1/auth/line/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  return r.json();
}

async function claim(serial, lineUserId) {
  const r = await fetch(`${API}/api/v1/coupons/claim`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ serial, line_user_id: lineUserId }),
  });
  return r.json();
}

async function fetchMyCoupons(lineUserId) {
  const r = await fetch(`${API}/api/v1/coupons/mine?line_user_id=${encodeURIComponent(lineUserId)}`);
  return r.json();
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [idToken, setIdToken] = useState("");
  const [scanResult, setScanResult] = useState("");
  const [myCoupons, setMyCoupons] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        await liff.init({ liffId: import.meta.env.VITE_LIFF_ID });
        if (!liff.isLoggedIn()) liff.login();

        const token = liff.getIDToken() || "";
        setIdToken(token);

        const p = await liff.getProfile();
        setProfile(p);

        // 通知後端建立/更新會員
        await exchange(token);
        setReady(true);
      } catch (e) {
        console.error(e);
        alert("LIFF 初始化失敗：請確認 LIFF ID 與 Endpoint URL 已在 LINE 後台。");
      }
    })();
  }, []);

  const scan = async () => {
    try {
      const res = await liff.scanCodeV2();
      const serial = res?.value || "";
      setScanResult(serial);
      if (!serial) return;
      const c = await claim(serial, profile.userId);
      if (c.ok) {
        alert("領券成功！");
      } else {
        alert("領券失敗：" + (c.error || "未知錯誤"));
      }
    } catch (e) {
      alert("掃碼失敗（需在 LINE App 內開啟）");
    }
  };

  const showMine = async () => {
    if (!profile?.userId) return alert("尚未取得使用者資訊");
    const data = await fetchMyCoupons(profile.userId);
    setMyCoupons(data.items || []);
  };

  if (!ready) return <div className="p-6">啟動中…</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">LIFF 測試頁</h1>

      {profile && (
        <div className="flex items-center gap-3">
          <img src={profile.pictureUrl} width={56} height={56} className="rounded-full" />
          <div>嗨，{profile.displayName}</div>
        </div>
      )}

      <button className="px-4 py-2 bg-black text-white rounded" onClick={scan}>
        掃碼（scanCodeV2）→ 直接領券
      </button>

      <button className="px-4 py-2 bg-gray-800 text-white rounded" onClick={showMine}>
        我的票券
      </button>

      <div className="text-sm">
        最近掃到的序號：<span className="break-all">{scanResult || "（尚未掃描）"}</span>
      </div>

      {myCoupons?.length > 0 && (
        <div>
          <h2 className="font-semibold mt-4">我的票券</h2>
          <ul className="list-disc pl-5 text-sm">
            {myCoupons.map((c) => (
              <li key={c.serial} className="break-all">
                {c.serial}（{c.status}）
              </li>
            ))}
          </ul>
        </div>
      )}

      <details>
        <summary className="cursor-pointer">顯示 ID Token（給後端換 JWT 用）</summary>
        <div className="text-xs break-all mt-2">{idToken || "尚無資料"}</div>
      </details>
    </div>
  );
}
