import {supabase} from '../lib/supabase.js'

export async function profile(id){const r=await supabase.from('profiles').select('*').eq('id',id).single();if(r.error)throw r.error;return r.data}

export async function counts(id){
  const [postsR,followersR,followingR]=await Promise.all([
    supabase.from('posts').select('id',{count:'exact',head:true}).eq('user_id',id),
    supabase.from('follows').select('follower_id',{count:'exact',head:true}).eq('following_id',id),
    supabase.from('follows').select('following_id',{count:'exact',head:true}).eq('follower_id',id)
  ])
  return {posts:postsR.count||0,followers:followersR.count||0,following:followingR.count||0}
}

export async function posts({userId=null,search='',limit=20,offset=0,viewerId=null,followingOnly=false,popular=false}={}){
  let followedIds=null
  if(followingOnly && viewerId){const fr=await supabase.from('follows').select('following_id').eq('follower_id',viewerId);if(fr.error)throw fr.error;followedIds=(fr.data||[]).map(x=>x.following_id);if(!followedIds.length)return[]}
  let q=supabase.from('posts').select('*,profiles!posts_user_id_fkey(id,username,full_name,avatar_url,city,last_seen)').order('created_at',{ascending:false}).range(offset,offset+limit-1)
  if(userId)q=q.eq('user_id',userId)
  if(followedIds)q=q.in('user_id',followedIds)
  if(popular)q=q.limit(Math.max(limit,50))
  if(search)q=q.ilike('content',`%${search}%`)
  const r=await q;if(r.error)throw r.error
  const list=r.data||[];if(!list.length)return[]
  const ids=list.map(x=>x.id)
  const [ls,cs,bs,meR]=await Promise.all([
    supabase.from('likes').select('post_id,user_id').in('post_id',ids),
    supabase.from('comments').select('post_id').in('post_id',ids),
    supabase.from('bookmarks').select('post_id,user_id').in('post_id',ids),
    supabase.auth.getUser()
  ])
  const me=meR.data.user
  const count=(rows,key)=>rows.reduce((a,x)=>(a[x[key]]=(a[x[key]]||0)+1,a),{})
  const lc=count(ls.data||[],'post_id'),cc=count(cs.data||[],'post_id')
  const myLikes=new Set((ls.data||[]).filter(x=>x.user_id===me?.id).map(x=>x.post_id))
  const mySaves=new Set((bs.data||[]).filter(x=>x.user_id===me?.id).map(x=>x.post_id))
  const mapped=list.map(p=>({...p,like_count:lc[p.id]||0,comment_count:cc[p.id]||0,liked:myLikes.has(p.id),saved:mySaves.has(p.id),view_count:p.view_count||0}))
  if(popular)return mapped.sort((a,b)=>(b.like_count+b.comment_count*1.5)-(a.like_count+a.comment_count*1.5)).slice(0,limit)
  return mapped
}

export async function createPost({userId,content,imageUrls=[]}){const payload={user_id:userId,content:content||'',image_url:imageUrls[0]||null,media_urls:imageUrls,view_count:0};const r=await supabase.from('posts').insert(payload).select().single();if(r.error)throw r.error;return r.data}

export async function uploadImages(userId,files,onProgress){const urls=[];for(let i=0;i<files.length;i++){const f=files[i];if(f.size>10*1024*1024)throw Error('Фото больше 10 МБ');if(!f.type.startsWith('image/'))throw Error('Можно загружать только изображения');const ext=(f.name.split('.').pop()||'jpg').toLowerCase();const path=`${userId}/${crypto.randomUUID()}.${ext}`;const r=await supabase.storage.from('post-images').upload(path,f,{upsert:false,contentType:f.type});if(r.error)throw r.error;urls.push(supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl);onProgress?.((i+1)/files.length)}return urls}

export async function toggleLike(postId,userId,liked){const r=liked?await supabase.from('likes').delete().eq('post_id',postId).eq('user_id',userId):await supabase.from('likes').insert({post_id:postId,user_id:userId});if(r.error)throw r.error}
export async function comments(postId){const r=await supabase.from('comments').select('*,profiles!comments_user_id_fkey(id,username,full_name,avatar_url)').eq('post_id',postId).order('created_at',{ascending:true}).limit(100);if(r.error)throw r.error;return r.data||[]}
export async function addComment(postId,userId,content,parentId=null){const r=await supabase.from('comments').insert({post_id:postId,user_id:userId,content,parent_id:parentId}).select('*,profiles!comments_user_id_fkey(id,username,full_name,avatar_url)').single();if(r.error)throw r.error;return r.data}
export async function deleteComment(id,userId){const r=await supabase.from('comments').delete().eq('id',id).eq('user_id',userId);if(r.error)throw r.error}
export async function deletePost(id,userId){const r=await supabase.from('posts').delete().eq('id',id).eq('user_id',userId);if(r.error)throw r.error}
export async function follow(target,userId,isFollowing){const r=isFollowing?await supabase.from('follows').delete().eq('follower_id',userId).eq('following_id',target):await supabase.from('follows').insert({follower_id:userId,following_id:target});if(r.error)throw r.error}
export async function following(target,userId){const r=await supabase.from('follows').select('follower_id').eq('follower_id',userId).eq('following_id',target).maybeSingle();if(r.error)throw r.error;return Boolean(r.data)}
export async function save(postId,userId,saved){const r=saved?await supabase.from('bookmarks').delete().eq('post_id',postId).eq('user_id',userId):await supabase.from('bookmarks').insert({post_id:postId,user_id:userId});if(r.error)throw r.error}
export async function notifications(userId){const r=await supabase.from('notifications').select('*,profiles!notifications_actor_id_fkey(id,username,full_name,avatar_url)').eq('user_id',userId).order('created_at',{ascending:false}).limit(50);if(r.error)throw r.error;return r.data||[]}
export async function markNotifications(userId){await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',userId).is('read_at',null)}
export async function unreadNotifications(userId){const r=await supabase.from('notifications').select('id',{count:'exact',head:true}).eq('user_id',userId).is('read_at',null);return r.count||0}
export async function people(q=''){let s=supabase.from('profiles').select('*').order('full_name',{ascending:true}).limit(30);if(q)s=s.or(`username.ilike.%${q}%,full_name.ilike.%${q}%`);const r=await s;if(r.error)throw r.error;return r.data||[]}
export async function updateProfile(id,payload){const r=await supabase.from('profiles').update(payload).eq('id',id).select().single();if(r.error)throw r.error;return r.data}
export async function conversations(userId){const r=await supabase.from('conversations').select('id,updated_at,conversation_members!inner(user_id),messages(id,body,created_at,user_id)').eq('conversation_members.user_id',userId).order('updated_at',{ascending:false});if(r.error)throw r.error;return r.data||[]}
export async function conversationPeople(conversationIds){if(!conversationIds.length)return[];const r=await supabase.from('conversation_members').select('conversation_id,user_id,profiles(id,username,full_name,avatar_url,last_seen)').in('conversation_id',conversationIds);if(r.error)throw r.error;return r.data||[]}
export async function startConversation(userId,otherId){const existing=await supabase.from('conversation_members').select('conversation_id').eq('user_id',userId);const ids=(existing.data||[]).map(x=>x.conversation_id);if(ids.length){const r=await supabase.from('conversation_members').select('conversation_id').in('conversation_id',ids).eq('user_id',otherId).limit(1).maybeSingle();if(r.data)return r.data.conversation_id}const c=await supabase.from('conversations').insert({}).select().single();if(c.error)throw c.error;const m=await supabase.from('conversation_members').insert([{conversation_id:c.data.id,user_id:userId},{conversation_id:c.data.id,user_id:otherId}]);if(m.error)throw m.error;return c.data.id}
export async function messageList(conversationId){const r=await supabase.from('messages').select('*,profiles!messages_user_id_fkey(id,username,full_name,avatar_url)').eq('conversation_id',conversationId).order('created_at',{ascending:true}).limit(300);if(r.error)throw r.error;return r.data||[]}
export async function sendMessage(conversationId,userId,body){const r=await supabase.from('messages').insert({conversation_id:conversationId,user_id:userId,body}).select('*,profiles!messages_user_id_fkey(id,username,full_name,avatar_url)').single();if(r.error)throw r.error;return r.data}

export async function incrementPostView(postId,userId){
  const r=await supabase.rpc('register_post_view',{p_post_id:postId,p_user_id:userId});
  if(r.error) throw r.error;
  return Number(r.data||0);
}
