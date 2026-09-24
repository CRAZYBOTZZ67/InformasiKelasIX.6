const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body));
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, {error:'Method not allowed'});

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return json(res, 500, {error:'Supabase server environment belum lengkap'});

  const body = req.body || {};
  const username = String(body.username || '').trim();
  const password = String(body.password || '');

  if (!validUsername(username)) return json(res, 400, {error:'Nama akun 3-30 karakter: huruf, angka, titik, garis bawah, atau strip.'});
  if (password.length < 8) return json(res, 400, {error:'Password minimal 8 karakter.'});

  const exists = await sbFetch(url, serviceKey, `profiles?username=eq.${encodeURIComponent(username)}&select=id&limit=1`);
  if (!exists.r.ok) return json(res, 500, {error:'Gagal mengecek nama akun'});
  if (Array.isArray(exists.data) && exists.data.length) return json(res, 409, {error:'Nama akun sudah dipakai.'});

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
  if (!profileInsert.r.ok) {
    await fetch(`${url}/auth/v1/admin/users/${created.id}`, {
      method:'DELETE', headers:{apikey:serviceKey, Authorization:`Bearer ${serviceKey}`}
    }).catch(()=>{});
    return json(res, 500, {error:'Akun dibuat tetapi profile gagal disimpan.'});
  }

  return json(res, 200, {ok:true, user:{id:created.id,username}});
}
