const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type','application/json').end(JSON.stringify(body));
};

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, {error:'Method not allowed'});
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return json(res, 500, {error:'Supabase server environment belum lengkap'});

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return json(res, 401, {error:'Token login diperlukan'});

  const userResp = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: process.env.SUPABASE_ANON_KEY || serviceKey, Authorization:`Bearer ${token}` }
  });
  if (!userResp.ok) return json(res, 401, {error:'Sesi login tidak valid'});
  const authUser = await userResp.json();

  const adminCheck = await sbFetch(url, serviceKey, `profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,username,role&limit=1`);
  const profile = adminCheck.data?.[0];
  if (!profile || profile.role !== 'admin') return json(res, 403, {error:'Hanya admin yang boleh mengelola akun'});

  const body = req.body || {};
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (!username || !password) return json(res, 400, {error:'Username dan password wajib diisi'});

  const allowed = ['Rizky','Chalista','Syakina','Nadira'];
  if (!allowed.includes(username)) return json(res, 400, {error:'Akun hanya boleh Rizky, Chalista, Syakina, atau Nadira'});

  const countResp = await sbFetch(url, serviceKey, 'profiles?select=id&limit=10');
  if (Array.isArray(countResp.data) && countResp.data.length >= 4) return json(res, 409, {error:'Batas maksimal 4 akun sudah tercapai'});

  const email = `${username.toLowerCase()}@ix6.local`;
  const create = await fetch(`${url}/auth/v1/admin/users`, {
    method:'POST',
    headers:{apikey:serviceKey, Authorization:`Bearer ${serviceKey}`, 'Content-Type':'application/json'},
    body:JSON.stringify({email,password,email_confirm:true,user_metadata:{username}})
  });
  const created = await create.json().catch(()=>({}));
  if (!create.ok) return json(res, create.status, {error:created.msg || created.message || 'Gagal membuat akun'});

  const profileInsert = await sbFetch(url, serviceKey, 'profiles', {
    method:'POST',
    headers:{Prefer:'return=representation'},
    body:JSON.stringify({id:created.id,username,display_name:username,role:'user'})
  });
  if (!profileInsert.r.ok) return json(res, 500, {error:'Auth berhasil, tetapi profile gagal dibuat', detail:profileInsert.data});
  return json(res, 200, {ok:true, user:{id:created.id,username,email}});
}
