import { useRef, useState } from "react";
import jsQR from "jsqr";

export default function FallbackQR({ onResult }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function handlePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const bmp = await createImageBitmap(file);
      // 轉成 canvas 以便解析像素
      const canvas = document.createElement("canvas");
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bmp, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qr = jsQR(imgData.data, imgData.width, imgData.height);
      if (qr?.data) {
        onResult?.(qr.data);
      } else {
        alert("無法從照片辨識到 QR，請正對拍清楚一點再試一次。");
      }
    } catch (err) {
      console.error(err);
      alert("讀取影像失敗，請再試一次。");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePick}
        className="hidden"
        id="qr-fallback-input"
      />
      <button
        className="px-4 py-2 rounded bg-indigo-600 text-white w-full"
        onClick={() => document.getElementById("qr-fallback-input").click()}
        disabled={busy}
      >
        {busy ? "辨識中…" : "拍照辨識 QR（備用掃碼）"}
      </button>
      <p className="text-xs text-gray-500">
        若「掃碼（scanCodeV2）」不可用，請點此用相機拍照辨識 QR。
      </p>
    </div>
  );
}
