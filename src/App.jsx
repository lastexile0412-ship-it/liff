import { useEffect, useMemo, useState } from 'react';
import liff from '@line/liff';
import { createClient } from '@supabase/supabase-js';

const LIFF_ID = '2008067145-eY14D1Dq'; // e.g. "2008067145-xxxxxxx"
const TOKEN_EXCHANGE_URL = '/token-exchange'; // 部署在同一個 Cloudflare Pages

// 你的 Supabase 專案 URL（跟 functions 用的一致）：
const SUPABASE_URL = 'hhttps://qczgbxfffqcdhctutdhq.supabase.co';

// NOTE: 這裡不放 anon key。因為我們用自簽的 RLS JWT 當 Bearer。
function makeSupabaseWithBearer(jwt) {
  return createClient(SUPABASE_URL, 'anon-key-not-used', {
    global: {
      headers: { Authorization: `Bearer ${jwt}` },
    },
  });
}

export default function App() {
  const [profile, setProfile] = useState(null);
  const [jwt, setJwt] = useState('');
  const [sb, setSb] = useState(null);
  const [loading, setLoading] = useState(true);

  // 清單
  const [coupons, setCoupons] = useState([]);

  // 手動輸入
  const [manualSerial, setManualSerial] = useState('');
  const [refPhone, setRefPhone] = useState('');

  useEffect(() => {
    (async () => {
      try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const idToken = liff.getIDToken();
        const u = await liff.getProfile();

        // 向後端交換 Supabase RLS 用 JWT
        const res = await fetch(TOKEN_EXCHANGE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken,
            displayName: u.displayName,
            pictureUrl: u.pictureUrl,
            email: null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'token-exchange-failed');

        setProfile(u);
        setJwt(data.token);
        const client = makeSupabaseWithBearer(data.token);
        setSb(client);

        // 讀自己的券清單（v_my_coupons）
        const { data: rows, error } = await client
          .from('v_my_coupons')
          .select('*')
          .order('expires_at', { ascending: true });

        if (error) throw error;
        setCoupons(rows || []);
      } catch (e) {
        alert('初始化失敗：' + String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function reloadList(client) {
    const c = client || sb;
    if (!c) return;
    const { data: rows } = await c
      .from('v_my_coupons')
      .select('*')
      .order('expires_at', { ascending: true });
    setCoupons(rows || []);
  }

  async function handleScanAndClaim() {
    try {
      // 使用 scanCodeV2
      const result = await liff.scanCodeV2();
      const serial = result?.value?.trim();
      if (!serial) return;

      await claim(serial, refPhone);
      await reloadList();
    } catch (e) {
      alert('掃碼失敗：' + String(e));
    }
  }

  async function claim(serial, phone) {
    if (!sb) return;
    // 呼叫 RPC：claim_coupon
    const { data, error } = await sb.rpc('claim_coupon', {
      p_serial: serial,
      p_referrer_phone: phone || null,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.ok) {
      if (row?.message === 'ALREADY_CLAIMED')
        alert('這張券已被領取');
      else if (row?.message === 'NOT_FOUND')
        alert('查無此序號');
      else
        alert('領券失敗：' + row?.message);
    } else {
      alert('領券成功！');
    }
  }

  if (loading) return <div style={{ padding: 16 }}>載入中…</div>;

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif' }}>
      <h2>LIFF 權益卡</h2>

      {profile && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          {profile.pictureUrl && (
            <img
              src={profile.pictureUrl}
              alt="avatar"
              width={56}
              height={56}
              style={{ borderRadius: '50%' }}
            />
          )}
          <div>
            <div>{profile.displayName}</div>
            <small style={{ color: '#666' }}>已登入 LINE</small>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button onClick={handleScanAndClaim} style={btn()}>掃碼領券</button>
      </div>

      <div style={{ border: '1px solid #eee', padding: 12, borderRadius: 8, marginBottom: 16 }}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>或手動輸入序號 / 推薦手機（B 店）</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            placeholder="輸入券序號"
            value={manualSerial}
            onChange={(e) => setManualSerial(e.target.value)}
            style={input()}
          />
          <input
            placeholder="推薦人手機（選填）"
            value={refPhone}
            onChange={(e) => setRefPhone(e.target.value)}
            style={input()}
          />
          <button
            style={btn()}
            onClick={async () => {
              if (!manualSerial) return alert('請輸入序號');
              await claim(manualSerial.trim(), refPhone.trim() || null);
              setManualSerial('');
              await reloadList();
            }}
          >
            領券
          </button>
        </div>
      </div>

      <h3 style={{ marginTop: 0 }}>我的券</h3>
      {(!coupons || coupons.length === 0) ? (
        <div style={{ color: '#777' }}>尚無券</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {coupons.map((c, i) => (
            <div key={i} style={card()}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 700 }}>{c.campaign_name}</div>
                <div style={{ color: '#06c', fontWeight: 700 }}>NT$ {c.face_value}</div>
              </div>
              <div style={{ color: '#444', marginTop: 4 }}>{c.product_name || c.benefit_desc || '—'}</div>
              <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                發行店：{c.merchant_a_name}　{c.merchant_a_phone}　{c.merchant_a_address}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
                序號：{c.serial}　狀態：{c.status}　到期：{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function btn() {
  return {
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #ddd',
    background: '#111',
    color: '#fff',
    cursor: 'pointer',
  };
}
function input() {
  return {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 8,
    border: '1px solid #ddd',
  };
}
function card() {
  return {
    padding: 12,
    borderRadius: 12,
    border: '1px solid #eee',
    background: '#fff',
    boxShadow: '0 1px 2px rgba(0,0,0,.04)',
  };
}
