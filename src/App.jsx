import { useEffect, useState } from "react";
import liff from "@line/liff";

/** ←←← 把這裡換成你的 Workers 網址（不需要尾巴斜線） */
const API = "https://voucher-api.lastexile0412.workers.dev";

/** ---- 後端 API helpers ---- **/
async function exchange(idToken) {
  const r = await fetch(`${API}/api/v1/auth/line/exchange`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  return r.json();
}

async function claimSerial(serial, lineUserId) {
  const r = await fetch(`${API}/api/v1/coupons/claim`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ serial, line_user_id: lineUserId }),
  });
  return r.json();
}

async function fetchMyCoupons(lineUserId) {
  const r = await fetch(
    `${API}/api/v1/coupons/mine?line_user_id=${encodeURIComponent(lineUserId)}`
  );
  return r.json();
}

/** ---- React App ---- **/
export default function App() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [idToken, setIdToken] = useState("");
  const [scanResult, setScanResult] = useState("");
  const [manual, setManual] = useState("");
  const [myCoupons, setMyCoupons] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        // 初始化 LIFF（LIFF ID 來自 Cloudflare Pages 的環境變數）
        await liff.init({ liffId: import.meta.env.VITE_LIFF_ID });
        if (!liff.isLoggedIn()) liff.login();

        const token = liff.getIDToken() || "";
        setIdToken(token);

        const p = await liff.getProfile();
        setProfile(p);

        // 告知後端 / 建立會員（可改為你的自簽 JWT 流程）
        await exchange(token);

        setReady(true);
      } catch (e) {
        console.error(e);
        setErr(
          "LIFF 初始化失敗。請確認：1) VITE_LIFF_ID 是否為此 LIFF 的 ID；2) LIFF 的 Endpoint URL 是否等於你現在打開的網址；3) 已在 LINE App 內開啟本頁。"
        );
        alert("LIFF 初始化失敗，請檢查設定。");
      }
    })();
  }, []);

  /** 單一且正確的掃碼函式 */
  const scan = async () => {
    try {
      if (!liff.isApiAvailable || !liff.isApiAvailable("scanCodeV2")) {
        alert(
          "此裝置/目前設定不支援掃碼。\n請確認：\n1) LIFF 的 Scan QR 已開啟並已儲存\n2) LINE App 為最新版\n3) 已授權相機權限"
        );
        return;
      }
      const res = await liff.scanCodeV2();
      const value = res?.value?.trim();
      setScanResult(value || "");
      if (!value) {
        alert("掃碼完成，但沒有讀到內容。");
        return;
      }
      // 直接用掃到的序號領券
      await handleClaim(value);
    } catch (e) {
      console.error(e);
      alert("掃碼失敗（請確認在 LINE App 內開啟，且已授權相機）。");
    }
  };

  /** 領券封裝（給掃碼與手動輸入共用） */
  const handleClaim = async (serial) => {
    if (!profile?.userId) {
      alert("尚未取得使用者資訊，請稍後重試。");
      return;
    }
    if (!serial) {
      alert("請輸入序號或先掃碼。");
      return;
    }
    const res = await claimSerial(serial, profile.userId);
    if (res?.ok) {
      alert("領券成功！");
      const data = await fetchMyCoupons(profile.userId);
      setMyCoupons(data.items || []);
    } else {
      alert("領券失敗：" + (res?.error || "unknown"));
    }
  };

  /** 查我的票券 */
  const showMine = async () => {
    if (!profile?.userId) {
      alert("尚未取得使用者資訊。");
      return;
    }
    const data = await fetchMyCoupons(profile.userId);
    setMyCoupons(data.items || []);
  };

  if (!ready) return <div className="p-6">啟動中…</div>;

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-xl font-bold">LIFF 測試頁</h1>

      {err && (
        <div className="p-3 rounded bg-red-100 text-red-700 text-sm whitespace-pre-line">
          {err}
        </div>
      )}

      {profile && (
        <div className="flex items-center gap-3">
          {profile.pictureUrl && (
            <img
              src={profile.pictureUrl}
              width={56}
              height={56}
              className="rounded-full"
            />
          )}
          <div>嗨，{profile.displayName}</div>
        </div>
      )}

      {/* 掃碼 + 手動輸入備援 */}
      <div className="space-y-3">
        <button
          className="px-4 py-2 bg-black text-white rounded"
          onClick={scan}
        >
          掃碼（scanCodeV2） → 直接領券
        </button>

        <div className="text-sm">或手動輸入序號：</div>
        <div className="flex gap-2">
          <input
            className="border px-3 py-2 flex-1 rounded"
            placeholder="輸入票券序號"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          <button
            className="px-3 py-2 bg-blue-600 text-white rounded"
            onClick={() => handleClaim(manual.trim())}
          >
            使用
          </button>
        </div>

        <div>
          最近掃到的序號：{" "}
          <span className="break-all">{scanResult || "（尚未掃描）"}</span>
        </div>
      </div>

      <button
        className="px-4 py-2 bg-gray-800 text-white rounded"
        onClick={showMine}
      >
        我的票券
      </button>

      {myCoupons.length > 0 && (
        <div className="mt-2">
          <h2 className="font-semibold mt-4 mb-2">我的票券（{myCoupons.length}）</h2>
          <ul className="list-disc pl-5 text-sm">
            {myCoupons.map((c, i) => (
              <li key={i} className="break-all">
                {c.serial}（{c.status}）
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer">顯示 ID Token（給後端換 JWT 用）</summary>
        <div className="text-xs break-all mt-2">{idToken || "尚未取得"}</div>
      </details>

      <details className="mt-2">
        <summary className="cursor-pointer">Debug</summary>
        <div className="text-xs mt-2 space-y-1">
          <div>LIFF_ID：{import.meta.env.VITE_LIFF_ID || "(未設)"}</div>
          <div>URL：{location.origin}</div>
          <div>isApiAvailable(scanCodeV2)：{String(liff.isApiAvailable?.("scanCodeV2"))}</div>
        </div>
      </details>
    </div>
  );
}
