import { useEffect, useState } from "react";
import liff from "@line/liff";

export default function App() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [idToken, setIdToken] = useState("");
  const [scanResult, setScanResult] = useState("");

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

  const scan = async () => {
    try {
      const res = await liff.scanCodeV2();
      setScanResult(res?.value || "");
    } catch (e) {
      alert("掃碼需在 LINE App 內開啟這個頁面。");
    }
  };

  if (!ready) return <div className="p-6">啟動中…</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">LIFF 測試頁</h1>

      {profile && (
        <div className="flex items-center gap-3">
          {profile.pictureUrl && (
            <img src={profile.pictureUrl} width={56} height={56} className="rounded-full" />
          )}
          <div>嗨，{profile.displayName}</div>
        </div>
      )}

      <button className="px-4 py-2 bg-black text-white rounded" onClick={scan}>
        掃碼（scanCodeV2）
      </button>
      <div>掃碼結果：<span className="break-all">{scanResult || "（尚未掃描）"}</span></div>

      <details>
        <summary className="cursor-pointer">顯示 ID Token（給後端換 JWT 用）</summary>
        <div className="text-xs break-all mt-2">{idToken || "尚未取得"}</div>
      </details>
    </div>
  );
}
