import { useEffect, useState } from "react";
import liff from "@line/liff";

// === 後端 API 基本設定 ===
const API = "https://voucher-api.lastexile0412.workers.dev";

async function exchange(idToken) {
  const r = await fetch(`${API}/api/v1/auth/line/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  return r.json();
}

async function fetchMyCoupons(lineUserId) {
  // 目前後端還沒接資料庫，先佔位；之後接上 Supabase 就能回資料
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

        // 呼叫後端做 LINE id_token 驗證，拿到 member 基本資料
        const ex = await exchange(token);
        // 可先看一下結果
        console.log("exchange:", ex);

        setReady(true);
      } catch (e) {
        console.error(e);
        alert("LIFF 初始化失敗：請確認 LIFF ID 和 Endpoint URL 已在 LINE 後台設定。");
      }
    })();
  }, []);

  const scan = async () => {
    try {
      const res = await liff.scanCodeV2();
      setScanResult(res?.value || "");
      alert(`掃碼結果：${res?.value || ""}`);
      // 之後這裡可直接把序號呼叫 /coupons/claim 去領券
    } catch (e) {
      alert("掃碼失敗（需在 LINE App 內開啟）");
    }
  };

  const showMine = async () => {
    if (!profile?.userId) {
      alert("尚未取得使用者資訊");
      return;
    }
    const data = await fetchMyCoupons(profile.userId);
    // 後端現在回 501 只是占位，接上 Supabase 後這裡會有清單
    if (data?.items) setMyCoupons(data.items);
    alert(`（示範）目前我的票券筆數：${data?.items?.length ?? 0}`);
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
        掃碼（scanCodeV2）
      </button>

      <button className="px-4 py-2 bg-gray-800 text-white rounded" onClick={showMine}>
        我的票券（示範）
      </button>

      <div className="text-sm">
        掃碼結果：<span className="break-all">{scanResult || "（尚未掃描）"}</span>
      </div>

      <details>
        <summary className="cursor-pointer">顯示 ID Token（給後端換 JWT 用）</summary>
        <div className="text-xs break-all mt-2">{idToken || "尚無資料"}</div>
      </details>

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
    </div>
  );
}
