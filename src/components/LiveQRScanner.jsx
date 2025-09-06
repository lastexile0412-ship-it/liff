import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/**
 * 即時相機掃碼（不依賴 LIFF API）
 * props:
 *  - onResult(value: string)
 *  - onClose()
 */
export default function LiveQRScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [err, setErr] = useState("");
  const [running, setRunning] = useState(false);
  const rafRef = useRef(0);
  const streamRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        setErr("");
        // 先嘗試後鏡頭
        const constraints = {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setRunning(true);
        tick(); // 開始解析
      } catch (e) {
        console.error(e);
        setErr("無法開啟相機，請確認已授權攝影機權限。");
      }
    })();

    return () => {
      cancelAnimationFrame(rafRef.current);
      setRunning(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tick = () => {
    rafRef.current = requestAnimationFrame(tick);
    if (!running) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);

    const img = ctx.getImageData(0, 0, w, h);
    const qr = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
    if (qr?.data) {
      // 偵測到就回傳並關閉
      onResult?.(qr.data);
      onClose?.();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
      <div className="bg-white rounded-2xl w-[92%] max-w-md overflow-hidden shadow-xl">
        <div className="px-4 py-3 border-b font-bold">即時掃碼</div>
        <div className="p-4 space-y-3">
          {err ? (
            <div className="text-red-600 text-sm">{err}</div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full rounded-lg"
                playsInline
                muted
                autoPlay
              />
              <canvas ref={canvasRef} className="hidden" />
              <p className="text-xs text-gray-500">
                將 QR 置於框內，辨識到即自動關閉。
              </p>
            </>
          )}
          <button
            className="w-full px-4 py-2 rounded bg-gray-800 text-white"
            onClick={() => onClose?.()}
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
