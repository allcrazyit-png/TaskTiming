// Independent public-news service; no reporting data or Sheets access.
const FEEDS=[['lifehealth','中央通訊社・生活'],['local','中央通訊社・地方'],['technology','中央通訊社・科技']];
function doGet(){
 const cache=CacheService.getScriptCache(),props=PropertiesService.getScriptProperties();
 let value=cache.get('news');
 if(!value){
 const lock=LockService.getScriptLock();
 if(lock.tryLock(1000)){try{
 value=cache.get('news');
 if(!value){
 const now=Date.now(),items=[];
 FEEDS.forEach(feed=>{try{
 const res=UrlFetchApp.fetch('https://feeds.feedburner.com/rsscna/'+feed[0],{muteHttpExceptions:true});
 if(res.getResponseCode()!==200)return;
 const channel=XmlService.parse(res.getContentText()).getRootElement().getChild('channel');
 if(!channel)return;
 channel.getChildren('item').forEach(node=>{
 const title=(node.getChildText('title')||'').trim(),date=Date.parse(node.getChildText('pubDate'));
 if(!title||title.length>80||!Number.isFinite(date)||date>now+60000||now-date>86400000)return;
 items.push({title,source:feed[1],publishedAt:new Date(date).toISOString()});
 });
 }catch(e){}});
 const unique=items.sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).filter((item,i,all)=>all.findIndex(other=>other.title===item.title)===i).slice(0,6);
 value=unique.length?JSON.stringify({fetchedAt:new Date(now).toISOString(),items:unique}):props.getProperty('backup')||JSON.stringify({fetchedAt:new Date(now).toISOString(),items:[]});
 if(unique.length)props.setProperty('backup',value);
 cache.put('news',value,3600);
 }
 }finally{lock.releaseLock();}}
 }
 value=value||props.getProperty('backup');
 let data;try{data=JSON.parse(value);}catch(e){data=null;}
 if(!data||Date.now()-Date.parse(data.fetchedAt)>86400000)data={fetchedAt:new Date().toISOString(),items:[]};
 return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
