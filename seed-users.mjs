const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Set SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY');
const users = [
  {username:'Rizky', password:'Rizky12345', role:'admin'},
  {username:'Chalista', password:'Chalista12345', role:'user'},
  {username:'Syakina', password:'Syakina12345', role:'user'},
  {username:'Nadira', password:'Nadira12345', role:'user'}
];
for (const u of users) {
  const r = await fetch(`${url}/auth/v1/admin/users`, {
    method:'POST', headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({email:`${u.username.toLowerCase()}@ix6.local`,password:u.password,email_confirm:true,user_metadata:{username:u.username}})
  });
  const data = await r.json();
  if (!r.ok && !String(data.msg||data.message).toLowerCase().includes('already')) throw new Error(JSON.stringify(data));
  if (r.ok) {
    await fetch(`${url}/rest/v1/profiles`, {method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({id:data.id,username:u.username,display_name:u.username,role:u.role})});
  }
  console.log(u.username, r.ok ? 'created' : 'already exists');
}
