import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';

const LIFF_ID = import.meta.env.VITE_LIFF_ID || 'YOUR-LIFF-ID';

function useQuery() {
  return useMemo(() => {
    const p = new URLSearchParams(location.search);
    return {
      mode: p.get('mode') || 'claim',
      code: p.get('code') || '',
    };
  }, []);
}

export default function App() {
  const { mode, code } = useQuery();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);
  const [serial, setSerial] = useState('');
  const [scanErr, setScanErr] = useState('');
  const [log, setLog] = useState([]);
  const [recommender, setRecommender] = useState(''); // 推薦手機
  const [statusFilter, setStatusFilter] = useState(null);
  const [daysToExpire, setDaysToExpire] = useState(null);
  const [list, setList] = useState([]);

  const addLog = (m) => setLog((s) => [String(m), ...s]);

  useEffect(() => {
    (async () => {
      await liff.init({ liffId: LIFF_ID });
      if (!liff.isLoggedIn()) liff.login();
      const prof = await liff.getProfile();
      setProfile(prof);
      setReady(true);
    })();
  }, []);

  const scan = async () => {
    setScanErr('');
    try {
      // 掃碼
      const r = await liff.scanCodeV2();
      const text = r?.value || '';
      setSerial(text);
      addLog(`掃到：${text}`);
    } catch (e) {
      setScanErr('此裝置/目前設定不支援掃碼或被拒權限');
    }
  };

  // 領券
  const claim = async (useInput=false) => {
    try {
      const prof = profile || (await liff.getProfile());
      const useSerial = useInput ? serial.trim() : serial.trim();
      if (!useSerial) return alert('請先輸入或掃碼序號');

      const { data, error } = await supabase.rpc('claim_coupon_by_serial', {
        p_serial: useSerial,
        p_line_user_id: prof.userId,
        p_display_name: prof.displayName,
        p_picture_url: prof.pictureUrl || null,
        p_referrer_phone: recommender || null
      });
      if (error) throw error;
      if (!data?.ok) return alert('領券失敗：' + (data?.reason || 'unknown'));
      alert('領券成功！序號：' + useSerial);
    } catch (e) {
      alert('領券失敗：' + e.message);
    }
  };

  // 核銷
  const redeem = async () => {
    try {
      if (!code) return alert('缺少 ?code=商家代碼');
      const useSerial = serial.trim();
      if (!useSerial) return alert('請先輸入或掃碼序號');

      const { data, error } = await supabase.rpc('redeem_coupon_by_serial', {
        p_serial: useSerial,
        p_merchant_code: code,
        p_tx_amount: 0
      });
      if (error) throw error;
      if (!data?.ok) return alert('核銷失敗：' + (data?.reason || 'unknown'));
      alert('核銷成功！序號：' + useSerial);
    } catch (e) {
      alert('核銷失敗：' + e.message);
    }
  };

  // 綁定商家 LINE
  const bindMerchant = async () => {
    try {
      if (!code) return alert('缺少 ?code=商家代碼');
      const prof = profile || (await liff.getProfile());
      const { data, error } = await supabase.rpc('bind_merchant_line_user', {
        p_merchant_code: code,
        p_line_user_id: prof.userId
      });
      if (error) throw error;
      if (!data?.ok) return alert('綁定失敗：' + (data?.reason || 'unknown'));
      alert('綁定成功！之後通知會推播到此 LINE 帳號。');
    } catch (e) {
      alert('綁定失敗：' + e.message);
    }
  };

  // 商家清單
  const loadList = async () => {
    try {
      const prof = profile || (await liff.getProfile());
      const { data, error } = await supabase.rpc('list_coupons_for_merchant', {
        p_merchant_code: code || null,
        p_line_user_id: prof.userId,
        p_status_filter: statusFilter,
        p_days_to_expire: daysToExpire ? Number(daysToExpire) : null,
        p_limit: 200,
        p_offset: 0
      });
      if (error) throw error;
      setList(data || []);
    } catch (e) {
      alert('載入失敗：' + e.message);
    }
  };

  useEffect(() => {
    if (!ready) return;
    if (mode === 'dashboard') loadList();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) return <div style={{padding:16}}>初始化中…</div>;

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h2>LIFF 票券系統（{mode}）</h2>
      <div style={{marginBottom:8}}>嗨，{profile?.displayName}</div>

      {(mode==='claim' || mode==='redeem') && (
        <>
          <div style={{ display: 'flex', gap: 8, margin:'12px 0' }}>
            <button onClick={scan}>掃碼（scanCodeV2）</button>
            <input
              placeholder="或手動輸入序號"
              value={serial}
              onChange={e=>setSerial(e.target.value)}
              style={{ flex:1 }}
            />
          </div>
          {scanErr && <div style={{color:'tomato'}}>{scanErr}</div>}

          {mode==='claim' && (
            <>
              <div style={{margin:'8px 0'}}>
                <input
                  placeholder="推薦手機（B）可留空"
                  value={recommender}
                  onChange={e=>setRecommender(e.target.value)}
                  style={{ width:'100%' }}
                />
              </div>
              <button onClick={()=>claim(true)} style={{background:'#222',color:'#fff',padding:'8px 12px'}}>領券</button>
            </>
          )}
          {mode==='redeem' && (
            <div>
              <div style={{margin:'4px 0', color:'#666'}}>商家代碼：{code || '(未提供)'}</div>
              <button onClick={redeem} style={{background:'#0a7',color:'#fff',padding:'8px 12px'}}>核銷</button>
            </div>
          )}

          <details style={{marginTop:16}}>
            <summary>Debug</summary>
            <pre>{JSON.stringify(profile,null,2)}</pre>
            <div>{log.map((x,i)=><div key={i}>{x}</div>)}</div>
          </details>
        </>
      )}

      {mode==='bind' && (
        <div>
          <div style={{margin:'6px 0'}}>商家代碼：{code || '(未提供)'}</div>
          <button onClick={bindMerchant} style={{background:'#06c',color:'#fff',padding:'8px 12px'}}>綁定到此商家</button>
        </div>
      )}

      {mode==='dashboard' && (
        <div>
          <div style={{marginBottom:8}}>商家代碼（可空）：{code || '(使用綁定的商家)'}</div>
          <div style={{display:'flex', gap:8, marginBottom:8}}>
            <select value={statusFilter || ''} onChange={e=>setStatusFilter(e.target.value || null)}>
              <option value="">全部狀態</option>
              <option value="issued">未上架</option>
              <option value="transferred">已領券</option>
              <option value="redeemed">已核銷</option>
            </select>
            <input
              type="number"
              placeholder="N 天內到期"
              value={daysToExpire || ''}
              onChange={e=>setDaysToExpire(e.target.value || null)}
              style={{width:120}}
            />
            <button onClick={loadList}>重新整理</button>
          </div>

          <table width="100%" cellPadding="6" style={{borderCollapse:'collapse', fontSize:14}}>
            <thead>
              <tr style={{background:'#f5f5f5'}}>
                <th align="left">序號</th>
                <th align="left">活動</th>
                <th align="left">面額</th>
                <th align="left">狀態</th>
                <th align="left">到期</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r,i)=>{
                const color = r.status==='redeemed' ? '#0a7' : r.status==='transferred' ? '#06c' : '#777';
                const danger = r.expires_at && new Date(r.expires_at) <= new Date(Date.now()+7*86400000);
                return (
                  <tr key={i} style={{borderTop:'1px solid #eee'}}>
                    <td>{r.serial}</td>
                    <td>{r.campaign_name}</td>
                    <td>{Math.round((r.face_value||0)/100)} 元</td>
                    <td style={{color}}>{r.status}</td>
                    <td style={{color: danger?'tomato':undefined}}>
                      {r.expires_at ? new Date(r.expires_at).toISOString().slice(0,10) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
