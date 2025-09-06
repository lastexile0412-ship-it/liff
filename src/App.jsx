import { useEffect, useState } from 'react';
import liff from '@line/liff';
import { supabase } from './lib/supabase';

const LIFF_ID = '<2008067145-eY14D1Dq>'; // 例如 2008067145-xxxxxxx

export default function App() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [serial, setSerial] = useState('');
  const [refPhone, setRefPhone] = useState('0987654321'); // 測試預設
  const [myCoupons, setMyCoupons] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) liff.login();
        const prof = await liff.getProfile();
        setProfile(prof);
        await refreshMyCoupons(prof.userId);
        setReady(true);
      } catch (e) {
        alert('LIFF 初始化失敗：' + e.message);
      }
    })();
  }, []);

  const scan = async () => {
    try {
      // 優先使用 scanCodeV2
      if (liff.isApiAvailable('scanCodeV2')) {
        const res = await liff.scanCodeV2();
        if (res?.value) {
          setSerial(res.value);
          await claim(res.value);
        }
        return;
      }
      // 後備（部分裝置）
      if (liff.isApiAvailable('scanCode')) {
        const res = await liff.scanCode();
        if (res?.value) {
          setSerial(res.value);
          await claim(res.value);
        }
        return;
      }
      alert('此裝置/設定不支援掃碼，請手動輸入序號。');
    } catch (e) {
      alert('掃碼失敗：' + e.message);
    }
  };

  const claim = async (sn) => {
    try {
      if (!profile) return alert('尚未取得 LINE 資料');
      const { userId, displayName, pictureUrl } = profile;

      const { data, error } = await supabase.rpc('claim_coupon_by_serial', {
        p_serial: sn,
        p_line_user_id: userId,
        p_display_name: displayName,
        p_picture_url: pictureUrl,
        p_referrer_phone: refPhone || null
      });

      if (error) throw error;
      if (!data?.ok) {
        return alert('領券失敗：' + (data?.reason || 'unknown'));
      }
      alert('領券成功！券ID：' + data.coupon_id);
      await refreshMyCoupons(userId);
    } catch (e) {
      alert('領券失敗：' + e.message);
    }
  };

  const refreshMyCoupons = async (userId) => {
    const { data, error } = await supabase.rpc('my_coupons', {
      p_line_user_id: userId
    });
    if (!error) setMyCoupons(data || []);
  };

  if (!ready) return <div style={{padding:16}}>載入中…</div>;

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui' }}>
      <h2>LIFF｜電子票券測試</h2>
      <div style={{ display:'flex', alignItems:'center', gap:12, margin:'12px 0' }}>
        {profile?.pictureUrl && (
          <img src={profile.pictureUrl} alt="" width={48} height={48}
               style={{ borderRadius: 8 }} />
        )}
        <div>
          <div>嗨，{profile?.displayName}</div>
          <div style={{ fontSize:12, color:'#666' }}>{profile?.userId}</div>
        </div>
      </div>

      <div style={{ display:'grid', gap:8, maxWidth:420 }}>
        <button onClick={scan} style={{ padding:12, fontSize:16 }}>
          掃碼（scanCodeV2）
        </button>

        <div style={{ display:'grid', gap:6 }}>
          <label>或手動輸入序號：</label>
          <input value={serial} onChange={e=>setSerial(e.target.value)} placeholder="例如 A1000-000001" />
          <label>推薦人手機（B）：</label>
          <input value={refPhone} onChange={e=>setRefPhone(e.target.value)} placeholder="例如 0987654321" />
          <button onClick={()=>claim(serial)}>使用（領券）</button>
        </div>
      </div>

      <hr style={{ margin:'16px 0' }} />

      <h3>我的票券</h3>
      <ul style={{ paddingLeft:16 }}>
        {myCoupons.map((c)=>(
          <li key={c.serial} style={{ margin:'8px 0' }}>
            <div>序號：{c.serial}</div>
            <div>狀態：{c.status}</div>
            <div>活動：{c.campaign_name} ｜ 面額：{(c.face_value||0)/100} 元</div>
            <div>發行商家：{c.merchant_a_name}（{c.merchant_a_phone}）</div>
            <div>到期：{c.expires_at}</div>
          </li>
        ))}
        {myCoupons.length===0 && <li>尚無票券</li>}
      </ul>
    </div>
  );
}
