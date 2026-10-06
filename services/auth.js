import {supabase} from '../lib/supabase.js'
export async function getSession(){return (await supabase.auth.getSession()).data.session}
export async function signIn(email,password){return supabase.auth.signInWithPassword({email,password})}
export async function signUp({email,password,full_name,username,age}){const r=await supabase.auth.signUp({email,password,options:{data:{full_name,username,age}}});if(r.error||!r.data.user)return r;if(r.data.session)await ensureProfile(r.data.user);return r}
export async function ensureProfile(user){const {data}=await supabase.from('profiles').select('*').eq('id',user.id).maybeSingle();if(data)return data;const m=user.user_metadata||{};const payload={id:user.id,full_name:m.full_name||user.email?.split('@')[0]||'Пользователь',username:m.username||`user_${user.id.slice(0,8)}`,age:Number(m.age)||null};const r=await supabase.from('profiles').upsert(payload).select().single();if(r.error)throw r.error;return r.data}
export const signOut=()=>supabase.auth.signOut()
