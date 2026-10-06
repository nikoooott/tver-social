import {supabase} from '../lib/supabase.js'

export async function signIn(email,password){return supabase.auth.signInWithPassword({email,password})}

export async function usernameAvailable(username,excludeId=null){
  const clean=String(username||'').trim().toLowerCase()
  if(!/^[a-z0-9_]{4,20}$/.test(clean)) return {ok:false,reason:'Username: 4–20 символов, только a-z, 0-9 и _'}
  let q=supabase.from('profiles').select('id').eq('username',clean).maybeSingle()
  const r=await q
  if(r.error && r.error.code!=='PGRST116') return {ok:false,reason:r.error.message}
  if(r.data && r.data.id!==excludeId) return {ok:false,reason:'Этот username уже занят'}
  return {ok:true}
}

export async function signUp({email,password,full_name,username,age,city}){
  const clean=username.trim().toLowerCase()
  const check=await usernameAvailable(clean)
  if(!check.ok) return {error:new Error(check.reason)}
  const r=await supabase.auth.signUp({email,password,options:{data:{full_name,username:clean,age}}})
  if(r.error||!r.data.user)return r
  if(r.data.session) await ensureProfile(r.data.user)
  return r
}

export async function ensureProfile(user){
  const {data}=await supabase.from('profiles').select('*').eq('id',user.id).maybeSingle()
  if(data){
    await supabase.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',user.id)
    return {...data,last_seen:new Date().toISOString()}
  }
  const m=user.user_metadata||{}
  const username=(m.username||`user_${user.id.slice(0,8)}`).toLowerCase()
  const payload={id:user.id,full_name:m.full_name||user.email?.split('@')[0]||'Пользователь',username,age:Number(m.age)||null,city:m.city||'Тверь',last_seen:new Date().toISOString()}
  const r=await supabase.from('profiles').upsert(payload).select().single()
  if(r.error)throw r.error
  return r.data
}

export async function touchPresence(userId){if(userId)await supabase.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',userId)}
export const signOut=()=>supabase.auth.signOut()
