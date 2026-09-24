const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type','application/json').end(JSON.stringify(body));
};

const validUsername = value => /^[A-Za-z0-9_.-]{3,30}$/.test(value);

async function sbFetch(url, key, path, options = {}) {
  const r = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await r.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { r, data };
}

async function requireAdmin(req, res) {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY || serviceKey;
  if (!url || !serviceKey) { json(res, 500, {error:'Supabase server environment belum lengkap'}); return null; }

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) { json(res, 401, {error:'Token login diperlukan'}); return null; }

  const userResp = await fetch(`${url}/auth/v1/user`, {headers:{apikey:anonKey, Authorization:`Bearer ${token}`}});
  if (!userResp.ok) { json(res, 401, {error:'Sesi login tidak valid'}); return null; }
  const authUser = await userResp.json();
  const check = await sbFetch(url, serviceKey, `profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,username,role&limit=1`);
  const profile = check.data?.[0];
  if (!profile || profile.role !== 'admin') { json(res, 403, {error:'Akses admin diperlukan'}); return null; }
  return {url,serviceKey,authUser,profile};
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, {error:'Method not allowed'});
  const ctx = await requireAdmin(req, res);
  if (!ctx) return;
  const {url,serviceKey} = ctx;
  const body = req.body || {};
  const action = String(body.action || 'create');

  if (action === 'create') {
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const role = body.role === 'admin' ? 'admin' : 'user';
    if (!validUsername(username)) return json(res,400,{error:'Nama akun 3-30 karakter: huruf, angka, titik, garis bawah, atau strip.'});
    if (password.length < 8) return json(res,400,{error:'Password minimal 8 karakter.'});
    const exists = await sbFetch(url,serviceKey,`profiles?username=eq.${encodeURIComponent(username)}&select=id&limit=1`);
    if (exists.data?.length) return json(res,409,{error:'Nama akun sudah dipakai.'});
    const email = `${username.toLowerCase()}@ix6.local`;
    const create = await fetch(`${url}/auth/v1/admin/users`,{method:'POST',headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'},body:JSON.stringify({email,password,email_confirm:true,user_metadata:{username}})});
    const created = await create.json().catch(()=>({}));
    if (!create.ok) return json(res,create.status,{error:created.msg||created.message||'Gagal membuat akun'});
    const ins = await sbFetch(url,serviceKey,'profiles',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({id:created.id,username,display_name:username,role})});
    if (!ins.r.ok) return json(res,500,{error:'Akun dibuat tetapi profile gagal disimpan.'});
    return json(res,200,{ok:true,user:{id:created.id,username,role}});
  }

  if (action === 'set-role') {
    const userId = String(body.userId || '');
    const role = body.role === 'admin' ? 'admin' : 'user';
    if (!userId) return json(res,400,{error:'User tidak valid'});
    if (userId === ctx.authUser.id && role !== 'admin') return json(res,400,{error:'Admin terakhir tidak boleh menurunkan role dirinya sendiri.'});
    const upd = await sbFetch(url,serviceKey,`profiles?id=eq.${encodeURIComponent(userId)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({role})});
    if (!upd.r.ok) return json(res,upd.r.status,{error:upd.data?.message||'Gagal mengubah role'});
    return json(res,200,{ok:true});
  }

  if (action === 'reset-password') {
    const userId = String(body.userId || '');
    const password = String(body.password || '');
    if (!userId || password.length < 8) return json(res,400,{error:'User valid dan password minimal 8 karakter diperlukan.'});
    const r = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`,{method:'PUT',headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'},body:JSON.stringify({password})});
    const data = await r.json().catch(()=>({}));
    if (!r.ok) return json(res,r.status,{error:data.msg||data.message||'Gagal mengubah password'});
    return json(res,200,{ok:true});
  }

  return json(res,400,{error:'Aksi admin tidak dikenal'});
}
