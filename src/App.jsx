const scan = async () => {
  try {
    const inClient = liff.isInClient();
    const apiV2 = liff.isApiAvailable?.("scanCodeV2");
    const ua = navigator.userAgent;
    const ctx = liff.getContext?.();

    // 先顯示關鍵判斷值（幫我截圖這個彈窗）
    alert(
      `診斷資訊：
inClient=${inClient}
scanCodeV2=${apiV2}
os=${liff.getOS?.() || "?"}
lang=${liff.getLanguage?.() || "?"}
appVersion=${liff.getVersion?.() || "?"}
context=${ctx ? JSON.stringify(ctx) : "?"}
UA=${ua}`
    );

    if (!inClient) {
      throw new Error("not_in_client");
    }

    // 先試 v2
    if (apiV2) {
      const res = await liff.scanCodeV2();
      setScanResult(res?.value || "");
      return;
    }

    // 若 v2 不可用，嘗試舊版 scanCode（部分裝置可用）
    const apiV1 = liff.isApiAvailable?.("scanCode");
    if (apiV1 && liff.scanCode) {
      const res = await liff.scanCode();
      setScanResult(res?.value || "");
      return;
    }

    throw new Error("no_scan_api");
  } catch (e) {
    // 把真實錯誤訊息顯示出來（請截圖給我）
    const msg =
      (e && (e.message || e.code || JSON.stringify(e))) || "unknown_error";
    alert(`掃碼例外：${msg}`);
    console.error(e);
  }
};
